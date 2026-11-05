import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "healthray_jwt_secret_key";

/**
 * verifyToken — Validates the JWT from the Authorization header.
 * Attaches { id, role } to req.user on success.
 */
export const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized: No token provided" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // { id, role }
    next();
  } catch (err) {
    return res.status(401).json({ error: "Unauthorized: Invalid or expired token" });
  }
};

/**
 * checkRole — Verifies JWT AND checks that the user's role is in the allowed list.
 * Replaces the old header-based role check.
 * Usage: checkRole(["admin", "doctor"])
 */
export const checkRole = (roles) => {
  return (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized: No token provided" });
    }

    const token = authHeader.split(" ")[1];

    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = decoded; // { id, role }

      const userRole = (decoded.role || "").toLowerCase();

      if (!roles.map(r => r.toLowerCase()).includes(userRole)) {
        console.warn(`[Auth] Access DENIED for "${req.originalUrl}". Role "${userRole}" not in [${roles.join(", ")}]`);
        return res.status(403).json({
          error: "Access denied",
          detail: `Role "${userRole}" is not authorized for this endpoint. Required: [${roles.join(", ")}]`,
        });
      }

      console.log(`🛡️ [Auth] Access GRANTED for "${req.originalUrl}" with role "${userRole}"`);
      next();
    } catch (err) {
      return res.status(401).json({ error: "Unauthorized: Invalid or expired token" });
    }
  };
};
