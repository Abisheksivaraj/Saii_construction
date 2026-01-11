// models/RatedLabourSchema.js
const mongoose = require("mongoose");

const ratedLabourSchema = new mongoose.Schema(
  {
    designation: {
      type: String,
      enum: ["electrician", "plumber", "centering", "tiles", "paint", "auto"],
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: false,
    },
    salaryGiven: {
      type: Number,
      default: 0,
      min: 0,
    },
    autoService: {
      type: String,
      enum: ["pickup", "drop", "materials", "labours"],
      required: function () {
        return this.designation === "auto";
      },
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    createdByModel: {
      type: String,
      enum: ["Admin", "User"],
      required: function () {
        return this.isNew;
      },
      default: "User",
    },
    workStartDate: {
      type: Date,
    },
    workEndDate: {
      type: Date,
    },
    notes: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ["active", "completed", "terminated"],
      default: "active",
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Pre-save middleware to auto-detect createdByModel if not set
ratedLabourSchema.pre("save", async function (next) {
  if (!this.createdByModel && this.createdBy) {
    try {
      const Admin = mongoose.model("Admin");
      const admin = await Admin.findById(this.createdBy);
      this.createdByModel = admin ? "Admin" : "User";
      console.log(
        `Auto-detected createdByModel: ${this.createdByModel} for labour ${this.name}`
      );
    } catch (error) {
      console.error("Error auto-detecting createdByModel:", error);
      this.createdByModel = "User";
    }
  }
  next();
});

// Indexes
ratedLabourSchema.index({ designation: 1 });
ratedLabourSchema.index({ createdBy: 1, createdByModel: 1 });
ratedLabourSchema.index({ status: 1 });
ratedLabourSchema.index({ name: "text" });

// Static methods
ratedLabourSchema.statics.findByDesignation = function (designation) {
  return this.find({ designation }).sort({ name: 1 });
};

ratedLabourSchema.statics.getPaymentStats = async function () {
  const stats = await this.aggregate([
    { $match: { status: "active" } },
    {
      $group: {
        _id: null,
        totalLabours: { $sum: 1 },
        totalGivenAmount: { $sum: "$salaryGiven" },
        avgSalary: { $avg: "$salaryGiven" },
      },
    },
  ]);

  return stats.length > 0
    ? stats[0]
    : {
        totalLabours: 0,
        totalGivenAmount: 0,
        avgSalary: 0,
      };
};

module.exports = mongoose.model("RatedLabour", ratedLabourSchema);
