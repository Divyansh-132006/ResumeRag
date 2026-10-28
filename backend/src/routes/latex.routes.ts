import { Router } from "express";
import { generateLatexResume } from "../controllers/latex.controller.js";
import { tailorUploadedLatex } from "../controllers/latex.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { uploadLatex } from "../middleware/upload.middleware.js";

const router = Router();
router.post("/tailor", requireAuth, uploadLatex.single("latex"), tailorUploadedLatex);
router.post("/:id/generate", requireAuth, generateLatexResume);
export default router;
