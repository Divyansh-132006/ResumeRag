import { z } from "zod";
import { completeJson } from "./llm.service.js";
import type { RetrievedEvidence } from "../rag/retrieval.service.js";

const generatedResumeSchema = z.object({
  summary: z.string().max(3000).optional(),
});

export type GeneratedResume = z.infer<typeof generatedResumeSchema>;

export const generateGroundedResume = async (
  jobDescription: string,
  evidence: RetrievedEvidence[],
): Promise<GeneratedResume> => {
  const result = await completeJson(
    "You tailor only the professional summary using supplied evidence. Never invent facts, dates, metrics, skills, employers, degrees, or certifications. Return only JSON matching the requested schema.",
    JSON.stringify({
      jobDescription,
      evidence,
      schema: "summary? (string, maximum 3000 characters)",
    }),
  );
  return generatedResumeSchema.parse(result);
};
