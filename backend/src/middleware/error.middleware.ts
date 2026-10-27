import type { ErrorRequestHandler, RequestHandler } from "express";
import multer from "multer";

export const notFound: RequestHandler = (_req, res) => {
  res.status(404).json({ success: false, message: "Route not found" });
};

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  console.error(
    error instanceof Error ? (error.stack ?? error.message) : error,
  );
  if (error instanceof multer.MulterError) {
    res
      .status(400)
      .json({
        success: false,
        message:
          error.code === "LIMIT_FILE_SIZE"
            ? "Uploaded file is too large"
            : "Invalid file upload",
      });
    return;
  }
  const message =
    error instanceof Error ? error.message : "Internal server error";
  if (
    message === "Only PDF files are supported" ||
    message === "Invalid PDF file signature"
  ) {
    res.status(400).json({ success: false, message });
    return;
  }
  const statusCode =
    typeof error === "object" &&
    error !== null &&
    "statusCode" in error &&
    typeof error.statusCode === "number"
      ? error.statusCode
      : 500;
  res
    .status(statusCode)
    .json({
      success: false,
      message:
        process.env.NODE_ENV === "production" && statusCode === 500
          ? "Internal server error"
          : message,
    });
};
