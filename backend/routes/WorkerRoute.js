const express = require("express");
const router = express.Router();
const Worker = require("../models/workerModel");
const Gang = require("../models/Gangs");

// @route   GET /api/workers
// @desc    Get all workers (with optional populate)
// @access  Private
router.get("/", async (req, res) => {
  try {
    const { userId, gangId, populate } = req.query;

    const query = {};
    if (userId) query.userId = userId;
    if (gangId) query.gangId = gangId;

    let workersQuery = Worker.find(query).sort({ name: 1 });

    // Only populate if requested
    if (populate === "true") {
      workersQuery = workersQuery.populate("gangId", "gangName teamHead");
    }

    const workers = await workersQuery;

    res.status(200).json({
      success: true,
      count: workers.length,
      data: workers,
    });
  } catch (error) {
    console.error("Error fetching workers:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching workers",
      error: error.message,
    });
  }
});

// @route   GET /api/workers/:id
// @desc    Get single worker by ID
// @access  Private
router.get("/:id", async (req, res) => {
  try {
    const worker = await Worker.findById(req.params.id).populate(
      "gangId",
      "gangName teamHead"
    );

    if (!worker) {
      return res.status(404).json({
        success: false,
        message: "Worker not found",
      });
    }

    res.status(200).json({
      success: true,
      data: worker,
    });
  } catch (error) {
    console.error("Error fetching worker:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching worker",
      error: error.message,
    });
  }
});

// @route   POST /api/workers
// @desc    Create a new worker
// @access  Private
router.post("/", async (req, res) => {
  try {
    const {
      name,
      designation,
      dailySalary,
      gangId,
      phoneNumber,
      address,
      userId,
    } = req.body;

    // Validation
    if (!name || !designation || !dailySalary) {
      return res.status(400).json({
        success: false,
        message: "Name, designation, and daily salary are required",
      });
    }

    // If gangId is provided, verify it exists
    if (gangId) {
      const gang = await Gang.findById(gangId);
      if (!gang) {
        return res.status(404).json({
          success: false,
          message: "Gang not found",
        });
      }
    }

    const worker = await Worker.create({
      name,
      designation,
      dailySalary,
      gangId: gangId || null,
      phoneNumber,
      address,
      userId,
      currentGangId: gangId || null,
    });

    // Populate gang info in response
    await worker.populate("gangId", "gangName teamHead");

    res.status(201).json({
      success: true,
      message: "Worker created successfully",
      data: worker,
    });
  } catch (error) {
    console.error("Error creating worker:", error);
    res.status(500).json({
      success: false,
      message: "Error creating worker",
      error: error.message,
    });
  }
});

// @route   PUT /api/workers/:id
// @desc    Update a worker
// @access  Private
router.put("/:id", async (req, res) => {
  try {
    const { name, designation, dailySalary, gangId } = req.body;

    const worker = await Worker.findById(req.params.id);

    if (!worker) {
      return res.status(404).json({
        success: false,
        message: "Worker not found",
      });
    }

    // If gangId is being updated, verify it exists
    if (gangId !== undefined && gangId !== null) {
      const gang = await Gang.findById(gangId);
      if (!gang) {
        return res.status(404).json({
          success: false,
          message: "Gang not found",
        });
      }
    }

    // Update fields
    if (name) worker.name = name;
    if (designation) worker.designation = designation;
    if (dailySalary !== undefined) worker.dailySalary = dailySalary;
    if (gangId !== undefined) {
      worker.gangId = gangId;
      worker.currentGangId = gangId;
    }

    await worker.save();

    // Populate gang info in response
    await worker.populate("gangId", "gangName teamHead");

    res.status(200).json({
      success: true,
      message: "Worker updated successfully",
      data: worker,
    });
  } catch (error) {
    console.error("Error updating worker:", error);
    res.status(500).json({
      success: false,
      message: "Error updating worker",
      error: error.message,
    });
  }
});

// @route   DELETE /api/workers/:id
// @desc    Delete a worker
// @access  Private
router.delete("/:id", async (req, res) => {
  try {
    const worker = await Worker.findById(req.params.id);

    if (!worker) {
      return res.status(404).json({
        success: false,
        message: "Worker not found",
      });
    }

    await Worker.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: "Worker deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting worker:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting worker",
      error: error.message,
    });
  }
});

// @route   PATCH /api/workers/:id/assign-gang
// @desc    Assign/unassign worker to a gang
// @access  Private
router.patch("/:id/assign-gang", async (req, res) => {
  try {
    const { gangId } = req.body;

    const worker = await Worker.findById(req.params.id);

    if (!worker) {
      return res.status(404).json({
        success: false,
        message: "Worker not found",
      });
    }

    // If gangId is provided, verify it exists
    if (gangId) {
      const gang = await Gang.findById(gangId);
      if (!gang) {
        return res.status(404).json({
          success: false,
          message: "Gang not found",
        });
      }
    }

    worker.gangId = gangId || null;
    worker.currentGangId = gangId || null;
    await worker.save();

    await worker.populate("gangId", "gangName teamHead");

    res.status(200).json({
      success: true,
      message: gangId
        ? "Worker assigned to gang successfully"
        : "Worker unassigned from gang",
      data: worker,
    });
  } catch (error) {
    console.error("Error assigning worker to gang:", error);
    res.status(500).json({
      success: false,
      message: "Error assigning worker to gang",
      error: error.message,
    });
  }
});

// @route   GET /api/workers/unassigned
// @desc    Get all unassigned workers
// @access  Private
router.get("/filter/unassigned", async (req, res) => {
  try {
    const { userId } = req.query;

    const query = { gangId: null };
    if (userId) query.userId = userId;

    const workers = await Worker.find(query).sort({ name: 1 });

    res.status(200).json({
      success: true,
      count: workers.length,
      data: workers,
    });
  } catch (error) {
    console.error("Error fetching unassigned workers:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching unassigned workers",
      error: error.message,
    });
  }
});

module.exports = router;
