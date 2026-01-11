// models/NewProject.js
const mongoose = require("mongoose");

const projectSchema = new mongoose.Schema(
  {
    projectId: {
      type: String,
      required: true,
      unique: true,
    },
    projectName: {
      type: String,
      required: true,
    },
    location: {
      type: String,
      required: true,
    },
    clientName: {
      type: String,
      required: true,
    },
    projectValue: {
      type: Number,
      required: true,
      min: 0,
    },
    status: {
      type: String,
      enum: ["active", "completed"],
      default: "active",
    },
    createdByType: {
      type: String,
      enum: ["Admin", "User"], // CHANGED: Use capitalized model names
      required: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      refPath: "createdByType", // CRITICAL: Dynamic reference based on createdByType
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Index for better query performance
projectSchema.index({ projectId: 1 });
projectSchema.index({ createdBy: 1, createdByType: 1 });
projectSchema.index({ status: 1 });

// Static method to generate project ID
projectSchema.statics.generateProjectId = async function (
  companyCode = "SAII"
) {
  const year = new Date().getFullYear();
  const count = await this.countDocuments({
    projectId: new RegExp(`^${year}-${companyCode}-`),
  });
  const serial = (count + 1).toString().padStart(3, "0");
  return `${year}-${companyCode}-${serial}`;
};

// Static method to create project
projectSchema.statics.createProject = async function (
  projectData,
  creatorId,
  creatorType
) {
  try {
    const projectId = await this.generateProjectId();

    // Normalize to proper model name (capitalized)
    const normalizedCreatorType =
      creatorType.toLowerCase() === "admin" ? "Admin" : "User";

    const project = new this({
      ...projectData,
      projectId,
      createdBy: creatorId,
      createdByType: normalizedCreatorType,
    });

    return await project.save();
  } catch (error) {
    console.error("Error in createProject:", error);
    throw error;
  }
};

// Method to get creator details
projectSchema.methods.getCreatorDetails = async function () {
  try {
    const CreatorModel = mongoose.model(this.createdByType);
    return await CreatorModel.findById(this.createdBy).select(
      "userName email color userType MobileNumber"
    );
  } catch (error) {
    console.error("Error getting creator details:", error);
    return null;
  }
};

module.exports = mongoose.model("Project", projectSchema);
