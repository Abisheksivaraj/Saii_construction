const mongoose = require("mongoose");

const quotationSchema = new mongoose.Schema(
  {
    projectId: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 0,
    },
    unit: {
      type: String,
      required: true,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    total: {
      type: Number,
      default: 0,
    },
    date: {
      type: Date,
      required: true,
      default: Date.now,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      refPath: "createdByModel",
    },
    createdByModel: {
      type: String,
      required: true,
      enum: ["Admin", "User"],
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true }, // Add this
    toObject: { virtuals: true }, // Add this
  }
);

// Add virtual field to create 'creator' alias for 'createdBy'
quotationSchema.virtual("creator").get(function () {
  return this.createdBy;
});

// Indexes for better query performance
quotationSchema.index({ projectId: 1 });
quotationSchema.index({ createdBy: 1 });
quotationSchema.index({ date: -1 });

// Pre-save middleware to calculate total
quotationSchema.pre("save", function (next) {
  if (this.isModified("quantity") || this.isModified("price")) {
    this.total = this.quantity * this.price;
  }
  next();
});

module.exports = mongoose.model("Quotation", quotationSchema);
