const express = require("express");
const router = express.Router();
const Quotation = require("../models/Quotation");
const Project = require("../models/NewProject"); // Add this import
const mongoose = require("mongoose");

router.get("/", async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      projectId,
      createdBy,
      startDate,
      endDate,
      sortBy = "date",
      sortOrder = "desc",
    } = req.query;

    // Build filter object
    const filter = {};

    if (projectId) filter.projectId = projectId;
    if (createdBy) filter.createdBy = createdBy;

    // Date range filter
    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate) filter.date.$lte = new Date(endDate);
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === "desc" ? -1 : 1;

    // Execute query with pagination and populate createdBy with color
    const quotations = await Quotation.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .populate("createdBy", "name email color userName"); // Add color field

    // Get total count for pagination
    const total = await Quotation.countDocuments(filter);

    res.json({
      quotations,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        total,
        limit: parseInt(limit),
      },
    });
  } catch (error) {
    console.error("Error fetching quotations:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const quotation = await Quotation.findById(req.params.id).populate(
      "createdBy",
      "name email color userName"
    ); // Add color field

    if (!quotation) {
      return res.status(404).json({ message: "Quotation not found" });
    }

    res.json(quotation);
  } catch (error) {
    console.error("Error fetching quotation:", error);
    if (error.name === "CastError") {
      return res.status(400).json({ message: "Invalid quotation ID" });
    }
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

router.post("/", async (req, res) => {
  try {
    console.log("Received quotation data:", req.body);

    const {
      projectId,
      description,
      quantity,
      unit,
      price,
      date,
      createdBy,
      createdByModel, // Add this
    } = req.body;

    // Validation
    if (
      !projectId ||
      !description ||
      quantity === undefined ||
      !unit ||
      price === undefined ||
      !createdBy
    ) {
      return res.status(400).json({
        message:
          "Please provide all required fields: projectId, description, quantity, unit, price, createdBy",
      });
    }

    if (quantity <= 0 || price < 0) {
      return res.status(400).json({
        message:
          "Quantity must be greater than 0 and price must be non-negative",
      });
    }

    // Validate that createdBy is a valid ObjectId
    if (!mongoose.Types.ObjectId.isValid(createdBy)) {
      return res.status(400).json({
        message: "Invalid createdBy ID format",
      });
    }

    // Auto-detect model type if not provided
    let modelType = createdByModel || "User";

    if (!createdByModel) {
      // Try to find in Admin model
      const Admin = require("../models/Admin");
      const admin = await Admin.findById(createdBy);

      if (admin) {
        modelType = "Admin";
      } else {
        modelType = "User";
      }
    }

    // Create quotation
    const quotationData = {
      projectId: projectId.toString(),
      description: description.trim(),
      quantity: parseFloat(quantity),
      unit: unit.trim(),
      price: parseFloat(price),
      createdBy: createdBy,
      createdByModel: modelType, // Set the model type
    };

    if (date) {
      quotationData.date = new Date(date);
    }

    console.log("Creating quotation with data:", quotationData);

    const quotation = new Quotation(quotationData);
    await quotation.save();

    // Populate the creator info before sending response
    const populatedQuotation = await Quotation.findById(quotation._id).populate(
      "createdBy",
      "name email color userName"
    );

    console.log("Quotation saved successfully:", populatedQuotation);
    console.log("Creator color:", populatedQuotation.createdBy?.color);

    res.status(201).json({
      message: "Quotation created successfully",
      quotation: populatedQuotation,
    });
  } catch (error) {
    console.error("Error creating quotation:", error);
    console.error("Error details:", error.message);
    console.error("Error stack:", error.stack);

    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((err) => err.message);
      return res
        .status(400)
        .json({ message: "Validation error", errors: messages });
    }

    if (error.name === "CastError") {
      return res.status(400).json({
        message: "Invalid data format",
        error: error.message,
      });
    }

    res.status(500).json({ message: "Server error", error: error.message });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const { projectId, description, quantity, unit, price, date, createdBy } =
      req.body;

    const quotation = await Quotation.findById(req.params.id);

    if (!quotation) {
      return res.status(404).json({ message: "Quotation not found" });
    }

    // Validation for updated fields
    if (quantity !== undefined && quantity <= 0) {
      return res
        .status(400)
        .json({ message: "Quantity must be greater than 0" });
    }
    if (price !== undefined && price < 0) {
      return res.status(400).json({ message: "Price must be non-negative" });
    }

    // Update fields
    const updateData = {};
    if (projectId !== undefined) updateData.projectId = projectId.toString();
    if (description !== undefined) updateData.description = description.trim();
    if (quantity !== undefined) updateData.quantity = parseFloat(quantity);
    if (unit !== undefined) updateData.unit = unit.trim();
    if (price !== undefined) updateData.price = parseFloat(price);
    if (date !== undefined) updateData.date = new Date(date);
    if (createdBy !== undefined) updateData.createdBy = createdBy;

    const updatedQuotation = await Quotation.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    ).populate("createdBy", "name email color userName"); // Add color field

    res.json({
      message: "Quotation updated successfully",
      quotation: updatedQuotation,
    });
  } catch (error) {
    console.error("Error updating quotation:", error);
    if (error.name === "CastError") {
      return res.status(400).json({ message: "Invalid quotation ID" });
    }
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((err) => err.message);
      return res
        .status(400)
        .json({ message: "Validation error", errors: messages });
    }
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const quotation = await Quotation.findById(req.params.id);

    if (!quotation) {
      return res.status(404).json({ message: "Quotation not found" });
    }

    await Quotation.findByIdAndDelete(req.params.id);

    res.json({ message: "Quotation deleted successfully" });
  } catch (error) {
    console.error("Error deleting quotation:", error);
    if (error.name === "CastError") {
      return res.status(400).json({ message: "Invalid quotation ID" });
    }
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// @desc    Get all quotations for a specific project
// @access  Public
router.get("/project/:projectId", async (req, res) => {
  try {
    const { projectId } = req.params;
    const { page = 1, limit = 50 } = req.query;

    console.log("Fetching quotations for projectId:", projectId);

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Populate createdBy with color field
    const quotations = await Quotation.find({ projectId: projectId })
      .sort({ date: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate("createdBy", "name email color userName"); // Add color field

    console.log("Found quotations:", quotations.length);

    // Log creator info for debugging
    quotations.forEach((quotation) => {
      console.log(`Quotation ${quotation._id} creator:`, {
        id: quotation.createdBy?._id,
        userName: quotation.createdBy?.userName,
        color: quotation.createdBy?.color,
      });
    });

    const total = await Quotation.countDocuments({ projectId: projectId });

    // Calculate project totals
    const projectTotals = await Quotation.aggregate([
      { $match: { projectId: projectId } },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: "$total" },
          totalItems: { $sum: 1 },
        },
      },
    ]);

    console.log("Project totals:", projectTotals);

    res.json({
      quotations,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        total,
        limit: parseInt(limit),
      },
      summary: projectTotals[0] || { totalAmount: 0, totalItems: 0 },
    });
  } catch (error) {
    console.error("Error fetching project quotations:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

router.get("/stats/summary", async (req, res) => {
  try {
    const stats = await Quotation.aggregate([
      {
        $group: {
          _id: null,
          totalQuotations: { $sum: 1 },
          totalValue: { $sum: "$total" },
          averageValue: { $avg: "$total" },
          minValue: { $min: "$total" },
          maxValue: { $max: "$total" },
        },
      },
    ]);

    // Monthly breakdown for the current year
    const monthlyStats = await Quotation.aggregate([
      {
        $match: {
          date: {
            $gte: new Date(new Date().getFullYear(), 0, 1),
            $lt: new Date(new Date().getFullYear() + 1, 0, 1),
          },
        },
      },
      {
        $group: {
          _id: {
            month: { $month: "$date" },
            year: { $year: "$date" },
          },
          count: { $sum: 1 },
          totalValue: { $sum: "$total" },
        },
      },
      { $sort: { "_id.month": 1 } },
    ]);

    res.json({
      summary: stats[0] || {
        totalQuotations: 0,
        totalValue: 0,
        averageValue: 0,
        minValue: 0,
        maxValue: 0,
      },
      monthlyBreakdown: monthlyStats,
    });
  } catch (error) {
    console.error("Error fetching quotation stats:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

module.exports = router;
