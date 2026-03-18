import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import { createGroup, getGroups } from "../controllers/group.controller.js";

const router = express.Router();

router.get("/", protectRoute, getGroups);
router.post("/create", protectRoute, createGroup);

export default router;