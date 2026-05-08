import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

/**
 * Cleans raw extracted PDF text by:
 * - Removing null bytes and non-printable characters
 * - Collapsing excessive whitespace/newlines
 * - Trimming leading/trailing spaces per line
 * - Removing lines that are just symbols or single characters (artifacts from PDF layouts)
 */
const cleanPDFText = (rawText) => {
  const withoutNullBytes = rawText.split('\u0000').join('');
  const printableOnly = Array.from(withoutNullBytes, (character) => {
    const codePoint = character.codePointAt(0);
    if (codePoint === 0x09 || codePoint === 0x0A || codePoint === 0x0D) return character;
    if (codePoint >= 0x20 && codePoint <= 0x7E) return character;
    if (codePoint >= 0xA0) return character;
    return ' ';
  }).join('');

  return printableOnly
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 2)              // remove single-char artifact lines
    .filter(line => !/^[^a-zA-Z0-9]{3,}$/.test(line)) // remove symbol-only lines
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')                   // collapse 3+ blank lines into 2
    .trim();
};

export const extractTextFromPDF = async (file) => {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let rawText = '';

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();

    // Use hasEOL to preserve line structure from the PDF layout
    const pageText = content.items.map(item => {
      const text = item.str || '';
      return item.hasEOL ? text + '\n' : text + ' ';
    }).join('');

    rawText += pageText + '\n';
  }

  return cleanPDFText(rawText);
};
