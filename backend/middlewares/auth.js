// middlewares/auth.js
const jwt = require("jsonwebtoken");
const Admin = require("../models/Register"); // or your Admin model
const User = require("../models/User");

exports.protect = async (req, res, next) => {
  let token;

  // Check for token in Authorization header
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    token = req.headers.authorization.split(" ")[1];
  }

  // Make sure token exists
  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Not authorized to access this route",
    });
  }

  try {
    // Verify token
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || "your_jwt_secret_key"
    );

    console.log("Decoded token:", decoded);

    // Check if it's an admin or user based on the decoded token
    let user;

    if (decoded.id) {
      // Try to find as user first
      user = await User.findById(decoded.id).select("-password");

      // If not found as user, try admin
      if (!user) {
        user = await Admin.findById(decoded.id).select("-password");
      }
    }

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found",
      });
    }

    // Attach user to request
    req.user = user;
    next();
  } catch (error) {
    console.error("Token verification error:", error);
    return res.status(401).json({
      success: false,
      message: "Not authorized, token failed",
    });
  }
};
