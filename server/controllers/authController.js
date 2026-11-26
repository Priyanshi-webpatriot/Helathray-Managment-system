import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import prisma from "../prisma/client.js";
import { sendEmail } from "../utils/sendEmail.js";
import { saveResetOtp, verifyStoredOtp, clearStoredOtp } from "../utils/passwordResetStore.js";
import { logAuditEvent } from "../utils/auditLogger.js";

const JWT_SECRET = process.env.JWT_SECRET;

// REGISTER
export const registerUser = async (req, res) => {
  try {
    const { name, email, password, role, age, gender, contact, specialty, experience, mobile, clinicName, city, state, address, timing } = req.body;

    // Block admin registration through public endpoint
    if (role === "admin") {
      return res.status(403).json({ error: "Admin accounts cannot be created through registration." });
    }

    // Only allow valid roles
    if (!["patient", "doctor"].includes(role)) {
      return res.status(400).json({ error: "Invalid role. Only 'patient' or 'doctor' are allowed." });
    }

    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      return res.status(400).json({ error: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // Create User
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role
      }
    });

    // Create related profile
    if (role === "patient") {
      await prisma.patient.create({
        data: {
          name,
          age: Number(age),
          gender,
          contact,
          userId: user.id
        }
      });
    }
    if (role === "doctor") {
      await prisma.doctor.create({
        data: {
          name,
          specialty: specialty || "General Medicine",
          userId: user.id,
          experience: experience || "5+",
          mobile: mobile || contact,
          clinicName: clinicName || `${name.replace(/^Dr\.?\s*/i, "")} Clinic`,
          city: city || "Ahmedabad",
          state: state || "Gujarat",
          address: address || "Main Hospital Road",
          timing: timing || "09:00 AM - 08:00 PM"
        }
      });
    }

    res.status(201).json({ message: "User registered successfully" });

  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Registration failed" });
  }
};

// LOGIN
export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    console.log("Login attempt:", email);

    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(400).json({ error: "Invalid password" });
    }

    // Sign a JWT token containing the user's id, role, and name
    const token = jwt.sign(
      { id: user.id, role: user.role, name: user.name },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.status(200).json({
      message: "Login successful",
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });

  } catch (error) {
    console.log("Login error:", error);
    res.status(500).json({ error: "Login failed", details: error.message });
  }
};

// ==========================================
// FORGOT PASSWORD - REQUEST OTP
// ==========================================
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || !email.trim()) {
      return res.status(400).json({ error: "Email address is required." });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      return res.status(404).json({ error: "No account found with this email address." });
    }

    // Generate secure 6-digit verification code
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    saveResetOtp(normalizedEmail, otp);

    console.log(`\n🔑 [Password Reset OTP] Verification code dispatched securely for ${normalizedEmail} (code masked for security)`);

    // Build healthcare email content
    const emailSubject = "CareScribe - Password Reset Verification Code";
    const emailHtml = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 540px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
        <div style="background: linear-gradient(135deg, #0369a1, #0284c7); padding: 24px; text-align: center; color: #ffffff;">
          <h2 style="margin: 0; font-size: 22px;">CareScribe Portal</h2>
          <p style="margin: 6px 0 0; font-size: 13px; color: #e0f2fe;">Account Security &amp; Password Assistance</p>
        </div>
        <div style="padding: 28px 24px; color: #1e293b;">
          <p style="font-size: 15px; margin-top: 0;">Hello <strong>${user.name}</strong>,</p>
          <p style="font-size: 14px; line-height: 1.6; color: #475569;">
            We received a request to reset your password for your CareScribe Healthcare account.
            Use the verification code below to complete the reset.
          </p>
          <div style="text-align: center; margin: 28px 0;">
            <div style="display: inline-block; background: #f0f9ff; border: 2px dashed #0284c7; border-radius: 10px; padding: 14px 28px; font-size: 32px; font-weight: 800; letter-spacing: 6px; color: #0369a1;">
              ${otp}
            </div>
            <p style="font-size: 12px; color: #64748b; margin-top: 8px;">(This verification code expires in 10 minutes)</p>
          </div>
          <p style="font-size: 13px; color: #64748b; line-height: 1.5;">
            If you did not request a password reset, you can safely ignore this email. Your password will remain unchanged.
          </p>
        </div>
        <div style="background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 14px 24px; text-align: center; font-size: 12px; color: #94a3b8;">
          CareScribe Clinical System · HIPAA Compliant · 256-bit Secure
        </div>
      </div>
    `;

    // Send email asynchronously
    sendEmail({
      to: normalizedEmail,
      subject: emailSubject,
      text: `Your CareScribe password reset code is: ${otp}. It expires in 10 minutes.`,
      html: emailHtml,
      recipientName: user.name,
    }).catch((err) => {
      console.warn("⚠️ [Password Reset] Failed to dispatch email:", err.message);
    });

    return res.status(200).json({
      message: "Verification code sent to your email. Please check your inbox.",
      email: normalizedEmail,
    });
  } catch (error) {
    console.error("❌ [Forgot Password Error]:", error);
    return res.status(500).json({ error: "Failed to process password reset request." });
  }
};

// ==========================================
// VERIFY RESET OTP
// ==========================================
export const verifyResetOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json({ error: "Email and verification code are required." });
    }

    const result = verifyStoredOtp(email, otp);
    if (!result.valid) {
      return res.status(400).json({ error: result.reason });
    }

    return res.status(200).json({ success: true, message: "Code verified successfully." });
  } catch (error) {
    console.error("❌ [Verify OTP Error]:", error);
    return res.status(500).json({ error: "Failed to verify code." });
  }
};

// ==========================================
// RESET PASSWORD
// ==========================================
export const resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    if (!email || !otp || !newPassword) {
      return res.status(400).json({ error: "Email, code, and new password are required." });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters long." });
    }

    // Verify OTP
    const check = verifyStoredOtp(email, otp);
    if (!check.valid) {
      return res.status(400).json({ error: check.reason });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      return res.status(404).json({ error: "User account not found." });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    await prisma.user.update({
      where: { email: normalizedEmail },
      data: { password: hashedPassword },
    });

    // Invalidate OTP
    clearStoredOtp(normalizedEmail);

    // Log audit event with explicit user identity
    logAuditEvent(req, {
      action: "RESET_PASSWORD",
      resource: "User",
      resourceId: user.id,
      userId: user.id,
      userRole: user.role,
      userName: user.name,
      details: { email: normalizedEmail, role: user.role },
    }).catch(() => { });

    console.log(`✅ [Reset Password] Successfully updated password for user: ${normalizedEmail}`);
    return res.status(200).json({ message: "Password reset successfully! You can now sign in." });
  } catch (error) {
    console.error("❌ [Reset Password Error]:", error);
    return res.status(500).json({ error: "Failed to reset password." });
  }
};
