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
    const { lessonId, questionType, count, forStudyAid, studyAidSummary, studyAidFlashcard } = await request.json();
    const safeCount =
      typeof count === "number" && Number.isFinite(count)
        ? Math.min(Math.max(count, 1), 10)
        : 10;

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

    // For study aid: summary is one-time (1 summary); fill_blank practice uses normal prompt
    const isSummaryForStudyAid = Boolean(forStudyAid && studyAidSummary);
    const countByType = isSummaryForStudyAid
      ? new Map<string, number>([[typesToGenerate[0], 1]])
      : allocateCountsAcrossTypes(typesToGenerate, safeCount);

    // Generate questions using Gemini API
    const allQuestions = [];

    for (const type of typesToGenerate) {
      const targetCount = countByType.get(type) ?? 0;
      if (targetCount <= 0) continue;

      let collectedForType: any[] = [];
      let attempts = 0;
      const maxAttempts = isSummaryForStudyAid ? 1 : 2;

      while (collectedForType.length < targetCount && attempts < maxAttempts) {
        attempts += 1;
        const remainingCount = isSummaryForStudyAid ? 1 : targetCount - collectedForType.length;
        const prompt = isSummaryForStudyAid
          ? generateStudyAidSummaryPrompt(lessonMetadata)
          : generatePrompt(lessonMetadata, type, remainingCount, forStudyAid, Boolean(studyAidFlashcard && type === "true_false"));

        try {
          // Use only v1beta/gemini-flash-latest model
          const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${process.env.GEMINI_API_KEY}`;

          console.log(`\n=== Generating ${type} questions using v1beta/gemini-flash-latest (attempt ${attempts}, remaining ${remainingCount}) ===`);
          console.log(`API Key present: ${!!process.env.GEMINI_API_KEY}`);

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
            generationConfig: {
              // Ask Gemini to return raw JSON text instead of prose/markdown.
              responseMimeType: "application/json",
            },
          };

          const geminiResponse = await fetch(url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(requestBody),
          });

          if (!geminiResponse.ok) {
            const errorText = await geminiResponse.text();
            let errorMessage = errorText;
            try {
              const errorJson = JSON.parse(errorText);
              errorMessage = errorJson.error?.message || errorJson.message || errorText;
            } catch (e) {
              // Not JSON, use as-is
            }
            console.error(`Gemini API error: ${errorMessage}`);
            throw new Error(`Failed to generate questions from Gemini API: ${errorMessage}`);
          }

          const geminiData = await geminiResponse.json();
          const generatedText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "";

          if (!generatedText) {
            console.error(`Empty response from Gemini for ${type} questions:`, JSON.stringify(geminiData, null, 2));
            throw new Error(`Gemini API returned empty response for ${type} questions`);
          }

          console.log(`Gemini response for ${type}:`, generatedText.substring(0, 500)); // Log first 500 chars for debugging

          // Parse the JSON response from Gemini
          const parsedQuestions = isSummaryForStudyAid
            ? parseStudyAidSummaryResponse(generatedText, lessonId)
            : parseGeminiResponse(
                generatedText,
                type,
                lessonId,
                forStudyAid,
                remainingCount,
                Boolean(studyAidFlashcard && type === "true_false")
              );
          console.log(`Parsed ${parsedQuestions.length} questions for ${type}`);
          collectedForType.push(...parsedQuestions);
        } catch (err: any) {
          console.error(`Error generating ${type} questions:`, err);
          console.error(`Error details:`, {
            message: err?.message,
            stack: err?.stack,
            type: type,
          });
          // Continue with other types/attempts even if one fails
        }
      }

      if (!isSummaryForStudyAid && collectedForType.length > targetCount) {
        collectedForType = collectedForType.slice(0, targetCount);
      }

      allQuestions.push(...collectedForType);
    }

    // Limit to requested count (except for summary which is always 1)
    const finalQuestions = isSummaryForStudyAid ? allQuestions : allQuestions.slice(0, safeCount);

    return NextResponse.json({ questions: finalQuestions });
  } catch (error: any) {
    console.error("Error generating questions:", error);
    return NextResponse.json({ error: error.message || "Failed to generate questions" }, { status: 500 });
  }
}

function generateStudyAidSummaryPrompt(lessonMetadata: string): string {
  return `You are an educational content generator specializing in creating study aid summaries. Based on the PDF document provided and the following lesson metadata, generate ONE comprehensive summary of the lesson content.

CRITICAL: The summary MUST be based on the actual content of the PDF document, not just the metadata below. You must read and analyze the PDF content thoroughly to create an accurate, comprehensive summary.

Lesson Metadata (for context only):
${lessonMetadata}

The PDF document is attached to this request. You must analyze its content carefully and create a summary based on the actual material, facts, concepts, and information presented in the PDF.

Summary Requirements:
- Create a comprehensive summary that covers the main topics, key concepts, and important information from the PDF
- The summary should be well-structured and easy to understand
- Focus on the most important points that students should remember
- Use clear, concise language appropriate for study purposes
- The summary should help students review and understand the lesson content

IMPORTANT: You MUST return ONLY a valid JSON object. Do not include any markdown formatting, code blocks, explanatory text, or any other content. Return ONLY the JSON object starting with { and ending with }.

Return your response as a valid JSON object in this exact format:
{
  "question": "Comprehensive summary text here covering all key points from the PDF...",
  "correct_answer": "This is a summary study aid",
  "type": "fill_blank"
}
CRITICAL: Return ONLY the JSON object. No markdown, no code blocks, no explanations, no additional text. Just the raw JSON object starting with { and ending with }.`;
}

function allocateCountsAcrossTypes(types: string[], totalCount: number): Map<string, number> {
  const counts = new Map<string, number>();
  if (types.length === 0) return counts;

  const base = Math.floor(totalCount / types.length);
  let remainder = totalCount % types.length;

  for (const type of types) {
    const next = base + (remainder > 0 ? 1 : 0);
    counts.set(type, next);
    if (remainder > 0) remainder -= 1;
  }

  return counts;
}

function generatePrompt(
  lessonMetadata: string,
  questionType: string,
  count: number,
  forStudyAid?: boolean,
  studyAidFlashcard?: boolean
): string {
  const typeInstructions = {
    multiple_choice: "multiple choice questions with 4 options each",
    true_false: "true/false questions",
    fill_blank: "fill-in-the-blank questions",
  };

  let requirements = "";
  let specificGuidelines = "";
  
  if (questionType === "multiple_choice") {
    requirements = "- Each question must have exactly 4 options (A, B, C, D)\n- Mark the correct answer with its index (0 for A, 1 for B, 2 for C, 3 for D)\n- Options should be plausible but only one should be correct";
    if (forStudyAid) {
      specificGuidelines = `- Create study aid questions that help students learn and review key concepts from the PDF
- Focus on important information that students should remember and understand
- Each question should reinforce learning of essential concepts, definitions, or facts
- The correct answer should be clearly identifiable and help students learn the material
- Distractors should be educational - they should help students think about related concepts
- Questions should cover the most important topics from the document
- Make questions that promote understanding, not just memorization`;
    } else {
      specificGuidelines = `- Create questions that test understanding of key concepts, definitions, relationships, or applications from the PDF
- Each question should focus on a specific piece of information or concept from the document
- The correct answer should be clearly identifiable from the PDF content
- Distractors (wrong options) should be related to the topic but clearly incorrect
- Avoid trivial questions - focus on meaningful learning objectives
- Questions should vary in difficulty and cover different sections of the document`;
    }
  } else if (questionType === "true_false") {
    if (forStudyAid && studyAidFlashcard) {
      requirements = "- Return each item as a TERM/EXPLANATION flashcard\n- Put the front term/concept in \"question\"\n- Put the back explanation in \"correct_answer\" as a string";
      specificGuidelines = `- Make proper flashcards for active recall (not true/false statements)
- Front side MUST be a term, concept name, notation, or short cue phrase (not a full true/false claim)
- Back side MUST explain or define the front item clearly and concisely
- Prefer concept-application cues (e.g., "How would you...", "What method applies when...")
- Keep backs concise and study-friendly (usually 1-3 sentences)
- Avoid yes/no phrasing and avoid boolean-style items
- Do NOT start backs with "True" or "False"`;
    } else {
      requirements = "- Each question should be a clear statement that can be definitively true or false\n- Mark the correct answer as true or false";
      if (forStudyAid) {
      specificGuidelines = `- Create flashcard-style statements that help students review important facts from the PDF
- Focus on key concepts, definitions, and essential information students should remember
- Each statement should reinforce learning of important material
- Mix both true and false statements to help students think critically
- False statements should be educational - they should highlight common misconceptions or important distinctions
- Statements should help students understand and remember the core content
- Make flashcards that promote active recall and learning`;
      } else {
      specificGuidelines = `- Create statements that are definitively true or false based on the PDF content
- Focus on factual claims, definitions, relationships, or principles from the document
- Avoid ambiguous statements - each should have a clear answer based on the PDF
- Mix both true and false statements to test comprehension
- False statements should be plausible but clearly contradicted by the PDF content
- Questions should test understanding of important concepts from the document`;
      }
    }
  } else {
    requirements = "- Each question should have a blank (represented as ______) where the answer goes\n- Provide the correct answer as a string";
    if (forStudyAid) {
      specificGuidelines = `- Create study aid questions that help students review key terms and concepts
- Focus on important vocabulary, definitions, and concepts from the PDF
- The blank should represent a key term or concept students should remember
- Questions should reinforce learning of essential information
- Answers should be specific terms or phrases that are important for understanding the material
- Make questions that help students practice recall of important information`;
    } else {
      specificGuidelines = `- Create questions with a single blank (______) where a key term, concept, or phrase should be filled in
- The blank should represent an important term, definition, name, or concept from the PDF
- The question context should make it clear what type of answer is expected
- Answers should be specific terms or phrases found in or directly derived from the PDF content
- Avoid overly vague blanks - be specific about what should fill the blank
- Questions should test recall and understanding of key terminology and concepts`;
    }
  }

  const targetApplicationRatio = forStudyAid ? 0.6 : 0.75;
  const minimumApplicationCount = Math.max(1, Math.ceil(count * targetApplicationRatio));
  const maximumConceptCheckCount = Math.max(0, count - minimumApplicationCount);

  let jsonExample = "";
  if (questionType === "multiple_choice") {
    jsonExample = forStudyAid
      ? '"options": ["Option A", "Option B", "Option C", "Option D"],\n    "correct_answer": 0,\n    "correct_explanation": "Brief explanation of why this option is correct based on the lesson.",\n    "incorrect_explanation": "Brief explanation of why a different selected option would be incorrect."'
      : '"options": ["Option A", "Option B", "Option C", "Option D"],\n    "correct_answer": 0';
  } else if (questionType === "true_false") {
    jsonExample = forStudyAid && studyAidFlashcard
      ? '"question": "Generalized Pigeonhole Principle",\n    "correct_answer": "If N objects are distributed among k containers, at least one container has at least ceil(N/k) objects.",\n    "correct_explanation": "Good recall of the core idea.",\n    "incorrect_explanation": "Revisit the formal statement and focus on the \\"at least\\" threshold."'
      : forStudyAid
      ? '"correct_answer": true,\n    "correct_explanation": "Brief explanation of why this statement is true based on the lesson.",\n    "incorrect_explanation": "Brief explanation of why the opposite answer would be incorrect."'
      : '"correct_answer": true';
  } else {
    jsonExample = forStudyAid
      ? '"correct_answer": "answer text",\n    "correct_explanation": "Brief explanation of why this fill-in answer is correct.",\n    "incorrect_explanation": "Brief explanation of why an incorrect fill-in response would be wrong."'
      : '"correct_answer": "answer text"';
  }

  const purposeContext = forStudyAid
    ? `These questions are for STUDY AID purposes - they should improve mastery through guided practice, not by asking about every small part of the lesson in sequence.
- Prioritize concept application and problem solving: target about 60-70% application/problem-solving and 30-40% core concept checks.
- Use meaningful scenarios, worked-example patterns, symbolic/computational steps, and method selection when the lesson supports them.
- Keep a balanced set: include some direct concept checks, but avoid turning the set into a section-by-section PPT walkthrough.
- Favor transferable understanding ("how to use the concept") over isolated fact recall ("what was listed on one slide").
- If the lesson is mostly conceptual, use reasoning-based application (compare, infer, choose best explanation) instead of pure memorization.`
    : `These questions are for QUIZ/ASSESSMENT purposes and must primarily evaluate whether students can apply concepts to solve problems.
- Prioritize higher-order thinking: target about 70-80% application/analysis and 20-30% foundational concept checks.
- Require method use, interpretation, comparison of approaches, or multi-step reasoning when possible.
- Make distractors highly plausible and misconception-aware so only students with real understanding can pick the correct answer.
- Avoid section-by-section or slide-by-slide coverage; sample the most important ideas and test transfer to new but aligned situations.
- Include a balanced difficulty spread (moderate to challenging), with at least some questions that connect multiple ideas from the lesson.
- If the lesson includes solvable/computable content, include authentic problem-solving items that require applying rules, formulas, or procedures to reach an answer.`;

  return `You are an educational content generator specializing in creating high-quality ${forStudyAid ? "study aid" : "assessment"} questions. Based on the PDF document provided and the following lesson metadata, generate exactly ${count} ${typeInstructions[questionType as keyof typeof typeInstructions] || "questions"}.

CRITICAL: The questions MUST be based on the actual content of the PDF document, not just the metadata below. You must read and analyze the PDF content thoroughly to create accurate, relevant questions.

${purposeContext}

Lesson Metadata (for context only):
${lessonMetadata}

The PDF document is attached to this request. You must analyze its content carefully and generate questions based on the actual material, facts, concepts, and information presented in the PDF.

Question Type: ${
    questionType === "multiple_choice"
      ? "Multiple Choice"
      : questionType === "true_false"
      ? forStudyAid && studyAidFlashcard
        ? "Flashcard (Front/Back)"
        : "True or False"
      : "Fill in the Blank"
  }

Specific Guidelines for ${questionType === "multiple_choice" ? "Multiple Choice" : questionType === "true_false" ? "True/False" : "Fill-in-the-Blank"} ${forStudyAid ? "Study Aid" : ""} Questions:
${specificGuidelines}

Practice and Balance Requirements (STRICT):
- Do NOT generate questions that simply march through each PPT/PDF section in order.
- Select high-value concepts and prioritize questions that require applying those concepts.
- Maintain a balanced set between application/problem-solving and concept checks according to the target mix above.
- When the PDF contains solvable or procedural content, include questions that require students to compute, transform, infer, or choose a valid method, not just define terms.
- Keep questions diverse in cognitive demand (recall, application, analysis) with emphasis on application.

Application Quota (MANDATORY):
- Out of ${count} questions, at least ${minimumApplicationCount} MUST be application/problem-solving questions.
- At most ${maximumConceptCheckCount} may be direct concept-check/recall-style questions.
- If you cannot satisfy this quota, regenerate internally and still return exactly ${count} questions that satisfy it.

Lesson Alignment Rules (MANDATORY):
- Every question MUST be directly grounded in the selected lesson's PDF content.
- Use only concepts, terminology, methods, symbols, and problem styles that are actually present in this lesson.
- Do NOT introduce external topics, assumptions, formulas, or contexts that are not supported by the lesson PDF.
- Do NOT create generic textbook questions that could belong to any lesson; each item should be specifically attributable to this chosen lesson.
- For problem-solving items, mirror the lesson's own approach/patterns (for example: same method family, representation style, or reasoning pattern used in the lesson).
- If the lesson does not support a candidate question, discard it and generate a replacement that is aligned.

What counts as application/problem-solving:
- Requires using a rule, method, formula, procedure, or multi-step reasoning.
- Uses a scenario/example where students must decide how to apply a concept.
- Requires interpretation, comparison of approaches, inference, or error diagnosis.

What does NOT count as application/problem-solving:
- Pure definition recall.
- Asking what appears on a specific slide/section.
- Surface fact lookup without reasoning.

Question-Type Specific Application Rules (STRICT):
${
    questionType === "multiple_choice"
      ? `- Most multiple-choice items should be scenario- or method-based.
- Distractors must represent realistic mistakes or misconceptions from applying the concept.`
      : questionType === "fill_blank"
      ? `- Fill-in-the-blank items should require deriving/applying the right term/result from context, not just isolated vocabulary recall.
- Prefer blanks that represent computed/interpreted outcomes, method names chosen by context, or key applied conclusions.`
      : forStudyAid && studyAidFlashcard
      ? `- For flashcards, "question" should be a short front term/concept and "correct_answer" should be the explanatory back.
- Reject statement-style or yes/no phrasing; rewrite as term/explanation pair aligned to the lesson.`
      : `- True/False items should test reasoning validity (e.g., whether an application/claim is logically valid in a scenario), not standalone trivia statements.
- Include statements that require students to mentally apply principles before deciding true/false.`
  }

Answer Format Clarity (STRICT):
${
    questionType === "fill_blank"
      ? `- For every fill-in-the-blank item, explicitly indicate the expected answer format in the question stem.
- Use one of these exact hints at the end of the stem:
  - "(answer using symbol only)"
  - "(answer using word/term only, not symbol)"
  - "(symbol or word accepted)"
- Ensure "correct_answer" matches the stated format hint.`
      : `- When a question expects symbolic notation vs word/term response, make that expectation explicit in the question wording.`
  }

Case and Formatting Rules (STRICT):
- Use lowercase for generated question text, options, and textual answer strings.
- Symbols and mathematical notation are exempt from letter-casing rules and should remain standard.
- Avoid stylistic capitalization unless required by the lesson's exact notation/content.

${forStudyAid ? `Study Aid Explanation Requirements:
- For every generated question, include:
  - "correct_explanation": a short learner-friendly explanation shown when the student answers correctly.
  - "incorrect_explanation": a short learner-friendly explanation shown when the student answers incorrectly.
- Keep explanations brief (1-2 sentences) and grounded in the PDF content.
- Explanations should help students understand the concept, not just repeat the answer.` : ""}

Wording Rules (STRICT):
- Do NOT begin questions with filler lead-ins such as "According to the material", "According to the provided material", "According to the lesson", or similar phrases.
- Write direct question stems that start immediately with the concept or scenario being asked.

Technical Requirements:
${requirements}

IMPORTANT: You MUST return ONLY a valid JSON array. Do not include any markdown formatting, code blocks, explanatory text, or any other content. Return ONLY the JSON array starting with [ and ending with ].

Return your response as a valid JSON array in this exact format:
[
  {
    "question": "Question text here",
    ${jsonExample},
    "type": "${questionType}"
  }
]

CRITICAL: Return ONLY the JSON array. No markdown, no code blocks, no explanations, no additional text. Just the raw JSON array starting with [ and ending with ].`;
}

function cleanQuestionStem(input: string): string {
  const text = String(input || "").trim();
  if (!text) return text;

  // Remove common filler openings that make stems sound repetitive.
  return text
    .replace(/^\s*according to (the )?(provided )?(lesson|material|text|document)\s*,?\s*/i, "")
    .replace(/^\s*based on (the )?(provided )?(lesson|material|text|document)\s*,?\s*/i, "")
    .trim();
}

function cleanFeedbackText(input: string, fallback: string): string {
  const raw = String(input || "").trim();
  const base = raw || fallback;
  // Remove redundant leading verdict phrases so UI feedback reads naturally.
  return base
    .replace(/^\s*(correct|incorrect|not correct)\s*[:.-]\s*/i, "")
    .trim();
}

function parseStudyAidSummaryResponse(responseText: string, lessonId: string): any[] {
  try {
    let jsonText = responseText.trim();
    jsonText = jsonText.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "");
    jsonText = jsonText.trim();
    
    const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonText = jsonMatch[0];
    }

    const parsed = JSON.parse(jsonText);
    
    if (typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("Response is not a JSON object");
    }

    if (!parsed.question || parsed.question.trim() === "") {
      throw new Error("Summary has no content");
    }

    return [{
      id: `gen-summary-${Date.now()}`,
      type: "fill_blank",
      question: parsed.question.trim(),
      correct_answer: parsed.correct_answer || "This is a summary study aid",
      source_lesson_id: lessonId,
      source_type: "lesson" as const,
      created_at: new Date().toISOString(),
    }];
  } catch (error: any) {
    console.error("Error parsing summary response:", error);
    console.error("Response text:", responseText.substring(0, 500));
    // Fallback: return a basic summary structure
    return [{
      id: `gen-summary-${Date.now()}`,
      type: "fill_blank",
      question: responseText.substring(0, 1000).trim() || "Summary content could not be parsed.",
      correct_answer: "This is a summary study aid",
      source_lesson_id: lessonId,
      source_type: "lesson" as const,
      created_at: new Date().toISOString(),
    }];
  }
}

function parseGeminiResponse(
  responseText: string,
  questionType: string,
  lessonId: string,
  forStudyAid?: boolean,
  expectedCount?: number,
  studyAidFlashcard?: boolean
): any[] {
  try {
    // Clean and extract JSON from the response
    let jsonText = responseText.trim();
    
    // Remove markdown code blocks if present (```json or ```)
    jsonText = jsonText.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "");

    // Some model responses insert a raw newline right before `", "correct_answer"...`,
    // which makes the JSON invalid. Normalize that specific break pattern.
    jsonText = jsonText.replace(
      /\n\s*",\s*"(?=(correct_answer|correct_explanation|incorrect_explanation|type|options)\b)/g,
      '", "'
    );
    
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
    const transformed = parsed.map((q: any, index: number) => {
      // Validate required fields
      if (!q.question || q.question.trim() === "") {
        console.warn(`Question ${index} has no question text, skipping`);
        return null;
      }

      // Build the question object based on type
      const questionObj: any = {
        id: `gen-${Date.now()}-${index}`,
        type: q.type || questionType,
        question: cleanQuestionStem(q.question),
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
          questionObj.correct_answer = forStudyAid
            ? {
                answer: 0,
                correct_explanation: "This is the best-supported choice based on the lesson content.",
                incorrect_explanation: "The selected option is not the best-supported answer from the lesson.",
              }
            : 0;
        } else {
          const parsedAnswer =
            typeof q.correct_answer === "number" ? q.correct_answer : parseInt(q.correct_answer, 10);
          questionObj.correct_answer = forStudyAid
            ? {
                answer: Number.isFinite(parsedAnswer) ? parsedAnswer : 0,
                correct_explanation:
                  typeof q.correct_explanation === "string" && q.correct_explanation.trim()
                    ? q.correct_explanation.trim()
                    : "Correct. This option best matches the lesson content.",
                incorrect_explanation:
                  typeof q.incorrect_explanation === "string" && q.incorrect_explanation.trim()
                    ? q.incorrect_explanation.trim()
                    : "Not quite. Review the lesson details and compare each option carefully.",
              }
            : parsedAnswer;
        }
      } else if (questionType === "true_false") {
        if (studyAidFlashcard) {
          const backText =
            typeof q.correct_answer === "string" && q.correct_answer.trim()
              ? q.correct_answer.trim()
              : "Review the lesson key idea for this card.";
          questionObj.correct_answer = forStudyAid
            ? {
                answer: backText,
                correct_explanation:
                  cleanFeedbackText(
                    typeof q.correct_explanation === "string" ? q.correct_explanation : "",
                    "Great recall. This captures the key concept from the lesson."
                  ),
                incorrect_explanation:
                  cleanFeedbackText(
                    typeof q.incorrect_explanation === "string" ? q.incorrect_explanation : "",
                    "Try recalling the core concept and check the lesson section tied to this card."
                  ),
              }
            : backText;
        } else {
          const parsedAnswer =
            typeof q.correct_answer === "boolean" ? q.correct_answer : q.correct_answer === "true" || q.correct_answer === true;
          questionObj.correct_answer = forStudyAid
            ? {
                answer: parsedAnswer,
                correct_explanation:
                  typeof q.correct_explanation === "string" && q.correct_explanation.trim()
                    ? q.correct_explanation.trim()
                    : "Correct. This statement is supported by the lesson content.",
                incorrect_explanation:
                  typeof q.incorrect_explanation === "string" && q.incorrect_explanation.trim()
                    ? q.incorrect_explanation.trim()
                    : "Not correct. The opposite answer aligns better with the lesson content.",
              }
            : parsedAnswer;
        }
      } else if (questionType === "fill_blank") {
        if (!q.correct_answer || typeof q.correct_answer !== "string") {
          console.warn(`Question ${index} has invalid correct_answer, using default`);
          questionObj.correct_answer = forStudyAid
            ? {
                answer: "answer",
                correct_explanation: "Correct. This term best completes the statement from the lesson.",
                incorrect_explanation: "Not quite. Recheck the key term used in the lesson context.",
              }
            : "answer";
        } else {
          const answer = q.correct_answer.trim();
          questionObj.correct_answer = forStudyAid
            ? {
                answer,
                correct_explanation:
                  typeof q.correct_explanation === "string" && q.correct_explanation.trim()
                    ? q.correct_explanation.trim()
                    : "Correct. This answer matches the concept in the lesson.",
                incorrect_explanation:
                  typeof q.incorrect_explanation === "string" && q.incorrect_explanation.trim()
                    ? q.incorrect_explanation.trim()
                    : "Not correct. Check the exact term or phrase used in the lesson.",
              }
            : answer;
        }
      }

      return questionObj;
    }).filter((q: any) => q !== null); // Remove any null entries

    if (typeof expectedCount === "number" && Number.isFinite(expectedCount)) {
      return transformed.slice(0, Math.max(0, expectedCount));
    }

    return transformed;
  } catch (error: any) {
    console.error("Error parsing Gemini response:", error);
    console.error("Response text that failed to parse:", responseText.substring(0, 500));
    // Fallback: generate basic questions from the response text
    return generateFallbackQuestions(responseText, questionType, lessonId, expectedCount);
  }
}

