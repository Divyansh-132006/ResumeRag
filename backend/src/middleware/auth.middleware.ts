import type { RequestHandler } from "express";
import jwt from "jsonwebtoken";
import { getEnv } from "../config/env.js";

declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

export const requireAuth: RequestHandler = (req, res, next) => {
  const secret = getEnv().JWT_SECRET;
  if (!secret) {
    res
      .status(503)
      .json({ success: false, message: "Authentication is not configured" });
    return;
  }
  const token = req.header("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) {
    res
      .status(401)
      .json({ success: false, message: "Authentication required" });
    return;
  }
  try {
    const payload = jwt.verify(token, secret);
    if (typeof payload !== "object" || typeof payload.sub !== "string")
      throw new Error("Invalid token");
    req.userId = payload.sub;
    next();
  } catch {
    res
      .status(401)
      .json({
        success: false,
        message: "Invalid or expired authentication token",
      });
  }
};
