import type { NextFunction, Request, Response } from "express";
import path from "node:path";
import { unlink } from "node:fs/promises";
import mongoose from "mongoose";
import { getEnv } from "../config/env.js";
import { User } from "../models/User.js";
import { Resume } from "../models/Resume.js";
import { JobDescription } from "../models/JobDescription.js";
import { Generation } from "../models/Generation.js";
import { deleteQdrantUserPoints } from "../config/qdrant.js";

export const deleteAccount = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    if (!req.userId || mongoose.connection.readyState !== 1) {
      res
        .status(503)
        .json({
          success: false,
          message: "Database is not configured or unavailable",
        });
      return;
    }
    const resumes = await Resume.find({ userId: req.userId })
      .select("filename")
      .lean();
    await User.deleteOne({ _id: req.userId });
    await Resume.deleteMany({ userId: req.userId });
    await JobDescription.deleteMany({ userId: req.userId });
    await Generation.deleteMany({ userId: req.userId });
    await Promise.all(
      resumes.map((resume) =>
        unlink(
          path.resolve(process.cwd(), getEnv().UPLOAD_DIR, resume.filename),
        ).catch(() => undefined),
      ),
    );
    let vectorsDeleted = true;
    try {
      await deleteQdrantUserPoints(req.userId);
    } catch {
      vectorsDeleted = false;
    }
    res.json({ success: true, data: { accountDeleted: true, vectorsDeleted } });
  } catch (error) {
    next(error);
  }
};
