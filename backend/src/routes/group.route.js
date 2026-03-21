import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import { createGroup, getGroups, leaveGroup } from "../controllers/group.controller.js";

const router = express.Router();

router.get("/", protectRoute, getGroups);
router.post("/create", protectRoute, createGroup);
// Thêm dòng này vào cuối danh sách router
router.post("/leave/:id", protectRoute, leaveGroup);
export default router;