import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { getEnv } from "../../config/env.js";

const execFileAsync = promisify(execFile);
const SUMMARY_START = "% RESUMERAG:SUMMARY:START";
const SUMMARY_END = "% RESUMERAG:SUMMARY:END";

const blockedCommands = [
  /\\(?:input|include|subimport|import)\b/i,
  /\\(?:openin|openout|write18|immediate)\b/i,
  /\\(?:directlua|directlua|pdfshellescape)\b/i,
  /(?:^|[\s{])(?:[A-Za-z]:[\\/]|\/etc\/|\/var\/|\/tmp\/|\.\.[\\/])/i,
];

export const mergeLatexTemplate = (source: string, summary: string): string => {
  if (blockedCommands.some((pattern) => pattern.test(source))) {
    throw new Error("LaTeX template contains a blocked file or shell command");
  }
  const start = source.indexOf(SUMMARY_START);
  const end = source.indexOf(SUMMARY_END);
  if (start < 0 || end < start) {
    throw new Error(
      `LaTeX template must contain ${SUMMARY_START} and ${SUMMARY_END} markers`,
    );
  }
  const escapedSummary = summary
    .replace(/\\/g, "\\textbackslash{}")
    .replace(/([{}%$&#_])/g, "\\$1")
    .replace(/~/g, "\\textasciitilde{}")
    .replace(/\^/g, "\\textasciicircum{}");
  return `${source.slice(0, start + SUMMARY_START.length)}\n${escapedSummary}\n${source.slice(end)}`;
};

export const compileLatex = async (
  source: string,
): Promise<{ pdf: Buffer; log: string }> => {
  const env = getEnv();
  const directory = await mkdtemp(path.join(os.tmpdir(), "resumerag-latex-"));
  const sourcePath = path.join(directory, "main.tex");
  try {
    await writeFile(sourcePath, source, "utf8");
    try {
      await execFileAsync(
        env.LATEX_COMPILER,
        [
          "-interaction=nonstopmode",
          "-halt-on-error",
          "-no-shell-escape",
          "-file-line-error",
          "-output-directory",
          directory,
          sourcePath,
        ],
        {
          cwd: directory,
          timeout: env.LATEX_COMPILE_TIMEOUT_MS,
          windowsHide: true,
          maxBuffer: 512 * 1024,
        },
      );
    } catch (error) {
      const details =
        typeof error === "object" && error !== null && "stdout" in error
          ? String(error.stdout)
          : error instanceof Error
            ? error.message
            : "LaTeX compilation failed";
      throw new Error(`LaTeX compilation failed: ${details.slice(-4000)}`);
    }
    return {
      pdf: await readFile(path.join(directory, "main.pdf")),
      log: await readFile(path.join(directory, "main.log"), "utf8").catch(() => ""),
    };
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
};
