import { useState } from "react";
import API from "../api";
import "../styles/auth.css";
import { BsHospital, BsShieldLock } from "react-icons/bs";
import { FaLock, FaEnvelope, FaSignInAlt, FaUserInjured, FaUserMd, FaExclamationCircle } from "react-icons/fa";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";

export default function Login() {
  const [errors, setErrors] = useState({});
  const [form, setForm] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);

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
            <p className="auth-logo-name">HealthRay</p>
            <span className="auth-logo-sub">HMS Portal</span>
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
              <label>
                <FaLock style={{ marginRight: 6, color: "#0284c7", verticalAlign: "-2px" }} />
                Password
              </label>
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

    </div>
  );
}
