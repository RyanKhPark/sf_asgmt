"use client";

import { useState } from "react";
import { PDFViewer } from "@/components/pdf/pdf-viewer";
import { PDFChat } from "@/components/pdf/pdf-chat";
import { Button } from "@/components/ui/button";

interface PDFChatClientProps {
  documentId: string;
  fileUrl: string;
  title: string;
  extractedText: string;
  totalPages?: number;
}

export default function PDFChatClient({
  documentId,
  fileUrl,
  title,
  extractedText,
  totalPages,
}: PDFChatClientProps) {
  const [highlightPhrases, setHighlightPhrases] = useState<string[]>([]);
  const [showDebug, setShowDebug] = useState(false);
  const [highlightStyle, setHighlightStyle] = useState<'box' | 'underline'>('box');

  const handleHighlightText = (phrases: string[]) => {
    console.log("PDF Chat Client - Highlighting phrases:", phrases);
    setHighlightPhrases(phrases);
  };

  // Debug function to test highlighting
  const testHighlighting = (searchTerm: string) => {
    console.log(`Testing highlight for: "${searchTerm}"`);
    setHighlightPhrases([searchTerm]);
  };

  // Log the file URL for debugging
  console.log("PDF Chat Client - Document ID:", documentId);
  console.log("PDF Chat Client - File URL:", fileUrl);
  console.log("PDF Chat Client - Title:", title);

  return (
    <div className="flex h-screen bg-white">
      <div className="w-1/2 border-r border-gray-300 relative">
        <PDFViewer
          fileUrl={fileUrl}
          title={title}
          totalPages={totalPages}
          highlightPhrases={highlightPhrases}
          documentId={documentId}
          highlightStyle={highlightStyle}
          highlightColor={highlightStyle === 'underline' ? '#ff3333' : '#ffeb3b'}
          persistHighlights={true}
        />

        {/* Debug Panel */}
        <div className="absolute top-4 right-50 z-50">
          <Button
            onClick={() => setShowDebug(!showDebug)}
            className="mb-2"
            size="sm"
            variant="outline"
          >
            {showDebug ? "Hide" : "Show"} Debug
          </Button>

          {showDebug && (
            <div className="bg-white border rounded-lg shadow-lg p-3 space-y-2 w-64">
              <div className="text-xs font-semibold mb-2">
                PDF Debug Controls
              </div>

              <div className="flex items-center justify-between text-xs">
                <span>Highlight Style</span>
                <div className="space-x-1">
                  <Button size="sm" variant={highlightStyle === 'box' ? 'default' : 'outline'} onClick={() => setHighlightStyle('box')}>Box</Button>
                  <Button size="sm" variant={highlightStyle === 'underline' ? 'default' : 'outline'} onClick={() => setHighlightStyle('underline')}>Underline</Button>
                </div>
              </div>

              <Button
                onClick={() => setHighlightPhrases([])}
                className="w-full"
                size="sm"
                variant="outline"
              >
                🧹 Clear Highlights
              </Button>

              <Button
                onClick={() => testHighlighting("blood sugar")}
                className="w-full"
                size="sm"
                variant="outline"
              >
                🔍 Test: "blood sugar"
              </Button>

              <Button
                onClick={() => testHighlighting("strength training")}
                className="w-full"
                size="sm"
                variant="outline"
              >
                🔍 Test: "strength training"
              </Button>

              <Button
                onClick={() => testHighlighting("insulin")}
                className="w-full"
                size="sm"
                variant="outline"
              >
                🔍 Test: "insulin"
              </Button>

              <Button
                onClick={() => testHighlighting("muscle")}
                className="w-full"
                size="sm"
                variant="outline"
              >
                🔍 Test: "muscle"
              </Button>

              <div className="text-xs text-gray-600 mt-2">
                <div>Highlighted: {highlightPhrases.length} phrases</div>
                <div>Open browser console (F12)</div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="w-1/2 flex flex-col">
        <PDFChat
          documentId={documentId}
          pdfContent={extractedText}
          onHighlightText={handleHighlightText}
        />
      </div>
    </div>
  );
}
