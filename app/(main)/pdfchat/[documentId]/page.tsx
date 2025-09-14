import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";

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

  if (!document) {
    notFound();
  }

  return (
    <div className="flex flex-col h-screen">
      <div className="p-4 border-b">
        <h1 className="text-2xl font-bold">{document.title}</h1>
        <p className="text-gray-600">Chat with your PDF</p>
      </div>

      <div className="flex-1 p-4">
        <p className="text-gray-500">PDF Chat interface</p>
      </div>
    </div>
  );
}
