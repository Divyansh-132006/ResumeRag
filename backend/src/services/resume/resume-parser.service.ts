import {
  detectSections,
  type ResumeSection,
  type ResumeSectionBlock,
} from "./section-detector.service.js";
import { normalizeResumeText } from "./text-normalizer.service.js";

export interface ContactInformation {
  name?: string;
  email?: string;
  phone?: string;
  location?: string;
  links: string[];
}

export interface ResumeItem {
  text: string;
  sourceEvidence: string;
}

export interface StructuredResume {
  contact: ContactInformation;
  summary?: string;
  experience: ResumeItem[];
  education: ResumeItem[];
  skills: string[];
  projects: ResumeItem[];
  certifications: ResumeItem[];
  achievements: ResumeItem[];
  publications: ResumeItem[];
  languages: ResumeItem[];
  volunteering: ResumeItem[];
  interests: string[];
  additionalSections: Array<{
    section: string;
    content: string;
    sourceEvidence: string;
  }>;
  sectionOrder: Array<{
    section: string;
    heading: string | null;
  }>;
  sourceText: string;
}

const ITEM_SECTIONS = new Set<ResumeSection>([
  "experience",
  "education",
  "projects",
  "certifications",
  "achievements",
  "publications",
  "languages",
  "volunteering",
]);

const splitLines = (content: string): string[] =>
  content
    .split("\n")
    .map((line) => line.replace(/^\s*(?:[-*•▪◦]|\d+[.)])\s*/, "").trim())
    .filter(Boolean);

const parseContact = (
  header: ResumeSectionBlock | undefined,
): ContactInformation => {
  const lines = header ? splitLines(header.content) : [];
  const email = lines
    .join(" ")
    .match(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i)?.[0];
  const phone = lines
    .join(" ")
    .match(/(?:\+?\d[\d\s().-]{7,}\d)/)?.[0]
    ?.trim();
  const links = lines.join(" ").match(/https?:\/\/[^\s,)]+/gi) ?? [];
  const name = lines.find(
    (line) =>
      line.length <= 80 &&
      !line.includes("@") &&
      !/https?:\/\//i.test(line) &&
      !/\d{3,}/.test(line),
  );

  return { name, email, phone, links };
};

const toItems = (block: ResumeSectionBlock): ResumeItem[] =>
  splitLines(block.content).map((text) => ({
    text,
    sourceEvidence: text,
  }));

const blockFor = (
  blocks: ResumeSectionBlock[],
  section: ResumeSection,
): ResumeSectionBlock | undefined =>
  blocks.find((block) => block.section === section);

/**
 * Parses normalized text without inventing facts. Complex item-level fields are
 * intentionally retained as source-backed text until a review step can refine them.
 */
export const parseResumeText = (text: string): StructuredResume => {
  const sourceText = normalizeResumeText(text);
  const blocks = detectSections(sourceText);
  const header = blocks.find((block) => block.section === "header");
  const item = (section: ResumeSection): ResumeItem[] => {
    const block = blockFor(blocks, section);
    return block && ITEM_SECTIONS.has(section) ? toItems(block) : [];
  };
  const skillsBlock = blockFor(blocks, "skills");
  const interestsBlock = blockFor(blocks, "interests");

  const knownSections = new Set<ResumeSection>([
    "header",
    "summary",
    "experience",
    "education",
    "skills",
    "projects",
    "certifications",
    "achievements",
    "publications",
    "languages",
    "volunteering",
    "interests",
  ]);

  return {
    contact: parseContact(header),
    summary: blockFor(blocks, "summary")?.content,
    experience: item("experience"),
    education: item("education"),
    skills: skillsBlock ? splitLines(skillsBlock.content) : [],
    projects: item("projects"),
    certifications: item("certifications"),
    achievements: item("achievements"),
    publications: item("publications"),
    languages: item("languages"),
    volunteering: item("volunteering"),
    interests: interestsBlock ? splitLines(interestsBlock.content) : [],
    additionalSections: blocks
      .filter((block) => !knownSections.has(block.section))
      .map((block) => ({
        section: block.heading ?? block.section,
        content: block.content,
        sourceEvidence: block.content,
      })),
    sectionOrder: blocks.map((block) => ({
      section: block.section,
      heading: block.heading,
    })),
    sourceText,
  };
};
