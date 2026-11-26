import { useState, useEffect } from "react";
import API from "../api";
import "../styles/auth.css";
import { BsHospital, BsShieldLock, BsShieldCheck } from "react-icons/bs";
import {
  FaLock,
  FaEnvelope,
  FaSignInAlt,
  FaUserInjured,
  FaUserMd,
  FaExclamationCircle,
  FaKey,
  FaCheckCircle,
  FaArrowLeft,
  FaTimes,
  FaEye,
  FaEyeSlash,
} from "react-icons/fa";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";

export default function Login() {
  const [errors, setErrors] = useState({});
  const [form, setForm] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);

  // ── Forgot Password States ──
  const [forgotModalOpen, setForgotModalOpen] = useState(false);
  const [forgotStep, setForgotStep] = useState(1); // 1: Email, 2: Code & New Password, 3: Success
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotOtp, setForgotOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState("");
  const [countdown, setCountdown] = useState(0);

  // Countdown effect for OTP resend
  useEffect(() => {
    let timer;
    if (countdown > 0) {
      timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [countdown]);

  const openForgotModal = () => {
    setForgotModalOpen(true);
    setForgotStep(1);
    setForgotEmail(form.email || "");
    setForgotOtp("");
    setNewPassword("");
    setConfirmPassword("");
    setForgotError("");
  };

  const closeForgotModal = () => {
    setForgotModalOpen(false);
    setForgotError("");
  };

  const handleSendOtp = async (e) => {
    if (e) e.preventDefault();
    if (!forgotEmail || !forgotEmail.trim()) {
      setForgotError("Please enter your registered email address.");
      return;
    }
    setForgotError("");
    setForgotLoading(true);
    try {
      const res = await API.post("/auth/forgot-password", { email: forgotEmail.trim() });
      toast.info(res.data.message || "Verification code sent to your email!");
      setForgotStep(2);
      setCountdown(60); // 60s cooldown for resend
    } catch (err) {
      const msg = err.response?.data?.error || "Failed to send reset code. Please try again.";
      setForgotError(msg);
      toast.error(msg);
    } finally {
      setForgotLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    if (e) e.preventDefault();
    setForgotError("");

    if (!forgotOtp || forgotOtp.trim().length !== 6) {
      setForgotError("Please enter the 6-digit verification code sent to your email.");
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      setForgotError("New password must be at least 6 characters long.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setForgotError("Passwords do not match. Please re-enter.");
      return;
    }

    setForgotLoading(true);
    try {
      const res = await API.post("/auth/reset-password", {
        email: forgotEmail.trim(),
        otp: forgotOtp.trim(),
        newPassword,
      });
      toast.success(res.data.message || "Password reset successfully!");
      setForgotStep(3);
    } catch (err) {
      const msg = err.response?.data?.error || "Failed to reset password. Please check your code.";
      setForgotError(msg);
      toast.error(msg);
    } finally {
      setForgotLoading(false);
    }
  };

  const handleFinishReset = () => {
    setForm({ ...form, email: forgotEmail, password: "" });
    closeForgotModal();
  };

  const validate = () => {
    let newErrors = {};
    if (!form.email) newErrors.email = "Email is required";
    if (!form.password) newErrors.password = "Password is required";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleLogin = async () => {
    try {
      if (!validate()) return;
      setLoading(true);
      const res = await API.post("/auth/login", form);
      localStorage.setItem("user", JSON.stringify(res.data.user));
      localStorage.setItem("token", res.data.token);
      setErrors({});
      toast.success("Login successful!");
      window.location.href = "/dashboard";
    } catch (error) {
      toast.error(error.response?.data?.error || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">

      {/* ── LEFT BRAND PANEL ── */}
      <div className="auth-brand-panel">
        <div className="auth-logo-row">
          <div className="auth-logo-box">
            <BsHospital />
          </div>
          <div>
            <p className="auth-logo-name">CareScribe</p>
            <span className="auth-logo-sub">Clinical AI Portal</span>
          </div>
        </div>

        <h2 className="auth-panel-headline">
          Welcome<br />
          <span>Back</span>
        </h2>
        <p className="auth-panel-desc">
          Sign in to access your personal health dashboard, appointment history, consultation notes, and clinical workspace.
        </p>

        <div className="auth-panel-features">
          <div className="auth-feature-item">
            <span className="auth-feature-dot" />
            View upcoming appointments instantly
          </div>
          <div className="auth-feature-item">
            <span className="auth-feature-dot" />
            Access AI-generated clinical SOAP notes
          </div>
          <div className="auth-feature-item">
            <span className="auth-feature-dot" />
            Manage your health profile securely
          </div>
          <div className="auth-feature-item">
            <span className="auth-feature-dot" />
            256-bit encrypted & HIPAA compliant
          </div>
        </div>

        {/* Who can sign in */}
        <div style={{ marginTop: 44, display: "flex", gap: 12, position: "relative", zIndex: 1 }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 10, padding: "10px 16px", fontSize: 13, color: "#cbd5e1"
          }}>
            <FaUserInjured style={{ color: "#38bdf8" }} />
            Patients
          </div>
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 10, padding: "10px 16px", fontSize: 13, color: "#cbd5e1"
          }}>
            <FaUserMd style={{ color: "#a78bfa" }} />
            Doctors
          </div>
        </div>
      </div>

      {/* ── RIGHT FORM PANEL ── */}
      <div className="auth-form-panel">
        <div className="auth-form-box">

          <div className="auth-form-header">
            <p className="auth-form-eyebrow">Secure Access</p>
            <h1 className="auth-form-title">Sign in to your account</h1>
            <p className="auth-form-subtitle">
              Enter your registered email and password to continue.
            </p>
          </div>

          <div className="auth-fields-stack">
            {/* Email */}
            <div className="auth-field">
              <label>
                <FaEnvelope style={{ marginRight: 6, color: "#0284c7", verticalAlign: "-2px" }} />
                Email Address
              </label>
              <input
                className={`auth-input${errors.email ? " auth-input-error" : ""}`}
                type="email"
                placeholder="you@example.com"
                value={form.email}
                onChange={(e) => {
                  setForm({ ...form, email: e.target.value });
                  setErrors({ ...errors, email: "" });
                }}
                onKeyDown={(e) => { if (e.key === "Enter") handleLogin(); }}
              />
              {errors.email && (
                <span style={{ fontSize: 12, color: "#ef4444", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 4 }}>
                  <FaExclamationCircle style={{ fontSize: 11 }} /> {errors.email}
                </span>
              )}
            </div>

            {/* Password */}
            <div className="auth-field">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <label style={{ margin: 0 }}>
                  <FaLock style={{ marginRight: 6, color: "#0284c7", verticalAlign: "-2px" }} />
                  Password
                </label>
                <button
                  type="button"
                  onClick={openForgotModal}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#0284c7",
                    fontSize: 12.5,
                    fontWeight: 600,
                    cursor: "pointer",
                    padding: 0,
                    transition: "color 0.2s",
                  }}
                  onMouseOver={(e) => (e.target.style.color = "#0369a1")}
                  onMouseOut={(e) => (e.target.style.color = "#0284c7")}
                >
                  Forgot password?
                </button>
              </div>
              <input
                className={`auth-input${errors.password ? " auth-input-error" : ""}`}
                type="password"
                placeholder="Enter your password"
                value={form.password}
                onChange={(e) => {
                  setForm({ ...form, password: e.target.value });
                  setErrors({ ...errors, password: "" });
                }}
                onKeyDown={(e) => { if (e.key === "Enter") handleLogin(); }}
              />
              {errors.password && (
                <span style={{ fontSize: 12, color: "#ef4444", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 4 }}>
                  <FaExclamationCircle style={{ fontSize: 11 }} /> {errors.password}
                </span>
              )}
            </div>
          </div>

          {/* Submit */}
          <button
            className="auth-submit-btn"
            onClick={handleLogin}
            disabled={loading}
          >
            <FaSignInAlt />
            <span>{loading ? "Signing In..." : "Sign In to Portal"}</span>
          </button>

          <div className="auth-footer-link">
            Don&apos;t have an account?{" "}
            <Link to="/register">Create an account</Link>
          </div>

          <div className="auth-security-note">
            <BsShieldLock />
            <span>HIPAA Compliant · 256-bit Encrypted · Secure Medical Directory</span>
          </div>

        </div>
      </div>

      {/* ── FORGOT PASSWORD MODAL ── */}
      {forgotModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(15, 23, 42, 0.65)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: 16,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) closeForgotModal();
          }}
        >
          <div
            style={{
              backgroundColor: "#ffffff",
              borderRadius: 16,
              maxWidth: 460,
              width: "100%",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
              border: "1px solid #e2e8f0",
              overflow: "hidden",
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "20px 24px 16px",
                borderBottom: "1px solid #f1f5f9",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 10,
                    background: "#f0f9ff",
                    color: "#0284c7",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 18,
                  }}
                >
                  <FaKey />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "#0f172a" }}>
                    {forgotStep === 1 && "Reset Your Password"}
                    {forgotStep === 2 && "Enter Verification Code"}
                    {forgotStep === 3 && "Password Reset Complete"}
                  </h3>
                  <p style={{ margin: "2px 0 0", fontSize: 12, color: "#64748b" }}>
                    CareScribe Healthcare Security
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeForgotModal}
                style={{
                  background: "none",
                  border: "none",
                  color: "#94a3b8",
                  fontSize: 16,
                  cursor: "pointer",
                  padding: 6,
                  borderRadius: 6,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <FaTimes />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: "20px 24px 24px" }}>
              {forgotError && (
                <div
                  style={{
                    padding: "10px 14px",
                    background: "#fef2f2",
                    border: "1px solid #fecaca",
                    borderRadius: 8,
                    color: "#dc2626",
                    fontSize: 13,
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 8,
                    marginBottom: 16,
                  }}
                >
                  <FaExclamationCircle style={{ marginTop: 2, flexShrink: 0 }} />
                  <span>{forgotError}</span>
                </div>
              )}

              {/* STEP 1: Enter Registered Email */}
              {forgotStep === 1 && (
                <form onSubmit={handleSendOtp}>
                  <p style={{ margin: "0 0 16px", fontSize: 13.5, color: "#475569", lineHeight: 1.5 }}>
                    Enter the email address associated with your account. We will send you a 6-digit verification code.
                  </p>

                  <div className="auth-field" style={{ marginBottom: 20 }}>
                    <label>
                      <FaEnvelope style={{ marginRight: 6, color: "#0284c7" }} />
                      Registered Email Address
                    </label>
                    <input
                      className="auth-input"
                      type="email"
                      placeholder="e.g. yourname@example.com"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      autoFocus
                    />
                  </div>

                  <button
                    type="submit"
                    className="auth-submit-btn"
                    style={{ width: "100%", justifyContent: "center" }}
                    disabled={forgotLoading}
                  >
                    <span>{forgotLoading ? "Sending Code..." : "Send Verification Code"}</span>
                  </button>
                </form>
              )}

              {/* STEP 2: Enter Code + New Password */}
              {forgotStep === 2 && (
                <form onSubmit={handleResetPassword}>
                  <div
                    style={{
                      background: "#f8fafc",
                      border: "1px solid #e2e8f0",
                      borderRadius: 8,
                      padding: "10px 12px",
                      marginBottom: 16,
                      fontSize: 12.5,
                      color: "#475569",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <span>Code sent to: <strong>{forgotEmail}</strong></span>
                    <button
                      type="button"
                      onClick={() => { setForgotStep(1); setForgotError(""); }}
                      style={{ background: "none", border: "none", color: "#0284c7", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                    >
                      Change
                    </button>
                  </div>

                  {/* 6-digit OTP */}
                  <div className="auth-field" style={{ marginBottom: 16 }}>
                    <label>
                      <FaKey style={{ marginRight: 6, color: "#0284c7" }} />
                      6-Digit Verification Code
                    </label>
                    <input
                      className="auth-input"
                      type="text"
                      maxLength={6}
                      placeholder="e.g. 123456"
                      value={forgotOtp}
                      onChange={(e) => setForgotOtp(e.target.value.replace(/\D/g, ""))}
                      style={{ letterSpacing: 4, fontWeight: 700, fontSize: 18, textAlign: "center" }}
                      autoFocus
                    />
                  </div>

                  {/* New Password */}
                  <div className="auth-field" style={{ marginBottom: 16 }}>
                    <label>
                      <FaLock style={{ marginRight: 6, color: "#0284c7" }} />
                      New Password (min. 6 characters)
                    </label>
                    <div style={{ position: "relative" }}>
                      <input
                        className="auth-input"
                        type={showNewPass ? "text" : "password"}
                        placeholder="Create new password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        style={{ paddingRight: 38 }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPass(!showNewPass)}
                        style={{
                          position: "absolute",
                          right: 10,
                          top: "50%",
                          transform: "translateY(-50%)",
                          background: "none",
                          border: "none",
                          color: "#94a3b8",
                          cursor: "pointer",
                          padding: 4,
                        }}
                      >
                        {showNewPass ? <FaEyeSlash /> : <FaEye />}
                      </button>
                    </div>
                  </div>

                  {/* Confirm New Password */}
                  <div className="auth-field" style={{ marginBottom: 20 }}>
                    <label>
                      <FaLock style={{ marginRight: 6, color: "#0284c7" }} />
                      Confirm New Password
                    </label>
                    <div style={{ position: "relative" }}>
                      <input
                        className="auth-input"
                        type={showConfirmPass ? "text" : "password"}
                        placeholder="Re-enter new password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        style={{ paddingRight: 38 }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPass(!showConfirmPass)}
                        style={{
                          position: "absolute",
                          right: 10,
                          top: "50%",
                          transform: "translateY(-50%)",
                          background: "none",
                          border: "none",
                          color: "#94a3b8",
                          cursor: "pointer",
                          padding: 4,
                        }}
                      >
                        {showConfirmPass ? <FaEyeSlash /> : <FaEye />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="auth-submit-btn"
                    style={{ width: "100%", justifyContent: "center" }}
                    disabled={forgotLoading}
                  >
                    <span>{forgotLoading ? "Resetting Password..." : "Reset Password"}</span>
                  </button>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 14 }}>
                    <button
                      type="button"
                      onClick={() => { setForgotStep(1); setForgotError(""); }}
                      style={{ background: "none", border: "none", color: "#64748b", fontSize: 12.5, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 5 }}
                    >
                      <FaArrowLeft style={{ fontSize: 10 }} /> Back
                    </button>
                    <button
                      type="button"
                      onClick={handleSendOtp}
                      disabled={countdown > 0 || forgotLoading}
                      style={{
                        background: "none",
                        border: "none",
                        color: countdown > 0 ? "#94a3b8" : "#0284c7",
                        fontSize: 12.5,
                        fontWeight: 600,
                        cursor: countdown > 0 ? "default" : "pointer",
                      }}
                    >
                      {countdown > 0 ? `Resend in ${countdown}s` : "Resend code"}
                    </button>
                  </div>
                </form>
              )}

              {/* STEP 3: Success Confirmation */}
              {forgotStep === 3 && (
                <div style={{ textAlign: "center", padding: "12px 0 6px" }}>
                  <div
                    style={{
                      width: 54,
                      height: 54,
                      borderRadius: "50%",
                      background: "#dcfce7",
                      color: "#16a34a",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 26,
                      marginBottom: 14,
                    }}
                  >
                    <FaCheckCircle />
                  </div>
                  <h4 style={{ margin: "0 0 6px", fontSize: 18, color: "#0f172a", fontWeight: 700 }}>
                    Password Successfully Reset!
                  </h4>
                  <p style={{ margin: "0 0 20px", fontSize: 13.5, color: "#64748b", lineHeight: 1.5 }}>
                    Your password has been securely updated. You can now sign in to your CareScribe account.
                  </p>
                  <button
                    type="button"
                    className="auth-submit-btn"
                    onClick={handleFinishReset}
                    style={{ width: "100%", justifyContent: "center" }}
                  >
                    <FaSignInAlt />
                    <span>Sign In Now</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
