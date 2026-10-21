import { readFile } from "node:fs/promises";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const asText = (value: unknown): string => {
    if (typeof value === "string") return value;
    if (typeof value === "object" && value !== null && "text" in value) return String(value.text);
    return "";
};

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

export const renderResumePdf = async (
    originalPdfPath: string,
    resume: Record<string, unknown>,
    keywords: string[] = [],
): Promise<Buffer> => {
    const document = await PDFDocument.load(await readFile(originalPdfPath));
    const page = document.addPage([595.28, 841.89]);
    const regular = await document.embedFont(StandardFonts.Helvetica);
    const bold = await document.embedFont(StandardFonts.HelveticaBold);
    const margin = 54;
    const contentWidth = 595.28 - margin * 2;
    let y = 841.89 - margin;
    const drawLine = (text: string, size = 10, font = regular): void => {
        page.drawText(text, { x: margin, y, size, font, color: rgb(0.08, 0.08, 0.08), maxWidth: contentWidth });
        y -= size + 6;
    };
    const drawSection = (title: string, values: unknown): void => {
        if (!Array.isArray(values) || values.length === 0) return;
        y -= 8;
        drawLine(title, 13, bold);
        for (const value of values) {
            for (const line of wrap(asText(value), 92)) {
                drawLine(`• ${line}`);
            }
        }
    };

    drawLine("Tailored additions", 20, bold);
    drawLine("Original resume pages are preserved unchanged. The evidence-backed tailoring below is appended for review.");
    if (typeof resume.summary === "string" && resume.summary.trim()) {
        y -= 8;
        drawLine("Summary", 13, bold);
        for (const line of wrap(resume.summary, 92)) drawLine(line);
    }
    drawSection("Experience", resume.experience);
    drawSection("Skills", resume.skills);
    drawSection("Education", resume.education);
    drawSection("Projects", resume.projects);
    if (keywords.length > 0) {
        y -= 8;
        drawLine("Job-description keywords supported by evidence", 13, bold);
        for (const line of wrap(keywords.join(", "), 92)) drawLine(line);
    }
    return Buffer.from(await document.save());
};
