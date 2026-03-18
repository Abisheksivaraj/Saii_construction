// routes/gangAssignments.js
const express = require("express");
const router = express.Router();
const GangAssignment = require("../models/GangAssignment");
const Gang = require("../models/Gangs");
const Worker = require("../models/workerModel");
const { protect } = require("../middlewares/auth");

// POST - Create or update daily gang assignment
router.post("/", protect, async (req, res) => {
  try {
    const { gangId, workerIds, date, projectId } = req.body;

    if (!gangId || !workerIds || workerIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Gang ID and worker IDs are required",
      });
    }

    // Get gang details
    const gang = await Gang.findById(gangId);
    if (!gang) {
      return res.status(404).json({
        success: false,
        message: "Gang not found",
      });
    }

    // Get worker details
    const workers = await Worker.find({ _id: { $in: workerIds } });
    if (workers.length !== workerIds.length) {
      return res.status(404).json({
        success: false,
        message: "Some workers not found",
      });
    }

    // Use provided date or today's date
    const assignmentDate = date ? new Date(date) : new Date();
    assignmentDate.setHours(0, 0, 0, 0); // Set to start of day

    // Format workers for storage
    const workerData = workers.map((w) => ({
      worker: w._id,
      name: w.name,
      designation: w.designation,
    }));

    // Check if assignment already exists for this gang and date
    let assignment = await GangAssignment.findOne({
      gang: gangId,
      date: assignmentDate,
    });

    if (assignment) {
      // Update existing assignment
      assignment.workers = workerData;
      assignment.gangName = gang.gangName;
      assignment.teamHead = gang.teamHead;
      assignment.project = projectId || assignment.project;
      await assignment.save();

      return res.status(200).json({
        success: true,
        message: "Gang assignment updated successfully",
        data: assignment,
      });
    } else {
      // Create new assignment
      assignment = new GangAssignment({
        gang: gangId,
        date: assignmentDate,
        workers: workerData,
        gangName: gang.gangName,
        teamHead: gang.teamHead,
        project: projectId,
        createdBy: req.user._id,
      });

      await assignment.save();

      return res.status(201).json({
        success: true,
        message: "Gang assignment created successfully",
        data: assignment,
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error creating gang assignment",
      error: error.message,
    });
  }
});

// GET - Get all assignments (with optional date filter)
router.get("/", protect, async (req, res) => {
  try {
    const { date, gangId, startDate, endDate } = req.query;

    let query = {};

    // Filter by specific date
    if (date) {
      const searchDate = new Date(date);
      searchDate.setHours(0, 0, 0, 0);
      query.date = searchDate;
    }

    // Filter by date range
    if (startDate && endDate) {
      query.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    // Filter by gang
    if (gangId) {
      query.gang = gangId;
    }

    const assignments = await GangAssignment.find(query)
      .populate("gang", "gangName teamHead")
      .populate("workers.worker", "name designation")
      .sort({ date: -1 });

    res.status(200).json({
      success: true,
      count: assignments.length,
      data: assignments,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching gang assignments",
      error: error.message,
    });
  }
});

// GET - Get today's assignments
router.get("/today", protect, async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const assignments = await GangAssignment.find({ date: today })
      .populate("gang", "gangName teamHead")
      .populate("workers.worker", "name designation");

    res.status(200).json({
      success: true,
      count: assignments.length,
      data: assignments,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching today's assignments",
      error: error.message,
    });
  }
});

// GET - Get assignment history for a specific gang
router.get("/gang/:gangId", protect, async (req, res) => {
  try {
    const { gangId } = req.params;
    const { limit = 30 } = req.query;

    const assignments = await GangAssignment.find({ gang: gangId })
      .populate("workers.worker", "name designation")
      .sort({ date: -1 })
      .limit(parseInt(limit));

    res.status(200).json({
      success: true,
      count: assignments.length,
      data: assignments,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching gang assignment history",
      error: error.message,
    });
  }
});

// DELETE - Delete an assignment
router.delete("/:id", protect, async (req, res) => {
  try {
    const assignment = await GangAssignment.findByIdAndDelete(req.params.id);

    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: "Assignment not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Assignment deleted successfully",
      data: assignment,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error deleting assignment",
      error: error.message,
    });
  }
});

module.exports = router;
