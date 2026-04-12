import express from "express";
import isAuth from "../middlewares/isAuth.js";
import { createOrder, verifyPayment } from "../controllers/payment.controller.js";

const paymentRouter = express.Router();

/**
 * @route   POST /api/payment/create-order
 * @desc    Create Razorpay order
 * @access  Private
 */
paymentRouter.post("/create-order", isAuth, createOrder);

/**
 * @route   POST /api/payment/verify
 * @desc    Verify Razorpay payment
 * @access  Private
 */
paymentRouter.post("/verify", isAuth, verifyPayment);

/**
 * @route   GET /api/payment/test
 * @desc    Test route
 * @access  Public
 */
paymentRouter.get("/test", (req, res) => {
  res.json({ message: "Payment route working ✅" });
});

export default paymentRouter;