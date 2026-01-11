// routes/ratedLabours.js
const express = require("express");
const router = express.Router();
const RatedLabour = require("../models/RatedLabourSchema");
const Project = require("../models/NewProject");
const Admin = require("../models/Register"); // or whatever your admin model file is named
const User = require("../models/User");

const getUserInfo = (req) => {
  return {
    createdBy:
      req.body.createdBy ||
      req.headers["user-id"] ||
      "507f1f77bcf86cd799439011",
    createdByModel:
      req.body.createdByModel ||
      (req.body.createdByType === "admin" ? "Admin" : "User"),
  };
};

// GET /api/rated-labours/projects - Get projects for rated labours dropdown
router.get("/projects", async (req, res) => {
  try {
    const projects = await Project.find({ status: "active" })
      .select("_id projectId projectName location clientName")
      .sort({ projectName: 1 })
      .lean();

    res.json({
      success: true,
      data: projects,
    });
  } catch (error) {
    console.error("Error fetching projects for rated labours:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching projects",
      error: error.message,
    });
  }
});

// GET /api/rated-labours - Get all labour records with optional filters
router.get("/", async (req, res) => {
  try {
    const {
      projectId,
      designation,
      status = "active",
      page = 1,
      limit = 100,
      search,
    } = req.query;

    let query = { status };

    if (projectId) query.project = projectId;
    if (designation) query.designation = designation;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { notes: { $regex: search, $options: "i" } },
      ];
    }

    const total = await RatedLabour.countDocuments(query);

    // Find labours
    let labours = await RatedLabour.find(query)
      .populate("project", "projectName projectId location status")
      .sort({ designation: 1, name: 1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean();

    // Manually populate creator based on createdByModel
    for (let labour of labours) {
      if (labour.createdBy && labour.createdByModel) {
        try {
          const Model = labour.createdByModel === "Admin" ? Admin : User;
          const creator = await Model.findById(labour.createdBy)
            .select("name email color userName")
            .lean();
          
          labour.creator = creator;
          
          console.log(`Labour ${labour.name}:`, {
            createdByModel: labour.createdByModel,
            creatorFound: !!creator,
            creatorColor: creator?.color,
          });
        } catch (err) {
          console.error(`Error populating creator for labour ${labour._id}:`, err);
        }
      }
    }

    const stats = await RatedLabour.getPaymentStats(projectId || null);

    res.json({
      success: true,
      data: labours,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total,
        limit,
      },
      stats,
    });
  } catch (error) {
    console.error("Error fetching labour records:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching labour records",
      error: error.message,
    });
  }
});

// GET /api/rated-labours/stats - Get overall statistics
router.get("/stats", async (req, res) => {
  try {
    const { projectId } = req.query;

    const paymentStats = await RatedLabour.getPaymentStats(projectId || null);
    const designationSummary = await RatedLabour.getDesignationSummary(
      projectId || null
    );

    res.json({
      success: true,
      data: {
        paymentStats,
        designationSummary,
      },
    });
  } catch (error) {
    console.error("Error fetching stats:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching statistics",
      error: error.message,
    });
  }
});

// GET /api/rated-labours/:id - Get single labour record
router.get("/:id", async (req, res) => {
  try {
    const labour = await RatedLabour.findById(req.params.id)
      .populate("project", "projectName projectId location clientName")
      .populate({
        path: "createdBy",
        select: "name email color userName",
      })
      .lean({ virtuals: true });

    if (!labour) {
      return res.status(404).json({
        success: false,
        message: "Labour record not found",
      });
    }

    res.json({
      success: true,
      data: labour,
    });
  } catch (error) {
    console.error("Error fetching labour record:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching labour record",
      error: error.message,
    });
  }
});

