// routes/projectRoutes.js
const express = require("express");
const router = express.Router();
const Project = require("../models/NewProject");
const mongoose = require("mongoose");
const { protect } = require("../middlewares/auth");

// GET /api/projects - Get all projects with filtering and pagination
router.get("/getProjects", protect, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      clientName,
      createdBy,
      adminId, // NEW: Get all projects under an admin group
      createdByType,
      sortBy = "createdAt",
      sortOrder = "desc",
      search,
    } = req.query;

    // Build filter object
    const filter = {};
    if (status) filter.status = status;
    if (clientName) filter.clientName = new RegExp(clientName, "i");

    // NEW LOGIC: If adminId is provided, get all projects created by admin OR any users under that admin
    if (adminId && mongoose.Types.ObjectId.isValid(adminId)) {
      // Find all users created by this admin
      const User = require("../models/User");
      const usersUnderAdmin = await User.find({ createdBy: adminId }).select(
        "_id"
      );
      const userIds = usersUnderAdmin.map((u) => u._id);

      // Include the admin's own ID
      const allUserIds = [adminId, ...userIds];

      console.log(`Fetching projects for admin group ${adminId}:`, allUserIds);

      // Filter projects created by admin OR any of their users
      filter.createdBy = { $in: allUserIds };
    }
    // OLD LOGIC: Direct createdBy filter (kept for backward compatibility)
    else if (createdBy && mongoose.Types.ObjectId.isValid(createdBy)) {
      filter.createdBy = createdBy;
    }

    // Handle createdByType separately if needed
    if (createdByType) {
      const normalizedType =
        createdByType.toLowerCase() === "admin" ? "admin" : "user";
      filter.createdByType = normalizedType;
    }

    if (search) {
      filter.$or = [
        { projectName: new RegExp(search, "i") },
        { location: new RegExp(search, "i") },
        { projectId: new RegExp(search, "i") },
      ];
    }

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === "desc" ? -1 : 1;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // UPDATED: Populate createdBy field with user/admin details including color
    const [projects, total] = await Promise.all([
      Project.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .populate({
          path: "createdBy",
          select:
            "userName email color userType user MobileNumber FullName CompanyName",
        })
        .lean(),
      Project.countDocuments(filter),
    ]);

    // Transform projects to include 'creator' field for frontend compatibility
    console.log("=== PROJECTS DEBUG ===");
    console.log("Total projects found:", projects.length);
    if (projects.length > 0) {
      console.log("First project creator:", {
        _id: projects[0].createdBy?._id,
        userName: projects[0].createdBy?.userName,
        color: projects[0].createdBy?.color,
        userType: projects[0].createdBy?.userType,
      });
    }
    console.log("===================");

    const transformedProjects = projects.map((project) => ({
      ...project,
      creator: project.createdBy,
    }));

    console.log(
      `Fetched ${transformedProjects.length} projects with creator info`
    );

    // Log first project's creator info for debugging
    if (transformedProjects.length > 0 && transformedProjects[0].creator) {
      console.log("Sample creator info:", {
        id: transformedProjects[0].creator._id,
        userName: transformedProjects[0].creator.userName,
        color: transformedProjects[0].creator.color,
      });
    }

    res.json({
      success: true,
      data: {
        projects: transformedProjects,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / parseInt(limit)),
          totalProjects: total,
          hasNextPage: skip + projects.length < total,
          hasPrevPage: parseInt(page) > 1,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching projects:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching projects",
      error: error.message,
    });
  }
});

// GET /api/projects/dropdown - Get projects for dropdown (only essential fields)
router.get("/dropdown", protect, async (req, res) => {
  try {
    const { status = "active" } = req.query;

    const filter = { status };

    const projects = await Project.find(filter)
      .select("_id projectId projectName location clientName")
      .sort({ projectName: 1 })
      .lean();

    res.json({
      success: true,
      data: projects,
    });
  } catch (error) {
    console.error("Error fetching projects for dropdown:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching projects for dropdown",
      error: error.message,
    });
  }
});

// GET /api/projects/stats/overview - Get project statistics
router.get("/stats/overview", protect, async (req, res) => {
  try {
    const [totalProjects, activeProjects, completedProjects, totalValue] =
      await Promise.all([
        Project.countDocuments(),
        Project.countDocuments({ status: "active" }),
        Project.countDocuments({ status: "completed" }),
        Project.aggregate([
          { $group: { _id: null, total: { $sum: "$projectValue" } } },
        ]),
      ]);

    res.json({
      success: true,
      data: {
        totalProjects,
        activeProjects,
        completedProjects,
        totalValue: totalValue[0]?.total || 0,
        averageValue:
          totalProjects > 0 ? (totalValue[0]?.total || 0) / totalProjects : 0,
      },
    });
  } catch (error) {
    console.error("Error fetching project statistics:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching project statistics",
      error: error.message,
    });
  }
});

// GET /api/projects/generate-id - Generate new project ID
router.get("/generate-id", protect, async (req, res) => {
  try {
    const { companyCode = "SF" } = req.query;
    const projectId = await Project.generateProjectId(companyCode);

    res.json({
      success: true,
      data: { projectId },
    });
  } catch (error) {
    console.error("Error generating project ID:", error);
    res.status(500).json({
      success: false,
      message: "Error generating project ID",
      error: error.message,
    });
  }
});

// GET /api/projects/by-client/:clientName - Get projects by client
router.get("/by-client/:clientName", protect, async (req, res) => {
  try {
    const { clientName } = req.params;
    const { page = 1, limit = 10, status } = req.query;

    const filter = { clientName: new RegExp(clientName, "i") };
    if (status) filter.status = status;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [projects, total] = await Promise.all([
      Project.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate({
          path: "createdBy",
          select: "userName email color userType",
        }),
      Project.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: {
        projects,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / parseInt(limit)),
          totalProjects: total,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching projects by client:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching projects by client",
      error: error.message,
    });
  }
});

