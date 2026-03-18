const express = require("express");
const router = express.Router();
const Expense = require("../models/Expense");
const { protect } = require("../middlewares/auth");

// Apply authentication middleware to all routes
router.use(protect);

// Get all expenses for authenticated user
router.get("/", async (req, res) => {
  try {
    const expenses = await Expense.find({ userId: req.user._id }).sort({
      date: -1,
    });
    res.json({
      success: true,
      count: expenses.length,
      data: expenses,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
});

// Create new expense
router.post("/", async (req, res) => {
  try {
    const { amount, description, category, date } = req.body;

    if (!amount || !description || !category) {
      return res.status(400).json({
        success: false,
        message: "Please provide amount, description, and category",
      });
    }

    const expense = new Expense({
      amount,
      description,
      category,
      date,
      userId: req.user._id,
    });

    const newExpense = await expense.save();

    res.status(201).json({
      success: true,
      message: "Expense created successfully",
      data: newExpense,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: "Failed to create expense",
      error: error.message,
    });
  }
});

// Update expense
router.put("/:id", async (req, res) => {
  try {
    const { amount, description, category, date } = req.body;

    const expense = await Expense.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { amount, description, category, date },
      { new: true, runValidators: true }
    );

    if (!expense) {
      return res.status(404).json({
        success: false,
        message: "Expense not found",
      });
    }

    res.json({
      success: true,
      message: "Expense updated successfully",
      data: expense,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: "Failed to update expense",
      error: error.message,
    });
  }
});

// Delete expense
router.delete("/:id", async (req, res) => {
  try {
    const expense = await Expense.findOneAndDelete({
      _id: req.params.id,
      userId: req.user._id,
    });

    if (!expense) {
      return res.status(404).json({
        success: false,
        message: "Expense not found",
      });
    }

    res.json({
      success: true,
      message: "Expense deleted successfully",
      data: { id: req.params.id },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to delete expense",
      error: error.message,
    });
  }
});

module.exports = router;
