import assert from "node:assert/strict";
import test from "node:test";
import { parseResumeText } from "../dist/services/resume/resume-parser.service.js";
import { analyzeJobDescription } from "../dist/services/jd/jd-analyzer.service.js";
import { mergeLatexTemplate } from "../dist/services/latex/latex-template.service.js";
import {
    mergeTailoredResume,
    validateImmutableResumeContent,
} from "../dist/services/generation/resume-merge.service.js";

test("parses common resume sections without inventing fields", () => {
    const resume = parseResumeText("Jane Doe\njane@example.com\n\nSUMMARY\nBackend engineer\n\nEXPERIENCE\nBuilt APIs\n\nSKILLS\nTypeScript\nNode.js");
    assert.equal(resume.contact.name, "Jane Doe");
    assert.equal(resume.contact.email, "jane@example.com");
    assert.equal(resume.experience[0].sourceEvidence, "Built APIs");
    assert.deepEqual(resume.skills, ["TypeScript", "Node.js"]);
});

test("extracts job description signals deterministically", () => {
    const analysis = analyzeJobDescription("Backend Engineer\nSkills: TypeScript, MongoDB\nBachelor degree required\nYou will build APIs");
    assert.ok(analysis.skills.includes("TypeScript"));
    assert.ok(analysis.qualifications.some((value) => value.includes("Bachelor")));
    assert.ok(analysis.responsibilities.some((value) => value.includes("build")));
});

const canonicalResume = {
    contact: { name: "Jane Doe", email: "jane@example.com", links: [] },
    summary: "Backend engineer",
    experience: [{ text: "Built APIs", sourceEvidence: "Built APIs" }],
    education: [{ text: "BSc Computer Science, 2024", sourceEvidence: "BSc Computer Science, 2024" }],
    skills: ["TypeScript", "Node.js"],
    projects: [{ text: "Resume RAG", sourceEvidence: "Resume RAG" }],
    certifications: [{ text: "AWS Certified", sourceEvidence: "AWS Certified" }],
    achievements: [{ text: "Ranked first", sourceEvidence: "Ranked first" }],
    publications: [],
    languages: [],
    volunteering: [],
    interests: [],
    additionalSections: [],
    sectionOrder: [
        { section: "header", heading: null },
        { section: "summary", heading: "SUMMARY" },
        { section: "education", heading: "EDUCATION" },
        { section: "projects", heading: "PROJECTS" },
    ],
    sourceText: "source",
};

test("merges only the permitted tailored summary", () => {
    const merged = mergeTailoredResume(canonicalResume, {
        summary: "Tailored backend engineer",
    });
    assert.equal(merged.summary, "Tailored backend engineer");
    assert.deepEqual(merged.education, canonicalResume.education);
    assert.deepEqual(merged.projects, canonicalResume.projects);
});

test("rejects immutable content changes", () => {
    assert.throws(() => validateImmutableResumeContent(canonicalResume, {
        ...canonicalResume,
        achievements: [],
    }), /Immutable resume section changed: achievements/);
    assert.throws(() => validateImmutableResumeContent(canonicalResume, {
        ...canonicalResume,
        projects: [],
    }), /Projects cannot be removed or reordered/);
});

test("replaces only the marked LaTeX summary", () => {
    const template = "\\documentclass{article}\n% RESUMERAG:SUMMARY:START\nOld summary\n% RESUMERAG:SUMMARY:END\n\\end{document}";
    const result = mergeLatexTemplate(template, "C++ & systems #1");
    assert.match(result, /C\+\+ \\& systems \\#1/);
    assert.match(result, /\\documentclass\{article\}/);
    assert.match(result, /\\end\{document\}/);
});

test("requires explicit LaTeX markers", () => {
    assert.throws(() => mergeLatexTemplate("\\documentclass{article}", "summary"), /markers/);
});

test("blocks unsafe LaTeX file and shell commands", () => {
    assert.throws(() => mergeLatexTemplate(
        "\\documentclass{article}\\input{/etc/passwd}\n% RESUMERAG:SUMMARY:START\nx\n% RESUMERAG:SUMMARY:END",
        "summary",
    ), /blocked/);
});
