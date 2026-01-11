const mongoose = require("mongoose");

const advanceSchema = new mongoose.Schema(
  {
    // Reference to Worker - MUST be ObjectId with ref
    workerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Worker",
      required: [true, "Worker ID is required"],
    },
    amount: {
      type: Number,
      required: [true, "Advance amount is required"],
      min: [0, "Advance amount cannot be negative"],
    },
    description: {
      type: String,
      trim: true,
      default: "",
    },
    date: {
      type: Date,
      default: Date.now,
      required: true,
    },
    isPaid: {
      type: Boolean,
      default: false,
    },
    paidDate: {
      type: Date,
    },
    // Optional: Add reference to user/company
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    // Optional: Add payment method
    paymentMethod: {
      type: String,
      enum: ["cash", "bank_transfer", "check", "other"],
      default: "cash",
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for faster queries
advanceSchema.index({ workerId: 1, date: -1 });
advanceSchema.index({ isPaid: 1 });
advanceSchema.index({ userId: 1 });

// Virtual for formatted date
advanceSchema.virtual("formattedDate").get(function () {
  return this.date.toLocaleDateString("en-IN", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
});

// Method to mark as paid
advanceSchema.methods.markAsPaid = async function () {
  this.isPaid = true;
  this.paidDate = new Date();
  return await this.save();
};

module.exports = mongoose.model("Advance", advanceSchema);