// GET /api/projects/:id - Get single project by ID
router.get("/:id", protect, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if it's a valid ObjectId or projectId
    let project;
    if (mongoose.Types.ObjectId.isValid(id)) {
      project = await Project.findById(id).populate({
        path: "createdBy",
        select: "userName email color userType",
      });
    } else {
      project = await Project.findOne({ projectId: id }).populate({
        path: "createdBy",
        select: "userName email color userType",
      });
    }

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found",
      });
    }

    res.json({
      success: true,
      data: project,
    });
  } catch (error) {
    console.error("Error fetching project:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching project",
      error: error.message,
    });
  }
});

// POST /api/projects/new - Create new project (admin only)
// POST /api/projects/new
router.post("/new", protect, async (req, res) => {
  try {
    const {
      projectName,
      location,
      clientName,
      projectValue,
      status,
      createdBy,
      createdByType,
    } = req.body;

    console.log("Received project data:", req.body);

    // Validate required fields
    if (
      !projectName ||
      !location ||
      !clientName ||
      !projectValue ||
      !createdBy ||
      !createdByType
    ) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields",
        receivedFields: Object.keys(req.body),
      });
    }

    // Normalize createdByType to capitalized model name
    const normalizedCreatedByType =
      createdByType.toLowerCase() === "admin" ? "Admin" : "User";

    // Validate projectValue
    const numericProjectValue = Number(projectValue);
    if (isNaN(numericProjectValue) || numericProjectValue < 0) {
      return res.status(400).json({
        success: false,
        message: "Project value must be a valid positive number",
      });
    }

    console.log("Creating project with data:", {
      projectName,
      location,
      clientName,
      projectValue: numericProjectValue,
      status: status || "active",
      createdBy: createdBy,
      createdByType: normalizedCreatedByType,
    });

    // Use the static method to create project
    const project = await Project.createProject(
      {
        projectName: projectName.trim(),
        location: location.trim(),
        clientName: clientName.trim(),
        projectValue: numericProjectValue,
        status: status || "active",
      },
      createdBy,
      normalizedCreatedByType
    );

    // Populate the creator information before sending response
    await project.populate({
      path: "createdBy",
      select: "userName email color userType user MobileNumber",
    });

    console.log("Project created successfully with creator info:", {
      projectId: project._id,
      creator: project.createdBy,
    });

    res.status(201).json({
      success: true,
      message: "Project created successfully",
      data: project,
    });
  } catch (error) {
    console.error("Error creating project:", error);

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Project ID already exists",
      });
    }

    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: Object.values(error.errors).map((e) => e.message),
      });
    }

    res.status(500).json({
      success: false,
      message: "Error creating project",
      error: error.message,
    });
  }
});

// PUT /api/projects/:id - Update project (admin only)
router.put("/:id", protect, async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Remove fields that shouldn't be updated
    delete updateData.projectId;
    delete updateData.createdBy;
    delete updateData.createdByType;
    delete updateData.createdAt;

    // Validate projectValue if provided
    if (updateData.projectValue !== undefined && updateData.projectValue < 0) {
      return res.status(400).json({
        success: false,
        message: "Project value cannot be negative",
      });
    }

    // Validate status if provided
    if (
      updateData.status &&
      !["active", "completed"].includes(updateData.status)
    ) {
      return res.status(400).json({
        success: false,
        message: "Status must be either 'active' or 'completed'",
      });
    }

    let project;
    if (mongoose.Types.ObjectId.isValid(id)) {
      project = await Project.findByIdAndUpdate(
        id,
        { ...updateData, updatedAt: Date.now() },
        { new: true, runValidators: true }
      ).populate({
        path: "createdBy",
        select: "userName email color userType",
      });
    } else {
      project = await Project.findOneAndUpdate(
        { projectId: id },
        { ...updateData, updatedAt: Date.now() },
        { new: true, runValidators: true }
      ).populate({
        path: "createdBy",
        select: "userName email color userType",
      });
    }

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found",
      });
    }

    res.json({
      success: true,
      message: "Project updated successfully",
      data: project,
    });
  } catch (error) {
    console.error("Error updating project:", error);
    res.status(500).json({
      success: false,
      message: "Error updating project",
      error: error.message,
    });
  }
});

// DELETE /api/projects/:id - Delete project (admin only)
router.delete("/:id", protect, async (req, res) => {
  try {
    const { id } = req.params;

    let project;
    if (mongoose.Types.ObjectId.isValid(id)) {
      project = await Project.findByIdAndDelete(id);
    } else {
      project = await Project.findOneAndDelete({ projectId: id });
    }

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found",
      });
    }

    res.json({
      success: true,
      message: "Project deleted successfully",
      data: project,
    });
  } catch (error) {
    console.error("Error deleting project:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting project",
      error: error.message,
    });
  }
});

// GET /api/projects/:id/creator - Get creator details
router.get("/:id/creator", protect, async (req, res) => {
  try {
    const { id } = req.params;

    let project;
    if (mongoose.Types.ObjectId.isValid(id)) {
      project = await Project.findById(id);
    } else {
      project = await Project.findOne({ projectId: id });
    }

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found",
      });
    }

    const creator = await project.getCreatorDetails();

    if (!creator) {
      return res.status(404).json({
        success: false,
        message: "Creator not found",
      });
    }

    res.json({
      success: true,
      data: {
        creatorType: project.createdByType,
        creator,
      },
    });
  } catch (error) {
    console.error("Error fetching creator details:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching creator details",
      error: error.message,
    });
  }
});

module.exports = router;
