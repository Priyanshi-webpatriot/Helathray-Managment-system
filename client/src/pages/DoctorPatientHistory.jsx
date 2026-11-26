import React, { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import API from "../api";
import "../components/patientNote.css";
import {
  FiSearch,
  FiCalendar,
  FiCheckCircle,
  FiX,
  FiPrinter,
  FiCopy,
  FiTrash2,
  FiExternalLink,
  FiAlertCircle,
  FiFileText,
  FiActivity,
  FiChevronLeft,
  FiEdit2,
} from "react-icons/fi";
import {
  FaUserInjured,
  FaPills,
  FaStethoscope,
  FaClipboardList,
  FaEye,
  FaCommentMedical,
  FaUserMd,
  FaNotesMedical,
  FaBolt,
  FaPaperPlane,
  FaCertificate,
  FaHospital,
  FaFileAlt,
} from "react-icons/fa";
import { BsClockHistory, BsFileEarmarkMedical } from "react-icons/bs";
import { toast } from "react-toastify";

// Distinct modern color palettes for patient avatars
const PATIENT_PALETTES = [
  { bg: "#eff6ff", text: "#0284c7", border: "#bae6fd", avatar: "#0284c7" },
  { bg: "#f5f3ff", text: "#7c3aed", border: "#ddd6fe", avatar: "#8b5cf6" },
  { bg: "#fff7ed", text: "#ea580c", border: "#fed7aa", avatar: "#f97316" },
  { bg: "#fdf2f8", text: "#db2777", border: "#fbcfe8", avatar: "#ec4899" },
  { bg: "#ecfdf5", text: "#059669", border: "#a7f3d0", avatar: "#10b981" },
  { bg: "#ecfeff", text: "#0891b2", border: "#a5f3fc", avatar: "#06b6d4" },
];

const getPatientAvatarColor = (name = "") => {
  if (!name) return PATIENT_PALETTES[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const idx = Math.abs(hash) % PATIENT_PALETTES.length;
  return PATIENT_PALETTES[idx];
};

const getPatientInitials = (name = "") => {
  const parts = (name || "Patient").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "PT";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const getPatientStatusBadgeMeta = (status = "ACTIVE") => {
  const norm = String(status || "").toUpperCase().trim();
  if (norm === "CRITICAL") {
    return {
      label: "CRITICAL",
      bg: "#fef2f2",
      text: "#b91c1c",
      border: "#fecaca",
      dot: "#ef4444",
      isPulse: true,
    };
  }
  if (norm === "DISCHARGED") {
    return {
      label: "DISCHARGED",
      bg: "#f1f5f9",
      text: "#475569",
      border: "#cbd5e1",
      dot: "#94a3b8",
      isPulse: false,
    };
  }
  return {
    label: "ACTIVE",
    bg: "#ecfdf5",
    text: "#059669",
    border: "#a7f3d0",
    dot: "#10b981",
    isPulse: false,
  };
};

const parseNotePreview = (patientNote = "", soapNote = "") => {
  let snippet = "";
  let hasMeds = false;

  if (patientNote) {
    const lines = patientNote
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    const contentLines = lines.filter((l) => !l.startsWith("From") && !l.startsWith("Note from"));
    snippet = contentLines
      .slice(0, 2)
      .join(" ")
      .replace(/^[-•*\d.)\s]+/, "");
    hasMeds = /medication|prescri|tablet|mg|dosage|capsule|syrup|rx/i.test(patientNote);
  }

  if (!snippet && soapNote) {
    try {
      const parsed = typeof soapNote === "string" ? JSON.parse(soapNote) : soapNote;
      snippet = parsed.quick_summary || parsed.likely_diagnosis || parsed.what_patient_said || "";
      hasMeds = Boolean(parsed.medications);
    } catch {
      snippet = soapNote.slice(0, 120);
    }
  }

  return {
    snippet: snippet || "Clinical consultation recorded and archived.",
    hasMeds,
  };
};

const getNoteTemplateMeta = (note) => {
  if (!note) return null;
  const raw = note.finalNote || note.soapNote;
  if (!raw) return null;
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    const type = parsed?.templateType;
    if (type === "quick_opd") return { label: "Quick OPD", Icon: FaBolt, bg: "#fef3c7", text: "#b45309" };
    if (type === "referral") return { label: "Referral", Icon: FaPaperPlane, bg: "#ede9fe", text: "#6d28d9" };
    if (type === "certificate") return { label: "Sickness Cert", Icon: FaCertificate, bg: "#d1fae5", text: "#065f46" };
    if (type === "discharge") return { label: "Discharge", Icon: FaHospital, bg: "#fce7f3", text: "#be185d" };
    return { label: "SOAP Note", Icon: FaFileAlt, bg: "#e0f2fe", text: "#0369a1" };
  } catch {
    return null;
  }
};

const renderInlineMarkdown = (text = "") => {
  if (!text) return "";
  // Split by markdown bold (**text** or __text__)
  const parts = text.split(/(\*\*[^*]+?\*\*|__[^*]+?__)/g);
  return parts.map((part, i) => {
    if (
      (part.startsWith("**") && part.endsWith("**")) ||
      (part.startsWith("__") && part.endsWith("__"))
    ) {
      return (
        <strong key={i} style={{ fontWeight: 700, color: "#0f172a" }}>
          {part.slice(2, -2)}
        </strong>
      );
    }
    return part;
  });
};

const renderFormattedLine = (line, idx) => {
  const trimmed = line.trim();
  if (!trimmed) return null;

  // 1. Doctor Greeting / "From Dr. ..." / "Note from ..."
  if (/^From\b|^Note from/i.test(trimmed)) {
    return (
      <div key={idx} className="pnw-note-from">
        <FaUserMd />
        <span>{renderInlineMarkdown(trimmed)}</span>
      </div>
    );
  }

  // 2. Section Heading Detection
  // Matches:
  // - Markdown hash headers: "### Title"
  // - Markdown bold headers: "**What is going on with your health**"
  // - Colon headers: "Your medicines:"
  // - Known clinical sections (case-insensitive)
  const isMarkdownHeader = /^#{1,4}\s+/.test(trimmed);
  const isDoubleAsteriskHeader = /^\*\*[^*]+?\*\*:?$/.test(trimmed);
  const isDoubleUnderscoreHeader = /^__[^_]+?__:?$/.test(trimmed);

  const cleanTitle = trimmed
    .replace(/^#{1,4}\s+/, "")
    .replace(/^\*\*|\*\*:?$/g, "")
    .replace(/^__|__:?$/g, "")
    .replace(/:$/, "")
    .trim();

  const isKnownSection =
    /^(what is going on|your medicines|what to do|what to do and avoid|what to avoid|when to see your doctor|when to seek medical help|warning signs|red flags|emergency|summary|diagnosis|assessment|plan|medications|prescription|instructions|follow[- ]?up|advice|notes|symptoms|recommendations|diet|lifestyle|care instructions|test results|next steps)\b/i.test(
      cleanTitle
    );

  const isColonSection = trimmed.endsWith(":") && cleanTitle.length <= 75 && !trimmed.includes(". ");
  const isShortBoldTitle = (isDoubleAsteriskHeader || isDoubleUnderscoreHeader) && cleanTitle.length <= 75 && !cleanTitle.includes(". ");

  if (isMarkdownHeader || isShortBoldTitle || (isKnownSection && cleanTitle.length <= 75) || isColonSection) {
    return (
      <h4 key={idx} className="pnw-note-section-title">
        {cleanTitle}
      </h4>
    );
  }

  // 3. Numbered steps (e.g. "1. ..." or "1) ...")
  const numberedMatch = trimmed.match(/^(\d+)[.)]\s+(.*)$/);
  if (numberedMatch) {
    return (
      <div key={idx} className="pnw-note-step">
        <span className="pnw-step-num">{numberedMatch[1]}</span>
        <span>{renderInlineMarkdown(numberedMatch[2])}</span>
      </div>
    );
  }

  // 4. Bullet Points (handles •, -, *, and Unicode bullets)
  if (/^[-•*\u2022\u2023\u25E6\u2043\u2219▪▫–—]\s+/.test(trimmed)) {
    const bulletContent = trimmed.replace(/^[-•*\u2022\u2023\u25E6\u2043\u2219▪▫–—]\s+/, "");
    return (
      <div key={idx} className="pnw-note-bullet">
        <span className="pnw-bullet-dot" />
        <span>{renderInlineMarkdown(bulletContent)}</span>
      </div>
    );
  }

  // 5. Standard Paragraphs (with inline bold parsing)
  return (
    <p key={idx} className="pnw-note-paragraph">
      {renderInlineMarkdown(trimmed)}
    </p>
  );
};

function printDoctorConsultation(note, activeTab, parsedSoap) {
  if (!note) return;
  const pat = note.patient || {};
  const doc = note.doctor || {};
  const patName = pat.name || parsedSoap?._patient?.name || parsedSoap?.patient_name || "Patient";
  const docName = doc.name ? (doc.name.startsWith("Dr") ? doc.name : `Dr. ${doc.name}`) : "Attending Physician";
  const clinic = doc.clinicName || "Healthray Multi-Specialty Clinic";
  const dateStr = new Date(note.createdAt).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const win = window.open("", "_blank", "width=850,height=900");
  if (!win) {
    window.print();
    return;
  }

  let title = "Clinical Consultation Record";
  let bodyHtml = "";

  if (activeTab === "summary") {
    title = `Patient Care Summary - ${patName}`;
    bodyHtml = `
      <div class="hdr" style="border-bottom: 2px solid #0d9488; padding-bottom: 12px; margin-bottom: 18px; display: flex; justify-content: space-between; align-items: flex-end;">
        <div>
          <h1 style="color: #0f766e; margin: 0; font-size: 20px; text-transform: uppercase;">${clinic}</h1>
          <p style="margin: 4px 0 0; font-size: 13px; color: #0d9488; font-weight: 700;">Patient Visit &amp; Care Instructions Summary</p>
        </div>
        <div style="text-align: right;">
          <p style="margin: 0; font-size: 12px; color: #64748b;"><strong>Visit Date:</strong> ${dateStr}</p>
          <p style="margin: 3px 0 0; font-size: 12px; color: #64748b;"><strong>Doctor:</strong> ${docName} (${doc.specialty || "General Medicine"})</p>
        </div>
      </div>
      <div class="box" style="margin-top: 16px;">
        <p><strong>Patient:</strong> ${patName} | <strong>Age/Gender:</strong> ${pat.age || "—"} / ${pat.gender || "—"} | <strong>Blood Group:</strong> ${pat.bloodGroup || "—"}</p>
      </div>
      <div class="box">
        <div class="box-title">Doctor's Care Instructions &amp; Patient Advice</div>
        <div style="font-size: 13.5px; line-height: 1.8; color: #1e293b; white-space: pre-line; margin-top: 8px;">
          ${(note.patientNote || "No visit summary available.").replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')}
        </div>
      </div>
      <div class="sign-area" style="margin-top: 60px; display: flex; justify-content: flex-end;">
        <div style="border-top: 1px solid #0f172a; width: 220px; text-align: center; padding-top: 8px;">
          <strong>${docName}</strong><br/>
          <span style="font-size: 11px; color: #64748b;">Attending Doctor Signature</span>
        </div>
      </div>
    `;
  } else if (activeTab === "transcript") {
    title = `Consultation Transcript - ${patName}`;
    bodyHtml = `
      <div class="hdr" style="border-bottom: 2px solid #6366f1; padding-bottom: 12px; margin-bottom: 18px; display: flex; justify-content: space-between; align-items: flex-end;">
        <div>
          <h1 style="color: #4f46e5; margin: 0; font-size: 20px; text-transform: uppercase;">${clinic}</h1>
          <p style="margin: 4px 0 0; font-size: 13px; color: #6366f1; font-weight: 700;">Verified Clinical Consultation Dialogue</p>
        </div>
        <div style="text-align: right;">
          <p style="margin: 0; font-size: 12px; color: #64748b;"><strong>Date:</strong> ${dateStr}</p>
          <p style="margin: 3px 0 0; font-size: 12px; color: #64748b;"><strong>Doctor:</strong> ${docName}</p>
        </div>
      </div>
      <div class="box" style="margin-top: 16px;">
        <p><strong>Patient:</strong> ${patName} | <strong>Age/Gender:</strong> ${pat.age || "—"} / ${pat.gender || "—"}</p>
      </div>
      <div class="box">
        <div class="box-title">Full Consultation Dialogue Transcript</div>
        <div style="font-size: 13px; line-height: 1.7; color: #1e293b; white-space: pre-line; margin-top: 8px;">
          ${note.transcript || "No transcript available."}
        </div>
      </div>
      <div class="sign-area" style="margin-top: 60px; display: flex; justify-content: flex-end;">
        <div style="border-top: 1px solid #0f172a; width: 220px; text-align: center; padding-top: 8px;">
          <strong>${docName}</strong><br/>
          <span style="font-size: 11px; color: #64748b;">Verified Clinical Dialogue Record</span>
        </div>
      </div>
    `;
  } else {
    // Clinical Format (SOAP / Referral / Certificate / Quick OPD / Discharge)
    const parsed = parsedSoap || {};
    const type = parsed?.templateType || "soap";

    if (type === "certificate") {
      title = `Medical Sickness Certificate - ${patName}`;
      bodyHtml = `
        <div class="hdr" style="border-bottom: 2px solid #10b981; padding-bottom: 12px; margin-bottom: 18px; display: flex; justify-content: space-between; align-items: flex-end;">
          <div>
            <h1 style="color: #065f46; margin: 0; font-size: 20px; text-transform: uppercase;">${clinic}</h1>
            <p style="color: #047857; margin: 4px 0 0; font-size: 13px; font-weight: 700;">Official Medical Sickness &amp; Fitness Certificate</p>
          </div>
          <div style="text-align: right;">
            <p style="margin: 0; font-size: 12px; color: #64748b;"><strong>Certificate Date:</strong> ${dateStr}</p>
            <p style="margin: 3px 0 0; font-size: 12px; color: #64748b;"><strong>Doctor:</strong> ${docName}</p>
          </div>
        </div>
        <div style="margin: 28px 0; font-size: 14.5px; line-height: 1.8; color: #1e293b;">
          <p>This is to certify that <strong>${parsed.patient_name || patName}</strong>, Age: ${pat.age || "—"}, Gender: ${pat.gender || "—"}, has been clinically examined and verified to be suffering from <strong>${parsed.illness_diagnosis || parsed.likely_diagnosis || "Acute medical illness"}</strong>.</p>
          <p>In view of the clinical evaluation, the patient is advised medical rest and absence from duties / classes for a duration of <strong>${parsed.rest_days_recommended || "3 Days"}</strong>, effective from <strong>${parsed.rest_from_date || dateStr}</strong> to <strong>${parsed.rest_to_date || "as advised"}</strong>.</p>
          <p><strong>Fitness Status:</strong> ${parsed.fitness_status || "Unfit for occupational / academic duties during the stated rest period."}</p>
          <p><strong>Clinical Remarks &amp; Advice:</strong> ${parsed.doctor_remarks || parsed.treatment_plan || "Strict medical rest and adherence to prescribed medications advised."}</p>
        </div>
        <div class="sign-area" style="margin-top: 60px; display: flex; justify-content: flex-end;">
          <div style="border-top: 1.5px solid #065f46; width: 220px; text-align: center; padding-top: 8px;">
            <strong style="color: #065f46; font-size: 13px;">${docName}</strong><br/>
            <span style="font-size: 11px; color: #64748b;">Authorized Medical Officer (Seal &amp; Signature)</span>
          </div>
        </div>
      `;
    } else if (type === "referral") {
      title = `Specialist Referral Letter - ${patName}`;
      bodyHtml = `
        <div class="hdr" style="border-bottom: 2px solid #8b5cf6; padding-bottom: 12px; margin-bottom: 18px; display: flex; justify-content: space-between; align-items: flex-end;">
          <div>
            <h1 style="color: #6d28d9; margin: 0; font-size: 20px; text-transform: uppercase;">${clinic}</h1>
            <p style="color: #7c3aed; margin: 4px 0 0; font-size: 13px; font-weight: 700;">Specialist Clinical Referral Letter</p>
          </div>
          <div style="text-align: right;">
            <p style="margin: 0; font-size: 12px; color: #64748b;"><strong>Date:</strong> ${dateStr}</p>
            <p style="margin: 3px 0 0; font-size: 12px; color: #b91c1c; font-weight: 700;">Priority: ${parsed.referral_urgency || "Routine"}</p>
          </div>
        </div>
        <div class="box" style="margin-top: 18px;">
          <p><strong>To:</strong> ${parsed.recipient_specialty || "Specialist Consultant"}</p>
          <p><strong>Patient:</strong> ${patName} | <strong>Age/Gender:</strong> ${pat.age || "—"} / ${pat.gender || "—"}</p>
          <p><strong>Reason for Referral:</strong> ${parsed.referral_reason || "Specialist evaluation and requested management."}</p>
        </div>
        <div class="box">
          <div class="box-title">Clinical Summary &amp; Presentation</div>
          <p>${parsed.clinical_summary || parsed.what_patient_said || "—"}</p>
        </div>
        <div class="box">
          <div class="box-title">Investigations &amp; Current Medications</div>
          <p><strong>Investigations Done:</strong> ${parsed.investigations_done || parsed.what_was_observed || "—"}</p>
          <p><strong>Current Active Medications:</strong> ${parsed.current_medications || parsed.medications || "—"}</p>
        </div>
        <div class="box">
          <div class="box-title">Suspected Diagnosis &amp; Specific Questions</div>
          <p><strong>Provisional Diagnosis:</strong> ${parsed.provisional_diagnosis || parsed.likely_diagnosis || "—"}</p>
          <p><strong>Questions for Consultant:</strong> ${parsed.specific_questions || "Kindly evaluate and advise on definitive management."}</p>
        </div>
        <div class="sign-area" style="margin-top: 50px; display: flex; justify-content: flex-end;">
          <div style="border-top: 1px solid #0f172a; width: 220px; text-align: center; padding-top: 8px;">
            <strong>${docName}</strong><br/>
            <span style="font-size: 11px; color: #64748b;">Referring Medical Practitioner</span>
          </div>
        </div>
      `;
    } else if (type === "quick_opd") {
      title = `OPD Prescription - ${patName}`;
      const medRows = Array.isArray(parsed.medications_table) && parsed.medications_table.length > 0
        ? parsed.medications_table.map((m, i) => `
            <tr>
              <td>${i + 1}</td>
              <td><strong>${m.name}</strong></td>
              <td><span class="badge">${m.timing || "1-0-1"}</span></td>
              <td>${m.food || "After Food"}</td>
              <td>${m.duration || "—"}</td>
            </tr>
          `).join("")
        : `<tr><td colspan="5">${parsed.medications || "No medications"}</td></tr>`;

      const compList = Array.isArray(parsed.chief_complaints) && parsed.chief_complaints.length > 0
        ? parsed.chief_complaints.map((c) => `<li>${c}</li>`).join("")
        : `<li>${parsed.what_patient_said || "—"}</li>`;

      bodyHtml = `
        <div class="hdr" style="border-bottom: 2px solid #0284c7; padding-bottom: 12px; margin-bottom: 18px; display: flex; justify-content: space-between; align-items: flex-end;">
          <div>
            <h1 style="color: #0369a1; margin: 0; font-size: 20px;">${clinic}</h1>
            <p style="margin: 4px 0 0; font-size: 13px; color: #64748b;">Outpatient Department (OPD) Prescription</p>
          </div>
          <div style="text-align: right;">
            <p style="margin: 0; font-size: 12px;"><strong>Date:</strong> ${dateStr}</p>
            <p style="margin: 3px 0 0; font-size: 12px;"><strong>Doctor:</strong> ${docName} (${doc.specialty || "OPD"})</p>
          </div>
        </div>
        <div class="box" style="margin-top: 16px;">
          <p><strong>Patient:</strong> ${patName} | <strong>Age/Gender:</strong> ${pat.age || "—"} / ${pat.gender || "—"} | <strong>Blood Group:</strong> ${pat.bloodGroup || "—"}</p>
        </div>
        <div class="box">
          <div class="box-title">Chief Complaints</div>
          <ul style="margin: 4px 0 0 16px; padding: 0;">${compList}</ul>
        </div>
        <div class="box">
          <div class="box-title">Diagnosis &amp; Examination</div>
          <p><strong>Diagnosis:</strong> ${parsed.diagnosis || parsed.likely_diagnosis || "—"}</p>
          <p><strong>Examination / Vitals:</strong> ${parsed.examination || parsed.what_was_observed || "—"}</p>
        </div>
        <div class="box">
          <div class="box-title">Rx - Prescribed Medications (1-0-1 Timings)</div>
          <table>
            <thead>
              <tr><th>#</th><th>Medicine</th><th>Timing</th><th>Meal Relation</th><th>Duration</th></tr>
            </thead>
            <tbody>${medRows}</tbody>
          </table>
        </div>
        <div class="box">
          <div class="box-title">Patient Advice &amp; Next Review</div>
          <p><strong>Advice:</strong> ${parsed.instructions || parsed.treatment_plan || "—"}</p>
          <p><strong>Review:</strong> ${parsed.review_after || parsed.follow_up || "—"}</p>
        </div>
        <div class="sign-area" style="margin-top: 50px; display: flex; justify-content: flex-end;">
          <div style="border-top: 1px solid #0f172a; width: 220px; text-align: center; padding-top: 8px;">
            <strong>${docName}</strong><br/>
            <span style="font-size: 11px; color: #64748b;">Attending Doctor Signature</span>
          </div>
        </div>
      `;
    } else if (type === "discharge") {
      title = `Discharge Summary - ${patName}`;
      bodyHtml = `
        <div class="hdr" style="border-bottom: 2px solid #ec4899; padding-bottom: 12px; margin-bottom: 18px; display: flex; justify-content: space-between; align-items: flex-end;">
          <div>
            <h1 style="color: #be185d; margin: 0; font-size: 20px;">${clinic}</h1>
            <p style="margin: 4px 0 0; font-size: 13px; color: #64748b;">Hospital Discharge &amp; Procedural Summary</p>
          </div>
          <div style="text-align: right;">
            <p style="margin: 0; font-size: 12px;"><strong>Admission:</strong> ${parsed.admission_date || "—"}</p>
            <p style="margin: 3px 0 0; font-size: 12px;"><strong>Discharge:</strong> ${parsed.discharge_date || dateStr}</p>
          </div>
        </div>
        <div class="box" style="margin-top: 16px;">
          <p><strong>Patient:</strong> ${patName} | <strong>Age/Gender:</strong> ${pat.age || "—"} / ${pat.gender || "—"}</p>
          <p><strong>Final Diagnosis:</strong> ${parsed.final_diagnosis || parsed.likely_diagnosis || "—"}</p>
          <p><strong>Procedure / Management:</strong> ${parsed.procedure_performed || "Conservative management"}</p>
        </div>
        <div class="box">
          <div class="box-title">Hospital Course &amp; Response to Treatment</div>
          <p>${parsed.hospital_course || parsed.what_patient_said || "—"}</p>
        </div>
        <div class="box">
          <div class="box-title">Discharge Vitals &amp; Medications</div>
          <p><strong>Vitals at Discharge:</strong> ${parsed.discharge_vitals || parsed.what_was_observed || "—"}</p>
          <p><strong>Discharge Medications:</strong> ${parsed.discharge_medications || parsed.medications || "—"}</p>
        </div>
        <div class="box">
          <div class="box-title">Diet, Advice &amp; Emergency Warnings</div>
          <p><strong>Diet / Advice:</strong> ${parsed.diet_lifestyle_advice || parsed.treatment_plan || "—"}</p>
          <p style="color: #b91c1c;"><strong>Emergency Red Flags:</strong> ${parsed.emergency_red_flags || "Return immediately in case of severe pain, high fever, or breathlessness."}</p>
          <p><strong>Follow-up:</strong> ${parsed.follow_up_instructions || parsed.follow_up || "—"}</p>
        </div>
        <div class="sign-area" style="margin-top: 50px; display: flex; justify-content: flex-end;">
          <div style="border-top: 1px solid #0f172a; width: 220px; text-align: center; padding-top: 8px;">
            <strong>${docName}</strong><br/>
            <span style="font-size: 11px; color: #64748b;">Consultant In-Charge</span>
          </div>
        </div>
      `;
    } else {
      title = `Clinical Consultation Record - ${patName}`;
      bodyHtml = `
        <div class="hdr" style="border-bottom: 2px solid #0284c7; padding-bottom: 12px; margin-bottom: 18px; display: flex; justify-content: space-between; align-items: flex-end;">
          <div>
            <h1 style="color: #0369a1; margin: 0; font-size: 20px;">${clinic}</h1>
            <p style="margin: 4px 0 0; font-size: 13px; color: #64748b;">Clinical Consultation Record</p>
          </div>
          <div style="text-align: right;">
            <p style="margin: 0; font-size: 12px;"><strong>Date:</strong> ${dateStr}</p>
            <p style="margin: 3px 0 0; font-size: 12px;"><strong>Doctor:</strong> ${docName}</p>
          </div>
        </div>
        <div class="box" style="margin-top: 16px;">
          <p><strong>Patient:</strong> ${patName} | <strong>Age/Gender:</strong> ${pat.age || "—"} / ${pat.gender || "—"}</p>
          <p><strong>Clinical Summary:</strong> ${parsed.quick_summary || "—"}</p>
        </div>
        <div class="box">
          <div class="box-title">Subjective &amp; Clinical Examination</div>
          <p><strong>Symptoms:</strong> ${parsed.what_patient_said || "—"}</p>
          <p><strong>Examination:</strong> ${parsed.what_was_observed || "—"}</p>
        </div>
        <div class="box">
          <div class="box-title">Diagnosis &amp; Treatment</div>
          <p><strong>Diagnosis:</strong> ${parsed.likely_diagnosis || "—"}</p>
          <p><strong>Treatment Plan:</strong> ${parsed.treatment_plan || "—"}</p>
          <p><strong>Prescribed Medications:</strong> ${parsed.medications || "—"}</p>
          <p><strong>Follow-up:</strong> ${parsed.follow_up || "—"}</p>
        </div>
        <div class="sign-area" style="margin-top: 50px; display: flex; justify-content: flex-end;">
          <div style="border-top: 1px solid #0f172a; width: 220px; text-align: center; padding-top: 8px;">
            <strong>${docName}</strong><br/>
            <span style="font-size: 11px; color: #64748b;">Attending Doctor Signature</span>
          </div>
        </div>
      `;
    }
  }

  win.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>${title}</title>
        <style>
          @page { margin: 15mm; size: A4; }
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #0f172a; line-height: 1.5; margin: 0; padding: 24px; font-size: 13px; }
          .hdr { padding-bottom: 12px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: flex-end; }
          .box { border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px 14px; margin-bottom: 12px; background: #fafafa; }
          .box-title { font-size: 11px; font-weight: 800; text-transform: uppercase; color: #0284c7; margin-bottom: 4px; }
          .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 700; background: #fef3c7; color: #b45309; }
          table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 12.5px; }
          th, td { border: 1px solid #cbd5e1; padding: 8px 10px; text-align: left; }
          th { background: #f1f5f9; font-weight: 700; }
          .sign-area { margin-top: 50px; display: flex; justify-content: flex-end; }
          .sign-line { border-top: 1px solid #0f172a; width: 220px; text-align: center; padding-top: 8px; font-weight: 700; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        ${bodyHtml}
        <script>
          window.onload = function() {
            setTimeout(function() {
              window.focus();
              window.print();
            }, 250);
          };
        </script>
      </body>
    </html>
  `);
  win.document.close();
}

export default function DoctorPatientHistory() {
  const navigate = useNavigate();
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedNote, setSelectedNote] = useState(null);
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFilter, setDateFilter] = useState("ALL"); // 'ALL' | 'TODAY' | 'WEEK' | 'MONTH' | 'CUSTOM'
  const [customDate, setCustomDate] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [activeTab, setActiveTab] = useState("summary"); // 'summary' | 'soap' | 'transcript'

  const user = JSON.parse(localStorage.getItem("user") || "{}");

  const fetchNotes = async () => {
    setLoading(true);
    try {
      const res = await API.get("/consultation-notes", {
        headers: {
          role: user.role || "doctor",
          userid: user.id,
        },
      });
      setNotes(res.data || []);
    } catch (err) {
      console.error("Failed to load doctor consultation notes", err);
      toast.error("Failed to load consultation notes");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotes();
  }, []);

  // Filtered notes by search, date-wise filter, and status
  const filteredNotes = useMemo(() => {
    return notes.filter((n) => {
      const patName = n.patient?.name || "";
      const patNotes = n.patientNote || "";
      const soapStr = n.soapNote || "";
      const finalStr = n.finalNote || "";
      const docName = n.doctor?.name || "";

      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        patName.toLowerCase().includes(q) ||
        patNotes.toLowerCase().includes(q) ||
        soapStr.toLowerCase().includes(q) ||
        finalStr.toLowerCase().includes(q) ||
        docName.toLowerCase().includes(q);

      const matchesStatus =
        statusFilter === "All" ||
        (n.status || "").toUpperCase() === statusFilter.toUpperCase();

      const matchesDate = (() => {
        if (dateFilter === "ALL") return true;
        const noteDate = new Date(n.createdAt);
        const now = new Date();

        if (dateFilter === "TODAY") {
          return noteDate.toDateString() === now.toDateString();
        }

        if (dateFilter === "WEEK") {
          const oneWeekAgo = new Date();
          oneWeekAgo.setDate(now.getDate() - 7);
          oneWeekAgo.setHours(0, 0, 0, 0);
          return noteDate >= oneWeekAgo && noteDate <= now;
        }

        if (dateFilter === "MONTH") {
          return (
            noteDate.getMonth() === now.getMonth() &&
            noteDate.getFullYear() === now.getFullYear()
          );
        }

        if (dateFilter === "CUSTOM" && customDate) {
          const localYMD = `${noteDate.getFullYear()}-${String(noteDate.getMonth() + 1).padStart(2, "0")}-${String(noteDate.getDate()).padStart(2, "0")}`;
          const isoYMD = noteDate.toISOString().split("T")[0];
          return localYMD === customDate || isoYMD === customDate;
        }

        return true;
      })();

      return matchesSearch && matchesStatus && matchesDate;
    });
  }, [notes, searchQuery, statusFilter, dateFilter, customDate]);

  // Selected note fallback
  const activeNote = useMemo(() => {
    if (filteredNotes.length === 0) return null;
    if (selectedNote && filteredNotes.some((n) => n.id === selectedNote.id)) {
      return selectedNote;
    }
    return filteredNotes[0];
  }, [filteredNotes, selectedNote]);

  // Summary statistics
  const stats = useMemo(() => {
    const total = notes.length;
    const uniquePatients = new Set(notes.map((n) => n.patient?.id || n.patient?.name).filter(Boolean)).size;
    const approvedCount = notes.filter((n) => (n.status || "").toUpperCase() === "APPROVED").length;
    const latestDate =
      notes.length > 0
        ? new Date(notes[0].createdAt).toLocaleDateString("en-IN", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })
        : "—";
    return { total, uniquePatients, approvedCount, latestDate };
  }, [notes]);

  const handleSelectNote = (note) => {
    setSelectedNote(note);
    setMobileDetailOpen(true);
  };

  const handlePrint = (tabToPrint = activeTab) => {
    if (!activeNote) return;
    printDoctorConsultation(activeNote, tabToPrint, parsedSoap);
    // HIPAA Audit Logging
    API.post("/audit/log", {
      action: "PRINT_CONSULTATION_NOTE",
      patientId: activeNote.patientId,
      resourceId: activeNote.id,
      userId: user?.id,
      userRole: user?.role || "doctor",
      userName: user?.name,
      details: { tab: tabToPrint, patientName: activeNote.patient?.name },
    }).catch(() => {});
  };

  const handleCopy = () => {
    if (!activeNote) return;
    let contentToCopy = "";

    if (activeTab === "summary") {
      contentToCopy = activeNote.patientNote || "No summary available.";
    } else if (activeTab === "soap") {
      const s = activeNote.finalNote || activeNote.soapNote;
      try {
        const parsed = typeof s === "string" ? JSON.parse(s) : s;
        contentToCopy = [
          `PATIENT: ${activeNote.patient?.name || "Patient"}`,
          `DATE: ${new Date(activeNote.createdAt).toLocaleDateString()}`,
          `DIAGNOSIS: ${parsed.likely_diagnosis || "—"}`,
          `WHAT PATIENT SAID: ${parsed.what_patient_said || "—"}`,
          `WHAT WAS OBSERVED: ${parsed.what_was_observed || "—"}`,
          `TREATMENT PLAN: ${parsed.treatment_plan || "—"}`,
          `MEDICATIONS: ${parsed.medications || "—"}`,
          `FOLLOW-UP: ${parsed.follow_up || "—"}`,
        ].join("\n\n");
      } catch {
        contentToCopy = String(s);
      }
    } else {
      contentToCopy = activeNote.transcript || "No transcript available.";
    }

    navigator.clipboard.writeText(contentToCopy);
    toast.success("Consultation content copied to clipboard!");

    // HIPAA Audit Logging
    API.post("/audit/log", {
      action: "COPY_CONSULTATION_NOTE",
      patientId: activeNote.patientId,
      resourceId: activeNote.id,
      details: { tab: activeTab, patientName: activeNote.patient?.name },
    }).catch(() => {});
  };

  const handleDelete = async (noteId) => {
    if (!window.confirm("Are you sure you want to delete this consultation record? This cannot be undone.")) {
      return;
    }
    try {
      await API.delete(`/consultation-notes/${noteId}`, {
        headers: {
          role: user.role || "doctor",
          userid: user.id,
        },
      });
      toast.success("Consultation note deleted successfully");
      setNotes((prev) => prev.filter((n) => n.id !== noteId));
      if (selectedNote?.id === noteId) {
        setSelectedNote(null);
      }
    } catch (err) {
      console.error("Delete failed", err);
      toast.error(err.response?.data?.error || "Failed to delete note");
    }
  };

  // ── Draft Edit & Approval State ──
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [approving, setApproving] = useState(false);
  const [editFormData, setEditFormData] = useState({
    likely_diagnosis: "",
    what_patient_said: "",
    what_was_observed: "",
    treatment_plan: "",
    medications: "",
    follow_up: "",
    quick_summary: "",
    patient_status: "ACTIVE",
  });

  const handleOpenEditModal = (note = activeNote) => {
    if (!note) return;
    const raw = note.finalNote || note.soapNote;
    let parsed = {};
    if (raw) {
      try {
        parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
      } catch {
        parsed = { likely_diagnosis: String(raw) };
      }
    }
    setEditFormData({
      likely_diagnosis: parsed.likely_diagnosis || "",
      what_patient_said: parsed.what_patient_said || "",
      what_was_observed: parsed.what_was_observed || "",
      treatment_plan: parsed.treatment_plan || "",
      medications: parsed.medications || "",
      follow_up: parsed.follow_up || "",
      quick_summary: parsed.quick_summary || "",
      patient_status: parsed.patient_status || note.patient?.status || "ACTIVE",
    });
    setEditModalOpen(true);
  };

  const handleSaveDraftChanges = async () => {
    if (!activeNote) return;
    setSavingDraft(true);
    try {
      const res = await API.put(
        `/consultation-notes/${activeNote.id}`,
        {
          soapNote: editFormData,
          finalNote: editFormData,
        },
        {
          headers: { role: user.role || "doctor", userid: user.id },
        }
      );

      toast.success("Draft changes saved successfully!");
      setNotes((prev) =>
        prev.map((n) =>
          n.id === activeNote.id
            ? { ...n, soapNote: JSON.stringify(editFormData), finalNote: JSON.stringify(editFormData) }
            : n
        )
      );
      if (selectedNote?.id === activeNote.id) {
        setSelectedNote((prev) => ({
          ...prev,
          soapNote: JSON.stringify(editFormData),
          finalNote: JSON.stringify(editFormData),
        }));
      }
      setEditModalOpen(false);
    } catch (err) {
      console.error("Save draft failed", err);
      toast.error(err.response?.data?.error || "Failed to save draft changes");
    } finally {
      setSavingDraft(false);
    }
  };

  const handleApproveDraft = async () => {
    if (!activeNote) return;
    setApproving(true);
    try {
      const res = await API.post(
        "/consultation-notes/approve",
        {
          noteId: activeNote.id,
          finalNote: JSON.stringify(editFormData),
        },
        {
          headers: { role: user.role || "doctor", userid: user.id },
        }
      );

      toast.success("Consultation note approved and signed! Synced to EHR and Patient Portal.");

      const newPatientStatus = res.data?.patientStatus;
      const updatedNote = res.data?.note || {
        ...activeNote,
        status: "APPROVED",
        finalNote: JSON.stringify(editFormData),
      };

      if (newPatientStatus && updatedNote.patient) {
        updatedNote.patient = { ...updatedNote.patient, status: newPatientStatus };
      }

      setNotes((prev) =>
        prev.map((n) => (n.id === activeNote.id ? { ...n, ...updatedNote, status: "APPROVED" } : n))
      );
      if (selectedNote?.id === activeNote.id) {
        setSelectedNote((prev) => ({ ...prev, ...updatedNote, status: "APPROVED" }));
      }

      setEditModalOpen(false);
      setActiveTab("summary");
    } catch (err) {
      console.error("Approve failed", err);
      toast.error(err.response?.data?.error || "Failed to approve consultation note");
    } finally {
      setApproving(false);
    }
  };

  // Parse SOAP structure for the active note
  const parsedSoap = useMemo(() => {
    if (!activeNote) return null;
    const raw = activeNote.finalNote || activeNote.soapNote;
    if (!raw) return null;
    try {
      return typeof raw === "string" ? JSON.parse(raw) : raw;
    } catch {
      return null;
    }
  }, [activeNote]);

  const activeColor = activeNote
    ? getPatientAvatarColor(activeNote.patient?.name)
    : PATIENT_PALETTES[0];

  return (
    <div className="pnw-shell" style={{ padding: "32px 24px 60px 24px" }}>
      {/* ── Top Header & Stats ── */}
      <div className="pnw-header">
        <div className="pnw-title-group">
          <span className="pnw-eyebrow">
            <BsClockHistory />
            Doctor Clinical Archive
          </span>
          <h1 className="pnw-title">Patients Consultation History</h1>
          <p className="pnw-subtitle">
            Review past patient consultation notes, AI SOAP assessments, prescriptions, and visit summaries in one place.
          </p>
        </div>

        <div className="pnw-stats-row">
          <div className="pnw-stat-pill">
            <span>Total Consultations</span>
            <strong>{stats.total}</strong>
          </div>
          <div className="pnw-stat-pill">
            <span>Patients Seen</span>
            <strong>{stats.uniquePatients}</strong>
          </div>
          <div className="pnw-stat-pill">
            <span>Approved Records</span>
            <strong>{stats.approvedCount}</strong>
          </div>
          <div className="pnw-stat-pill">
            <span>Latest Visit</span>
            <strong>{stats.latestDate}</strong>
          </div>
        </div>
      </div>

      {/* ── Search Bar & Filter Chips ── */}
      <div className="pnw-toolbar">
        <div className="pnw-search-box">
          <FiSearch className="pnw-search-icon" />
          <input
            type="text"
            className="pnw-search-input"
            placeholder="Search by patient name, diagnosis, medication, or notes..."
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

        {/* Date-wise Filter & Status Filter (Scalable for any number of patients) */}
        <div className="pnw-filter-chips" style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          {/* Date Presets */}
          <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
            <span style={{ fontSize: "12px", fontWeight: "700", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.4px", display: "inline-flex", alignItems: "center", gap: "4px" }}>
              <FiCalendar /> Date:
            </span>
            <button
              type="button"
              className={`pnw-chip ${dateFilter === "ALL" && !customDate ? "active" : ""}`}
              onClick={() => { setDateFilter("ALL"); setCustomDate(""); }}
            >
              All Time
            </button>
            <button
              type="button"
              className={`pnw-chip ${dateFilter === "TODAY" ? "active" : ""}`}
              onClick={() => { setDateFilter("TODAY"); setCustomDate(""); }}
            >
              Today
            </button>
            <button
              type="button"
              className={`pnw-chip ${dateFilter === "WEEK" ? "active" : ""}`}
              onClick={() => { setDateFilter("WEEK"); setCustomDate(""); }}
            >
              This Week
            </button>
            <button
              type="button"
              className={`pnw-chip ${dateFilter === "MONTH" ? "active" : ""}`}
              onClick={() => { setDateFilter("MONTH"); setCustomDate(""); }}
            >
              This Month
            </button>

            {/* Specific Date Picker */}
            <div style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
              <input
                type="date"
                value={customDate}
                onChange={(e) => {
                  setCustomDate(e.target.value);
                  if (e.target.value) setDateFilter("CUSTOM");
                  else setDateFilter("ALL");
                }}
                title="Filter by specific consultation date"
                style={{
                  padding: "6px 12px",
                  borderRadius: "999px",
                  border: dateFilter === "CUSTOM" && customDate ? "1px solid #0284c7" : "1px solid #cbd5e1",
                  background: dateFilter === "CUSTOM" && customDate ? "#eff6ff" : "#ffffff",
                  color: dateFilter === "CUSTOM" && customDate ? "#0284c7" : "#334155",
                  fontSize: "12.5px",
                  fontWeight: "650",
                  cursor: "pointer",
                  outline: "none",
                }}
              />
              {customDate && (
                <button
                  type="button"
                  onClick={() => { setCustomDate(""); setDateFilter("ALL"); }}
                  title="Clear date filter"
                  style={{
                    background: "#e2e8f0",
                    border: "none",
                    borderRadius: "50%",
                    width: "20px",
                    height: "20px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    color: "#475569",
                    fontSize: "11px",
                  }}
                >
                  <FiX />
                </button>
              )}
            </div>
          </div>

          {/* Status Filter Toggle */}
          <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", marginLeft: "8px", borderLeft: "1px solid #e2e8f0", paddingLeft: "12px" }}>
            <span style={{ fontSize: "12px", fontWeight: "700", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.4px" }}>
              Status:
            </span>
            {["All", "APPROVED", "DRAFT"].map((st) => (
              <button
                key={st}
                type="button"
                className={`pnw-chip ${statusFilter === st ? "active" : ""}`}
                onClick={() => setStatusFilter(st)}
                style={{ fontSize: "12px", padding: "6px 12px" }}
              >
                {st === "All" ? "All Status" : st === "APPROVED" ? "Approved" : "Draft"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Loading State ── */}
      {loading ? (
        <div className="pnw-state-card">
          <div className="pnw-spinner" />
          <h3 className="pnw-state-title">Loading patient consultation history</h3>
          <p className="pnw-state-desc">Retrieving archived SOAP notes, prescriptions, and clinical dialogue...</p>
        </div>
      ) : notes.length === 0 ? (
        <div className="pnw-state-card">
          <div className="pnw-state-icon">
            <BsFileEarmarkMedical />
          </div>
          <h3 className="pnw-state-title">No consultation records found</h3>
          <p className="pnw-state-desc">
            Consultations recorded via the AI Note Writer in <strong>Patient EHR &amp; Analysis</strong> will automatically be archived here.
          </p>
          <button
            type="button"
            className="pnw-chip active"
            style={{ marginTop: "18px", padding: "10px 22px", fontSize: "14px" }}
            onClick={() => navigate("/patients-details")}
          >
            Go to Patient EHR &amp; Analysis
          </button>
        </div>
      ) : filteredNotes.length === 0 ? (
        <div className="pnw-state-card">
          <div className="pnw-state-icon">
            <FiSearch />
          </div>
          <h3 className="pnw-state-title">No matching consultations found</h3>
          <p className="pnw-state-desc">Try clearing your search query or switching patient filter chips to view all records.</p>
        </div>
      ) : (
        /* ── Split Master-Detail Workspace ── */
        <div className={`pnw-workspace ${mobileDetailOpen ? "has-selection" : ""}`}>
          {/* Left Sidebar: Notes List */}
          <aside className="pnw-sidebar" aria-label="Consultation notes list">
            <div className="pnw-sidebar-header">
              <span>Consultations</span>
              <span className="pnw-count-badge">{filteredNotes.length}</span>
            </div>

            <div className="pnw-list">
              {filteredNotes.map((note) => {
                const pat = note.patient || {};
                const palette = getPatientAvatarColor(pat.name);
                const { snippet, hasMeds } = parseNotePreview(note.patientNote, note.soapNote);
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
                        style={{ backgroundColor: palette.avatar }}
                      >
                        {getPatientInitials(pat.name)}
                      </div>
                      <div className="pnw-item-meta">
                        <div className="pnw-item-doc">
                          {pat.name || "Patient"}
                        </div>
                        <div className="pnw-item-sub">
                          <FiCalendar />
                          <span>{formattedDate}</span>
                          {pat.age && <span>• {pat.age}y</span>}
                          {pat.gender && <span>• {pat.gender}</span>}
                        </div>
                      </div>
                    </div>

                    <p className="pnw-item-snippet">{snippet}</p>

                    <div className="pnw-item-tags">
                      {(() => {
                        const st = getPatientStatusBadgeMeta(pat.status);
                        return (
                          <span
                            className="pnw-spec-tag"
                            style={{
                              backgroundColor: st.bg,
                              color: st.text,
                              border: `1px solid ${st.border}`,
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "5px",
                              fontWeight: "800",
                              letterSpacing: "0.02em",
                            }}
                          >
                            <span
                              style={{
                                width: "6px",
                                height: "6px",
                                borderRadius: "50%",
                                backgroundColor: st.dot,
                                display: "inline-block",
                                boxShadow: st.isPulse ? `0 0 0 2px ${st.border}` : "none",
                              }}
                            />
                            {st.label}
                          </span>
                        );
                      })()}

                      <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                        {(() => {
                          const tmpl = getNoteTemplateMeta(note);
                          return tmpl ? (
                            <span
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px",
                                fontSize: "11px",
                                fontWeight: "700",
                                padding: "2px 7px",
                                borderRadius: "5px",
                                background: tmpl.bg,
                                color: tmpl.text,
                              }}
                            >
                              <tmpl.Icon style={{ fontSize: "10px" }} />
                              {tmpl.label}
                            </span>
                          ) : null;
                        })()}
                        {hasMeds && (
                          <span className="pnw-rx-tag">
                            <FaPills />
                            Rx Included
                          </span>
                        )}
                        <span
                          style={{
                            fontSize: "11px",
                            fontWeight: "700",
                            padding: "2px 7px",
                            borderRadius: "5px",
                            background: note.status === "APPROVED" ? "#dcfce7" : "#fef3c7",
                            color: note.status === "APPROVED" ? "#15803d" : "#b45309",
                          }}
                        >
                          {note.status === "APPROVED" ? "Approved" : "Draft"}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </aside>

          {/* Right Pane: Full Detail Note Reader */}
          {activeNote && (
            <section className="pnw-reader" aria-label="Selected patient consultation detail">
              {/* Mobile Back Button */}
              <button
                type="button"
                className="pnw-mobile-back"
                onClick={() => setMobileDetailOpen(false)}
              >
                <FiChevronLeft />
                Back to consultations list
              </button>

              {/* Reader Header */}
              <div className="pnw-reader-header">
                <div className="pnw-reader-doc-wrap">
                  <div
                    className="pnw-avatar-lg"
                    style={{ backgroundColor: activeColor.avatar }}
                  >
                    {getPatientInitials(activeNote.patient?.name)}
                  </div>
                  <div>
                    <h2 className="pnw-reader-doc">
                      {activeNote.patient?.name || "Patient Record"}
                    </h2>
                    <div className="pnw-reader-sub" style={{ gap: "10px", marginTop: "4px" }}>
                      <span
                        className="pnw-spec-tag"
                        style={{
                          backgroundColor: activeColor.bg,
                          color: activeColor.text,
                          border: `1px solid ${activeColor.border}`,
                        }}
                      >
                        {activeNote.patient?.age ? `${activeNote.patient.age} yrs` : "Age N/A"} • {activeNote.patient?.gender || "Gender N/A"}
                      </span>
                      {activeNote.patient?.bloodGroup && (
                        <span
                          style={{
                            fontSize: "11px",
                            fontWeight: "700",
                            color: "#dc2626",
                            background: "#fef2f2",
                            border: "1px solid #fee2e2",
                            padding: "2px 7px",
                            borderRadius: "5px",
                          }}
                        >
                          Blood: {activeNote.patient.bloodGroup}
                        </span>
                      )}
                      <span>
                        <FiCalendar style={{ verticalAlign: "-2px", marginRight: 4 }} />
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

                {/* Right Top Actions */}
                <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                  <span className="pnw-signed-pill">
                    <FiCheckCircle />
                    {activeNote.status === "APPROVED" ? "Signed by Doctor" : "Draft Record"}
                  </span>

                  {activeNote.status === "DRAFT" ? (
                    <button
                      type="button"
                      onClick={() => handleOpenEditModal(activeNote)}
                      title="Review, edit, and approve draft note"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        padding: "6px 14px",
                        background: "#0284c7",
                        border: "none",
                        borderRadius: "8px",
                        fontSize: "12px",
                        fontWeight: "700",
                        color: "#ffffff",
                        cursor: "pointer",
                        boxShadow: "0 2px 6px rgba(2, 132, 199, 0.25)",
                      }}
                    >
                      <FiCheckCircle /> Approve Draft
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleOpenEditModal(activeNote)}
                      title="Edit consultation details"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "5px",
                        padding: "6px 12px",
                        background: "#ffffff",
                        border: "1px solid #cbd5e1",
                        borderRadius: "8px",
                        fontSize: "12px",
                        fontWeight: "700",
                        color: "#334155",
                        cursor: "pointer",
                      }}
                    >
                      <FiEdit2 /> Edit Note
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handlePrint}
                    title="Print clinical consultation"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "5px",
                      padding: "6px 12px",
                      background: "#ffffff",
                      border: "1px solid #cbd5e1",
                      borderRadius: "8px",
                      fontSize: "12px",
                      fontWeight: "700",
                      color: "#334155",
                      cursor: "pointer",
                    }}
                  >
                    <FiPrinter /> Print
                  </button>
                  <button
                    type="button"
                    onClick={handleCopy}
                    title="Copy note text"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "5px",
                      padding: "6px 12px",
                      background: "#ffffff",
                      border: "1px solid #cbd5e1",
                      borderRadius: "8px",
                      fontSize: "12px",
                      fontWeight: "700",
                      color: "#334155",
                      cursor: "pointer",
                    }}
                  >
                    <FiCopy /> Copy
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate(`/patients-details?patientId=${activeNote.patientId}`)}
                    title="Open Doctor AI Chat & Analysis"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "5px",
                      padding: "6px 12px",
                      background: "#eff6ff",
                      border: "1px solid #bae6fd",
                      borderRadius: "8px",
                      fontSize: "12px",
                      fontWeight: "700",
                      color: "#0284c7",
                      cursor: "pointer",
                    }}
                  >
                    <FiActivity /> AI Chat
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(activeNote.id)}
                    title="Delete consultation"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "5px",
                      padding: "6px 10px",
                      background: "#fef2f2",
                      border: "1px solid #fecaca",
                      borderRadius: "8px",
                      fontSize: "12px",
                      fontWeight: "700",
                      color: "#dc2626",
                      cursor: "pointer",
                    }}
                  >
                    <FiTrash2 />
                  </button>
                </div>
              </div>

              {/* Draft Status Banner */}
              {activeNote.status === "DRAFT" && (
                <div
                  style={{
                    margin: "16px 24px 0 24px",
                    padding: "14px 18px",
                    borderRadius: "12px",
                    background: "#fffbeb",
                    border: "1px solid #fde68a",
                    display: "flex",
                    flexWrap: "wrap",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "12px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "5px",
                        fontSize: "11px",
                        fontWeight: "800",
                        padding: "3px 8px",
                        borderRadius: "6px",
                        background: "#fef3c7",
                        color: "#b45309",
                        textTransform: "uppercase",
                        letterSpacing: "0.5px",
                      }}
                    >
                      <FiAlertCircle /> Draft Consultation
                    </span>
                    <span style={{ fontSize: "13px", color: "#92400e" }}>
                      This consultation note is an unapproved draft. It has <strong>not</strong> been signed or synced to the patient portal.
                    </span>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <button
                      type="button"
                      onClick={() => handleOpenEditModal(activeNote)}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        padding: "7px 14px",
                        borderRadius: "8px",
                        border: "1px solid #d97706",
                        background: "#ffffff",
                        color: "#b45309",
                        fontSize: "12.5px",
                        fontWeight: "700",
                        cursor: "pointer",
                      }}
                    >
                      <FiEdit2 /> Edit Draft
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenEditModal(activeNote)}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        padding: "7px 16px",
                        borderRadius: "8px",
                        border: "none",
                        background: "#0284c7",
                        color: "#ffffff",
                        fontSize: "12.5px",
                        fontWeight: "700",
                        cursor: "pointer",
                        boxShadow: "0 2px 6px rgba(2, 132, 199, 0.25)",
                      }}
                    >
                      <FiCheckCircle /> Review &amp; Approve
                    </button>
                  </div>
                </div>
              )}

              {/* View Format Switcher Tabs */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "12px 24px",
                  background: "#f8fafc",
                  borderBottom: "1px solid #e2e8f0",
                }}
              >
                <button
                  type="button"
                  onClick={() => setActiveTab("summary")}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "7px 16px",
                    borderRadius: "8px",
                    border: "none",
                    fontSize: "12.5px",
                    fontWeight: "700",
                    cursor: "pointer",
                    background: activeTab === "summary" ? "#0284c7" : "#ffffff",
                    color: activeTab === "summary" ? "#ffffff" : "#475569",
                    boxShadow: activeTab === "summary" ? "0 2px 6px rgba(2, 132, 199, 0.25)" : "0 1px 2px rgba(0,0,0,0.03)",
                  }}
                >
                  <FaNotesMedical /> Patient-Friendly Summary
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("soap")}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "7px 16px",
                    borderRadius: "8px",
                    border: "none",
                    fontSize: "12.5px",
                    fontWeight: "700",
                    cursor: "pointer",
                    background: activeTab === "soap" ? "#0284c7" : "#ffffff",
                    color: activeTab === "soap" ? "#ffffff" : "#475569",
                    boxShadow: activeTab === "soap" ? "0 2px 6px rgba(2, 132, 199, 0.25)" : "0 1px 2px rgba(0,0,0,0.03)",
                  }}
                >
                  <FaClipboardList /> Clinical SOAP Note
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("transcript")}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "7px 16px",
                    borderRadius: "8px",
                    border: "none",
                    fontSize: "12.5px",
                    fontWeight: "700",
                    cursor: "pointer",
                    background: activeTab === "transcript" ? "#0284c7" : "#ffffff",
                    color: activeTab === "transcript" ? "#ffffff" : "#475569",
                    boxShadow: activeTab === "transcript" ? "0 2px 6px rgba(2, 132, 199, 0.25)" : "0 1px 2px rgba(0,0,0,0.03)",
                  }}
                >
                  <FiFileText /> Dialogue Transcript
                </button>
              </div>

              {/* Reader Body */}
              <div className="pnw-reader-body">
                {/* 1. PATIENT TAKE-HOME SUMMARY VIEW */}
                {activeTab === "summary" && (
                  <>
                    {/* Prompt to View / Print Official Document */}
                    {parsedSoap?.templateType && parsedSoap.templateType !== "soap" && (
                      <div
                        className="pnw-doc-banner-cta"
                        onClick={() => setActiveTab("soap")}
                        title="Click to view and print official certificate or letter"
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                          <span style={{ fontSize: "22px", display: "inline-flex", alignItems: "center", color: getNoteTemplateMeta(activeNote)?.text || "#0284c7" }}>
                            {(() => {
                              const m = getNoteTemplateMeta(activeNote);
                              return m ? <m.Icon /> : <FaFileAlt />;
                            })()}
                          </span>
                          <div>
                            <div style={{ fontWeight: "800", fontSize: "13px", color: "#0369a1" }}>
                              Official {getNoteTemplateMeta(activeNote)?.label || "Medical Document"} Available
                            </div>
                            <div style={{ fontSize: "12px", color: "#475569" }}>
                              Click to view or print the official signed certificate, letter, or prescription.
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePrint("soap");
                          }}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "5px",
                            padding: "6px 12px",
                            background: "#ffffff",
                            border: "1px solid #cbd5e1",
                            borderRadius: "6px",
                            fontSize: "12px",
                            fontWeight: "700",
                            color: "#0369a1",
                            cursor: "pointer",
                          }}
                        >
                          <FiPrinter /> Print Official Copy
                        </button>
                      </div>
                    )}

                    {activeNote.patientNote ? (
                      <div className="pnw-note-content">
                        {activeNote.patientNote
                          .split("\n")
                          .map((line, idx) => renderFormattedLine(line, idx))}
                      </div>
                    ) : (
                      <div style={{ padding: "36px 16px", textAlign: "center", color: "#64748b" }}>
                        <p>No patient-friendly summary has been generated for this consultation.</p>
                      </div>
                    )}
                  </>
                )}

                {/* 2. CLINICAL SOAP NOTE VIEW */}
                {activeTab === "soap" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                    {parsedSoap ? (
                      <>
                        {/* Template Type & Format Banner */}
                        {parsedSoap.templateType && parsedSoap.templateType !== "soap" ? (
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "10px", padding: "10px 16px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                              <span style={{ fontSize: "12px", fontWeight: "800", color: "#64748b", textTransform: "uppercase" }}>Clinical Format:</span>
                              {(() => {
                                const m = getNoteTemplateMeta(activeNote);
                                if (!m) return null;
                                return (
                                  <span style={{ display: "inline-flex", alignItems: "center", gap: "5px", fontSize: "12px", fontWeight: "700", padding: "3px 10px", borderRadius: "20px", background: m.bg, color: m.text }}>
                                    <m.Icon /> {m.label}
                                  </span>
                                );
                              })()}
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                              {parsedSoap.recipient_specialty && (
                                <span style={{ fontSize: "12px", color: "#6d28d9", fontWeight: "600" }}>
                                  To: {parsedSoap.recipient_specialty}
                                </span>
                              )}
                              {parsedSoap.rest_days_recommended && (
                                <span style={{ fontSize: "12px", color: "#065f46", fontWeight: "700" }}>
                                  Rest Advised: {parsedSoap.rest_days_recommended}
                                </span>
                              )}
                              <button
                                type="button"
                                onClick={() => handlePrint("soap")}
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "5px",
                                  padding: "4px 10px",
                                  background: "#ffffff",
                                  border: "1px solid #cbd5e1",
                                  borderRadius: "6px",
                                  fontSize: "11.5px",
                                  fontWeight: "700",
                                  color: "#0369a1",
                                  cursor: "pointer",
                                }}
                              >
                                <FiPrinter /> Print Document
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div style={{ display: "flex", justifyContent: "flex-end" }}>
                            <button
                              type="button"
                              onClick={() => handlePrint("soap")}
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "5px",
                                padding: "4px 12px",
                                background: "#ffffff",
                                border: "1px solid #cbd5e1",
                                borderRadius: "6px",
                                fontSize: "12px",
                                fontWeight: "700",
                                color: "#0369a1",
                                cursor: "pointer",
                              }}
                            >
                              <FiPrinter /> Print Official SOAP Record
                            </button>
                          </div>
                        )}

                        {parsedSoap.quick_summary && (
                          <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "10px", padding: "14px 16px" }}>
                            <h4 style={{ margin: "0 0 6px 0", fontSize: "13px", fontWeight: "800", color: "#0284c7", textTransform: "uppercase" }}>
                              Executive Clinical Summary
                            </h4>
                            <p style={{ margin: 0, fontSize: "13.5px", lineHeight: "1.6", color: "#1e293b" }}>
                              {parsedSoap.quick_summary}
                            </p>
                          </div>
                        )}

                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
                          {/* Subjective */}
                          <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "10px", padding: "14px 16px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "#0284c7", fontWeight: "700", fontSize: "12px", textTransform: "uppercase", marginBottom: "8px" }}>
                              <FaCommentMedical /> What the Patient Said (Subjective)
                            </div>
                            <p style={{ margin: 0, fontSize: "13px", lineHeight: "1.5", color: "#334155" }}>
                              {parsedSoap.what_patient_said || "—"}
                            </p>
                          </div>

                          {/* Objective */}
                          <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "10px", padding: "14px 16px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "#7c3aed", fontWeight: "700", fontSize: "12px", textTransform: "uppercase", marginBottom: "8px" }}>
                              <FaEye /> Clinical Findings &amp; Vitals (Objective)
                            </div>
                            <p style={{ margin: 0, fontSize: "13px", lineHeight: "1.5", color: "#334155" }}>
                              {parsedSoap.what_was_observed || "—"}
                            </p>
                          </div>
                        </div>

                        {/* Assessment / Diagnosis */}
                        <div style={{ background: "#eff6ff", border: "1px solid #bae6fd", borderRadius: "10px", padding: "14px 16px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "#0284c7", fontWeight: "800", fontSize: "12px", textTransform: "uppercase", marginBottom: "6px" }}>
                            <FaStethoscope /> Likely Clinical Diagnosis (Assessment)
                          </div>
                          <p style={{ margin: 0, fontSize: "14px", fontWeight: "600", lineHeight: "1.5", color: "#0f172a" }}>
                            {parsedSoap.likely_diagnosis || "—"}
                          </p>
                        </div>

                        {/* Treatment & Medications */}
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
                          <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "10px", padding: "14px 16px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "#10b981", fontWeight: "700", fontSize: "12px", textTransform: "uppercase", marginBottom: "8px" }}>
                              <FaClipboardList /> Treatment &amp; Management Plan
                            </div>
                            <p style={{ margin: 0, fontSize: "13px", lineHeight: "1.5", color: "#334155", whiteSpace: "pre-line" }}>
                              {parsedSoap.treatment_plan || "—"}
                            </p>
                          </div>

                          <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "10px", padding: "14px 16px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "#8b5cf6", fontWeight: "700", fontSize: "12px", textTransform: "uppercase", marginBottom: "8px" }}>
                              <FaPills /> Prescribed Medications (Rx)
                            </div>
                            {Array.isArray(parsedSoap.medications_table) && parsedSoap.medications_table.length > 0 ? (
                              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                                <thead>
                                  <tr style={{ background: "#f8fafc", color: "#64748b", textAlign: "left" }}>
                                    <th style={{ padding: "4px 6px" }}>Drug</th>
                                    <th style={{ padding: "4px 6px" }}>Timing</th>
                                    <th style={{ padding: "4px 6px" }}>Food</th>
                                    <th style={{ padding: "4px 6px" }}>Days</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {parsedSoap.medications_table.map((m, i) => (
                                    <tr key={i} style={{ borderBottom: "1px solid #f1f5f9" }}>
                                      <td style={{ padding: "6px", fontWeight: "700", color: "#0f172a" }}>{m.name}</td>
                                      <td style={{ padding: "6px", color: "#b45309", fontWeight: "700" }}>{m.timing}</td>
                                      <td style={{ padding: "6px", color: "#0284c7" }}>{m.food}</td>
                                      <td style={{ padding: "6px", color: "#475569" }}>{m.duration}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            ) : (
                              <p style={{ margin: 0, fontSize: "13px", lineHeight: "1.5", color: "#334155", whiteSpace: "pre-line" }}>
                                {parsedSoap.medications || "No medications noted."}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Follow-up & Red Flags */}
                        <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: "10px", padding: "14px 16px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "#b45309", fontWeight: "800", fontSize: "12px", textTransform: "uppercase", marginBottom: "6px" }}>
                            <FiAlertCircle /> Follow-up &amp; Warning Signs
                          </div>
                          <p style={{ margin: 0, fontSize: "13px", lineHeight: "1.5", color: "#78350f" }}>
                            {parsedSoap.follow_up || "Follow up as clinically indicated."}
                          </p>
                          {parsedSoap.warning_signs && Array.isArray(parsedSoap.warning_signs) && (
                            <ul style={{ margin: "8px 0 0 18px", padding: 0, fontSize: "12.5px", color: "#92400e" }}>
                              {parsedSoap.warning_signs.map((ws, i) => (
                                <li key={i}>{ws}</li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </>
                    ) : (
                      <pre style={{ background: "#f8fafc", padding: "14px", borderRadius: "8px", overflowX: "auto", fontSize: "12px" }}>
                        {activeNote.soapNote || "No SOAP data available"}
                      </pre>
                    )}
                  </div>
                )}

                {/* 3. DIALOGUE TRANSCRIPT VIEW */}
                {activeTab === "transcript" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    {activeNote.transcript ? (
                      <div
                        style={{
                          background: "#f8fafc",
                          border: "1px solid #e2e8f0",
                          borderRadius: "12px",
                          padding: "18px 20px",
                          fontSize: "13px",
                          lineHeight: "1.7",
                          color: "#1e293b",
                          whiteSpace: "pre-wrap",
                          fontFamily: "inherit",
                        }}
                      >
                        {activeNote.transcript}
                      </div>
                    ) : (
                      <div style={{ padding: "36px 16px", textAlign: "center", color: "#64748b" }}>
                        <p>No audio transcript recorded for this consultation.</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Doctor Clinical Safety Banner */}
                <div className="pnw-safety-box" style={{ marginTop: "24px" }}>
                  <FiAlertCircle className="pnw-safety-icon" />
                  <div>
                    <p className="pnw-safety-title">Attending Doctor Clinical Record</p>
                    <p className="pnw-safety-text">
                      Archived electronic health record signed by Dr. {activeNote.doctor?.name || user.name || "Attending Physician"}.
                      {activeNote.patient?.contact && ` Emergency contact: ${activeNote.patient.contact}.`}
                    </p>
                  </div>
                </div>
              </div>
            </section>
          )}
        </div>
      )}

      {/* ── Edit & Approve Draft Modal ── */}
      {editModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.65)",
            backdropFilter: "blur(4px)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px",
          }}
          onClick={() => !approving && !savingDraft && setEditModalOpen(false)}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: "16px",
              maxWidth: "760px",
              width: "100%",
              maxHeight: "92vh",
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
              border: "1px solid #e2e8f0",
              overflow: "hidden",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "18px 24px",
                borderBottom: "1px solid #e2e8f0",
                background: "#f8fafc",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div
                  style={{
                    width: "42px",
                    height: "42px",
                    borderRadius: "10px",
                    background: activeNote?.status === "DRAFT" ? "#fef3c7" : "#e0f2fe",
                    color: activeNote?.status === "DRAFT" ? "#b45309" : "#0284c7",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "20px",
                  }}
                >
                  <FaNotesMedical />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: "17px", fontWeight: "800", color: "#0f172a" }}>
                    {activeNote?.status === "DRAFT" ? "Review & Approve Consultation Draft" : "Edit Clinical Consultation"}
                  </h3>
                  <p style={{ margin: "3px 0 0 0", fontSize: "12.5px", color: "#64748b" }}>
                    Patient: <strong>{activeNote?.patient?.name}</strong> • Record #{activeNote?.id} •{" "}
                    {activeNote?.status === "DRAFT" ? "Currently Unapproved Draft" : "Approved Record"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditModalOpen(false)}
                disabled={approving || savingDraft}
                style={{
                  background: "transparent",
                  border: "none",
                  fontSize: "18px",
                  color: "#64748b",
                  cursor: "pointer",
                  padding: "6px",
                  borderRadius: "6px",
                }}
              >
                <FiX />
              </button>
            </div>

            {/* Modal Form Body */}
            <div
              style={{
                padding: "20px 24px",
                overflowY: "auto",
                display: "flex",
                flexDirection: "column",
                gap: "16px",
              }}
            >
              {/* Doctor Manual Patient Status Selection */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: "8px",
                  padding: "10px 14px",
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  borderRadius: "10px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontSize: "12px", fontWeight: "800", color: "#334155", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                    Patient Status:
                  </span>
                  <span style={{ fontSize: "11px", color: "#64748b" }}>
                    (Doctor manual selection)
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  {[
                    { id: "ACTIVE", label: "Active", bg: "#ecfdf5", text: "#059669", border: "#a7f3d0", dot: "#10b981" },
                    { id: "CRITICAL", label: "Critical", bg: "#fef2f2", text: "#b91c1c", border: "#fecaca", dot: "#ef4444" },
                    { id: "DISCHARGED", label: "Discharged", bg: "#f1f5f9", text: "#475569", border: "#cbd5e1", dot: "#94a3b8" },
                  ].map((st) => {
                    const isSelected = (editFormData.patient_status || "ACTIVE").toUpperCase() === st.id;
                    return (
                      <button
                        key={st.id}
                        type="button"
                        onClick={() => setEditFormData((prev) => ({ ...prev, patient_status: st.id }))}
                        style={{
                          padding: "4px 12px",
                          borderRadius: "999px",
                          border: isSelected ? `2px solid ${st.text}` : `1px solid ${st.border}`,
                          background: isSelected ? st.bg : "#ffffff",
                          color: isSelected ? st.text : "#64748b",
                          fontSize: "12px",
                          fontWeight: isSelected ? "800" : "600",
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "5px",
                          boxShadow: isSelected ? "0 1px 4px rgba(0,0,0,0.06)" : "none",
                        }}
                      >
                        <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: st.dot }} />
                        {st.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Likely Diagnosis */}
              <div>
                <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12.5px", fontWeight: "750", color: "#0284c7", textTransform: "uppercase", marginBottom: "6px" }}>
                  <FaStethoscope /> Likely Clinical Diagnosis (Assessment)
                </label>
                <input
                  type="text"
                  value={editFormData.likely_diagnosis}
                  onChange={(e) => setEditFormData({ ...editFormData, likely_diagnosis: e.target.value })}
                  placeholder="e.g. Mild Dyspepsia / Acid Peptic Disease..."
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    borderRadius: "8px",
                    border: "1px solid #cbd5e1",
                    fontSize: "13.5px",
                    color: "#0f172a",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              {/* Subjective & Objective Row */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
                <div>
                  <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", fontWeight: "700", color: "#0284c7", textTransform: "uppercase", marginBottom: "6px" }}>
                    <FaCommentMedical /> Subjective (What Patient Said)
                  </label>
                  <textarea
                    rows={4}
                    value={editFormData.what_patient_said}
                    onChange={(e) => setEditFormData({ ...editFormData, what_patient_said: e.target.value })}
                    placeholder="Patient chief complaints and symptoms..."
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: "8px",
                      border: "1px solid #cbd5e1",
                      fontSize: "12.5px",
                      color: "#0f172a",
                      boxSizing: "border-box",
                      resize: "vertical",
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", fontWeight: "700", color: "#7c3aed", textTransform: "uppercase", marginBottom: "6px" }}>
                    <FaEye /> Objective (Findings &amp; Vitals)
                  </label>
                  <textarea
                    rows={4}
                    value={editFormData.what_was_observed}
                    onChange={(e) => setEditFormData({ ...editFormData, what_was_observed: e.target.value })}
                    placeholder="Clinical observations, vitals, physical exam..."
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: "8px",
                      border: "1px solid #cbd5e1",
                      fontSize: "12.5px",
                      color: "#0f172a",
                      boxSizing: "border-box",
                      resize: "vertical",
                    }}
                  />
                </div>
              </div>

              {/* Treatment Plan & Medications Row */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
                <div>
                  <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", fontWeight: "700", color: "#10b981", textTransform: "uppercase", marginBottom: "6px" }}>
                    <FaClipboardList /> Treatment &amp; Management Plan
                  </label>
                  <textarea
                    rows={4}
                    value={editFormData.treatment_plan}
                    onChange={(e) => setEditFormData({ ...editFormData, treatment_plan: e.target.value })}
                    placeholder="Care instructions, dietary advice, rest..."
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: "8px",
                      border: "1px solid #cbd5e1",
                      fontSize: "12.5px",
                      color: "#0f172a",
                      boxSizing: "border-box",
                      resize: "vertical",
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", fontWeight: "700", color: "#8b5cf6", textTransform: "uppercase", marginBottom: "6px" }}>
                    <FaPills /> Prescribed Medications (Rx)
                  </label>
                  <textarea
                    rows={4}
                    value={editFormData.medications}
                    onChange={(e) => setEditFormData({ ...editFormData, medications: e.target.value })}
                    placeholder="Medicine name, dosage, timing (e.g. Antacid 1-0-1 after food)..."
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: "8px",
                      border: "1px solid #cbd5e1",
                      fontSize: "12.5px",
                      color: "#0f172a",
                      boxSizing: "border-box",
                      resize: "vertical",
                    }}
                  />
                </div>
              </div>

              {/* Follow-Up & Instructions */}
              <div>
                <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", fontWeight: "700", color: "#b45309", textTransform: "uppercase", marginBottom: "6px" }}>
                  <FiAlertCircle /> Follow-Up Advice &amp; Warning Signs
                </label>
                <input
                  type="text"
                  value={editFormData.follow_up}
                  onChange={(e) => setEditFormData({ ...editFormData, follow_up: e.target.value })}
                  placeholder="e.g. Return in 5 days if symptoms persist or if abdominal pain worsens..."
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    borderRadius: "8px",
                    border: "1px solid #cbd5e1",
                    fontSize: "13px",
                    color: "#0f172a",
                    boxSizing: "border-box",
                  }}
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "16px 24px",
                borderTop: "1px solid #e2e8f0",
                background: "#f8fafc",
              }}
            >
              <button
                type="button"
                onClick={() => setEditModalOpen(false)}
                disabled={approving || savingDraft}
                style={{
                  padding: "9px 18px",
                  borderRadius: "8px",
                  border: "1px solid #cbd5e1",
                  background: "#ffffff",
                  fontSize: "13px",
                  fontWeight: "600",
                  color: "#475569",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>

              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                {activeNote?.status === "DRAFT" && (
                  <button
                    type="button"
                    onClick={handleSaveDraftChanges}
                    disabled={approving || savingDraft}
                    style={{
                      padding: "9px 18px",
                      borderRadius: "8px",
                      border: "1px solid #d97706",
                      background: "#fffbeb",
                      fontSize: "13px",
                      fontWeight: "700",
                      color: "#b45309",
                      cursor: "pointer",
                    }}
                  >
                    {savingDraft ? "Saving..." : "Save Draft Changes"}
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleApproveDraft}
                  disabled={approving || savingDraft}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "9px 22px",
                    borderRadius: "8px",
                    border: "none",
                    background: "#0284c7",
                    fontSize: "13px",
                    fontWeight: "700",
                    color: "#ffffff",
                    cursor: "pointer",
                    boxShadow: "0 2px 8px rgba(2, 132, 199, 0.3)",
                  }}
                >
                  <FiCheckCircle />
                  {approving ? "Approving & Syncing with AI..." : "Approve & Sign to EHR"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

