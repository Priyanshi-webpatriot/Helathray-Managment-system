import { useState, useEffect } from "react";
import API from "../api";
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";
import {
  FaUserMd,
  FaEdit,
  FaHospital,
  FaMapMarkerAlt,
  FaClock,
  FaPhoneAlt,
  FaEnvelope,
  FaAward,
  FaTimes,
  FaCheckCircle,
  FaArrowLeft,
  FaBuilding,
  FaStethoscope,
} from "react-icons/fa";
import "../styles/doctorWebsite.css";
import "../styles/patientWebsite.css";

export default function DoctorProfile() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem("user") || "null");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [doctorId, setDoctorId] = useState(null);

  const [form, setForm] = useState({
    name: "",
    specialty: "",
    experience: "",
    mobile: "",
    email: "",
    clinicName: "",
    city: "",
    state: "",
    address: "",
    timing: "",
  });

  // Modal edit form state
  const [editForm, setEditForm] = useState({ ...form });

  const fetchDoctorProfile = async () => {
    if (!user || (user.role?.toLowerCase() !== "doctor" && user.role?.toLowerCase() !== "admin")) {
      toast.error("Access denied. Doctor profile is only accessible to logged-in doctors.", {
        toastId: "doctor-profile-access-error",
      });
      navigate("/");
      return;
    }

    const doctorIdToFetch = user.id || user.userId || 1;

    try {
      setLoading(true);
      const res = await API.get(`/doctors/profile/${doctorIdToFetch}`, {
        headers: {
          role: user.role,
          userid: doctorIdToFetch,
        },
      });
      const doc = res.data;

      setDoctorId(doc.id);
      const profileData = {
        name: doc.name || user.name || "",
        specialty: doc.specialty || "",
        experience: doc.experience || "",
        mobile: doc.mobile || "",
        email: doc.user?.email || user.email || "",
        clinicName: doc.clinicName || "",
        city: doc.city || "",
        state: doc.state || "",
        address: doc.address || "",
        timing: doc.timing || "",
      };
      setForm(profileData);
      setEditForm(profileData);
    } catch (error) {
      console.error("Failed to load doctor profile:", error);
      toast.error(error.response?.data?.error || "Could not fetch doctor profile details.", {
        toastId: "doctor-profile-error",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDoctorProfile();
  }, []);

  const openEditModal = () => {
    setEditForm({ ...form });
    setIsEditModalOpen(true);
  };

  const handleSave = async (e) => {
    e?.preventDefault();
    if (!doctorId) {
      toast.error("Doctor profile ID not found.");
      return;
    }

    try {
      setSaving(true);
      await API.put(`/doctors/${doctorId}`, editForm, {
        headers: { role: user.role },
      });

      // Update localStorage user name if changed
      if (editForm.name && user) {
        const updatedUser = { ...user, name: editForm.name };
        localStorage.setItem("user", JSON.stringify(updatedUser));
      }

      setForm({ ...editForm });
      toast.success("Doctor practice profile updated successfully!");
      setIsEditModalOpen(false);
      fetchDoctorProfile();
    } catch (error) {
      console.error("Failed to update profile:", error);
      toast.error(error.response?.data?.error || "Failed to save profile changes.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="doctor-profile-loading">
        <div className="loading-spinner"></div>
        <p>Loading Doctor Practice Profile...</p>
      </div>
    );
  }

  return (
    <div className="doctor-profile-shell">
      {/* ── BREADCRUMB / BACK ── */}
      <div className="doctor-profile-nav">
        <button
          type="button"
          className="doctor-profile-back-btn"
          onClick={() => navigate("/dashboard")}
        >
          <FaArrowLeft />
          <span>Back to Dashboard</span>
        </button>
      </div>

      {/* ── PROFILE HERO HEADER BANNER ── */}
      <div className="doctor-profile-hero-card">
        <div className="doctor-hero-left-content">
          <div className="doctor-profile-avatar-box">
            <span>{form.name?.[0]?.toUpperCase() || "D"}</span>
            <div className="doctor-verified-badge" title="Verified Practitioner">
              <FaCheckCircle />
            </div>
          </div>

          <div className="doctor-hero-info">
            <h1 className="doctor-hero-name">Dr. {form.name}</h1>
            <div className="doctor-hero-tags-row">
              <span className="doctor-spec-tag">
                <FaStethoscope className="hero-tag-icon" />
                {form.specialty || "General Medicine"}
              </span>
              <span className="doctor-exp-tag">
                <FaAward className="hero-tag-icon" />
                {form.experience ? `${form.experience} Experience` : "5+ Years Experience"}
              </span>
              {form.clinicName && (
                <span className="doctor-clinic-tag">
                  <FaHospital className="hero-tag-icon" />
                  {form.clinicName}
                </span>
              )}
            </div>
          </div>
        </div>

        <button
          type="button"
          className="doctor-open-edit-btn"
          onClick={openEditModal}
        >
          <FaEdit />
          <span>Edit Practice Profile</span>
        </button>
      </div>

      {/* ── PRACTICE PROFILE DETAILS CARDS ── */}
      <div className="doctor-details-grid">
        {/* Card 1: Clinical Practice Overview */}
        <div className="doctor-detail-card">
          <div className="doctor-card-header">
            <div className="doctor-card-icon-box blue">
              <FaUserMd />
            </div>
            <div>
              <h3>Clinical Practice Details</h3>
              <p>Specialization and consultation credentials</p>
            </div>
          </div>

          <div className="doctor-card-fields-list">
            <div className="doctor-info-row">
              <span className="doctor-info-label">Doctor Name</span>
              <strong className="doctor-info-value">Dr. {form.name}</strong>
            </div>

            <div className="doctor-info-row">
              <span className="doctor-info-label">Medical Specialty</span>
              <strong className="doctor-info-value">{form.specialty || "General Medicine"}</strong>
            </div>

            <div className="doctor-info-row">
              <span className="doctor-info-label">Clinical Experience</span>
              <strong className="doctor-info-value">{form.experience ? `${form.experience}` : "5+ Years"}</strong>
            </div>

            <div className="doctor-info-row">
              <span className="doctor-info-label">OPD Timings</span>
              <strong className="doctor-info-value">
                <FaClock style={{ marginRight: 6, color: "#0284c7" }} />
                {form.timing || "09:00 AM - 08:00 PM"}
              </strong>
            </div>
          </div>
        </div>

        {/* Card 2: Hospital & Location Details */}
        <div className="doctor-detail-card">
          <div className="doctor-card-header">
            <div className="doctor-card-icon-box teal">
              <FaHospital />
            </div>
            <div>
              <h3>Clinic Location &amp; Contact</h3>
              <p>Physical outpatient center and patient contact</p>
            </div>
          </div>

          <div className="doctor-card-fields-list">
            <div className="doctor-info-row">
              <span className="doctor-info-label">Hospital / Clinic</span>
              <strong className="doctor-info-value">{form.clinicName || "CareScribe Clinic"}</strong>
            </div>

            <div className="doctor-info-row">
              <span className="doctor-info-label">Contact Phone</span>
              <strong className="doctor-info-value">
                <FaPhoneAlt style={{ marginRight: 6, color: "#10b981" }} />
                {form.mobile || "Not specified"}
              </strong>
            </div>

            <div className="doctor-info-row">
              <span className="doctor-info-label">Account Email</span>
              <strong className="doctor-info-value">
                <FaEnvelope style={{ marginRight: 6, color: "#6366f1" }} />
                {form.email || user?.email || "—"}
              </strong>
            </div>

            <div className="doctor-info-row">
              <span className="doctor-info-label">City &amp; State</span>
              <strong className="doctor-info-value">
                <FaBuilding style={{ marginRight: 6, color: "#0284c7" }} />
                {form.city || "Ahmedabad"}{form.state ? `, ${form.state}` : ""}
              </strong>
            </div>

            <div className="doctor-info-row full">
              <span className="doctor-info-label">Clinic Address</span>
              <p className="doctor-address-block">
                <FaMapMarkerAlt style={{ marginRight: 6, color: "#e11d48", flexShrink: 0, marginTop: 2 }} />
                <span>{form.address || "Address not provided"}</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── DOCTOR EDIT PROFILE MODAL (EXACT SAME DESIGN AS PATIENT DASHBOARD) ── */}
      {isEditModalOpen && (
        <div
          className="patient-modal-overlay"
          onClick={() => !saving && setIsEditModalOpen(false)}
        >
          <div className="patient-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="patient-modal-header">
              <div>
                <h3>Update Practice Profile</h3>
                <p>Keep your clinical OPD details, specialty, and clinic location up to date</p>
              </div>
              <button
                type="button"
                className="patient-modal-close-btn"
                onClick={() => setIsEditModalOpen(false)}
                disabled={saving}
              >
                <FaTimes />
              </button>
            </div>

            <form onSubmit={handleSave}>
              <div className="patient-modal-body">
                <div className="modal-form-grid">
                  <div className="modal-form-field">
                    <label>Doctor Full Name *</label>
                    <input
                      type="text"
                      required
                      value={editForm.name}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                      placeholder="e.g. Piyush Sharma"
                    />
                  </div>

                  <div className="modal-form-field">
                    <label>Medical Specialty *</label>
                    <input
                      type="text"
                      required
                      value={editForm.specialty}
                      onChange={(e) => setEditForm({ ...editForm, specialty: e.target.value })}
                      placeholder="e.g. Ophthalmology"
                    />
                  </div>

                  <div className="modal-form-field">
                    <label>Experience (Years)</label>
                    <input
                      type="text"
                      value={editForm.experience}
                      onChange={(e) => setEditForm({ ...editForm, experience: e.target.value })}
                      placeholder="e.g. 7 Years"
                    />
                  </div>

                  <div className="modal-form-field">
                    <label>Contact Phone *</label>
                    <input
                      type="text"
                      required
                      value={editForm.mobile}
                      onChange={(e) => setEditForm({ ...editForm, mobile: e.target.value })}
                      placeholder="e.g. 9876543210"
                    />
                  </div>

                  <div className="modal-form-field">
                    <label>Clinic / Hospital Name</label>
                    <input
                      type="text"
                      value={editForm.clinicName}
                      onChange={(e) => setEditForm({ ...editForm, clinicName: e.target.value })}
                      placeholder="e.g. Spandan Hospital"
                    />
                  </div>

                  <div className="modal-form-field">
                    <label>City</label>
                    <input
                      type="text"
                      value={editForm.city}
                      onChange={(e) => setEditForm({ ...editForm, city: e.target.value })}
                      placeholder="e.g. Ahmedabad"
                    />
                  </div>

                  <div className="modal-form-field">
                    <label>State / Province</label>
                    <input
                      type="text"
                      value={editForm.state}
                      onChange={(e) => setEditForm({ ...editForm, state: e.target.value })}
                      placeholder="e.g. Gujarat"
                    />
                  </div>

                  <div className="modal-form-field">
                    <label>OPD Consultation Timings</label>
                    <input
                      type="text"
                      value={editForm.timing}
                      onChange={(e) => setEditForm({ ...editForm, timing: e.target.value })}
                      placeholder="e.g. 09:00 AM - 08:00 PM"
                    />
                  </div>

                  <div className="modal-form-field full-span">
                    <label>Full Clinic Address</label>
                    <textarea
                      rows={3}
                      value={editForm.address}
                      onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                      placeholder="e.g. Suvidha Complex, near Vejalpur Bus Stop"
                    />
                  </div>
                </div>
              </div>

              <div className="patient-modal-footer">
                <button
                  type="button"
                  className="modal-cancel-btn"
                  onClick={() => setIsEditModalOpen(false)}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="modal-save-btn"
                  disabled={saving}
                >
                  {saving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
