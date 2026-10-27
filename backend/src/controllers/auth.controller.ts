import bcrypt from "bcryptjs";
import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { getEnv } from "../config/env.js";
import { User } from "../models/User.js";

const issueToken = (userId: string): string => {
  const secret = getEnv().JWT_SECRET;

  if (!secret) {
    throw new Error("Authentication is not configured");
  }

  return jwt.sign({}, secret, {
    subject: userId,
    expiresIn: "1h",
  });
};

export const register = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    if (mongoose.connection.readyState !== 1 || !getEnv().JWT_SECRET) {
      res.status(503).json({
        success: false,
        message: "Authentication service is temporarily unavailable",
      });
      return;
    }

    const email =
      typeof req.body?.email === "string"
        ? req.body.email.trim().toLowerCase()
        : "";

    const password =
      typeof req.body?.password === "string" ? req.body.password : "";

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 12) {
      res.status(400).json({
        success: false,
        message:
          "A valid email and password of at least 12 characters are required",
      });
      return;
    }

    const existingUser = await User.findOne({ email }).lean();

    if (existingUser) {
      res.status(409).json({
        success: false,
        message: "An account with that email already exists",
      });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await User.create({
      email,
      passwordHash,
    });

    res.status(201).json({
      success: true,
      data: {
        token: issueToken(user.id),
        user: {
          id: user.id,
          email: user.email,
        },
      },
    });
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === 11000
    ) {
      res.status(409).json({
        success: false,
        message: "An account with that email already exists",
      });
      return;
    }

    next(error);
  }
};

export const login = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    if (mongoose.connection.readyState !== 1 || !getEnv().JWT_SECRET) {
      res.status(503).json({
        success: false,
        message: "Authentication service is temporarily unavailable",
      });
      return;
    }

    const email =
      typeof req.body?.email === "string"
        ? req.body.email.trim().toLowerCase()
        : "";

    const password =
      typeof req.body?.password === "string" ? req.body.password : "";

    const user = await User.findOne({ email }).select("+passwordHash");

    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
      return;
    }

    res.json({
      success: true,
      data: {
        token: issueToken(user.id),
        user: {
          id: user.id,
          email: user.email,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};
