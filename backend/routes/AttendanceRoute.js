const express = require("express");
const router = express.Router();
const Attendance = require("../models/Attendance");
const Worker = require("../models/workerModel");

// @route   GET /api/attendance
// @desc    Get attendance records (with optional filters)
// @access  Private
router.get("/", async (req, res) => {
  try {
    const { date, workerId, gangId, status, startDate, endDate } = req.query;

    // Build query
    const query = {};

    if (date) {
      query.date = new Date(date);
    }

    if (workerId) {
      query.workerId = workerId;
    }

    if (gangId) {
      query.gangId = gangId;
    }

    if (status) {
      query.status = status;
    }

    // Date range filtering
    if (startDate && endDate) {
      query.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    } else if (startDate) {
      query.date = { $gte: new Date(startDate) };
    } else if (endDate) {
      query.date = { $lte: new Date(endDate) };
    }

    const attendance = await Attendance.find(query)
      .populate("workerId", "name designation dailySalary")
      .populate("gangId", "gangName teamHead")
      .sort({ date: -1 });

    const totalSalary = attendance.reduce(
      (sum, record) => sum + (record.salary || 0),
      0
    );

    res.json({
      success: true,
      count: attendance.length,
      totalSalary,
      data: attendance,
    });
  } catch (error) {
    console.error("Error fetching attendance:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching attendance records",
      error: error.message,
    });
  }
});

// @route   GET /api/attendance/summary/:date
// @desc    Get attendance summary for a specific date
// @access  Private
router.get("/summary/:date", async (req, res) => {
  try {
    const { date } = req.params;
    const { gangId } = req.query;

    const query = { date: new Date(date) };
    if (gangId) query.gangId = gangId;

    const attendance = await Attendance.find(query).populate(
      "workerId",
      "name designation dailySalary"
    );

    const summary = {
      date,
      totalWorkers: attendance.length,
      present: attendance.filter((a) => a.status === "present").length,
      absent: attendance.filter((a) => a.status === "absent").length,
      halfDay: attendance.filter((a) => a.status === "half-day").length,
      totalSalary: attendance.reduce((sum, a) => sum + (a.salary || 0), 0),
    };

    res.json({
      success: true,
      data: summary,
      records: attendance,
    });
  } catch (error) {
    console.error("Error fetching attendance summary:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching attendance summary",
      error: error.message,
    });
  }
});

// @route   GET /api/attendance/worker/:workerId/summary
// @desc    Get attendance summary for a worker
// @access  Private
router.get("/worker/:workerId/summary", async (req, res) => {
  try {
    const { workerId } = req.params;
    const { startDate, endDate } = req.query;

    const summary = await Attendance.getWorkerSummary(
      workerId,
      startDate,
      endDate
    );

    res.json({
      success: true,
      data:
        summary.length > 0
          ? summary[0]
          : {
              totalDays: 0,
              presentDays: 0,
              halfDays: 0,
              absentDays: 0,
              totalSalary: 0,
            },
    });
  } catch (error) {
    console.error("Error fetching worker summary:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching worker attendance summary",
      error: error.message,
    });
  }
});

// @route   POST /api/attendance
// @desc    Mark attendance (create or update)
// @access  Private
router.post("/", async (req, res) => {
  try {
    const { workerId, date, status, salary, gangId, notes } = req.body;

    // Validation
    if (!workerId || !date || !status) {
      return res.status(400).json({
        success: false,
        message: "Worker ID, date, and status are required",
      });
    }

    // Validate worker exists
    const worker = await Worker.findById(workerId);
    if (!worker) {
      return res.status(404).json({
        success: false,
        message: "Worker not found",
      });
    }

    // Check if attendance already exists for this date
    const existingAttendance = await Attendance.findOne({
      workerId,
      date: new Date(date),
    });

    let attendance;

    if (existingAttendance) {
      // Update existing attendance
      existingAttendance.status = status;
      existingAttendance.gangId = gangId || existingAttendance.gangId;
      existingAttendance.notes = notes || existingAttendance.notes;

      // Update salary
      if (salary !== undefined) {
        existingAttendance.salary = salary;
      } else {
        // Auto-calculate based on status
        if (status === "present") {
          existingAttendance.salary = worker.dailySalary;
        } else if (status === "absent") {
          existingAttendance.salary = 0;
        } else if (status === "half-day") {
          existingAttendance.salary = worker.dailySalary / 2;
        }
      }

      await existingAttendance.save();
      attendance = existingAttendance;
    } else {
      // Create new attendance
      const attendanceData = {
        workerId,
        date: new Date(date),
        status,
        gangId: gangId || worker.gangId,
        notes,
      };

      // Set salary
      if (salary !== undefined) {
        attendanceData.salary = salary;
      } else {
        // Auto-calculate based on status
        if (status === "present") {
          attendanceData.salary = worker.dailySalary;
        } else if (status === "absent") {
          attendanceData.salary = 0;
        } else if (status === "half-day") {
          attendanceData.salary = worker.dailySalary / 2;
        }
      }

      attendance = await Attendance.create(attendanceData);
    }

    const populatedAttendance = await Attendance.findById(attendance._id)
      .populate("workerId", "name designation dailySalary")
      .populate("gangId", "gangName teamHead");

    res.status(existingAttendance ? 200 : 201).json({
      success: true,
      message: existingAttendance
        ? "Attendance updated successfully"
        : "Attendance marked successfully",
      data: populatedAttendance,
    });
  } catch (error) {
    console.error("Error marking attendance:", error);

    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Attendance already exists for this worker and date",
      });
    }

    res.status(400).json({
      success: false,
      message: "Error marking attendance",
      error: error.message,
    });
  }
});

