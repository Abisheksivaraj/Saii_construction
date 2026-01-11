// routes/todoRoutes.js
const express = require("express");
const router = express.Router();
const Todo = require("../models/Todo");
const { protect } = require("../middlewares/auth");

// Apply authentication middleware to all routes
router.use(protect);

// Get all todos for authenticated user
router.get("/", async (req, res) => {
  try {
    const todos = await Todo.find({ userId: req.user._id }).sort({
      createdAt: -1,
    });
    res.json({
      success: true,
      count: todos.length,
      data: todos,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
});

// Get single todo
router.get("/:id", async (req, res) => {
  try {
    const todo = await Todo.findOne({
      _id: req.params.id,
      userId: req.user._id,
    });

    if (!todo) {
      return res.status(404).json({
        success: false,
        message: "Todo not found",
      });
    }

    res.json({
      success: true,
      data: todo,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
});

// Create new todo
router.post("/", async (req, res) => {
  try {
    const { title, description, priority, dueDate } = req.body;

    // Validation
    if (!title || title.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "Title is required",
      });
    }

    const todo = new Todo({
      title,
      description,
      priority: priority || "medium",
      dueDate,
      userId: req.user._id,
    });

    const newTodo = await todo.save();

    res.status(201).json({
      success: true,
      message: "Todo created successfully",
      data: newTodo,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: "Failed to create todo",
      error: error.message,
    });
  }
});

// Update todo
router.put("/:id", async (req, res) => {
  try {
    const { title, description, priority, dueDate, completed } = req.body;

    const todo = await Todo.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { title, description, priority, dueDate, completed },
      { new: true, runValidators: true }
    );

    if (!todo) {
      return res.status(404).json({
        success: false,
        message: "Todo not found",
      });
    }

    res.json({
      success: true,
      message: "Todo updated successfully",
      data: todo,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: "Failed to update todo",
      error: error.message,
    });
  }
});

// Toggle todo completion
router.patch("/:id/toggle", async (req, res) => {
  try {
    const todo = await Todo.findOne({
      _id: req.params.id,
      userId: req.user._id,
    });

    if (!todo) {
      return res.status(404).json({
        success: false,
        message: "Todo not found",
      });
    }

    todo.completed = !todo.completed;
    await todo.save();

    res.json({
      success: true,
      message: `Todo marked as ${todo.completed ? "completed" : "incomplete"}`,
      data: todo,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: "Failed to toggle todo",
      error: error.message,
    });
  }
});

// Delete todo
router.delete("/:id", async (req, res) => {
  try {
    const todo = await Todo.findOneAndDelete({
      _id: req.params.id,
      userId: req.user._id,
    });

    if (!todo) {
      return res.status(404).json({
        success: false,
        message: "Todo not found",
      });
    }

    res.json({
      success: true,
      message: "Todo deleted successfully",
      data: { id: req.params.id },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to delete todo",
      error: error.message,
    });
  }
});

// Get todo statistics
router.get("/stats/summary", async (req, res) => {
  try {
    const total = await Todo.countDocuments({ userId: req.user._id });
    const completed = await Todo.countDocuments({
      userId: req.user._id,
      completed: true,
    });
    const pending = total - completed;

    const byPriority = await Todo.aggregate([
      { $match: { userId: req.user._id } },
      { $group: { _id: "$priority", count: { $sum: 1 } } },
    ]);

    res.json({
      success: true,
      data: {
        total,
        completed,
        pending,
        completionRate: total > 0 ? ((completed / total) * 100).toFixed(1) : 0,
        byPriority: byPriority.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {}),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to get statistics",
      error: error.message,
    });
  }
});

module.exports = router;
