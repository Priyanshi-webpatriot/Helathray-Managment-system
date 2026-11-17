import prisma from "../prisma/client.js";
import axios from "axios";

// ==========================================
// GEMINI DIRECT CALLERS WITH RESILIENT FALLBACK & RETRY
// (Zero dependency on geminiHelper.js)
// ==========================================

// Filter out deprecated or retired Google AI models
const RETIRED_MODELS = new Set([
  "gemini-2.5-flash-lite",
  "gemini-2.5-flash",
  "gemini-2.5-pro",
  "gemini-1.5-flash",
  "gemini-1.5-pro",
  "gemini-pro",
  "gemini-1.0-pro",
]);

const CANDIDATE_AUDIO_MODELS = [
  process.env.GEMINI_MODEL,
  "gemini-3.5-flash-lite",
  "gemini-3.1-flash-lite",
  "gemini-flash-lite-latest",
  "gemini-3-flash-preview",
  "gemini-3.5-flash",
  "gemini-3.8-flash",
  "gemini-3.7-flash",
  "gemini-3.6-flash",
  "gemini-flash-latest",
].filter((m) => Boolean(m) && !RETIRED_MODELS.has(m));

const CANDIDATE_CHAT_MODELS = [
  process.env.GEMINI_MODEL,
  "gemini-3.5-flash-lite",
  "gemini-3.1-flash-lite",
  "gemini-flash-lite-latest",
  "gemini-3-flash-preview",
  "gemini-3.5-flash",
  "gemini-3.8-flash",
  "gemini-3.7-flash",
  "gemini-3.6-flash",
  "gemini-flash-latest",
].filter((m) => Boolean(m) && !RETIRED_MODELS.has(m));

const UNIQUE_AUDIO_MODELS = [...new Set(CANDIDATE_AUDIO_MODELS)];
const UNIQUE_CHAT_MODELS = [...new Set(CANDIDATE_CHAT_MODELS)];

const GEMINI_NATIVE_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const GEMINI_OPENAI_BASE = "https://generativelanguage.googleapis.com/v1beta/openai";

/**
 * Direct Gemini audio transcriber with model fallback and backoff retry
 */
async function uploadMediaToGeminiFiles(audioBuffer, mimeType, apiKey) {
  const numBytes = audioBuffer.length;
  const startRes = await axios.post(
    `https://generativelanguage.googleapis.com/upload/v1beta/files?key=${apiKey}`,
    { file: { display_name: `consultation-${Date.now()}` } },
    {
      headers: {
        "X-Goog-Upload-Protocol": "resumable",
        "X-Goog-Upload-Command": "start",
        "X-Goog-Upload-Header-Content-Length": numBytes,
        "X-Goog-Upload-Header-Content-Type": mimeType,
        "Content-Type": "application/json",
      },
      timeout: 30000,
    }
  );

  const uploadUrl = startRes.headers["x-goog-upload-url"];
  if (!uploadUrl) {
    throw new Error("Failed to obtain Gemini File API upload URL");
  }

  const uploadRes = await axios.post(uploadUrl, audioBuffer, {
    headers: {
      "Content-Length": numBytes,
      "X-Goog-Upload-Offset": 0,
      "X-Goog-Upload-Command": "upload, finalize",
    },
    maxContentLength: Infinity,
    maxBodyLength: Infinity,
    timeout: 180000,
  });

  const fileObj = uploadRes.data?.file;
  if (!fileObj?.uri) {
    throw new Error("Gemini File API upload did not return a file URI");
  }

  // Wait for file to become ACTIVE if it is still PROCESSING (e.g. long video/audio)
  let fileState = fileObj.state;
  const fileName = fileObj.name;
  let attempts = 0;
  while (fileState === "PROCESSING" && attempts < 20) {
    await new Promise((r) => setTimeout(r, 1500));
    const checkRes = await axios.get(
      `https://generativelanguage.googleapis.com/v1beta/${fileName}?key=${apiKey}`,
      { timeout: 15000 }
    );
    fileState = checkRes.data?.state;
    attempts++;
  }

  if (fileState === "FAILED") {
    throw new Error("Gemini File API processing failed for uploaded media");
  }

  return fileObj.uri;
}

/**
 * Direct Gemini audio/video transcriber with model fallback, large file support, and backoff retry
 */
