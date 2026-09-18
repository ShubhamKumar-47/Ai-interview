import jwt from "jsonwebtoken"

const isAuth = (req, res, next) => {
  try {
    let token = req.cookies?.token

    if (!token && req.headers.authorization && req.headers.authorization.startsWith("Bearer ")) {
      token = req.headers.authorization.split(" ")[1]
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "No token, authorization denied"
      })
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET)

    if (!decoded || !decoded.userId) {
      return res.status(401).json({
        success: false,
        message: "Invalid token payload"
      })
    }

    req.userId = decoded.userId   // ✅ must match token payload

    next()

  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Auth failed",
      error: error.message
    })
  }
}

export default isAuth