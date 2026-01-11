// models/RatedLabourPayments.js
const mongoose = require("mongoose");

const labourPaymentRecordSchema = new mongoose.Schema(
  {
    labour: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "RatedLabour",
      required: true,
    },
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
    },
    paymentDate: {
      type: Date,
      required: true,
      default: Date.now,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    notes: {
      type: String,
      trim: true,
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
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Pre-save middleware to auto-detect createdByModel if not set
labourPaymentRecordSchema.pre("save", async function (next) {
  if (!this.createdByModel && this.createdBy) {
    try {
      const Admin = mongoose.model("Admin");
      const admin = await Admin.findById(this.createdBy);
      this.createdByModel = admin ? "Admin" : "User";
      console.log(
        `Auto-detected createdByModel: ${this.createdByModel} for payment`
      );
    } catch (error) {
      console.error("Error auto-detecting createdByModel:", error);
      this.createdByModel = "User";
    }
  }
  next();
});

// Indexes
labourPaymentRecordSchema.index({ labour: 1, paymentDate: -1 });
labourPaymentRecordSchema.index({ createdBy: 1, createdByModel: 1 });

// Get total payments for a labour
labourPaymentRecordSchema.statics.getTotalPayments = async function (labourId) {
  const result = await this.aggregate([
    { $match: { labour: new mongoose.Types.ObjectId(labourId) } },
    {
      $group: {
        _id: null,
        totalAmount: { $sum: "$amount" },
        paymentCount: { $sum: 1 },
      },
    },
  ]);

  return result.length > 0 ? result[0] : { totalAmount: 0, paymentCount: 0 };
};

module.exports = mongoose.model(
  "LabourPaymentRecord",
  labourPaymentRecordSchema
);
