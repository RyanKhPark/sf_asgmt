import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import PDFChatClient from "./pdf-chat-client";

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
    <PDFChatClient
      documentId={params.documentId}
      fileUrl={document.fileUrl}
      title={document.title}
      extractedText={document.extractedText || ""}
      totalPages={document.totalPages || undefined}
    />
  );
}