// @route   PUT /api/attendance/:id
// @desc    Update attendance record
// @access  Private
router.put("/:id", async (req, res) => {
  try {
    const { status, salary, notes } = req.body;

    const attendance = await Attendance.findById(req.params.id);

    if (!attendance) {
      return res.status(404).json({
        success: false,
        message: "Attendance record not found",
      });
    }

    // Update fields
    if (status) attendance.status = status;
    if (notes !== undefined) attendance.notes = notes;
    if (salary !== undefined) {
      attendance.salary = salary;
    } else if (status) {
      // Recalculate salary if status changed
      await attendance.calculateSalary();
    }

    await attendance.save();
    await attendance.populate("workerId", "name designation dailySalary");
    await attendance.populate("gangId", "gangName teamHead");

    res.json({
      success: true,
      message: "Attendance updated successfully",
      data: attendance,
    });
  } catch (error) {
    console.error("Error updating attendance:", error);
    res.status(400).json({
      success: false,
      message: "Error updating attendance",
      error: error.message,
    });
  }
});

// @route   DELETE /api/attendance/:id
// @desc    Delete attendance record
// @access  Private
router.delete("/:id", async (req, res) => {
  try {
    const attendance = await Attendance.findByIdAndDelete(req.params.id);

    if (!attendance) {
      return res.status(404).json({
        success: false,
        message: "Attendance record not found",
      });
    }

    res.json({
      success: true,
      message: "Attendance record deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting attendance:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting attendance record",
      error: error.message,
    });
  }
});

// @route   POST /api/attendance/bulk-mark
// @desc    Mark attendance for multiple workers at once
// @access  Private
router.post("/bulk-mark", async (req, res) => {
  try {
    const { workerIds, date, status, gangId } = req.body;

    if (!workerIds || !Array.isArray(workerIds) || workerIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Worker IDs array is required",
      });
    }

    if (!date || !status) {
      return res.status(400).json({
        success: false,
        message: "Date and status are required",
      });
    }

    const results = [];
    const errors = [];

    for (const workerId of workerIds) {
      try {
        const worker = await Worker.findById(workerId);
        if (!worker) {
          errors.push({ workerId, error: "Worker not found" });
          continue;
        }

        // Calculate salary
        let salary;
        if (status === "present") {
          salary = worker.dailySalary;
        } else if (status === "absent") {
          salary = 0;
        } else if (status === "half-day") {
          salary = worker.dailySalary / 2;
        }

        // Check if exists
        const existing = await Attendance.findOne({
          workerId,
          date: new Date(date),
        });

        let attendance;
        if (existing) {
          existing.status = status;
          existing.salary = salary;
          if (gangId) existing.gangId = gangId;
          await existing.save();
          attendance = existing;
        } else {
          attendance = await Attendance.create({
            workerId,
            date: new Date(date),
            status,
            salary,
            gangId: gangId || worker.gangId,
          });
        }

        results.push(attendance);
      } catch (error) {
        errors.push({ workerId, error: error.message });
      }
    }

    res.json({
      success: true,
      message: `Attendance marked for ${results.length} workers`,
      data: results,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error("Error in bulk attendance marking:", error);
    res.status(500).json({
      success: false,
      message: "Error marking bulk attendance",
      error: error.message,
    });
  }
});

// @route   GET /api/attendance/report/salary
// @desc    Get salary report for a date range
// @access  Private
router.get("/report/salary", async (req, res) => {
  try {
    const { startDate, endDate, workerId, gangId } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: "Start date and end date are required",
      });
    }

    const query = {
      date: {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      },
    };

    if (workerId) query.workerId = mongoose.Types.ObjectId(workerId);
    if (gangId) query.gangId = mongoose.Types.ObjectId(gangId);

    const report = await Attendance.aggregate([
      { $match: query },
      {
        $group: {
          _id: "$workerId",
          totalDays: { $sum: 1 },
          presentDays: {
            $sum: { $cond: [{ $eq: ["$status", "present"] }, 1, 0] },
          },
          halfDays: {
            $sum: { $cond: [{ $eq: ["$status", "half-day"] }, 1, 0] },
          },
          absentDays: {
            $sum: { $cond: [{ $eq: ["$status", "absent"] }, 1, 0] },
          },
          totalSalary: { $sum: "$salary" },
        },
      },
      {
        $lookup: {
          from: "workers",
          localField: "_id",
          foreignField: "_id",
          as: "worker",
        },
      },
      { $unwind: "$worker" },
      {
        $project: {
          _id: 1,
          worker: {
            _id: "$worker._id",
            name: "$worker.name",
            designation: "$worker.designation",
            dailySalary: "$worker.dailySalary",
          },
          totalDays: 1,
          presentDays: 1,
          halfDays: 1,
          absentDays: 1,
          totalSalary: 1,
        },
      },
      { $sort: { totalSalary: -1 } },
    ]);

    const totalAmount = report.reduce((sum, item) => sum + item.totalSalary, 0);

    res.json({
      success: true,
      dateRange: { startDate, endDate },
      totalAmount,
      workersCount: report.length,
      data: report,
    });
  } catch (error) {
    console.error("Error generating salary report:", error);
    res.status(500).json({
      success: false,
      message: "Error generating salary report",
      error: error.message,
    });
  }
});

module.exports = router;
