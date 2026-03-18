const express = require("express");
const router = express.Router();
const ProjectWorkerAssignment = require("../models/ProjectWorkerAssignment");
const Worker = require("../models/workerModel");
const RatedLabour = require("../models/RatedLabourSchema");

// POST - Assign workers to a project for a specific date
router.post("/", async (req, res) => {
  try {
    const { projectId, projectName, date, workers } = req.body;

    if (!projectId || !date || !workers || workers.length === 0) {
      return res.status(400).json({
        success: false,
        message: "projectId, date, and workers are required",
      });
    }

    // Validate workers exist across different collections
    const regularWorkerIds = workers.filter(w => w.workerType === "Worker").map(w => w.workerId);
    const ratedLabourIds = workers.filter(w => w.workerType === "RatedLabour").map(w => w.workerId);

    const existingRegularWorkers = regularWorkerIds.length > 0 ? await Worker.find({ _id: { $in: regularWorkerIds } }) : [];
    const existingRatedLabours = ratedLabourIds.length > 0 ? await RatedLabour.find({ _id: { $in: ratedLabourIds } }) : [];

    if (existingRegularWorkers.length + existingRatedLabours.length !== workers.length) {
      return res.status(404).json({
        success: false,
        message: "Some workers or rated labours were not found",
      });
    }

    // Build worker data with names from DB
    const workerData = workers.map((w) => {
      let dbWorker;
      if (w.workerType === "RatedLabour") {
        dbWorker = existingRatedLabours.find(ew => ew._id.toString() === w.workerId);
      } else {
        dbWorker = existingRegularWorkers.find(ew => ew._id.toString() === w.workerId);
      }

      return {
        workerId: w.workerId,
        workerType: w.workerType || "Worker",
        name: dbWorker?.name || w.name,
        designation: dbWorker?.designation || w.designation,
        dailySalary: w.dailySalary || dbWorker?.dailySalary || 0,
      };
    });

    // Upsert: update if exists, create if not
    let assignment = await ProjectWorkerAssignment.findOne({ projectId, date });

    if (assignment) {
      assignment.workers = workerData;
      assignment.projectName = projectName || assignment.projectName;
      await assignment.save();

      return res.status(200).json({
        success: true,
        message: "Worker assignment updated",
        data: assignment,
      });
    }

    assignment = new ProjectWorkerAssignment({
      projectId,
      projectName,
      date,
      workers: workerData,
    });

    await assignment.save();

    res.status(201).json({
      success: true,
      message: "Workers assigned to project",
      data: assignment,
    });
  } catch (error) {
    console.error("Error assigning workers:", error);

    // Handle duplicate key error
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Assignment already exists for this date. Use update instead.",
      });
    }

    res.status(500).json({
      success: false,
      message: error.message || "Failed to assign workers",
    });
  }
});

// GET - Get all assignments for a project (history)
router.get("/:projectId", async (req, res) => {
  try {
    const { projectId } = req.params;
    const { startDate, endDate, limit = 30 } = req.query;

    const query = { projectId };

    if (startDate && endDate) {
      query.date = { $gte: startDate, $lte: endDate };
    }

    const assignments = await ProjectWorkerAssignment.find(query)
      .sort({ date: -1 })
      .limit(parseInt(limit));

    // Calculate summary
    const totalDays = assignments.length;
    const totalSalaryPaid = assignments.reduce(
      (sum, a) => sum + a.totalSalary,
      0
    );

    res.status(200).json({
      success: true,
      count: totalDays,
      totalSalaryPaid,
      data: assignments,
    });
  } catch (error) {
    console.error("Error fetching assignments:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch assignments",
    });
  }
});

// GET - Get assignment for a specific project and date
router.get("/:projectId/date/:date", async (req, res) => {
  try {
    const { projectId, date } = req.params;

    const assignment = await ProjectWorkerAssignment.findOne({
      projectId,
      date,
    });

    res.status(200).json({
      success: true,
      data: assignment || { workers: [], totalSalary: 0 },
    });
  } catch (error) {
    console.error("Error fetching assignment:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch assignment",
    });
  }
});

// DELETE - Remove an assignment
router.delete("/:id", async (req, res) => {
  try {
    const assignment = await ProjectWorkerAssignment.findByIdAndDelete(
      req.params.id
    );

    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: "Assignment not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Assignment deleted",
      data: assignment,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Failed to delete assignment",
    });
  }
});

module.exports = router;
