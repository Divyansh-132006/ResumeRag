import type { NextFunction, Request, Response } from "express";
import mongoose from "mongoose";
import path from "node:path";
import { access } from "node:fs/promises";
import { Generation } from "../models/Generation.js";
import { JobDescription } from "../models/JobDescription.js";
import { Resume } from "../models/Resume.js";
import { retrieveEvidence } from "../services/rag/retrieval.service.js";
import { generateGroundedResume } from "../services/generation/resume-generator.service.js";
import { mergeTailoredResume } from "../services/generation/resume-merge.service.js";
import { renderResumePdf } from "../services/pdf/resume-pdf.service.js";
import { getEnv } from "../config/env.js";

const databaseUnavailable = (res: Response): boolean => {
  if (mongoose.connection.readyState !== 1) {
    res
      .status(503)
      .json({
        success: false,
        message: "Database is not configured or unavailable",
      });
    return true;
  }
  return false;
};

export const createGeneration = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    if (!req.userId || databaseUnavailable(res)) return;
    const { resumeId, jobDescriptionId } = req.body ?? {};
    const resume = await Resume.findOne({
      _id: resumeId,
      userId: req.userId,
      status: "approved",
    }).lean();
    const job = await JobDescription.findOne({
      _id: jobDescriptionId,
      userId: req.userId,
    }).lean();
    if (!resume || !job) {
      res
        .status(404)
        .json({
          success: false,
          message: "Approved resume or job description not found",
        });
      return;
    }
    const evidence = await retrieveEvidence(
      req.userId,
      String(resume._id),
      job.text,
    );
    if (evidence.length === 0) {
      res
        .status(422)
        .json({
          success: false,
          message: "No relevant verified evidence was retrieved",
        });
      return;
    }
    const tailoredContent = await generateGroundedResume(job.text, evidence);
    const output = mergeTailoredResume(resume.structuredResume, tailoredContent);
    const generation = await Generation.create({
      userId: req.userId,
      resumeId: resume._id,
      jobDescriptionId: job._id,
      output,
      evidence,
    });
    res.status(201).json({ success: true, data: generation });
  } catch (error) {
    next(error);
  }
};

export const listGenerations = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    if (!req.userId || databaseUnavailable(res)) return;
    const data = await Generation.find({ userId: req.userId })
      .sort({ createdAt: -1 })
      .lean();
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const deleteGeneration = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    if (!req.userId || databaseUnavailable(res)) return;
    const generation = await Generation.findOneAndDelete({
      _id: req.params.id,
      userId: req.userId,
    });
    if (!generation) {
      res.status(404).json({ success: false, message: "Generation not found" });
      return;
    }
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

export const exportGeneration = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    if (!req.userId || databaseUnavailable(res)) return;
    const generation = await Generation.findOne({
      _id: req.params.id,
      userId: req.userId,
    }).lean();
    if (!generation) {
      res.status(404).json({ success: false, message: "Generation not found" });
      return;
    }
    const resume = await Resume.findOne({
      _id: generation.resumeId,
      userId: req.userId,
    }).lean();
    const job = await JobDescription.findOne({
      _id: generation.jobDescriptionId,
      userId: req.userId,
    }).lean();
    if (!resume) {
      res
        .status(404)
        .json({
          success: false,
          message: "Source resume not found for this generation",
        });
      return;
    }
    const originalPdfPath = path.resolve(
      process.cwd(),
      getEnv().UPLOAD_DIR,
      resume.filename,
    );
    try {
      await access(originalPdfPath);
    } catch {
      res.status(404).json({
        success: false,
        message: "Original resume PDF is missing from server storage",
      });
      return;
    }
    const analysis =
      job?.analysis && typeof job.analysis === "object"
        ? (job.analysis as { keywords?: unknown })
        : undefined;
    const keywords = Array.isArray(analysis?.keywords)
      ? analysis.keywords.map(String)
      : [];
    if (
      !generation.output ||
      typeof generation.output !== "object" ||
      Array.isArray(generation.output)
    ) {
      res.status(422).json({
        success: false,
        message: "This generation has invalid resume output",
      });
      return;
    }
    const pdf = await renderResumePdf(
      originalPdfPath,
      generation.output,
      keywords,
    );
    res
      .type("application/pdf")
      .set("Content-Disposition", 'attachment; filename="tailored-resume.pdf"')
      .send(pdf);
  } catch (error) {
    next(error);
  }
};
