import Payment from "../models/payment.model.js";
import User from "../models/user.model.js";
import razorpay from "../services/razorpay.service.js";
import crypto from "crypto";

// 🧾 CREATE ORDER
export const createOrder = async (req, res) => {
  try {
    const { planId, amount, credits } = req.body;

    // 🔒 validation
    if (!amount || !credits) {
      return res.status(400).json({
        success: false,
        message: "Invalid plan data",
      });
    }

    if (!req.userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized user",
      });
    }

    const options = {
      amount: amount * 100, // ₹ → paise
      currency: "INR",
      receipt: `receipt_${Date.now()}`,
    };

    // 🔥 create razorpay order
    const order = await razorpay.orders.create(options);

    // 💾 save in DB
    await Payment.create({
      userId: req.userId,
      planId,
      amount,
      credits,
      razorpayOrderId: order.id,
      status: "created",
    });

    return res.status(200).json({
      success: true,
      order,
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to create Razorpay order",
      error: error.message,
    });
  }
};

// ✅ VERIFY PAYMENT
export const verifyPayment = async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    } = req.body;

    // 🔒 validation
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment data",
      });
    }

    // 🔐 signature verify
    const body = `${razorpay_order_id}|${razorpay_payment_id}`;

    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment signature",
      });
    }

    // 🔍 find payment
    const payment = await Payment.findOne({
      razorpayOrderId: razorpay_order_id,
    });

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment not found",
      });
    }

    // ⚠️ prevent duplicate processing
    if (payment.status === "paid") {
      return res.status(200).json({
        success: true,
        message: "Payment already processed",
      });
    }

    // 💾 update payment
    payment.status = "paid";
    payment.razorpayPaymentId = razorpay_payment_id;
    await payment.save();

    // 💎 update user credits
    const updatedUser = await User.findByIdAndUpdate(
      payment.userId,
      {
        $inc: { credits: payment.credits },
      },
      { new: true }
    );

    return res.status(200).json({
      success: true,
      message: "Payment verified & credits added 🎉",
      user: updatedUser,
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to verify payment",
      error: error.message,
    });
  }
};