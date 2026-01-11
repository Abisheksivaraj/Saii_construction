const mongoose = require("mongoose");

const workerSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Worker name is required"],
      trim: true,
    },
    designation: {
      type: String,
      required: [true, "Designation is required"],
      enum: ["Helper", "chittal", "mason"],
      default: "Helper",
    },
    dailySalary: {
      type: Number,
      required: [true, "Daily salary is required"],
      min: [0, "Daily salary cannot be negative"],
    },
    // Reference to Gang - THIS IS THE FIX
    gangId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Gang",
      default: null,
    },
    phoneNumber: {
      type: String,
      trim: true,
    },
    address: {
      type: String,
      trim: true,
    },
    // Optional: Add reference to user/company
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    // Optional: Track current gang assignment
    currentGangId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Gang",
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for faster queries
workerSchema.index({ name: 1 });
workerSchema.index({ gangId: 1 });
workerSchema.index({ userId: 1 });

module.exports = mongoose.model("Worker", workerSchema);