// POST /api/rated-labours - Create new labour record
router.post("/", async (req, res) => {
  try {
    const userInfo = getUserInfo(req);

    const {
      designation,
      name,
      projectId,
      salaryGiven,
      autoService,
      workStartDate,
      notes,
    } = req.body;

    if (!designation || !name) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: designation and name",
      });
    }

    if (designation === "auto" && !autoService) {
      return res.status(400).json({
        success: false,
        message: "Auto service is required for auto designation",
      });
    }

    let validProjectId = null;
    if (projectId && projectId !== "000000000000000000000000") {
      const project = await Project.findById(projectId);
      if (!project) {
        return res.status(400).json({
          success: false,
          message: "Invalid project ID",
        });
      }
      validProjectId = projectId;
    }

    const existingLabour = await RatedLabour.findOne({
      name: name.trim(),
      designation: designation,
      status: "active",
    });

    let savedLabour;

    if (existingLabour) {
      if (salaryGiven != null) {
        existingLabour.salaryGiven = Number(salaryGiven);
      }
      existingLabour.autoService =
        designation === "auto" ? autoService : undefined;
      if (validProjectId) {
        existingLabour.project = validProjectId;
      }
      existingLabour.workStartDate = workStartDate
        ? new Date(workStartDate)
        : existingLabour.workStartDate;
      existingLabour.notes = notes?.trim() || existingLabour.notes;

      savedLabour = await existingLabour.save();
      await savedLabour.populate({
        path: "createdBy",
        select: "name email color userName",
      });

      return res.status(200).json({
        success: true,
        message: "Labour record updated successfully",
        data: savedLabour,
        updated: true,
      });
    } else {
      const newLabourData = {
        designation,
        name: name.trim(),
        salaryGiven: salaryGiven ? Number(salaryGiven) : 0,
        autoService: designation === "auto" ? autoService : undefined,
        workStartDate: workStartDate ? new Date(workStartDate) : undefined,
        notes: notes?.trim(),
        ...userInfo,
      };

      if (validProjectId) {
        newLabourData.project = validProjectId;
      }

      const newLabour = new RatedLabour(newLabourData);
      savedLabour = await newLabour.save();
      await savedLabour.populate({
        path: "createdBy",
        select: "name email color userName",
      });

      return res.status(201).json({
        success: true,
        message: "Labour record created successfully",
        data: savedLabour,
        updated: false,
      });
    }
  } catch (error) {
    console.error("Error creating/updating labour record:", error);
    res.status(500).json({
      success: false,
      message: "Error creating/updating labour record",
      error: error.message,
    });
  }
});

// PUT /api/rated-labours/:id - Update labour record
router.put("/:id", async (req, res) => {
  try {
    const {
      designation,
      name,
      projectId,
      salaryGiven,
      autoService,
      workStartDate,
      workEndDate,
      notes,
      status,
    } = req.body;

    const labour = await RatedLabour.findById(req.params.id);
    if (!labour) {
      return res.status(404).json({
        success: false,
        message: "Labour record not found",
      });
    }

    if (projectId && projectId !== "000000000000000000000000") {
      const project = await Project.findById(projectId);
      if (!project) {
        return res.status(400).json({
          success: false,
          message: "Invalid project ID",
        });
      }
      labour.project = projectId;
    }

    if (designation) {
      labour.designation = designation;
      if (designation !== "auto") {
        labour.autoService = undefined;
      }
    }
    if (name) labour.name = name.trim();
    if (salaryGiven != null) labour.salaryGiven = Number(salaryGiven);
    if (autoService && labour.designation === "auto")
      labour.autoService = autoService;
    if (workStartDate) labour.workStartDate = new Date(workStartDate);
    if (workEndDate) labour.workEndDate = new Date(workEndDate);
    if (notes !== undefined) labour.notes = notes?.trim();
    if (status) labour.status = status;

    if (labour.designation === "auto" && !labour.autoService) {
      return res.status(400).json({
        success: false,
        message: "Auto service is required for auto designation",
      });
    }

    const updatedLabour = await labour.save();
    await updatedLabour.populate({
      path: "createdBy",
      select: "name email color userName",
    });

    res.json({
      success: true,
      message: "Labour record updated successfully",
      data: updatedLabour,
    });
  } catch (error) {
    console.error("Error updating labour record:", error);
    res.status(500).json({
      success: false,
      message: "Error updating labour record",
      error: error.message,
    });
  }
});

// DELETE /api/rated-labours/:id - Delete labour record
router.delete("/:id", async (req, res) => {
  try {
    const labour = await RatedLabour.findById(req.params.id);
    if (!labour) {
      return res.status(404).json({
        success: false,
        message: "Labour record not found",
      });
    }

    await RatedLabour.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: "Labour record deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting labour record:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting labour record",
      error: error.message,
    });
  }
});

// GET /api/rated-labours/designation/:designation - Get labours by designation
router.get("/designation/:designation", async (req, res) => {
  try {
    const { designation } = req.params;
    const { projectId } = req.query;

    const labours = await RatedLabour.findByDesignation(designation, projectId);

    res.json({
      success: true,
      data: labours,
    });
  } catch (error) {
    console.error("Error fetching labours by designation:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching labours by designation",
      error: error.message,
    });
  }
});

module.exports = router;
