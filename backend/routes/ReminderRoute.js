const express = require("express");
const router = express.Router();
const Reminder = require("../models/Reminder");
const { protect } = require("../middlewares/auth");

// Apply authentication middleware to all routes
router.use(protect);

// Get all reminders for authenticated user
router.get("/", async (req, res) => {
  try {
    const reminders = await Reminder.find({ userId: req.user._id }).sort({
      reminderDate: 1,
    });
    res.json({
      success: true,
      count: reminders.length,
      data: reminders,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
});

// Create new reminder
router.post("/", async (req, res) => {
  try {
    const { title, description, reminderDate } = req.body;

    if (!title || !reminderDate) {
      return res.status(400).json({
        success: false,
        message: "Please provide title and reminder date",
      });
    }

    const reminder = new Reminder({
      title,
      description,
      reminderDate,
      userId: req.user._id,
    });

    const newReminder = await reminder.save();

    res.status(201).json({
      success: true,
      message: "Reminder created successfully",
      data: newReminder,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: "Failed to create reminder",
      error: error.message,
    });
  }
});

// Update reminder
router.put("/:id", async (req, res) => {
  try {
    const { title, description, reminderDate, isCompleted } = req.body;

    const reminder = await Reminder.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { title, description, reminderDate, isCompleted },
      { new: true, runValidators: true }
    );

    if (!reminder) {
      return res.status(404).json({
        success: false,
        message: "Reminder not found",
      });
    }

    res.json({
      success: true,
      message: "Reminder updated successfully",
      data: reminder,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: "Failed to update reminder",
      error: error.message,
    });
  }
});

// Toggle completion status
router.patch("/:id/toggle", async (req, res) => {
  try {
    const reminder = await Reminder.findOne({
      _id: req.params.id,
      userId: req.user._id,
    });

    if (!reminder) {
      return res.status(404).json({
        success: false,
        message: "Reminder not found",
      });
    }

    reminder.isCompleted = !reminder.isCompleted;
    await reminder.save();

    res.json({
      success: true,
      data: reminder,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
});

// Delete reminder
router.delete("/:id", async (req, res) => {
  try {
    const reminder = await Reminder.findOneAndDelete({
      _id: req.params.id,
      userId: req.user._id,
    });

    if (!reminder) {
      return res.status(404).json({
        success: false,
        message: "Reminder not found",
      });
    }

    res.json({
      success: true,
      message: "Reminder deleted successfully",
      data: { id: req.params.id },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to delete reminder",
      error: error.message,
    });
  }
});

module.exports = router;
