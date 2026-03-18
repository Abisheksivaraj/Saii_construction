// models/GangAssignment.js
const mongoose = require("mongoose");

const gangAssignmentSchema = new mongoose.Schema({
  gang: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "gang",
    required: true,
  },
  date: {
    type: Date,
    required: true,
  },
  workers: [
    {
      worker: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Worker",
        required: true,
      },
      name: String, // Store worker name for quick access
      designation: String,
    },
  ],
  gangName: String, // Store gang name for quick access
  teamHead: String,
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Admin",
  },
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Project",
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Compound index to ensure one assignment per gang per day
gangAssignmentSchema.index({ gang: 1, date: 1 }, { unique: true });

const GangAssignment = mongoose.model("GangAssignment", gangAssignmentSchema);
module.exports = GangAssignment;
