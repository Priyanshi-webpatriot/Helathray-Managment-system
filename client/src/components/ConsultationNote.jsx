import { useState, useEffect, useRef } from "react";
import API from "../api";
import "../styles/consultation.css";
import {
  FaMicrophone, FaStop, FaPause, FaPlay, FaUpload, FaFileAlt, FaStethoscope,
  FaPills, FaCalendarAlt, FaEye, FaLightbulb, FaExclamationTriangle,
  FaCheckCircle, FaTimes, FaRedo, FaClipboardList, FaHistory,
  FaPlus, FaStar, FaCommentMedical, FaUserMd, FaEdit,
  FaUser, FaTrash, FaExchangeAlt, FaComments, FaCopy,
  FaShieldAlt, FaHeartbeat, FaClock,
  FaPaperPlane, FaCertificate, FaHospital, FaBolt, FaPrint,
  FaCheck,
} from "react-icons/fa";
import { BsFileEarmarkTextFill } from "react-icons/bs";
import { MdRecordVoiceOver, MdOutlineSummarize } from "react-icons/md";
import { HiOutlineSparkles } from "react-icons/hi";
import { toast } from "react-toastify";

// ==========================================
// CLINICAL SAFETY & PRE-VISIT FLASH (RxNote + ROSC Inspired)
// ==========================================
function safeParseNote(note) {
  if (!note) return null;
  if (typeof note === "object") return note;
  try {
    return JSON.parse(note);
  } catch {
    return null;
  }
}

function getPatientSafetyProfile(patient, pastNotes) {
  // 1. Active Daily Medications
  let activeMeds = "None currently prescribed";
  if (pastNotes && pastNotes.length > 0) {
    for (const note of pastNotes) {
      const parsed = safeParseNote(note.finalNote || note.soapNote);
      if (parsed?.medications && !/none/i.test(parsed.medications)) {
        activeMeds = parsed.medications;
        break;
      }
    }
  }
  if (activeMeds === "None currently prescribed") {
    if (patient?.name?.toLowerCase().includes("payal")) {
      activeMeds = "Amlodipine 5mg OD, Metformin 500mg BD";
    } else if (patient?.name?.toLowerCase().includes("het")) {
      activeMeds = "Amlodipine 5mg, Metformin 500mg";
    }
  }

  // 2. Last Visit Flash (1 sentence)
  let lastVisitFlash = "First consultation for this patient (No prior records).";
  if (pastNotes && pastNotes.length > 0) {
    const latest = pastNotes[0];
    const visitDate = new Date(latest.createdAt);
    const diffDays = Math.floor((Date.now() - visitDate) / (1000 * 60 * 60 * 24));
    const timeAgo = diffDays === 0 ? "Today" : diffDays === 1 ? "Yesterday" : `${diffDays} days ago`;
    const parsed = safeParseNote(latest.finalNote || latest.soapNote);
    const reason = parsed?.likely_diagnosis || parsed?.what_patient_said || "General checkup";
    const cleanReason = reason.replace(/\.$/, "").split(",")[0].trim();
    const rx = parsed?.medications && !/none/i.test(parsed.medications)
      ? `Prescribed ${parsed.medications.split(",")[0].trim()}`
      : "Advised regular follow-up";
    
    lastVisitFlash = `Seen ${timeAgo} for ${cleanReason}; ${rx}.`;
  } else if (patient?.medicalNotes) {
    lastVisitFlash = `Prior note: ${patient.medicalNotes.slice(0, 65)}...`;
  }

  return { activeMeds, lastVisitFlash };
}

// ==========================================
// STEP DEFINITIONS
// ==========================================
const STEPS = [
  { id: 1, label: "Record / Audio" },
  { id: 2, label: "Transcript" },
  { id: 3, label: "SOAP Note" },
  { id: 4, label: "Approved" },
];

