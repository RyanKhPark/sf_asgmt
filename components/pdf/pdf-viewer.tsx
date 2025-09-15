/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useCallback, useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PDFRenderer } from "./pdf-renderer";
import { useEffect } from "react";

interface PDFViewerProps {
  fileUrl: string;
  title: string;
  totalPages?: number;
  highlightPhrases?: string[];
  documentId?: string;
  highlightStyle?: 'box' | 'underline';
  highlightColor?: string;
  persistHighlights?: boolean;
}

export function PDFViewer({
  fileUrl,
  title,
  totalPages: initialTotalPages,
  highlightPhrases = [],
  documentId,
  highlightStyle = 'box',
  highlightColor,
  persistHighlights = false,
}: PDFViewerProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [numPages, setNumPages] = useState<number | null>(
    initialTotalPages || null
  );
  const [error, setError] = useState<string | null>(null);
  const [annotations, setAnnotations] = useState<Array<{
    id: string; pageNumber: number; x: number; y: number; width: number; height: number; color: string; highlightText?: string;
  }>>([]);

  const containerRef = useRef<HTMLDivElement>(null);

  const handlePrevPage = useCallback(() => {
    setCurrentPage((prev) => Math.max(1, prev - 1));
  }, []);

  const handleNextPage = useCallback(() => {
    if (numPages) {
      setCurrentPage((prev) => Math.min(numPages, prev + 1));
    }
  }, [numPages]);

  const handlePageChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const page = parseInt(event.target.value, 10);
      if (page && numPages && page >= 1 && page <= numPages) {
        setCurrentPage(page);
      }
    },
    [numPages]
  );

  const handleDocumentLoad = useCallback((pages: number) => {
    setNumPages(pages);
  }, []);

  const handleError = useCallback((errorMessage: string) => {
    setError(errorMessage);
  }, []);

  const handlePageRender = useCallback(() => {
    // Page rendered successfully
  }, []);

  // Load persisted annotations for this document
  useEffect(() => {
    let ignore = false;
    const fetchAnnotations = async () => {
      if (!documentId) return;
      try {
        const res = await fetch(`/api/annotations?documentId=${encodeURIComponent(documentId)}`);
        if (!res.ok) return;
        const data = await res.json();
        if (!ignore && data?.annotations) {
          setAnnotations(
            data.annotations.map((a: any) => ({
              id: a.id,
              pageNumber: a.pageNumber,
              x: a.x,
              y: a.y,
              width: a.width,
              height: a.height,
              color: a.color,
              highlightText: a.highlightText,
            }))
          );
        }
      } catch (e) {
        // ignore
      }
    };
    fetchAnnotations();
    return () => { ignore = true; };
  }, [documentId]);

  const handleNavigateToPage = useCallback((pageNumber: number) => {
    if (numPages && pageNumber >= 1 && pageNumber <= numPages) {
      setCurrentPage(pageNumber);
      console.log(`📍 Navigated to page ${pageNumber}`);
    }
  }, [numPages]);

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* PDF Header */}
      <div className="flex items-center justify-between p-4 bg-white border-b border-gray-200">
        <div className="flex items-center space-x-2">
          <h2 className="text-lg font-semibold text-gray-900 truncate max-w-[300px]">
            {title}
          </h2>
        </div>

        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrevPage}
            disabled={currentPage === 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <div className="flex items-center space-x-1">
            <input
              type="number"
              min="1"
              max={numPages || 1}
              value={currentPage}
              onChange={handlePageChange}
              className="w-12 text-center text-sm border border-gray-300 rounded px-1 py-0.5"
            />
            <span className="text-sm text-gray-600">/ {numPages || "..."}</span>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handleNextPage}
            disabled={!numPages || currentPage === numPages}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* PDF Container */}
      <div ref={containerRef} className="flex-1 overflow-x-auto overflow-y-auto p-4 bg-gray-100">
        <div className="min-h-full w-fit">
          {error && (
            <div className="text-center p-8">
              <p className="text-red-600 mb-2">Failed to load PDF</p>
              <p className="text-sm text-gray-500">{error}</p>
            </div>
          )}

          {!error && (
            <PDFRenderer
              fileUrl={fileUrl}
              currentPage={currentPage}
              onDocumentLoad={handleDocumentLoad}
              onError={handleError}
              onPageRender={handlePageRender}
              highlightPhrases={highlightPhrases}
              documentId={documentId}
              onNavigateToPage={handleNavigateToPage}
              highlightStyle={highlightStyle}
              highlightColor={highlightColor}
              persistHighlights={persistHighlights}
              annotations={annotations}
            />
          )}
        </div>
      </div>
    </div>
  );
}
