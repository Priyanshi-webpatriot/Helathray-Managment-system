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
  FiPrinter,
} from "react-icons/fi";
import {
  FaUserMd,
  FaPills,
  FaCertificate,
  FaPaperPlane,
  FaHospital,
  FaBolt,
  FaFileAlt,
  FaNotesMedical,
  FaStethoscope,
  FaClipboardList,
  FaCheckCircle,
} from "react-icons/fa";

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

const getNoteTemplateMeta = (note) => {
  if (!note) return null;
  const raw = note.finalNote || note.soapNote;
  if (!raw) return null;
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    const type = parsed?.templateType;
    if (type === "quick_opd") return { label: "Quick OPD (1-0-1)", shortLabel: "Quick OPD", Icon: FaBolt, bg: "#fef3c7", text: "#b45309", border: "#fde68a" };
    if (type === "referral") return { label: "Specialist Referral Letter", shortLabel: "Referral Letter", Icon: FaPaperPlane, bg: "#ede9fe", text: "#6d28d9", border: "#ddd6fe" };
    if (type === "certificate") return { label: "Medical Sickness Certificate", shortLabel: "Sickness Certificate", Icon: FaCertificate, bg: "#d1fae5", text: "#065f46", border: "#a7f3d0" };
    if (type === "discharge") return { label: "Discharge Summary", shortLabel: "Discharge Summary", Icon: FaHospital, bg: "#fce7f3", text: "#be185d", border: "#fbcfe8" };
    return { label: "Clinical Visit Note", shortLabel: "Clinical Record", Icon: FaFileAlt, bg: "#e0f2fe", text: "#0369a1", border: "#bae6fd" };
  } catch {
    return null;
  }
};

