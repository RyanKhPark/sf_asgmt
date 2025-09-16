import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { downloadAndProcessPDF } from "@/lib/pdf-processor";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const documentId = params.id;

    // Get document from database
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

    if (!document.fileUrl) {
      return NextResponse.json(
        { error: "Document has no file URL" },
        { status: 400 }
      );
    }

    // Update status to processing
    await db.document.update({
      where: { id: documentId },
      data: { processingStatus: "processing" },
    });

    try {
      // Process the PDF
      const pdfResult = await downloadAndProcessPDF(document.fileUrl);

      // Update document with extracted data
      const updatedDocument = await db.document.update({
        where: { id: documentId },
        data: {
          extractedText: pdfResult.text,
          totalPages: pdfResult.totalPages,
          processingStatus: "completed",
          // Add AI summary later
          aiSummary: `Document contains ${pdfResult.totalPages} pages with ${pdfResult.text.length} characters.`,
        },
      });

      // Save page-by-page content
      const pagePromises = pdfResult.pages.map((page) =>
        db.documentPage.create({
          data: {
            documentId: documentId,
            pageNumber: page.pageNumber,
            extractedText: page.text,
            width: page.width,
            height: page.height,
          },
        })
      );

      await Promise.all(pagePromises);

      

      return NextResponse.json({
        success: true,
        document: {
          id: updatedDocument.id,
          title: updatedDocument.title,
          totalPages: updatedDocument.totalPages,
          processingStatus: updatedDocument.processingStatus,
          extractedText: updatedDocument.extractedText?.substring(0, 500) + "...", // Preview
        },
        metadata: pdfResult.metadata,
      });

    } catch (processingError) {
      // Update status to failed
      await db.document.update({
        where: { id: documentId },
        data: { processingStatus: "failed" },
      });

      throw processingError;
    }

  } catch (error) {
    console.error("Document processing error:", error);
    return NextResponse.json(
      { error: "Failed to process document" },
      { status: 500 }
    );
  }
}
