import express from "express";
import { googleAuth, logOut, devLogin } from "../controllers/auth.controller.js";

const authRouter = express.Router();

/**
 * @route   POST /api/auth/google
 * @desc    Google login / signup
 * @access  Public
 */
authRouter.post("/google", googleAuth);

/**
 * @route   POST /api/auth/dev-login
 * @desc    Developer login (local QA testing only)
 * @access  Public
 */
authRouter.post("/dev-login", devLogin);

/**
 * @route   GET /api/auth/logout
 * @desc    Logout user
 * @access  Public
 */
authRouter.get("/logout", logOut);

export default authRouter;