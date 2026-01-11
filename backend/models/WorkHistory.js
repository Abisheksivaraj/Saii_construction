// models/WorkHistory.js
const mongoose = require("mongoose");

const workHistorySchema = new mongoose.Schema(
  {
    workerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Worker",
      required: true,
    },
    gangId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Gang",
      required: true,
    },
    date: {
      type: String, // Format: "YYYY-MM-DD"
      required: true,
    },
    dailySalary: {
      type: Number,
      required: true,
      min: 0,
    },
    designation: {
      type: String,
      enum: ["Helper", "chittal", "mason"],
      required: true,
    },
    // Optional: Track who assigned
    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  }
);

// Compound index: One worker can only be in one gang per day
workHistorySchema.index({ workerId: 1, date: 1 }, { unique: true });
workHistorySchema.index({ gangId: 1, date: 1 });
workHistorySchema.index({ date: 1 });

module.exports = mongoose.model("WorkHistory", workHistorySchema);
