import {Router} from "express";
import { deleteResume, getResume, listResumes, updateResume, uploadResume } from "../controllers/resume.controller.js";
import { uploadResume as uploadResumeMiddleware } from "../middleware/upload.middleware";
import { requireAuth } from "../middleware/auth.middleware.js";


const router = Router();
router.post('/upload', requireAuth, uploadResumeMiddleware.single('resume'), uploadResume);
router.get("/", requireAuth, listResumes);
router.get("/:id", requireAuth, getResume);
router.patch("/:id", requireAuth, updateResume);
router.delete("/:id", requireAuth, deleteResume);


export default router;























