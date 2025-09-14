import pdf from "pdf-parse";

export interface PDFProcessingResult {
  text: string;
  totalPages: number;
  pages: Array<{
    pageNumber: number;
    text: string;
    width?: number;
    height?: number;
  }>;
  metadata: {
    title?: string;
    author?: string;
    creator?: string;
    producer?: string;
    creationDate?: Date;
    modificationDate?: Date;
  };
}

export async function processPDF(fileBuffer: Buffer): Promise<PDFProcessingResult> {
  try {
    const data = await pdf(fileBuffer, {
      // Extract text from each page separately
      pagerender: render_page,
    });

    const pages = [];
    const pageTexts = data.text.split('\n\f'); // PDF form feed separates pages

    for (let i = 0; i < data.numpages; i++) {
      pages.push({
        pageNumber: i + 1,
        text: pageTexts[i] || '',
        width: undefined, // We'll add dimensions later if needed
        height: undefined,
      });
    }

    return {
      text: data.text,
      totalPages: data.numpages,
      pages,
      metadata: {
        title: data.info?.Title,
        author: data.info?.Author,
        creator: data.info?.Creator,
        producer: data.info?.Producer,
        creationDate: data.info?.CreationDate ? new Date(data.info.CreationDate) : undefined,
        modificationDate: data.info?.ModDate ? new Date(data.info.ModDate) : undefined,
      },
    };
  } catch (error) {
    console.error("PDF processing error:", error);
    throw new Error("Failed to process PDF");
  }
}

// Custom page rendering function for better text extraction
function render_page(pageData: any) {
  // Return text content from page
  return pageData.getTextContent().then((textContent: any) => {
    let lastY, text = '';
    for (let item of textContent.items) {
      if (lastY == item.transform[5] || !lastY) {
        text += item.str;
      } else {
        text += '\n' + item.str;
      }
      lastY = item.transform[5];
    }
    return text;
  });
}

export async function downloadAndProcessPDF(url: string): Promise<PDFProcessingResult> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to download PDF: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    return await processPDF(buffer);
  } catch (error) {
    console.error("PDF download and processing error:", error);
    throw new Error("Failed to download and process PDF");
  }
}