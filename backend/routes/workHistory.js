// routes/workHistory.js
const express = require("express");
const router = express.Router();
const WorkHistory = require("../models/WorkHistory");
const Worker = require("../models/workerModel");
const Gang = require("../models/Gangs");

// Assign worker to gang for specific date with custom salary
router.post("/work-history", async (req, res) => {
  try {
    const { workerId, gangId, date, dailySalary, designation } = req.body;

    // Validate inputs
    if (!workerId || !gangId || !date || !dailySalary) {
      return res.status(400).json({
        success: false,
        message: "All fields are required",
      });
    }

    // Check if worker exists
    const worker = await Worker.findById(workerId);
    if (!worker) {
      return res.status(404).json({
        success: false,
        message: "Worker not found",
      });
    }

    // Check if gang exists
    const gang = await Gang.findById(gangId);
    if (!gang) {
      return res.status(404).json({
        success: false,
        message: "Gang not found",
      });
    }

    // Check if worker already assigned for this date
    const existingAssignment = await WorkHistory.findOne({
      workerId,
      date,
    });

    if (existingAssignment) {
      // Update existing assignment
      existingAssignment.gangId = gangId;
      existingAssignment.dailySalary = dailySalary;
      existingAssignment.designation = designation || worker.designation;
      await existingAssignment.save();

      return res.status(200).json({
        success: true,
        message: "Work assignment updated",
        data: existingAssignment,
      });
    }

    // Create new work history entry
    const workHistory = await WorkHistory.create({
      workerId,
      gangId,
      date,
      dailySalary,
      designation: designation || worker.designation,
      assignedBy: req.user?._id, // If you have auth
    });

    // Update worker's current gang
    worker.currentGangId = gangId;
    await worker.save();

    res.status(201).json({
      success: true,
      message: "Worker assigned to gang",
      data: workHistory,
    });
  } catch (error) {
    console.error("Error assigning worker:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to assign worker",
    });
  }
});

// Get worker's work history
router.get("/work-history/worker/:workerId", async (req, res) => {
  try {
    const { workerId } = req.params;
    const { startDate, endDate } = req.query;

    const query = { workerId };
    if (startDate && endDate) {
      query.date = { $gte: startDate, $lte: endDate };
    }

    const history = await WorkHistory.find(query)
      .populate("gangId", "gangName teamHead")
      .sort({ date: -1 });

    res.status(200).json({
      success: true,
      data: history,
    });
  } catch (error) {
    console.error("Error fetching work history:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch work history",
    });
  }
});

// Get gang's workers for a specific date
router.get("/work-history/gang/:gangId", async (req, res) => {
  try {
    const { gangId } = req.params;
    const { date } = req.query;

    if (!date) {
      return res.status(400).json({
        success: false,
        message: "Date is required",
      });
    }

    const workers = await WorkHistory.find({ gangId, date })
      .populate("workerId", "name phoneNumber address")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: workers,
    });
  } catch (error) {
    console.error("Error fetching gang workers:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch gang workers",
    });
  }
});

module.exports = router;
