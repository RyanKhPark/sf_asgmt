/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useCallback, useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PDFRenderer } from "./pdf-renderer";

interface PDFViewerProps {
  fileUrl: string;
  title: string;
  totalPages?: number;
}

export function PDFViewer({
  fileUrl,
  title,
  totalPages: initialTotalPages,
}: PDFViewerProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [numPages, setNumPages] = useState<number | null>(
    initialTotalPages || null
  );
  const [error, setError] = useState<string | null>(null);

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
      <div ref={containerRef} className="flex-1 overflow-auto p-4 bg-gray-100">
        <div className="flex justify-center items-center min-h-full">
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
            />
          )}
        </div>
      </div>
    </div>
  );
}
