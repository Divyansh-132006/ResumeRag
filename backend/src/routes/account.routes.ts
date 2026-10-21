import { Router } from "express";
import { deleteAccount } from "../controllers/account.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
const router = Router();
router.delete("/", requireAuth, deleteAccount);
export default router;
