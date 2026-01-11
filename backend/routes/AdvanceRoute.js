const express = require("express");
const router = express.Router();
const Advance = require("../models/Advance"); // Update with your actual model path
const Worker = require("../models/workerModel");

// @route   GET /api/advances
// @desc    Get all advances with populated worker data
// @access  Private
router.get("/", async (req, res) => {
  try {
    const { workerId, isPaid, userId } = req.query;

    const query = {};
    if (workerId) query.workerId = workerId;
    if (isPaid !== undefined) query.isPaid = isPaid === "true";
    if (userId) query.userId = userId;

    // CRITICAL: Populate workerId with worker details
    const advances = await Advance.find(query)
      .populate("workerId", "name designation dailySalary _id")
      .sort({ date: -1 });

    res.status(200).json({
      success: true,
      count: advances.length,
      data: advances,
    });
  } catch (error) {
    console.error("Error fetching advances:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching advances",
      error: error.message,
    });
  }
});

// @route   GET /api/advances/:id
// @desc    Get single advance by ID
// @access  Private
router.get("/:id", async (req, res) => {
  try {
    const advance = await Advance.findById(req.params.id).populate(
      "workerId",
      "name designation dailySalary _id"
    );

    if (!advance) {
      return res.status(404).json({
        success: false,
        message: "Advance not found",
      });
    }

    res.status(200).json({
      success: true,
      data: advance,
    });
  } catch (error) {
    console.error("Error fetching advance:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching advance",
      error: error.message,
    });
  }
});

// @route   POST /api/advances
// @desc    Create a new advance
// @access  Private
router.post("/", async (req, res) => {
  try {
    const { workerId, amount, description, date, userId } = req.body;

    // Validation
    if (!workerId || !amount) {
      return res.status(400).json({
        success: false,
        message: "Worker ID and amount are required",
      });
    }

    // Verify worker exists
    const worker = await Worker.findById(workerId);
    if (!worker) {
      return res.status(404).json({
        success: false,
        message: "Worker not found",
      });
    }

    // Create advance
    const advance = await Advance.create({
      workerId,
      amount: parseFloat(amount),
      description: description || "",
      date: date || new Date(),
      userId,
      isPaid: false,
    });

    // Populate worker data before sending response
    await advance.populate("workerId", "name designation dailySalary _id");

    res.status(201).json({
      success: true,
      message: "Advance created successfully",
      data: advance,
    });
  } catch (error) {
    console.error("Error creating advance:", error);
    res.status(500).json({
      success: false,
      message: "Error creating advance",
      error: error.message,
    });
  }
});

// @route   PUT /api/advances/:id
// @desc    Update an advance
// @access  Private
router.put("/:id", async (req, res) => {
  try {
    const { amount, description } = req.body;

    const advance = await Advance.findById(req.params.id);

    if (!advance) {
      return res.status(404).json({
        success: false,
        message: "Advance not found",
      });
    }

    // Update fields
    if (amount !== undefined) advance.amount = parseFloat(amount);
    if (description !== undefined) advance.description = description;

    await advance.save();

    // Populate worker data
    await advance.populate("workerId", "name designation dailySalary _id");

    res.status(200).json({
      success: true,
      message: "Advance updated successfully",
      data: advance,
    });
  } catch (error) {
    console.error("Error updating advance:", error);
    res.status(500).json({
      success: false,
      message: "Error updating advance",
      error: error.message,
    });
  }
});

// @route   PATCH /api/advances/:id/mark-paid
// @desc    Mark an advance as paid
// @access  Private
router.patch("/:id/mark-paid", async (req, res) => {
  try {
    const advance = await Advance.findById(req.params.id);

    if (!advance) {
      return res.status(404).json({
        success: false,
        message: "Advance not found",
      });
    }

    advance.isPaid = true;
    advance.paidDate = new Date();
    await advance.save();

    // Populate worker data
    await advance.populate("workerId", "name designation dailySalary _id");

    res.status(200).json({
      success: true,
      message: "Advance marked as paid",
      data: advance,
    });
  } catch (error) {
    console.error("Error marking advance as paid:", error);
    res.status(500).json({
      success: false,
      message: "Error marking advance as paid",
      error: error.message,
    });
  }
});

// @route   DELETE /api/advances/:id
// @desc    Delete an advance
// @access  Private
router.delete("/:id", async (req, res) => {
  try {
    const advance = await Advance.findById(req.params.id);

    if (!advance) {
      return res.status(404).json({
        success: false,
        message: "Advance not found",
      });
    }

    await Advance.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: "Advance deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting advance:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting advance",
      error: error.message,
    });
  }
});

// @route   GET /api/advances/worker/:workerId
// @desc    Get all advances for a specific worker
// @access  Private
router.get("/worker/:workerId", async (req, res) => {
  try {
    const advances = await Advance.find({ workerId: req.params.workerId })
      .populate("workerId", "name designation dailySalary _id")
      .sort({ date: -1 });

    // Calculate totals
    const totalAdvances = advances.reduce((sum, adv) => sum + adv.amount, 0);
    const unpaidAdvances = advances
      .filter((adv) => !adv.isPaid)
      .reduce((sum, adv) => sum + adv.amount, 0);

    res.status(200).json({
      success: true,
      count: advances.length,
      data: advances,
      summary: {
        totalAdvances,
        unpaidAdvances,
        paidAdvances: totalAdvances - unpaidAdvances,
      },
    });
  } catch (error) {
    console.error("Error fetching worker advances:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching worker advances",
      error: error.message,
    });
  }
});

module.exports = router;