function generateFallbackQuestions(
  text: string,
  questionType: string,
  lessonId: string,
  expectedCount?: number
): any[] {
  // Simple fallback if JSON parsing fails
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 20);
  const targetCount =
    typeof expectedCount === "number" && Number.isFinite(expectedCount)
      ? Math.max(1, Math.min(10, Math.floor(expectedCount)))
      : Math.max(1, Math.min(3, sentences.length || 1));
  const sourceSentences = sentences.length > 0 ? sentences : ["Generated content from lesson material"];

  return Array.from({ length: targetCount }).map((_, index) => {
    const sentence = sourceSentences[index % sourceSentences.length];
    const cleanSentence = sentence.trim();
    
    if (questionType === "multiple_choice") {
      return {
        id: `gen-${Date.now()}-${index}`,
        type: "multiple_choice",
        question: cleanQuestionStem(cleanSentence + "?"),
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
        question: cleanQuestionStem(cleanSentence + "?"),
        correct_answer: true,
        source_lesson_id: lessonId,
        source_type: "lesson" as const,
        created_at: new Date().toISOString(),
      };
    } else {
      return {
        id: `gen-${Date.now()}-${index}`,
        type: "fill_blank",
        question: cleanQuestionStem(
          cleanSentence.replace(/\w+/g, (match, offset) => (offset === 0 ? "______" : match)) + "?"
        ),
        correct_answer: "answer",
        source_lesson_id: lessonId,
        source_type: "lesson" as const,
        created_at: new Date().toISOString(),
      };
    }
  });
}

