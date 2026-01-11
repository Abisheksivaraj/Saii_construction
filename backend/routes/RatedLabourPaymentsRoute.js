// routes/labourPayments.js
const express = require("express");
const router = express.Router();
const LabourPaymentRecord = require("../models/RatedLabourPayments");
const RatedLabour = require("../models/RatedLabourSchema");
const Project = require("../models/NewProject");

// ✅ Update these to match your actual model files
const Admin = require("../models/Register"); // This is your admin model
const User = require("../models/User"); // Make sure this path is correct

const getUserInfo = (req) => {
  return {
    createdBy:
      req.body.createdBy ||
      req.headers["user-id"] ||
      "507f1f77bcf86cd799439011",
    createdByModel:
      req.body.createdByModel ||
      (req.body.createdByType === "admin" ? "Admin" : "User"),
  };
};

// GET /api/labour-payments/:labourId - Get all payments for a labour
router.get("/:labourId", async (req, res) => {
  try {
    const { labourId } = req.params;

    // Get labour
    let labour = await RatedLabour.findById(labourId).lean();

    if (!labour) {
      return res.status(404).json({
        success: false,
        message: "Labour not found",
      });
    }

    console.log("=== LABOUR CREATOR DEBUG ===");
    console.log("Labour createdBy:", labour.createdBy);
    console.log("Labour createdByModel:", labour.createdByModel);

    // Manually populate labour creator
    if (labour.createdBy && labour.createdByModel) {
      try {
        const Model = labour.createdByModel === "Admin" ? Admin : User;
        console.log("Using model:", labour.createdByModel);

        const creator = await Model.findById(labour.createdBy)
          .select("name email color userName")
          .lean();

        console.log("Creator found:", !!creator);
        console.log("Creator data:", creator);

        labour.creator = creator;
      } catch (err) {
        console.error("Error populating labour creator:", err);
      }
    }

    // Get payments
    let payments = await LabourPaymentRecord.find({ labour: labourId })
      .populate("project", "projectName location")
      .sort({ paymentDate: -1 })
      .lean();

    console.log("=== PAYMENTS DEBUG ===");
    console.log("Total payments:", payments.length);

    // Manually populate payment creators
    for (let payment of payments) {
      if (payment.createdBy && payment.createdByModel) {
        try {
          const Model = payment.createdByModel === "Admin" ? Admin : User;
          console.log(
            `Payment ${payment._id} - Using model:`,
            payment.createdByModel
          );

          const creator = await Model.findById(payment.createdBy)
            .select("name email color userName")
            .lean();

          console.log(`Payment ${payment._id} - Creator found:`, !!creator);
          console.log(`Payment ${payment._id} - Creator data:`, creator);

          payment.creator = creator;
        } catch (err) {
          console.error(
            `Error populating payment ${payment._id} creator:`,
            err
          );
        }
      }
    }

    const stats = await LabourPaymentRecord.getTotalPayments(labourId);

    res.json({
      success: true,
      data: {
        labour,
        payments,
        stats,
      },
    });
  } catch (error) {
    console.error("Error fetching payment records:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching payment records",
      error: error.message,
    });
  }
});

// POST /api/labour-payments/:labourId - Add payment record
router.post("/:labourId", async (req, res) => {
  try {
    const { labourId } = req.params;
    const { paymentDate, projectId, amount, notes } = req.body;
    const userInfo = getUserInfo(req);

    console.log("=== ADD PAYMENT DEBUG ===");
    console.log("userInfo:", userInfo);

    if (!projectId) {
      return res.status(400).json({
        success: false,
        message: "Project/Building is required",
      });
    }

    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Valid payment amount is required",
      });
    }

    const labour = await RatedLabour.findById(labourId);
    if (!labour) {
      return res.status(404).json({
        success: false,
        message: "Labour not found",
      });
    }

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(400).json({
        success: false,
        message: "Invalid project ID",
      });
    }

    const paymentRecord = new LabourPaymentRecord({
      labour: labourId,
      project: projectId,
      paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
      amount: Number(amount),
      notes: notes?.trim(),
      ...userInfo,
    });

    await paymentRecord.save();

    console.log(
      "Payment saved with createdByModel:",
      paymentRecord.createdByModel
    );

    // Update total salary in RatedLabour
    const stats = await LabourPaymentRecord.getTotalPayments(labourId);
    labour.salaryGiven = stats.totalAmount;
    await labour.save();

    res.status(201).json({
      success: true,
      message: "Payment record added successfully",
      data: paymentRecord,
    });
  } catch (error) {
    console.error("Error adding payment record:", error);
    res.status(500).json({
      success: false,
      message: "Error adding payment record",
      error: error.message,
    });
  }
});

// DELETE /api/labour-payments/record/:paymentId - Delete payment record
router.delete("/record/:paymentId", async (req, res) => {
  try {
    const { paymentId } = req.params;

    const payment = await LabourPaymentRecord.findById(paymentId);
    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment record not found",
      });
    }

    const labourId = payment.labour;
    await LabourPaymentRecord.findByIdAndDelete(paymentId);

    // Update total salary in RatedLabour
    const labour = await RatedLabour.findById(labourId);
    if (labour) {
      const stats = await LabourPaymentRecord.getTotalPayments(labourId);
      labour.salaryGiven = stats.totalAmount;
      await labour.save();
    }

    res.json({
      success: true,
      message: "Payment record deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting payment record:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting payment record",
      error: error.message,
    });
  }
});

module.exports = router;