async function callGeminiAudioTranscription(audioBuffer, mimeType) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not defined in environment variables!");
  }

  const useFilesApi = audioBuffer.length > 15 * 1024 * 1024;
  let mediaPart;
  if (useFilesApi) {
    console.log(`📤 [Gemini Audio Transcribe] File is ${(audioBuffer.length / (1024 * 1024)).toFixed(1)} MB (>15 MB), using Gemini Files API...`);
    const fileUri = await uploadMediaToGeminiFiles(audioBuffer, mimeType, apiKey);
    mediaPart = {
      file_data: {
        mime_type: mimeType,
        file_uri: fileUri,
      },
    };
  } else {
    mediaPart = {
      inline_data: {
        mime_type: mimeType,
        data: audioBuffer.toString("base64"),
      },
    };
  }

  let lastError = null;
  const maxPasses = 2;

  // Pass 1 uses a short probe timeout — fast-fails hanging/unresponsive models
  // Pass 2 uses the full 180s timeout for large audio on a known-working model
  const PROBE_TIMEOUT = 25000;  // 25s — fast fail
  const FULL_TIMEOUT  = 180000; // 180s — full audio processing

  for (let pass = 0; pass < maxPasses; pass++) {
    for (let i = 0; i < UNIQUE_AUDIO_MODELS.length; i++) {
      const model = UNIQUE_AUDIO_MODELS[i];
      const startTime = Date.now();
      const timeoutMs = pass === 0 ? PROBE_TIMEOUT : FULL_TIMEOUT;
      console.log(
        `🎙️ [Gemini Audio Transcribe] (Pass ${pass + 1}/${maxPasses}) Trying model "${model}" [timeout: ${timeoutMs / 1000}s]...`
      );

      try {
        const response = await axios.post(
          `${GEMINI_NATIVE_BASE}/${model}:generateContent?key=${apiKey}`,
          {
            contents: [
              {
                parts: [
                  mediaPart,
                  {
                    text: `Transcribe this doctor-patient medical consultation recording accurately word-for-word from start to finish.
Preserve all spoken words, medical terms, medication names, dosages, and numbers exactly as spoken.
Listen carefully to voice differences, pauses, and clinical context to separate Doctor and Patient turns.
Format each speaker turn on a new line starting with "Doctor:" or "Patient:".
Never merge a question and its answer, or a Doctor statement and Patient response, into the same line.
If the recording is silent or unclear or contains no intelligible words, return EXACTLY: [UNCLEAR_AUDIO]`,
                  },
                ],
              },
            ],
            generationConfig: {
              temperature: 0,
            },
          },
          {
            headers: { "Content-Type": "application/json" },
            maxContentLength: Infinity,
            maxBodyLength: Infinity,
            timeout: timeoutMs,
          }
        );

        const elapsed = Date.now() - startTime;
        const text = (
          response.data?.candidates?.[0]?.content?.parts?.[0]?.text || ""
        ).trim();

        console.log(
          `✅ [Gemini Audio Transcribe] Model "${model}" responded in ${elapsed}ms | Length: ${text.length} chars`
        );

        return { text, model, elapsed };
      } catch (err) {
        const elapsed = Date.now() - startTime;
        lastError = err;
        const status = err.response?.status || "NO_STATUS";
        const apiMsg = err.response?.data?.error?.message || err.message;

        console.warn(
          `⚠️ [Gemini Audio Transcribe] Model "${model}" failed after ${elapsed}ms (Status ${status}): ${apiMsg}`
        );

        if (status === 503 || status === 429) {
          console.log(`⏳ [Gemini Audio Transcribe] Brief pause (1.5s) to recover from server demand spike...`);
          await new Promise((r) => setTimeout(r, 1500));
        }
      }
    }
  }

  console.error("❌ [Gemini Audio Transcribe] All candidate audio models exhausted.");
  throw lastError;
}

/**
 * Direct Gemini Chat / Prompt execution with fallback and backoff retry.
 * Uses OpenAI-compatible endpoint (identical to doctorAIController & reminderCron).
 */
async function callGeminiChat({ messages, timeout = 30000, tag = "Gemini Chat", responseMimeType = null }) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not defined in environment variables!");
  }

  let lastError = null;

  // Method 1: OpenAI-compatible chat completions (working throughout the codebase)
  for (let i = 0; i < UNIQUE_CHAT_MODELS.length; i++) {
    const model = UNIQUE_CHAT_MODELS[i];
    const startTime = Date.now();
    console.log(`🤖 [${tag}] Querying OpenAI-compat model "${model}"...`);

    try {
      const response = await axios.post(
        `${GEMINI_OPENAI_BASE}/chat/completions`,
        {
          model,
          messages,
          temperature: 0.1,
          ...(responseMimeType === "application/json"
            ? { response_format: { type: "json_object" } }
            : {}),
        },
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          timeout,
        }
      );

      const elapsed = Date.now() - startTime;
      const content = (response.data?.choices?.[0]?.message?.content || "").trim();

      if (content) {
        console.log(`✅ [${tag}] Model "${model}" responded in ${elapsed}ms | Length: ${content.length}`);
        return { content, model, elapsed };
      }
    } catch (err) {
      const elapsed = Date.now() - startTime;
      lastError = err;
      const status = err.response?.status || "NO_STATUS";
      const apiMsg = err.response?.data?.error?.message || err.message;
      console.warn(`⚠️ [${tag}] OpenAI-compat "${model}" failed after ${elapsed}ms (${status}): ${apiMsg}`);
    }
  }

  // Method 2: Native Gemini v1beta fallback
  const promptText = messages
    .map((m) => `${m.role.toUpperCase()}:\n${m.content}`)
    .join("\n\n");

  for (let i = 0; i < UNIQUE_CHAT_MODELS.length; i++) {
    const model = UNIQUE_CHAT_MODELS[i];
    const startTime = Date.now();
    console.log(`💬 [${tag}] Fallback: Trying native model "${model}"...`);

    try {
      const response = await axios.post(
        `${GEMINI_NATIVE_BASE}/${model}:generateContent?key=${apiKey}`,
        {
          contents: [{ parts: [{ text: promptText }] }],
          generationConfig: { temperature: 0.2 },
        },
        {
          headers: { "Content-Type": "application/json" },
          timeout,
        }
      );

      const elapsed = Date.now() - startTime;
      const content = (response.data?.candidates?.[0]?.content?.parts?.[0]?.text || "").trim();

      if (content) {
        console.log(`✅ [${tag}] Native model "${model}" succeeded in ${elapsed}ms`);
        return { content, model, elapsed };
      }
    } catch (err) {
      lastError = err;
    }
  }

  console.error(`❌ [${tag}] All candidate chat models exhausted.`);
  throw lastError;
}

