import prisma from "../prisma/client.js";

/**
 * HIPAA § 164.312(b) Audit Controls:
 * Records audit logs for viewing, modifying, printing, copying, and deleting PHI.
 */
export async function logAuditEvent(
  req,
  {
    action,
    resource = "ConsultationNote",
    resourceId = null,
    patientId = null,
    details = null,
    userId = null,
    userRole = null,
    userName = null,
  } = {}
) {
  try {
    const user = req?.user || {};
    let resolvedUserId =
      userId !== null && userId !== undefined
        ? Number(userId)
        : Number(req?.headers?.userid) || user.id || null;

    let resolvedUserRole =
      userRole ||
      req?.headers?.role ||
      user.role ||
      null;

    let resolvedUserName =
      userName ||
      req?.headers?.username ||
      user.name ||
      null;

    // If userId is known, but userName or userRole is missing or "unknown",
    // query database to populate accurate user details for the compliance audit trail.
    if (resolvedUserId && (!resolvedUserName || !resolvedUserRole || resolvedUserRole === "unknown")) {
      try {
        const dbUser = await prisma.user.findUnique({
          where: { id: Number(resolvedUserId) },
          select: { name: true, role: true },
        });
        if (dbUser) {
          if (!resolvedUserName) resolvedUserName = dbUser.name;
          if (!resolvedUserRole || resolvedUserRole === "unknown") resolvedUserRole = dbUser.role;
        }
      } catch (dbErr) {
        // Non-blocking fallback
      }
    }

    if (!resolvedUserRole) {
      resolvedUserRole = "unknown";
    }

    const ipAddress =
      req?.headers?.["x-forwarded-for"] ||
      req?.socket?.remoteAddress ||
      req?.connection?.remoteAddress ||
      null;

    const userAgent = req?.headers?.["user-agent"] || null;

    let detailsString = null;
    if (typeof details === "object" && details !== null) {
      detailsString = JSON.stringify(details);
    } else if (details) {
      detailsString = String(details);
    }

    const log = await prisma.auditLog.create({
      data: {
        userId: resolvedUserId ? Number(resolvedUserId) : null,
        userRole: typeof resolvedUserRole === "string" ? resolvedUserRole.slice(0, 50) : null,
        userName: resolvedUserName ? String(resolvedUserName).slice(0, 100) : null,
        action: String(action || "UNKNOWN_ACTION").slice(0, 100),
        resource: String(resource).slice(0, 100),
        resourceId: resourceId ? Number(resourceId) : null,
        patientId: patientId ? Number(patientId) : null,
        ipAddress: typeof ipAddress === "string" ? ipAddress.slice(0, 45) : null,
        userAgent: typeof userAgent === "string" ? userAgent.slice(0, 255) : null,
        details: detailsString,
      },
    });

    console.log(`🔒 [HIPAA AuditLog] ${action} on ${resource}${resourceId ? ` #${resourceId}` : ""} by User ${resolvedUserId || "anon"} (${resolvedUserRole}) [${resolvedUserName || "N/A"}]`);
    return log;
  } catch (err) {
    // Non-blocking so business logic never fails if audit log writing encounters an issue
    console.warn("⚠️ [HIPAA AuditLog] Failed to record audit log:", err.message);
    return null;
  }
}

