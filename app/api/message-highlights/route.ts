import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { messageId, annotationId } = await request.json();
    if (!messageId || !annotationId) {
      return NextResponse.json(
        { error: "messageId and annotationId are required" },
        { status: 400 }
      );
    }

    // Validate ownership and document consistency
    const message = await db.message.findFirst({
      where: { id: messageId },
      include: { conversation: true },
    });
    const annotation = await db.annotation.findFirst({ where: { id: annotationId } });

    if (!message || !annotation) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const conversation = message.conversation;
    if (!conversation) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    // Ensure same user
    if (conversation.userId !== session.user.id || annotation.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Ensure same document
    if (conversation.documentId !== annotation.documentId) {
      return NextResponse.json(
        { error: "Message and annotation belong to different documents" },
        { status: 400 }
      );
    }

    // Create or reuse link
    const link = await db.messageHighlight.upsert({
      where: { messageId_annotationId: { messageId, annotationId } },
      update: {},
      create: { messageId, annotationId },
    });

    return NextResponse.json({ success: true, id: link.id });
  } catch (error) {
    console.error("Error linking message highlight:", error);
    return NextResponse.json(
      { error: "Failed to link message and annotation" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const messageId = searchParams.get("messageId");
    const annotationId = searchParams.get("annotationId");

    if (!messageId && !annotationId) {
      return NextResponse.json(
        { error: "Provide messageId or annotationId for deletion" },
        { status: 400 }
      );
    }

    // Narrow by ownership by joining through message/annotation
    if (messageId) {
      const message = await db.message.findFirst({ where: { id: messageId }, include: { conversation: true } });
      if (!message || message.conversation.userId !== session.user.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      // Delete links for this message
      await db.messageHighlight.deleteMany({ where: { messageId } });
      // Optionally, clean up orphaned AI annotations
      await db.annotation.deleteMany({
        where: {
          createdBy: "ai",
          userId: session.user.id,
          documentId: message.conversation.documentId,
          messageHighlights: { none: {} },
        },
      });
    } else if (annotationId) {
      const annotation = await db.annotation.findFirst({ where: { id: annotationId } });
      if (!annotation || annotation.userId !== session.user.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      await db.messageHighlight.deleteMany({ where: { annotationId } });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting message highlights:", error);
    return NextResponse.json(
      { error: "Failed to delete message highlights" },
      { status: 500 }
    );
  }
}

