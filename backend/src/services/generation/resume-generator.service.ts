import { z } from "zod";
import { completeJson } from "./llm.service.js";
import type { RetrievedEvidence } from "../rag/retrieval.service.js";

const generatedResumeSchema = z.object({
    summary: z.string().max(3000).optional(),
    experience: z.array(z.object({ text: z.string().max(3000), evidenceIds: z.array(z.string()).min(1) })).max(50),
    skills: z.array(z.string().max(100)).max(100),
    education: z.array(z.object({ text: z.string().max(3000), evidenceIds: z.array(z.string()).min(1) })).max(30),
    projects: z.array(z.object({ text: z.string().max(3000), evidenceIds: z.array(z.string()).min(1) })).max(50),
});

export type GeneratedResume = z.infer<typeof generatedResumeSchema>;

export const generateGroundedResume = async (jobDescription: string, evidence: RetrievedEvidence[]): Promise<GeneratedResume> => {
    const result = await completeJson(
        "You tailor resumes using only the supplied evidence. Never invent facts, dates, metrics, skills, employers, degrees, or certifications. Every item must include evidenceIds. Return only JSON matching the requested schema.",
        JSON.stringify({ jobDescription, evidence, schema: "summary?, experience[{text,evidenceIds}], skills[], education[{text,evidenceIds}], projects[{text,evidenceIds}]" }),
    );
    return generatedResumeSchema.parse(result);
};