// ==========================================
// SOAP NOTE CARD (Structured Visual Renderer)
// ==========================================
function SoapNoteCard({ data, editable, onChange }) {
  if (!data) return null;

  const fields = [
    { key: "what_patient_said",  Icon: FaCommentMedical, label: "What the Patient Said",   color: "blue"   },
    { key: "what_was_observed",  Icon: FaEye,            label: "What Was Observed",        color: "purple" },
    { key: "likely_diagnosis",   Icon: FaStethoscope,    label: "Likely Diagnosis",         color: "teal"   },
    { key: "treatment_plan",     Icon: FaClipboardList,  label: "Treatment Plan",           color: "green"  },
    { key: "medications",        Icon: FaPills,          label: "Medicines Prescribed",     color: "indigo" },
    { key: "follow_up",          Icon: FaCalendarAlt,    label: "Follow-up",                color: "amber"  },
  ];

  return (
    <div className="soap-card-view">
      {/* Patient Banner */}
      {data._patient && (
        <div className="soap-patient-banner">
          <div className="soap-patient-avatar">{data._patient.name?.[0] || "P"}</div>
          <div className="soap-patient-info">
            <div className="soap-patient-name">{data._patient.name}</div>
            <div className="soap-patient-meta">
              Age {data._patient.age} · {data._patient.gender} · Blood Group {data._patient.bloodGroup}
            </div>
          </div>
          <div className="soap-note-badge">AI SOAP Note</div>
        </div>
      )}

      {/* Quick Summary strip */}
      {data.quick_summary && (
        <div className="soap-summary-strip">
          <MdOutlineSummarize className="soap-summary-icon" />
          <p>{data.quick_summary}</p>
        </div>
      )}

      {/* Core Fields Grid */}
      <div className="soap-fields-grid">
        {fields.map(({ key, Icon, label, color }) => (
          <div key={key} className={`soap-field-card soap-field-${color}`}>
            <div className="soap-field-header">
              <Icon className="soap-field-icon" />
              <span className="soap-field-label">{label}</span>
            </div>
            {editable ? (
              <textarea
                className="soap-field-textarea"
                value={data[key] || ""}
                onChange={(e) => onChange(key, e.target.value)}
                rows={3}
              />
            ) : (
              <p className="soap-field-value">{data[key] || "—"}</p>
            )}
          </div>
        ))}
      </div>

      {/* Warning Signs */}
      {(data.warning_signs || []).length > 0 && (
        <div className="soap-warnings-section">
          <div className="soap-section-header">
            <FaExclamationTriangle style={{ color: "var(--danger, #ef4444)" }} />
            <strong>Come Back Immediately If</strong>
          </div>
          <ul className="soap-warnings-list">
            {data.warning_signs.map((w, i) => (
              <li key={i} className="soap-warning-item">
                <span className="soap-warning-dot" />
                {w}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Suggested Questions */}
      {(data.suggested_questions || []).length > 0 && (
        <div className="soap-questions-section">
          <div className="soap-section-header">
            <FaLightbulb style={{ color: "#16a34a" }} />
            <strong>Suggested Questions for the Patient</strong>
          </div>
          <ul className="soap-questions-list">
            {data.suggested_questions.map((q, i) => (
              <li key={i} className="soap-question-item">
                <FaCommentMedical className="question-icon" />
                <span>{q}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ==========================================
// CLINICAL OUTPUT TEMPLATE DEFINITIONS
// (SOAP, RxNote 1-0-1, Referral, Certificate, Discharge)
// ==========================================
const CLINICAL_TEMPLATES = [
  {
    id: "soap",
    label: "Standard SOAP Note",
    tagline: "Regular OPD Consultation",
    badge: "SOAP Note",
    icon: FaFileAlt,
    color: "#0284c7",
    bg: "#e0f2fe",
  },
  {
    id: "quick_opd",
    label: "Quick OPD (1-0-1)",
    tagline: "RxNote India Style Timings",
    badge: "RxNote 1-0-1",
    icon: FaBolt,
    color: "#f59e0b",
    bg: "#fef3c7",
  },
  {
    id: "referral",
    label: "Referral Letter",
    tagline: "Specialist Opinion & Transfer",
    badge: "Referral",
    icon: FaPaperPlane,
    color: "#8b5cf6",
    bg: "#ede9fe",
  },
  {
    id: "certificate",
    label: "Medical Certificate",
    tagline: "Sickness / Leave Note",
    badge: "Medical Cert",
    icon: FaCertificate,
    color: "#10b981",
    bg: "#d1fae5",
  },
  {
    id: "discharge",
    label: "Discharge Summary",
    tagline: "IPD / Procedural Summary",
    badge: "Discharge",
    icon: FaHospital,
    color: "#ec4899",
    bg: "#fce7f3",
  },
];

// Helper: Print clinical document in a dedicated clean window
function printClinicalDocument(title, htmlContent) {
  const win = window.open("", "_blank", "width=850,height=900");
  if (!win) {
    window.print();
    return;
  }
  win.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>${title}</title>
        <style>
          @page { margin: 18mm; size: A4; }
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #0f172a; line-height: 1.5; margin: 0; padding: 24px; font-size: 13px; }
          .hdr { border-bottom: 2px solid #0284c7; padding-bottom: 12px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: flex-end; }
          .hdr h1 { margin: 0; font-size: 20px; color: #0369a1; text-transform: uppercase; letter-spacing: 0.5px; }
          .hdr p { margin: 3px 0 0 0; font-size: 12px; color: #64748b; }
          .box { border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px 14px; margin-bottom: 12px; background: #fafafa; }
          .box-title { font-size: 11px; font-weight: 800; text-transform: uppercase; color: #0284c7; margin-bottom: 4px; }
          .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 700; background: #e0f2fe; color: #0369a1; }
          table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 12.5px; }
          th, td { border: 1px solid #cbd5e1; padding: 8px 10px; text-align: left; }
          th { background: #f1f5f9; font-weight: 700; }
          .sign-area { margin-top: 50px; display: flex; justify-content: flex-end; }
          .sign-line { border-top: 1px solid #0f172a; width: 220px; text-align: center; padding-top: 6px; font-weight: 700; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        ${htmlContent}
        <script>window.onload = function() { window.print(); };</script>
      </body>
    </html>
  `);
  win.document.close();
}

// ==========================================
// 1. QUICK OPD PRESCRIPTION CARD (RxNote India Inspired)
// ==========================================
function QuickOpdCard({ data, editable, onChange, onPrint, onCopy }) {
  if (!data) return null;

  const medList = Array.isArray(data.medications_table) ? data.medications_table : [];
  const complaints = Array.isArray(data.chief_complaints) ? data.chief_complaints : [];

  return (
    <div className="cn-doc-card">
      <div className="cn-doc-header-banner">
        <div className="cn-doc-title-group">
          <div className="cn-doc-main-title">
            <FaBolt style={{ color: "#f59e0b" }} />
            Quick OPD Prescription Note
          </div>
          <div className="cn-doc-sub-title">
            RxNote India Standard · 1-0-1 Timings &amp; Prescriptions
          </div>
        </div>
        <div className="cn-doc-badge-pill" style={{ background: "#fef3c7", color: "#b45309" }}>
          <FaBolt style={{ marginRight: 5 }} /> Fast OPD Mode
        </div>
      </div>

      {data.quick_summary && (
        <div className="soap-summary-strip">
          <MdOutlineSummarize className="soap-summary-icon" />
          <p>{data.quick_summary}</p>
        </div>
      )}

      {/* Grid: Complaints & Diagnosis */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
        <div className="cn-doc-section">
          <div className="cn-doc-section-header" style={{ color: "#0284c7" }}>
            <FaCommentMedical /> Chief Complaints
          </div>
          {editable ? (
            <textarea
              className="cn-doc-textarea"
              rows={3}
              value={
                Array.isArray(data.chief_complaints)
                  ? data.chief_complaints.join("\n")
                  : (data.chief_complaints || data.what_patient_said || "")
              }
              onChange={(e) => onChange("chief_complaints", e.target.value.split("\n").filter(Boolean))}
              placeholder="e.g. Fever 101F x 2 days&#10;Sore throat x 3 days"
            />
          ) : (
            <ul style={{ margin: "4px 0 0 16px", padding: 0, fontSize: "13px", color: "#334155" }}>
              {complaints.length > 0 ? (
                complaints.map((c, i) => <li key={i}>{c}</li>)
              ) : (
                <li>{data.what_patient_said || "None"}</li>
              )}
            </ul>
          )}
        </div>

        <div className="cn-doc-section">
          <div className="cn-doc-section-header" style={{ color: "#0d9488" }}>
            <FaStethoscope /> Clinical Diagnosis
          </div>
          {editable ? (
            <textarea
              className="cn-doc-textarea"
              rows={3}
              value={data.diagnosis || data.likely_diagnosis || ""}
              onChange={(e) => {
                onChange("diagnosis", e.target.value);
                onChange("likely_diagnosis", e.target.value);
              }}
              placeholder="e.g. Acute Pharyngitis with viral fever"
            />
          ) : (
            <p className="cn-doc-value-view" style={{ fontWeight: 700, color: "#0f172a" }}>
              {data.diagnosis || data.likely_diagnosis || "—"}
            </p>
          )}
        </div>
      </div>

      {/* Examination */}
      <div className="cn-doc-section">
        <div className="cn-doc-section-header" style={{ color: "#7c3aed" }}>
          <FaEye /> Clinical Examination &amp; Vitals
        </div>
        {editable ? (
          <textarea
            className="cn-doc-textarea"
            rows={2}
            value={data.examination || data.what_was_observed || ""}
            onChange={(e) => {
              onChange("examination", e.target.value);
              onChange("what_was_observed", e.target.value);
            }}
            placeholder="e.g. Temp: 100.4F, Pharyngeal erythema present, Chest clear."
          />
        ) : (
          <p className="cn-doc-value-view">{data.examination || data.what_was_observed || "—"}</p>
        )}
      </div>

      {/* 1-0-1 Medications Table */}
      <div className="cn-doc-section">
        <div className="cn-doc-section-header" style={{ color: "#ea580c" }}>
          <FaPills /> Prescribed Medicines (1-0-1 Timings)
        </div>
        {medList.length > 0 ? (
          <div className="cn-med-table-wrapper">
            <table className="cn-med-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Medicine / Formulation</th>
                  <th>Dosage Timing</th>
                  <th>Meal Relation</th>
                  <th>Duration</th>
                </tr>
              </thead>
              <tbody>
                {medList.map((m, idx) => (
                  <tr key={idx}>
                    <td style={{ color: "#94a3b8", fontWeight: 700 }}>{idx + 1}</td>
                    <td style={{ fontWeight: 700, color: "#0f172a" }}>{m.name || "Medicine"}</td>
                    <td><span className="cn-timing-chip">{m.timing || "1-0-1"}</span></td>
                    <td><span className="cn-food-chip">{m.food || "After Food"}</span></td>
                    <td style={{ fontWeight: 600, color: "#475569" }}>{m.duration || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <textarea
            className="cn-doc-textarea"
            rows={2}
            value={data.medications || ""}
            onChange={(e) => onChange("medications", e.target.value)}
            placeholder="e.g. Tab Azithromycin 500mg (1-0-0) After Food x 3 Days"
          />
        )}
      </div>

      {/* Instructions & Review */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
        <div className="cn-doc-section">
          <div className="cn-doc-section-header" style={{ color: "#16a34a" }}>
            <FaClipboardList /> Instructions &amp; Advice
          </div>
          {editable ? (
            <textarea
              className="cn-doc-textarea"
              rows={2}
              value={data.instructions || data.treatment_plan || ""}
              onChange={(e) => {
                onChange("instructions", e.target.value);
                onChange("treatment_plan", e.target.value);
              }}
              placeholder="e.g. Warm water gargles, avoid cold drinks, hydrate well."
            />
          ) : (
            <p className="cn-doc-value-view">{data.instructions || data.treatment_plan || "—"}</p>
          )}
        </div>

        <div className="cn-doc-section">
          <div className="cn-doc-section-header" style={{ color: "#b45309" }}>
            <FaCalendarAlt /> Review SOS / Next Visit
          </div>
          {editable ? (
            <textarea
              className="cn-doc-textarea"
              rows={2}
              value={data.review_after || data.follow_up || ""}
              onChange={(e) => {
                onChange("review_after", e.target.value);
                onChange("follow_up", e.target.value);
              }}
              placeholder="e.g. Review after 3 days or SOS if fever persists."
            />
          ) : (
            <p className="cn-doc-value-view">{data.review_after || data.follow_up || "—"}</p>
          )}
        </div>
      </div>

      {/* Card Toolbar */}
      <div className="cn-doc-action-bar">
        <button type="button" className="cn-doc-btn" onClick={onPrint}>
          <FaPrint /> Print Rx Note
        </button>
        <button
          type="button"
          className="cn-doc-btn"
          onClick={() => {
            const lines = [
              `OPD PRESCRIPTION: ${data.diagnosis || data.likely_diagnosis || ""}`,
              `Complaints: ${Array.isArray(data.chief_complaints) ? data.chief_complaints.join(", ") : data.what_patient_said}`,
              `Examination: ${data.examination || data.what_was_observed}`,
              `Medications:\n${Array.isArray(data.medications_table) ? data.medications_table.map((m) => `• ${m.name}: ${m.timing} (${m.food}) x ${m.duration}`).join("\n") : data.medications}`,
              `Advice: ${data.instructions || data.treatment_plan}`,
              `Follow-up: ${data.review_after || data.follow_up}`,
            ].join("\n\n");
            onCopy(lines, "Quick OPD Prescription");
          }}
        >
          <FaCopy /> Copy Prescription
        </button>
      </div>
    </div>
  );
}

// ==========================================
// 2. SPECIALIST REFERRAL LETTER CARD
// ==========================================
function ReferralLetterCard({ data, editable, onChange, onPrint, onCopy }) {
  if (!data) return null;

  const urgencyColors = {
    Urgent: { bg: "#fef2f2", text: "#b91c1c", border: "#fecaca" },
    "Semi-Urgent": { bg: "#fffbeb", text: "#b45309", border: "#fde68a" },
    Routine: { bg: "#ecfdf5", text: "#15803d", border: "#a7f3d0" },
  };
  const urgency = data.referral_urgency || "Routine";
  const uStyle = urgencyColors[urgency] || urgencyColors.Routine;

  return (
    <div className="cn-doc-card">
      <div className="cn-doc-header-banner">
        <div className="cn-doc-title-group">
          <div className="cn-doc-main-title">
            <FaPaperPlane style={{ color: "#8b5cf6" }} />
            Specialist Referral Letter
          </div>
          <div className="cn-doc-sub-title">
            Formal Consultant Opinion, Clinical Summary &amp; Transfer
          </div>
        </div>
        <div
          className="cn-doc-badge-pill"
          style={{ background: uStyle.bg, color: uStyle.text, border: `1px solid ${uStyle.border}` }}
        >
          <FaCheckCircle style={{ marginRight: 5, fontSize: 10 }} /> {urgency} Priority
        </div>
      </div>

      {data.quick_summary && (
        <div className="soap-summary-strip">
          <MdOutlineSummarize className="soap-summary-icon" />
          <p>{data.quick_summary}</p>
        </div>
      )}

      {/* Recipient & Reason */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
        <div className="cn-doc-section">
          <div className="cn-doc-section-header" style={{ color: "#8b5cf6" }}>
            <FaUserMd /> To (Specialist / Department)
          </div>
          {editable ? (
            <textarea
              className="cn-doc-textarea"
              rows={2}
              value={data.recipient_specialty || ""}
              onChange={(e) => onChange("recipient_specialty", e.target.value)}
              placeholder="e.g. Department of Cardiology / Senior Consultant"
            />
          ) : (
            <p className="cn-doc-value-view" style={{ fontWeight: 700, color: "#6d28d9" }}>
              {data.recipient_specialty || "Specialist Consultant"}
            </p>
          )}
        </div>

        <div className="cn-doc-section">
          <div className="cn-doc-section-header" style={{ color: "#b91c1c" }}>
            <FaStethoscope /> Reason for Referral
          </div>
          {editable ? (
            <textarea
              className="cn-doc-textarea"
              rows={2}
              value={data.referral_reason || ""}
              onChange={(e) => onChange("referral_reason", e.target.value)}
              placeholder="e.g. Evaluation of chest discomfort, rule out ischemic etiology"
            />
          ) : (
            <p className="cn-doc-value-view">{data.referral_reason || "—"}</p>
          )}
        </div>
      </div>

      {/* Clinical Summary */}
      <div className="cn-doc-section">
        <div className="cn-doc-section-header" style={{ color: "#0284c7" }}>
          <FaCommentMedical /> Clinical Summary &amp; Presentation
        </div>
        {editable ? (
          <textarea
            className="cn-doc-textarea"
            rows={3}
            value={data.clinical_summary || data.what_patient_said || ""}
            onChange={(e) => {
              onChange("clinical_summary", e.target.value);
              onChange("what_patient_said", e.target.value);
            }}
            placeholder="Comprehensive clinical history and physical findings..."
          />
        ) : (
          <p className="cn-doc-value-view">{data.clinical_summary || data.what_patient_said || "—"}</p>
        )}
      </div>

      {/* Investigations & Medications */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
        <div className="cn-doc-section">
          <div className="cn-doc-section-header" style={{ color: "#7c3aed" }}>
            <FaEye /> Investigations / Vitals
          </div>
          {editable ? (
            <textarea
              className="cn-doc-textarea"
              rows={2}
              value={data.investigations_done || data.what_was_observed || ""}
              onChange={(e) => {
                onChange("investigations_done", e.target.value);
                onChange("what_was_observed", e.target.value);
              }}
              placeholder="Vitals, lab tests, imaging performed..."
            />
          ) : (
            <p className="cn-doc-value-view">{data.investigations_done || data.what_was_observed || "—"}</p>
          )}
        </div>

        <div className="cn-doc-section">
          <div className="cn-doc-section-header" style={{ color: "#0d9488" }}>
            <FaPills /> Current Medications
          </div>
          {editable ? (
            <textarea
              className="cn-doc-textarea"
              rows={2}
              value={data.current_medications || data.medications || ""}
              onChange={(e) => {
                onChange("current_medications", e.target.value);
                onChange("medications", e.target.value);
              }}
              placeholder="Current active medications..."
            />
          ) : (
            <p className="cn-doc-value-view">{data.current_medications || data.medications || "—"}</p>
          )}
        </div>
      </div>

      {/* Questions for Consultant */}
      <div className="cn-doc-section">
        <div className="cn-doc-section-header" style={{ color: "#16a34a" }}>
          <FaLightbulb /> Specific Questions for Specialist
        </div>
        {editable ? (
          <textarea
            className="cn-doc-textarea"
            rows={2}
            value={data.specific_questions || ""}
            onChange={(e) => onChange("specific_questions", e.target.value)}
            placeholder="Specific clinical questions or management guidance requested..."
          />
        ) : (
          <p className="cn-doc-value-view">{data.specific_questions || "Specialist clinical review and management advice."}</p>
        )}
      </div>

      {/* Full Formal Referral Letter Text */}
      {data.full_letter && (
        <details className="transcript-accordion" open>
          <summary>
            <span>Full Formatted Referral Letter (Print Ready)</span>
            <span style={{ fontSize: 12, color: "#64748b" }}>Click to collapse</span>
          </summary>
          {editable ? (
            <textarea
              className="cn-doc-textarea"
              rows={7}
              style={{ marginTop: "10px" }}
              value={data.full_letter}
              onChange={(e) => onChange("full_letter", e.target.value)}
            />
          ) : (
            <pre style={{ margin: "10px 0 0 0", whiteSpace: "pre-wrap", fontFamily: "inherit", fontSize: "13px", lineHeight: "1.6", color: "#334155" }}>
              {data.full_letter}
            </pre>
          )}
        </details>
      )}

      {/* Card Toolbar */}
      <div className="cn-doc-action-bar">
        <button type="button" className="cn-doc-btn" onClick={onPrint}>
          <FaPrint /> Print Referral Letter
        </button>
        <button
          type="button"
          className="cn-doc-btn"
          onClick={() => {
            const letter = data.full_letter || [
              `REFERRAL TO: ${data.recipient_specialty || "Specialist"}`,
              `URGENCY: ${urgency}`,
              `REASON: ${data.referral_reason}`,
              `CLINICAL SUMMARY: ${data.clinical_summary}`,
              `INVESTIGATIONS: ${data.investigations_done}`,
              `MEDICATIONS: ${data.current_medications}`,
              `QUESTIONS: ${data.specific_questions}`,
            ].join("\n\n");
            onCopy(letter, "Referral Letter");
          }}
        >
          <FaCopy /> Copy Letter
        </button>
      </div>
    </div>
  );
}

// ==========================================
// 3. MEDICAL SICKNESS CERTIFICATE CARD
// ==========================================
function MedicalCertificateCard({ data, editable, onChange, onPrint, onCopy }) {
  if (!data) return null;

  return (
    <div className="cn-doc-card cn-cert-container">
      <div className="cn-cert-header">
        <div className="cn-cert-title">
          <FaCertificate style={{ marginRight: 8, color: "#10b981", verticalAlign: "middle" }} />
          Medical Sickness &amp; Fitness Certificate
        </div>
        <div className="cn-cert-subtitle">
          Official Clinical Certification for Employer / Educational Institution
        </div>
      </div>

      <div style={{ fontSize: "13px", color: "#334155", lineHeight: "1.6" }}>
        This is to certify that{" "}
        <strong style={{ color: "#065f46" }}>{data.patient_name || data._patient?.name || "the patient"}</strong> has been clinically examined and advised medical rest as detailed below:
      </div>

      {/* Certified Diagnosis */}
      <div className="cn-doc-section" style={{ marginTop: "10px" }}>
        <div className="cn-doc-section-header" style={{ color: "#065f46" }}>
          <FaStethoscope /> Certified Medical Diagnosis
        </div>
        {editable ? (
          <textarea
            className="cn-doc-textarea"
            rows={2}
            value={data.illness_diagnosis || data.likely_diagnosis || ""}
            onChange={(e) => {
              onChange("illness_diagnosis", e.target.value);
              onChange("likely_diagnosis", e.target.value);
            }}
            placeholder="e.g. Acute Viral Gastroenteritis with Dehydration"
          />
        ) : (
          <p className="cn-doc-value-view" style={{ fontWeight: 700, color: "#0f172a" }}>
            {data.illness_diagnosis || data.likely_diagnosis || "—"}
          </p>
        )}
      </div>

      {/* Leave Period Strip */}
      <div className="cn-cert-leave-box">
        <div>
          <span style={{ fontSize: "11px", fontWeight: 700, color: "#047857", textTransform: "uppercase" }}>Recommended Rest</span>
          {editable ? (
            <input
              type="text"
              style={{ width: "100%", padding: "4px 8px", marginTop: "2px", border: "1px solid #a7f3d0", borderRadius: "6px", fontWeight: 700, fontSize: "13px" }}
              value={data.rest_days_recommended || ""}
              onChange={(e) => onChange("rest_days_recommended", e.target.value)}
              placeholder="e.g. 3 Days"
            />
          ) : (
            <div style={{ fontWeight: 800, fontSize: "15px", color: "#065f46" }}>
              {data.rest_days_recommended || "3 Days"}
            </div>
          )}
        </div>

        <div>
          <span style={{ fontSize: "11px", fontWeight: 700, color: "#047857", textTransform: "uppercase" }}>Leave From</span>
          {editable ? (
            <input
              type="text"
              style={{ width: "100%", padding: "4px 8px", marginTop: "2px", border: "1px solid #a7f3d0", borderRadius: "6px", fontSize: "13px" }}
              value={data.rest_from_date || ""}
              onChange={(e) => onChange("rest_from_date", e.target.value)}
              placeholder="e.g. Today"
            />
          ) : (
            <div style={{ fontWeight: 700, fontSize: "13.5px", color: "#0f172a" }}>
              {data.rest_from_date || "Today"}
            </div>
          )}
        </div>

        <div>
          <span style={{ fontSize: "11px", fontWeight: 700, color: "#047857", textTransform: "uppercase" }}>Leave To</span>
          {editable ? (
            <input
              type="text"
              style={{ width: "100%", padding: "4px 8px", marginTop: "2px", border: "1px solid #a7f3d0", borderRadius: "6px", fontSize: "13px" }}
              value={data.rest_to_date || ""}
              onChange={(e) => onChange("rest_to_date", e.target.value)}
              placeholder="e.g. Date"
            />
          ) : (
            <div style={{ fontWeight: 700, fontSize: "13.5px", color: "#0f172a" }}>
              {data.rest_to_date || "—"}
            </div>
          )}
        </div>
      </div>

      {/* Fitness Status Declaration */}
      <div className="cn-doc-section">
        <div className="cn-doc-section-header" style={{ color: "#059669" }}>
          <FaCheckCircle /> Fitness Status Declaration
        </div>
        {editable ? (
          <textarea
            className="cn-doc-textarea"
            rows={2}
            value={data.fitness_status || ""}
            onChange={(e) => onChange("fitness_status", e.target.value)}
            placeholder="e.g. Unfit for work/school during rest period; fit to resume on [Date]"
          />
        ) : (
          <p className="cn-doc-value-view">{data.fitness_status || "Unfit for work/classes during the above period."}</p>
        )}
      </div>

      {/* Doctor's Remarks */}
      <div className="cn-doc-section">
        <div className="cn-doc-section-header" style={{ color: "#475569" }}>
          <FaClipboardList /> Doctor's Clinical Remarks
        </div>
        {editable ? (
          <textarea
            className="cn-doc-textarea"
            rows={2}
            value={data.doctor_remarks || data.treatment_plan || ""}
            onChange={(e) => {
              onChange("doctor_remarks", e.target.value);
              onChange("treatment_plan", e.target.value);
            }}
            placeholder="e.g. Strict bed rest and oral hydration advised."
          />
        ) : (
          <p className="cn-doc-value-view">{data.doctor_remarks || data.treatment_plan || "—"}</p>
        )}
      </div>

      {/* Full Formal Certificate preview */}
      {data.full_certificate && (
        <details className="transcript-accordion">
          <summary>
            <span>Full Formal Certificate Text (Click to preview/edit)</span>
            <span style={{ fontSize: 12, color: "#64748b" }}>Expand</span>
          </summary>
          {editable ? (
            <textarea
              className="cn-doc-textarea"
              rows={6}
              style={{ marginTop: "10px" }}
              value={data.full_certificate}
              onChange={(e) => onChange("full_certificate", e.target.value)}
            />
          ) : (
            <pre style={{ margin: "10px 0 0 0", whiteSpace: "pre-wrap", fontFamily: "inherit", fontSize: "13px", lineHeight: "1.6", color: "#334155" }}>
              {data.full_certificate}
            </pre>
          )}
        </details>
      )}

      {/* Signature Area */}
      <div className="cn-cert-sign-area">
        <div style={{ textAlign: "right" }}>
          <div style={{ borderTop: "1.5px solid #065f46", width: "200px", paddingTop: "6px", fontWeight: 700, fontSize: "12.5px", color: "#065f46" }}>
            Attending Medical Officer
          </div>
          <div style={{ fontSize: "11px", color: "#64748b" }}>Signature &amp; Clinic Seal</div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="cn-doc-action-bar">
        <button type="button" className="cn-doc-btn" onClick={onPrint}>
          <FaPrint /> Print Certificate
        </button>
        <button
          type="button"
          className="cn-doc-btn"
          onClick={() => {
            const certText = data.full_certificate || [
              `MEDICAL SICKNESS & FITNESS CERTIFICATE`,
              `Patient: ${data.patient_name || data._patient?.name}`,
              `Diagnosis: ${data.illness_diagnosis}`,
              `Recommended Rest: ${data.rest_days_recommended} (From ${data.rest_from_date} to ${data.rest_to_date})`,
              `Fitness Status: ${data.fitness_status}`,
              `Remarks: ${data.doctor_remarks}`,
            ].join("\n\n");
            onCopy(certText, "Medical Certificate");
          }}
        >
          <FaCopy /> Copy Certificate
        </button>
      </div>
    </div>
  );
}

// ==========================================
// 4. DISCHARGE & PROCEDURAL SUMMARY CARD
// ==========================================
function DischargeSummaryCard({ data, editable, onChange, onPrint, onCopy }) {
  if (!data) return null;

  return (
    <div className="cn-doc-card">
      <div className="cn-doc-header-banner">
        <div className="cn-doc-title-group">
          <div className="cn-doc-main-title">
            <FaHospital style={{ color: "#ec4899" }} />
            Discharge &amp; Procedural Summary
          </div>
          <div className="cn-doc-sub-title">
            Hospital IPD Ward Discharge or Day-Care Procedure Documentation
          </div>
        </div>
        <div className="cn-doc-badge-pill" style={{ background: "#fce7f3", color: "#be185d" }}>
          <FaHospital style={{ marginRight: 5 }} /> Official Discharge Record
        </div>
      </div>

      {data.quick_summary && (
        <div className="soap-summary-strip">
          <MdOutlineSummarize className="soap-summary-icon" />
          <p>{data.quick_summary}</p>
        </div>
      )}

      {/* Dates & Diagnosis */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
        <div className="cn-doc-section">
          <div className="cn-doc-section-header" style={{ color: "#0284c7" }}>
            <FaCalendarAlt /> Stay Period (Admission / Discharge)
          </div>
          <div style={{ display: "flex", gap: "10px" }}>
            <div style={{ flex: 1 }}>
              <span style={{ fontSize: "11px", color: "#64748b" }}>Admission:</span>
              {editable ? (
                <input
                  type="text"
                  style={{ width: "100%", padding: "4px 8px", border: "1px solid #cbd5e1", borderRadius: "6px", fontSize: "12.5px" }}
                  value={data.admission_date || ""}
                  onChange={(e) => onChange("admission_date", e.target.value)}
                  placeholder="e.g. Admission date"
                />
              ) : (
                <div style={{ fontWeight: 600, fontSize: "12.5px" }}>{data.admission_date || "—"}</div>
              )}
            </div>
            <div style={{ flex: 1 }}>
              <span style={{ fontSize: "11px", color: "#64748b" }}>Discharge:</span>
              {editable ? (
                <input
                  type="text"
                  style={{ width: "100%", padding: "4px 8px", border: "1px solid #cbd5e1", borderRadius: "6px", fontSize: "12.5px" }}
                  value={data.discharge_date || ""}
                  onChange={(e) => onChange("discharge_date", e.target.value)}
                  placeholder="e.g. Discharge date"
                />
              ) : (
                <div style={{ fontWeight: 600, fontSize: "12.5px" }}>{data.discharge_date || "Today"}</div>
              )}
            </div>
          </div>
        </div>

        <div className="cn-doc-section">
          <div className="cn-doc-section-header" style={{ color: "#be185d" }}>
            <FaStethoscope /> Final Diagnosis
          </div>
          {editable ? (
            <textarea
              className="cn-doc-textarea"
              rows={2}
              value={data.final_diagnosis || data.likely_diagnosis || ""}
              onChange={(e) => {
                onChange("final_diagnosis", e.target.value);
                onChange("likely_diagnosis", e.target.value);
              }}
              placeholder="e.g. Acute Gastroenteritis, successfully rehydrated"
            />
          ) : (
            <p className="cn-doc-value-view" style={{ fontWeight: 700, color: "#0f172a" }}>
              {data.final_diagnosis || data.likely_diagnosis || "—"}
            </p>
          )}
        </div>
      </div>

      {/* Procedure Performed & Vitals */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
        <div className="cn-doc-section">
          <div className="cn-doc-section-header" style={{ color: "#7c3aed" }}>
            <FaClipboardList /> Procedure / Management Performed
          </div>
          {editable ? (
            <textarea
              className="cn-doc-textarea"
              rows={2}
              value={data.procedure_performed || ""}
              onChange={(e) => onChange("procedure_performed", e.target.value)}
              placeholder="e.g. Conservative medical management, IV rehydration"
            />
          ) : (
            <p className="cn-doc-value-view">{data.procedure_performed || "—"}</p>
          )}
        </div>

        <div className="cn-doc-section">
          <div className="cn-doc-section-header" style={{ color: "#0284c7" }}>
            <FaEye /> Discharge Vitals &amp; Condition
          </div>
          {editable ? (
            <textarea
              className="cn-doc-textarea"
              rows={2}
              value={data.discharge_vitals || data.what_was_observed || ""}
              onChange={(e) => {
                onChange("discharge_vitals", e.target.value);
                onChange("what_was_observed", e.target.value);
              }}
              placeholder="e.g. BP 120/80, Pulse 76/min, Afebrile, Stable"
            />
          ) : (
            <p className="cn-doc-value-view">{data.discharge_vitals || data.what_was_observed || "—"}</p>
          )}
        </div>
      </div>

      {/* Hospital Course */}
      <div className="cn-doc-section">
        <div className="cn-doc-section-header" style={{ color: "#334155" }}>
          <FaCommentMedical /> Hospital Course &amp; Response to Treatment
        </div>
        {editable ? (
          <textarea
            className="cn-doc-textarea"
            rows={2}
            value={data.hospital_course || data.what_patient_said || ""}
            onChange={(e) => onChange("hospital_course", e.target.value)}
            placeholder="Clinical progression during hospital stay..."
          />
        ) : (
          <p className="cn-doc-value-view">{data.hospital_course || data.what_patient_said || "—"}</p>
        )}
      </div>

      {/* Discharge Medications & Diet/Advice */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
        <div className="cn-doc-section">
          <div className="cn-doc-section-header" style={{ color: "#8b5cf6" }}>
            <FaPills /> Discharge Medications
          </div>
          {editable ? (
            <textarea
              className="cn-doc-textarea"
              rows={3}
              value={data.discharge_medications || data.medications || ""}
              onChange={(e) => {
                onChange("discharge_medications", e.target.value);
                onChange("medications", e.target.value);
              }}
              placeholder="Discharge medicines with dose, frequency, and duration..."
            />
          ) : (
            <p className="cn-doc-value-view">{data.discharge_medications || data.medications || "—"}</p>
          )}
        </div>

        <div className="cn-doc-section">
          <div className="cn-doc-section-header" style={{ color: "#16a34a" }}>
            <FaClipboardList /> Diet &amp; Lifestyle Advice
          </div>
          {editable ? (
            <textarea
              className="cn-doc-textarea"
              rows={3}
              value={data.diet_lifestyle_advice || data.treatment_plan || ""}
              onChange={(e) => {
                onChange("diet_lifestyle_advice", e.target.value);
                onChange("treatment_plan", e.target.value);
              }}
              placeholder="Diet restrictions, wound care, physical activity..."
            />
          ) : (
            <p className="cn-doc-value-view">{data.diet_lifestyle_advice || data.treatment_plan || "—"}</p>
          )}
        </div>
      </div>

      {/* Emergency Red Flags */}
      <div className="cn-doc-section" style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "10px", padding: "12px 14px" }}>
        <div className="cn-doc-section-header" style={{ color: "#b91c1c" }}>
          <FaExclamationTriangle /> Return to Emergency Immediately If (Red Flags)
        </div>
        {editable ? (
          <textarea
            className="cn-doc-textarea"
            rows={2}
            style={{ background: "#ffffff", borderColor: "#fca5a5" }}
            value={data.emergency_red_flags || (Array.isArray(data.warning_signs) ? data.warning_signs.join("\n") : "")}
            onChange={(e) => onChange("emergency_red_flags", e.target.value)}
            placeholder="High persistent fever, chest pain, severe vomiting, shortness of breath..."
          />
        ) : (
          <p className="cn-doc-value-view" style={{ color: "#991b1b", fontWeight: 600 }}>
            {data.emergency_red_flags || (Array.isArray(data.warning_signs) ? data.warning_signs.join(", ") : "Severe recurrence of symptoms.")}
          </p>
        )}
      </div>

      {/* Follow-up */}
      <div className="cn-doc-section">
        <div className="cn-doc-section-header" style={{ color: "#0284c7" }}>
          <FaCalendarAlt /> Follow-up Instructions
        </div>
        {editable ? (
          <textarea
            className="cn-doc-textarea"
            rows={2}
            value={data.follow_up_instructions || data.follow_up || ""}
            onChange={(e) => {
              onChange("follow_up_instructions", e.target.value);
              onChange("follow_up", e.target.value);
            }}
            placeholder="e.g. OPD review in Surgery OPD on Day 5 at 10:00 AM."
          />
        ) : (
          <p className="cn-doc-value-view">{data.follow_up_instructions || data.follow_up || "—"}</p>
        )}
      </div>

      {/* Toolbar */}
      <div className="cn-doc-action-bar">
        <button type="button" className="cn-doc-btn" onClick={onPrint}>
          <FaPrint /> Print Summary
        </button>
        <button
          type="button"
          className="cn-doc-btn"
          onClick={() => {
            const sumText = data.full_summary || [
              `DISCHARGE SUMMARY`,
              `Admission: ${data.admission_date} | Discharge: ${data.discharge_date}`,
              `Diagnosis: ${data.final_diagnosis}`,
              `Procedure: ${data.procedure_performed}`,
              `Hospital Course: ${data.hospital_course}`,
              `Discharge Vitals: ${data.discharge_vitals}`,
              `Discharge Medications: ${data.discharge_medications}`,
              `Advice: ${data.diet_lifestyle_advice}`,
              `Red Flags: ${data.emergency_red_flags}`,
              `Follow-up: ${data.follow_up_instructions}`,
            ].join("\n\n");
            onCopy(sumText, "Discharge Summary");
          }}
        >
          <FaCopy /> Copy Summary
        </button>
      </div>
    </div>
  );
}

// ==========================================
// MAIN COMPONENT: CONSULTATION NOTE
// ==========================================
export default function ConsultationNote({ patient }) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("new");
  const [currentStep, setCurrentStep] = useState(1);

  // Recording & Audio State
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [uploadedFileName, setUploadedFileName] = useState("");
  const [isDraggingFile, setIsDraggingFile] = useState(false);

  // AI & Note State
  const [transcript, setTranscript] = useState("");
  const [dialogueTurns, setDialogueTurns] = useState([]);
  const [transcriptView, setTranscriptView] = useState("cards"); // 'cards' | 'raw'
  const [soapData, setSoapData] = useState(null);
  const [soapNote, setSoapNote] = useState("");
  const [editedData, setEditedData] = useState(null);
  const [selectedTemplate, setSelectedTemplate] = useState("soap");
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState("");
  const [savedNoteId, setSavedNoteId] = useState(null);
  const [approved, setApproved] = useState(false);

  // Past Notes
  const [pastNotes, setPastNotes] = useState([]);
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [deletingNoteId, setDeletingNoteId] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  // Clinical Safety & Pre-Visit Flash (RxNote + ROSC AI)
  const safetyProfile = getPatientSafetyProfile(patient, pastNotes);

  // Media references
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);
  const displayStreamRef = useRef(null);
  const audioContextRef = useRef(null);
  const timerRef = useRef(null);
  const fileInputRef = useRef(null);

  const user = JSON.parse(localStorage.getItem("user") || "{}");

  // Keep Audio Object URL synced
  useEffect(() => {
    if (!audioBlob) {
      setAudioUrl(null);
      return;
    }
    const url = URL.createObjectURL(audioBlob);
    setAudioUrl(url);
    console.log(`[AI Note Writer] Audio URL created: ${url} (Blob size: ${(audioBlob.size / 1024).toFixed(1)} KB)`);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [audioBlob]);

  // Auto-open modal when requested via autoOpen prop or when patient is passed
  useEffect(() => {
    if (patient) {
      fetchPastNotes();
    }
  }, [patient?.id]);

  // Close modal with Escape key when idle
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e) => {
      if (e.key === "Escape" && !isRecording && !loading) {
        closeModal();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, isRecording, loading]);

  const copyToClipboard = async (text, label = "Text") => {
    if (!text || !text.trim()) {
      toast.info(`No ${label.toLowerCase()} available to copy.`);
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copied to clipboard!`);
    } catch {
      toast.error("Unable to copy to clipboard.");
    }
  };

  // ── MODAL CONTROLS ──
  const openModal = () => {
    console.log(" [AI Note Writer] Opening modal for patient:", patient?.name);
    resetAll();
    setIsOpen(true);
    fetchPastNotes();
  };

  const closeModal = () => {
    console.log(" [AI Note Writer] Closing modal");
    if (isRecording) stopRecording();
    setIsOpen(false);
  };

  const resetAll = () => {
    console.log(" [AI Note Writer] Resetting state to Step 1");
    setCurrentStep(1);
    setIsRecording(false);
    setIsPaused(false);
    setRecordingTime(0);
    clearInterval(timerRef.current);
    setAudioBlob(null);
    setUploadedFileName("");
    setTranscript("");
    setDialogueTurns([]);
    setTranscriptView("cards");
    setSoapData(null);
    setSoapNote("");
    setEditedData(null);
    setLoading(false);
    setLoadingMsg("");
    setSavedNoteId(null);
    setApproved(false);
    chunksRef.current = [];
    if (displayStreamRef.current) {
      displayStreamRef.current.getTracks().forEach((t) => t.stop());
      displayStreamRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // ── FILE UPLOAD ──
  const handleFileUpload = (eOrFile) => {
    const file = eOrFile instanceof File ? eOrFile : eOrFile?.target?.files?.[0];
    if (!file) return;

    console.log(` [AI Note Writer] Selected file: "${file.name}" | Size: ${(file.size / 1024).toFixed(1)} KB | Type: "${file.type}"`);

    const validAudio =
      file.type.startsWith("audio/") ||
      file.type.startsWith("video/") ||
      /\.(mp3|wav|webm|ogg|m4a|aac|mp4|mov|mkv)$/i.test(file.name);

    if (!validAudio) {
      toast.warning("Please upload a valid audio or video file (MP3, WAV, WEBM, OGG, M4A, MP4, MOV).");
      return;
    }

    setAudioBlob(file);
    setUploadedFileName(file.name);
    // Keep user on Step 1 so they can review the file & click "Transcribe Audio"
    setCurrentStep(1);
  };

  const formatTime = (secs) =>
    `${String(Math.floor(secs / 60)).padStart(2, "0")}:${String(secs % 60).padStart(2, "0")}`;

  // ── RECORDING CONTROLS ──
  const startRecording = async () => {
    try {
      console.log("🎙️ [AI Note Writer] Requesting microphone access...");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const combinedStream = stream;

      // Detect supported mimeType
      let mimeType = "audio/webm;codecs=opus";
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        if (MediaRecorder.isTypeSupported("audio/webm")) mimeType = "audio/webm";
        else if (MediaRecorder.isTypeSupported("audio/ogg")) mimeType = "audio/ogg";
        else if (MediaRecorder.isTypeSupported("audio/mp4")) mimeType = "audio/mp4";
        else mimeType = "";
      }

      console.log(`🎙️ [AI Note Writer] Initializing MediaRecorder with mimeType: "${mimeType || "default"}"`);
      const recorder = mimeType
        ? new MediaRecorder(combinedStream, { mimeType })
        : new MediaRecorder(combinedStream);

      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const outMime = recorder.mimeType || "audio/webm";
        const recordedBlob = new Blob(chunksRef.current, { type: outMime });
        console.log(` [AI Note Writer] Recording stopped. Final blob size: ${(recordedBlob.size / 1024).toFixed(1)} KB, type: "${recordedBlob.type}"`);
        setAudioBlob(recordedBlob);
        setUploadedFileName("Recorded Consultation.webm");
        setIsRecording(false);
        setIsPaused(false);
        clearInterval(timerRef.current);
      };

      recorder.start(250); // collect 250ms chunks
      setIsRecording(true);
      setIsPaused(false);
      setRecordingTime(0);
      clearInterval(timerRef.current);
      timerRef.current = setInterval(() => setRecordingTime((t) => t + 1), 1000);
      console.log("[AI Note Writer] Recording started successfully!");
    } catch (err) {
      console.error(" [AI Note Writer] Microphone access error:", err);
      toast.error(`Microphone error: ${err.message || "Access denied"}. Please allow microphone permissions in your browser.`);
    }
  };

  const pauseRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.pause();
      clearInterval(timerRef.current);
      setIsPaused(true);
      console.log(" [AI Note Writer] Recording paused");
    }
  };

  const resumeRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "paused") {
      mediaRecorderRef.current.resume();
      clearInterval(timerRef.current);
      timerRef.current = setInterval(() => setRecordingTime((t) => t + 1), 1000);
      setIsPaused(false);
      console.log(" [AI Note Writer] Recording resumed");
    }
  };

  const stopRecording = () => {
    console.log(" [AI Note Writer] Stop recording requested");
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (displayStreamRef.current) {
      displayStreamRef.current.getTracks().forEach((t) => t.stop());
      displayStreamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    clearInterval(timerRef.current);
    setIsRecording(false);
    setIsPaused(false);
  };

  // ── STEP 1 → 2: TRANSCRIBE AUDIO ──
  const transcribeAudio = async () => {
    if (!audioBlob) {
      toast.warning("No audio recorded or selected yet.");
      return;
    }

    console.log(` [AI Note Writer] Transcribing audio blob: ${(audioBlob.size / 1024).toFixed(1)} KB...`);
    setLoading(true);
    setLoadingMsg("Transcribing audio with Gemini AI...");

    try {
      const fd = new FormData();
      if (audioBlob instanceof File) {
        fd.append("audio", audioBlob, audioBlob.name);
      } else {
        fd.append("audio", audioBlob, uploadedFileName || "consultation.webm");
      }

      const res = await API.post("/consultation-notes/transcribe", fd, {
        timeout: 180000,
        headers: {
          role: user.role || "doctor",
          userid: user.id,
          "Content-Type": "multipart/form-data",
        },
      });

      console.log(" [AI Note Writer] Transcription received:", res.data);
      const formatted = res.data.transcript || "";
      setTranscript(formatted);

      if (Array.isArray(res.data.dialogue) && res.data.dialogue.length > 0) {
        setDialogueTurns(res.data.dialogue);
      } else {
        setDialogueTurns(parseTranscriptDialogue(formatted));
      }

      setTranscriptView("cards");
      toast.success("Audio transcribed successfully!");
      // Move to Step 2 (Review Transcript)
      setCurrentStep(2);
    } catch (err) {
      const serverMsg = err?.response?.data?.error || err?.response?.data?.detail || err.message;
      console.error(" [AI Note Writer] Transcription failed:", {
        error: err,
        serverMsg,
        response: err.response?.data,
      });

      toast.error(`Transcription Error: ${serverMsg}. You can type the transcript manually on Step 2.`);
      // Still allow doctor to proceed to Step 2 to type manually
      setCurrentStep(2);
    } finally {
      setLoading(false);
      setLoadingMsg("");
    }
  };

  // ── DIALOGUE / SPEAKER CONVERSATION HELPERS ──
  const serializeDialogue = (turns) => {
    return turns
      .filter((t) => t.text && t.text.trim())
      .map((t) => `${t.speaker}: "${t.text.replace(/^["']|["']$/g, "").trim()}"`)
      .join("\n\n");
  };

  const parseTranscriptDialogue = (raw) => {
    if (!raw || !raw.trim()) return [];

    const clean = raw.replace(/```json/gi, "").replace(/```/g, "").trim();

    // 1. Try parsing JSON array directly: [ { "speaker": "Doctor", "text": "..." }, ... ]
    try {
      const arrayStart = clean.indexOf("[");
      const arrayEnd = clean.lastIndexOf("]");
      if (arrayStart !== -1 && arrayEnd > arrayStart) {
        const parsedArray = JSON.parse(clean.substring(arrayStart, arrayEnd + 1));
        if (Array.isArray(parsedArray) && parsedArray.length > 0) {
          const turns = parsedArray
            .map((item) => ({
              speaker: (item.speaker || "").toLowerCase().includes("pat")
                ? "Patient"
                : (item.speaker || "").toLowerCase().includes("care")
                ? "Caregiver"
                : "Doctor",
              text: (item.text || "").replace(/^["']|["']$/g, "").trim(),
            }))
            .filter((t) => t.text.length > 0);
          if (turns.length > 0) return turns;
        }
      }

      // 2. Try parsing JSON object: { "dialogue": [ ... ] } or { "turns": [ ... ] }
      const objStart = clean.indexOf("{");
      const objEnd = clean.lastIndexOf("}");
      if (objStart !== -1 && objEnd > objStart) {
        const parsedObj = JSON.parse(clean.substring(objStart, objEnd + 1));
        const arr = parsedObj.dialogue || parsedObj.conversation || parsedObj.turns;
        if (Array.isArray(arr) && arr.length > 0) {
          const turns = arr
            .map((item) => ({
              speaker: (item.speaker || "").toLowerCase().includes("pat")
                ? "Patient"
                : (item.speaker || "").toLowerCase().includes("care")
                ? "Caregiver"
                : "Doctor",
              text: (item.text || "").replace(/^["']|["']$/g, "").trim(),
            }))
            .filter((t) => t.text.length > 0);
          if (turns.length > 0) return turns;
        }
      }
    } catch (e) {
      // Continue to line and delimiter parser
    }

    // 3. Line-by-line speaker tag parser (handles **Doctor:**, **Doctor**: , Doctor:, [Doctor]:, etc.)
    const lines = clean.split(/\r?\n/);
    const turns = [];
    let currentSpeaker = null;
    let currentText = "";

    const speakerLineRegex = /^\s*(?:\*{1,2}|#{1,4}|\[)?\s*(Doctor|Dr\.?|Patient|Pt\.?|Caregiver|Nurse)\s*(?:\*{1,2}|\])?\s*[:\-–—]?\s*(?:\*{1,2})?\s*[:\-–—]?\s*(.*)$/i;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      const match = trimmed.match(speakerLineRegex);
      if (match) {
        const rawSp = match[1].toLowerCase();
        const nextSpeaker = rawSp.startsWith("dr") || rawSp.startsWith("doc")
          ? "Doctor"
          : rawSp.startsWith("pt") || rawSp.startsWith("pat")
          ? "Patient"
          : "Caregiver";
        const lineContent = (match[2] || "").replace(/^["']|["']$/g, "").trim();

        if (currentSpeaker && currentText.trim()) {
          turns.push({ speaker: currentSpeaker, text: currentText.trim() });
        }
        currentSpeaker = nextSpeaker;
        currentText = lineContent;
      } else {
        if (currentSpeaker) {
          currentText = currentText ? `${currentText} ${trimmed}` : trimmed;
        } else {
          currentText = currentText ? `${currentText} ${trimmed}` : trimmed;
        }
      }
    }

    if (currentSpeaker && currentText.trim()) {
      turns.push({ speaker: currentSpeaker, text: currentText.trim() });
    }

    if (turns.length > 1) {
      return turns;
    }

    // 4. Segment parser for inline markers
    const inlineMarkerRegex = /(?:\*{1,2}|#{1,4}|\[)?\s*(Doctor|Dr\.?|Patient|Pt\.?|Caregiver|Nurse)\s*(?:\*{1,2}|\])?\s*[:\-–—]\s*(?:\*{1,2})?/gi;
    const inlineMatches = [...clean.matchAll(inlineMarkerRegex)];
    if (inlineMatches.length > 1) {
      const segmentTurns = [];
      for (let i = 0; i < inlineMatches.length; i++) {
        const m = inlineMatches[i];
        const speakerRaw = m[1].toLowerCase();
        const speaker = speakerRaw.startsWith("dr") || speakerRaw.startsWith("doc")
          ? "Doctor"
          : speakerRaw.startsWith("pt") || speakerRaw.startsWith("pat")
          ? "Patient"
          : "Caregiver";
        const startIndex = m.index + m[0].length;
        const endIndex = i < inlineMatches.length - 1 ? inlineMatches[i + 1].index : clean.length;
        const segmentText = clean.substring(startIndex, endIndex).replace(/^["']|["']$/g, "").trim();
        if (segmentText) {
          segmentTurns.push({ speaker, text: segmentText });
        }
      }
      if (segmentTurns.length > 1) return segmentTurns;
    }

    // 5. Intelligent Clinical Sentence-level Dialogue Separator:
    // When text is raw continuous consultation speech without explicit speaker tags,
    // split into individual sentences and determine who is speaking (Doctor vs Patient)
    const sentences = clean.match(/[^.!?]+[.!?]+(\s|$)|[^.!?]+$/g) || [clean];
    if (sentences.length > 1) {
      const separatedTurns = [];
      let curSpeaker = null;
      let curText = "";

      for (const sentStr of sentences) {
        const s = sentStr.trim();
        if (!s) continue;

        const lower = s.toLowerCase();

        // Clinical questions, examinations, directives, instructions & advice -> DOCTOR
        const isDoc =
          /\b(how are you|how do you|how long|what is|what seems|what brings|where does|have you|do you|did you|are you|can you|let me|open your|breathe|lie down|bp|blood pressure|temperature|keep a|take each|take this|take the|prescribe|prescribed|dosage|dose|twice daily|once daily|after meals|before food|with water|do not change|do not combine|check with your doctor|apply the|avoid)\b/i.test(lower) ||
          s.endsWith("?");

        // Patient symptoms, complaints, answers, and disclosures -> PATIENT
        const isPat =
          /\b(i take|i have|i feel|i get|i forget|i sometimes|i am also|i'm also|i am taking|i'm taking|prescribed by my doctors|prescribed by my doctor|my knees|my knee|my head|my back|my chest|my stomach|pain|hurts|cough|fever|headache|thank you|thanks)\b/i.test(lower);

        let speaker;
        if (isDoc && !isPat) {
          speaker = "Doctor";
        } else if (isPat) {
          speaker = "Patient";
        } else if (s.endsWith("?")) {
          speaker = "Doctor";
        } else {
          // If ambiguous, alternate speaker from previous turn
          speaker = curSpeaker === "Doctor" ? "Patient" : "Doctor";
        }

        if (curSpeaker && speaker !== curSpeaker && curText.trim()) {
          separatedTurns.push({ speaker: curSpeaker, text: curText.trim() });
          curSpeaker = speaker;
          curText = s;
        } else {
          curSpeaker = speaker;
          curText = curText ? `${curText} ${s}` : s;
        }
      }

      if (curSpeaker && curText.trim()) {
        separatedTurns.push({ speaker: curSpeaker, text: curText.trim() });
      }

      if (separatedTurns.length > 1) {
        return separatedTurns;
      }
    }

    // Single turn fallback if only one sentence exists
    return turns.length > 0 ? turns : [{ speaker: "Doctor", text: clean }];
  };

  const handleUpdateTurnText = (index, newText) => {
    setDialogueTurns((prev) => {
      const updated = [...prev];
      if (updated[index]) {
        updated[index] = { ...updated[index], text: newText };
      }
      setTranscript(serializeDialogue(updated));
      return updated;
    });
  };

  const handleToggleSpeaker = (index) => {
    setDialogueTurns((prev) => {
      const updated = [...prev];
      if (updated[index]) {
        const nextSpeaker = updated[index].speaker === "Doctor" ? "Patient" : "Doctor";
        updated[index] = { ...updated[index], speaker: nextSpeaker };
      }
      setTranscript(serializeDialogue(updated));
      return updated;
    });
  };

  const handleDeleteTurn = (index) => {
    setDialogueTurns((prev) => {
      const updated = prev.filter((_, i) => i !== index);
      setTranscript(serializeDialogue(updated));
      return updated;
    });
  };

  const handleAddTurn = (speaker, afterIndex = null) => {
    setDialogueTurns((prev) => {
      const newTurn = { speaker, text: "" };
      let updated;
      if (afterIndex !== null && afterIndex >= 0 && afterIndex < prev.length) {
        updated = [...prev.slice(0, afterIndex + 1), newTurn, ...prev.slice(afterIndex + 1)];
      } else {
        updated = [...prev, newTurn];
      }
      setTranscript(serializeDialogue(updated));
      return updated;
    });
    setTranscriptView("cards");
  };

  const handleAutoFormatDialogue = async () => {
    const textToFormat = (transcript && transcript.trim()) 
      || (dialogueTurns && dialogueTurns.length > 0 ? serializeDialogue(dialogueTurns) : "");

    if (!textToFormat) {
      toast.warning("Please enter or transcribe a consultation dialogue before formatting.");
      return;
    }

    // 1. Immediately apply clinical dialogue separation to the cards
    const immediateTurns = parseTranscriptDialogue(textToFormat);
    if (immediateTurns.length > 0) {
      setDialogueTurns(immediateTurns);
      setTranscript(serializeDialogue(immediateTurns));
      setTranscriptView("cards");
    }

    setLoading(true);
    setLoadingMsg("AI is identifying who said what (Doctor vs Patient)...");
    try {
      const res = await API.post(
        "/consultation-notes/format-dialogue",
        { transcript: textToFormat, patient },
        { headers: { role: user.role || "doctor", userid: user.id } }
      );
      if (res.data?.dialogue && res.data.dialogue.length > 0) {
        setDialogueTurns(res.data.dialogue);
      } else if (res.data?.formattedTranscript) {
        setDialogueTurns(parseTranscriptDialogue(res.data.formattedTranscript));
      }
      if (res.data?.formattedTranscript) {
        setTranscript(res.data.formattedTranscript);
      }
      setTranscriptView("cards");
      toast.success("Dialogue formatted successfully!");
    } catch (err) {
      console.warn("⚠️ [ConsultationNote] Format API error (kept local separation):", err);
    } finally {
      setLoading(false);
      setLoadingMsg("");
    }
  };

  const handleRawTextChange = (newVal) => {
    setTranscript(newVal);
    setDialogueTurns(parseTranscriptDialogue(newVal));
  };

  // ── STEP 2 → 3: GENERATE CLINICAL NOTE (SOAP, RxNote, Referral, Cert, Discharge) ──
  const generateSOAPNote = async (overrideTemplate = null) => {
    const templateToUse = overrideTemplate || selectedTemplate || "soap";
    const tmplObj = CLINICAL_TEMPLATES.find((t) => t.id === templateToUse) || CLINICAL_TEMPLATES[0];

    const textToAnalyze = transcript.trim() || (dialogueTurns.length > 0 ? serializeDialogue(dialogueTurns) : "");
    if (!textToAnalyze) {
      toast.warning("Please enter or transcribe a consultation dialogue before generating the note.");
      return;
    }

    console.log(`🚀 [AI Note Writer] Requesting Note (${templateToUse}) for patient: "${patient?.name}" | Transcript length: ${textToAnalyze.length}`);
    setLoading(true);
    setLoadingMsg(`Gemini AI is generating ${tmplObj.label}...`);

    try {
      const res = await API.post(
        "/consultation-notes/generate-soap",
        { transcript: textToAnalyze, patient, templateType: templateToUse },
        { headers: { role: user.role || "doctor", userid: user.id } }
      );

      console.log("✅ [AI Note Writer] Clinical Note generated successfully:", res.data);
      const incomingData = res.data.soapData || {};
      incomingData.templateType = res.data.templateType || templateToUse;

      setSoapData(incomingData);
      setSoapNote(res.data.soapNote || JSON.stringify(incomingData));
      setEditedData(JSON.parse(JSON.stringify(incomingData)));
      setSelectedTemplate(templateToUse);

      // Auto-save draft
      console.log("💾 [AI Note Writer] Auto-saving note draft to database...");
      const dr = await API.post(
        "/consultation-notes/save-draft",
        { patientId: patient.id, transcript: textToAnalyze, soapNote: JSON.stringify(incomingData) },
        { headers: { role: user.role || "doctor", userid: user.id } }
      );

      console.log("✅ [AI Note Writer] Draft note saved with ID:", dr.data?.note?.id);
      setSavedNoteId(dr.data.note.id);
      toast.success(`${tmplObj.label} generated and draft saved!`);
      // Move to Step 3 (Review & Edit Note)
      setCurrentStep(3);
    } catch (err) {
      const serverMsg = err?.response?.data?.detail
        ? `${err?.response?.data?.error || "Error"}: ${err?.response?.data?.detail}`
        : (err?.response?.data?.error || err.message);
      console.error("❌ [AI Note Writer] Generation failed:", {
        error: err,
        serverMsg,
        response: err.response?.data,
      });
      toast.error(`Clinical Note Generation Failed: ${serverMsg}`);
    } finally {
      setLoading(false);
      setLoadingMsg("");
    }
  };

  const handlePrintTemplate = (data) => {
    if (!data) return;
    const type = data.templateType || selectedTemplate || "soap";
    const patName = patient?.name || data._patient?.name || "Patient";
    const dateStr = new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
    const docName = user?.name ? `Dr. ${user.name}` : "Attending Physician";
    const clinic = user?.clinicName || "Healthray Multi-Specialty Clinic";

    let title = "Clinical Consultation Document";
    let bodyHtml = "";

    if (type === "quick_opd") {
      title = `OPD Prescription - ${patName}`;
      const medRows = Array.isArray(data.medications_table) && data.medications_table.length > 0
        ? data.medications_table.map((m, i) => `
            <tr>
              <td>${i + 1}</td>
              <td><strong>${m.name}</strong></td>
              <td><span class="badge">${m.timing || "1-0-1"}</span></td>
              <td>${m.food || "After Food"}</td>
              <td>${m.duration || "—"}</td>
            </tr>
          `).join("")
        : `<tr><td colspan="5">${data.medications || "No medications prescribed"}</td></tr>`;

      const compList = Array.isArray(data.chief_complaints) && data.chief_complaints.length > 0
        ? data.chief_complaints.map((c) => `<li>${c}</li>`).join("")
        : `<li>${data.what_patient_said || "—"}</li>`;

      bodyHtml = `
        <div class="hdr">
          <div>
            <h1>${clinic}</h1>
            <p>Outpatient Department (OPD) Prescription</p>
          </div>
          <div style="text-align: right;">
            <p><strong>Date:</strong> ${dateStr}</p>
            <p><strong>Doctor:</strong> ${docName}</p>
          </div>
        </div>
        <div class="box">
          <p><strong>Patient:</strong> ${patName} | <strong>Age/Gender:</strong> ${patient?.age || "—"} / ${patient?.gender || "—"} | <strong>Blood Group:</strong> ${patient?.bloodGroup || "—"}</p>
        </div>
        <div class="box">
          <div class="box-title">Chief Complaints</div>
          <ul style="margin: 4px 0 0 16px; padding: 0;">${compList}</ul>
        </div>
        <div class="box">
          <div class="box-title">Diagnosis & Examination</div>
          <p><strong>Diagnosis:</strong> ${data.diagnosis || data.likely_diagnosis || "—"}</p>
          <p><strong>Examination:</strong> ${data.examination || data.what_was_observed || "—"}</p>
        </div>
        <div class="box">
          <div class="box-title">Rx - Prescribed Medications (1-0-1 Timings)</div>
          <table>
            <thead>
              <tr><th>#</th><th>Medicine</th><th>Timing</th><th>Relation to Food</th><th>Duration</th></tr>
            </thead>
            <tbody>${medRows}</tbody>
          </table>
        </div>
        <div class="box">
          <div class="box-title">Instructions & Follow-up</div>
          <p><strong>Advice:</strong> ${data.instructions || data.treatment_plan || "—"}</p>
          <p><strong>Review:</strong> ${data.review_after || data.follow_up || "—"}</p>
        </div>
        <div class="sign-area">
          <div class="sign-line">${docName}<br/><small style="font-weight: normal; color: #64748b;">Signature / Reg No.</small></div>
        </div>
      `;
    } else if (type === "referral") {
      title = `Specialist Referral Letter - ${patName}`;
      bodyHtml = `
        <div class="hdr">
          <div>
            <h1>${clinic}</h1>
            <p>Clinical Specialist Referral Letter</p>
          </div>
          <div style="text-align: right;">
            <p><strong>Date:</strong> ${dateStr}</p>
            <p><strong>Priority:</strong> <span class="badge">${data.referral_urgency || "Routine"}</span></p>
          </div>
        </div>
        <div class="box">
          <p><strong>To:</strong> ${data.recipient_specialty || "Specialist Consultant"}</p>
          <p><strong>Re:</strong> Referral of ${patName} (Age: ${patient?.age || "—"}, Gender: ${patient?.gender || "—"})</p>
        </div>
        <div class="box">
          <div class="box-title">Reason for Referral</div>
          <p>${data.referral_reason || "Specialist evaluation and management."}</p>
        </div>
        <div class="box">
          <div class="box-title">Clinical History & Presentation</div>
          <p>${data.clinical_summary || data.what_patient_said || "—"}</p>
        </div>
        <div class="box">
          <div class="box-title">Investigations & Current Medications</div>
          <p><strong>Investigations / Vitals:</strong> ${data.investigations_done || data.what_was_observed || "—"}</p>
          <p><strong>Active Medications:</strong> ${data.current_medications || data.medications || "—"}</p>
        </div>
        <div class="box">
          <div class="box-title">Provisional Diagnosis & Specific Questions</div>
          <p><strong>Suspected Diagnosis:</strong> ${data.provisional_diagnosis || data.likely_diagnosis || "—"}</p>
          <p><strong>Questions for Consultant:</strong> ${data.specific_questions || "Kindly evaluate and advise on further care."}</p>
        </div>
        <div class="sign-area">
          <div class="sign-line">${docName}<br/><small style="font-weight: normal; color: #64748b;">Referring Practitioner</small></div>
        </div>
      `;
    } else if (type === "certificate") {
      title = `Medical Sickness Certificate - ${patName}`;
      bodyHtml = `
        <div class="hdr" style="border-bottom: 2px solid #10b981;">
          <div>
            <h1 style="color: #065f46;">${clinic}</h1>
            <p style="color: #047857; font-weight: 700;">Official Medical Sickness &amp; Fitness Certificate</p>
          </div>
          <div style="text-align: right;">
            <p><strong>Date of Issue:</strong> ${dateStr}</p>
          </div>
        </div>
        <div style="margin: 20px 0; font-size: 14px; line-height: 1.8;">
          <p>This is to certify that <strong>${data.patient_name || patName}</strong>, Age: ${patient?.age || "—"}, Gender: ${patient?.gender || "—"}, has been clinically examined and diagnosed with <strong>${data.illness_diagnosis || data.likely_diagnosis || "Acute medical illness"}</strong>.</p>
          <p>Due to this condition, the patient is advised medical rest and absence from duty/school for a period of <strong>${data.rest_days_recommended || "3 Days"}</strong>, starting from <strong>${data.rest_from_date || dateStr}</strong> to <strong>${data.rest_to_date || "as advised"}</strong>.</p>
          <p><strong>Fitness Status:</strong> ${data.fitness_status || "Unfit for occupational / academic duties during the stated rest period."}</p>
          <p><strong>Remarks & Guidance:</strong> ${data.doctor_remarks || data.treatment_plan || "Strict rest and prescribed medications advised."}</p>
        </div>
        <div class="sign-area" style="margin-top: 60px;">
          <div class="sign-line">${docName}<br/><small style="font-weight: normal; color: #64748b;">Authorized Medical Officer (Seal &amp; Signature)</small></div>
        </div>
      `;
    } else if (type === "discharge") {
      title = `Discharge Summary - ${patName}`;
      bodyHtml = `
        <div class="hdr" style="border-bottom: 2px solid #ec4899;">
          <div>
            <h1 style="color: #be185d;">${clinic}</h1>
            <p>Hospital Discharge &amp; Procedural Summary</p>
          </div>
          <div style="text-align: right;">
            <p><strong>Admission:</strong> ${data.admission_date || "—"}</p>
            <p><strong>Discharge:</strong> ${data.discharge_date || dateStr}</p>
          </div>
        </div>
        <div class="box">
          <p><strong>Patient:</strong> ${patName} | <strong>Age/Gender:</strong> ${patient?.age || "—"} / ${patient?.gender || "—"}</p>
          <p><strong>Final Diagnosis:</strong> ${data.final_diagnosis || data.likely_diagnosis || "—"}</p>
          <p><strong>Procedure / Management:</strong> ${data.procedure_performed || "Conservative management"}</p>
        </div>
        <div class="box">
          <div class="box-title">Hospital Course & Clinical Response</div>
          <p>${data.hospital_course || data.what_patient_said || "—"}</p>
        </div>
        <div class="box">
          <div class="box-title">Discharge Vitals & Medications</div>
          <p><strong>Vitals at Discharge:</strong> ${data.discharge_vitals || data.what_was_observed || "—"}</p>
          <p><strong>Discharge Medications:</strong> ${data.discharge_medications || data.medications || "—"}</p>
        </div>
        <div class="box">
          <div class="box-title">Diet, Advice & Red Flags</div>
          <p><strong>Diet / Advice:</strong> ${data.diet_lifestyle_advice || data.treatment_plan || "—"}</p>
          <p style="color: #b91c1c;"><strong>Emergency Red Flags:</strong> ${data.emergency_red_flags || "Return immediately in case of severe pain, high fever, or breathlessness."}</p>
          <p><strong>Follow-up:</strong> ${data.follow_up_instructions || data.follow_up || "—"}</p>
        </div>
        <div class="sign-area">
          <div class="sign-line">${docName}<br/><small style="font-weight: normal; color: #64748b;">Consultant In-Charge</small></div>
        </div>
      `;
    } else {
      title = `Clinical SOAP Note - ${patName}`;
      bodyHtml = `
        <div class="hdr">
          <div>
            <h1>${clinic}</h1>
            <p>Clinical SOAP Consultation Note</p>
          </div>
          <div style="text-align: right;">
            <p><strong>Date:</strong> ${dateStr}</p>
            <p><strong>Doctor:</strong> ${docName}</p>
          </div>
        </div>
        <div class="box">
          <p><strong>Patient:</strong> ${patName} | <strong>Age/Gender:</strong> ${patient?.age || "—"} / ${patient?.gender || "—"}</p>
          <p><strong>Executive Summary:</strong> ${data.quick_summary || "—"}</p>
        </div>
        <div class="box">
          <div class="box-title">Subjective (What Patient Said)</div>
          <p>${data.what_patient_said || "—"}</p>
        </div>
        <div class="box">
          <div class="box-title">Objective (Clinical Findings & Vitals)</div>
          <p>${data.what_was_observed || "—"}</p>
        </div>
        <div class="box">
          <div class="box-title">Assessment (Diagnosis)</div>
          <p>${data.likely_diagnosis || "—"}</p>
        </div>
        <div class="box">
          <div class="box-title">Plan (Treatment & Prescriptions)</div>
          <p><strong>Treatment Plan:</strong> ${data.treatment_plan || "—"}</p>
          <p><strong>Medications:</strong> ${data.medications || "—"}</p>
          <p><strong>Follow-up:</strong> ${data.follow_up || "—"}</p>
        </div>
        <div class="sign-area">
          <div class="sign-line">${docName}<br/><small style="font-weight: normal; color: #64748b;">Attending Physician</small></div>
        </div>
      `;
    }

    printClinicalDocument(title, bodyHtml);
  };

  const handleFieldEdit = (key, value) => {
    setEditedData((prev) => ({ ...prev, [key]: value }));
  };

  // ── STEP 3 → 4: APPROVE & SAVE NOTE ──
  const approveNote = async () => {
    if (!savedNoteId) {
      toast.warning("No draft note ID found. Please regenerate or re-save the draft.");
      return;
    }

    console.log(`🚀 [AI Note Writer] Approving consultation note ID: ${savedNoteId}...`);
    setLoading(true);
    setLoadingMsg("Generating patient-friendly summary and approving note...");

    try {
      const res = await API.post(
        "/consultation-notes/approve",
        { noteId: savedNoteId, finalNote: JSON.stringify(editedData) },
        { headers: { role: user.role || "doctor", userid: user.id } }
      );

      console.log("✅ [AI Note Writer] Consultation note approved and saved:", res.data);
      setApproved(true);
      toast.success("Consultation note approved and saved successfully!");
      setCurrentStep(4);
      fetchPastNotes();
    } catch (err) {
      const serverMsg = err?.response?.data?.error || err?.response?.data?.detail || err.message;
      console.error("❌ [AI Note Writer] Approve failed:", {
        error: err,
        serverMsg,
        response: err.response?.data,
      });
      toast.error(`Failed to approve consultation note: ${serverMsg}`);
    } finally {
      setLoading(false);
      setLoadingMsg("");
    }
  };

  // ── PAST NOTES ──
  const fetchPastNotes = async () => {
    if (!patient?.id) return;
    console.log(`📋 [AI Note Writer] Fetching past consultation notes for patient ID: ${patient.id}...`);
    setLoadingNotes(true);
    try {
      const res = await API.get(`/consultation-notes?patientId=${patient.id}`, {
        headers: { role: user.role || "doctor", userid: user.id },
      });
      console.log(`✅ [AI Note Writer] Loaded ${res.data?.length || 0} past notes for ${patient.name}`);
      setPastNotes(res.data || []);
    } catch (err) {
      console.error("❌ [AI Note Writer] Failed to fetch past notes:", err);
    } finally {
      setLoadingNotes(false);
    }
  };

  const executeDeleteNote = async (noteId) => {
    setDeletingNoteId(noteId);
    try {
      await API.delete(`/consultation-notes/${noteId}`, {
        headers: { role: user.role || "doctor", userid: user.id },
      });
      toast.success("Consultation note deleted successfully!");
      setPastNotes((prev) => prev.filter((n) => n.id !== noteId));
      setConfirmDeleteId(null);
    } catch (err) {
      const msg = err.response?.data?.error || err.message;
      console.error("Failed to delete note:", err);
      toast.error(`Failed to delete note: ${msg}`);
    } finally {
      setDeletingNoteId(null);
    }
  };

  const parseNote = (note) => {
    try {
      return JSON.parse(note);
    } catch {
      return null;
    }
  };

  // Cleanup media tracks on unmount
  useEffect(() => {
    return () => {
      clearInterval(timerRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (displayStreamRef.current) {
        displayStreamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  if (!patient) return null;

  // ==========================================
  // RENDER
  // ==========================================
  return (
    <>
      {/* TRIGGER BUTTON */}
      <button className="consult-trigger-btn" onClick={openModal} id="consult-note-btn">
        <BsFileEarmarkTextFill />
        AI Note Writer
      </button>

      {/* MODAL */}
      {isOpen && (
        <div
          className="cn-overlay"
          onClick={(e) => e.target === e.currentTarget && !isRecording && closeModal()}
        >
          <div className="cn-modal">
            {/* ── LEFT SIDEBAR RAIL ── */}
            <aside className="cn-sidebar">
              <div>
                <div className="cn-brand">
                  <div className="cn-brand-icon">
                    <FaStethoscope />
                  </div>
                  <div>
                    <div className="cn-brand-title">AI Note Writer</div>
                    <div className="cn-brand-sub">Clinical Scribe Studio</div>
                  </div>
                </div>

                {patient && (
                  <div className="cn-patient-pill">
                    <div className="cn-patient-avatar">
                      {patient.name?.[0]?.toUpperCase() || "P"}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div className="cn-patient-name">{patient.name}</div>
                      <div className="cn-patient-meta">
                        {patient.age}y · {patient.gender} · {patient.bloodGroup || "N/A"}
                      </div>
                    </div>
                  </div>
                )}

                {/* ── PATIENT CLINICAL SNAPSHOT: ACTIVE MEDS & LAST VISIT FLASH ONLY (RxNote + ROSC Inspired) ── */}
                {patient && (
                  <div className="cn-safety-card">
                    <div className="cn-safety-card-header">
                      <div className="cn-safety-card-title">
                        <FaShieldAlt className="cn-safety-badge-icon" />
                        <span>Clinical Snapshot</span>
                      </div>
                      <span className="cn-safety-source-badge">Pre-Visit Flash</span>
                    </div>

                    <div className="cn-safety-items">
                      {/* Active Daily Medications */}
                      <div className="cn-safety-row">
                        <div className="cn-safety-lbl">
                          <FaPills className="cn-safety-ico meds" />
                          <span>Active Daily Meds:</span>
                        </div>
                        <div className="cn-safety-val meds-text">
                          {safetyProfile.activeMeds}
                        </div>
                      </div>

                      {/* Last Visit Flash (1 sentence) */}
                      <div className="cn-safety-row flash-row">
                        <div className="cn-safety-lbl">
                          <FaClock className="cn-safety-ico flash" />
                          <span>Last Visit Flash:</span>
                        </div>
                        <div className="cn-safety-flash-text">
                          "{safetyProfile.lastVisitFlash}"
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="cn-stepper">
                  <div className="cn-stepper-heading">Workflow Progress</div>
                  {[
                    { id: 1, label: "Record / Audio", desc: "Mic or audio/video file" },
                    { id: 2, label: "Transcript", desc: "Review Doctor & Patient" },
                    { id: 3, label: "SOAP Note", desc: "Edit & verify fields" },
                    { id: 4, label: "Approved", desc: "Saved to EHR" },
                  ].map((step) => {
                      const isDone = currentStep > step.id;
                      const isActive = currentStep === step.id;
                      const canJumpBack = isDone && !loading && !isRecording && currentStep !== 4;
                      return (
                        <div
                          key={step.id}
                          className={`cn-step ${isActive ? "active" : isDone ? "done" : ""} ${canJumpBack ? "clickable" : ""}`}
                          onClick={() => canJumpBack && setCurrentStep(step.id)}
                          title={canJumpBack ? `Return to ${step.label}` : undefined}
                        >
                          <div className="cn-step-dot">
                            {isDone ? <FaCheckCircle size={13} /> : step.id}
                          </div>
                          <div>
                            <div className="cn-step-title">{step.label}</div>
                            <div className="cn-step-desc">{step.desc}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

              <div className="cn-sidebar-tip">
                {currentStep === 1
                  ? "Tip: You can pause & resume recording anytime."
                  : currentStep === 2
                  ? "Tip: Review Doctor vs Patient turns, switch speakers, or insert replies before generating."
                  : currentStep === 3
                  ? "Tip: Edit any SOAP card field directly before approving into the patient's EHR."
                  : "Note approved and synced with the patient's portal."}
              </div>
            </aside>

            {/* ── RIGHT MAIN WORKSPACE ── */}
            <section className="cn-main">
              <div className="cn-topbar">
                <div>
                  <div className="cn-topbar-title">
                    {currentStep === 1
                      ? "Step 1 — Record or Upload Consultation"
                      : currentStep === 2
                      ? "Step 2 — Doctor & Patient Transcript"
                      : currentStep === 3
                      ? "Step 3 — Review & Edit SOAP Note"
                      : "Step 4 — Consultation Saved"}
                  </div>
                  <div className="cn-topbar-sub">
                    {currentStep === 1
                      ? "Capture live consultation audio or upload a recorded audio/video file"
                      : currentStep === 2
                      ? "AI separated Doctor and Patient turns. Edit or adjust any line below."
                      : currentStep === 3
                      ? "Verify the AI-generated clinical summary, diagnosis, and prescriptions."
                      : "Official EHR record and patient-friendly summary have been saved."}
                  </div>
                </div>
                <button className="cn-close-btn" onClick={closeModal} title="Close (Esc)">
                  <FaTimes />
                </button>
              </div>

              {/* Fixed Header Toolbar for Step 2 */}
              {currentStep === 2 && (
                    <div className="cn-step2-toolbar-bar">
                      <div className="cn-toolbar">
                        <div className="cn-segmented">
                          <button
                            type="button"
                            className={`cn-seg-btn ${transcriptView === "cards" ? "active" : ""}`}
                            onClick={() => setTranscriptView("cards")}
                          >
                            <FaComments /> Dialogue Cards ({dialogueTurns.length})
                          </button>
                          <button
                            type="button"
                            className={`cn-seg-btn ${transcriptView === "raw" ? "active" : ""}`}
                            onClick={() => setTranscriptView("raw")}
                          >
                            <FaEdit /> Raw Text
                          </button>
                        </div>

                        <div className="cn-toolbar-actions">
                          <button
                            type="button"
                            className="speaker-badge-btn speaker-btn-doctor"
                            onClick={() => handleAddTurn("Doctor")}
                            title="Add a Doctor dialogue statement"
                          >
                            <FaPlus size={10} /> <FaUserMd /> Doctor Says
                          </button>
                          <button
                            type="button"
                            className="speaker-badge-btn speaker-btn-patient"
                            onClick={() => handleAddTurn("Patient")}
                            title="Add a Patient dialogue statement"
                          >
                            <FaPlus size={10} /> <FaUser /> Patient Says
                          </button>
                          <button
                            type="button"
                            className="turn-action-btn"
                            onClick={() =>
                              copyToClipboard(
                                dialogueTurns.length > 0 ? serializeDialogue(dialogueTurns) : transcript,
                                "Transcript"
                              )
                            }
                            title="Copy conversation transcript"
                          >
                            <FaCopy size={11} /> Copy
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className={`cn-content ${currentStep === 2 ? "cn-content-step2" : ""}`}>
                    {loading && (
                      <div className="cn-loading-banner">
                        <div className="loading-dots">
                          <span />
                          <span />
                          <span />
                        </div>
                        <span>{loadingMsg}</span>
                      </div>
                    )}

                    {/* STEP 1: RECORD OR UPLOAD */}
                    {currentStep === 1 && (
                      <>
                        {!audioBlob ? (
                          <div className="cn-studio-grid">
                            {/* Live Mic Studio Card */}
                            <div className={`cn-studio-card ${isRecording && !isPaused ? "is-recording" : ""}`}>
                              {isRecording && (
                                <div className="cn-timer-badge">
                                  <span>{formatTime(recordingTime)}</span>
                                  {isPaused && <span style={{ color: "#fbbf24", fontSize: "11px" }}>PAUSED</span>}
                                </div>
                              )}

                              <div className="cn-mic-row">
                                <div className="cn-ctrl-col">
                                  <button
                                    id="record-toggle-btn"
                                    className={`cn-mic-btn ${isRecording ? "active" : "idle"}`}
                                    onClick={isRecording ? stopRecording : startRecording}
                                    title={isRecording ? "Stop Recording" : "Start Recording"}
                                  >
                                    {isRecording ? <FaStop /> : <FaMicrophone />}
                                  </button>
                                  <span className="cn-ctrl-label" style={{ color: isRecording ? "#ef4444" : "#0284c7" }}>
                                    {isRecording ? "Stop" : "Start"}
                                  </span>
                                </div>

                                {isRecording && (
                                  <div className="cn-ctrl-col">
                                    <button
                                      id="record-pause-btn"
                                      type="button"
                                      className="cn-pause-btn"
                                      onClick={isPaused ? resumeRecording : pauseRecording}
                                      title={isPaused ? "Resume Recording" : "Pause Recording"}
                                      style={{
                                        border: isPaused ? "2px solid #0284c7" : "2px solid #f59e0b",
                                        background: isPaused ? "#e0f2fe" : "#fef3c7",
                                        color: isPaused ? "#0284c7" : "#d97706",
                                      }}
                                    >
                                      {isPaused ? <FaPlay /> : <FaPause />}
                                    </button>
                                    <span className="cn-ctrl-label" style={{ color: isPaused ? "#0284c7" : "#d97706" }}>
                                      {isPaused ? "Resume" : "Pause"}
                                    </span>
                                  </div>
                                )}
                              </div>

                              {isRecording && !isPaused && (
                                <div className="audio-wave" style={{ marginBottom: "10px" }}>
                                  <span className="wave-bar bar-1" />
                                  <span className="wave-bar bar-2" />
                                  <span className="wave-bar bar-3" />
                                  <span className="wave-bar bar-4" />
                                  <span className="wave-bar bar-5" />
                                </div>
                              )}

                              <div className="cn-studio-heading">
                                {isRecording
                                  ? isPaused
                                    ? "Recording Paused"
                                    : "Listening & Recording..."
                                  : "Record Live Consultation"}
                              </div>
                              <div className="cn-studio-sub">
                                {isRecording
                                  ? isPaused
                                    ? "Click Resume to continue or Stop when finished."
                                    : "Speak naturally. Pause or Stop anytime."
                                  : "Click Start to record the doctor-patient conversation using your microphone."}
                              </div>
                            </div>

                            {/* Drag & Drop Upload Card */}
                            {!isRecording && (
                              <div
                                className={`cn-studio-card cn-dropzone ${isDraggingFile ? "is-dragging" : ""}`}
                                onDragOver={(e) => {
                                  e.preventDefault();
                                  setIsDraggingFile(true);
                                }}
                                onDragLeave={() => setIsDraggingFile(false)}
                                onDrop={(e) => {
                                  e.preventDefault();
                                  setIsDraggingFile(false);
                                  const droppedFile = e.dataTransfer?.files?.[0];
                                  if (droppedFile) handleFileUpload(droppedFile);
                                }}
                              >
                                <div
                                  style={{
                                    width: "52px",
                                    height: "52px",
                                    borderRadius: "14px",
                                    background: "#e0f2fe",
                                    color: "#0284c7",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    fontSize: "20px",
                                    marginBottom: "14px",
                                  }}
                                >
                                  <FaUpload />
                                </div>
                                <div className="cn-studio-heading">Upload Audio / Video File</div>
                                <div className="cn-studio-sub">
                                  Drag and drop a recorded consultation here, or browse from your device.
                                </div>
                                <div className="cn-format-pills">
                                  {["MP3", "WAV", "WEBM", "M4A", "MP4", "MOV"].map((fmt) => (
                                    <span key={fmt} className="cn-format-pill">{fmt}</span>
                                  ))}
                                </div>
                                <button
                                  id="upload-audio-btn"
                                  className="consult-btn btn-outline"
                                  onClick={() => fileInputRef.current?.click()}
                                >
                                  <FaUpload style={{ marginRight: 6 }} /> Choose File
                                </button>
                                <input
                                  ref={fileInputRef}
                                  type="file"
                                  accept="audio/*,video/*,.mp3,.wav,.webm,.ogg,.m4a,.aac,.mp4,.mov,.mkv"
                                  style={{ display: "none" }}
                                  onChange={handleFileUpload}
                                />
                              </div>
                            )}
                          </div>
                        ) : (
                          /* Preview Ready Card */
                          <div className="cn-preview-card">
                            <div className="cn-preview-meta">
                              <span>
                                <strong>Ready for Transcription:</strong> {uploadedFileName || "Recorded Consultation"}
                              </span>
                              <span>{(audioBlob.size / 1024).toFixed(1)} KB</span>
                            </div>

                            {audioUrl && (
                              (audioBlob.type?.startsWith("video/") || /\.(mp4|mov|mkv)$/i.test(uploadedFileName)) ? (
                                <video
                                  controls
                                  src={audioUrl}
                                  preload="metadata"
                                  onLoadedMetadata={(e) => {
                                    const media = e.currentTarget;
                                    if (media.duration === Infinity || isNaN(media.duration)) {
                                      media.currentTime = 1e101;
                                      media.ontimeupdate = () => {
                                        media.ontimeupdate = null;
                                        media.currentTime = 0;
                                      };
                                    }
                                  }}
                                  style={{ width: "100%", maxHeight: "240px", borderRadius: "10px", outline: "none", background: "#000" }}
                                />
                              ) : (
                                <audio
                                  controls
                                  src={audioUrl}
                                  preload="metadata"
                                  onLoadedMetadata={(e) => {
                                    const media = e.currentTarget;
                                    if (media.duration === Infinity || isNaN(media.duration)) {
                                      media.currentTime = 1e101;
                                      media.ontimeupdate = () => {
                                        media.ontimeupdate = null;
                                        media.currentTime = 0;
                                      };
                                    }
                                  }}
                                  style={{ width: "100%", borderRadius: "8px", outline: "none" }}
                                />
                              )
                            )}

                            <div className="consult-actions" style={{ marginTop: "4px" }}>
                              <button
                                className="consult-btn btn-primary"
                                onClick={transcribeAudio}
                                disabled={loading}
                              >
                                <MdRecordVoiceOver style={{ marginRight: 6 }} /> Transcribe Audio with Gemini AI
                              </button>
                              <button
                                className="consult-btn btn-outline"
                                onClick={() => {
                                  setAudioBlob(null);
                                  setUploadedFileName("");
                                  setRecordingTime(0);
                                  if (fileInputRef.current) fileInputRef.current.value = "";
                                }}
                              >
                                <FaTimes style={{ marginRight: 6 }} /> Clear / Re-record
                              </button>
                              <button
                                className="consult-btn btn-outline"
                                onClick={() => {
                                  setTranscriptView("raw");
                                  setCurrentStep(2);
                                }}
                                title="Skip audio and type or paste consultation notes directly"
                              >
                                <FaEdit style={{ marginRight: 6 }} /> Type Notes Manually Instead
                              </button>
                            </div>
                          </div>
                        )}

                        {!audioBlob && !isRecording && (
                          <div className="cn-manual-link-bar">
                            <span>Prefer typing or pasting notes directly without audio?</span>
                            <button
                              className="consult-btn btn-outline"
                              onClick={() => {
                                setTranscriptView("raw");
                                setCurrentStep(2);
                              }}
                            >
                              <FaEdit style={{ marginRight: 6 }} /> Write / Paste Notes Manually
                            </button>
                          </div>
                        )}
                      </>
                    )}

                    {/* STEP 2: REVIEW & EDIT TRANSCRIPT */}
                    {currentStep === 2 && (
                      <>
                        {transcriptView === "cards" && (
                          <div className="cn-turn-list">
                            {dialogueTurns.length === 0 ? (
                              <div style={{ textAlign: "center", padding: "28px 16px", color: "#64748b", border: "1px dashed #cbd5e1", borderRadius: "12px", background: "#f8fafc" }}>
                                <p style={{ margin: "0 0 10px 0", fontSize: "13px" }}>
                                  No dialogue cards yet. Type or paste your consultation notes in the text editor.
                                </p>
                                <button
                                  type="button"
                                  className="consult-btn btn-primary"
                                  style={{ padding: "6px 14px", fontSize: "12px", display: "inline-flex", margin: "0 auto" }}
                                  onClick={() => setTranscriptView("raw")}
                                >
                                  <FaEdit style={{ marginRight: 6 }} /> Open Text Editor
                                </button>
                              </div>
                            ) : (
                              dialogueTurns.map((turn, idx) => {
                                const isDoc = turn.speaker === "Doctor";
                                const isPat = turn.speaker === "Patient";
                                const roleClass = isDoc ? "doctor" : isPat ? "patient" : "caregiver";
                                return (
                                  <div key={idx} className={`cn-turn-card ${roleClass}`}>
                                    <div className="cn-turn-top">
                                      <div className="cn-turn-speaker">
                                        <div className={`cn-turn-avatar ${roleClass}`}>
                                          {isDoc ? <FaUserMd /> : <FaUser />}
                                        </div>
                                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                          <span className="cn-turn-label">
                                            {isDoc ? "Doctor" : (patient?.name || "Patient")}
                                          </span>
                                          <span className="cn-turn-sub">
                                            {isDoc ? "(Attending)" : "(Patient)"}
                                          </span>
                                        </div>
                                      </div>

                                      <div className="dialogue-turn-actions">
                                        <button
                                          type="button"
                                          className="turn-action-btn"
                                          onClick={() => handleToggleSpeaker(idx)}
                                          title={`Switch speaker to ${isDoc ? (patient?.name || "Patient") : "Doctor"}`}
                                        >
                                          <FaExchangeAlt size={10} /> Switch
                                        </button>
                                        <button
                                          type="button"
                                          className="turn-action-btn"
                                          onClick={() => handleAddTurn(isDoc ? "Patient" : "Doctor", idx)}
                                          title={`Insert ${isDoc ? "Patient" : "Doctor"} reply after this`}
                                        >
                                          <FaPlus size={10} /> Reply
                                        </button>
                                        <button
                                          type="button"
                                          className="turn-action-btn delete-btn"
                                          onClick={() => handleDeleteTurn(idx)}
                                          title="Delete this dialogue turn"
                                        >
                                          <FaTrash size={10} />
                                        </button>
                                      </div>
                                    </div>

                                    <textarea
                                      className="cn-turn-textarea"
                                      value={turn.text}
                                      onChange={(e) => handleUpdateTurnText(idx, e.target.value)}
                                      placeholder={isDoc ? "What did the doctor say?..." : "What did the patient say?..."}
                                      rows={Math.max(1, Math.ceil((turn.text?.length || 0) / 95))}
                                    />
                                  </div>
                                );
                              })
                            )}
                          </div>
                        )}

                        {transcriptView === "raw" && (
                          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                            <div style={{ fontSize: "12px", color: "#64748b", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              <span>Type or paste consultation notes, symptoms, or doctor shorthand below:</span>
                              <span style={{ fontSize: "11px", color: "#94a3b8" }}>{transcript?.length || 0} characters</span>
                            </div>
                            <textarea
                              className="transcript-box"
                              value={transcript}
                              onChange={(e) => handleRawTextChange(e.target.value)}
                              placeholder={`Type or paste your clinical visit notes here...\n\nExample:\nPatient presents with severe sore throat and fever of 100°F for 2 days. On examination, throat is red and inflamed. Prescribed Azithromycin 500mg once daily for 3 days and Paracetamol 650mg for fever. Advised warm salt water gargles and to avoid cold drinks.`}
                              rows={11}
                              autoFocus
                            />
                          </div>
                        )}

                        {/* Clinical Output Format Selector (RxNote, Tali AI Inspired) */}
                        <div className="cn-template-picker-section">
                          <div className="cn-template-picker-title">
                            <span>Select Clinical Output Format:</span>
                            <span className="cn-template-picker-sub">Choose template before generating</span>
                          </div>
                          <div className="cn-template-grid">
                            {CLINICAL_TEMPLATES.map((tmpl) => {
                              const Icon = tmpl.icon;
                              const isSelected = selectedTemplate === tmpl.id;
                              return (
                                <button
                                  key={tmpl.id}
                                  type="button"
                                  className={`cn-template-btn ${isSelected ? "selected" : ""}`}
                                  onClick={() => setSelectedTemplate(tmpl.id)}
                                >
                                  <div className="cn-template-btn-icon" style={{ color: tmpl.color, background: tmpl.bg }}>
                                    <Icon />
                                  </div>
                                  <div className="cn-template-btn-text">
                                    <span className="cn-template-btn-label">{tmpl.label}</span>
                                    <span className="cn-template-btn-tagline">{tmpl.tagline}</span>
                                  </div>
                                  {isSelected && <FaCheck className="cn-template-check" />}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </>
                    )}

                    {/* STEP 3: REVIEW & EDIT CLINICAL NOTE */}
                    {currentStep === 3 && editedData && (
                      <>
                        {/* 1-Click Template Switcher Bar */}
                        <div className="cn-step3-template-bar">
                          <span className="cn-step3-template-title">Format:</span>
                          <div className="cn-step3-pills">
                            {CLINICAL_TEMPLATES.map((tmpl) => {
                              const Icon = tmpl.icon;
                              const isActive = (editedData?.templateType || selectedTemplate) === tmpl.id;
                              return (
                                <button
                                  key={tmpl.id}
                                  type="button"
                                  className={`cn-step3-pill ${isActive ? "active" : ""}`}
                                  onClick={() => {
                                    if (!isActive) {
                                      generateSOAPNote(tmpl.id);
                                    }
                                  }}
                                  disabled={loading}
                                  title={`Switch format to ${tmpl.label}`}
                                >
                                  <Icon style={{ color: isActive ? "#ffffff" : tmpl.color }} />
                                  <span>{tmpl.label}</span>
                                  {isActive && <span className="cn-pill-active-dot" />}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        <details className="transcript-accordion">
                          <summary>
                            <span>View Original Transcript</span>
                            <span style={{ fontSize: 12, color: "#64748b" }}>Click to expand</span>
                          </summary>
                          <textarea
                            className="transcript-box"
                            value={transcript}
                            readOnly
                            rows={4}
                            style={{ marginTop: "12px" }}
                          />
                        </details>

                        {/* Render Active Template View */}
                        {editedData.templateType === "quick_opd" ? (
                          <QuickOpdCard
                            data={editedData}
                            editable={true}
                            onChange={handleFieldEdit}
                            onPrint={() => handlePrintTemplate(editedData)}
                            onCopy={(text, label) => copyToClipboard(text, label)}
                          />
                        ) : editedData.templateType === "referral" ? (
                          <ReferralLetterCard
                            data={editedData}
                            editable={true}
                            onChange={handleFieldEdit}
                            onPrint={() => handlePrintTemplate(editedData)}
                            onCopy={(text, label) => copyToClipboard(text, label)}
                          />
                        ) : editedData.templateType === "certificate" ? (
                          <MedicalCertificateCard
                            data={editedData}
                            editable={true}
                            onChange={handleFieldEdit}
                            onPrint={() => handlePrintTemplate(editedData)}
                            onCopy={(text, label) => copyToClipboard(text, label)}
                          />
                        ) : editedData.templateType === "discharge" ? (
                          <DischargeSummaryCard
                            data={editedData}
                            editable={true}
                            onChange={handleFieldEdit}
                            onPrint={() => handlePrintTemplate(editedData)}
                            onCopy={(text, label) => copyToClipboard(text, label)}
                          />
                        ) : (
                          <SoapNoteCard
                            data={editedData}
                            editable={true}
                            onChange={handleFieldEdit}
                          />
                        )}
                      </>
                    )}

                    {/* STEP 4: COMPLETE & APPROVED */}
                    {currentStep === 4 && (
                      <div className="cn-success-container">
                        <div className="cn-success-card">
                          <div className="cn-success-icon-wrap">
                            <FaCheckCircle className="cn-success-icon" />
                          </div>

                          <span className="cn-success-badge">EHR Record Approved</span>
                          <h3 className="cn-success-title">Consultation Note Saved!</h3>
                          <p className="cn-success-subtitle">
                            The clinical note has been officially signed and archived in{" "}
                            <strong>{patient?.name || "the patient"}</strong>&apos;s medical record.
                            A patient-friendly visit summary is now visible on their patient portal.
                          </p>

                          <div className="cn-success-meta-grid">
                            <div className="cn-success-meta-item">
                              <span className="cn-meta-lbl">Patient</span>
                              <strong className="cn-meta-val">{patient?.name || "Patient"}</strong>
                            </div>
                            <div className="cn-success-meta-item">
                              <span className="cn-meta-lbl">Record ID</span>
                              <strong className="cn-meta-val">#{savedNoteId || "EHR-SAVED"}</strong>
                            </div>
                            <div className="cn-success-meta-item">
                              <span className="cn-meta-lbl">Status</span>
                              <span className="cn-status-pill-green">
                                <FaCheckCircle style={{ marginRight: 4, fontSize: 11 }} /> Approved &amp; Signed
                              </span>
                            </div>
                            <div className="cn-success-meta-item">
                              <span className="cn-meta-lbl">Patient Summary</span>
                              <span className="cn-status-pill-blue">
                                <FaCheckCircle style={{ marginRight: 4, fontSize: 11 }} /> Synced to Portal
                              </span>
                            </div>
                          </div>

                          <div className="cn-success-actions">
                            <button
                              type="button"
                              className="consult-btn btn-primary"
                              onClick={closeModal}
                            >
                              <FaCheckCircle style={{ marginRight: 6 }} /> Done (Close)
                            </button>
                            <button
                              type="button"
                              className="consult-btn btn-outline"
                              onClick={resetAll}
                            >
                              <FaPlus style={{ marginRight: 6 }} /> New Consultation
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* STICKY WORKSPACE FOOTER FOR STEP 2 & 3 */}
                  {(currentStep === 2 || currentStep === 3) && (
                    <div className="cn-footer">
                      <button
                        className="consult-btn btn-outline"
                        onClick={() => setCurrentStep(currentStep === 2 ? 1 : 2)}
                      >
                        {currentStep === 2 ? "← Back to Audio" : "← Back to Transcript"}
                      </button>

                      {currentStep === 2 ? (
                        <button
                          className="consult-btn btn-primary"
                          onClick={() => generateSOAPNote(selectedTemplate)}
                          disabled={loading || (!transcript.trim() && dialogueTurns.length === 0)}
                        >
                          <HiOutlineSparkles style={{ marginRight: 6 }} />
                          Generate {CLINICAL_TEMPLATES.find((t) => t.id === selectedTemplate)?.label || "Clinical SOAP Note"}
                        </button>
                      ) : (
                        <div className="cn-footer-right">
                          <button
                            type="button"
                            className="consult-btn btn-outline"
                            onClick={() => handlePrintTemplate(editedData)}
                            title="Print this clinical document"
                          >
                            <FaPrint style={{ marginRight: 6 }} /> Print
                          </button>
                          <button
                            type="button"
                            className="consult-btn btn-outline"
                            onClick={() => {
                              const type = editedData?.templateType || selectedTemplate;
                              let textToCopy = "";
                              if (type === "quick_opd") {
                                textToCopy = editedData?.full_opd_note || [
                                  `OPD PRESCRIPTION: ${editedData?.diagnosis || editedData?.likely_diagnosis}`,
                                  `Complaints: ${Array.isArray(editedData?.chief_complaints) ? editedData?.chief_complaints.join(", ") : editedData?.what_patient_said}`,
                                  `Examination: ${editedData?.examination || editedData?.what_was_observed}`,
                                  `Medications:\n${Array.isArray(editedData?.medications_table) ? editedData?.medications_table.map((m) => `• ${m.name}: ${m.timing} (${m.food}) x ${m.duration}`).join("\n") : editedData?.medications}`,
                                  `Instructions: ${editedData?.instructions || editedData?.treatment_plan}`,
                                  `Review: ${editedData?.review_after || editedData?.follow_up}`,
                                ].join("\n\n");
                              } else if (type === "referral") {
                                textToCopy = editedData?.full_letter || [
                                  `SPECIALIST REFERRAL: ${editedData?.recipient_specialty}`,
                                  `Reason: ${editedData?.referral_reason}`,
                                  `Clinical Summary: ${editedData?.clinical_summary}`,
                                  `Investigations: ${editedData?.investigations_done}`,
                                  `Medications: ${editedData?.current_medications}`,
                                  `Questions: ${editedData?.specific_questions}`,
                                ].join("\n\n");
                              } else if (type === "certificate") {
                                textToCopy = editedData?.full_certificate || [
                                  `MEDICAL CERTIFICATE`,
                                  `Patient: ${editedData?.patient_name || patient?.name}`,
                                  `Diagnosis: ${editedData?.illness_diagnosis}`,
                                  `Rest: ${editedData?.rest_days_recommended} (From ${editedData?.rest_from_date} to ${editedData?.rest_to_date})`,
                                  `Fitness: ${editedData?.fitness_status}`,
                                  `Remarks: ${editedData?.doctor_remarks}`,
                                ].join("\n\n");
                              } else if (type === "discharge") {
                                textToCopy = editedData?.full_summary || [
                                  `DISCHARGE SUMMARY`,
                                  `Admission: ${editedData?.admission_date} | Discharge: ${editedData?.discharge_date}`,
                                  `Diagnosis: ${editedData?.final_diagnosis}`,
                                  `Procedure: ${editedData?.procedure_performed}`,
                                  `Hospital Course: ${editedData?.hospital_course}`,
                                  `Discharge Vitals: ${editedData?.discharge_vitals}`,
                                  `Discharge Medications: ${editedData?.discharge_medications}`,
                                  `Follow-up: ${editedData?.follow_up_instructions}`,
                                ].join("\n\n");
                              } else {
                                textToCopy = [
                                  editedData?.quick_summary && `Summary: ${editedData.quick_summary}`,
                                  editedData?.what_patient_said && `What Patient Said: ${editedData.what_patient_said}`,
                                  editedData?.what_was_observed && `What Was Observed: ${editedData.what_was_observed}`,
                                  editedData?.likely_diagnosis && `Likely Diagnosis: ${editedData.likely_diagnosis}`,
                                  editedData?.treatment_plan && `Treatment Plan: ${editedData.treatment_plan}`,
                                  editedData?.medications && `Medicines Prescribed: ${editedData.medications}`,
                                  editedData?.follow_up && `Follow-up: ${editedData.follow_up}`,
                                ]
                                  .filter(Boolean)
                                  .join("\n\n");
                              }
                              copyToClipboard(textToCopy || soapNote, "Clinical Note");
                            }}
                            title="Copy clinical document"
                          >
                            <FaCopy style={{ marginRight: 6 }} /> Copy Note
                          </button>

                          <button
                            id="approve-note-btn"
                            className="consult-btn btn-success"
                            onClick={approveNote}
                            disabled={loading}
                          >
                            <FaCheckCircle style={{ marginRight: 6 }} /> Approve &amp; Save Note
                          </button>
                        </div>
                      )}
                    </div>
                  )}
            </section>
          </div>
        </div>
      )}
    </>
  );
}
