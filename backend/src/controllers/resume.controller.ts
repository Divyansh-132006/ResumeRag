import { NextFunction, Request, Response } from "express";
import { unlink } from "node:fs/promises";
import path from "node:path";
import { extractPdfText } from "../services/resume/pdf-parser.service";
import { parseResumeText } from "../services/resume/resume-parser.service";
import { normalizeResumeText } from "../services/resume/text-normalizer.service";
import { Resume } from "../models/Resume.js";
import mongoose from "mongoose";
import { getEnv } from "../config/env.js";
import { ingestResume } from "../services/rag/ingestion.service.js";
import { deleteQdrantResumePoints } from "../config/qdrant.js";
import { Generation } from "../models/Generation.js";

const requireDatabase = (res: Response): boolean => {
  if (mongoose.connection.readyState !== 1) {
    res
      .status(503)
      .json({
        success: false,
        message: "Database is not configured or unavailable",
      });
    return false;
  }
  return true;
};

export const listResumes = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    if (!req.userId || !requireDatabase(res)) return;
    const resumes = await Resume.find({
      userId: new mongoose.Types.ObjectId(req.userId),
    })
      .select("-text")
      .sort({ createdAt: -1 })
      .lean();
    res.json({ success: true, data: resumes });
  } catch (error) {
    next(error);
  }
};

export const getResume = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    if (!req.userId || !requireDatabase(res)) return;
    const resume = await Resume.findOne({
      _id: req.params.id,
      userId: req.userId,
    }).lean();
    if (!resume) {
      res.status(404).json({ success: false, message: "Resume not found" });
      return;
    }
    res.json({ success: true, data: resume });
  } catch (error) {
    next(error);
  }
};

export const updateResume = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    if (!req.userId || !requireDatabase(res)) return;
    const existingResume = await Resume.findOne({
      _id: req.params.id,
      userId: req.userId,
    }).lean();
    if (!existingResume) {
      res.status(404).json({ success: false, message: "Resume not found" });
      return;
    }
    const structuredResume =
      req.body?.structuredResume ?? existingResume.structuredResume;
    if (!structuredResume || typeof structuredResume !== "object") {
      res
        .status(422)
        .json({
          success: false,
          message:
            "This resume has no structured data to approve. Upload it again to reprocess the PDF.",
        });
      return;
    }
    const resume = await Resume.findOneAndUpdate(
      { _id: existingResume._id, userId: req.userId },
      {
        $set: {
          structuredResume,
          status: req.body.status === "approved" ? "approved" : "review",
        },
      },
      { returnDocument: "after", runValidators: true },
    ).lean();
    if (!resume) {
      res.status(404).json({ success: false, message: "Resume not found" });
      return;
    }
    let ingestionStatus = resume.ingestionStatus;
    if (resume.status === "approved" && req.userId) {
      try {
        await ingestResume(req.userId, String(resume._id), resume.text);
        ingestionStatus = "indexed";
      } catch {
        ingestionStatus = "failed";
      }
      await Resume.updateOne(
        { _id: resume._id, userId: req.userId },
        { $set: { ingestionStatus } },
      );
    }
    res.json({ success: true, data: { ...resume, ingestionStatus } });
  } catch (error) {
    next(error);
  }
};

export const deleteResume = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    if (!req.userId || !requireDatabase(res)) return;
    const resume = await Resume.findOneAndDelete({
      _id: req.params.id,
      userId: req.userId,
    });
    if (!resume) {
      res.status(404).json({ success: false, message: "Resume not found" });
      return;
    }
    await Generation.deleteMany({ userId: req.userId, resumeId: resume._id });
    await unlink(
      path.resolve(process.cwd(), getEnv().UPLOAD_DIR, resume.filename),
    ).catch(() => undefined);
    let vectorsDeleted = true;
    try {
      await deleteQdrantResumePoints(req.userId, String(resume._id));
    } catch {
      vectorsDeleted = false;
    }
    res
      .status(vectorsDeleted ? 204 : 207)
      .json(
        vectorsDeleted
          ? undefined
          : {
              success: true,
              message: "Resume deleted; vector cleanup is pending",
            },
      );
  } catch (error) {
    next(error);
  }
};
export const uploadResume = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  if (!req.file) {
    res.status(400).json({
      success: false,
      message: "Resume file is required",
    });
    return;
  }
  try {
    const result = await extractPdfText(req.file.path);
    const normalizedText = normalizeResumeText(result.text);
    const structuredResume = parseResumeText(normalizedText);
    if (!normalizedText) {
      await unlink(req.file.path).catch(() => undefined);
      res.status(422).json({
        success: false,
        message:
          "No readable text found. The PDF may be scanned or image-only.",
      });
      return;
    }
    let savedResumeId: string | undefined;
    if (req.userId && mongoose.connection.readyState === 1) {
      const savedResume = await Resume.create({
        userId: new mongoose.Types.ObjectId(req.userId),
        originalName: req.file.originalname,
        filename: req.file.filename,
        pageCount: result.pageCount,
        text: normalizedText,
        structuredResume,
      });
      savedResumeId = String(savedResume._id);
      if (structuredResume && req.userId) {
        // Ingestion is intentionally deferred until review approval.
      }
    }
    res.status(201).json({
      success: true,
      message: "Resume uploaded and text extracted successfully",
      data: {
        originalName: req.file.originalname,
        filename: req.file.filename,
        size: req.file.size,
        pageCount: result.pageCount,
        characterCount: normalizedText.length,
        text: normalizedText,
        structuredResume,
        id: savedResumeId,
      },
    });
  } catch (error) {
    await unlink(req.file.path).catch(() => undefined);
    next(error);
  }
};
