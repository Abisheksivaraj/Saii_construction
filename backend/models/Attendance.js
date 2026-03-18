const mongoose = require("mongoose");

const attendanceSchema = new mongoose.Schema(
  {
    workerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Worker",
      required: true,
      index: true,
    },

    // ⚠️ Important: normalize date (store only date, no time)
    date: {
      type: Date,
      required: true,
      index: true,
    },

    status: {
      type: String,
      enum: ["present", "absent", "half-day"],
      required: true,
    },

    salary: {
      type: Number,
      min: 0,
      default: 0,
    },

    gangId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Gang",
      index: true,
    },
    
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      index: true,
    },

    notes: {
      type: String,
      trim: true,
    },

    markedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    workHistoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "WorkHistory",
    },
  },
  {
    timestamps: true,
  }
);

/// =================================================
/// Indexes
/// =================================================

// ✅ Prevent duplicate attendance for same worker & date
attendanceSchema.index({ workerId: 1, date: 1 }, { unique: true });

attendanceSchema.index({ date: -1 });
attendanceSchema.index({ gangId: 1, date: -1 });
attendanceSchema.index({ status: 1 });

/// =================================================
/// Static Methods
/// =================================================

// 📊 Attendance summary for date range
attendanceSchema.statics.getSummaryByDateRange = function (
  startDate,
  endDate,
  filters = {}
) {
  return this.aggregate([
    {
      $match: {
        date: {
          $gte: new Date(startDate),
          $lte: new Date(endDate),
        },
        ...filters,
      },
    },
    {
      $group: {
        _id: "$status",
        count: { $sum: 1 },
        totalSalary: { $sum: "$salary" },
      },
    },
  ]);
};

// 👷 Worker-wise summary
attendanceSchema.statics.getWorkerSummary = function (
  workerId,
  startDate,
  endDate
) {
  const match = {
    workerId: new mongoose.Types.ObjectId(workerId),
  };

  if (startDate && endDate) {
    match.date = {
      $gte: new Date(startDate),
      $lte: new Date(endDate),
    };
  }

  return this.aggregate([
    { $match: match },
    {
      $group: {
        _id: "$workerId",
        totalDays: { $sum: 1 },
        presentDays: {
          $sum: { $cond: [{ $eq: ["$status", "present"] }, 1, 0] },
        },
        halfDays: {
          $sum: { $cond: [{ $eq: ["$status", "half-day"] }, 1, 0] },
        },
        absentDays: {
          $sum: { $cond: [{ $eq: ["$status", "absent"] }, 1, 0] },
        },
        totalSalary: { $sum: "$salary" },
      },
    },
  ]);
};

/// =================================================
/// Instance Methods
/// =================================================

// 💰 Salary calculation logic
attendanceSchema.methods.calculateSalary = async function () {
  const Worker = mongoose.model("Worker");
  const worker = await Worker.findById(this.workerId).lean();

  if (!worker) {
    throw new Error("Worker not found");
  }

  switch (this.status) {
    case "present":
      this.salary = worker.dailySalary;
      break;

    case "half-day":
      this.salary =
        this.salary && this.salary > 0 ? this.salary : worker.dailySalary / 2;
      break;

    case "absent":
      this.salary = 0;
      break;
  }

  return this.salary;
};

/// =================================================
/// Middleware
/// =================================================

// ⚙️ Normalize date (remove time part)
attendanceSchema.pre("save", function (next) {
  this.date.setHours(0, 0, 0, 0);
  next();
});

// ⚙️ Auto-calculate salary
attendanceSchema.pre("save", async function (next) {
  try {
    if (
      this.isModified("status") ||
      this.isModified("workerId") ||
      this.salary === 0
    ) {
      await this.calculateSalary();
    }
    next();
  } catch (err) {
    next(err);
  }
});

module.exports = mongoose.model("Attendance", attendanceSchema);
