import type { NextFunction, Request, Response } from "express";
import mongoose from "mongoose";
import { getEnv } from "../config/env.js";
import { Generation } from "../models/Generation.js";
import { JobDescription } from "../models/JobDescription.js";
import { Resume } from "../models/Resume.js";
import { compileLatex, mergeLatexTemplate } from "../services/latex/latex-template.service.js";

export const generateLatexResume = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    if (!req.userId || mongoose.connection.readyState !== 1) {
      res.status(503).json({ success: false, message: "Database is not configured or unavailable" });
      return;
    }
    const template = typeof req.body?.template === "string" ? req.body.template : "";
    if (Buffer.byteLength(template, "utf8") > getEnv().LATEX_MAX_SOURCE_BYTES) {
      res.status(413).json({ success: false, message: "LaTeX template is too large" });
      return;
    }
    const generation = await Generation.findOne({ _id: req.params.id, userId: req.userId }).lean();
    if (!generation) {
      res.status(404).json({ success: false, message: "Generation not found" });
      return;
    }
    const resume = await Resume.findOne({ _id: generation.resumeId, userId: req.userId }).lean();
    const job = await JobDescription.findOne({ _id: generation.jobDescriptionId, userId: req.userId }).lean();
    if (!resume || !job) {
      res.status(404).json({ success: false, message: "Source resume or job description not found" });
      return;
    }
    const output = generation.output as { summary?: unknown };
    const canonical = resume.structuredResume as { summary?: unknown };
    const summary = typeof output.summary === "string"
      ? output.summary
      : typeof canonical.summary === "string" ? canonical.summary : "";
    const latex = mergeLatexTemplate(template, summary);
    const compiled = await compileLatex(latex);
    await Generation.updateOne(
      { _id: generation._id, userId: req.userId },
      { $set: { latexSource: latex, latexTemplateVersion: "markers-v1" } },
    );
    res.json({
      success: true,
      data: {
        latex,
        pdfBase64: compiled.pdf.toString("base64"),
        templateVersion: "markers-v1",
      },
    });
  } catch (error) {
    next(error);
  }
};
