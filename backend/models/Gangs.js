const mongoose = require("mongoose");

const gangSchema = new mongoose.Schema(
  {
    gangName: {
      type: String,
      required: [true, "Gang name is required"],
      trim: true,
    },
    teamHead: {
      type: String,
      required: [true, "Team head is required"],
      trim: true,
    },
    // Optional: Add reference to project if needed
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
    },
    // Optional: Add reference to user/company
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  }
);

// Index for faster queries
gangSchema.index({ gangName: 1, userId: 1 });

module.exports = mongoose.model("Gang", gangSchema);
