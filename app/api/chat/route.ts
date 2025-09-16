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
      prompt = `You are an expert professor and academic mentor. Use ONLY the following Document Content to answer. Stay grounded in it and do not fabricate details.

Document Content:
${pdfContent}

Instructions (strict):
- Base every claim on the Document Content above.
- If the required information is not present, reply exactly: "This specific information is not present in the document."
- Do NOT include any fictional dialog, role labels, or stage directions.
- Do NOT include lines beginning with labels like "Student:", "Professor:", "Teacher:", or "Assistant:".
- Do NOT echo back the prompt section headers or the student's message label.
- Keep responses concise and focused.
- If unclear, ask a brief clarifying question.

Student question:
${message}

Respond directly to the student as a professor, in plain prose, without any role labels or fictional conversation.`;
    }

    
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
      temperature: 0.2,
    });

    // Sanitize unwanted dialog/labels from the response
    let text = (result.text || "").trim();
    if (text) {
      const bannedPrefix = /^(\s*)(student(?:'s message)?|professor|teacher|assistant)\s*:/i;
      text = text
        .split("\n")
        .filter((line) => !bannedPrefix.test(line))
        .join("\n")
        .trim();
    }

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
