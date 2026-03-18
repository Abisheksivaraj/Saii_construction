const mongoose = require("mongoose");

const projectWorkerAssignmentSchema = new mongoose.Schema({
  projectId: {
    type: String,
    required: true,
  },
  projectName: {
    type: String,
  },
  date: {
    type: String, // YYYY-MM-DD format for easy querying
    required: true,
  },
  workers: [
    {
      workerId: {
        type: mongoose.Schema.Types.ObjectId,
        refPath: "workers.workerType",
        required: true,
      },
      workerType: {
        type: String,
        required: true,
        enum: ["Worker", "RatedLabour"],
        default: "Worker",
      },
      name: { type: String, required: true },
      designation: { type: String },
      dailySalary: { type: Number, required: true },
    },
  ],
  totalSalary: {
    type: Number,
    default: 0,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// One assignment record per project per day
projectWorkerAssignmentSchema.index(
  { projectId: 1, date: 1 },
  { unique: true }
);

// Pre-save: calculate totalSalary
projectWorkerAssignmentSchema.pre("save", function (next) {
  this.totalSalary = this.workers.reduce((sum, w) => sum + w.dailySalary, 0);
  next();
});

module.exports = mongoose.model(
  "ProjectWorkerAssignment",
  projectWorkerAssignmentSchema
);
