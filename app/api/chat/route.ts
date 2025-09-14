import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { auth } from "@/auth";
import { db } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { message, pdfContent, documentId, conversationId } = await request.json();

    if (!message || !documentId) {
      return NextResponse.json(
        { error: "Message and documentId are required" },
        { status: 400 }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Gemini API key not configured" },
        { status: 500 }
      );
    }

    const genAI = new GoogleGenAI({ apiKey: apiKey });

    // Build context from PDF content if available
    let prompt = message;
    if (pdfContent) {
      prompt = `You are an expert professor and academic mentor. You have access to the following document content, and you should engage in a scholarly discussion with the student about the topic, concepts, and broader implications.

Document Content:
${pdfContent}

Student Question/Comment: ${message}

Instructions:
* No need to answer regardless of a question
* Unnecessarily long responses are not appreciated, do not provide unnecessary details
* When not understanding the question, ask for clarification
1. If the student asks a direct question about the document, provide a comprehensive answer based on the content
2. If the student wants to discuss the topic more broadly, engage in an educational conversation about related concepts, applications, and implications
3. Encourage critical thinking by asking follow-up questions when appropriate
4. Provide additional context and connections to related topics when helpful
5. Maintain a professional but approachable academic tone
6. If the question goes beyond the document scope, acknowledge this but still provide relevant insights from your expertise

Please respond as a knowledgeable professor would in an academic discussion.`;
    }

    console.log("Sending to Gemini:", {
      documentId,
      messageLength: message.length,
    });

    const result = await genAI.models.generateContent({
      model: "gemini-1.5-flash",
      contents: prompt,
    });

    const text = result.text;

    // Save both user message and AI response to database if conversationId provided
    if (conversationId) {
      try {
        // Verify conversation belongs to user
        const conversation = await db.conversation.findFirst({
          where: {
            id: conversationId,
            userId: session.user.id,
            documentId,
          },
        });

        if (conversation) {
          // Save user message
          await db.message.create({
            data: {
              content: message,
              role: "user",
              conversationId,
            },
          });

          // Save AI response
          await db.message.create({
            data: {
              content: text || "",
              role: "assistant",
              conversationId,
            },
          });
        }
      } catch (dbError) {
        console.error("Database save error:", dbError);
        // Don't fail the request if database save fails
      }
    }

    return NextResponse.json({
      message: text,
      documentId,
    });
  } catch (error: unknown) {
    console.error("Chat error:", error);

    // Handle specific Gemini API errors
    const errorStatus = (error as { status?: number })?.status;

    if (errorStatus === 503) {
      return NextResponse.json(
        {
          error:
            "AI service is temporarily unavailable. Please try again in a moment.",
        },
        { status: 503 }
      );
    }

    if (errorStatus === 429) {
      return NextResponse.json(
        {
          error: "Too many requests. Please wait a moment before trying again.",
        },
        { status: 429 }
      );
    }

    if (errorStatus === 400) {
      return NextResponse.json(
        { error: "Invalid request. Please check your input." },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to process chat request. Please try again." },
      { status: 500 }
    );
  }
}
