// models/Vendor.js
const mongoose = require("mongoose");

const billSchema = new mongoose.Schema({
  fileName: {
    type: String,
    required: true,
  },
  billImage: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  totalAmount: {
    type: Number,
    required: true,
    min: 0,
  },
  paidAmount: {
    type: Number,
    required: true,
    min: 0,
  },
  balance: {
    type: Number,
    required: true,
  },
  purchaseDate: {
    type: Date,
    required: true,
  },
  // Add creator tracking for each bill
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
  },
  createdByModel: {
    type: String,
    enum: ["Admin", "User"],
    required: true,
    default: "User",
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

billSchema.pre("save", function (next) {
  this.balance = this.totalAmount - this.paidAmount;
  this.updatedAt = Date.now();
  next();
});

const vendorSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    type: String,
    required: true,
    trim: true,
  },
  mobileNumber: {
    type: String,
    required: true,
    validate: {
      validator: function (v) {
        return /^\d{10}$/.test(v);
      },
      message: (props) =>
        `${props.value} is not a valid 10-digit mobile number!`,
    },
  },
  bills: [billSchema],
  totalAmount: {
    type: Number,
    default: 0,
  },
  totalPaid: {
    type: Number,
    default: 0,
  },
  totalBalance: {
    type: Number,
    default: 0,
  },
  // Add creator tracking for vendor
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
  },
  createdByModel: {
    type: String,
    enum: ["Admin", "User"],
    required: true,
    default: "User",
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

vendorSchema.methods.calculateTotals = function () {
  this.totalAmount = this.bills.reduce(
    (sum, bill) => sum + bill.totalAmount,
    0
  );
  this.totalPaid = this.bills.reduce((sum, bill) => sum + bill.paidAmount, 0);
  this.totalBalance = this.totalAmount - this.totalPaid;
};

vendorSchema.pre("save", function (next) {
  this.calculateTotals();
  this.updatedAt = Date.now();
  next();
});

vendorSchema.index({ name: 1 });
vendorSchema.index({ mobileNumber: 1 });
vendorSchema.index({ createdAt: -1 });

const Vendor = mongoose.model("Vendor", vendorSchema);

module.exports = Vendor;
