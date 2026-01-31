import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const { lessonId, questionType, count } = await request.json();

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: "Gemini API key not configured" }, { status: 500 });
    }

    if (!lessonId) {
      return NextResponse.json({ error: "Lesson ID is required" }, { status: 400 });
    }

    // Fetch lesson from database
    const supabase = await createClient();
    const { data: lesson, error: lessonError } = await supabase
      .from("lessons")
      .select("*")
      .eq("id", lessonId)
      .single();

    if (lessonError || !lesson) {
      return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
    }

    // Prepare lesson content for Gemini
    const lessonContent = `
Title: ${lesson.title}
${lesson.description ? `Description: ${lesson.description}` : ""}
Category: ${lesson.category}
    `.trim();

    // Determine question types to generate
    const typesToGenerate = questionType === "mixed" 
      ? ["multiple_choice", "true_false", "fill_blank"]
      : [questionType];

    const questionsPerType = Math.ceil((count || 5) / typesToGenerate.length);

    // Generate questions using Gemini API
    const allQuestions = [];

    for (const type of typesToGenerate) {
      const prompt = generatePrompt(lessonContent, type, questionsPerType);
      
      try {
        const geminiResponse = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${process.env.GEMINI_API_KEY}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              contents: [
                {
                  parts: [
                    {
                      text: prompt,
                    },
                  ],
                },
              ],
            }),
          }
        );

        if (!geminiResponse.ok) {
          const errorData = await geminiResponse.text();
          console.error("Gemini API error:", errorData);
          throw new Error("Failed to generate questions from Gemini API");
        }

        const geminiData = await geminiResponse.json();
        const generatedText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "";

        // Parse the JSON response from Gemini
        const parsedQuestions = parseGeminiResponse(generatedText, type, lessonId);
        allQuestions.push(...parsedQuestions);
      } catch (err) {
        console.error(`Error generating ${type} questions:`, err);
        // Continue with other types even if one fails
      }
    }

    // Limit to requested count
    const finalQuestions = allQuestions.slice(0, count || 5);

    return NextResponse.json({ questions: finalQuestions });
  } catch (error: any) {
    console.error("Error generating questions:", error);
    return NextResponse.json({ error: error.message || "Failed to generate questions" }, { status: 500 });
  }
}

function generatePrompt(lessonContent: string, questionType: string, count: number): string {
  const typeInstructions = {
    multiple_choice: "multiple choice questions with 4 options each",
    true_false: "true/false questions",
    fill_blank: "fill-in-the-blank questions",
  };

  return `You are an educational content generator. Based on the following lesson content, generate ${count} ${typeInstructions[questionType as keyof typeof typeInstructions] || "questions"}.

Lesson Content:
${lessonContent}

Requirements:
${questionType === "multiple_choice" 
  ? "- Each question must have exactly 4 options (A, B, C, D)
- Mark the correct answer with its index (0 for A, 1 for B, 2 for C, 3 for D)
- Options should be plausible but only one should be correct"
  : questionType === "true_false"
  ? "- Each question should be a clear statement that can be definitively true or false
- Mark the correct answer as true or false"
  : "- Each question should have a blank (represented as ______) where the answer goes
- Provide the correct answer as a string"}

Return your response as a valid JSON array in this exact format:
[
  {
    "question": "Question text here",
    ${questionType === "multiple_choice" ? '"options": ["Option A", "Option B", "Option C", "Option D"],\n    "correct_answer": 0' : questionType === "true_false" ? '"correct_answer": true' : '"correct_answer": "answer text"'},
    "type": "${questionType}"
  }
]

Only return the JSON array, no additional text or explanation.`;
}

function parseGeminiResponse(responseText: string, questionType: string, lessonId: string): any[] {
  try {
    // Try to extract JSON from the response (Gemini might add markdown formatting)
    let jsonText = responseText.trim();
    
    // Remove markdown code blocks if present
    if (jsonText.startsWith("```json")) {
      jsonText = jsonText.replace(/```json\n?/g, "").replace(/```\n?/g, "");
    } else if (jsonText.startsWith("```")) {
      jsonText = jsonText.replace(/```\n?/g, "");
    }

    // Try to find JSON array in the text
    const jsonMatch = jsonText.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      jsonText = jsonMatch[0];
    }

    const parsed = JSON.parse(jsonText);
    
    if (!Array.isArray(parsed)) {
      throw new Error("Response is not an array");
    }

    // Transform to our format
    return parsed.map((q: any, index: number) => ({
      id: `gen-${Date.now()}-${index}`,
      type: q.type || questionType,
      question: q.question || "",
      options: q.options || (questionType === "multiple_choice" ? ["Option A", "Option B", "Option C", "Option D"] : undefined),
      correct_answer: q.correct_answer !== undefined ? q.correct_answer : (questionType === "true_false" ? true : questionType === "multiple_choice" ? 0 : "answer"),
      source_lesson_id: lessonId,
      source_type: "lesson" as const,
      created_at: new Date().toISOString(),
    }));
  } catch (error) {
    console.error("Error parsing Gemini response:", error);
    // Fallback: generate basic questions from the response text
    return generateFallbackQuestions(responseText, questionType, lessonId);
  }
}

function generateFallbackQuestions(text: string, questionType: string, lessonId: string): any[] {
  // Simple fallback if JSON parsing fails
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 20);
  
  return sentences.slice(0, 3).map((sentence, index) => {
    const cleanSentence = sentence.trim();
    
    if (questionType === "multiple_choice") {
      return {
        id: `gen-${Date.now()}-${index}`,
        type: "multiple_choice",
        question: cleanSentence + "?",
        options: ["True", "False", "Maybe", "Not specified"],
        correct_answer: 0,
        source_lesson_id: lessonId,
        source_type: "lesson" as const,
        created_at: new Date().toISOString(),
      };
    } else if (questionType === "true_false") {
      return {
        id: `gen-${Date.now()}-${index}`,
        type: "true_false",
        question: cleanSentence + "?",
        correct_answer: true,
        source_lesson_id: lessonId,
        source_type: "lesson" as const,
        created_at: new Date().toISOString(),
      };
    } else {
      return {
        id: `gen-${Date.now()}-${index}`,
        type: "fill_blank",
        question: cleanSentence.replace(/\w+/g, (match, offset) => offset === 0 ? "______" : match) + "?",
        correct_answer: "answer",
        source_lesson_id: lessonId,
        source_type: "lesson" as const,
        created_at: new Date().toISOString(),
      };
    }
  });
}

