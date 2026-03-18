const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const colors = require("colors");
const morgan = require("morgan");
const connectDB = require("./config/db");
const registerRoute = require("./routes/RegisterRoute");

const projectRoutes = require("./routes/NewProjectRoute");
//Dotenv
dotenv.config();

//rest object
const app = express();

// MONGO CONNECTION
connectDB();

//middlewares
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));
app.use(morgan("dev"));

// Routes
app.get("", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Welcome to SaiiConstruction",
  });
});

app.use("/api/projects", projectRoutes);
const quotationRoutes = require("./routes/QuotationRoute");
app.use("/api/quotations", quotationRoutes);

const ratedLabourRoutes = require("./routes/RatedLaboursRoute");
app.use("/api/rated-labours", ratedLabourRoutes);

// Routes
app.use("/api/auth", registerRoute);

// In your server.js or app.js
const labourPaymentsRouter = require("./routes/RatedLabourPaymentsRoute");
app.use("/api/labour-payments", labourPaymentsRouter);

const gangRoutes = require("./routes/GangRoute"); // Adjust path

const workerRoutes = require("./routes/WorkerRoute");
const attendanceRoutes = require("./routes/AttendanceRoute");
const advanceRoutes = require("./routes/AdvanceRoute");

const userRoutes = require("./routes/UserRoute");
app.use("/api/users", userRoutes);

app.use("/api/gangs", gangRoutes);
app.use("/api/workers", workerRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/advances", advanceRoutes);
const Assignments = require("./routes/GangAssignmentRoute");
app.use("/api/gangAssignments", Assignments);

app.use("/api", require("./routes/workHistory"));
const expenseRoutes = require("./routes/ExpenseRoute");
const reminderRoutes = require("./routes/ReminderRoute");
app.use("/api/expenses", expenseRoutes);
app.use("/api/reminders", reminderRoutes);

const vendorRoutes = require("./routes/VendorRoutes");
app.use("/api/vendors", vendorRoutes);

const projectWorkerRoutes = require("./routes/ProjectWorkerRoute");
app.use("/api/project-workers", projectWorkerRoutes);

// port
const PORT = process.env.PORT;

// listen

app.listen(PORT, () => {
  console.log(`Server is Running on ${PORT}`.bgCyan);
});
