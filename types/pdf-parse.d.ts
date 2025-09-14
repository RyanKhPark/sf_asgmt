declare module 'pdf-parse' {
  interface PDFInfo {
    Title?: string;
    Author?: string;
    Creator?: string;
    Producer?: string;
    CreationDate?: string;
    ModDate?: string;
  }

  interface PDFData {
    numpages: number;
    text: string;
    info: PDFInfo;
  }

  interface PDFOptions {
    pagerender?: (pageData: any) => Promise<string>;
  }

  function pdf(buffer: Buffer, options?: PDFOptions): Promise<PDFData>;
  export = pdf;
}