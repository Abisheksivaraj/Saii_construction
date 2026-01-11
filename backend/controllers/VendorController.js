// controllers/vendorController.js
const Vendor = require("../models/Vendor");
const Admin = require("../models/Register"); // Adjust to your actual Admin model path
const User = require("../models/User"); // Adjust to your actual User model path

// Helper function to get user info
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

// Helper function to populate creator
const populateCreator = async (item) => {
  if (item.createdBy && item.createdByModel) {
    try {
      const Model = item.createdByModel === "Admin" ? Admin : User;
      const creator = await Model.findById(item.createdBy)
        .select("name email color userName")
        .lean();

      console.log(`Populating creator for item:`, {
        itemId: item._id,
        createdByModel: item.createdByModel,
        creatorFound: !!creator,
        creatorColor: creator?.color,
      });

      return { ...item, creator };
    } catch (err) {
      console.error("Error populating creator:", err);
      return item;
    }
  }
  return item;
};

// Get all vendors
exports.getAllVendors = async (req, res) => {
  try {
    let vendors = await Vendor.find()
      .select("-bills.billImage")
      .sort({ createdAt: -1 })
      .lean();

    console.log("=== GET ALL VENDORS ===");
    console.log("Total vendors found:", vendors.length);

    // Populate creator for each vendor
    vendors = await Promise.all(
      vendors.map(async (vendor) => {
        const vendorWithCreator = await populateCreator(vendor);
        return vendorWithCreator;
      })
    );

    console.log("Vendors after creator population:", vendors.length);
    vendors.forEach((v, i) => {
      console.log(`Vendor ${i + 1}: ${v.name}`, {
        hasCreator: !!v.creator,
        creatorColor: v.creator?.color,
      });
    });

    res.status(200).json({
      success: true,
      count: vendors.length,
      data: vendors,
    });
  } catch (error) {
    console.error("Error in getAllVendors:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching vendors",
      error: error.message,
    });
  }
};

// Get single vendor by ID
exports.getVendorById = async (req, res) => {
  try {
    console.log("=== GET VENDOR BY ID ===");
    console.log("Fetching vendor with ID:", req.params.id);

    let vendor = await Vendor.findById(req.params.id).lean();

    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: "Vendor not found",
      });
    }

    console.log("Vendor found:", vendor.name);
    console.log("Vendor createdBy:", vendor.createdBy);
    console.log("Vendor createdByModel:", vendor.createdByModel);

    // Populate vendor creator
    vendor = await populateCreator(vendor);

    console.log("Vendor creator populated:", {
      hasCreator: !!vendor.creator,
      creatorColor: vendor.creator?.color,
    });

    // Populate creator for each bill
    if (vendor.bills && vendor.bills.length > 0) {
      console.log("Populating creators for", vendor.bills.length, "bills");

      vendor.bills = await Promise.all(
        vendor.bills.map(async (bill) => {
          console.log("Processing bill:", bill._id);
          console.log("Bill createdBy:", bill.createdBy);
          console.log("Bill createdByModel:", bill.createdByModel);

          const billWithCreator = await populateCreator(bill);

          console.log("Bill creator populated:", {
            billId: bill._id,
            hasCreator: !!billWithCreator.creator,
            creatorColor: billWithCreator.creator?.color,
          });

          return billWithCreator;
        })
      );
    }

    console.log("Final vendor data being sent to frontend");

    res.status(200).json({
      success: true,
      data: vendor,
    });
  } catch (error) {
    console.error("Error in getVendorById:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching vendor",
      error: error.message,
    });
  }
};

