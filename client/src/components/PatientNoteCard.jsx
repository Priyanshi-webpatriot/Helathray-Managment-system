import React, { useEffect, useState, useMemo } from "react";
import API from "../api";
import "./patientNote.css";
import {
  FiFileText,
  FiSearch,
  FiCalendar,
  FiChevronLeft,
  FiX,
  FiCheckCircle,
  FiAlertCircle,
} from "react-icons/fi";
import { FaUserMd, FaPills } from "react-icons/fa";

const getSpecialtyColor = (specialty = "") => {
  const s = specialty.toLowerCase();
  if (s.includes("cardio")) return { bg: "#fef2f2", text: "#dc2626", border: "#fecaca", avatar: "#ef4444" };
  if (s.includes("neuro")) return { bg: "#f5f3ff", text: "#7c3aed", border: "#ddd6fe", avatar: "#8b5cf6" };
  if (s.includes("ortho")) return { bg: "#fff7ed", text: "#ea580c", border: "#fed7aa", avatar: "#f97316" };
  if (s.includes("derm")) return { bg: "#fdf2f8", text: "#db2777", border: "#fbcfe8", avatar: "#ec4899" };
  if (s.includes("pedia")) return { bg: "#ecfeff", text: "#0891b2", border: "#a5f3fc", avatar: "#06b6d4" };
  return { bg: "#eff6ff", text: "#0284c7", border: "#bae6fd", avatar: "#0284c7" };
};

const getDoctorInitials = (name = "") => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "DR";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const parseNotePreview = (rawText = "") => {
  const lines = rawText
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const contentLines = lines.filter((l) => !l.startsWith("From"));
  const snippet = contentLines
    .slice(0, 2)
    .join(" ")
    .replace(/^[-•*\d.)\s]+/, "");
  const hasMeds = /medication|prescri|tablet|mg|dosage|capsule|syrup|rx/i.test(rawText);
  return { snippet: snippet || "Consultation summary available.", hasMeds };
};

const renderFormattedLine = (line, idx) => {
  const trimmed = line.trim();
  if (!trimmed) return null;

  if (/^From\b/i.test(trimmed)) {
    return (
      <div key={idx} className="pnw-note-from">
        <FaUserMd />
        <span>{trimmed}</span>
      </div>
    );
  }

  const numberedMatch = trimmed.match(/^(\d+)[.)]\s+(.*)$/);
  if (numberedMatch) {
    return (
      <div key={idx} className="pnw-note-step">
        <span className="pnw-step-num">{numberedMatch[1]}</span>
        <span>{numberedMatch[2]}</span>
      </div>
    );
  }

  if (/^[-•*]\s+/.test(trimmed)) {
    return (
      <div key={idx} className="pnw-note-bullet">
        <span className="pnw-bullet-dot" />
        <span>{trimmed.replace(/^[-•*]\s+/, "")}</span>
      </div>
    );
  }

  const isSectionHeading =
    (trimmed.endsWith(":") && trimmed.length <= 60) ||
    /^(summary|diagnosis|assessment|plan|medications|prescription|instructions|follow[- ]?up|advice|notes|symptoms|recommendations)\b[:\-]?$/i.test(
      trimmed
    );

  if (isSectionHeading) {
    return (
      <h4 key={idx} className="pnw-note-section-title">
        {trimmed.replace(/:$/, "")}
      </h4>
    );
  }

  return (
    <p key={idx} className="pnw-note-paragraph">
      {trimmed}
    </p>
  );
};

