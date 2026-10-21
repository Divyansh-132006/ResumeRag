import { Router } from "express";
import { createJobDescription, listJobDescriptions, matchJobDescription } from "../controllers/jd.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";

const router = Router();
router.use(requireAuth);
router.post("/", createJobDescription);
router.get("/", listJobDescriptions);
router.get("/:id/match", matchJobDescription);
export default router;