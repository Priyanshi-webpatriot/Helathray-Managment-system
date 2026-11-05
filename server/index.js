import "./env.js"; // ← MUST be first: loads .env before any other module
import express from "express";
import cors from "cors";
import jwt from "jsonwebtoken";
import authRoutes from "./routes/authRoutes.js";
import patientRoutes from "./routes/patientRoutes.js";
import doctorRoutes from "./routes/doctorRoutes.js";
import appointmentRoutes from "./routes/appointmentRoutes.js";
import patientAppointmentRoutes from "./routes/patientAppointmentRoutes.js";
import chatRoutes from "./routes/chatRoutes.js";
import medicalRecordRoutes from "./routes/medicalRecordRoutes.js";
import "./utils/reminderCron.js";
import reminderRoutes from "./routes/reminderRoutes.js";
import consultationNoteRoutes from "./routes/consultationNoteRoutes.js";

const app = express();
const JWT_SECRET = process.env.JWT_SECRET || "healthray_jwt_secret_key";

app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// ── JWT DECODE MIDDLEWARE ──
// Decodes the JWT token (if present) and populates req.user, req.headers.role,
// and req.headers.userid so all existing controllers continue to work unchanged.
app.use((req, res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.split(" ")[1];
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = decoded;
      // Keep legacy header fields populated for backward compatibility
      req.headers.role = decoded.role;
      req.headers.userid = String(decoded.id);
    } catch {
      // Invalid token — req.user stays undefined; protected routes will reject via checkRole
    }
  }
  next();
});

// ── GLOBAL BACKEND REQUEST LOGGER ──
app.use((req, res, next) => {
  const start = Date.now();
  const time = new Date().toLocaleTimeString();
  const role = req.headers.role || "anonymous";
  const userId = req.headers.userid || "none";

  console.log(`\n📥 [SERVER REQUEST] [${time}] ${req.method} ${req.originalUrl} | Role: ${role} | UserId: ${userId}`);

  res.on("finish", () => {
    const elapsed = Date.now() - start;
    const status = res.statusCode;
    const icon = status >= 400 ? "❌" : "✅";
    console.log(`${icon} [SERVER RESPONSE] [${time}] ${req.method} ${req.originalUrl} -> Status: ${status} (${elapsed}ms)`);
  });

  next();
});

app.use("/api/auth", authRoutes);
app.use("/api/patients", patientRoutes);
app.use("/api/doctors", doctorRoutes);
app.use("/api/appointments", appointmentRoutes);
app.use("/api/patient-appointments", patientAppointmentRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/medical-records", medicalRecordRoutes);
app.use("/api/reminders", reminderRoutes);
app.use("/api/consultation-notes", consultationNoteRoutes);

// ── GLOBAL BACKEND ERROR HANDLER ──
app.use((err, req, res, next) => {
  const time = new Date().toLocaleTimeString();
  console.error(`\n💥 [SERVER UNCAUGHT ERROR] [${time}] ${req.method} ${req.originalUrl}:`, err);
  if (!res.headersSent) {
    res.status(err.status || 500).json({
      error: err.message || "Internal Server Error",
      detail: err.detail || (err.response?.data ? JSON.stringify(err.response.data) : err.stack),
    });
  }
});

console.log("Starting HealthRay HMS server...");

app.listen(3360, () => {
  console.log("🚀 Server is running on: http://localhost:3360");
});