import { NextRequest, NextResponse } from "next/server";
import { generateText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
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

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Anthropic API key not configured" },
        { status: 500 }
      );
    }

    // Build context from PDF content if available
    let prompt = message;
    if (pdfContent) {
      prompt = `You are an expert professor and academic mentor. You have access to the following document content, and you should engage in a scholarly discussion with the student. Your chat responses should be based on the uploaded PDF content.

Document Content:
${pdfContent}

Instructions:
* Answer the student's question or comment naturally without repeating their input
* Keep responses concise and focused - avoid unnecessary details
* When unclear about the question, ask for clarification
* If the student asks about the document, provide answers based on the content
* For broader discussions, engage with related concepts and applications
* Encourage critical thinking with follow-up questions when appropriate
* Maintain a professional but approachable academic tone
* If the question goes beyond the document scope, acknowledge this but provide relevant insights

Student's message: "${message}"

Respond as a knowledgeable professor would, directly addressing their question or comment.`;
    }

    console.log("Sending to Anthropic:", {
      documentId,
      messageLength: message.length,
    });

    const result = await generateText({
      model: anthropic("claude-3-haiku-20240307"),
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.7,
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

    // Handle specific API errors
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
