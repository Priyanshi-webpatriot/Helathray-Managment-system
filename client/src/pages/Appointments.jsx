import { useEffect, useState, useMemo, useRef } from "react";
import API from "../api";
import "../styles/appointment.css";
import { useNavigate } from "react-router-dom";
import {
  BsCalendar2Check, BsCalendarCheck, BsClock, BsInbox,
} from "react-icons/bs";
import {
  FaArrowLeft, FaChevronLeft, FaChevronRight, FaUserMd, FaUserInjured, FaExclamationCircle,
  FaSearch, FaStethoscope, FaTimes, FaCheck,
} from "react-icons/fa";
import { toast } from "react-toastify";
import {
  generateDoctorSlots,
  isSlotPastForToday,
  formatTimeTo12Hour,
  formatDateToDDMMYYYY,
  getTodayDateStr,
} from "../utils/slotHelper";

export default function Appointments() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem("user") || "null");

  useEffect(() => {
    if (user?.role === "patient") {
      navigate("/dashboard");
    }
  }, [user, navigate]);

  const [errors, setErrors] = useState({});
  const [patients, setPatients] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const limit = 5;

  const [form, setForm] = useState({
    patientId: "",
    doctorId: "",
    date: "",
    time: "",
  });
  const [bookedSlots, setBookedSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  // Unified Doctor & Specialty Dropdown State
  const [docDropdownOpen, setDocDropdownOpen] = useState(false);
  const [docSearchTerm, setDocSearchTerm] = useState("");
  const docDropdownRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (docDropdownRef.current && !docDropdownRef.current.contains(e.target)) {
        setDocDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Helper to identify if a doctor record belongs to the logged-in user
  const isDoctorMe = (d) => {
    if (!user || !d) return false;
    return (
      String(user.id) === String(d.userId) ||
      String(user.id) === String(d.id) ||
      (user.email && d.user?.email && d.user.email.toLowerCase() === user.email.toLowerCase()) ||
      (user.name && d.name && (d.name.toLowerCase() === user.name.toLowerCase() || d.name.toLowerCase().includes(user.name.toLowerCase())))
    );
  };

  // Filtered doctors based on unified search (doctor name + specialty + clinic)
  const filteredDoctors = useMemo(() => {
    const q = docSearchTerm.toLowerCase().trim();
    let list = doctors;
    if (q) {
      list = doctors.filter((d) =>
        d.name?.toLowerCase().includes(q) ||
        d.specialty?.toLowerCase().includes(q) ||
        d.clinicName?.toLowerCase().includes(q) ||
        d.city?.toLowerCase().includes(q)
      );
    }
    // Prioritize the logged-in doctor ("You") at the top
    return [...list].sort((a, b) => {
      const aIsMe = isDoctorMe(a) ? 1 : 0;
      const bIsMe = isDoctorMe(b) ? 1 : 0;
      return bIsMe - aIsMe;
    });
  }, [doctors, docSearchTerm, user]);

  // Group matching doctors by specialty for clean, organized selection
  const doctorsBySpecialty = useMemo(() => {
    const groups = {};
    filteredDoctors.forEach((d) => {
      const spec = d.specialty || "General Medicine";
      if (!groups[spec]) groups[spec] = [];
      groups[spec].push(d);
    });
    return groups;
  }, [filteredDoctors]);

  const fetchPatients = async () => {
    try {
      if (!user) return;
      if (user.role === "patient") {
        const res = await API.get("/patients/profile", {
          headers: { role: user.role, userid: user.id },
        });
        setForm((prev) => ({ ...prev, patientId: res.data.id }));
      } else {
        const res = await API.get("/patients", {
          headers: { role: user.role, userid: user.id },
        });
        setPatients(res.data);
      }
    } catch (error) {
      console.log(error);
    }
  };

  const fetchDoctors = async () => {
    try {
      const res = await API.get("/doctors");
      const list = res.data || [];
      setDoctors(list);

      // Pre-select the logged-in doctor by default ("You") if role is doctor
      if (user?.role === "doctor") {
        const myDoc = list.find((d) => isDoctorMe(d));
        if (myDoc) {
          setForm((prev) => ({
            ...prev,
            doctorId: prev.doctorId || myDoc.id,
          }));
        }
      }
    } catch (error) {
      console.log("Failed to fetch doctors:", error);
    }
  };

  const fetchAppointments = async () => {
    try {
      if (!user) return;
      const res = await API.get(`/appointments?page=${page}&limit=${limit}`, {
        headers: { role: user.role, userid: user.id },
      });
      setAppointments(res.data.data);
      setTotalPages(res.data.totalPages);
    } catch (error) {
      console.log(error);
    }
  };

  useEffect(() => {
    fetchPatients();
    fetchDoctors();
  }, []);

  useEffect(() => {
    fetchAppointments();
  }, [page]);

  useEffect(() => {
    if (!form.doctorId || !form.date) {
      setBookedSlots([]);
      return;
    }

    let isCancelled = false;
    setLoadingSlots(true);
    API.get(`/patient-appointments/booked-slots?doctorId=${form.doctorId}&date=${form.date}`)
      .then((res) => {
        if (!isCancelled) {
          setBookedSlots(res.data?.bookedSlots || []);
        }
      })
      .catch((err) => {
        console.error("Failed to load doctor slots:", err);
        if (!isCancelled) setBookedSlots([]);
      })
      .finally(() => {
        if (!isCancelled) setLoadingSlots(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [form.doctorId, form.date]);

  const selectedDoctorObj = doctors.find((d) => String(d.id) === String(form.doctorId));
  const dynamicDoctorSlots = selectedDoctorObj ? generateDoctorSlots(selectedDoctorObj.timing) : [];

  const validate = () => {
    let newErrors = {};
    if (!form.patientId) newErrors.patientId = "Patient is required";
    if (!form.doctorId) newErrors.doctorId = "Doctor is required";
    if (!form.date) {
      newErrors.date = "Date is required";
    } else if (form.date < getTodayDateStr()) {
      newErrors.date = "Cannot select a past date";
    }
    if (!form.time) {
      newErrors.time = "Time is required";
    } else if (isSlotPastForToday(form.date, form.time)) {
      newErrors.time = "Cannot select a past time for today";
    } else if (bookedSlots.includes(form.time)) {
      newErrors.time = "This time slot is already booked for this doctor";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleCreate = async () => {
    try {
      if (!validate()) return;
      if (!user) {
        toast.warning("Please login first");
        return;
      }
      await API.post("/appointments", form, {
        headers: { role: user.role },
      });
      toast.success("Appointment booked successfully!");
      fetchAppointments();
      
      // Keep the logged-in doctor pre-selected if user is a doctor
      const myDoc = user?.role === "doctor" ? doctors.find((d) => isDoctorMe(d)) : null;
      setForm({
        patientId: user.role === "patient" ? form.patientId : "",
        doctorId: myDoc ? myDoc.id : "",
        date: "",
        time: "",
      });
      setErrors({});
    } catch (error) {
      console.log("CREATE APPOINTMENT ERROR:", error);
      toast.error(error.response?.data?.error || "Failed to book appointment");
    }
  };

  return (
    <div className="appt-page">

      {/* ── PAGE HEADER ── */}
      <div className="appt-page-header">
        <div className="appt-header-left">
          <button className="appt-back-btn" onClick={() => navigate(-1)} title="Go back">
            <FaArrowLeft />
            <span>Back</span>
          </button>
          <div className="appt-title-block">
            <span className="appt-eyebrow">Doctor Portal</span>
            <h1 className="appt-page-title">Appointment Management</h1>
          </div>
        </div>
        <span className="appt-page-badge">
          Page {page} of {totalPages || 1}
        </span>
      </div>

      {/* ── BOOKING FORM CARD ── */}
      <div className="appt-form-card">
        <div className="appt-form-card-header">
          <div className="appt-form-icon">
            <BsCalendar2Check />
          </div>
          <div>
            <h2 className="appt-form-card-title">Book New Appointment</h2>
            <p className="appt-form-card-sub">Fill in the details below to schedule a consultation</p>
          </div>
        </div>

        <div className="appt-form-grid">
          {/* Patient select (non-patient roles only) */}
          {user?.role !== "patient" && (
            <div className="appt-form-group">
              <label className="appt-form-label">
                <FaUserInjured /> Select Patient
              </label>
              <select
                className="appt-form-select"
                value={form.patientId}
                onChange={(e) => {
                  setForm({ ...form, patientId: e.target.value });
                  setErrors({ ...errors, patientId: "" });
                }}
              >
                <option value="">Choose a patient...</option>
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              {errors.patientId && (
                <span className="appt-field-error"><FaExclamationCircle style={{ marginRight: 4, fontSize: 11 }} />{errors.patientId}</span>
              )}
            </div>
          )}

          {/* Attending Doctor (Single Clean Unified Selection with Doctor & Specialty Search) */}
          <div className="appt-form-group appt-unified-doc-group" ref={docDropdownRef}>
            <label className="appt-form-label">
              <FaUserMd /> Attending Doctor
            </label>

            <div className="appt-unified-doc-wrapper">
              {/* If a doctor is selected and dropdown is closed, show clean selection with quick-clear */}
              {selectedDoctorObj && !docDropdownOpen ? (
                <div
                  className="appt-selected-doc-box"
                  onClick={() => {
                    setDocDropdownOpen(true);
                    setDocSearchTerm("");
                  }}
                  title="Click to change attending doctor"
                >
                  <div className="appt-selected-doc-info">
                    <span className="appt-selected-doc-name">{selectedDoctorObj.name}</span>
                    {isDoctorMe(selectedDoctorObj) && <span className="appt-doc-you-tag">You</span>}
                    <span className="appt-selected-doc-spec">{selectedDoctorObj.specialty}</span>
                    {selectedDoctorObj.clinicName && (
                      <span className="appt-selected-doc-clinic">({selectedDoctorObj.clinicName})</span>
                    )}
                  </div>
                  <button
                    type="button"
                    className="appt-selected-doc-remove"
                    onClick={(e) => {
                      e.stopPropagation();
                      setForm((prev) => ({ ...prev, doctorId: "" }));
                      setDocSearchTerm("");
                      setDocDropdownOpen(true);
                    }}
                    title="Change doctor"
                  >
                    <FaTimes />
                  </button>
                </div>
              ) : (
                /* Single unified search & selection input */
                <div className="appt-doc-search-single">
                  <FaSearch className="appt-doc-search-single-icon" />
                  <input
                    type="text"
                    className="appt-form-input appt-doc-search-single-input"
                    placeholder="Search doctor or specialty (e.g. Cardiology, Dr. John)..."
                    value={docSearchTerm}
                    onFocus={() => setDocDropdownOpen(true)}
                    onChange={(e) => {
                      setDocSearchTerm(e.target.value);
                      if (!docDropdownOpen) setDocDropdownOpen(true);
                    }}
                  />
                  {docSearchTerm && (
                    <button
                      type="button"
                      className="appt-doc-search-single-clear"
                      onClick={() => setDocSearchTerm("")}
                      title="Clear search"
                    >
                      <FaTimes />
                    </button>
                  )}
                </div>
              )}

              {/* Unified Floating Dropdown Menu Grouped by Specialty */}
              {docDropdownOpen && (
                <div className="appt-unified-doc-dropdown">
                  {filteredDoctors.length === 0 ? (
                    <div className="appt-doc-empty-state">
                      No doctors or specialties found matching "{docSearchTerm}"
                    </div>
                  ) : (
                    <div className="appt-doc-list-scroll">
                      {Object.entries(doctorsBySpecialty).map(([specialty, docList]) => (
                        <div key={specialty} className="appt-doc-spec-section">
                          <div className="appt-doc-spec-badge-header">
                            <FaStethoscope className="appt-spec-header-icon" />
                            <span>{specialty}</span>
                            <span className="appt-spec-header-count">{docList.length}</span>
                          </div>
                          {docList.map((d) => {
                            const isSelected = String(form.doctorId) === String(d.id);
                            const isCurrentUser = isDoctorMe(d);
                            return (
                              <div
                                key={d.id}
                                className={`appt-doc-dropdown-item ${isSelected ? "selected" : ""}`}
                                onClick={() => {
                                  setForm((prev) => ({ ...prev, doctorId: d.id }));
                                  setErrors((prev) => ({ ...prev, doctorId: "" }));
                                  setDocDropdownOpen(false);
                                  setDocSearchTerm("");
                                }}
                              >
                                <div className="appt-doc-dropdown-avatar">
                                  {d.name?.[0]?.toUpperCase() || "D"}
                                </div>
                                <div className="appt-doc-dropdown-meta">
                                  <div className="appt-doc-dropdown-title-row">
                                    <span className="appt-doc-dropdown-name">{d.name}</span>
                                    {isCurrentUser && <span className="appt-doc-you-tag">You</span>}
                                    <span className="appt-doc-dropdown-pill">{d.specialty}</span>
                                  </div>
                                  {d.clinicName && (
                                    <div className="appt-doc-dropdown-clinic">
                                      {d.clinicName}{d.city ? `, ${d.city}` : ""}
                                    </div>
                                  )}
                                </div>
                                {isSelected && (
                                  <FaCheck className="appt-doc-dropdown-check" />
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {errors.doctorId && (
              <span className="appt-field-error">
                <FaExclamationCircle style={{ marginRight: 4, fontSize: 11 }} />
                {errors.doctorId}
              </span>
            )}
          </div>

          {/* Date */}
          <div className="appt-form-group">
            <label className="appt-form-label">
              <BsCalendarCheck /> Consultation Date
            </label>
            <input
              type="date"
              className="appt-form-input"
              min={getTodayDateStr()}
              value={form.date}
              onChange={(e) => {
                setForm({ ...form, date: e.target.value });
                setErrors({ ...errors, date: "" });
              }}
            />
            {errors.date && (
              <span className="appt-field-error"><FaExclamationCircle style={{ marginRight: 4, fontSize: 11 }} />{errors.date}</span>
            )}
          </div>

          {/* Time */}
          <div className="appt-form-group">
            <label className="appt-form-label">
              <BsClock /> Time Slot
            </label>
            {form.doctorId ? (
              <select
                className="appt-form-input"
                value={form.time}
                onChange={(e) => {
                  setForm({ ...form, time: e.target.value });
                  setErrors({ ...errors, time: "" });
                }}
              >
                <option value="">
                  {!form.date
                    ? "-- First Choose Date --"
                    : loadingSlots
                    ? "-- Checking OPD Availability... --"
                    : "-- Choose OPD Time Slot --"}
                </option>
                {dynamicDoctorSlots.map((slot) => {
                  const isSlotBooked =
                    bookedSlots.includes(slot.value) ||
                    bookedSlots.includes(slot.label);
                  const isPast = isSlotPastForToday(form.date, slot.value);
                  const isDisabled = isSlotBooked || isPast;

                  let statusNote = "";
                  if (isSlotBooked) statusNote = " (Booked)";
                  else if (isPast) statusNote = " (Passed)";

                  return (
                    <option
                      key={slot.value}
                      value={slot.value}
                      disabled={isDisabled}
                    >
                      {slot.label} - {slot.period} Slot{statusNote}
                    </option>
                  );
                })}
              </select>
            ) : (
              <input
                type="time"
                className="appt-form-input"
                value={form.time}
                onChange={(e) => {
                  setForm({ ...form, time: e.target.value });
                  setErrors({ ...errors, time: "" });
                }}
                placeholder="Choose doctor first"
              />
            )}
            {errors.time && (
              <span className="appt-field-error"><FaExclamationCircle style={{ marginRight: 4, fontSize: 11 }} />{errors.time}</span>
            )}
          </div>
        </div>

        <div className="appt-form-footer">
          <button className="appt-book-btn" onClick={handleCreate}>
            <BsCalendarCheck />
            <span>Book Appointment</span>
          </button>
        </div>
      </div>

      {/* ── APPOINTMENTS LIST ── */}
      <div className="appt-list-card">
        <div className="appt-list-header">
          <h3 className="appt-list-title">
            <BsCalendar2Check />
            Scheduled Appointments
          </h3>
          <span className="appt-list-count">{appointments.length} total</span>
        </div>

        {appointments.length === 0 ? (
          <div className="appt-empty">
            <BsInbox className="appt-empty-icon" />
            <h4 className="appt-empty-title">No appointments found</h4>
            <p className="appt-empty-desc">Use the form above to schedule a new consultation.</p>
          </div>
        ) : (
          <div className="appt-table-wrap">
            <table className="appt-table">
              <thead>
                <tr>
                  {user?.role !== "patient" && <th>Patient</th>}
                  {user?.role !== "patient" && <th>Contact Email</th>}
                  <th>Attending Doctor</th>
                  <th>Date</th>
                  <th>Time</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {appointments.map((a) => (
                  <tr key={a.id}>
                    {user?.role !== "patient" && (
                      <td>
                        <div className="appt-patient-row">
                          <div className="appt-patient-avatar">
                            {a.patient?.name?.[0]?.toUpperCase() || "P"}
                          </div>
                          <div>
                            <div className="appt-cell-primary">{a.patient?.name || "N/A"}</div>
                          </div>
                        </div>
                      </td>
                    )}
                    {user?.role !== "patient" && (
                      <td>
                        <span className="appt-cell-muted">{a.patient?.user?.email || "—"}</span>
                      </td>
                    )}
                    <td>
                      <div className="appt-doctor-row">
                        <div className="appt-doctor-avatar">
                          {a.doctor?.name?.[0]?.toUpperCase() || "D"}
                        </div>
                        <div>
                          <div className="appt-cell-primary">{a.doctor?.name}</div>
                          <div>
                            <span className="appt-spec-chip">{a.doctor?.specialty}</span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="appt-date-cell">
                        <BsCalendarCheck />
                        {formatDateToDDMMYYYY(a.date)}
                      </div>
                    </td>
                    <td>
                      <div className="appt-date-cell">
                        <BsClock />
                        {formatTimeTo12Hour(a.time) || "—"}
                      </div>
                    </td>
                    <td>
                      <span className="appt-status-badge">
                        <span className="appt-status-dot" />
                        Scheduled
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        <div className="appt-pagination">
          <button
            className="appt-page-btn"
            disabled={page === 1}
            onClick={() => setPage(page - 1)}
          >
            <FaChevronLeft /> Prev
          </button>

          <span className="appt-page-info">
            Page {page} of {totalPages || 1}
          </span>

          <button
            className="appt-page-btn"
            disabled={page === totalPages || totalPages === 0}
            onClick={() => setPage(page + 1)}
          >
            Next <FaChevronRight />
          </button>
        </div>
      </div>

    </div>
  );
}
