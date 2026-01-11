const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    userName: {
      type: String,
      required: [true, "Username is required"],
      unique: true,
      trim: true,
    },
    MobileNumber: {
      type: String,
      required: [true, "Mobile number is required"],
      unique: true,
    },
    user: {
      type: String, // This is the Role (Manager, Supervisor, etc.)
      required: [true, "User role is required"],
    },
    userType: {
      type: String,
      enum: ["admin", "user"],
      default: "user",
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: 6,
    },
    color: {
      type: String,
      default: "#3B82F6",
      match: [
        /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/,
        "Please provide a valid hex color",
      ],
    },
    profileImage: {
      type: String, // Store base64 string or URL
      default: null,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      required: function () {
        return this.userType === "user";
      },
    },
  },
  {
    timestamps: true,
  }
);

// Hash password before saving
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) {
    return next();
  }

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Method to get the admin ID for this user
userSchema.methods.getAdminId = function () {
  if (this.userType === "admin") {
    return this._id;
  }
  return this.createdBy;
};

module.exports = mongoose.model("User", userSchema);
