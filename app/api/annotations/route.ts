import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const {
      documentId,
      type,
      highlightText,
      pageNumber,
      x,
      y,
      width,
      height,
      color,
      createdBy,
      messageId,
    } = await request.json();

    if (!documentId || !type || !highlightText || !pageNumber) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Create annotation in database
    const annotation = await db.annotation.create({
      data: {
        documentId,
        userId: session.user.id,
        type,
        highlightText,
        content: highlightText, // Same as highlightText for now
        pageNumber,
        x: x || 0,
        y: y || 0,
        width: width || 100,
        height: height || 20,
        color: color || "#ffff00",
        createdBy: createdBy || "user",
      },
    });

    // Saved annotation

    // Optionally link to a message if provided and valid
    if (messageId) {
      try {
        const message = await db.message.findFirst({
          where: { id: messageId },
          include: { conversation: true },
        });
        if (message && message.conversation.userId === session.user.id && message.conversation.documentId === documentId) {
          await db.messageHighlight.upsert({
            where: { messageId_annotationId: { messageId, annotationId: annotation.id } },
            update: {},
            create: { messageId, annotationId: annotation.id },
          });
        }
      } catch (e) {
        console.warn("Failed to link message to annotation (optional):", e);
      }
    }

    return NextResponse.json({
      success: true,
      annotationId: annotation.id,
    });
  } catch (error) {
    console.error("Error saving annotation:", error);
    return NextResponse.json(
      { error: "Failed to save annotation" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const documentId = searchParams.get("documentId");

    if (!documentId) {
      return NextResponse.json(
        { error: "documentId is required" },
        { status: 400 }
      );
    }

    const annotations = await db.annotation.findMany({
      where: {
        documentId,
        userId: session.user.id,
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    return NextResponse.json({ annotations });
  } catch (error) {
    console.error("Error fetching annotations:", error);
    return NextResponse.json(
      { error: "Failed to fetch annotations" },
      { status: 500 }
    );
  }
}
