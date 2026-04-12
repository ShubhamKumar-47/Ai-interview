import genToken from "../config/token.js";
import User from "../models/user.model.js";

// ✅ GOOGLE AUTH
export const googleAuth = async (req, res) => {
  try {
    const { name, email, photo } = req.body;

    // 🔒 validation
    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    // 🔍 check user
    let user = await User.findOne({ email });

    // 👉 create user if not exists
    if (!user) {
      user = await User.create({
        name: name || "User",
        email,
        photo: photo || "",
        provider: "google",
      });
    }

    // 🔥 generate JWT
    const token = genToken(user._id);

    if (!token) {
      return res.status(500).json({
        success: false,
        message: "Token generation failed",
      });
    }

    // 🍪 cookie config (VERY IMPORTANT FIX)
    const cookieOptions = {
      httpOnly: true,
      secure: true, // ✅ always true in production (Vercel + Render)
      sameSite: "none", // ✅ REQUIRED for cross-domain
      maxAge: 7 * 24 * 60 * 60 * 1000,
    };

    res.cookie("token", token, cookieOptions);

    return res.status(200).json({
      success: true,
      message: "Login successful",
      user,
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Google auth error",
      error: error.message,
    });
  }
};

// ✅ LOGOUT
export const logOut = async (req, res) => {
  try {
    const cookieOptions = {
      httpOnly: true,
      secure: true,
      sameSite: "none",
    };

    res.clearCookie("token", cookieOptions);

    return res.status(200).json({
      success: true,
      message: "Logout successful",
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Logout error",
      error: error.message,
    });
  }
};