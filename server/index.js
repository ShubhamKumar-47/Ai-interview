import express from "express";
import dotenv from "dotenv";
import connectDb from "./config/connectDb.js";
import cookieParser from "cookie-parser";
import cors from "cors";

import authRouter from "./routes/auth.route.js";
import userRouter from "./routes/user.route.js";
import interviewRouter from "./routes/interview.route.js";
import paymentRouter from "./routes/payment.route.js";

dotenv.config();

const app = express();

// ✅ Allowed origins (IMPORTANT)
const allowedOrigins = [
  "http://localhost:5173", // local frontend
  "https://ai-interview.vercel.app" // 🔥 replace with your real Vercel URL
];

app.use(
  cors({
    origin: function (origin, callback) {
      // allow requests with no origin (like Postman)
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      } else {
        return callback(new Error("CORS policy violation"));
      }
    },
    credentials: true
  })
);

app.use(express.json());
app.use(cookieParser());

// ✅ Test route (important for Render check)
app.get("/", (req, res) => {
  res.send("API is running 🚀");
});

// ✅ Routes
app.use("/api/auth", authRouter);
app.use("/api/user", userRouter);
app.use("/api/interview", interviewRouter);
app.use("/api/payment", paymentRouter);

// ✅ Start server
const PORT = process.env.PORT || 8000;

app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  await connectDb();
});