// Create new vendor or add bill to existing vendor
exports.createVendorOrAddBill = async (req, res) => {
  try {
    const { name, description, mobileNumber, bill } = req.body;
    const userInfo = getUserInfo(req);

    console.log("=== CREATE VENDOR OR ADD BILL ===");
    console.log("User info:", userInfo);

    if (!name || !description || !mobileNumber || !bill) {
      return res.status(400).json({
        success: false,
        message: "Please provide all required fields",
      });
    }

    // Add creator info to bill
    const billWithCreator = {
      ...bill,
      createdBy: userInfo.createdBy,
      createdByModel: userInfo.createdByModel,
    };

    console.log("Bill with creator info:", {
      createdBy: billWithCreator.createdBy,
      createdByModel: billWithCreator.createdByModel,
    });

    let vendor = await Vendor.findOne({
      name: { $regex: new RegExp(`^${name.trim()}$`, "i") },
    });

    if (vendor) {
      console.log("Adding bill to existing vendor:", vendor.name);
      // Add new bill to existing vendor
      vendor.bills.push(billWithCreator);
      vendor.mobileNumber = mobileNumber;
      vendor.description = description;
      await vendor.save();

      console.log("Bill added successfully");

      return res.status(200).json({
        success: true,
        message: "Bill added to existing vendor",
        data: vendor,
      });
    }

    console.log("Creating new vendor");
    // Create new vendor with creator info
    vendor = await Vendor.create({
      name: name.trim(),
      description: description.trim(),
      mobileNumber,
      bills: [billWithCreator],
      createdBy: userInfo.createdBy,
      createdByModel: userInfo.createdByModel,
    });

    console.log("Vendor created successfully:", {
      vendorId: vendor._id,
      createdBy: vendor.createdBy,
      createdByModel: vendor.createdByModel,
    });

    res.status(201).json({
      success: true,
      message: "Vendor created successfully",
      data: vendor,
    });
  } catch (error) {
    console.error("Error in createVendorOrAddBill:", error);
    res.status(500).json({
      success: false,
      message: "Error creating vendor",
      error: error.message,
    });
  }
};

// Update vendor details (not bills)
exports.updateVendor = async (req, res) => {
  try {
    const { name, description, mobileNumber } = req.body;

    const vendor = await Vendor.findByIdAndUpdate(
      req.params.id,
      { name, description, mobileNumber },
      { new: true, runValidators: true }
    );

    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: "Vendor not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Vendor updated successfully",
      data: vendor,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error updating vendor",
      error: error.message,
    });
  }
};

// Delete vendor
exports.deleteVendor = async (req, res) => {
  try {
    const vendor = await Vendor.findByIdAndDelete(req.params.id);

    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: "Vendor not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Vendor deleted successfully",
      data: {},
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error deleting vendor",
      error: error.message,
    });
  }
};

// Add bill to existing vendor
exports.addBillToVendor = async (req, res) => {
  try {
    const { bill } = req.body;
    const userInfo = getUserInfo(req);

    if (!bill) {
      return res.status(400).json({
        success: false,
        message: "Bill data is required",
      });
    }

    const vendor = await Vendor.findById(req.params.id);

    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: "Vendor not found",
      });
    }

    // Add creator info to bill
    const billWithCreator = {
      ...bill,
      createdBy: userInfo.createdBy,
      createdByModel: userInfo.createdByModel,
    };

    vendor.bills.push(billWithCreator);
    await vendor.save();

    res.status(200).json({
      success: true,
      message: "Bill added successfully",
      data: vendor,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error adding bill",
      error: error.message,
    });
  }
};

// Update specific bill
exports.updateBill = async (req, res) => {
  try {
    const { vendorId, billId } = req.params;
    const billData = req.body;

    const vendor = await Vendor.findById(vendorId);

    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: "Vendor not found",
      });
    }

    const bill = vendor.bills.id(billId);

    if (!bill) {
      return res.status(404).json({
        success: false,
        message: "Bill not found",
      });
    }

    Object.assign(bill, billData);
    await vendor.save();

    res.status(200).json({
      success: true,
      message: "Bill updated successfully",
      data: vendor,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error updating bill",
      error: error.message,
    });
  }
};

// Delete specific bill
exports.deleteBill = async (req, res) => {
  try {
    const { vendorId, billId } = req.params;

    const vendor = await Vendor.findById(vendorId);

    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: "Vendor not found",
      });
    }

    vendor.bills.pull(billId);

    if (vendor.bills.length === 0) {
      await Vendor.findByIdAndDelete(vendorId);
      return res.status(200).json({
        success: true,
        message: "Bill deleted and vendor removed (no bills remaining)",
        data: {},
      });
    }

    await vendor.save();

    res.status(200).json({
      success: true,
      message: "Bill deleted successfully",
      data: vendor,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error deleting bill",
      error: error.message,
    });
  }
};

// Get statistics
exports.getStatistics = async (req, res) => {
  try {
    const vendors = await Vendor.find().select("-bills.billImage");

    const stats = {
      totalVendors: vendors.length,
      totalBillAmount: vendors.reduce((sum, v) => sum + v.totalAmount, 0),
      totalPaid: vendors.reduce((sum, v) => sum + v.totalPaid, 0),
      totalBalance: vendors.reduce((sum, v) => sum + v.totalBalance, 0),
      totalBills: vendors.reduce((sum, v) => sum + v.bills.length, 0),
    };

    res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error("Error in getStatistics:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching statistics",
      error: error.message,
    });
  }
};
