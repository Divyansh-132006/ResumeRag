import multer from "multer";
import path from "path";
import crypto from "crypto";
import { mkdirSync } from "node:fs";
import { getEnv } from "../config/env.js";

const uploadDir = path.resolve(process.cwd(), getEnv().UPLOAD_DIR);
mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const extension = path.extname(file.originalname).toLowerCase();
    const filename = `${crypto.randomUUID()}${extension}`;
    cb(null, filename);
  },
});

const fileFilter: multer.Options["fileFilter"] = (_req, file, cb) => {
  const extension = path.extname(file.originalname).toLowerCase();

  if (extension !== ".pdf" || file.mimetype !== "application/pdf") {
    return cb(new Error("Only PDF files are supported"));
  }
  cb(null, true);
};

export const uploadResume = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: getEnv().MAX_UPLOAD_BYTES,
    files: 1,
  },
});

const latexFileFilter: multer.Options["fileFilter"] = (_req, file, cb) => {
  const extension = path.extname(file.originalname).toLowerCase();
  if (extension !== ".tex") {
    return cb(new Error("Only LaTeX .tex files are supported"));
  }
  cb(null, true);
};

export const uploadLatex = multer({
  storage: multer.memoryStorage(),
  fileFilter: latexFileFilter,
  limits: {
    fileSize: getEnv().LATEX_MAX_SOURCE_BYTES,
    files: 1,
  },
});
