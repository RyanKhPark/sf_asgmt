# AI-Enhanced PDF Viewer Usage Example

The PDF viewer now supports AI-driven highlighting and navigation. Here's how to integrate it:

## Basic Usage with AI Highlighting

```tsx
import { PDFViewer, type PDFRendererRef } from "@/components/pdf/pdf-viewer";
import { useState, useRef } from "react";

function DocumentChatPage() {
  const [pdfRenderer, setPdfRenderer] = useState<PDFRendererRef | null>(null);
  const [textItems, setTextItems] = useState<TextItem[]>([]);

  const handlePDFReady = (rendererRef: PDFRendererRef) => {
    setPdfRenderer(rendererRef);
    console.log("PDF is ready for AI highlighting!");
  };

  const handleTextExtracted = (items: TextItem[]) => {
    setTextItems(items);
    console.log(`Extracted ${items.length} text items from PDF`);
  };

  // AI Integration Example
  const handleAIResponse = (aiResponse: string, searchTerms: string[]) => {
    if (!pdfRenderer) return;

    // Clear previous highlights
    pdfRenderer.clearHighlights();

    // Highlight each term mentioned by AI
    searchTerms.forEach((term, index) => {
      const color = [`#FFD700`, `#90EE90`, `#87CEEB`][index % 3];
      const results = pdfRenderer.highlightText(term, color);

      console.log(`Found "${term}" on ${results.length} pages`);

      // Navigate to first occurrence
      if (results.length > 0) {
        pdfRenderer.navigateToPage(results[0].pageNumber);
      }
    });
  };

  // Example: AI mentions "blood sugar" - highlight and navigate
  const simulateAIResponse = () => {
    handleAIResponse(
      "The document mentions blood sugar improvements from strength training...",
      ["blood sugar", "strength training", "insulin"]
    );
  };

  return (
    <div className="flex h-screen">
      <div className="w-1/2">
        <PDFViewer
          fileUrl="/path/to/document.pdf"
          title="Research Document"
          onPDFReady={handlePDFReady}
          onTextExtracted={handleTextExtracted}
        />
      </div>

      <div className="w-1/2 p-4">
        <h2>AI Chat</h2>
        <button
          onClick={simulateAIResponse}
          className="mb-4 px-4 py-2 bg-blue-500 text-white rounded"
        >
          Simulate AI Response with Highlighting
        </button>

        {/* Chat interface here */}
      </div>
    </div>
  );
}
```

## Available PDF Methods

```tsx
interface PDFRendererRef {
  // Highlight all occurrences of text across the document
  highlightText: (searchText: string, color?: string) => { pageNumber: number; matches: number }[];

  // Clear all highlights
  clearHighlights: () => void;

  // Navigate to specific page
  navigateToPage: (pageNumber: number) => void;

  // Find text and navigate to first occurrence
  findAndNavigateToText: (searchText: string, color?: string) => boolean;

  // Get all extracted text for AI processing
  getAllTextItems: () => TextItem[];
}
```

## AI Chat Integration

When AI responds with information about the document:

1. **Parse AI response** for key terms
2. **Highlight terms** in the PDF using `highlightText()`
3. **Navigate to relevant page** using `navigateToPage()`
4. **Visual feedback** shows user exactly where information is located

## Performance Benefits

- ✅ **Instant highlighting** - no PDF re-processing
- ✅ **Instant navigation** - pages are pre-cached
- ✅ **Text search ready** - all text coordinates pre-extracted
- ✅ **Multiple highlights** - different colors for different concepts
- ✅ **Persistent highlights** - survive page navigation

## Example AI Response Flow

```
User: "Tell me about blood sugar"

AI Response: "The document mentions that strength training can improve blood sugar levels..."

Action:
1. pdfRenderer.highlightText("blood sugar", "#FFD700")
2. pdfRenderer.highlightText("strength training", "#90EE90")
3. pdfRenderer.navigateToPage(foundPage)

Result: User sees highlighted text on the correct page instantly
```