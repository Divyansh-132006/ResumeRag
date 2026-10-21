import bcrypt from "bcryptjs";
import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { getEnv } from "../config/env.js";
import { User } from "../models/User.js";

const issueToken = (id: string): string => {
    const secret = getEnv().JWT_SECRET;
    if (!secret) throw new Error("Authentication is not configured");
    return jwt.sign({}, secret, { subject: id, expiresIn: "1h" });
};

export const register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
        const password = typeof req.body?.password === "string" ? req.body.password : "";
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 12) {
            res.status(400).json({ success: false, message: "A valid email and password of at least 12 characters are required" });
            return;
        }
        if (await User.findOne({ email }).lean()) {
            res.status(409).json({ success: false, message: "An account with that email already exists" });
            return;
        }
        const user = await User.create({ email, passwordHash: await bcrypt.hash(password, 12) });
        res.status(201).json({ success: true, data: { token: issueToken(user.id), user: { id: user.id, email: user.email } } });
    } catch (error) { next(error); }
};

export const login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
        const password = typeof req.body?.password === "string" ? req.body.password : "";
        const user = await User.findOne({ email }).select("+passwordHash");
        if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
            res.status(401).json({ success: false, message: "Invalid email or password" });
            return;
        }
        res.json({ success: true, data: { token: issueToken(user.id), user: { id: user.id, email: user.email } } });
    } catch (error) { next(error); }
};
