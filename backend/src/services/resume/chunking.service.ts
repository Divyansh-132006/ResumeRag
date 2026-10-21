import type { ResumeSectionBlock } from "./section-detector.service.js";

export interface ResumeChunk {
    id: string;
    section: string;
    text: string;
    index: number;
}

export const chunkResumeSections = (resumeId: string, sections: ResumeSectionBlock[]): ResumeChunk[] =>
    sections.flatMap((section) => section.content.split(/\n{2,}/).map((text) => text.trim()).filter(Boolean))
        .map((text, index) => ({ id: `${resumeId}-${index}`, section: sections.find((item) => item.content.includes(text))?.section ?? "additional", text, index }));
