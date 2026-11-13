import { useState } from "react";
import API from "../api";
import "../styles/auth.css";
import { BsHospital, BsShieldLock } from "react-icons/bs";
import { FaUserPlus, FaUserMd, FaUserInjured } from "react-icons/fa";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

export default function Register() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "patient",
    age: "",
    gender: "",
    contact: "",
    specialty: "",
    experience: "",
    mobile: ""
  });
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    try {
      if (!form.name || !form.email || !form.password) {
        toast.warning("Please fill in all required primary fields");
        return;
      }
      setLoading(true);
      await API.post("/auth/register", form);
      toast.success("Registration successful. Please sign in.");
      navigate("/");
    } catch (error) {
      toast.error(error.response?.data?.error || "Registration failed");
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
          Your Health,<br />
          <span>Our Priority</span>
        </h2>
        <p className="auth-panel-desc">
          Join HealthRay — a modern healthcare management platform for patients seeking quality care and medical professionals delivering it.
        </p>

        <div className="auth-panel-features">
          <div className="auth-feature-item">
            <span className="auth-feature-dot" />
            Book appointments with specialist doctors
          </div>
          <div className="auth-feature-item">
            <span className="auth-feature-dot" />
            Access your consultation notes anytime
          </div>
          <div className="auth-feature-item">
            <span className="auth-feature-dot" />
            AI-powered clinical SOAP note generation
          </div>
          <div className="auth-feature-item">
            <span className="auth-feature-dot" />
            Secure, HIPAA-compliant health records
          </div>
        </div>
      </div>

      {/* ── RIGHT FORM PANEL ── */}
      <div className="auth-form-panel">
        <div className="auth-form-box">

          <div className="auth-form-header">
            <p className="auth-form-eyebrow">Get Started</p>
            <h1 className="auth-form-title">Create your account</h1>
            <p className="auth-form-subtitle">
              Register as a patient or medical professional to get started.
            </p>
          </div>

          {/* Role Selector */}
          <div className="auth-role-selector">
            <button
              type="button"
              className={`auth-role-btn ${form.role === "patient" ? "active" : ""}`}
              onClick={() => setForm({ ...form, role: "patient" })}
            >
              <FaUserInjured />
              Patient
            </button>
            <button
              type="button"
              className={`auth-role-btn doctor ${form.role === "doctor" ? "active" : ""}`}
              onClick={() => setForm({ ...form, role: "doctor" })}
            >
              <FaUserMd />
              Doctor
            </button>
          </div>

          {/* Common Fields */}
          <div className="auth-section-divider">
            <span className="auth-section-label">Account Details</span>
          </div>

          <div className="auth-fields-stack">
            <div className="auth-fields-grid-2">
              <div className="auth-field">
                <label>Full Name *</label>
                <input
                  className="auth-input"
                  placeholder={form.role === "doctor" ? "Dr. Sarah Jenkins" : "John Doe"}
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div className="auth-field">
                <label>Email Address *</label>
                <input
                  className="auth-input"
                  type="email"
                  placeholder="name@example.com"
                  value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })}
                />
              </div>
            </div>

            <div className="auth-field">
              <label>Password *</label>
              <input
                className="auth-input"
                type="password"
                placeholder="Create a strong password"
                value={form.password}
                onChange={e => setForm({ ...form, password: e.target.value })}
              />
            </div>
          </div>

          {/* PATIENT FIELDS */}
          {form.role === "patient" && (
            <>
              <div className="auth-section-divider">
                <span className="auth-section-label">Patient Details</span>
              </div>
              <div className="auth-fields-stack">
                <div className="auth-fields-grid-3">
                  <div className="auth-field">
                    <label>Age</label>
                    <input
                      className="auth-input"
                      placeholder="e.g. 28"
                      type="number"
                      value={form.age}
                      onChange={e => setForm({ ...form, age: e.target.value })}
                    />
                  </div>
                  <div className="auth-field">
                    <label>Gender</label>
                    <input
                      className="auth-input"
                      placeholder="Male / Female / Other"
                      value={form.gender}
                      onChange={e => setForm({ ...form, gender: e.target.value })}
                    />
                  </div>
                  <div className="auth-field">
                    <label>Emergency Contact</label>
                    <input
                      className="auth-input"
                      placeholder="+91 98765 43210"
                      value={form.contact}
                      onChange={e => setForm({ ...form, contact: e.target.value })}
                    />
                  </div>
                </div>
              </div>
            </>
          )}

          {/* DOCTOR FIELDS */}
          {form.role === "doctor" && (
            <>
              <div className="auth-section-divider">
                <span className="auth-section-label">Professional Details</span>
              </div>
              <div className="auth-fields-stack">
                <div className="auth-fields-grid-3">
                  <div className="auth-field">
                    <label>Medical Specialty</label>
                    <input
                      className="auth-input"
                      placeholder="e.g. Cardiology"
                      value={form.specialty || ""}
                      onChange={e => setForm({ ...form, specialty: e.target.value })}
                    />
                  </div>
                  <div className="auth-field">
                    <label>Clinic / Hospital</label>
                    <input
                      className="auth-input"
                      placeholder="e.g. ABC Clinic"
                      value={form.clinicName || ""}
                      onChange={e => setForm({ ...form, clinicName: e.target.value })}
                    />
                  </div>
                  <div className="auth-field">
                    <label>Experience (Years)</label>
                    <input
                      className="auth-input"
                      placeholder="e.g. 12+"
                      type="text"
                      value={form.experience || ""}
                      onChange={e => setForm({ ...form, experience: e.target.value })}
                    />
                  </div>
                </div>

                <div className="auth-fields-grid-3">
                  <div className="auth-field">
                    <label>City</label>
                    <input
                      className="auth-input"
                      placeholder="e.g. Ahmedabad"
                      value={form.city || ""}
                      onChange={e => setForm({ ...form, city: e.target.value })}
                    />
                  </div>
                  <div className="auth-field">
                    <label>State</label>
                    <input
                      className="auth-input"
                      placeholder="e.g. Gujarat"
                      value={form.state || ""}
                      onChange={e => setForm({ ...form, state: e.target.value })}
                    />
                  </div>
                  <div className="auth-field">
                    <label>Mobile Number</label>
                    <input
                      className="auth-input"
                      placeholder="+91 98765 43210"
                      value={form.mobile || ""}
                      onChange={e => setForm({ ...form, mobile: e.target.value })}
                    />
                  </div>
                </div>

                <div className="auth-fields-grid-2">
                  <div className="auth-field">
                    <label>Full Address</label>
                    <input
                      className="auth-input"
                      placeholder="e.g. Khedi Road, Near Civil Lines"
                      value={form.address || ""}
                      onChange={e => setForm({ ...form, address: e.target.value })}
                    />
                  </div>
                  <div className="auth-field">
                    <label>OPD Timings</label>
                    <input
                      className="auth-input"
                      placeholder="e.g. 09:00 AM – 08:00 PM"
                      value={form.timing || ""}
                      onChange={e => setForm({ ...form, timing: e.target.value })}
                    />
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Submit */}
          <button
            className="auth-submit-btn"
            onClick={handleRegister}
            disabled={loading}
          >
            <FaUserPlus />
            <span>{loading ? "Creating Account..." : "Complete Registration"}</span>
          </button>

          <div className="auth-footer-link">
            Already have an account? <Link to="/">Sign In</Link>
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
