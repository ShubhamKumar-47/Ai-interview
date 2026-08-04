import "dotenv/config";
import express from "express";
import connectDb from "./config/connectDb.js";
import cookieParser from "cookie-parser";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

const app = express();

// 🛡️ Security Headers Configuration
app.use(
  helmet({
    contentSecurityPolicy: false, // Disable CSP to prevent blocking external scripts like Razorpay checkouts
    crossOriginEmbedderPolicy: false,
  })
);

// 🛡️ API Request Rate Limiter (100 requests per 15 minutes per IP)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many requests from this IP. Please try again after 15 minutes."
  }
});
app.use("/api/", limiter);

// Routes
import authRouter from "./routes/auth.route.js";
import userRouter from "./routes/user.route.js";
import interviewRouter from "./routes/interview.route.js";
import paymentRouter from "./routes/payment.route.js";


// ✅ Allowed origins (supports custom domains via env)
const allowedOrigins = (
  process.env.ALLOWED_ORIGINS ||
  "http://localhost:5173,https://ai-interview-shubh.vercel.app,https://mockverse.online,https://www.mockverse.online"
)
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

// 🔐 CORS setup (IMPORTANT FIX)
app.use(
  cors({
    origin: (origin, callback) => {
      // allow server-to-server / Postman / direct browser requests with no origin
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      console.log("❌ Blocked by CORS:", origin);
      return callback(new Error("CORS policy violation"));
    },
    credentials: true,
  })
);

// 🧠 Middleware
app.use(express.json());
app.use(cookieParser());

// ✅ Health check
app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "API is running 🚀",
  });
});

// ✅ Speech STT Config Check
app.get("/api/speech/config", (req, res) => {
  const hasKey = !!process.env.DEEPGRAM_API_KEY;
  res.status(200).json({
    success: true,
    deepgramAvailable: hasKey
  });
});

// ✅ Routes
app.use("/api/auth", authRouter);
app.use("/api/user", userRouter);
app.use("/api/interview", interviewRouter);
app.use("/api/payment", paymentRouter);

// ❌ 404 Handler (VERY IMPORTANT)
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});

// 🔥 Global Error Handler (PRODUCTION READY)
app.use((err, req, res, next) => {
  console.error("🔥 Server Error:", err.message);

  res.status(500).json({
    success: false,
    message: err.message || "Internal Server Error",
  });
});

import { setupSpeechProxy } from "./services/speechProxy.js";

// 🚀 Start server
const PORT = process.env.PORT || 8000;

const server = app.listen(PORT, async () => {
  console.log(`🚀 Server running on port ${PORT}`);
  const hasKey = !!process.env.DEEPGRAM_API_KEY;
  console.log(`Deepgram key loaded: ${hasKey ? "YES" : "NO"}`);
  await connectDb();
});

// Attach WebSocket Speech Proxy
setupSpeechProxy(server);