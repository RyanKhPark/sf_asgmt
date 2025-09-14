import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { PDFViewer } from "@/components/pdf/pdf-viewer";
import { PDFChat } from "@/components/pdf/pdf-chat";

interface PDFChatPageProps {
  params: {
    documentId: string;
  };
}

export default async function PDFChatPage({ params }: PDFChatPageProps) {
  const session = await auth();
  if (!session?.user?.id) {
    notFound();
  }

  const document = await db.document.findFirst({
    where: {
      id: params.documentId,
      userId: session.user.id,
    },
  });

  if (!document || !document.fileUrl) {
    notFound();
  }

  return (
    <div className="flex h-screen bg-white">
      <div className="w-1/2 border-r border-gray-300">
        <PDFViewer
          fileUrl={document.fileUrl}
          title={document.title}
          totalPages={document.totalPages || undefined}
        />
      </div>

      <div className="w-1/2 flex flex-col">
        <PDFChat
          documentId={params.documentId}
          pdfContent={document.extractedText || ""}
        />
      </div>
    </div>
  );
}
