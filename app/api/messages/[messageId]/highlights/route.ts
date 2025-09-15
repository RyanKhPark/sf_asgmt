import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: { messageId: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const messageId = params.messageId;
    if (!messageId) {
      return NextResponse.json({ error: "Message ID required" }, { status: 400 });
    }

    // Verify the message belongs to the current user via its conversation
    const message = await db.message.findFirst({
      where: { id: messageId },
      include: { conversation: true },
    });

    if (!message || message.conversation.userId !== session.user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Fetch highlights linked to this message
    const links = await db.messageHighlight.findMany({
      where: { messageId },
      include: { annotation: true },
      orderBy: { id: "asc" },
    });

    const highlights = links
      .filter((l) => !!l.annotation)
      .map((l) => ({
        id: l.annotation.id,
        text: l.annotation.highlightText,
        pageNumber: l.annotation.pageNumber,
        x: l.annotation.x,
        y: l.annotation.y,
        width: l.annotation.width,
        height: l.annotation.height,
        color: l.annotation.color,
        createdAt: l.annotation.createdAt,
      }));

    return NextResponse.json({ highlights });
  } catch (error) {
    console.error("Message highlights fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch message highlights" },
      { status: 500 }
    );
  }
}

