const express = require("express");
const router = express.Router();
const Gang = require("../models/Gangs");
const Worker = require("../models/workerModel");

// @route   GET /api/gangs
// @desc    Get all gangs
// @access  Private (add auth middleware as needed)
router.get("/", async (req, res) => {
  try {
    const { userId } = req.query; // Optional: filter by user

    const query = userId ? { userId } : {};
    const gangs = await Gang.find(query).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: gangs.length,
      data: gangs,
    });
  } catch (error) {
    console.error("Error fetching gangs:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching gangs",
      error: error.message,
    });
  }
});

// @route   GET /api/gangs/:id
// @desc    Get single gang by ID
// @access  Private
router.get("/:id", async (req, res) => {
  try {
    const gang = await Gang.findById(req.params.id);

    if (!gang) {
      return res.status(404).json({
        success: false,
        message: "Gang not found",
      });
    }

    // Get workers count for this gang
    const workerCount = await Worker.countDocuments({ gangId: gang._id });

    res.status(200).json({
      success: true,
      data: {
        ...gang.toObject(),
        workerCount,
      },
    });
  } catch (error) {
    console.error("Error fetching gang:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching gang",
      error: error.message,
    });
  }
});

// @route   POST /api/gangs
// @desc    Create a new gang
// @access  Private
router.post("/", async (req, res) => {
  try {
    const { gangName, teamHead, userId, projectId } = req.body;

    // Validation
    if (!gangName || !teamHead) {
      return res.status(400).json({
        success: false,
        message: "Gang name and team head are required",
      });
    }

    // Check if gang name already exists for this user
    const existingGang = await Gang.findOne({ gangName, userId });
    if (existingGang) {
      return res.status(400).json({
        success: false,
        message: "Gang with this name already exists",
      });
    }

    const gang = await Gang.create({
      gangName,
      teamHead,
      userId,
      projectId,
    });

    res.status(201).json({
      success: true,
      message: "Gang created successfully",
      data: gang,
    });
  } catch (error) {
    console.error("Error creating gang:", error);
    res.status(500).json({
      success: false,
      message: "Error creating gang",
      error: error.message,
    });
  }
});

// @route   PUT /api/gangs/:id
// @desc    Update a gang
// @access  Private
router.put("/:id", async (req, res) => {
  try {
    const { gangName, teamHead } = req.body;

    // Validation
    if (!gangName || !teamHead) {
      return res.status(400).json({
        success: false,
        message: "Gang name and team head are required",
      });
    }

    const gang = await Gang.findById(req.params.id);

    if (!gang) {
      return res.status(404).json({
        success: false,
        message: "Gang not found",
      });
    }

    // Update gang
    gang.gangName = gangName;
    gang.teamHead = teamHead;
    await gang.save();

    res.status(200).json({
      success: true,
      message: "Gang updated successfully",
      data: gang,
    });
  } catch (error) {
    console.error("Error updating gang:", error);
    res.status(500).json({
      success: false,
      message: "Error updating gang",
      error: error.message,
    });
  }
});

// @route   DELETE /api/gangs/:id
// @desc    Delete a gang
// @access  Private
router.delete("/:id", async (req, res) => {
  try {
    const gang = await Gang.findById(req.params.id);

    if (!gang) {
      return res.status(404).json({
        success: false,
        message: "Gang not found",
      });
    }

    // Unassign all workers from this gang
    await Worker.updateMany({ gangId: req.params.id }, { gangId: null });

    // Delete the gang
    await Gang.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: "Gang deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting gang:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting gang",
      error: error.message,
    });
  }
});

// @route   GET /api/gangs/:id/workers
// @desc    Get all workers in a gang
// @access  Private
router.get("/:id/workers", async (req, res) => {
  try {
    const gang = await Gang.findById(req.params.id);

    if (!gang) {
      return res.status(404).json({
        success: false,
        message: "Gang not found",
      });
    }

    const workers = await Worker.find({ gangId: req.params.id }).sort({
      name: 1,
    });

    res.status(200).json({
      success: true,
      count: workers.length,
      data: workers,
    });
  } catch (error) {
    console.error("Error fetching gang workers:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching gang workers",
      error: error.message,
    });
  }
});

module.exports = router;
