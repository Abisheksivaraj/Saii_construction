const express = require("express");
const router = express.Router();
const vendorController = require("../controllers/VendorController");

// Vendor routes
router.get("/", vendorController.getAllVendors);
router.get("/statistics", vendorController.getStatistics);
router.get("/:id", vendorController.getVendorById);
router.post("/", vendorController.createVendorOrAddBill);
router.put("/:id", vendorController.updateVendor);
router.delete("/:id", vendorController.deleteVendor);

// Bill routes
router.post("/:id/bills", vendorController.addBillToVendor);
router.put("/:vendorId/bills/:billId", vendorController.updateBill);
router.delete("/:vendorId/bills/:billId", vendorController.deleteBill);

module.exports = router;
