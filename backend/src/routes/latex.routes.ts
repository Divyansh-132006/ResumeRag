import { Router } from "express";
import { generateLatexResume } from "../controllers/latex.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";

const router = Router();
router.post("/:id/generate", requireAuth, generateLatexResume);
export default router;
