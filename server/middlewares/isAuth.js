import jwt from "jsonwebtoken"

const isAuth = (req, res, next) => {
  try {
    const token = req.cookies?.token   // ✅ safe access

    if (!token) {
      return res.status(401).json({
        message: "No token, authorization denied"
      })
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET)

    if (!decoded) {
      return res.status(401).json({
        message: "Invalid token"
      })
    }

    req.userId = decoded.userId   // ✅ must match token payload

    next()

  } catch (error) {
    return res.status(401).json({
      message: "Auth failed",
      error: error.message
    })
  }
}

export default isAuth