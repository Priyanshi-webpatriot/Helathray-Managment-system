import { useState, useEffect, useRef } from "react";
import API from "../api";
import "../styles/consultation.css";
import {
  FaMicrophone, FaStop, FaPause, FaPlay, FaUpload, FaFileAlt, FaStethoscope,
  FaPills, FaCalendarAlt, FaEye, FaLightbulb, FaExclamationTriangle,
  FaCheckCircle, FaTimes, FaRedo, FaClipboardList, FaHistory,
  FaPlus, FaStar, FaCommentMedical, FaUserMd, FaEdit,
  FaUser, FaTrash, FaExchangeAlt, FaComments, FaCopy,
} from "react-icons/fa";
import { BsFileEarmarkTextFill } from "react-icons/bs";
import { MdRecordVoiceOver, MdOutlineSummarize } from "react-icons/md";
import { HiOutlineSparkles } from "react-icons/hi";
import { toast } from "react-toastify";

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
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState("");
  const [savedNoteId, setSavedNoteId] = useState(null);
  const [approved, setApproved] = useState(false);

  // Past Notes
  const [pastNotes, setPastNotes] = useState([]);
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [deletingNoteId, setDeletingNoteId] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

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

  // ── STEP 2 → 3: GENERATE SOAP NOTE ──
  const generateSOAPNote = async () => {
    if (!transcript.trim()) {
      toast.warning("Please enter or transcribe a consultation dialogue before generating the note.");
      return;
    }

    console.log(` [AI Note Writer] Requesting SOAP Note for patient: "${patient?.name}" | Transcript length: ${transcript.length}`);
    setLoading(true);
    setLoadingMsg("Gemini AI is analyzing transcript and generating SOAP note...");

    try {
      const res = await API.post(
        "/consultation-notes/generate-soap",
        { transcript, patient },
        { headers: { role: user.role || "doctor", userid: user.id } }
      );

      console.log(" [AI Note Writer] SOAP Note generated successfully:", res.data);
      setSoapData(res.data.soapData);
      setSoapNote(res.data.soapNote);
      setEditedData(JSON.parse(JSON.stringify(res.data.soapData)));

      // Auto-save draft
      console.log(" [AI Note Writer] Auto-saving note draft to database...");
      const dr = await API.post(
        "/consultation-notes/save-draft",
        { patientId: patient.id, transcript, soapNote: res.data.soapNote },
        { headers: { role: user.role || "doctor", userid: user.id } }
      );

      console.log(" [AI Note Writer] Draft note saved with ID:", dr.data?.note?.id);
      setSavedNoteId(dr.data.note.id);
      toast.success("SOAP Note generated and draft saved!");
      // Move to Step 3 (Review & Edit SOAP Note)
      setCurrentStep(3);
    } catch (err) {
      const serverMsg = err?.response?.data?.detail
        ? `${err?.response?.data?.error || "Error"}: ${err?.response?.data?.detail}`
        : (err?.response?.data?.error || err.message);
      console.error(" [AI Note Writer] SOAP generation failed:", {
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

                <div className="cn-mode-switch">
                  <button
                    type="button"
                    className={`cn-mode-btn ${activeTab === "new" ? "active" : ""}`}
                    onClick={() => setActiveTab("new")}
                  >
                    <span className="cn-mode-left">
                      <HiOutlineSparkles /> New Consultation
                    </span>
                  </button>
                  <button
                    type="button"
                    className={`cn-mode-btn ${activeTab === "history" ? "active" : ""}`}
                    onClick={() => {
                      setActiveTab("history");
                      fetchPastNotes();
                    }}
                  >
                    <span className="cn-mode-left">
                      <FaHistory /> Past Notes
                    </span>
                    <span className="cn-count-pill">{pastNotes.length}</span>
                  </button>
                </div>

                {activeTab === "new" && (
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
                )}
              </div>

              <div className="cn-sidebar-tip">
                {activeTab === "history"
                  ? "Browse previously approved clinical SOAP notes and patient summaries."
                  : currentStep === 1
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
                    {activeTab === "history"
                      ? "Past Consultation Notes"
                      : currentStep === 1
                      ? "Step 1 — Record or Upload Consultation"
                      : currentStep === 2
                      ? "Step 2 — Doctor & Patient Transcript"
                      : currentStep === 3
                      ? "Step 3 — Review & Edit SOAP Note"
                      : "Step 4 — Consultation Saved"}
                  </div>
                  <div className="cn-topbar-sub">
                    {activeTab === "history"
                      ? `Clinical note history for ${patient?.name || "selected patient"}`
                      : currentStep === 1
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

              {/* ── TAB: NEW CONSULTATION ── */}
              {activeTab === "new" && (
                <>
                  <div className="cn-content">
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
                                  if (dialogueTurns.length === 0 && transcript) {
                                    setDialogueTurns(parseTranscriptDialogue(transcript));
                                  }
                                  setCurrentStep(2);
                                }}
                                title="Skip audio and type transcript manually"
                              >
                                <FaEdit style={{ marginRight: 6 }} /> Type Manually Instead
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
                                if (dialogueTurns.length === 0 && transcript) {
                                  setDialogueTurns(parseTranscriptDialogue(transcript));
                                }
                                setCurrentStep(2);
                              }}
                            >
                              <FaEdit style={{ marginRight: 6 }} /> Write / Paste Transcript Manually
                            </button>
                          </div>
                        )}
                      </>
                    )}

                    {/* STEP 2: REVIEW & EDIT TRANSCRIPT */}
                    {currentStep === 2 && (
                      <>
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

                        {transcriptView === "cards" && (
                          <div className="cn-turn-list">
                            {dialogueTurns.length === 0 ? (
                              <div style={{ textAlign: "center", padding: "36px 16px", color: "#94a3b8", border: "1px dashed #cbd5e1", borderRadius: "14px" }}>
                                <p>
                                  No dialogue recorded yet. Click <strong>+ Doctor Says</strong> or{" "}
                                  <strong>+ Patient Says</strong>, or switch to <strong>Raw Text</strong> to paste dialogue.
                                </p>
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
                                        <div>
                                          <span className="cn-turn-label">
                                            {isDoc ? "DOCTOR SAYS:" : isPat ? "PATIENT SAYS:" : "CAREGIVER SAYS:"}
                                          </span>
                                          <span className="cn-turn-sub">
                                            {isDoc ? "(Attending Doctor)" : `(${patient?.name || "Patient"})`}
                                          </span>
                                        </div>
                                      </div>

                                      <div className="dialogue-turn-actions">
                                        <button
                                          type="button"
                                          className="turn-action-btn"
                                          onClick={() => handleToggleSpeaker(idx)}
                                          title="Switch speaker between Doctor and Patient"
                                        >
                                          <FaExchangeAlt size={10} /> Switch to {isDoc ? "Patient" : "Doctor"}
                                        </button>
                                        <button
                                          type="button"
                                          className="turn-action-btn"
                                          onClick={() => handleAddTurn(isDoc ? "Patient" : "Doctor", idx)}
                                          title={`Insert ${isDoc ? "Patient" : "Doctor"} reply directly after this`}
                                        >
                                          <FaPlus size={10} /> {isDoc ? "Patient Reply" : "Doctor Reply"}
                                        </button>
                                        <button
                                          type="button"
                                          className="turn-action-btn delete-btn"
                                          onClick={() => handleDeleteTurn(idx)}
                                          title="Delete this turn"
                                        >
                                          <FaTrash size={10} />
                                        </button>
                                      </div>
                                    </div>

                                    <textarea
                                      className="cn-turn-textarea"
                                      value={turn.text}
                                      onChange={(e) => handleUpdateTurnText(idx, e.target.value)}
                                      placeholder={isDoc ? "Enter what the doctor said..." : "Enter what the patient said..."}
                                      rows={Math.max(2, Math.ceil((turn.text?.length || 0) / 75))}
                                    />
                                  </div>
                                );
                              })
                            )}
                          </div>
                        )}

                        {transcriptView === "raw" && (
                          <textarea
                            className="transcript-box"
                            value={transcript}
                            onChange={(e) => handleRawTextChange(e.target.value)}
                            placeholder={`Paste or type consultation dialogue here, e.g.:\n\nDoctor: "What brings you in today?"\nPatient: "I have had a fever and cough for 3 days."`}
                            rows={10}
                          />
                        )}
                      </>
                    )}

                    {/* STEP 3: REVIEW & EDIT SOAP NOTE */}
                    {currentStep === 3 && editedData && (
                      <>
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

                        <SoapNoteCard
                          data={editedData}
                          editable={true}
                          onChange={handleFieldEdit}
                        />
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
                            The clinical SOAP note has been officially signed and archived in{" "}
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
                              <span className="cn-status-pill-green">● Approved &amp; Signed</span>
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
                              onClick={() => {
                                resetAll();
                                setActiveTab("history");
                                fetchPastNotes();
                              }}
                            >
                              <FaHistory style={{ marginRight: 6 }} /> View Past Notes
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
                          onClick={generateSOAPNote}
                          disabled={loading || (!transcript.trim() && dialogueTurns.length === 0)}
                        >
                          <HiOutlineSparkles style={{ marginRight: 6 }} /> Generate Clinical SOAP Note
                        </button>
                      ) : (
                        <div className="cn-footer-right">
                          <button
                            type="button"
                            className="consult-btn btn-outline"
                            onClick={() => {
                              const formatted = [
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
                              copyToClipboard(formatted || soapNote, "SOAP Note");
                            }}
                            title="Copy SOAP Note summary"
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
                </>
              )}

              {/* ── TAB: PAST NOTES HISTORY ── */}
              {activeTab === "history" && (
                <div className="cn-content">
                {loadingNotes ? (
                  <div className="ai-loading">
                    <div className="loading-dots">
                      <span />
                      <span />
                      <span />
                    </div>
                    Loading past notes...
                  </div>
                ) : pastNotes.length === 0 ? (
                  <div className="empty-notes">
                    <div className="empty-notes-icon">
                      <FaClipboardList size={48} />
                    </div>
                    <div>No consultation notes found for {patient.name}.</div>
                    <div style={{ fontSize: "12px", marginTop: "6px", color: "#64748b" }}>
                      Click "New Consultation" above to create an AI clinical note.
                    </div>
                  </div>
                ) : (
                  <div className="past-notes-list">
                    {pastNotes.map((note) => {
                      const parsed = parseNote(note.finalNote || note.soapNote);
                      const isApproved = note.status === "APPROVED";
                      return (
                        <div key={note.id} className="past-note-card">
                          {confirmDeleteId === note.id ? (
                            <div className="past-note-inline-confirm">
                              <div className="past-note-confirm-content">
                                <FaExclamationTriangle style={{ color: "#dc2626", flexShrink: 0 }} />
                                <span>Are you sure you want to delete this consultation note?</span>
                              </div>
                              <div className="past-note-confirm-btns">
                                <button
                                  type="button"
                                  className="past-note-cancel-btn"
                                  onClick={() => setConfirmDeleteId(null)}
                                  disabled={deletingNoteId === note.id}
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  className="past-note-confirm-btn"
                                  onClick={() => executeDeleteNote(note.id)}
                                  disabled={deletingNoteId === note.id}
                                >
                                  {deletingNoteId === note.id ? "Deleting..." : "Delete"}
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="past-note-meta">
                              <span className="past-note-date">
                                {" "}
                                {new Date(note.createdAt).toLocaleString("en-IN", {
                                  day: "numeric",
                                  month: "short",
                                  year: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                                {note.doctor?.name && ` · Dr. ${note.doctor.name}`}
                              </span>
                              <div className="past-note-actions-wrap">
                                <span className={`note-status-badge ${isApproved ? "approved" : "draft"}`}>
                                  {isApproved ? (
                                    <>
                                      <FaCheckCircle style={{ marginRight: 4 }} /> Approved
                                    </>
                                  ) : (
                                    <>
                                      <FaFileAlt style={{ marginRight: 4 }} /> Draft
                                    </>
                                  )}
                                </span>
                                <button
                                  type="button"
                                  className="past-note-delete-btn"
                                  title="Delete this consultation note"
                                  onClick={() => setConfirmDeleteId(note.id)}
                                >
                                  <FaTrash style={{ marginRight: 5, fontSize: "11px" }} />
                                  Delete
                                </button>
                              </div>
                            </div>
                          )}

                          {parsed ? (
                            <SoapNoteCard data={parsed} editable={false} onChange={() => {}} />
                          ) : (
                            <div className="past-note-preview">
                              {note.finalNote || note.soapNote || "No note content recorded."}
                            </div>
                          )}

                          {note.patientNote && (
                            <div
                              style={{
                                marginTop: "12px",
                                padding: "12px 14px",
                                backgroundColor: "#f0fdf4",
                                border: "1px solid #bbf7d0",
                                borderRadius: "8px",
                                fontSize: "13px",
                                color: "#166534",
                                whiteSpace: "pre-line",
                              }}
                            >
                              <strong>Patient Summary:</strong>
                              <div style={{ marginTop: "4px" }}>{note.patientNote}</div>
                            </div>
                          )}
                        </div>
                      );
                    })}
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
