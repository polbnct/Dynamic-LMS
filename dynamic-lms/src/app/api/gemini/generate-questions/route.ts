import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Helper function to check available models (for debugging)
async function checkAvailableModels(): Promise<void> {
  if (!process.env.GEMINI_API_KEY) {
    console.log("No API key found");
    return;
  }

  try {
    console.log("\n=== Checking Available Models ===");
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`
    );
    
    if (response.ok) {
      const data = await response.json();
      console.log("Available models:", data.models?.map((m: any) => ({
        name: m.name,
        displayName: m.displayName,
        supportedGenerationMethods: m.supportedGenerationMethods
      })) || []);
    } else {
      const errorText = await response.text();
      console.log("Error fetching models:", errorText.substring(0, 200));
    }
  } catch (error) {
    console.log("Exception checking models:", error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { lessonId, questionType, count } = await request.json();

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: "Gemini API key not configured" }, { status: 500 });
    }

    if (!lessonId) {
      return NextResponse.json({ error: "Lesson ID is required" }, { status: 400 });
    }

    // Check available models on first request (for debugging)
    await checkAvailableModels();

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

    // Check if lesson has a PDF file
    if (!lesson.pdf_file_path) {
      return NextResponse.json({ error: "Lesson does not have a PDF file. Please upload a PDF first." }, { status: 400 });
    }

    // Download PDF from Supabase storage
    let pdfContent: string | null = null;
    let pdfBase64: string | null = null;
    
    try {
      const { data: pdfData, error: pdfError } = await supabase.storage
        .from("lesson-pdfs")
        .download(lesson.pdf_file_path);

      if (pdfError || !pdfData) {
        console.error("Error downloading PDF:", pdfError);
        return NextResponse.json({ error: "Failed to download PDF from storage" }, { status: 500 });
      }

      // Convert PDF to base64 for Gemini API
      const arrayBuffer = await pdfData.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      pdfBase64 = buffer.toString("base64");
      
      console.log(`PDF downloaded successfully: ${lesson.pdf_file_path}, size: ${buffer.length} bytes`);
    } catch (error) {
      console.error("Error processing PDF:", error);
      return NextResponse.json({ error: "Failed to process PDF file" }, { status: 500 });
    }

    // Prepare lesson metadata for context
    const lessonMetadata = `
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
      const prompt = generatePrompt(lessonMetadata, type, questionsPerType);
      
      try {
        // Use available models from the API key - try newer models first
        // Based on available models: gemini-2.0-flash-lite, gemini-2.0-flash, gemini-flash-latest, gemini-2.5-flash
        const modelConfigs = [
          { version: "v1beta", model: "gemini-2.0-flash-lite", endpoint: "generateContent" },
          { version: "v1beta", model: "gemini-2.0-flash", endpoint: "generateContent" },
          { version: "v1beta", model: "gemini-flash-latest", endpoint: "generateContent" },
          { version: "v1beta", model: "gemini-2.5-flash", endpoint: "generateContent" },
          { version: "v1", model: "gemini-2.0-flash-lite", endpoint: "generateContent" },
          { version: "v1", model: "gemini-2.0-flash", endpoint: "generateContent" },
        ];

        let geminiResponse: Response | null = null;
        let lastError: string = "";
        let successfulConfig: { version: string; model: string; endpoint: string } | null = null;
        let allErrors: string[] = [];

        console.log(`\n=== Testing Gemini API for ${type} questions ===`);
        console.log(`API Key present: ${!!process.env.GEMINI_API_KEY}`);
        console.log(`API Key length: ${process.env.GEMINI_API_KEY?.length || 0}`);

        for (const config of modelConfigs) {
          const url = `https://generativelanguage.googleapis.com/${config.version}/models/${config.model}:${config.endpoint}?key=${process.env.GEMINI_API_KEY}`;
          console.log(`\nTesting: ${config.version}/${config.model}:${config.endpoint}`);
          console.log(`URL: ${url.substring(0, 80)}...`);
          
          try {
            // Prepare request body with PDF content
            const requestBody: any = {
              contents: [
                {
                  parts: [
                    {
                      text: prompt,
                    },
                    // Add PDF as inline data
                    {
                      inline_data: {
                        mime_type: "application/pdf",
                        data: pdfBase64,
                      },
                    },
                  ],
                },
              ],
            };

            const testResponse = await fetch(url, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify(requestBody),
            });

            const responseStatus = testResponse.status;
            const responseStatusText = testResponse.statusText;
            
            console.log(`Response status: ${responseStatus} ${responseStatusText}`);

            if (testResponse.ok) {
              geminiResponse = testResponse;
              successfulConfig = config;
              console.log(`✓✓✓ SUCCESS! Using ${config.model} with ${config.version}:${config.endpoint}`);
              break; // Success! Use this response
            } else {
              const errorText = await testResponse.text();
              let errorMessage = errorText;
              try {
                const errorJson = JSON.parse(errorText);
                errorMessage = errorJson.error?.message || errorJson.message || errorText;
              } catch (e) {
                // Not JSON, use as-is
              }
              lastError = errorMessage;
              allErrors.push(`${config.version}/${config.model}: ${errorMessage.substring(0, 200)}`);
              console.log(`✗ FAILED: ${errorMessage.substring(0, 150)}`);
            }
          } catch (err) {
            const errMsg = err instanceof Error ? err.message : String(err);
            lastError = errMsg;
            allErrors.push(`${config.version}/${config.model}: ${errMsg}`);
            console.log(`✗ EXCEPTION: ${errMsg}`);
          }
        }

        if (!geminiResponse || !geminiResponse.ok) {
          console.error("\n=== ALL CONFIGURATIONS FAILED ===");
          console.error("All errors:", allErrors);
          const errorData = lastError || "All model configurations failed";
          let errorMessage = "Failed to generate questions from Gemini API. ";
          errorMessage += `Tried: ${modelConfigs.map(c => `${c.version}/${c.model}`).join(", ")}. `;
          errorMessage += `Errors: ${allErrors.join("; ")}`;
          throw new Error(errorMessage);
        }

        const geminiData = await geminiResponse.json();
        const generatedText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "";

        if (!generatedText) {
          console.error(`Empty response from Gemini for ${type} questions:`, JSON.stringify(geminiData, null, 2));
          throw new Error(`Gemini API returned empty response for ${type} questions`);
        }

        console.log(`Gemini response for ${type}:`, generatedText.substring(0, 500)); // Log first 500 chars for debugging

        // Parse the JSON response from Gemini
        const parsedQuestions = parseGeminiResponse(generatedText, type, lessonId);
        console.log(`Parsed ${parsedQuestions.length} questions for ${type}`);
        allQuestions.push(...parsedQuestions);
      } catch (err: any) {
        console.error(`Error generating ${type} questions:`, err);
        console.error(`Error details:`, {
          message: err?.message,
          stack: err?.stack,
          type: type,
        });
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

function generatePrompt(lessonMetadata: string, questionType: string, count: number): string {
  const typeInstructions = {
    multiple_choice: "multiple choice questions with 4 options each",
    true_false: "true/false questions",
    fill_blank: "fill-in-the-blank questions",
  };

  let requirements = "";
  if (questionType === "multiple_choice") {
    requirements = "- Each question must have exactly 4 options (A, B, C, D)\n- Mark the correct answer with its index (0 for A, 1 for B, 2 for C, 3 for D)\n- Options should be plausible but only one should be correct";
  } else if (questionType === "true_false") {
    requirements = "- Each question should be a clear statement that can be definitively true or false\n- Mark the correct answer as true or false";
  } else {
    requirements = "- Each question should have a blank (represented as ______) where the answer goes\n- Provide the correct answer as a string";
  }

  let jsonExample = "";
  if (questionType === "multiple_choice") {
    jsonExample = '"options": ["Option A", "Option B", "Option C", "Option D"],\n    "correct_answer": 0';
  } else if (questionType === "true_false") {
    jsonExample = '"correct_answer": true';
  } else {
    jsonExample = '"correct_answer": "answer text"';
  }

  return `You are an educational content generator. Based on the PDF document provided and the following lesson metadata, generate exactly ${count} ${typeInstructions[questionType as keyof typeof typeInstructions] || "questions"}.

IMPORTANT: The questions must be based on the actual content of the PDF document, not just the metadata below. Read and analyze the PDF content thoroughly.

Lesson Metadata (for context only):
${lessonMetadata}

The PDF document is attached to this request. Please analyze its content and generate questions based on the actual material in the PDF.

Requirements:
${requirements}

IMPORTANT: You MUST return ONLY a valid JSON array. Do not include any markdown formatting, code blocks, or explanatory text. Return ONLY the JSON array starting with [ and ending with ].

Return your response as a valid JSON array in this exact format:
[
  {
    "question": "Question text here",
    ${jsonExample},
    "type": "${questionType}"
  }
]

CRITICAL: Return ONLY the JSON array. No markdown, no code blocks, no explanations. Just the raw JSON array.`;
}

function parseGeminiResponse(responseText: string, questionType: string, lessonId: string): any[] {
  try {
    // Clean and extract JSON from the response
    let jsonText = responseText.trim();
    
    // Remove markdown code blocks if present (```json or ```)
    jsonText = jsonText.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "");
    
    // Remove any leading/trailing whitespace
    jsonText = jsonText.trim();
    
    // Try to find JSON array in the text (handles cases where there's extra text)
    const jsonMatch = jsonText.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      jsonText = jsonMatch[0];
    }

    // Parse the JSON
    const parsed = JSON.parse(jsonText);
    
    if (!Array.isArray(parsed)) {
      console.error("Parsed response is not an array:", parsed);
      throw new Error("Response is not an array");
    }

    if (parsed.length === 0) {
      console.warn("Empty array returned from Gemini");
      return [];
    }

    // Transform to our question format with proper validation
    return parsed.map((q: any, index: number) => {
      // Validate required fields
      if (!q.question || q.question.trim() === "") {
        console.warn(`Question ${index} has no question text, skipping`);
        return null;
      }

      // Build the question object based on type
      const questionObj: any = {
        id: `gen-${Date.now()}-${index}`,
        type: q.type || questionType,
        question: q.question.trim(),
        source_lesson_id: lessonId,
        source_type: "lesson" as const,
        created_at: new Date().toISOString(),
      };

      // Add type-specific fields
      if (questionType === "multiple_choice") {
        if (!Array.isArray(q.options) || q.options.length !== 4) {
          console.warn(`Question ${index} has invalid options, using defaults`);
          questionObj.options = ["Option A", "Option B", "Option C", "Option D"];
        } else {
          questionObj.options = q.options;
        }
        
        if (q.correct_answer === undefined || q.correct_answer === null) {
          console.warn(`Question ${index} has no correct_answer, defaulting to 0`);
          questionObj.correct_answer = 0;
        } else {
          questionObj.correct_answer = typeof q.correct_answer === "number" ? q.correct_answer : parseInt(q.correct_answer, 10);
        }
      } else if (questionType === "true_false") {
        questionObj.correct_answer = typeof q.correct_answer === "boolean" ? q.correct_answer : q.correct_answer === "true" || q.correct_answer === true;
      } else if (questionType === "fill_blank") {
        if (!q.correct_answer || typeof q.correct_answer !== "string") {
          console.warn(`Question ${index} has invalid correct_answer, using default`);
          questionObj.correct_answer = "answer";
        } else {
          questionObj.correct_answer = q.correct_answer.trim();
        }
      }

      return questionObj;
    }).filter((q: any) => q !== null); // Remove any null entries
  } catch (error: any) {
    console.error("Error parsing Gemini response:", error);
    console.error("Response text that failed to parse:", responseText.substring(0, 500));
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

