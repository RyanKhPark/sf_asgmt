import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

// GET /api/documents?limit=5 -> recent documents for current user
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limitParam = searchParams.get("limit");
    const limit = Math.max(1, Math.min(20, Number(limitParam) || 5));

    const documents = await db.document.findMany({
      where: { userId: session.user.id },
      orderBy: { uploadedAt: "desc" },
      take: limit,
      select: {
        id: true,
        title: true,
        filename: true,
        uploadedAt: true,
        totalPages: true,
        processingStatus: true,
      },
    });

    return NextResponse.json({ documents });
  } catch (error) {
    console.error("Error listing documents:", error);
    return NextResponse.json(
      { error: "Failed to fetch documents" },
      { status: 500 }
    );
  }
}

