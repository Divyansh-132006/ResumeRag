import { Router } from "express";
import { createGeneration, deleteGeneration, exportGeneration, listGenerations } from "../controllers/generation.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";

const router = Router();
router.use(requireAuth);
router.post("/", createGeneration);
router.get("/", listGenerations);
router.delete("/:id", deleteGeneration);
router.get("/:id/export", exportGeneration);
export default router;