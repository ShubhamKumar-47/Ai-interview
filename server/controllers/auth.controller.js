import genToken from "../config/token.js"
import User from "../models/user.model.js"

export const googleAuth = async (req, res) => {
  try {
    const { name, email } = req.body

    if (!email) {
      return res.status(400).json({ message: "Email is required" })
    }

    let user = await User.findOne({ email })

    // 👉 create user if not exists
    if (!user) {
      user = await User.create({
        name,
        email
      })
    }

    // 🔥 generate JWT token
    const token = genToken(user._id)

    if (!token) {
      return res.status(500).json({ message: "Unable to generate auth token" })
    }

    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      path: "/",
      maxAge: 7 * 24 * 60 * 60 * 1000
    }

    res.cookie("token", token, cookieOptions)

    return res.status(200).json({
      user,
      message: "Login successful"
    })

  } catch (error) {
    return res.status(500).json({
      message: "Google auth error",
      error: error.message
    })
  }
}

export const logOut = async (req, res) => {
  try {
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      path: "/"
    }

    res.clearCookie("token", cookieOptions)

    return res.status(200).json({
      message: "Logout successful"
    })

  } catch (error) {
    return res.status(500).json({
      message: "Logout error",
      error: error.message
    })
  }
}