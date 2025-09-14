"use client";

import { useState, useCallback, useRef } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, RotateCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`;

interface PDFViewerProps {
  fileUrl: string;
  title: string;
  totalPages?: number;
}

export function PDFViewer({ fileUrl, title, totalPages: initialTotalPages }: PDFViewerProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1.2);
  const [rotation, setRotation] = useState(0);
  const [numPages, setNumPages] = useState<number | null>(initialTotalPages || null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  const onDocumentLoadSuccess = useCallback(({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setLoading(false);
    setError(null);
  }, []);

  const onDocumentLoadError = useCallback((error: Error) => {
    setError(error.message);
    setLoading(false);
  }, []);

  const handlePrevPage = useCallback(() => {
    setCurrentPage(prev => Math.max(1, prev - 1));
  }, []);

  const handleNextPage = useCallback(() => {
    if (numPages) {
      setCurrentPage(prev => Math.min(numPages, prev + 1));
    }
  }, [numPages]);

  const handleZoomIn = useCallback(() => {
    setScale(prev => Math.min(3, prev + 0.25));
  }, []);

  const handleZoomOut = useCallback(() => {
    setScale(prev => Math.max(0.5, prev - 0.25));
  }, []);

  const handleRotate = useCallback(() => {
    setRotation(prev => (prev + 90) % 360);
  }, []);

  const handlePageChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const page = parseInt(event.target.value, 10);
    if (page && numPages && page >= 1 && page <= numPages) {
      setCurrentPage(page);
    }
  }, [numPages]);

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* PDF Toolbar */}
      <div className="flex items-center justify-between p-4 bg-white border-b border-gray-200">
        <div className="flex items-center space-x-2">
          <h2 className="text-lg font-semibold text-gray-900 truncate max-w-[300px]">{title}</h2>
        </div>

        <div className="flex items-center space-x-2">
          {/* Page Navigation */}
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrevPage}
            disabled={currentPage === 1 || loading}
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
              disabled={loading}
            />
            <span className="text-sm text-gray-600">
              / {numPages || '...'}
            </span>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handleNextPage}
            disabled={!numPages || currentPage === numPages || loading}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>

          {/* Zoom Controls */}
          <div className="flex items-center space-x-1 ml-4">
            <Button variant="outline" size="sm" onClick={handleZoomOut} disabled={loading}>
              <ZoomOut className="h-4 w-4" />
            </Button>

            <span className="text-sm text-gray-600 min-w-[60px] text-center">
              {Math.round(scale * 100)}%
            </span>

            <Button variant="outline" size="sm" onClick={handleZoomIn} disabled={loading}>
              <ZoomIn className="h-4 w-4" />
            </Button>

            <Button variant="outline" size="sm" onClick={handleRotate} disabled={loading}>
              <RotateCw className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* PDF Display Area */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto p-4 bg-gray-100"
      >
        <div className="flex justify-center items-center min-h-full">
          {loading && (
            <div className="flex flex-col items-center space-y-4">
              <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
              <p className="text-sm text-gray-600">Loading PDF...</p>
            </div>
          )}

          {error && (
            <div className="text-center p-8">
              <p className="text-red-600 mb-2">Failed to load PDF</p>
              <p className="text-sm text-gray-500">{error}</p>
            </div>
          )}

          {!loading && !error && (
            <div className="bg-white shadow-lg border border-gray-300 rounded">
              <Document
                file={fileUrl}
                onLoadSuccess={onDocumentLoadSuccess}
                onLoadError={onDocumentLoadError}
                loading=""
                error=""
              >
                <Page
                  pageNumber={currentPage}
                  scale={scale}
                  rotate={rotation}
                  loading=""
                  error=""
                  renderTextLayer={false}
                  renderAnnotationLayer={false}
                  className="max-w-full h-auto"
                />
              </Document>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}