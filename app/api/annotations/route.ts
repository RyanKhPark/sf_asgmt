import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const annotationSchema = z.object({
  documentId: z.string(),
  type: z.enum(["highlight", "note", "ai_highlight"]),
  highlightText: z.string(),
  content: z.string().optional(),
  pageNumber: z.number(),
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
  color: z.string().default("#ffff00"),
  createdBy: z.enum(["user", "ai"]),
});

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const validation = annotationSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid annotation data", details: validation.error.issues },
        { status: 400 }
      );
    }

    const data = validation.data;

    // Verify document belongs to user
    const document = await db.document.findFirst({
      where: {
        id: data.documentId,
        userId: session.user.id,
      },
    });

    if (!document) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
      );
    }

    // DB-side de-duplication: check for an existing annotation with near-identical fields
    const candidates = await db.annotation.findMany({
      where: {
        documentId: data.documentId,
        userId: session.user.id,
        pageNumber: data.pageNumber,
        highlightText: data.highlightText,
        type: data.type,
        createdBy: data.createdBy,
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    const epsilon = 2; // pixels tolerance
    const existing = candidates.find(a =>
      Math.abs(a.x - data.x) <= epsilon &&
      Math.abs(a.y - data.y) <= epsilon &&
      Math.abs(a.width - data.width) <= epsilon &&
      Math.abs(a.height - data.height) <= epsilon &&
      a.color === data.color
    );

    if (existing) {
      console.log(`ℹ️ Skipping duplicate annotation id=${existing.id} (deduped)`);
      return NextResponse.json({
        success: true,
        annotation: {
          id: existing.id,
          type: existing.type,
          highlightText: existing.highlightText,
          pageNumber: existing.pageNumber,
          x: existing.x,
          y: existing.y,
          width: existing.width,
          height: existing.height,
          color: existing.color,
          createdBy: existing.createdBy,
          createdAt: existing.createdAt,
        },
        deduped: true,
      });
    }

    // Create annotation
    const annotation = await db.annotation.create({
      data: {
        type: data.type,
        content: data.content,
        highlightText: data.highlightText,
        pageNumber: data.pageNumber,
        x: data.x,
        y: data.y,
        width: data.width,
        height: data.height,
        color: data.color,
        createdBy: data.createdBy,
        documentId: data.documentId,
        userId: session.user.id,
      },
    });

    console.log(`✅ Annotation stored: "${data.highlightText}" on page ${data.pageNumber}`);

    return NextResponse.json({
      success: true,
      annotation: {
        id: annotation.id,
        type: annotation.type,
        highlightText: annotation.highlightText,
        pageNumber: annotation.pageNumber,
        x: annotation.x,
        y: annotation.y,
        width: annotation.width,
        height: annotation.height,
        color: annotation.color,
        createdBy: annotation.createdBy,
        createdAt: annotation.createdAt,
      },
    });

  } catch (error) {
    console.error("Annotation creation error:", error);
    return NextResponse.json(
      { error: "Failed to create annotation" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const documentId = searchParams.get("documentId");

    if (!documentId) {
      return NextResponse.json(
        { error: "Document ID required" },
        { status: 400 }
      );
    }

    // Verify document belongs to user
    const document = await db.document.findFirst({
      where: {
        id: documentId,
        userId: session.user.id,
      },
    });

    if (!document) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
      );
    }

    // Get annotations
    const annotations = await db.annotation.findMany({
      where: {
        documentId,
        userId: session.user.id,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json({
      success: true,
      annotations,
    });

  } catch (error) {
    console.error("Annotation fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch annotations" },
      { status: 500 }
    );
  }
}
