import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import mongoose from "mongoose";
import { getEnv } from "./config/env.js";
import authRoutes from "./routes/auth.routes.js";
import resumeRoutes from "./routes/resume.routes.js";
import jdRoutes from "./routes/jd.routes.js";
import generationRoutes from "./routes/generation.routes.js";
import accountRoutes from "./routes/account.routes.js";
import latexRoutes from "./routes/latex.routes.js";
import { errorHandler, notFound } from "./middleware/error.middleware.js";
const app = express();
const env = getEnv();
app.set("trust proxy", 1);
const allowedOrigins = new Set([
  "https://jobresumerag.netlify.app",
  "https://rolefitresume.netlify.app",
  "http://localhost:5173",
  ...(env.FRONTEND_ORIGIN?.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean) ?? []),
]);
app.use(helmet());
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.has(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error("Origin is not allowed by CORS"));
    },
  }),
);
app.use(express.json({ limit: "1mb" }));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: 100 }));
app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    message: "Resume RAG backend is running",
  });
});
app.get("/ready", (_req, res) => {
  const databaseReady = mongoose.connection.readyState === 1;
  res
    .status(databaseReady ? 200 : 503)
    .json({
      status: databaseReady ? "ready" : "not_ready",
      database: databaseReady,
    });
});
app.use("/api/auth", authRoutes);
app.use("/api/resumes", resumeRoutes);
app.use("/api/job-descriptions", jdRoutes);
app.use("/api/generations", generationRoutes);
app.use("/api/account", accountRoutes);
app.use("/api/latex", latexRoutes);
app.use(notFound);
app.use(errorHandler);

export default app;
