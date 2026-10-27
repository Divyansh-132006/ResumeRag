import { z } from "zod";
import type { StructuredResume } from "../resume/resume-parser.service.js";
import type { GeneratedResume } from "./resume-generator.service.js";

const resumeItemSchema = z.object({
  text: z.string(),
  sourceEvidence: z.string(),
});

const structuredResumeSchema = z.object({
  contact: z.object({
    name: z.string().optional(),
    email: z.string().optional(),
    phone: z.string().optional(),
    location: z.string().optional(),
    links: z.array(z.string()),
  }),
  summary: z.string().optional(),
  experience: z.array(resumeItemSchema),
  education: z.array(resumeItemSchema),
  skills: z.array(z.string()),
  projects: z.array(resumeItemSchema),
  certifications: z.array(resumeItemSchema),
  achievements: z.array(resumeItemSchema),
  publications: z.array(resumeItemSchema),
  languages: z.array(resumeItemSchema),
  volunteering: z.array(resumeItemSchema),
  interests: z.array(z.string()),
  additionalSections: z.array(z.object({
    section: z.string(),
    content: z.string(),
    sourceEvidence: z.string(),
  })),
  sectionOrder: z.array(z.object({
    section: z.string(),
    heading: z.string().nullable(),
  })).default([]),
  sourceText: z.string(),
});

const immutableFields = [
  "contact",
  "education",
  "certifications",
  "achievements",
  "publications",
  "languages",
  "interests",
  "additionalSections",
  "sectionOrder",
] as const;

const clone = <T>(value: T): T =>
  JSON.parse(JSON.stringify(value)) as T;

const isEqual = (left: unknown, right: unknown): boolean =>
  JSON.stringify(left) === JSON.stringify(right);

export const mergeTailoredResume = (
  canonicalInput: unknown,
  tailored: GeneratedResume,
): StructuredResume => {
  const canonical = structuredResumeSchema.parse(canonicalInput);
  const merged: StructuredResume = {
    ...clone(canonical),
    summary: tailored.summary ?? canonical.summary,
    experience: clone(canonical.experience),
    projects: clone(canonical.projects),
    skills: clone(canonical.skills),
  };

  validateImmutableResumeContent(canonical, merged);
  return merged;
};

export const validateImmutableResumeContent = (
  canonicalInput: unknown,
  finalInput: unknown,
): void => {
  const canonical = structuredResumeSchema.parse(canonicalInput);
  const finalResume = structuredResumeSchema.parse(finalInput);

  for (const field of immutableFields) {
    if (!isEqual(finalResume[field], canonical[field])) {
      throw new Error(`Immutable resume section changed: ${field}`);
    }
  }
  if (!isEqual(finalResume.projects, canonical.projects)) {
    throw new Error("Projects cannot be removed or reordered");
  }
};
