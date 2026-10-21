import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { readFile } from "node:fs/promises";

const MAX_PAGES = 10;

interface PdfPage {
    pageNumber: number;
    text: string;
}

interface PdfExtractionResult {
    text: string;
    pages: PdfPage[];
    pageCount: number;
}

export const extractPdfText = async (
    filePath: string
): Promise<PdfExtractionResult> => {

    // 1. Read PDF from filesystem
    const fileBuffer = await readFile(filePath);

    // 2. Basic PDF signature validation
    const header = fileBuffer.subarray(0, 1024);

    if (!header.includes(Buffer.from("%PDF-"))) {
        throw new Error("Invalid PDF file signature");
    }

    // 3. Load PDF using PDF.js
    const loadingTask = getDocument({
        data: new Uint8Array(fileBuffer),
        useSystemFonts: true,
    });

    const pdf = await loadingTask.promise;

    try {

        // 4. Protect against unnecessarily large documents
        if (pdf.numPages > MAX_PAGES) {
            throw new Error(
                `PDF exceeds the maximum of ${MAX_PAGES} pages`
            );
        }

        const extractedPages: PdfPage[] = [];

        // 5. Process every page
        for (
            let pageNumber = 1;
            pageNumber <= pdf.numPages;
            pageNumber++
        ) {
            const page = await pdf.getPage(pageNumber);

            const content = await page.getTextContent();

            // 6. Extract text items with their positions
            const textItems = content.items
                .filter((item) => "str" in item)
                .map((item) => {
                    const textItem = item as {
                        str: string;
                        transform: number[];
                    };

                    return {
                        text: textItem.str,
                        x: textItem.transform[4],
                        y: textItem.transform[5],
                    };
                })
                .filter((item) => item.text.trim().length > 0);

            // 7. Sort text:
            //    first by vertical position,
            //    then by horizontal position.
            const LINE_TOLERANCE = 2;

            textItems.sort((a, b) => {
                if (Math.abs(a.y - b.y) > LINE_TOLERANCE) {
                    return b.y - a.y;
                }

                return a.x - b.x;
            });

            // 8. Group text items belonging to the same line
            const lines: {
                y: number;
                items: typeof textItems;
            }[] = [];

            for (const item of textItems) {

                const existingLine = lines.find(
                    (line) =>
                        Math.abs(line.y - item.y) <= LINE_TOLERANCE
                );

                if (existingLine) {
                    existingLine.items.push(item);
                } else {
                    lines.push({
                        y: item.y,
                        items: [item],
                    });
                }
            }

            // 9. Convert grouped lines into readable text
            const pageText = lines
                .map((line) =>
                    line.items
                        .sort((a, b) => a.x - b.x)
                        .map((item) => item.text)
                        .join(" ")
                        .trim()
                )
                .filter(Boolean)
                .join("\n");

            // 10. Preserve page information
            extractedPages.push({
                pageNumber,
                text: pageText,
            });
        }

        // 11. Return complete extraction result
        return {
            text: extractedPages
                .map((page) => page.text)
                .join("\n"),

            pages: extractedPages,

            pageCount: pdf.numPages,
        };

    } finally {

        // 12. Release PDF.js resources
        await loadingTask.destroy();
    }
};