function printPatientOfficialDocument(note, parsed) {
  const win = window.open("", "_blank", "width=850,height=900");
  if (!win) {
    window.print();
    return;
  }
  const type = parsed?.templateType || "soap";
  const pat = note.patient || {};
  const doc = note.doctor || {};
  const patName = pat.name || parsed?._patient?.name || parsed?.patient_name || "Patient";
  const docName = doc.name ? (doc.name.startsWith("Dr") ? doc.name : `Dr. ${doc.name}`) : "Attending Physician";
  const clinic = doc.clinicName || "Healthray Multi-Specialty Clinic";
  const dateStr = new Date(note.createdAt).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  let title = "Official Clinical Document";
  let bodyHtml = "";

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

  win.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>${title}</title>
        <style>
          @page { margin: 18mm; size: A4; }
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #0f172a; line-height: 1.5; margin: 0; padding: 24px; font-size: 13px; }
          .hdr { padding-bottom: 12px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: flex-end; }
          .box { border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px 14px; margin-bottom: 12px; background: #fafafa; }
          .box-title { font-size: 11px; font-weight: 800; text-transform: uppercase; color: #0284c7; margin-bottom: 4px; }
          .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 700; background: #fef3c7; color: #b45309; }
          table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 12.5px; }
          th, td { border: 1px solid #cbd5e1; padding: 8px 10px; text-align: left; }
          th { background: #f1f5f9; font-weight: 700; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        ${bodyHtml}
        <script>window.onload = function() { window.print(); };</script>
      </body>
    </html>
  `);
  win.document.close();
}

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

export default function PatientNoteCard({ isDedicatedPage = false }) {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedNote, setSelectedNote] = useState(null);
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSpecialty, setSelectedSpecialty] = useState("All");
  const [activeTab, setActiveTab] = useState("friendly"); // 'friendly' | 'official'

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

  const parsedDoc = useMemo(() => {
    if (!activeNote) return null;
    const raw = activeNote.finalNote || activeNote.soapNote;
    if (!raw) return null;
    try {
      return typeof raw === "string" ? JSON.parse(raw) : raw;
    } catch {
      return null;
    }
  }, [activeNote]);

  const activeTmplMeta = useMemo(() => {
    return getNoteTemplateMeta(activeNote);
  }, [activeNote]);

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
    setActiveTab("friendly");
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

                      <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                        {(() => {
                          const tmpl = getNoteTemplateMeta(note);
                          return tmpl ? (
                            <span
                              style={{
                                fontSize: "11px",
                                fontWeight: "700",
                                padding: "2px 7px",
                                borderRadius: "5px",
                                background: tmpl.bg,
                                color: tmpl.text,
                                border: `1px solid ${tmpl.border || "transparent"}`,
                              }}
                            >
                              <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                                <tmpl.Icon style={{ fontSize: "11px" }} />
                                {tmpl.shortLabel}
                              </span>
                            </span>
                          ) : null;
                        })()}
                        {hasMeds && (
                          <span className="pnw-rx-tag">
                            <FaPills />
                            Rx Included
                          </span>
                        )}
                      </div>
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

                <div className="pnw-reader-actions" style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                  <span className="pnw-signed-pill">
                    <FiCheckCircle />
                    Signed by Doctor
                  </span>
                  <button
                    type="button"
                    className="pnw-print-action-btn"
                    onClick={() => {
                      printPatientOfficialDocument(activeNote, parsedDoc);
                      API.post("/audit/log", {
                        action: "PATIENT_PRINT_DOCUMENT",
                        patientId: activeNote.patientId,
                        resourceId: activeNote.id,
                        userId: user?.id,
                        userRole: user?.role || "patient",
                        userName: user?.name,
                        details: {
                          docType: parsedDoc?.templateType || "soap",
                          doctorName: activeNote.doctor?.name,
                        },
                      }).catch(() => {});
                    }}
                    title="Print or download official document with clinic letterhead"
                  >
                    <FiPrinter /> Print Official Document
                  </button>
                </div>
              </div>

              {/* Tab Navigation: Friendly Summary vs Official Document */}
              <div className="pnw-tab-nav">
                <button
                  type="button"
                  className={`pnw-tab-pill-btn ${activeTab === "friendly" ? "active" : ""}`}
                  onClick={() => setActiveTab("friendly")}
                >
                  <FaNotesMedical /> Patient-Friendly Summary
                </button>
                <button
                  type="button"
                  className={`pnw-tab-pill-btn ${activeTab === "official" ? "active" : ""}`}
                  onClick={() => setActiveTab("official")}
                >
                  {activeTmplMeta ? (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                      <activeTmplMeta.Icon /> {activeTmplMeta.shortLabel} (Official)
                    </span>
                  ) : (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                      <FaFileAlt /> Official Document
                    </span>
                  )}
                </button>
              </div>

              <div className="pnw-reader-body">
                {/* TAB 1: FRIENDLY TAKE-HOME SUMMARY */}
                {activeTab === "friendly" && (
                  <>
                    {/* Prompt to View Official Document */}
                    {parsedDoc?.templateType && parsedDoc.templateType !== "soap" && (
                      <div
                        className="pnw-doc-banner-cta"
                        onClick={() => setActiveTab("official")}
                        title="Click to view and print official certificate or letter"
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                          <span style={{ fontSize: "22px", display: "inline-flex", alignItems: "center", color: activeTmplMeta?.text || "#0284c7" }}>
                            {activeTmplMeta ? <activeTmplMeta.Icon /> : <FaFileAlt />}
                          </span>
                          <div>
                            <div style={{ fontWeight: "800", fontSize: "13px", color: "#0369a1" }}>
                              Official {activeTmplMeta?.label || "Medical Document"} Available
                            </div>
                            <div style={{ fontSize: "12px", color: "#475569" }}>
                              Need to submit this to your employer, school, or pharmacy? Click to view or print the official signed copy.
                            </div>
                          </div>
                        </div>
                        <span
                          style={{
                            padding: "6px 14px",
                            background: "#0284c7",
                            color: "#ffffff",
                            borderRadius: "8px",
                            fontSize: "12px",
                            fontWeight: "700",
                            whiteSpace: "nowrap",
                          }}
                        >
                          View Document →
                        </span>
                      </div>
                    )}

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
                  </>
                )}

                {/* TAB 2: OFFICIAL MEDICAL DOCUMENT VIEW */}
                {activeTab === "official" && parsedDoc && (
                  <div className="pnw-official-view-container">
                    {/* Top Print Banner */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "10px", padding: "12px 18px", flexWrap: "wrap", gap: "10px" }}>
                      <div>
                        <span style={{ fontSize: "11px", fontWeight: "800", color: "#64748b", textTransform: "uppercase" }}>Authorized Document</span>
                        <h4 style={{ margin: "2px 0 0", fontSize: "15px", fontWeight: "800", color: "#0f172a" }}>
                          {activeTmplMeta?.label || "Official Clinical Document"}
                        </h4>
                      </div>
                      <button
                        type="button"
                        className="pnw-print-action-btn"
                        onClick={() => printPatientOfficialDocument(activeNote, parsedDoc)}
                      >
                        <FiPrinter /> Print / Save as PDF
                      </button>
                    </div>

                    {/* 1. MEDICAL SICKNESS CERTIFICATE */}
                    {parsedDoc.templateType === "certificate" && (
                      <div style={{ border: "2px solid #10b981", borderRadius: "12px", padding: "24px", background: "#fafdfc" }}>
                        <div style={{ textAlign: "center", borderBottom: "1.5px dashed #a7f3d0", paddingBottom: "14px", marginBottom: "18px" }}>
                          <h3 style={{ margin: "0", fontSize: "18px", fontWeight: "900", color: "#065f46", textTransform: "uppercase", letterSpacing: "1px" }}>
                            <FaCertificate style={{ marginRight: 8, color: "#10b981", verticalAlign: "middle" }} />
                            Medical Sickness &amp; Fitness Certificate
                          </h3>
                          <p style={{ margin: "4px 0 0", fontSize: "12px", color: "#047857" }}>
                            Issued by {activeNote.doctor?.clinicName || "Healthray Multi-Specialty Clinic"}
                          </p>
                        </div>

                        <div style={{ fontSize: "14px", lineHeight: "1.8", color: "#1e293b" }}>
                          <p>This is to certify that <strong>{parsedDoc.patient_name || activeNote.patient?.name || "the patient"}</strong> has been under clinical care and is diagnosed with: <strong style={{ color: "#065f46" }}>{parsedDoc.illness_diagnosis || parsedDoc.likely_diagnosis || "Acute medical illness"}</strong>.</p>
                          
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "12px", background: "#ecfdf5", border: "1px solid #a7f3d0", borderRadius: "10px", padding: "12px 16px", margin: "16px 0" }}>
                            <div>
                              <span style={{ fontSize: "11px", fontWeight: 700, color: "#047857", textTransform: "uppercase" }}>Recommended Rest</span>
                              <div style={{ fontSize: "15px", fontWeight: 800, color: "#065f46" }}>{parsedDoc.rest_days_recommended || "3 Days"}</div>
                            </div>
                            <div>
                              <span style={{ fontSize: "11px", fontWeight: 700, color: "#047857", textTransform: "uppercase" }}>Leave From</span>
                              <div style={{ fontSize: "14px", fontWeight: 700, color: "#0f172a" }}>{parsedDoc.rest_from_date || "Today"}</div>
                            </div>
                            <div>
                              <span style={{ fontSize: "11px", fontWeight: 700, color: "#047857", textTransform: "uppercase" }}>Leave To</span>
                              <div style={{ fontSize: "14px", fontWeight: 700, color: "#0f172a" }}>{parsedDoc.rest_to_date || "—"}</div>
                            </div>
                          </div>

                          <p><strong>Fitness Status:</strong> {parsedDoc.fitness_status || "Unfit for occupational / academic duties during the stated rest period."}</p>
                          <p><strong>Clinical Remarks:</strong> {parsedDoc.doctor_remarks || parsedDoc.treatment_plan || "Strict medical rest and prescribed medications advised."}</p>
                        </div>

                        <div style={{ marginTop: "32px", display: "flex", justifyContent: "flex-end", textAlign: "right" }}>
                          <div>
                            <div style={{ borderTop: "1.5px solid #065f46", width: "220px", paddingTop: "8px", fontWeight: 700, fontSize: "13px", color: "#065f46" }}>
                              Dr. {activeNote.doctor?.name || "Medical Officer"}
                            </div>
                            <div style={{ fontSize: "11px", color: "#64748b" }}>Authorized Medical Officer Signature &amp; Seal</div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* 2. SPECIALIST REFERRAL LETTER */}
                    {parsedDoc.templateType === "referral" && (
                      <div style={{ border: "1px solid #cbd5e1", borderRadius: "12px", padding: "24px", background: "#ffffff" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "2px solid #8b5cf6", paddingBottom: "14px", marginBottom: "18px" }}>
                          <div>
                            <h3 style={{ margin: "0", fontSize: "18px", fontWeight: "800", color: "#6d28d9" }}>
                              <FaPaperPlane style={{ marginRight: 8, color: "#8b5cf6" }} />
                              Specialist Referral Letter
                            </h3>
                            <p style={{ margin: "4px 0 0", fontSize: "12px", color: "#64748b" }}>
                              From: Dr. {activeNote.doctor?.name} ({activeNote.doctor?.specialty || "General Medicine"})
                            </p>
                          </div>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: "5px", fontSize: "11px", fontWeight: 700, padding: "3px 10px", borderRadius: "20px", background: "#fef2f2", color: "#b91c1c", border: "1px solid #fecaca" }}>
                            <FaCheckCircle style={{ fontSize: "10px" }} /> {parsedDoc.referral_urgency || "Routine"} Priority
                          </span>
                        </div>

                        <div style={{ display: "flex", flexDirection: "column", gap: "14px", fontSize: "13.5px", color: "#1e293b" }}>
                          <div style={{ background: "#f8fafc", padding: "12px 16px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                            <p style={{ margin: 0 }}><strong>Referred To:</strong> {parsedDoc.recipient_specialty || "Specialist Consultant"}</p>
                            <p style={{ margin: "4px 0 0" }}><strong>Reason for Referral:</strong> {parsedDoc.referral_reason || "Specialist evaluation"}</p>
                          </div>

                          <div>
                            <strong style={{ color: "#0284c7", textTransform: "uppercase", fontSize: "11px" }}>Clinical History &amp; Summary:</strong>
                            <p style={{ margin: "4px 0 0", lineHeight: 1.6 }}>{parsedDoc.clinical_summary || parsedDoc.what_patient_said || "—"}</p>
                          </div>

                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
                            <div style={{ background: "#fafafa", padding: "10px 14px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                              <strong style={{ color: "#7c3aed", textTransform: "uppercase", fontSize: "11px" }}>Investigations Done:</strong>
                              <p style={{ margin: "4px 0 0" }}>{parsedDoc.investigations_done || parsedDoc.what_was_observed || "None reported"}</p>
                            </div>
                            <div style={{ background: "#fafafa", padding: "10px 14px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                              <strong style={{ color: "#0d9488", textTransform: "uppercase", fontSize: "11px" }}>Active Medications:</strong>
                              <p style={{ margin: "4px 0 0" }}>{parsedDoc.current_medications || parsedDoc.medications || "None"}</p>
                            </div>
                          </div>

                          <div>
                            <strong style={{ color: "#16a34a", textTransform: "uppercase", fontSize: "11px" }}>Questions for Consultant:</strong>
                            <p style={{ margin: "4px 0 0", lineHeight: 1.6 }}>{parsedDoc.specific_questions || "Kindly evaluate and manage further."}</p>
                          </div>
                        </div>

                        <div style={{ marginTop: "32px", display: "flex", justifyContent: "flex-end", textAlign: "right" }}>
                          <div>
                            <div style={{ borderTop: "1.5px solid #0f172a", width: "200px", paddingTop: "6px", fontWeight: 700, fontSize: "12.5px" }}>
                              Dr. {activeNote.doctor?.name || "Referring Doctor"}
                            </div>
                            <div style={{ fontSize: "11px", color: "#64748b" }}>Referring Practitioner Signature</div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* 3. QUICK OPD PRESCRIPTION */}
                    {parsedDoc.templateType === "quick_opd" && (
                      <div style={{ border: "1px solid #cbd5e1", borderRadius: "12px", padding: "24px", background: "#ffffff" }}>
                        <div style={{ borderBottom: "2px solid #0284c7", paddingBottom: "14px", marginBottom: "18px" }}>
                          <h3 style={{ margin: "0", fontSize: "18px", fontWeight: "800", color: "#0369a1" }}>
                            <FaBolt style={{ marginRight: 8, color: "#f59e0b" }} />
                            Outpatient Prescription (Rx)
                          </h3>
                          <p style={{ margin: "4px 0 0", fontSize: "12px", color: "#64748b" }}>
                            Issued by Dr. {activeNote.doctor?.name} ({activeNote.doctor?.specialty || "OPD"})
                          </p>
                        </div>

                        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                          <div style={{ background: "#eff6ff", border: "1px solid #bae6fd", padding: "10px 14px", borderRadius: "8px" }}>
                            <strong style={{ color: "#0284c7", fontSize: "11px", textTransform: "uppercase" }}>Clinical Diagnosis:</strong>
                            <div style={{ fontSize: "14.5px", fontWeight: 700, color: "#0f172a", marginTop: "2px" }}>
                              {parsedDoc.diagnosis || parsedDoc.likely_diagnosis || "Evaluation completed"}
                            </div>
                          </div>

                          {/* Medications Table */}
                          <div>
                            <strong style={{ color: "#b45309", fontSize: "11px", textTransform: "uppercase" }}>Prescribed Medications (1-0-1 Timings):</strong>
                            {Array.isArray(parsedDoc.medications_table) && parsedDoc.medications_table.length > 0 ? (
                              <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "6px", fontSize: "13px" }}>
                                <thead>
                                  <tr style={{ background: "#f8fafc", textAlign: "left", color: "#64748b", borderBottom: "1px solid #e2e8f0" }}>
                                    <th style={{ padding: "8px 10px" }}>#</th>
                                    <th style={{ padding: "8px 10px" }}>Medicine</th>
                                    <th style={{ padding: "8px 10px" }}>Timings</th>
                                    <th style={{ padding: "8px 10px" }}>Meal Relation</th>
                                    <th style={{ padding: "8px 10px" }}>Duration</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {parsedDoc.medications_table.map((m, idx) => (
                                    <tr key={idx} style={{ borderBottom: "1px solid #f1f5f9" }}>
                                      <td style={{ padding: "8px 10px", color: "#94a3b8", fontWeight: 700 }}>{idx + 1}</td>
                                      <td style={{ padding: "8px 10px", fontWeight: 700, color: "#0f172a" }}>{m.name}</td>
                                      <td style={{ padding: "8px 10px" }}><span style={{ padding: "2px 7px", borderRadius: "5px", background: "#fef3c7", color: "#b45309", fontWeight: 800 }}>{m.timing || "1-0-1"}</span></td>
                                      <td style={{ padding: "8px 10px" }}><span style={{ padding: "2px 7px", borderRadius: "5px", background: "#e0f2fe", color: "#0369a1", fontWeight: 600 }}>{m.food || "After Food"}</span></td>
                                      <td style={{ padding: "8px 10px", color: "#475569", fontWeight: 600 }}>{m.duration || "—"}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            ) : (
                              <p style={{ margin: "4px 0 0", fontSize: "13px" }}>{parsedDoc.medications || "No medications prescribed."}</p>
                            )}
                          </div>

                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginTop: "6px" }}>
                            <div style={{ background: "#fafafa", padding: "10px 14px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                              <strong style={{ color: "#16a34a", fontSize: "11px", textTransform: "uppercase" }}>Instructions &amp; Advice:</strong>
                              <p style={{ margin: "4px 0 0", fontSize: "13px", lineHeight: 1.5 }}>{parsedDoc.instructions || parsedDoc.treatment_plan || "—"}</p>
                            </div>
                            <div style={{ background: "#fafafa", padding: "10px 14px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                              <strong style={{ color: "#b45309", fontSize: "11px", textTransform: "uppercase" }}>Next Review:</strong>
                              <p style={{ margin: "4px 0 0", fontSize: "13px", lineHeight: 1.5 }}>{parsedDoc.review_after || parsedDoc.follow_up || "—"}</p>
                            </div>
                          </div>
                        </div>

                        <div style={{ marginTop: "32px", display: "flex", justifyContent: "flex-end", textAlign: "right" }}>
                          <div>
                            <div style={{ borderTop: "1.5px solid #0f172a", width: "200px", paddingTop: "6px", fontWeight: 700, fontSize: "12.5px" }}>
                              Dr. {activeNote.doctor?.name}
                            </div>
                            <div style={{ fontSize: "11px", color: "#64748b" }}>Doctor Signature &amp; Reg No.</div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* 4. DISCHARGE SUMMARY */}
                    {parsedDoc.templateType === "discharge" && (
                      <div style={{ border: "1px solid #cbd5e1", borderRadius: "12px", padding: "24px", background: "#ffffff" }}>
                        <div style={{ borderBottom: "2px solid #ec4899", paddingBottom: "14px", marginBottom: "18px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                          <div>
                            <h3 style={{ margin: "0", fontSize: "18px", fontWeight: "800", color: "#be185d" }}>
                              <FaHospital style={{ marginRight: 8, color: "#ec4899" }} />
                              Discharge &amp; Procedural Summary
                            </h3>
                            <p style={{ margin: "4px 0 0", fontSize: "12px", color: "#64748b" }}>
                              {activeNote.doctor?.clinicName || "Healthray Hospital"}
                            </p>
                          </div>
                          <div style={{ textAlign: "right", fontSize: "12px", color: "#475569" }}>
                            <div>Admission: <strong>{parsedDoc.admission_date || "—"}</strong></div>
                            <div>Discharge: <strong>{parsedDoc.discharge_date || "Today"}</strong></div>
                          </div>
                        </div>

                        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                          <div style={{ background: "#fdf2f8", border: "1px solid #fbcfe8", padding: "10px 14px", borderRadius: "8px" }}>
                            <strong style={{ color: "#be185d", fontSize: "11px", textTransform: "uppercase" }}>Final Diagnosis &amp; Procedure:</strong>
                            <div style={{ fontSize: "14px", fontWeight: 700, color: "#0f172a", marginTop: "2px" }}>
                              {parsedDoc.final_diagnosis || parsedDoc.likely_diagnosis || "—"}
                            </div>
                            <div style={{ fontSize: "13px", color: "#475569", marginTop: "2px" }}>
                              Procedure: {parsedDoc.procedure_performed || "Conservative management"}
                            </div>
                          </div>

                          <div>
                            <strong style={{ color: "#475569", fontSize: "11px", textTransform: "uppercase" }}>Hospital Course:</strong>
                            <p style={{ margin: "4px 0 0", fontSize: "13px", lineHeight: 1.6 }}>{parsedDoc.hospital_course || parsedDoc.what_patient_said || "—"}</p>
                          </div>

                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                            <div style={{ background: "#fafafa", padding: "10px 14px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                              <strong style={{ color: "#8b5cf6", fontSize: "11px", textTransform: "uppercase" }}>Discharge Medications:</strong>
                              <p style={{ margin: "4px 0 0", fontSize: "13px" }}>{parsedDoc.discharge_medications || parsedDoc.medications || "—"}</p>
                            </div>
                            <div style={{ background: "#fafafa", padding: "10px 14px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                              <strong style={{ color: "#0284c7", fontSize: "11px", textTransform: "uppercase" }}>Discharge Vitals:</strong>
                              <p style={{ margin: "4px 0 0", fontSize: "13px" }}>{parsedDoc.discharge_vitals || parsedDoc.what_was_observed || "Stable"}</p>
                            </div>
                          </div>

                          <div style={{ background: "#fef2f2", border: "1px solid #fecaca", padding: "10px 14px", borderRadius: "8px" }}>
                            <strong style={{ color: "#b91c1c", fontSize: "11px", textTransform: "uppercase" }}>Return Immediately If (Red Flags):</strong>
                            <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#991b1b", fontWeight: 600 }}>
                              {parsedDoc.emergency_red_flags || "Severe pain, high fever, or shortness of breath."}
                            </p>
                          </div>
                        </div>

                        <div style={{ marginTop: "32px", display: "flex", justifyContent: "flex-end", textAlign: "right" }}>
                          <div>
                            <div style={{ borderTop: "1.5px solid #0f172a", width: "200px", paddingTop: "6px", fontWeight: 700, fontSize: "12.5px" }}>
                              Dr. {activeNote.doctor?.name}
                            </div>
                            <div style={{ fontSize: "11px", color: "#64748b" }}>Consultant In-Charge Signature</div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* 5. DEFAULT SOAP / CLINICAL RECORD */}
                    {(!parsedDoc.templateType || parsedDoc.templateType === "soap") && (
                      <div style={{ border: "1px solid #cbd5e1", borderRadius: "12px", padding: "24px", background: "#ffffff" }}>
                        <div style={{ borderBottom: "2px solid #0284c7", paddingBottom: "14px", marginBottom: "18px" }}>
                          <h3 style={{ margin: "0", fontSize: "18px", fontWeight: "800", color: "#0369a1" }}>
                            <FaFileAlt style={{ marginRight: 8, color: "#0284c7" }} />
                            Clinical Consultation Record
                          </h3>
                          <p style={{ margin: "4px 0 0", fontSize: "12px", color: "#64748b" }}>
                            Dr. {activeNote.doctor?.name} ({activeNote.doctor?.specialty || "Medicine"})
                          </p>
                        </div>

                        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                          <div style={{ background: "#eff6ff", border: "1px solid #bae6fd", padding: "10px 14px", borderRadius: "8px" }}>
                            <strong style={{ color: "#0284c7", fontSize: "11px", textTransform: "uppercase" }}>Assessment / Diagnosis:</strong>
                            <div style={{ fontSize: "14.5px", fontWeight: 700, color: "#0f172a", marginTop: "2px" }}>
                              {parsedDoc.likely_diagnosis || "—"}
                            </div>
                          </div>

                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                            <div style={{ background: "#fafafa", padding: "10px 14px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                              <strong style={{ color: "#0284c7", fontSize: "11px", textTransform: "uppercase" }}>Subjective Symptoms:</strong>
                              <p style={{ margin: "4px 0 0", fontSize: "13px" }}>{parsedDoc.what_patient_said || "—"}</p>
                            </div>
                            <div style={{ background: "#fafafa", padding: "10px 14px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                              <strong style={{ color: "#7c3aed", fontSize: "11px", textTransform: "uppercase" }}>Objective Examination:</strong>
                              <p style={{ margin: "4px 0 0", fontSize: "13px" }}>{parsedDoc.what_was_observed || "—"}</p>
                            </div>
                          </div>

                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                            <div style={{ background: "#fafafa", padding: "10px 14px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                              <strong style={{ color: "#16a34a", fontSize: "11px", textTransform: "uppercase" }}>Treatment Plan:</strong>
                              <p style={{ margin: "4px 0 0", fontSize: "13px" }}>{parsedDoc.treatment_plan || "—"}</p>
                            </div>
                            <div style={{ background: "#fafafa", padding: "10px 14px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                              <strong style={{ color: "#8b5cf6", fontSize: "11px", textTransform: "uppercase" }}>Prescribed Medications:</strong>
                              <p style={{ margin: "4px 0 0", fontSize: "13px" }}>{parsedDoc.medications || "—"}</p>
                            </div>
                          </div>
                        </div>

                        <div style={{ marginTop: "32px", display: "flex", justifyContent: "flex-end", textAlign: "right" }}>
                          <div>
                            <div style={{ borderTop: "1.5px solid #0f172a", width: "200px", paddingTop: "6px", fontWeight: 700, fontSize: "12.5px" }}>
                              Dr. {activeNote.doctor?.name}
                            </div>
                            <div style={{ fontSize: "11px", color: "#64748b" }}>Attending Physician Signature</div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
