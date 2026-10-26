import { readFile } from "node:fs/promises";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

const asText = (value: unknown): string => {
    if (typeof value === "string") return value;
    if (typeof value === "object" && value !== null && "text" in value) return String(value.text);
    return "";
};

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
    const loadingTask = getDocument({ data: new Uint8Array(pdfBytes), useSystemFonts: true });
    const pdf = await loadingTask.promise;
    try {
        const firstPage = await pdf.getPage(1);
        const viewport = firstPage.getViewport({ scale: 1 });
        const content = await firstPage.getTextContent();
        const textItems = content.items.filter((item): item is typeof item & { str: string; transform: number[] } =>
            "str" in item && "transform" in item && typeof item.str === "string" && Array.isArray(item.transform)
        );
        const xPositions = textItems.map((item) => item.transform[4]).filter((x): x is number => typeof x === "number" && x > 0);
        const fontSizes = textItems
            .map((item) => Math.abs(item.transform[0]))
            .filter((size): size is number => typeof size === "number" && size >= 5 && size <= 30);
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
    originalPdfPath: string,
    resume: Record<string, unknown>,
    _keywords: string[] = [],
): Promise<Buffer> => {
    const originalPdf = await readFile(originalPdfPath);
    const style = await inspectStyle(originalPdf);
    const document = await PDFDocument.load(originalPdf);
    const page = document.addPage([style.width, style.height]);
    const regular = await document.embedFont(StandardFonts.Helvetica);
    const bold = await document.embedFont(StandardFonts.HelveticaBold);
    const contentWidth = style.width - style.margin * 2;
    const maxCharacters = Math.max(45, Math.floor(contentWidth / (style.bodySize * 0.5)));
    let y = style.height - style.margin;
    const drawLine = (text: string, size = 10, font = regular): void => {
        if (y < style.margin) return;
        page.drawText(text, { x: style.margin, y, size, font, color: rgb(0.08, 0.08, 0.08), maxWidth: contentWidth });
        y -= size + style.lineGap;
    };
    const drawSection = (title: string, values: unknown): void => {
        if (!Array.isArray(values) || values.length === 0) return;
        y -= style.bodySize * 0.5;
        drawLine(title, style.headingSize, bold);
        for (const value of values) {
            for (const line of wrap(asText(value), maxCharacters - 2)) {
                drawLine(`• ${line}`, style.bodySize);
            }
        }
    };

    drawLine("Tailored resume", style.headingSize * 1.35, bold);
    if (typeof resume.summary === "string" && resume.summary.trim()) {
        y -= style.bodySize * 0.5;
        drawLine("Summary", style.headingSize, bold);
        for (const line of wrap(resume.summary, maxCharacters)) drawLine(line, style.bodySize);
    }
    drawSection("Experience", resume.experience);
    drawSection("Skills", resume.skills);
    drawSection("Education", resume.education);
    drawSection("Projects", resume.projects);
    return Buffer.from(await document.save());
};
