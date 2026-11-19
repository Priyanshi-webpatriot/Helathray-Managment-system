import { useState, useEffect, useRef } from "react";
import API from "../api";
import "../styles/chatbox.css";
import ReactMarkdown from "react-markdown";
import { FaTimes, FaClipboardList, FaPills, FaExclamationTriangle } from "react-icons/fa";
import { FaUserDoctor } from "react-icons/fa6";
import { toast } from "react-toastify";

export default function DoctorChatBox({ patient }) {
  const [message, setMessage] = useState("");
  const [chat, setChat] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const messagesContainerRef = useRef(null);
  const messagesEndRef = useRef(null);

  const scrollToBottom = (behavior = "smooth") => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTo({
        top: messagesContainerRef.current.scrollHeight,
        behavior,
      });
    } else {
      messagesEndRef.current?.scrollIntoView({ behavior });
    }
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom("smooth");
    }
  }, [chat, loading, isOpen]);

  // =========================
  // FETCH OLD CHATS
  // =========================

  const fetchDoctorChats = async () => {
    try {
      if (!patient?.id) return;

      const user = JSON.parse(localStorage.getItem("user"));

      const res = await API.get(
        `/chat/doctor?patientId=${patient.id}`,
        {
          headers: {
            role: "doctor",
            userid: user.id,
          },
        }
      );

      const formattedChats = [];

      res.data.forEach((c) => {
        formattedChats.push({
          type: "user",
          text: c.message,
        });

        formattedChats.push({
          type: "bot",
          text: c.reply,
        });
      });

      if (formattedChats.length === 0) {
        setChat([
          {
            type: "bot",
            text: `Hello Doctor. I am your Clinical Assistant for **${patient.name}** (${patient.age ? `${patient.age} yrs` : "Age N/A"}, ${patient.gender || "Gender N/A"}, Blood: ${patient.bloodGroup || "N/A"}).\n\nAsk me any specific question about this patient's symptoms, medication dosages, drug interactions, or diagnostic recommendations.`,
          },
        ]);
      } else {
        setChat(formattedChats);
      }

    } catch (err) {
      console.log(err);
    }
  };

  // =========================
  // CLEAR DOCTOR CHATS
  // =========================
  const clearDoctorChatHistory = () => {
    toast(
      ({ closeToast }) => (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <span style={{ fontSize: "13.5px", fontWeight: "600", color: "#1e293b" }}>
            Clear chat history with AI Assistant for {patient?.name || "this patient"}?
          </span>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
            <button
              onClick={closeToast}
              style={{
                padding: "5px 12px",
                borderRadius: "6px",
                border: "1px solid #cbd5e1",
                background: "#ffffff",
                color: "#475569",
                fontSize: "12px",
                fontWeight: "600",
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
            <button
              onClick={async () => {
                closeToast();
                try {
                  if (!patient?.id) return;
                  const user = JSON.parse(localStorage.getItem("user"));
                  await API.delete(`/chat/doctor?patientId=${patient.id}`, {
                    headers: {
                      role: "doctor",
                      userid: user?.id,
                    },
                  });
                  setChat([
                    {
                      type: "bot",
                      text: `Hello Doctor. I am your Clinical Assistant for **${patient.name}** (${patient.age ? `${patient.age} yrs` : "Age N/A"}, ${patient.gender || "Gender N/A"}, Blood: ${patient.bloodGroup || "N/A"}).\n\nAsk me any specific question about this patient's symptoms, medication dosages, drug interactions, or diagnostic recommendations.`,
                    },
                  ]);
                  toast.success("Chat history cleared successfully!");
                } catch (err) {
                  console.error("Failed to clear doctor chats:", err);
                  toast.error("Failed to clear chat history.");
                }
              }}
              style={{
                padding: "5px 12px",
                borderRadius: "6px",
                border: "none",
                background: "#ef4444",
                color: "#ffffff",
                fontSize: "12px",
                fontWeight: "600",
                cursor: "pointer",
              }}
            >
              Clear
            </button>
          </div>
        </div>
      ),
      {
        autoClose: 5000,
        closeOnClick: false,
        draggable: false,
      }
    );
  };

  // =========================
  // SEND MESSAGE
  // =========================

  const sendMessage = async (customMessage) => {
    const textToSend = typeof customMessage === "string" ? customMessage : message;
    if (!textToSend.trim()) return;

    const user = JSON.parse(localStorage.getItem("user"));
    const currentMessage = textToSend;

    // INSTANT UI UPDATE
    setChat((prev) => [
      ...prev,
      {
        type: "user",
        text: currentMessage,
      },
    ]);

    setMessage("");
    setLoading(true);

    try {
      const res = await API.post(
        "/chat/doctor",
        {
          message: currentMessage,
          patient,
        },
        {
          headers: {
            role: "doctor",
            userid: user?.id,
          },
        }
      );

      setChat((prev) => [
        ...prev,
        {
          type: "bot",
          text: res.data.reply,
        },
      ]);

    } catch (err) {
      console.log(err);

      setChat((prev) => [
        ...prev,
        {
          type: "bot",
          text: "I encountered an error retrieving that information. Please try asking again.",
        },
      ]);
    }

    setLoading(false);
  };

  // =========================
  // LOAD CHATS
  // =========================

  useEffect(() => {
    if (!patient?.id) {
      setChat([]);
      setIsOpen(false);
      return;
    }
    fetchDoctorChats();
  }, [patient?.id]);

  return (
    <>
      {/* FLOATING ICON */}

      <div
        className="chat-icon"
        onClick={() => {
          if (!patient?.id) {
            toast.info("Please select a patient using Analyze first");
            return;
          }
          setIsOpen(!isOpen);
        }}
      >
          <FaUserDoctor />
      </div>

      {/* CHATBOX */}

      {isOpen && (
        <div className="chatbox">

          {/* HEADER */}

          <div className="doctor-ai-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <FaUserDoctor style={{ fontSize: "16px" }} />
              <span>AI Assistant · {patient?.name}</span>
            </div>
            <button
              type="button"
              className="clear-chat-btn"
              onClick={clearDoctorChatHistory}
              title="Clear clinical chat history for this patient"
              style={{
                background: "rgba(255, 255, 255, 0.18)",
                border: "1px solid rgba(255, 255, 255, 0.35)",
                color: "#ffffff",
                padding: "4px 10px",
                borderRadius: "8px",
                fontSize: "11.5px",
                fontWeight: "700",
                cursor: "pointer",
                transition: "all 0.2s ease",
              }}
            >
              Clear Chat
            </button>
          </div>

          {/* MESSAGES */}

          <div className="messages" ref={messagesContainerRef}>
            {chat.map((c, i) => (
              <div
                key={i}
                className={`msg ${c.type}`}
              >
                <ReactMarkdown>
                  {c.text}
                </ReactMarkdown>
              </div>
            ))}

            {loading && (
              <div className="msg bot">
                Thinking and reviewing clinical data...
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* QUICK SUGGESTION PROMPTS */}
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", padding: "8px 12px", background: "#f8fafc", borderTop: "1px solid #e2e8f0" }}>
            <button
              type="button"
              onClick={() => sendMessage(`Summarize ${patient?.name}'s current medical status and known vitals.`)}
              disabled={loading}
              style={{
                fontSize: "11px",
                fontWeight: "600",
                padding: "5px 10px",
                background: "#ffffff",
                border: "1px solid #cbd5e1",
                borderRadius: "12px",
                cursor: "pointer",
                color: "#0369a1",
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
              }}
            >
              <FaClipboardList style={{ fontSize: "11px", color: "#0284c7" }} />
              <span>Patient Summary</span>
            </button>
            <button
              type="button"
              onClick={() => sendMessage(`What medications or treatments are clinically suggested for ${patient?.name}?`)}
              disabled={loading}
              style={{
                fontSize: "11px",
                fontWeight: "600",
                padding: "5px 10px",
                background: "#ffffff",
                border: "1px solid #cbd5e1",
                borderRadius: "12px",
                cursor: "pointer",
                color: "#0369a1",
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
              }}
            >
              <FaPills style={{ fontSize: "11px", color: "#e11d48" }} />
              <span>Suggested Rx</span>
            </button>
            <button
              type="button"
              onClick={() => sendMessage(`Are there any potential drug interactions, contraindications, or red flags for ${patient?.name}?`)}
              disabled={loading}
              style={{
                fontSize: "11px",
                fontWeight: "600",
                padding: "5px 10px",
                background: "#ffffff",
                border: "1px solid #cbd5e1",
                borderRadius: "12px",
                cursor: "pointer",
                color: "#0369a1",
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
              }}
            >
              <FaExclamationTriangle style={{ fontSize: "11px", color: "#d97706" }} />
              <span>Contraindications</span>
            </button>
          </div>

          {/* INPUT AREA */}

          <div className="input-area">
            <input
              value={message}
              onChange={(e) =>
                setMessage(e.target.value)
              }
              placeholder={`Ask a medical or clinical question about ${patient?.name || "patient"}...`}
              onKeyDown={(e) =>
                e.key === "Enter" && sendMessage()
              }
            />

            <button onClick={() => sendMessage()} disabled={loading}>
              Send
            </button>
          </div>
        </div>
      )}
    </>
  );
}