/**
 * Safely and dynamically parses AI dialogue turns from JSON array, JSON object,
 * markdown bold lines (**Doctor:**, **Patient:**), or plain lines (Doctor:, Patient:).
 * Absolutely no static keyword heuristics.
 */
function parseDialogueResponse(rawContent) {
  if (!rawContent || typeof rawContent !== "string") return [];

  const clean = rawContent.replace(/```json/gi, "").replace(/```/g, "").trim();

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

  // Speaker line regex matching Doctor / Patient / Caregiver at the beginning of a line
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

  // 4. If line-by-line found at least 2 turns, return them
  if (turns.length > 1) {
    return turns;
  }

  // 5. Segment parser for inline markers (e.g. if the entire conversation was returned on a single paragraph)
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

  return turns;
}

// ==========================================
// STEP 1: TRANSCRIBE AUDIO → TRANSCRIPT
// ==========================================
export const transcribeAudio = async (req, res) => {
  const reqStart = Date.now();
  console.log("\n==================== [AI NOTE WRITER: TRANSCRIBE] ====================");
  console.log(`[Transcribe] Headers -> role: "${req.headers.role}", userid: "${req.headers.userid}"`);

  try {
    if (!req.file) {
      console.warn("⚠️ [Transcribe] No audio file uploaded in multipart form data");
      return res.status(400).json({ error: "No audio file uploaded" });
    }

    const audioBuffer = req.file.buffer;
    console.log(
      `[Transcribe] Received audio file: "${req.file.originalname}" | Mime: "${req.file.mimetype}" | Size: ${(audioBuffer.length / 1024).toFixed(1)} KB`
    );

    // Normalize mimetype (preserve video/* for video uploads, normalize audio/*)
    let mimeType = (req.file.mimetype || "audio/webm").split(";")[0].trim();
    if (mimeType === "video/webm") {
      mimeType = "video/webm";
    } else if (mimeType === "video/mp4") {
      mimeType = "video/mp4";
    } else if (mimeType.includes("quicktime")) {
      mimeType = "video/quicktime";
    } else if (mimeType.includes("webm")) {
      mimeType = "audio/webm";
    } else if (mimeType.includes("ogg")) {
      mimeType = "audio/ogg";
    } else if (mimeType.includes("wav")) {
      mimeType = "audio/wav";
    } else if (mimeType.includes("mp3") || mimeType.includes("mpeg")) {
      mimeType = "audio/mpeg";
    } else if (mimeType.includes("m4a") || mimeType === "audio/mp4") {
      mimeType = "audio/mp4";
    }

    const { text: rawTranscript, model, elapsed } = await callGeminiAudioTranscription(audioBuffer, mimeType);
    const transcript = rawTranscript.trim();

    console.log(`[Transcribe] Raw transcript from model "${model}" (${elapsed}ms): "${transcript}"`);

    // ── Hallucination guard ──
    const HALLUCINATION_PATTERNS = [
      /^\[UNCLEAR_AUDIO\]$/i,
      /^i'?m sorry\.?$/i,
      /^thank you\.?$/i,
      /^\[.*\]$/, // [BLANK_AUDIO], [Music], [silence]
      /^\(.*\)$/, // (inaudible), (silence)
      /^\\.+$/,
      /subtitle|subtitles|captions/i,
    ];

    const isKnownHallucination = HALLUCINATION_PATTERNS.some((p) => p.test(transcript));
    const isEmpty = !transcript || transcript.replace(/[\s.,!?]/g, "").length < 3;

    if (isEmpty || isKnownHallucination) {
      console.warn(`⚠️ [Transcribe] Audio rejected by hallucination guard: "${transcript}"`);
      return res.status(400).json({
        error: "Audio was unclear or contained no recognizable speech. Please speak clearly into the microphone or upload a valid audio file.",
        detail: `Model returned: "${transcript}"`,
      });
    }

    // ── STEP 1.2: DYNAMIC AI SPEAKER IDENTIFICATION (Doctor vs Patient) ──
    let dialogue = parseDialogueResponse(transcript);
    let formattedTranscript = transcript;

    if (dialogue.length >= 2) {
      try {
        console.log(`🔍 [Transcribe] Verifying clinical roles (Doctor vs Patient) for ${dialogue.length} audio-split turns...`);
        const verifyPrompt = [
          {
            role: "system",
            content: `You are an expert clinical medical scribe.
Below is a JSON array of chronological dialogue turns transcribed from a doctor-patient consultation.
The speaker labels ("Doctor" or "Patient") from audio alone may be swapped or wrong.
Assign the TRUE clinical role ("Doctor" or "Patient") to every turn based on clinical meaning:
- DOCTOR: Asks medical/intake questions (e.g. "What problem are you having today?", "How long have you had this?"), examines, diagnoses, gives medical advice, prescribes medicines/dosages, or confirms treatment instructions.
- PATIENT: Describes symptoms/complaints (e.g. "My knees hurt when I walk..."), answers questions about their health/history, asks questions about their own medication/treatment.

CRITICAL RULES:
1. Keep every turn's exact "text" word-for-word in the exact same order (do NOT merge, drop, or rewrite text).
2. Output ONLY a JSON array of objects:
[
  { "speaker": "Doctor", "text": "..." },
  { "speaker": "Patient", "text": "..." }
]`,
          },
          {
            role: "user",
            content: JSON.stringify(dialogue),
          },
        ];

        const { content: verifiedText } = await callGeminiChat({
          messages: verifyPrompt,
          tag: "Clinical Role Verification",
          responseMimeType: "application/json",
        });

        const verifiedDialogue = parseDialogueResponse(verifiedText);
        if (verifiedDialogue.length >= 2) {
          dialogue = verifiedDialogue;
          console.log(`✅ [Transcribe] Clinical roles verified for ${dialogue.length} turns!`);
        }
      } catch (verifyErr) {
        console.warn("⚠️ [Transcribe] Clinical role verification skipped:", verifyErr.message);
      }

      formattedTranscript = dialogue
        .map((d) => `${d.speaker}: "${d.text}"`)
        .join("\n\n");
    } else {
      try {
        console.log(`🤖 [Transcribe] Running fallback Dynamic Gemini AI Speaker Identification (${transcript.length} chars)...`);

        const strippedInput = transcript
          .replace(/(?:^|\n|\r)\s*(?:\*{1,2}|#{1,4}|\[)?\s*(Doctor|Dr\.?|Patient|Pt\.?|Caregiver|Nurse|Speaker\s*\d+)\s*(?:\*{1,2}|\])?\s*[:\-–—]?\s*(?:\*{1,2})?\s*[:\-–—]?\s*/gi, "\n")
          .replace(/\n{2,}/g, "\n")
          .trim();

        const diarizePrompt = [
          {
            role: "system",
            content: `You are an expert AI clinical medical scribe.
Your task is to analyze this raw medical consultation dialogue between a Doctor and a Patient and separate it into chronological alternating speaker dialogue turns.

CLINICAL ROLE IDENTIFICATION PRINCIPLES:
1. DOCTOR:
   - Inquiries & Medical Questions: e.g. "How are you managing your medicines?", "What brings you in today?", "How long have you had this cough?"
   - Clinical Directives, Answers to dosing questions & Prescriptions: e.g. "Take it for seven days continuous.", "Take this tablet twice daily after meals.", "Yeah, sure." (confirming patient statement)

2. PATIENT:
   - Symptoms & Complaints: e.g. "Hello, I have a fever.", "My knees have been painful while walking."
   - Questions to the Doctor: e.g. "Do I need to take paracetamol for how many days?"
   - Answers & Confirmations to Doctor: e.g. "I am taking it for 7 days.", "For sure."

CRITICAL RULES:
1. Split alternating turns cleanly whenever a question is asked and answered, or when the topic shifts between Doctor and Patient.
2. NEVER combine a question and its answer, or Doctor instructions and Patient responses, into a single turn.
3. Preserve 100% of all spoken words, drug names, durations, and instructions.
4. Return a JSON array of objects:
[
  { "speaker": "Patient", "text": "..." },
  { "speaker": "Doctor", "text": "..." }
]`,
          },
          {
            role: "user",
            content: `Consultation dialogue to separate:\n"${strippedInput || transcript}"`,
          },
        ];

        const { content: diarizeText } = await callGeminiChat({
          messages: diarizePrompt,
          tag: "Dynamic Speaker Diarization",
          responseMimeType: "application/json",
        });

        console.log(`📝 [Transcribe Diarization Raw Output]:\n${diarizeText}`);
        const fallbackDialogue = parseDialogueResponse(diarizeText);

        if (fallbackDialogue.length > 0) {
          dialogue = fallbackDialogue;
          formattedTranscript = dialogue
            .map((d) => `${d.speaker}: "${d.text}"`)
            .join("\n\n");
          console.log(`✅ [Transcribe] Fallback AI identified ${dialogue.length} Doctor & Patient turns!`);
        } else {
          formattedTranscript = transcript;
        }
      } catch (diarizeErr) {
        console.warn("⚠️ [Transcribe] AI Diarization error:", diarizeErr.message);
        formattedTranscript = transcript;
      }
    }

    const totalElapsed = Date.now() - reqStart;
    console.log(`🎉 [Transcribe] Completed successfully in ${totalElapsed}ms`);
    return res.json({
      transcript: formattedTranscript,
      dialogue,
      rawTranscript: transcript,
      modelUsed: model,
    });
  } catch (err) {
    const errorMsg = err.response?.data?.error?.message || err.response?.data || err.message;
    console.error("❌ [Transcribe] Transcription failed:", errorMsg);
    return res.status(500).json({
      error: "Audio transcription failed. Please check your network and Gemini API key.",
      detail: errorMsg,
    });
  }
};

// ==========================================
// STEP 1.5: FORMAT / SEPARATE SPEAKERS WITH AI
// (For manually typed or pasted transcripts)
// ==========================================
export const  formatDialogue = async (req, res) => {
  const reqStart = Date.now();
  console.log("\n==================== [AI NOTE WRITER: FORMAT DIALOGUE] ====================");

  try {
    const { transcript, patient } = req.body;

    if (!transcript || !transcript.trim()) {
      return res.status(400).json({ error: "Transcript is required" });
    }

    // Strip any pre-existing speaker labels so Gemini evaluates purely from clinical logic without bias
    const strippedInput = transcript
      .replace(/(?:^|\n|\r)\s*(?:\*{1,2}|#{1,4}|\[)?\s*(Doctor|Dr\.?|Patient|Pt\.?|Caregiver|Nurse|Speaker\s*\d+)\s*(?:\*{1,2}|\])?\s*[:\-–—]?\s*(?:\*{1,2})?\s*[:\-–—]?\s*/gi, "\n")
      .replace(/\n{2,}/g, "\n")
      .trim();

    const messages = [
      {
        role: "system",
        content: `You are an expert AI clinical medical scribe.
Your task is to analyze this medical consultation dialogue between a Doctor and a Patient${patient?.name ? ` (Patient: ${patient.name})` : ""} and separate it into chronological alternating speaker dialogue turns.

CLINICAL ROLE IDENTIFICATION PRINCIPLES:
1. DOCTOR:
   - Inquiries & Medical Questions: e.g. "How are you managing your medicines?", "What brings you in today?", "How long have you had this cough?"
   - Clinical Directives & Examination: e.g. "Let me check your blood pressure", "Breathe in deeply."
   - Treatment Advice & Prescriptions: e.g. "Keep a written medicine schedule and take each prescribed medicine at its instructed time.", "Take this tablet twice daily after meals."

2. PATIENT:
   - Answers to doctor's questions: e.g. "I take several medicines and sometimes forget which one comes first."
   - Symptoms & Complaints: e.g. "My knees have been painful while walking."
   - Personal Health & Medication History: e.g. "I am also taking Amlodipine and Metformin prescribed by my doctors."
   - Patient Questions & Thanks: e.g. "Will this medicine cause drowsiness?", "Thank you, doctor."

CRITICAL RULES:
1. Split alternating turns cleanly. For example:
   Doctor: "How are you managing your medicines?"
   Patient: "I take several medicines and sometimes forget which one comes first."
   Doctor: "For this sample conversation, keep a written medicine schedule and take each prescribed medicine at its instructed time."
   Patient: "I am also taking Amlodipine and Metformin prescribed by my doctors."
2. NEVER combine doctor directives and patient answers into a single card.
3. Preserve 100% of all spoken words, drug names (e.g. Amlodipine, Metformin), and instructions.
4. Output format:
Return a JSON array of objects:
[
  { "speaker": "Doctor", "text": "..." },
  { "speaker": "Patient", "text": "..." }
]
If JSON is not possible, return plain lines starting with Doctor: and Patient:.`,
      },
      {
        role: "user",
        content: `Consultation dialogue to separate:\n"${strippedInput || transcript}"`,
      },
    ];

    const { content: diarizeText, model } = await callGeminiChat({
      messages,
      tag: "Dynamic Speaker Formatting",
    });

    console.log(`📝 [Format Dialogue Raw Output]:\n${diarizeText}`);
    const dialogue = parseDialogueResponse(diarizeText);

    const formattedTranscript = dialogue.length > 0
      ? dialogue.map((d) => `${d.speaker}: "${d.text}"`).join("\n\n")
      : transcript;

    const totalElapsed = Date.now() - reqStart;
    console.log(`🎉 [Format Dialogue] Formatted ${dialogue.length} turns in ${totalElapsed}ms with model "${model}"`);
    return res.json({ dialogue, formattedTranscript, modelUsed: model });
  } catch (err) {
    const errorMsg = err.response?.data?.error?.message || err.response?.data || err.message;
    console.error("❌ [Format Dialogue] Formatting failed:", errorMsg);
    return res.status(500).json({
      error: "Failed to format dialogue speakers",
      detail: errorMsg,
    });
  }
};

// ==========================================
// STEP 2: GENERATE SOAP NOTE FROM TRANSCRIPT
// ==========================================
export const generateSOAPNote = async (req, res) => {
  const reqStart = Date.now();
  console.log("\n==================== [AI NOTE WRITER: GENERATE SOAP] ====================");

  try {
    const { transcript, patient } = req.body;

    console.log(`[SOAP] Patient: "${patient?.name || "Unknown"}" (ID: ${patient?.id || "N/A"}) | Age: ${patient?.age || "N/A"}`);
    console.log(`[SOAP] Transcript length: ${transcript ? transcript.length : 0} chars`);

    if (!transcript || !transcript.trim()) {
      console.warn("⚠️ [SOAP] Transcript is empty or missing");
      return res.status(400).json({ error: "Transcript is required" });
    }

    const messages = [
      {
        role: "system",
        content: `
You are an expert clinical medical scribe. You analyze doctor-patient consultation transcripts and write clear, easy-to-read clinical SOAP notes.

Your job has TWO parts:
1. Write a structured clinical note from the consultation transcript — in plain language, short sentences, easy to skim.
2. Identify important clinical areas the doctor did NOT ask about, and suggest those as questions for the doctor to ask the patient.

RULES:
- Write in clear, professional plain English. Avoid unnecessary jargon.
- Short sentences. Easy to read at a glance.
- Return ONLY a valid JSON object. No markdown formatting, no backticks, no text before or after the JSON.
- Never leave any field empty.

Return this exact JSON structure:
{
  "what_patient_said": "2-3 simple sentences: what the patient complained about and their main symptoms.",
  "what_was_observed": "What the doctor noted during the visit. If not in transcript, mention what would normally be checked.",
  "likely_diagnosis": "Simple 1-2 sentence explanation of what is likely going on with the patient.",
  "treatment_plan": "Step-by-step plan: medicines, dosage, lifestyle advice, rest, diet.",
  "medications": "List of prescribed medicines with dose and frequency. If none, write 'None prescribed yet'.",
  "follow_up": "When the patient should return and what to check at that visit.",
  "warning_signs": [
    "Specific sign meaning patient should return immediately",
    "Another urgent warning sign"
  ],
  "suggested_questions": [
    "Ask about [topic] — helps understand [why it matters].",
    "Check [finding or test] — important to rule out [condition]."
  ],
  "quick_summary": "3-4 sentence summary a doctor can read in 10 seconds to understand the entire visit."
}

For suggested_questions: If the doctor did NOT cover: symptom duration, pain scale (1-10), previous episodes, past medical history, current medications, allergies, family history, lifestyle, or relevant tests — list each as a suggested question explaining why it matters. If everything was covered, write ["All key areas were covered in this consultation."].
        `,
      },
      {
        role: "user",
        content: `
Patient Details:
- Name: ${patient?.name || "Unknown"}
- Age: ${patient?.age || "N/A"} years
- Gender: ${patient?.gender || "N/A"}
- Blood Group: ${patient?.bloodGroup || "N/A"}
- Status: ${patient?.status || "N/A"}

Consultation Transcript:
"${transcript}"

Write a clear, simple clinical note and list any important questions the doctor may have missed. Return ONLY the JSON object.
        `,
      },
    ];

    const { content: rawContent, model } = await callGeminiChat({
      messages,
      tag: "SOAP Generation",
      responseMimeType: "application/json",
    });

    // Clean JSON string
    let raw = rawContent.replace(/```json/gi, "").replace(/```/g, "").trim();
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");

    if (start === -1 || end === -1) {
      console.error("❌ [SOAP] AI did not return a valid JSON block:", raw);
      return res.status(500).json({ error: "AI returned invalid note format", raw });
    }

    let parsed;
    try {
      parsed = JSON.parse(raw.substring(start, end + 1));
    } catch (parseErr) {
      console.error("❌ [SOAP] JSON parse failed:", parseErr.message, raw.substring(start, end + 1));
      return res.status(500).json({
        error: "Failed to parse clinical note JSON",
        detail: parseErr.message,
      });
    }

    // Default structure fallback to prevent missing keys
    const noteData = {
      what_patient_said: parsed.what_patient_said || "No symptoms recorded.",
      what_was_observed: parsed.what_was_observed || "Clinical examination pending.",
      likely_diagnosis: parsed.likely_diagnosis || "Evaluation ongoing.",
      treatment_plan: parsed.treatment_plan || "Standard supportive care.",
      medications: parsed.medications || "None prescribed yet.",
      follow_up: parsed.follow_up || "Follow up in 5-7 days if symptoms persist.",
      warning_signs: Array.isArray(parsed.warning_signs) ? parsed.warning_signs : [],
      suggested_questions: Array.isArray(parsed.suggested_questions) ? parsed.suggested_questions : [],
      quick_summary: parsed.quick_summary || "",
      ...parsed,
    };

    // Enrich noteData with patient context
    noteData._patient = {
      name: patient?.name || "N/A",
      age: patient?.age || "N/A",
      gender: patient?.gender || "N/A",
      bloodGroup: patient?.bloodGroup || "N/A",
    };

    const soapNote = JSON.stringify(noteData);
    const soapData = noteData;

    const totalElapsed = Date.now() - reqStart;
    console.log(`🎉 [SOAP] Generated successfully with model "${model}" in ${totalElapsed}ms`);
    return res.json({ soapNote, soapData, modelUsed: model });
  } catch (err) {
    const errorMsg = err.response?.data?.error?.message || err.response?.data || err.message;
    console.error("❌ [SOAP] SOAP generation error:", errorMsg);
    return res.status(500).json({
      error: "SOAP note generation failed",
      detail: errorMsg,
    });
  }
};

// ==========================================
// STEP 3: SAVE DRAFT NOTE
// ==========================================
export const saveConsultationDraft = async (req, res) => {
  console.log("\n==================== [AI NOTE WRITER: SAVE DRAFT] ====================");

  try {
    const { patientId, transcript, soapNote } = req.body;
    const userId = req.headers.userid;

    console.log(`[Save Draft] PatientId: ${patientId}, UserId: ${userId}`);

    if (!patientId) {
      console.warn("⚠️ [Save Draft] Missing patientId");
      return res.status(400).json({ error: "Patient ID required" });
    }

    let doctorId = null;
    if (userId) {
      const doctor = await prisma.doctor.findUnique({
        where: { userId: Number(userId) },
      });
      doctorId = doctor?.id || null;
      console.log(`[Save Draft] Resolved doctorId: ${doctorId} for userId: ${userId}`);
    }

    const note = await prisma.consultationNote.create({
      data: {
        patientId: Number(patientId),
        doctorId,
        transcript,
        soapNote,
        status: "DRAFT",
      },
    });

    console.log(`✅ [Save Draft] Note created with ID: ${note.id} (Status: DRAFT)`);
    return res.json({ note });
  } catch (err) {
    console.error("❌ [Save Draft] Error:", err.message);
    return res.status(500).json({ error: "Failed to save draft note", detail: err.message });
  }
};

// ==========================================
// STEP 4: DOCTOR APPROVES & SAVES FINAL NOTE
// (Also auto-generates a patient-friendly version)
// ==========================================
export const approveConsultationNote = async (req, res) => {
  const reqStart = Date.now();
  console.log("\n==================== [AI NOTE WRITER: APPROVE NOTE] ====================");

  try {
    const { noteId, finalNote } = req.body;

    console.log(`[Approve Note] Note ID: ${noteId}`);

    if (!noteId) {
      console.warn("⚠️ [Approve Note] Missing noteId");
      return res.status(400).json({ error: "Note ID required" });
    }

    // Fetch existing note with patient and doctor details
    const existingNote = await prisma.consultationNote.findUnique({
      where: { id: Number(noteId) },
      include: { patient: true, doctor: true },
    });

    if (!existingNote) {
      console.warn(`⚠️ [Approve Note] Note with ID ${noteId} not found in database`);
      return res.status(404).json({ error: `Note #${noteId} not found` });
    }

    // --- Generate patient-friendly version via AI ---
    let patientNote = null;
    try {
      console.log(`[Approve Note] Requesting patient-friendly summary from Gemini...`);
      const patientPromptMessages = [
        {
          role: "system",
          content: `
You are a friendly, compassionate health assistant. A doctor has written a clinical consultation note for a patient.
Your job is to rewrite ONLY the patient-relevant parts in very simple, warm, everyday language.

RULES:
- Address the patient directly (use "you" and "your").
- No medical jargon. Keep it reassuring, clear, and easy to read.
- Use simple bullet points.
- NEVER include doctor-facing questions, internal diagnostic codes, or clinical scribing details.
- Focus ONLY on:
  1. What is going on with your health (1-2 clear sentences)
  2. Your medicines (name, when to take, how much)
  3. What to do and avoid (diet, rest, fluids, lifestyle tips)
  4. When to see your doctor again
  5. Warning signs — when to seek medical help immediately
          `,
        },
        {
          role: "user",
          content: `
Doctor's Consultation Note:
${finalNote}

Rewrite this as a friendly, reassuring summary for the patient. Return plain text only.
          `,
        },
      ];

      const { content: aiPatientText } = await callGeminiChat({
        messages: patientPromptMessages,
        tag: "Patient Note Generation",
      });

      patientNote = aiPatientText;
      console.log(`✅ [Approve Note] Patient-friendly version generated (${patientNote.length} chars)`);
    } catch (aiErr) {
      console.warn("⚠️ [Approve Note] Patient summary AI call failed, using graceful fallback:", aiErr.message);
      patientNote = `Your doctor has reviewed your consultation and approved your care plan.\n\nPlease follow your doctor's instructions carefully and take all medicines as prescribed. If your symptoms worsen or you feel unwell, please contact the clinic or return immediately.`;
    }

    // Format with doctor info and date
    const doctorName = existingNote?.doctor?.name || "Your Doctor";
    const date = new Date().toLocaleDateString("en-IN", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

    const formattedPatientNote = `📋 Note from ${doctorName} — ${date}\n\n${patientNote}`;

    // Update DB
    const note = await prisma.consultationNote.update({
      where: { id: Number(noteId) },
      data: {
        finalNote,
        patientNote: formattedPatientNote,
        status: "APPROVED",
      },
    });

    // --- Sync & Store into MedicalRecord table ---
    let createdRecord = null;
    try {
      let parsedData = null;
      try {
        parsedData = typeof finalNote === "string" ? JSON.parse(finalNote) : finalNote;
      } catch {
        parsedData = null;
      }

      const symptoms = parsedData?.what_patient_said || parsedData?.symptoms || existingNote?.transcript || null;
      const diagnosis = parsedData?.likely_diagnosis || parsedData?.diagnosis || "Consultation Clinical Assessment";
      const vitals = parsedData?.what_was_observed || parsedData?.vitals || null;
      const prescription = parsedData?.medications || parsedData?.prescription || null;
      const notes = parsedData?.quick_summary || parsedData?.notes || formattedPatientNote || null;
      const riskLevel = existingNote?.patient?.status || "ACTIVE";
      const redFlags = parsedData?.warning_signs ? JSON.stringify(parsedData.warning_signs) : null;
      const recommendations = parsedData
        ? [parsedData.treatment_plan, parsedData.follow_up].filter(Boolean).join("\n\nFollow-up: ")
        : null;

      createdRecord = await prisma.medicalRecord.create({
        data: {
          patientId: existingNote.patientId,
          symptoms,
          diagnosis,
          vitals,
          prescription,
          notes,
          riskLevel,
          redFlags,
          recommendations,
        },
      });

      console.log(`✅ [Approve Note] MedicalRecord #${createdRecord.id} successfully saved to MedicalRecord table for patient #${existingNote.patientId}`);

      // Also update patient's medicalNotes for quick directory overview
      if (diagnosis || notes) {
        await prisma.patient.update({
          where: { id: existingNote.patientId },
          data: {
            medicalNotes: notes || diagnosis,
          },
        });
      }
    } catch (mrErr) {
      console.error("❌ [Approve Note] Failed to store MedicalRecord:", mrErr.message);
    }

    const totalElapsed = Date.now() - reqStart;
    console.log(`🎉 [Approve Note] Note #${noteId} successfully APPROVED and saved in ${totalElapsed}ms`);
    return res.json({
      note,
      medicalRecord: createdRecord,
      message: "Consultation note approved and saved successfully to EHR & Medical Records.",
    });
  } catch (err) {
    console.error("❌ [Approve Note] Error:", err.message);
    return res.status(500).json({ error: "Failed to approve note", detail: err.message });
  }
};

// ==========================================
// GET ALL NOTES FOR A PATIENT (Doctor view)
// ==========================================
export const getConsultationNotes = async (req, res) => {
  try {
    const patientId = Number(req.query.patientId);
    console.log(`📋 [Get Notes] Fetching notes for patientId: ${patientId}`);

    if (!patientId) {
      return res.status(400).json({ error: "patientId query parameter required" });
    }

    const notes = await prisma.consultationNote.findMany({
      where: { patientId },
      include: {
        doctor: { select: { id: true, name: true, specialty: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    console.log(`✅ [Get Notes] Found ${notes.length} notes for patientId ${patientId}`);
    return res.json(notes);
  } catch (err) {
    console.error("❌ [Get Notes] Error:", err.message);
    return res.status(500).json({ error: "Failed to fetch consultation notes", detail: err.message });
  }
};

// ==========================================
// GET PATIENT'S OWN APPROVED NOTES (Patient dashboard)
// ==========================================
export const getMyPatientNotes = async (req, res) => {
  try {
    const userId = req.headers.userid;
    console.log(`📋 [Get My Patient Notes] For userId: ${userId}`);

    if (!userId) {
      return res.status(400).json({ error: "User ID header required" });
    }

    const patient = await prisma.patient.findUnique({
      where: { userId: Number(userId) },
    });

    if (!patient) {
      console.log(`⚠️ [Get My Patient Notes] No patient profile found for userId ${userId}`);
      return res.json([]);
    }

    const notes = await prisma.consultationNote.findMany({
      where: {
        patientId: patient.id,
        status: "APPROVED",
        patientNote: { not: null },
      },
      include: {
        doctor: {
          select: { name: true, specialty: true },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    console.log(`✅ [Get My Patient Notes] Found ${notes.length} approved notes for patient ${patient.name} (ID: ${patient.id})`);
    return res.json(notes);
  } catch (err) {
    console.error("❌ [Get My Patient Notes] Error:", err.message);
    return res.status(500).json({ error: "Failed to fetch your consultation notes", detail: err.message });
  }
};

// ==========================================
// DELETE CONSULTATION NOTE (Doctor / Admin)
// ==========================================
export const deleteConsultationNote = async (req, res) => {
  try {
    const id = Number(req.params.id);
    console.log(`🗑️ [Delete Note] Request to delete consultation note ID: ${id}`);

    if (!id || isNaN(id)) {
      return res.status(400).json({ error: "Valid consultation note ID is required" });
    }

    const note = await prisma.consultationNote.findUnique({
      where: { id },
    });

    if (!note) {
      return res.status(404).json({ error: "Consultation note not found" });
    }

    await prisma.consultationNote.delete({
      where: { id },
    });

    console.log(`✅ [Delete Note] Successfully deleted consultation note ID: ${id}`);
    return res.json({ message: "Consultation note deleted successfully", id });
  } catch (err) {
    console.error("❌ [Delete Note] Error:", err.message);
    return res.status(500).json({ error: "Failed to delete consultation note", detail: err.message });
  }
};

