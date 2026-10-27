import { readFile } from "node:fs/promises";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

const asText = (value: unknown): string => {
  if (typeof value === "string") return value;
  if (typeof value === "object" && value !== null && "text" in value)
    return String(value.text);
  return "";
};

const toPdfText = (value: string): string =>
  value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[–—‑‒−]/g, "-")
    .replace(/[“”„‟]/g, '"')
    .replace(/[‘’‚‛]/g, "'")
    .replace(/…/g, "...")
    .replace(/[^\x00-\x7F]/g, "?");

interface ResumeStyle {
  width: number;
  height: number;
  margin: number;
  bodySize: number;
  headingSize: number;
  lineGap: number;
}

const wrap = (text: string, maxCharacters: number): string[] => {
  const words = text.replace(/\s+/g, " ").trim().split(" ");
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    if (!word) continue;
    if ((line + " " + word).trim().length > maxCharacters && line) {
      lines.push(line);
      line = word;
    } else {
      line = (line + " " + word).trim();
    }
  }
  if (line) lines.push(line);
  return lines;
};

const median = (values: number[], fallback: number): number => {
  if (values.length === 0) return fallback;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? fallback;
};

const inspectStyle = async (pdfBytes: Buffer): Promise<ResumeStyle> => {
  const loadingTask = getDocument({
    data: new Uint8Array(pdfBytes),
    useSystemFonts: true,
  });
  const pdf = await loadingTask.promise;
  try {
    const firstPage = await pdf.getPage(1);
    const viewport = firstPage.getViewport({ scale: 1 });
    const content = await firstPage.getTextContent();
    const textItems = content.items.filter(
      (item): item is typeof item & { str: string; transform: number[] } =>
        "str" in item &&
        "transform" in item &&
        typeof item.str === "string" &&
        Array.isArray(item.transform),
    );
    const xPositions = textItems
      .map((item) => item.transform[4])
      .filter((x): x is number => typeof x === "number" && x > 0);
    const fontSizes = textItems
      .map((item) => Math.abs(item.transform[0]))
      .filter(
        (size): size is number =>
          typeof size === "number" && size >= 5 && size <= 30,
      );
    const bodySize = median(fontSizes, 10);
    const margin = Math.max(36, Math.min(72, Math.min(...xPositions, 54)));
    return {
      width: viewport.width,
      height: viewport.height,
      margin,
      bodySize,
      headingSize: Math.min(18, Math.max(bodySize + 2, bodySize * 1.25)),
      lineGap: Math.max(3, bodySize * 0.45),
    };
  } finally {
    await loadingTask.destroy();
  }
};

export const renderResumePdf = async (
  originalPdfSource: string | Buffer,
  resume: Record<string, unknown>,
  _keywords: string[] = [],
): Promise<Buffer> => {
  const originalPdf =
    typeof originalPdfSource === "string"
      ? await readFile(originalPdfSource)
      : originalPdfSource;
  const style = await inspectStyle(originalPdf);
  const document = await PDFDocument.load(originalPdf);
  while (document.getPageCount() > 1) {
    document.removePage(document.getPageCount() - 1);
  }
  const page = document.getPage(0);
  const regular = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  const summary = typeof resume.summary === "string" ? toPdfText(resume.summary.trim()) : "";
  if (!summary) return Buffer.from(await document.save());

  const summaryLines = wrap(summary, 100);
  const visibleLines = summaryLines.slice(0, 3);
  if (summaryLines.length > 3) {
    const lastLine = visibleLines[2] ?? "";
    visibleLines[2] = `${lastLine.slice(0, 96).trimEnd()}...`;
  }

  page.drawRectangle({
    x: 30,
    y: 658,
    width: style.width - 60,
    height: 48,
    color: rgb(1, 1, 1),
  });
  visibleLines.forEach((line, index) => {
    page.drawText(line, {
      x: 36,
      y: 695.3 - index * 12,
      size: 10,
      font: regular,
      color: rgb(0.08, 0.08, 0.08),
    });
  });
  return Buffer.from(await document.save());
};
