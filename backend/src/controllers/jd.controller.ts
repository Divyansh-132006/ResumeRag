import type { NextFunction, Request, Response } from "express";
import mongoose from "mongoose";
import { JobDescription } from "../models/JobDescription.js";
import { Resume } from "../models/Resume.js";
import { analyzeJobDescription } from "../services/jd/jd-analyzer.service.js";
import { Generation } from "../models/Generation.js";

export const createJobDescription = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        if (!req.userId || mongoose.connection.readyState !== 1) {
            res.status(503).json({ success: false, message: "Database is not configured or unavailable" });
            return;
        }
        const title = typeof req.body?.title === "string" ? req.body.title.trim() : "";
        const text = typeof req.body?.text === "string" ? req.body.text.trim() : "";
        if (!title || text.length < 30 || text.length > 50000) {
            res.status(400).json({ success: false, message: "A title and job description between 30 and 50,000 characters are required" });
            return;
        }
        const jobDescription = await JobDescription.create({
            userId: new mongoose.Types.ObjectId(req.userId),
            title,
            text,
            analysis: analyzeJobDescription(text),
        });
        res.status(201).json({ success: true, data: jobDescription });
    } catch (error) { next(error); }
};

export const listJobDescriptions = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        if (!req.userId || mongoose.connection.readyState !== 1) {
            res.status(503).json({ success: false, message: "Database is not configured or unavailable" });
            return;
        }
        const data = await JobDescription.find({ userId: req.userId }).sort({ createdAt: -1 }).lean();
        res.json({ success: true, data });
    } catch (error) { next(error); }
};

export const matchJobDescription = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        if (!req.userId || mongoose.connection.readyState !== 1) {
            res.status(503).json({ success: false, message: "Database is not configured or unavailable" });
            return;
        }
        const job = await JobDescription.findOne({ _id: req.params.id, userId: req.userId }).lean();
        const resume = await Resume.findOne({ _id: req.query.resumeId, userId: req.userId, status: "approved" }).lean();
        if (!job || !resume) {
            res.status(404).json({ success: false, message: "Approved resume or job description not found" });
            return;
        }
        const evidenceText = resume.text.toLowerCase();
        const requirements = [...new Set([...job.analysis.skills, ...job.analysis.qualifications, ...job.analysis.keywords])];
        const matches = requirements.map((requirement) => {
            const supported = evidenceText.includes(requirement.toLowerCase());
            return {
                requirement,
                status: supported ? "supported" : "missing_or_unverified",
                evidence: supported ? [resume.text.split(/\r?\n/).find((line: string) => line.toLowerCase().includes(requirement.toLowerCase())) ?? requirement] : [],
            };
        });
        const supported = matches.filter((match) => match.status === "supported").length;
        res.json({ success: true, data: { method: "Case-insensitive exact phrase presence in approved resume text; this is not a suitability guarantee.", supported, partial: [], missingOrUnverified: matches.filter((match) => match.status !== "supported"), matches } });
    } catch (error) { next(error); }
};

export const deleteJobDescription = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        if (!req.userId || mongoose.connection.readyState !== 1) {
            res.status(503).json({ success: false, message: "Database is not configured or unavailable" });
            return;
        }
        const job = await JobDescription.findOneAndDelete({ _id: req.params.id, userId: req.userId });
        if (!job) {
            res.status(404).json({ success: false, message: "Job description not found" });
            return;
        }
        await Generation.deleteMany({ userId: req.userId, jobDescriptionId: job._id });
        res.status(204).send();
    } catch (error) { next(error); }
};