const express = require("express");
const router = express.Router();
const User = require("../models/User");
const Admin = require("../models/Register");
const { protect, authorize } = require("../middlewares/auth");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

// @route   POST /api/users/upload-image
// @desc    Upload profile image for user
// @access  Protected
router.post("/upload-image", protect, async (req, res) => {
  try {
    const { profileImage } = req.body;

    if (!profileImage) {
      return res.status(400).json({
        success: false,
        message: "Please provide an image",
      });
    }

    // Validate base64 format
    if (!profileImage.startsWith("data:image/")) {
      return res.status(400).json({
        success: false,
        message: "Invalid image format",
      });
    }

    // Check image size (limit to 5MB base64)
    const sizeInBytes = (profileImage.length * 3) / 4;
    const sizeInMB = sizeInBytes / (1024 * 1024);

    if (sizeInMB > 5) {
      return res.status(400).json({
        success: false,
        message: "Image size must be less than 5MB",
      });
    }

    // Update user with profile image
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { profileImage },
      { new: true, select: "-password" }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Profile image uploaded successfully",
      profileImage: user.profileImage,
    });
  } catch (error) {
    console.error("Error uploading image:", error);
    res.status(500).json({
      success: false,
      message: "Failed to upload image",
      error: error.message,
    });
  }
});

// @route   DELETE /api/users/delete-image
// @desc    Delete profile image
// @access  Protected
router.delete("/delete-image", protect, async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { profileImage: null },
      { new: true, select: "-password" }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Profile image deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting image:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete image",
      error: error.message,
    });
  }
});

// @route   POST /api/users/create
// @desc    Create a new user
// @access  Protected
router.post("/create", protect, async (req, res) => {
  try {
    const { userName, MobileNumber, user, password, color } = req.body;

    const errors = [];

    if (!userName || userName.trim().length < 2) {
      errors.push("Name must be at least 2 characters long");
    }

    if (!MobileNumber) {
      errors.push("Mobile number is required");
    } else {
      const cleanNumber = MobileNumber.trim().replace(/\s/g, "");
      if (!/^[+]?[1-9]\d{1,14}$/.test(cleanNumber)) {
        errors.push("Please enter a valid mobile number");
      }
    }

    if (!user || user.trim().length === 0) {
      errors.push("User role is required");
    }

    if (password && password.length < 6) {
      errors.push("Password must be at least 6 characters long");
    }

    if (color && !/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(color)) {
      errors.push("Invalid color format. Please use valid hex color");
    }

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors,
      });
    }

    const cleanMobileNumber = MobileNumber.trim().replace(/\s/g, "");
    const existingUser = await User.findOne({
      MobileNumber: cleanMobileNumber,
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "User with this mobile number already exists",
      });
    }

    const newUser = new User({
      userName: userName.trim(),
      MobileNumber: cleanMobileNumber,
      user: user.trim(),
      userType: "user",
      password: password || "123456",
      color: color || "#3B82F6",
      createdBy: req.user.id,
    });

    await newUser.save();

    res.status(201).json({
      success: true,
      message: "User created successfully",
      user: newUser,
    });
  } catch (error) {
    console.error("Error creating user:", error);

    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "User with this mobile number already exists",
      });
    }

    if (error.name === "ValidationError") {
      const errors = Object.values(error.errors).map((err) => err.message);
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors,
      });
    }

    res.status(500).json({
      success: false,
      message: "Server error. Failed to create user",
      error: error.message,
    });
  }
});

// @route   POST /api/users/userLogin
// @desc    User login
// @access  Public
router.post("/userLogin", async (req, res) => {
  try {
    const { userName, password } = req.body;

    if (!userName || !password) {
      return res.status(400).json({
        success: false,
        message: "Please provide username and password",
      });
    }

    const user = await User.findOne({ userName: userName.trim() })
      .select("-password")
      .lean();

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    const userWithPassword = await User.findById(user._id);
    const isPasswordMatch = await bcrypt.compare(
      password,
      userWithPassword.password
    );

    if (!isPasswordMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    const token = jwt.sign(
      {
        id: user._id,
        userName: user.userName,
        Role: user.user,
        userType: "user",
      },
      process.env.JWT_SECRET || "your_jwt_secret_key",
      { expiresIn: "30d" }
    );

    res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      user: {
        _id: user._id,
        userName: user.userName,
        MobileNumber: user.MobileNumber,
        Role: user.user,
        role: user.user,
        userType: "user",
        color: user.color,
        profileImage: user.profileImage,
        createdBy: user.createdBy,
      },
    });
  } catch (error) {
    console.error("User login error:", error);
    res.status(500).json({
      success: false,
      message: "Server error. Failed to login",
      error: error.message,
    });
  }
});

// @route   GET /api/users/profile
// @desc    Get current user profile
// @access  Protected
router.get("/profile", protect, async (req, res) => {
  try {
    let userData;

    userData = await User.findById(req.user.id)
      .select("-password")
      .populate("createdBy", "FullName email CompanyName color")
      .lean();

    if (userData) {
      if (!userData.createdBy) {
        return res.status(400).json({
          success: false,
          message:
            "Your account is not linked to an admin. Please contact support.",
        });
      }

      return res.json({
        success: true,
        data: userData,
      });
    }

    userData = await Admin.findById(req.user.id).select("-password").lean();

    if (userData) {
      userData.createdBy = userData._id;
      userData.userType = "admin";

      return res.json({
        success: true,
        data: userData,
      });
    }

    return res.status(404).json({
      success: false,
      message: "User profile not found",
    });
  } catch (error) {
    console.error("Error fetching profile:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching profile",
      error: error.message,
    });
  }
});

// ... (rest of the routes remain the same)

router.get("/", protect, async (req, res) => {
  try {
    const users = await User.find()
      .select("-password")
      .populate("createdBy", "userName email")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: users.length,
      users,
    });
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch users",
      error: error.message,
    });
  }
});

router.get("/:id", protect, async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select("-password")
      .populate("createdBy", "userName email");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.status(200).json({
      success: true,
      user,
    });
  } catch (error) {
    console.error("Error fetching user:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch user",
      error: error.message,
    });
  }
});

router.put("/:id", protect, async (req, res) => {
  try {
    const {
      userName,
      MobileNumber,
      user: userRole,
      password,
      color,
    } = req.body;

    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (userName) user.userName = userName.trim();
    if (MobileNumber) {
      const cleanNumber = MobileNumber.trim().replace(/\s/g, "");
      user.MobileNumber = cleanNumber;
    }
    if (userRole) user.user = userRole.trim();
    if (password) user.password = password;
    if (color) user.color = color;

    await user.save();
    await user.populate("createdBy", "userName email");

    res.status(200).json({
      success: true,
      message: "User updated successfully",
      user,
    });
  } catch (error) {
    console.error("Error updating user:", error);

    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Mobile number already exists",
      });
    }

    if (error.name === "ValidationError") {
      const errors = Object.values(error.errors).map((err) => err.message);
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors,
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to update user",
      error: error.message,
    });
  }
});

router.delete("/:id", protect, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    await User.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: "User deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting user:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete user",
      error: error.message,
    });
  }
});

module.exports = router;