export default function PatientNoteCard({ isDedicatedPage = false }) {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedNote, setSelectedNote] = useState(null);
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSpecialty, setSelectedSpecialty] = useState("All");

  const user = JSON.parse(localStorage.getItem("user") || "{}");

  useEffect(() => {
    if (user?.id) {
      fetchMyNotes();
    } else {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchMyNotes = async () => {
    try {
      const res = await API.get("/consultation-notes/my-notes", {
        headers: { role: user.role, userid: user.id },
      });
      setNotes(res.data || []);
    } catch (err) {
      console.error("Failed to load notes", err);
    }
    setLoading(false);
  };

  const specialties = useMemo(() => {
    const specs = new Set(notes.map((n) => n.doctor?.specialty).filter(Boolean));
    return ["All", ...Array.from(specs)];
  }, [notes]);

  const filteredNotes = useMemo(() => {
    return notes.filter((n) => {
      const matchesSearch =
        !searchQuery ||
        n.doctor?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        n.doctor?.specialty?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        n.patientNote?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesSpec =
        selectedSpecialty === "All" || n.doctor?.specialty === selectedSpecialty;

      return matchesSearch && matchesSpec;
    });
  }, [notes, searchQuery, selectedSpecialty]);

  const activeNote = useMemo(() => {
    if (filteredNotes.length === 0) return null;
    if (selectedNote && filteredNotes.some((n) => n.id === selectedNote.id)) {
      return selectedNote;
    }
    return filteredNotes[0];
  }, [filteredNotes, selectedNote]);

  const stats = useMemo(() => {
    const total = notes.length;
    const docCount = new Set(notes.map((n) => n.doctor?.name).filter(Boolean)).size;
    const latestDate =
      notes.length > 0
        ? new Date(notes[0].createdAt).toLocaleDateString("en-IN", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })
        : "—";
    return { total, docCount, latestDate };
  }, [notes]);

  const handleSelectNote = (note) => {
    setSelectedNote(note);
    setMobileDetailOpen(true);
  };

  if (loading) {
    return (
      <div className="pnw-shell">
        <div className="pnw-state-card">
          <div className="pnw-spinner" />
          <h3 className="pnw-state-title">Loading your consultation notes</h3>
          <p className="pnw-state-desc">Fetching your visit summaries and doctor instructions...</p>
        </div>
      </div>
    );
  }

  if (notes.length === 0) {
    if (!isDedicatedPage) return null;
    return (
      <div className="pnw-shell">
        <div className="pnw-state-card">
          <div className="pnw-state-icon">
            <FiFileText />
          </div>
          <h3 className="pnw-state-title">No consultation notes yet</h3>
          <p className="pnw-state-desc">
            After your doctor completes and approves a consultation summary, it will appear here
            for you to read anytime.
          </p>
        </div>
      </div>
    );
  }

  const activeSpecColor = activeNote
    ? getSpecialtyColor(activeNote.doctor?.specialty)
    : getSpecialtyColor("");

  return (
    <div className="pnw-shell">
      {/* Clean Header */}
      <div className="pnw-header">
        <div className="pnw-title-group">
          <span className="pnw-eyebrow">
            <FiFileText />
            Patient Visit Summaries
          </span>
          <h1 className="pnw-title">My Consultation Notes</h1>
          <p className="pnw-subtitle">
            Select any visit on the left to read your doctor&apos;s notes, medications, and care
            instructions.
          </p>
        </div>

        <div className="pnw-stats-row">
          <div className="pnw-stat-pill">
            <span>Total Notes</span>
            <strong>{stats.total}</strong>
          </div>
          <div className="pnw-stat-pill">
            <span>Doctors</span>
            <strong>{stats.docCount}</strong>
          </div>
          <div className="pnw-stat-pill">
            <span>Latest Visit</span>
            <strong>{stats.latestDate}</strong>
          </div>
        </div>
      </div>

      {/* Search & Specialty Filters */}
      <div className="pnw-toolbar">
        <div className="pnw-search-box">
          <FiSearch className="pnw-search-icon" />
          <input
            type="text"
            className="pnw-search-input"
            placeholder="Search by doctor, specialty, or note..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              type="button"
              className="pnw-clear-btn"
              onClick={() => setSearchQuery("")}
              aria-label="Clear search"
            >
              <FiX />
            </button>
          )}
        </div>

        <div className="pnw-filter-chips">
          {specialties.map((spec) => (
            <button
              key={spec}
              type="button"
              className={`pnw-chip ${selectedSpecialty === spec ? "active" : ""}`}
              onClick={() => setSelectedSpecialty(spec)}
            >
              {spec}
            </button>
          ))}
        </div>
      </div>

      {/* Main Split Workspace */}
      {filteredNotes.length === 0 ? (
        <div className="pnw-state-card">
          <div className="pnw-state-icon">
            <FiSearch />
          </div>
          <h3 className="pnw-state-title">No matching notes found</h3>
          <p className="pnw-state-desc">
            Try clearing your search or switching the specialty filter to view all your notes.
          </p>
        </div>
      ) : (
        <div className={`pnw-workspace ${mobileDetailOpen ? "has-selection" : ""}`}>
          {/* Left Sidebar: Notes List */}
          <aside className="pnw-sidebar" aria-label="Consultation notes list">
            <div className="pnw-sidebar-header">
              <span>Consultations</span>
              <span className="pnw-count-badge">{filteredNotes.length}</span>
            </div>

            <div className="pnw-list">
              {filteredNotes.map((note) => {
                const specColor = getSpecialtyColor(note.doctor?.specialty);
                const { snippet, hasMeds } = parseNotePreview(note.patientNote);
                const isActive = activeNote?.id === note.id;
                const formattedDate = new Date(note.createdAt).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                });

                return (
                  <button
                    key={note.id}
                    type="button"
                    className={`pnw-list-item ${isActive ? "active" : ""}`}
                    onClick={() => handleSelectNote(note)}
                  >
                    <div className="pnw-item-top">
                      <div
                        className="pnw-avatar-sm"
                        style={{ backgroundColor: specColor.avatar }}
                      >
                        {getDoctorInitials(note.doctor?.name)}
                      </div>
                      <div className="pnw-item-meta">
                        <div className="pnw-item-doc">
                          Dr. {note.doctor?.name || "Attending Physician"}
                        </div>
                        <div className="pnw-item-sub">
                          <FiCalendar />
                          <span>{formattedDate}</span>
                        </div>
                      </div>
                    </div>

                    <p className="pnw-item-snippet">{snippet}</p>

                    <div className="pnw-item-tags">
                      <span
                        className="pnw-spec-tag"
                        style={{
                          backgroundColor: specColor.bg,
                          color: specColor.text,
                          border: `1px solid ${specColor.border}`,
                        }}
                      >
                        {note.doctor?.specialty || "General Medicine"}
                      </span>

                      {hasMeds && (
                        <span className="pnw-rx-tag">
                          <FaPills />
                          Rx Included
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </aside>

          {/* Right Reader Pane */}
          {activeNote && (
            <section className="pnw-reader" aria-label="Selected consultation note">
              <button
                type="button"
                className="pnw-mobile-back"
                onClick={() => setMobileDetailOpen(false)}
              >
                <FiChevronLeft />
                Back to all notes
              </button>

              <div className="pnw-reader-header">
                <div className="pnw-reader-doc-wrap">
                  <div
                    className="pnw-avatar-lg"
                    style={{ backgroundColor: activeSpecColor.avatar }}
                  >
                    {getDoctorInitials(activeNote.doctor?.name)}
                  </div>
                  <div>
                    <h2 className="pnw-reader-doc">
                      Dr. {activeNote.doctor?.name || "Attending Physician"}
                    </h2>
                    <div className="pnw-reader-sub">
                      <span
                        className="pnw-spec-tag"
                        style={{
                          backgroundColor: activeSpecColor.bg,
                          color: activeSpecColor.text,
                          border: `1px solid ${activeSpecColor.border}`,
                        }}
                      >
                        {activeNote.doctor?.specialty || "General Medicine"}
                      </span>
                      <span>
                        <FiCalendar style={{ verticalAlign: "-2px", marginRight: 5 }} />
                        {new Date(activeNote.createdAt).toLocaleDateString("en-IN", {
                          weekday: "short",
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        })}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="pnw-reader-actions">
                  <span className="pnw-signed-pill">
                    <FiCheckCircle />
                    Signed by Doctor
                  </span>
                </div>
              </div>

              <div className="pnw-reader-body">
                <div className="pnw-note-content">
                  {(activeNote.patientNote || "")
                    .split("\n")
                    .map((line, idx) => renderFormattedLine(line, idx))}
                </div>

                <div className="pnw-safety-box">
                  <FiAlertCircle className="pnw-safety-icon" />
                  <div>
                    <p className="pnw-safety-title">Care &amp; Medication Reminder</p>
                    <p className="pnw-safety-text">
                      Please follow the instructions and dosage noted above. Contact your doctor or
                      clinic if you experience new symptoms or have questions about your treatment.
                    </p>
                  </div>
                </div>
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
