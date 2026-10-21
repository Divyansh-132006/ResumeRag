import assert from "node:assert/strict";
import test from "node:test";
import { parseResumeText } from "../dist/services/resume/resume-parser.service.js";
import { analyzeJobDescription } from "../dist/services/jd/jd-analyzer.service.js";

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
