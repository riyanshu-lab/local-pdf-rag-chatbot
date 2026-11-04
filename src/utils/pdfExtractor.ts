import * as pdfjsLib from 'pdfjs-dist';
// Vite URL import for pdfjs worker
import pdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';

// Set up worker
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;
}

export interface ExtractedPage {
  pageNum: number;
  text: string;
}

export interface PdfExtractionResult {
  pages: ExtractedPage[];
  totalWords: number;
  isScanned: boolean;
  rawSample: string;
}

/**
 * Extracts real text from any user-uploaded PDF file page-by-page.
 */
export async function extractTextFromPdf(file: File): Promise<PdfExtractionResult> {
  const arrayBuffer = await file.arrayBuffer();

  try {
    const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
    const pdfDoc = await loadingTask.promise;
    const numPages = pdfDoc.numPages;

    const pages: ExtractedPage[] = [];
    let totalWords = 0;
    let combinedText = '';

    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      const page = await pdfDoc.getPage(pageNum);
      const textContent = await page.getTextContent();
      
      const pageStrings = textContent.items
        .map((item: any) => item.str || '')
        .filter((str: string) => str.trim().length > 0);

      const pageText = pageStrings.join(' ').replace(/\s+/g, ' ').trim();

      if (pageText.length > 0) {
        pages.push({
          pageNum,
          text: pageText,
        });
        combinedText += ` ${pageText}`;
        totalWords += pageText.split(/\s+/).length;
      }
    }

    if (pages.length === 0) {
      return {
        pages: [],
        totalWords: 0,
        isScanned: true,
        rawSample: '',
      };
    }

    return {
      pages,
      totalWords,
      isScanned: false,
      rawSample: combinedText.slice(0, 300),
    };
  } catch (err) {
    console.warn('pdfjs extraction error, trying fallback stream parser:', err);
    // Fallback stream scanner for simple non-standard PDFs
    const uint8 = new Uint8Array(arrayBuffer);
    const decoder = new TextDecoder('utf-8', { fatal: false });
    const raw = decoder.decode(uint8);
    const textMatches = raw.match(/\(([^)]+)\)\s*T[jJ]/g);
    
    if (textMatches && textMatches.length > 5) {
      const clean = textMatches
        .map(t => t.replace(/[\(\)TjET\\n\r]/g, ' '))
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
      return {
        pages: [{ pageNum: 1, text: clean }],
        totalWords: clean.split(/\s+/).length,
        isScanned: false,
        rawSample: clean.slice(0, 300),
      };
    }

    throw new Error('Could not parse PDF text. It might be scanned or encrypted.');
  }
}
