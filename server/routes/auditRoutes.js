import express from "express";
import prisma from "../prisma/client.js";
import { logAuditEvent } from "../utils/auditLogger.js";
import { checkRole } from "../middleware/roleMiddleware.js";

const router = express.Router();

// Record client-side HIPAA audit events (print, copy, screen view)
router.post("/log", async (req, res) => {
  try {
    const { action, resource = "ConsultationNote", resourceId, patientId, details, userId, userRole, userName } = req.body;
    if (!action) {
      return res.status(400).json({ error: "Action is required" });
    }

    const log = await logAuditEvent(req, {
      action,
      resource,
      resourceId,
      patientId,
      details,
      userId,
      userRole,
      userName,
    });

    return res.status(201).json({ success: true, log });
  } catch (err) {
    console.error("❌ [Audit Route] Log error:", err.message);
    return res.status(500).json({ error: "Failed to record audit log" });
  }
});

// Admin review endpoint to view HIPAA audit trail
router.get("/", checkRole(["admin"]), async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 100, 500);
    const logs = await prisma.auditLog.findMany({
      take: limit,
      orderBy: { createdAt: "desc" },
    });
    return res.json(logs);
  } catch (err) {
    console.error("❌ [Audit Route] Fetch error:", err.message);
    return res.status(500).json({ error: "Failed to fetch audit logs" });
  }
});

export default router;

