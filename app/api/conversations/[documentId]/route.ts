import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

// GET: Load conversation history for a document
export async function GET(
  request: NextRequest,
  { params }: { params: { documentId: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { documentId } = params;

    // Find or create conversation for this document and user
    let conversation = await db.conversation.findFirst({
      where: {
        documentId,
        userId: session.user.id,
      },
      include: {
        messages: {
          orderBy: {
            createdAt: "asc",
          },
        },
      },
    });

    if (!conversation) {
      // Create a new conversation if none exists
      conversation = await db.conversation.create({
        data: {
          userId: session.user.id,
          documentId,
          title: "Chat Session",
        },
        include: {
          messages: true,
        },
      });
    }

    // Transform messages to match frontend format
    const messages = conversation.messages.map((message) => ({
      id: message.id,
      text: message.content,
      isUser: message.role === "user",
      timestamp: message.createdAt,
    }));

    return NextResponse.json({
      conversationId: conversation.id,
      messages,
    });
  } catch (error) {
    console.error("Load conversation error:", error);
    return NextResponse.json(
      { error: "Failed to load conversation" },
      { status: 500 }
    );
  }
}

// POST: Save a message to the conversation
export async function POST(
  request: NextRequest,
  { params }: { params: { documentId: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { documentId } = params;
    const { conversationId, message, role } = await request.json();

    if (!message || !role) {
      return NextResponse.json(
        { error: "Message and role are required" },
        { status: 400 }
      );
    }

    // Verify conversation belongs to user
    const conversation = await db.conversation.findFirst({
      where: {
        id: conversationId,
        userId: session.user.id,
        documentId,
      },
    });

    if (!conversation) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 }
      );
    }

    // Save the message
    const savedMessage = await db.message.create({
      data: {
        content: message,
        role,
        conversationId,
      },
    });

    return NextResponse.json({
      id: savedMessage.id,
      text: savedMessage.content,
      isUser: savedMessage.role === "user",
      timestamp: savedMessage.createdAt,
    });
  } catch (error) {
    console.error("Save message error:", error);
    return NextResponse.json(
      { error: "Failed to save message" },
      { status: 500 }
    );
  }
}