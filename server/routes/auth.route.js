import express from "express";
import { googleAuth, logOut } from "../controllers/auth.controller.js";

const authRouter = express.Router();

/**
 * @route   POST /api/auth/google
 * @desc    Google login / signup
 * @access  Public
 */
authRouter.post("/google", googleAuth);

/**
 * @route   GET /api/auth/logout
 * @desc    Logout user
 * @access  Public
 */
authRouter.get("/logout", logOut);

export default authRouter;