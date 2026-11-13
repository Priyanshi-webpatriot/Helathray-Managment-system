import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import API from "../api";
import "../styles/patientProfile.css";
import {
  FaUserInjured, FaPhone, FaEnvelope, FaTint, FaEdit, FaSave, FaTimes,
  FaHeartbeat,
} from "react-icons/fa";
import { toast } from "react-toastify";

export default function PatientProfile() {
  const navigate = useNavigate();
  const [patient, setPatient] = useState(null);
  const [appointments, setAppointments] = useState([]);
  const [consultationNotes, setConsultationNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    name: "",
    age: "",
    gender: "",
    contact: "",
    bloodGroup: "",
    medicalNotes: ""
  });

  const user = JSON.parse(localStorage.getItem("user") || "{}");

  useEffect(() => {
    fetchProfileData();
  }, []);

  const fetchProfileData = async () => {
    try {
      if (!user?.id) return;

      const resProfile = await API.get("/patients/profile", {
        headers: { userid: user.id, role: user.role },
      });
      setPatient(resProfile.data);
      setForm({
        name: resProfile.data.name || "",
        age: resProfile.data.age !== undefined && resProfile.data.age !== null
          ? String(resProfile.data.age) : "",
        gender: resProfile.data.gender || "",
        contact: resProfile.data.contact || "",
        bloodGroup: resProfile.data.bloodGroup || "",
        medicalNotes: resProfile.data.medicalNotes || ""
      });

      try {
        const resAppts = await API.get("/patient-appointments/my", {
          headers: { userid: user.id, role: user.role },
        });
        if (Array.isArray(resAppts.data)) setAppointments(resAppts.data);
      } catch (err) {
        console.warn("Could not fetch patient appointments:", err);
      }

      try {
        const resNotes = await API.get("/consultation-notes/my-notes", {
          headers: { userid: user.id, role: user.role },
        });
        if (Array.isArray(resNotes.data)) setConsultationNotes(resNotes.data);
      } catch (err) {
        console.warn("Could not fetch consultation notes:", err);
      }

    } catch (error) {
      console.log("Profile fetch error:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e) => {
    e?.preventDefault();
    try {
      setSaving(true);
      const res = await API.put(
        "/patients/profile",
        {
          name: form.name.trim(),
          age: form.age ? Number(form.age) : patient?.age,
          gender: form.gender,
          contact: form.contact.trim(),
          bloodGroup: form.bloodGroup || null,
          medicalNotes: form.medicalNotes.trim() || null
        },
        { headers: { role: user.role, userid: user.id } }
      );

      setPatient(res.data);
      if (form.name.trim() && user.name !== form.name.trim()) {
        const updatedUser = { ...user, name: form.name.trim() };
        localStorage.setItem("user", JSON.stringify(updatedUser));
      }

      setIsEditing(false);
      toast.success("Profile updated successfully!");
    } catch (err) {
      console.error("Profile save error:", err);
      toast.error(err.response?.data?.error || "Failed to update profile. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="pp-shell pp-loading-state">
        <div className="pp-spinner" />
        <h2 className="pp-loading-title">Loading your profile...</h2>
        <p className="pp-loading-sub">Fetching your health records securely</p>
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="pp-shell pp-loading-state">
        <h2>No patient record found.</h2>
        <Link to="/" style={{ color: "#0284c7", fontWeight: "700" }}>Return to Home</Link>
      </div>
    );
  }

  const uniqueDoctorsCount = new Set(appointments.map((a) => a.doctorId || a.doctor?.id).filter(Boolean)).size;

  return (
    <div className="pp-shell">

      {/* ── PROFILE HEADER CARD ── */}
      <div className="pp-profile-header">
        <div className="pp-profile-header-left">
          <div className="pp-avatar-wrap">
            <div className="pp-avatar">
              {patient.name?.[0]?.toUpperCase() || "P"}
            </div>
          </div>
          <div className="pp-profile-info">
            <h1 className="pp-profile-name">{patient.name}</h1>
            <div className="pp-profile-meta">
              <span className="pp-meta-chip">
                <FaEnvelope />
                {patient.user?.email || user?.email || "No email"}
              </span>
              <span className="pp-meta-chip">
                <FaPhone />
                {patient.contact || "No phone"}
              </span>
              {patient.bloodGroup && (
                <span className="pp-meta-chip blood">
                  <FaTint />
                  {patient.bloodGroup}
                </span>
              )}
            </div>
            <div className="pp-quick-stats">
              <div className="pp-qs-item">
                <span className="pp-qs-val">{appointments.length}</span>
                <span className="pp-qs-lbl">Appointments</span>
              </div>
              <div className="pp-qs-divider" />
              <div className="pp-qs-item">
                <span className="pp-qs-val">{uniqueDoctorsCount || (appointments.length > 0 ? 1 : 0)}</span>
                <span className="pp-qs-lbl">Doctors</span>
              </div>
              <div className="pp-qs-divider" />
              <div className="pp-qs-item">
                <span className="pp-qs-val">{consultationNotes.length}</span>
                <span className="pp-qs-lbl">Clinical Notes</span>
              </div>
            </div>
          </div>
        </div>

        <div className="pp-profile-header-actions">
          <button
            type="button"
            className="pp-action-btn primary"
            onClick={() => setIsEditing(true)}
          >
            <FaEdit /> Edit Profile
          </button>
        </div>
      </div>

      {/* ── MAIN CONTENT ── */}
      <div className="pp-main-grid">

        {/* LEFT: PERSONAL INFO */}
        <section className="pp-section-card">
          <div className="pp-section-header">
            <div className="pp-section-icon">
              <FaUserInjured />
            </div>
            <h2 className="pp-section-title">Personal Information</h2>
          </div>

          <div className="pp-info-list">
            <div className="pp-info-row">
              <span className="pp-info-label">Full Name</span>
              <span className="pp-info-value">{patient.name || "—"}</span>
            </div>
            <div className="pp-info-row">
              <span className="pp-info-label">Age</span>
              <span className="pp-info-value">{patient.age ? `${patient.age} years` : "Not provided"}</span>
            </div>
            <div className="pp-info-row">
              <span className="pp-info-label">Biological Sex</span>
              <span className="pp-info-value">{patient.gender || "Not provided"}</span>
            </div>
            <div className="pp-info-row">
              <span className="pp-info-label">Contact Phone</span>
              <span className="pp-info-value">{patient.contact || "Not provided"}</span>
            </div>
            <div className="pp-info-row">
              <span className="pp-info-label">Email Address</span>
              <span className="pp-info-value">{patient.user?.email || user?.email || "Not provided"}</span>
            </div>
            <div className="pp-info-row">
              <span className="pp-info-label">Patient ID</span>
              <span className="pp-info-value" style={{ color: "#0284c7" }}>#PAT-{patient.id}</span>
            </div>
          </div>
        </section>

        {/* RIGHT: HEALTH INFO */}
        <section className="pp-section-card">
          <div className="pp-section-header">
            <div className="pp-section-icon">
              <FaHeartbeat />
            </div>
            <h2 className="pp-section-title">Health Information</h2>
          </div>

          <div className="pp-info-list" style={{ marginBottom: 20 }}>
            <div className="pp-info-row">
              <span className="pp-info-label">Blood Group</span>
              {patient.bloodGroup
                ? <span className="pp-blood-pill">{patient.bloodGroup}</span>
                : <span className="pp-info-value muted">Not specified</span>
              }
            </div>
            <div className="pp-info-row">
              <span className="pp-info-label">Account Role</span>
              <span className="pp-info-value" style={{ textTransform: "capitalize", color: "#0284c7" }}>
                {user?.role || "Patient"}
              </span>
            </div>
          </div>

          <div className="pp-notes-section">
            <span className="pp-notes-label">Medical History &amp; Drug Allergies</span>
            <div className="pp-notes-box">
              {patient.medicalNotes
                ? <p style={{ margin: 0 }}>{patient.medicalNotes}</p>
                : <p className="pp-notes-empty">
                    No conditions, allergies, or medications documented yet. Click &quot;Edit Profile&quot; to add your medical history.
                  </p>
              }
            </div>
          </div>
        </section>

      </div>

      {/* ── EDIT PROFILE MODAL ── */}
      {isEditing && (
        <div className="pp-modal-overlay" onClick={() => setIsEditing(false)}>
          <div className="pp-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="pp-modal-header">
              <h3>Edit Profile</h3>
              <button
                type="button"
                className="pp-modal-close-btn"
                onClick={() => setIsEditing(false)}
              >
                <FaTimes />
              </button>
            </div>

            <form onSubmit={handleSave}>
              <div className="pp-modal-body">
                <div className="pp-form-grid">
                  <div className="pp-form-group">
                    <label>Full Name</label>
                    <input
                      type="text"
                      required
                      className="pp-form-input"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                    />
                  </div>

                  <div className="pp-form-group">
                    <label>Age (Years)</label>
                    <input
                      type="number"
                      min="1"
                      max="125"
                      required
                      className="pp-form-input"
                      value={form.age}
                      onChange={(e) => setForm({ ...form, age: e.target.value })}
                    />
                  </div>

                  <div className="pp-form-group">
                    <label>Biological Sex</label>
                    <select
                      className="pp-form-select"
                      value={form.gender}
                      onChange={(e) => setForm({ ...form, gender: e.target.value })}
                    >
                      <option value="">Select Gender</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <div className="pp-form-group">
                    <label>Contact Phone</label>
                    <input
                      type="text"
                      required
                      className="pp-form-input"
                      value={form.contact}
                      onChange={(e) => setForm({ ...form, contact: e.target.value })}
                    />
                  </div>

                  <div className="pp-form-group" style={{ gridColumn: "span 2" }}>
                    <label>Blood Group</label>
                    <select
                      className="pp-form-select"
                      value={form.bloodGroup}
                      onChange={(e) => setForm({ ...form, bloodGroup: e.target.value })}
                    >
                      <option value="">Not Specified</option>
                      <option value="A+">A+</option>
                      <option value="A-">A-</option>
                      <option value="B+">B+</option>
                      <option value="B-">B-</option>
                      <option value="O+">O+</option>
                      <option value="O-">O-</option>
                      <option value="AB+">AB+</option>
                      <option value="AB-">AB-</option>
                    </select>
                  </div>
                </div>

                <div className="pp-form-group">
                  <label>Medical History, Drug Allergies &amp; Chronic Notes</label>
                  <textarea
                    rows="4"
                    className="pp-form-textarea"
                    placeholder="Document any chronic conditions, known drug allergies, or ongoing medications..."
                    value={form.medicalNotes}
                    onChange={(e) => setForm({ ...form, medicalNotes: e.target.value })}
                  />
                </div>
              </div>

              <div className="pp-modal-footer">
                <button
                  type="button"
                  className="pp-btn-cancel"
                  onClick={() => setIsEditing(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="pp-btn-save"
                >
                  <FaSave />
                  <span>{saving ? "Saving..." : "Save Changes"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
