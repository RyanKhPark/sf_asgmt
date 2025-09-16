import { redirect, notFound } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { PDFChatWrapper } from "./pdf-chat-wrapper";

interface PDFChatPageProps {
  params: {
    documentId: string;
  };
}

export default async function PDFChatPage({ params }: PDFChatPageProps) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/");
  }

  const document = await db.document.findFirst({
    where: {
      id: params.documentId,
      userId: session.user.id,
    },
  });

  if (!document || !document.fileUrl) {
    redirect("/");
  }

  return (
    <PDFChatWrapper
      document={{
        id: document.id,
        title: document.title,
        fileUrl: document.fileUrl,
        extractedText: document.extractedText,
        totalPages: document.totalPages,
      }}
    />
  );
}
