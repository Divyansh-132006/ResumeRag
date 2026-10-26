import { Router } from "express";
import { createJobDescription, deleteJobDescription, listJobDescriptions, matchJobDescription } from "../controllers/jd.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";

const router = Router();
router.use(requireAuth);
router.post("/", createJobDescription);
router.get("/", listJobDescriptions);
router.get("/:id/match", matchJobDescription);
router.delete("/:id", deleteJobDescription);
export default router;