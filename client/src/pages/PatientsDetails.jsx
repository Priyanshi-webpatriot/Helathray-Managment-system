import { useEffect, useState } from "react";
import API from "../api";
import "../styles/patient.css";
import "../styles/chatbox.css";
import "../styles/consultation.css";
import DoctorChatBox from "../components/DoctorChatBox.jsx";
import ConsultationNote from "../components/ConsultationNote.jsx";
import { useNavigate, useSearchParams } from "react-router-dom";
import { FaArrowLeft, FaChevronLeft, FaChevronRight, FaTimes, FaUserInjured, FaNotesMedical, FaExpandAlt, FaCopy } from "react-icons/fa";
import { BsActivity, BsInbox } from "react-icons/bs";
import { HiOutlineSparkles } from "react-icons/hi";
import { toast } from "react-toastify";

export default function PatientsDetails() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const targetPatientId = searchParams.get("patientId");

  const [patients, setPatients] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [viewingNotePatient, setViewingNotePatient] = useState(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const recordsPerPage = 5;

  const getUserRole = () => {
    return JSON.parse(localStorage.getItem("user"))?.role;
  };

  const fetchPatients = async () => {
    try {
      const user = JSON.parse(localStorage.getItem("user"));

      const res = await API.get("/patients", {
        headers: {
          role: user.role,
          userid: user.id,
        },
      });
      setPatients(res.data);
    } catch (error) {
      console.error("Error fetching patients", error);
    }
  };

  useEffect(() => {
    fetchPatients();
  }, []);

  // Set default selected patient to first patient if available and none selected
  useEffect(() => {
    if (patients.length > 0 && !selectedPatient) {
      if (targetPatientId) {
        const found = patients.find((p) => String(p.id) === String(targetPatientId));
        if (found) {
          setSelectedPatient(found);
          const idx = patients.findIndex((p) => String(p.id) === String(targetPatientId));
          if (idx !== -1) {
            setCurrentPage(Math.floor(idx / recordsPerPage) + 1);
          }
          return;
        }
      }
      setSelectedPatient(patients[0]);
    }
  }, [patients, targetPatientId]);

  // Pagination Logic
  const indexOfLast = currentPage * recordsPerPage;
  const indexOfFirst = indexOfLast - recordsPerPage;
  const currentPatients = patients.slice(indexOfFirst, indexOfLast);
  const totalPages = Math.ceil(patients.length / recordsPerPage);

  return (
    <div className="patients-page">
      {/* Header */}
      <div className="header">
        <div className="header-title-group">
          <button className="back-btn" onClick={() => navigate(-1)} title="Go back">
            <FaArrowLeft />
            <span>Back</span>
          </button>
          <h2>
            <BsActivity className="header-icon" />
            <span>Patients Clinical Analysis</span>
          </h2>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          {selectedPatient && <ConsultationNote patient={selectedPatient} />}
          <span className="header-badge">{patients.length} Registered Records</span>
        </div>
      </div>

      {/* Table */}
      <div className="table-wrapper">
        {patients.length === 0 ? (
          <div className="empty">
            <BsInbox size={28} style={{ marginBottom: "8px", opacity: 0.5 }} />
            <p>No patient clinical records available</p>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Patient</th>
                <th>Age / Sex</th>
                <th>Contact</th>
                <th>Blood</th>
                <th>Status</th>
                <th>Clinical Notes</th>
                <th>Account Email</th>
                <th>AI Workspace</th>
              </tr>
            </thead>

            <tbody>
              {currentPatients.map((p) => {
                const isSelected = selectedPatient?.id === p.id;
                return (
                  <tr key={p.id} className={isSelected ? "row-selected" : ""}>
                    <td>
                      <div className="table-cell-bold">{p.name}</div>
                    </td>
                    <td>{p.age} yrs • {p.gender}</td>
                    <td>
                      <span className="table-cell-muted">{p.contact}</span>
                    </td>
                    <td>
                      <span className="blood-group-badge">{p.bloodGroup || "N/A"}</span>
                    </td>
                    <td>
                      <span className={`status status-${p.status?.toLowerCase()}`}>
                        <span className="status-dot"></span>
                        {p.status || "N/A"}
                      </span>
                    </td>
                    <td>
                      {p.medicalNotes ? (
                        <span
                          className="notes-snippet notes-clickable"
                          onClick={() => setViewingNotePatient(p)}
                          title="Click to view full clinical note"
                        >
                          {p.medicalNotes}
                        </span>
                      ) : (
                        <span className="table-cell-muted">—</span>
                      )}
                    </td>
                    <td>
                      <span className="table-cell-muted">{p.user?.email || "—"}</span>
                    </td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <button
                          className={`analyze-btn ${isSelected ? "active" : ""}`}
                          onClick={() => setSelectedPatient(p)}
                        >
                          <HiOutlineSparkles />
                          <span>{isSelected ? "Analyzing" : "Analyze"}</span>
                        </button>
                        {isSelected && (
                          <button
                            type="button"
                            onClick={() => setSelectedPatient(null)}
                            title="Close patient analysis"
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                              padding: "7px 12px",
                              borderRadius: "8px",
                              border: "1px solid #fecaca",
                              background: "#fef2f2",
                              color: "#dc2626",
                              fontSize: "12.5px",
                              fontWeight: "700",
                              cursor: "pointer",
                              transition: "all 0.2s ease",
                            }}
                          >
                            <FaTimes />
                            <span>Close</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {/* Pagination UI */}
        {patients.length > 0 && (
          <div className="pagination">
            <button
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(currentPage - 1)}
            >
              <FaChevronLeft />
              <span>Prev</span>
            </button>

            <span className="pagination-page-indicator">
              Page {currentPage} of {totalPages || 1}
            </span>

            <button
              disabled={currentPage === totalPages || totalPages === 0}
              onClick={() => setCurrentPage(currentPage + 1)}
            >
              <span>Next</span>
              <FaChevronRight />
            </button>
          </div>
        )}
      </div>

      {/* Doctor AI Assistant is always present on this page */}
      <DoctorChatBox patient={selectedPatient} />

      {/* Clinical Note Full View Modal */}
      {viewingNotePatient && (
        <div className="clinical-note-modal-overlay" onClick={() => setViewingNotePatient(null)}>
          <div className="clinical-note-modal" onClick={(e) => e.stopPropagation()}>
            <div className="clinical-note-modal-header">
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div className="clinical-note-modal-icon">
                  <FaNotesMedical />
                </div>
                <div>
                  <h3>Patient Clinical Medical Note</h3>
                  <p className="clinical-note-modal-subtitle">
                    Patient: <strong>{viewingNotePatient.name}</strong> • {viewingNotePatient.age} yrs • {viewingNotePatient.gender} • Blood Group: <strong style={{ color: "#dc2626" }}>{viewingNotePatient.bloodGroup || "N/A"}</strong>
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setViewingNotePatient(null)}
                title="Close"
              >
                <FaTimes />
              </button>
            </div>
            <div className="clinical-note-modal-body">
              <div className="clinical-note-content-box">
                <p style={{ margin: 0 }}>{viewingNotePatient.medicalNotes || "No clinical notes recorded."}</p>
              </div>
            </div>
            <div className="clinical-note-modal-footer">
              <button
                type="button"
                className="btn-copy-note"
                onClick={() => {
                  navigator.clipboard.writeText(viewingNotePatient.medicalNotes || "");
                  toast.success("Clinical note copied to clipboard");
                }}
              >
                <FaCopy /> Copy Note
              </button>
              <button
                type="button"
                className="btn-close-modal"
                onClick={() => setViewingNotePatient(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}