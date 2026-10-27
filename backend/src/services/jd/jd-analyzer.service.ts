export interface JobDescriptionAnalysis {
  skills: string[];
  qualifications: string[];
  responsibilities: string[];
  keywords: string[];
}

const STOP_WORDS = new Set([
  "and",
  "the",
  "with",
  "for",
  "that",
  "this",
  "from",
  "your",
  "you",
  "are",
]);

export const analyzeJobDescription = (text: string): JobDescriptionAnalysis => {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const skills = lines
    .filter((line) =>
      /skill|technolog|proficien|experience with|knowledge of/i.test(line),
    )
    .flatMap((line) => line.split(/[:,;•|-]/).slice(1))
    .map((item) => item.trim())
    .filter(Boolean);
  const qualifications = lines.filter((line) =>
    /degree|qualification|bachelor|master|certif|years of experience/i.test(
      line,
    ),
  );
  const responsibilities = lines.filter((line) =>
    /responsibil|you will|develop|build|manage|design|lead|maintain/i.test(
      line,
    ),
  );
  const keywords = [
    ...new Set(
      (text.toLowerCase().match(/[a-z][a-z+#.-]{2,}/g) ?? []).filter(
        (word) => !STOP_WORDS.has(word),
      ),
    ),
  ].slice(0, 100);
  return {
    skills: [...new Set(skills)].slice(0, 50),
    qualifications: qualifications.slice(0, 50),
    responsibilities: responsibilities.slice(0, 50),
    keywords,
  };
};
