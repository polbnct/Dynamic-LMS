import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { lessonId, studyAidType } = await request.json();

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: "Gemini API key not configured" }, { status: 500 });
    }

    // For now, return mock study aid
    // In production, integrate with Gemini API to extract text from PDF and generate study aids
    let studyAid;

    if (studyAidType === "flashcards") {
      studyAid = {
        type: "flashcards",
        cards: [
          { front: "What is a set?", back: "A collection of distinct objects" },
          { front: "What is propositional logic?", back: "A branch of logic dealing with statements that can be true or false" },
        ],
      };
    } else if (studyAidType === "fill_blank") {
      studyAid = {
        type: "fill_blank",
        questions: [
          { question: "The union of sets A and B is denoted as ______.", answer: "A ∪ B" },
          { question: "A function that maps every element to itself is called an ______ function.", answer: "identity" },
        ],
      };
    } else {
      studyAid = {
        type: "multiple_choice",
        questions: [
          {
            question: "What is a set in discrete mathematics?",
            options: ["A collection of distinct objects", "A mathematical function", "A type of relation", "A graph structure"],
            correctAnswer: 0,
          },
        ],
      };
    }

    return NextResponse.json({ studyAid });
  } catch (error: any) {
    console.error("Error generating study aid:", error);
    return NextResponse.json({ error: error.message || "Failed to generate study aid" }, { status: 500 });
  }
}

