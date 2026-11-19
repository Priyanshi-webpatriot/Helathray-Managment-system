import { useState, useMemo } from "react";
import {
  FaCalendarAlt,
  FaChevronLeft,
  FaChevronRight,
  FaClock,
  FaUserInjured,
  FaCheckCircle,
  FaPhoneAlt,
  FaCalendarDay,
  FaStethoscope,
  FaUserCircle
} from "react-icons/fa";
import { formatTimeTo12Hour } from "../utils/slotHelper";
import "../styles/doctorScheduleCalendar.css";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const WEEKDAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function DoctorScheduleCalendar({ appointments = [], doctorName = "", doctorTiming = "" }) {
  const today = useMemo(() => new Date(), []);
  const [currentDate, setCurrentDate] = useState(new Date());

  // Helper to extract YYYY-MM-DD
  const formatYMD = (dateObj) => {
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, "0");
    const d = String(dateObj.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  };

  const todayStr = formatYMD(today);
  const [selectedDateStr, setSelectedDateStr] = useState(todayStr);

  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();

  // Normalize appointment date to YYYY-MM-DD
  const getApptDateKey = (rawDate) => {
    if (!rawDate) return "";
    if (typeof rawDate === "string") return rawDate.split("T")[0];
    const d = new Date(rawDate);
    return formatYMD(d);
  };

  // Group appointments by date
  const appointmentsByDate = useMemo(() => {
    const map = {};
    appointments.forEach((appt) => {
      const key = getApptDateKey(appt.date);
      if (!key) return;
      if (!map[key]) map[key] = [];
      map[key].push(appt);
    });

    // Sort appointments on each date chronologically by time
    Object.keys(map).forEach((k) => {
      map[k].sort((a, b) => {
        const timeA = a.time || "";
        const timeB = b.time || "";
        return timeA.localeCompare(timeB);
      });
    });

    return map;
  }, [appointments]);

  // Appointments for the currently selected date
  const selectedDayAppointments = appointmentsByDate[selectedDateStr] || [];

  // Monthly stats
  const monthlyStats = useMemo(() => {
    let monthTotal = 0;
    let todayCount = appointmentsByDate[todayStr]?.length || 0;

    Object.keys(appointmentsByDate).forEach((dateKey) => {
      const [y, m] = dateKey.split("-").map(Number);
      if (y === currentYear && m === currentMonth + 1) {
        monthTotal += appointmentsByDate[dateKey].length;
      }
    });

    return { monthTotal, todayCount };
  }, [appointmentsByDate, currentYear, currentMonth, todayStr]);

  // Calendar Grid Calculations
  const calendarDays = useMemo(() => {
    const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay();
    const totalDaysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const totalDaysInPrevMonth = new Date(currentYear, currentMonth, 0).getDate();

    const days = [];

    // Leading days from previous month
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const dayNum = totalDaysInPrevMonth - i;
      const prevDate = new Date(currentYear, currentMonth - 1, dayNum);
      const key = formatYMD(prevDate);
      days.push({
        dayNumber: dayNum,
        dateKey: key,
        isCurrentMonth: false,
        appointments: appointmentsByDate[key] || []
      });
    }

    // Current month days
    for (let dayNum = 1; dayNum <= totalDaysInMonth; dayNum++) {
      const thisDate = new Date(currentYear, currentMonth, dayNum);
      const key = formatYMD(thisDate);
      days.push({
        dayNumber: dayNum,
        dateKey: key,
        isCurrentMonth: true,
        appointments: appointmentsByDate[key] || []
      });
    }

    // Trailing days for next month to complete the row
    const remainingCells = 7 - (days.length % 7);
    if (remainingCells < 7) {
      for (let nextDayNum = 1; nextDayNum <= remainingCells; nextDayNum++) {
        const nextDate = new Date(currentYear, currentMonth + 1, nextDayNum);
        const key = formatYMD(nextDate);
        days.push({
          dayNumber: nextDayNum,
          dateKey: key,
          isCurrentMonth: false,
          appointments: appointmentsByDate[key] || []
        });
      }
    }

    return days;
  }, [currentYear, currentMonth, appointmentsByDate]);

  // Month Navigation Handlers
  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentYear, currentMonth - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentYear, currentMonth + 1, 1));
  };

  const handleJumpToToday = () => {
    const now = new Date();
    setCurrentDate(new Date(now.getFullYear(), now.getMonth(), 1));
    setSelectedDateStr(formatYMD(now));
  };

  // Formatted date string for selected date
  const selectedDateFormatted = useMemo(() => {
    if (!selectedDateStr) return "";
    const [y, m, d] = selectedDateStr.split("-").map(Number);
    const dateObj = new Date(y, m - 1, d);
    return dateObj.toLocaleDateString("en-US", {
      weekday: "long",
      month: "short",
      day: "numeric",
      year: "numeric"
    });
  }, [selectedDateStr]);

  return (
    <div className="doctor-calendar-container">
      {/* ── TOP STATS BAR ── */}
      <div className="doc-cal-stats-bar">
        <div className="doc-cal-stat-item">
          <div className="doc-cal-stat-icon stat-icon-blue">
            <FaCalendarDay />
          </div>
          <div>
            <span className="doc-cal-stat-label">Today's Consultations</span>
            <strong className="doc-cal-stat-val">{monthlyStats.todayCount} Patients</strong>
          </div>
        </div>

        <div className="doc-cal-stat-item">
          <div className="doc-cal-stat-icon stat-icon-teal">
            <FaCalendarAlt />
          </div>
          <div>
            <span className="doc-cal-stat-label">This Month ({MONTH_NAMES[currentMonth]})</span>
            <strong className="doc-cal-stat-val">{monthlyStats.monthTotal} Appointments</strong>
          </div>
        </div>

        <div className="doc-cal-stat-item">
          <div className="doc-cal-stat-icon stat-icon-amber">
            <FaClock />
          </div>
          <div>
            <span className="doc-cal-stat-label">Active OPD Shift</span>
            <strong className="doc-cal-stat-val">{doctorTiming || "09:00 AM - 08:00 PM"}</strong>
          </div>
        </div>
      </div>

      {/* ── MAIN CALENDAR + AGENDA SPLIT ── */}
      <div className="doc-cal-main-layout">
        {/* LEFT COLUMN: MONTHLY INTERACTIVE CALENDAR */}
        <div className="doc-cal-left-panel">
          {/* Header with Navigation */}
          <div className="doc-cal-nav-header">
            <div className="doc-cal-month-title">
              <FaCalendarAlt style={{ color: "#0284c7" }} />
              <span>
                {MONTH_NAMES[currentMonth]} {currentYear}
              </span>
            </div>

            <div className="doc-cal-nav-controls">
              <button
                type="button"
                className="doc-cal-today-btn"
                onClick={handleJumpToToday}
                title="Jump to today"
              >
                Today
              </button>
              <button
                type="button"
                className="doc-cal-arrow-btn"
                onClick={handlePrevMonth}
                title="Previous Month"
              >
                <FaChevronLeft />
              </button>
              <button
                type="button"
                className="doc-cal-arrow-btn"
                onClick={handleNextMonth}
                title="Next Month"
              >
                <FaChevronRight />
              </button>
            </div>
          </div>

          {/* Weekday Labels */}
          <div className="doc-cal-weekdays-row">
            {WEEKDAY_NAMES.map((name) => (
              <div key={name} className="doc-cal-weekday-label">
                {name}
              </div>
            ))}
          </div>

          {/* Days Grid */}
          <div className="doc-cal-days-grid">
            {calendarDays.map((cell, idx) => {
              const isTodayCell = cell.dateKey === todayStr;
              const isSelectedCell = cell.dateKey === selectedDateStr;
              const apptCount = cell.appointments.length;
              const hasAppts = apptCount > 0;

              return (
                <div
                  key={idx}
                  className={`doc-cal-day-cell ${
                    cell.isCurrentMonth ? "in-month" : "out-of-month"
                  } ${isTodayCell ? "is-today" : ""} ${
                    isSelectedCell ? "is-selected" : ""
                  } ${hasAppts ? "has-appts" : ""}`}
                  onClick={() => setSelectedDateStr(cell.dateKey)}
                >
                  <div className="doc-cal-day-top">
                    <span className="doc-cal-day-num">{cell.dayNumber}</span>
                    {isTodayCell && <span className="doc-cal-today-dot" title="Today"></span>}
                  </div>

                  {hasAppts && (
                    <div className="doc-cal-badge-wrap">
                      <span className="doc-cal-appt-chip">
                        {apptCount} {apptCount === 1 ? "Appt" : "Appts"}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* RIGHT COLUMN: SELECTED DAY PATIENT QUEUE & AGENDA */}
        <div className="doc-cal-right-panel">
          <div className="doc-agenda-header">
            <div>
              <span className="doc-agenda-caption">OPD CLINICAL QUEUE</span>
              <h3 className="doc-agenda-date">{selectedDateFormatted}</h3>
            </div>
            <span
              className={`doc-agenda-count-badge ${
                selectedDayAppointments.length > 0 ? "active" : "empty"
              }`}
            >
              {selectedDayAppointments.length}{" "}
              {selectedDayAppointments.length === 1 ? "Patient" : "Patients"}
            </span>
          </div>

          <div className="doc-agenda-list">
            {selectedDayAppointments.length > 0 ? (
              selectedDayAppointments.map((appt, i) => {
                const patientName = appt.patient?.name || "Patient";
                const patientAge = appt.patient?.age ? `${appt.patient.age} yrs` : "";
                const patientGender = appt.patient?.gender || "";
                const patientMobile = appt.patient?.mobile || "";
                const formattedTime = formatTimeTo12Hour(appt.time);
                const initial = patientName.charAt(0).toUpperCase();

                return (
                  <div key={appt.id || i} className="doc-agenda-card">
                    <div className="doc-agenda-card-time">
                      <FaClock style={{ color: "#0284c7" }} />
                      <strong>{formattedTime || "Scheduled"}</strong>
                    </div>

                    <div className="doc-agenda-card-body">
                      <div className="doc-agenda-avatar">{initial}</div>
                      <div className="doc-agenda-info">
                        <div className="doc-agenda-patient-row">
                          <h4 className="doc-agenda-patient-name">{patientName}</h4>
                          <span className="doc-agenda-status-pill">
                            <FaCheckCircle /> Confirmed
                          </span>
                        </div>
                        <div className="doc-agenda-meta">
                          {patientGender && <span>{patientGender}</span>}
                          {patientAge && <span>• {patientAge}</span>}
                          {patientMobile && (
                            <span className="doc-agenda-phone">
                              • <FaPhoneAlt style={{ fontSize: "10px" }} /> {patientMobile}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="doc-agenda-empty">
                <div className="doc-agenda-empty-icon">
                  <FaCalendarDay />
                </div>
                <h4>No Consultations Scheduled</h4>
                <p>
                  There are no booked patient appointments for this date.
                  Upcoming slots remain open for patient bookings.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

