export type ResumeSection =
    | "header"
    | "summary"
    | "experience"
    | "education"
    | "skills"
    | "projects"
    | "certifications"
    | "achievements"
    | "publications"
    | "languages"
    | "volunteering"
    | "interests";

export interface ResumeSectionBlock {
    section: ResumeSection;
    heading: string | null;
    content: string;
    startLine: number;
    endLine: number;
}

interface SectionHeading {
    section: ResumeSection;
    heading: string;
}

const SECTION_ALIASES: Record<ResumeSection, readonly string[]> = {
    header: [],
    summary: [
        "summary",
        "professional summary",
        "profile",
        "professional profile",
        "objective",
        "career objective",
    ],
    experience: [
        "experience",
        "work experience",
        "professional experience",
        "employment history",
        "work history",
        "career history",
    ],
    education: ["education", "academic background", "qualifications"],
    skills: [
        "skills",
        "technical skills",
        "core skills",
        "core competencies",
        "competencies",
        "technologies",
    ],
    projects: ["projects", "personal projects", "academic projects"],
    certifications: ["certifications", "certificates", "licenses"],
    achievements: [
        "achievements",
        "awards",
        "honors",
        "accomplishments",
    ],
    publications: ["publications", "research", "papers"],
    languages: ["languages", "language proficiency"],
    volunteering: ["volunteering", "volunteer experience", "community involvement"],
    interests: ["interests", "hobbies", "activities"],
};

const aliasToSection = new Map<string, ResumeSection>(
    Object.entries(SECTION_ALIASES).flatMap(([section, aliases]) =>
        aliases.map((alias) => [alias, section as ResumeSection])
    )
);

const normalizeHeading = (value: string): string =>
    value
        .replace(/^[\s|•▪◦*#\-–—:]+|[\s|:]+$/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();

const isLikelyHeading = (line: string): boolean => {
    const trimmed = line.trim();

    if (
        trimmed.length === 0 ||
        trimmed.length > 60 ||
        /[.!?]$/.test(trimmed) ||
        /^[-*•▪◦]/.test(trimmed)
    ) {
        return false;
    }

    const words = trimmed.split(/\s+/);
    return (
        words.length <= 5 &&
        (trimmed === trimmed.toUpperCase() ||
            words.every((word) => /^[A-Z][a-z'&/-]*$/.test(word)))
    );
};

const getHeading = (line: string): SectionHeading | undefined => {
    if (!isLikelyHeading(line)) {
        return undefined;
    }

    const heading = line.trim();
    const section = aliasToSection.get(normalizeHeading(heading));

    return section ? { section, heading } : undefined;
};

/**
 * Splits extracted resume text into semantic blocks while preserving the
 * original line content and its location in the extracted document.
 */
export const detectSections = (text: string): ResumeSectionBlock[] => {
    const lines = text.replace(/\r\n?/g, "\n").split("\n");
    const blocks: ResumeSectionBlock[] = [];
    let currentSection: ResumeSection = "header";
    let currentHeading: string | null = null;
    let currentStartLine = 1;
    let currentContent: string[] = [];

    const flush = (endLine: number): void => {
        const content = currentContent.join("\n").trim();

        if (content) {
            blocks.push({
                section: currentSection,
                heading: currentHeading,
                content,
                startLine: currentStartLine,
                endLine,
            });
        }
    };

    lines.forEach((line, index) => {
        const heading = getHeading(line);

        if (!heading) {
            currentContent.push(line);
            return;
        }

        flush(index);
        currentSection = heading.section;
        currentHeading = heading.heading;
        currentStartLine = index + 1;
        currentContent = [];
    });

    flush(lines.length);
    return blocks;
};
