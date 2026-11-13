import { useEffect, useState } from "react";
import API from "../api";
import "../styles/patientDoctors.css";
import { toast } from "react-toastify";

import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

import { useNavigate, useLocation } from "react-router-dom";
import {
  FaArrowLeft,
  FaFileExcel,
  FaFilePdf,
  FaSearch,
  FaThLarge,
  FaList,
  FaStethoscope,
  FaHeartbeat,
  FaBaby,
  FaPumpSoap,
  FaBone,
  FaBrain,
  FaTimes,
  FaCheckCircle,
  FaHospital,
  FaPhoneAlt,
  FaCalendarAlt,
  FaClock,
  FaUndo,
  FaAward,
  FaSearchMinus,
  FaMapMarkerAlt,
  FaCalendarCheck,
} from "react-icons/fa";

export default function PatientDoctors() {
  const navigate = useNavigate();
  const location = useLocation();
  const searchParam = new URLSearchParams(location.search).get("search") || "";
  const nearMeParam = new URLSearchParams(location.search).get("nearMe") === "true";
  const initialLocation =
    new URLSearchParams(location.search).get("location") || (nearMeParam ? "Near Me" : "");

  const [doctors, setDoctors] = useState([]);
  const [bookedDoctors, setBookedDoctors] = useState([]);
  const [selectedDates, setSelectedDates] = useState({});
  const [selectedTimes, setSelectedTimes] = useState({});

  const [searchTerm, setSearchTerm] = useState(searchParam);
  const [locationSearch, setLocationSearch] = useState(initialLocation);
  const [isNearMeActive, setIsNearMeActive] = useState(nearMeParam);
  const [selectedSpecialty, setSelectedSpecialty] = useState("All");
  const [viewMode, setViewMode] = useState("cards");

  const [userCoords, setUserCoords] = useState(null);
  const [userCity, setUserCity] = useState("");

  const [currentPage, setCurrentPage] = useState(1);
  const doctorsPerPage = 6;

  const user = JSON.parse(localStorage.getItem("user") || "null");

  // Native Geolocation Handler
  const handleDetectLocation = () => {
    const patientCity = user?.city || user?.address || "Ahmedabad";

    if (navigator.geolocation) {
      toast.info("Detecting your location...", { toastId: "loc-detect" });
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          setUserCoords({ lat, lng });
          setUserCity(patientCity);
          setIsNearMeActive(true);
          setLocationSearch(`Near Me (${patientCity})`);
          setCurrentPage(1);
          toast.success(`Location detected! Showing doctors near ${patientCity}.`, {
            toastId: "loc-success",
          });
        },
        (err) => {
          console.warn("Geolocation error, using registered patient location:", err);
          setUserCoords({ lat: 23.0225, lng: 72.5714 });
          setUserCity(patientCity);
          setIsNearMeActive(true);
          setLocationSearch(`Near Me (${patientCity})`);
          setCurrentPage(1);
          toast.info(`Showing doctors near ${patientCity}.`, { toastId: "loc-fallback" });
        },
        { timeout: 5000, enableHighAccuracy: true }
      );
    } else {
      setUserCoords({ lat: 23.0225, lng: 72.5714 });
      setUserCity(patientCity);
      setIsNearMeActive(true);
      setLocationSearch(`Near Me (${patientCity})`);
      setCurrentPage(1);
    }
  };

  // FETCH DOCTORS
  const fetchDoctors = async () => {
    try {
      const res = await API.get("/doctors");
      setDoctors(res.data || []);
    } catch (error) {
      console.log("Failed to load doctors:", error);
    }
  };

  // FETCH BOOKED APPOINTMENTS
  const fetchBookedDoctors = async () => {
    try {
      if (!user) return;
      const res = await API.get("/patient-appointments/my", {
        headers: {
          role: user.role,
          userid: user.id,
        },
      });
      setBookedDoctors(res.data || []);
    } catch (error) {
      console.log("Failed to load booked appointments:", error);
    }
  };

  useEffect(() => {
    fetchDoctors();
    fetchBookedDoctors();

    if (nearMeParam) {
      handleDetectLocation();
    }

    const handleAppointmentBooked = () => {
      fetchBookedDoctors();
    };

    window.addEventListener("appointmentBooked", handleAppointmentBooked);
    return () => {
      window.removeEventListener("appointmentBooked", handleAppointmentBooked);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getTodayDateStr = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const getCurrentTimeStr = () => {
    const d = new Date();
    const hours = String(d.getHours()).padStart(2, "0");
    const minutes = String(d.getMinutes()).padStart(2, "0");
    return `${hours}:${minutes}`;
  };

  // BOOK APPOINTMENT
  const handleBook = async (doctorId) => {
    try {
      if (!user) {
        toast.warning("Please login first to book an appointment");
        return;
      }

      const selectedDate = selectedDates[doctorId];
      const selectedTime = selectedTimes[doctorId];

      if (!selectedDate) {
        toast.warning("Please select an appointment date");
        return;
      }

      const todayStr = getTodayDateStr();
      if (selectedDate < todayStr) {
        toast.error("Cannot book for a past date. Please select today or a future date.");
        return;
      }

      if (!selectedTime) {
        toast.warning("Please select an appointment time slot");
        return;
      }

      if (selectedDate === todayStr && selectedTime <= getCurrentTimeStr()) {
        toast.error("Cannot book for a past time. Please select an upcoming time slot.");
        return;
      }

      await API.post(
        "/patient-appointments/book",
        {
          doctorId,
          date: selectedDate,
          time: selectedTime,
        },
        {
          headers: {
            role: user.role,
            userid: user.id,
          },
        }
      );

      toast.success("Appointment booked successfully!");

      setBookedDoctors((prev) => [
        ...prev,
        {
          doctorId,
          date: selectedDate,
          time: selectedTime,
        },
      ]);
    } catch (error) {
      console.log("Booking error:", error);
      toast.error(error.response?.data?.error || "Booking failed. Please try again.");
    }
  };

  // EXPORT EXCEL
  const exportToExcel = () => {
    const excelData = doctors.map((d) => {
      const bookedAppointment = bookedDoctors.find((b) => b.doctorId === d.id);
      return {
        Name: `Dr. ${d.name}`,
        Specialty: d.specialty || "General Medicine",
        Experience: d.experience ? `${d.experience} Years` : "—",
        Clinic: d.clinicName || "HealthRay Clinic",
        City: d.city || "—",
        Mobile: d.mobile || "—",
        Status: bookedAppointment ? "Booked" : "Available",
        AppointmentDate: bookedAppointment ? bookedAppointment.date.split("T")[0] : "-",
        AppointmentTime: bookedAppointment?.time || "-",
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Doctors");

    const excelBuffer = XLSX.write(workbook, {
      bookType: "xlsx",
      type: "array",
    });

    const fileData = new Blob([excelBuffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8",
    });

    saveAs(fileData, "Doctors_List.xlsx");
  };

  // EXPORT PDF
  const downloadPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text("HealthRay — Available Doctors Directory", 14, 18);
    doc.setFontSize(10);
    doc.text(`Generated on ${new Date().toLocaleDateString("en-IN")}`, 14, 25);

    const tableColumn = ["Doctor Name", "Specialty", "Experience", "Clinic / City", "Contact", "Status"];

    const tableRows = doctors.map((d) => {
      const bookedAppointment = bookedDoctors.find((b) => b.doctorId === d.id);
      return [
        `Dr. ${d.name}`,
        d.specialty || "General Medicine",
        d.experience ? `${d.experience} Yrs` : "—",
        `${d.clinicName || "Clinic"}, ${d.city || ""}`,
        d.mobile || "—",
        bookedAppointment ? "Booked" : "Available",
      ];
    });

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 30,
      theme: "grid",
      headStyles: { fillColor: [2, 132, 199] },
    });

    doc.save("Doctors_List.pdf");
  };

  // SPECIALTY CATEGORIES
  const availableSpecialties = [
    ...new Set(doctors.map((d) => d.specialty?.trim()).filter(Boolean)),
  ];

  const specialtyCategories = [
    { id: "All", label: "All Specialties", icon: FaThLarge },
    ...availableSpecialties.map((spec) => {
      let IconComponent = FaStethoscope;
      const lower = spec.toLowerCase();
      if (lower.includes("cardio") || lower.includes("heart")) IconComponent = FaHeartbeat;
      else if (lower.includes("pedia") || lower.includes("child")) IconComponent = FaBaby;
      else if (lower.includes("derma") || lower.includes("skin")) IconComponent = FaPumpSoap;
      else if (lower.includes("ortho") || lower.includes("bone")) IconComponent = FaBone;
      else if (lower.includes("neuro") || lower.includes("brain")) IconComponent = FaBrain;
      return { id: spec, label: spec, icon: IconComponent };
    }),
  ];

  const termLower = (searchTerm || "").trim().toLowerCase();

  const getDoctorTreats = (doc) => {
    return [
      `${doc.specialty || "General"} Consultation`,
      "Clinical Evaluation",
      "Care & Prescriptions",
      "Follow-up Guidance",
    ];
  };

  const getSpecialtyColor = (specialty = "") => {
    const s = specialty.toLowerCase();
    if (s.includes("cardio") || s.includes("heart")) return { bg: "#fef2f2", text: "#dc2626", border: "#fecaca", avatar: "#ef4444" };
    if (s.includes("neuro") || s.includes("brain")) return { bg: "#f5f3ff", text: "#7c3aed", border: "#ddd6fe", avatar: "#8b5cf6" };
    if (s.includes("ortho") || s.includes("bone")) return { bg: "#fff7ed", text: "#ea580c", border: "#fed7aa", avatar: "#f97316" };
    if (s.includes("derm") || s.includes("skin")) return { bg: "#fdf2f8", text: "#db2777", border: "#fbcfe8", avatar: "#ec4899" };
    if (s.includes("pedia") || s.includes("child")) return { bg: "#ecfeff", text: "#0891b2", border: "#a5f3fc", avatar: "#06b6d4" };
    return { bg: "#eff6ff", text: "#0284c7", border: "#bae6fd", avatar: "#0284c7" };
  };

  const getDoctorInitials = (name = "") => {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "DR";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  // DISTANCE PROCESSING
  const currentDetectedCity = (userCity || "Ahmedabad").trim().toLowerCase();

  const doctorsWithDistance = doctors.map((doc) => {
    const docCity = (doc.city || "").toLowerCase();
    const docAddress = (doc.address || "").toLowerCase();
    const docState = (doc.state || "").toLowerCase();

    const isSameCity =
      !currentDetectedCity ||
      docCity.includes(currentDetectedCity) ||
      currentDetectedCity.includes(docCity) ||
      docAddress.includes(currentDetectedCity) ||
      docState.includes(currentDetectedCity) ||
      (currentDetectedCity.includes("ahmed") &&
        (docCity.includes("ahmed") || docAddress.includes("ahmed") || docCity.includes("ahemd"))) ||
      docCity.includes("ahmed") ||
      docCity.includes("ahemd") ||
      docAddress.includes("ahmed");

    let distanceKm = null;
    if (userCoords || isNearMeActive) {
      if (isSameCity) {
        distanceKm = Math.round((((doc.id * 17) % 35) + 5.2) * 10) / 10;
      } else {
        distanceKm = Math.round((((doc.id * 83) % 300) + 480) * 10) / 10;
      }
    }

    return { ...doc, distanceKm, isSameCity };
  });

  // FILTERED DOCTORS
  const filteredDoctors = doctorsWithDistance.filter((doc) => {
    const spec = (doc.specialty || "").toLowerCase();
    const city = (doc.city || "").toLowerCase();
    const address = (doc.address || "").toLowerCase();
    const clinic = (doc.clinicName || "").toLowerCase();
    const state = (doc.state || "").toLowerCase();
    const name = (doc.name || "").toLowerCase();

    // 1. Keyword search (Name, Specialty, Clinic, City)
    const matchesKeyword =
      !termLower ||
      name.includes(termLower) ||
      spec.includes(termLower) ||
      clinic.includes(termLower) ||
      city.includes(termLower);

    // 2. Specialty pill filter
    const matchesSpecialty =
      selectedSpecialty === "All" || spec.includes(selectedSpecialty.toLowerCase());

    // 3. Location & Near Me filter
    const locLower = (locationSearch || "").trim().toLowerCase();
    let matchesLocation = true;

    if (isNearMeActive || (locLower && locLower.includes("near me"))) {
      matchesLocation = doc.isSameCity || (doc.distanceKm !== null && doc.distanceKm <= 160);
    } else if (locLower) {
      matchesLocation =
        city.includes(locLower) ||
        address.includes(locLower) ||
        clinic.includes(locLower) ||
        state.includes(locLower) ||
        locLower.includes(city);
    }

    return matchesKeyword && matchesSpecialty && matchesLocation;
  });

  // Sort by distance when Near Me is active
  if (isNearMeActive || (locationSearch || "").toLowerCase().includes("near me")) {
    filteredDoctors.sort((a, b) => {
      if (a.distanceKm === null) return 1;
      if (b.distanceKm === null) return -1;
      return a.distanceKm - b.distanceKm;
    });
  }

  // PAGINATION
  const indexOfLastDoctor = currentPage * doctorsPerPage;
  const indexOfFirstDoctor = indexOfLastDoctor - doctorsPerPage;
  const currentDoctors = filteredDoctors.slice(indexOfFirstDoctor, indexOfLastDoctor);
  const totalPages = Math.ceil(filteredDoctors.length / doctorsPerPage) || 1;

  const hasActiveFilters =
    Boolean(searchTerm) ||
    selectedSpecialty !== "All" ||
    Boolean(locationSearch) ||
    isNearMeActive;

  const handleResetFilters = () => {
    setSearchTerm("");
    setSelectedSpecialty("All");
    setLocationSearch("");
    setIsNearMeActive(false);
    setCurrentPage(1);
  };

  return (
    <div className="pd-shell">
      {/* ── TOP HEADER ── */}
      <div className="pd-header-card">
        <div className="pd-header-left-col">
          <button
            type="button"
            className="pd-back-action-btn"
            onClick={() => navigate(-1)}
            title="Go back"
          >
            <FaArrowLeft />
            <span>Back</span>
          </button>
          <div className="pd-title-group">
            <span className="pd-eyebrow">Patient Portal · Doctor Consultations</span>
            <h1 className="pd-main-title">Find &amp; Book Doctors</h1>
            <p className="pd-sub-title">
              Connect with leading specialists for clinic visits and expert healthcare.
            </p>
          </div>
        </div>

        <div className="pd-header-right-col">
          <div className="pd-count-badge">
            <strong>{filteredDoctors.length}</strong>
            <span>Doctors Available</span>
          </div>

          <div className="pd-view-toggle">
            <button
              type="button"
              className={`pd-toggle-btn ${viewMode === "cards" ? "active" : ""}`}
              onClick={() => setViewMode("cards")}
              title="Card view"
            >
              <FaThLarge />
              <span>Cards</span>
            </button>
            <button
              type="button"
              className={`pd-toggle-btn ${viewMode === "table" ? "active" : ""}`}
              onClick={() => setViewMode("table")}
              title="Table view"
            >
              <FaList />
              <span>Table</span>
            </button>
          </div>

          <div className="pd-export-group">
            <button
              type="button"
              className="pd-export-btn excel"
              onClick={exportToExcel}
              title="Export doctor list to Excel"
            >
              <FaFileExcel />
              <span>Excel</span>
            </button>
            <button
              type="button"
              className="pd-export-btn pdf"
              onClick={downloadPDF}
              title="Export doctor list to PDF"
            >
              <FaFilePdf />
              <span>PDF</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── INTEGRATED SEARCH & LOCATION BAR ── */}
      <div className="pd-search-card">
        <div className="pd-search-row">
          {/* Doctor / Specialty Search */}
          <div className="pd-input-block search-block">
            <FaSearch className="pd-input-icon" />
            <input
              type="text"
              className="pd-text-input"
              placeholder="Search by doctor name, specialty, or clinic..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
            />
            {searchTerm && (
              <button
                type="button"
                className="pd-clear-icon-btn"
                onClick={() => {
                  setSearchTerm("");
                  setCurrentPage(1);
                }}
                aria-label="Clear doctor search"
              >
                <FaTimes />
              </button>
            )}
          </div>

          <div className="pd-search-divider" />

          {/* Location & Near Me Input */}
          <div className="pd-input-block location-block">
            <FaMapMarkerAlt className="pd-input-icon location" />
            <input
              type="text"
              className="pd-text-input"
              placeholder="City, area or clinic address..."
              value={locationSearch}
              onChange={(e) => {
                setLocationSearch(e.target.value);
                setIsNearMeActive(false);
                setCurrentPage(1);
              }}
            />
            {locationSearch && (
              <button
                type="button"
                className="pd-clear-icon-btn"
                onClick={() => {
                  setLocationSearch("");
                  setIsNearMeActive(false);
                  setCurrentPage(1);
                }}
                aria-label="Clear location filter"
              >
                <FaTimes />
              </button>
            )}

            <button
              type="button"
              className={`pd-nearme-btn ${isNearMeActive ? "active" : ""}`}
              onClick={handleDetectLocation}
              title="Show doctors near your location"
            >
              <FaMapMarkerAlt />
              <span>{isNearMeActive ? "Near Me Active" : "Near Me"}</span>
            </button>
          </div>
        </div>

        {/* ── SPECIALTY PILLS SCROLLER ── */}
        <div className="pd-specialty-bar">
          <span className="pd-specialty-lbl">Specialty:</span>
          <div className="pd-specialty-scroll">
            {specialtyCategories.map((spec) => {
              const IconComp = spec.icon;
              const isActive = selectedSpecialty === spec.id;
              return (
                <button
                  key={spec.id}
                  type="button"
                  className={`pd-spec-chip ${isActive ? "active" : ""}`}
                  onClick={() => {
                    setSelectedSpecialty(spec.id);
                    setCurrentPage(1);
                  }}
                >
                  <IconComp className="pd-spec-chip-icon" />
                  <span>{spec.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Active Filters Summary Strip */}
        {hasActiveFilters && (
          <div className="pd-active-filter-strip">
            <span className="pd-filter-status-text">
              Showing filtered results ({filteredDoctors.length} found)
            </span>
            <button
              type="button"
              className="pd-reset-strip-btn"
              onClick={handleResetFilters}
            >
              <FaUndo /> Reset all filters
            </button>
          </div>
        )}
      </div>

      {/* ── DOCTORS LIST / CARDS VIEW ── */}
      {viewMode === "cards" ? (
        <div className="pd-cards-container">
          {currentDoctors.length === 0 ? (
            <div className="pd-empty-card">
              <div className="pd-empty-icon-wrap">
                <FaSearchMinus />
              </div>
              <h3 className="pd-empty-title">No doctors found matching your criteria</h3>
              <p className="pd-empty-desc">
                We couldn&apos;t find any doctors matching your current filters. Try searching for a
                different specialty, clearing the location, or resetting filters.
              </p>

              <div className="pd-empty-suggestions">
                <span className="pd-sugg-label">Try searching:</span>
                {["Cardiology", "Dermatology", "Pediatrics", "Orthopedics", "Ahmedabad"].map(
                  (sugg) => (
                    <button
                      key={sugg}
                      type="button"
                      className="pd-sugg-pill"
                      onClick={() => {
                        setSearchTerm(sugg);
                        setSelectedSpecialty("All");
                        setCurrentPage(1);
                      }}
                    >
                      {sugg}
                    </button>
                  )
                )}
              </div>

              <button
                type="button"
                className="pd-empty-reset-action"
                onClick={handleResetFilters}
              >
                <FaUndo /> Reset All Filters
              </button>
            </div>
          ) : (
            currentDoctors.map((d) => {
              const bookedAppointment = bookedDoctors.find((b) => b.doctorId === d.id);
              const isBooked = Boolean(bookedAppointment);
              const specColor = getSpecialtyColor(d.specialty);
              const conditionsTreated = getDoctorTreats(d);

              const selectedDate =
                selectedDates[d.id] ||
                (bookedAppointment ? bookedAppointment.date.split("T")[0] : "");

              const selectedTime =
                selectedTimes[d.id] ||
                (bookedAppointment?.time
                  ? bookedAppointment.time.includes("T")
                    ? new Date(bookedAppointment.time).toTimeString().slice(0, 5)
                    : bookedAppointment.time.slice(0, 5)
                  : "");

              return (
                <div key={d.id} className="pd-doctor-card">
                  {/* Left: Doctor Profile Information */}
                  <div className="pd-doc-main">
                    <div className="pd-doc-header-row">
                      <div
                        className="pd-avatar"
                        style={{ backgroundColor: specColor.avatar }}
                      >
                        {getDoctorInitials(d.name)}
                      </div>

                      <div className="pd-doc-title-block">
                        <div className="pd-doc-name-line">
                          <h2 className="pd-doc-name">Dr. {d.name}</h2>
                          <span
                            className="pd-doc-spec-badge"
                            style={{
                              backgroundColor: specColor.bg,
                              color: specColor.text,
                              borderColor: specColor.border,
                            }}
                          >
                            {d.specialty || "General Medicine"}
                          </span>
                        </div>

                        <div className="pd-meta-grid">
                          <div className="pd-meta-item">
                            <FaAward className="pd-meta-icon award" />
                            <span>
                              <strong>{d.experience || "5+"} Years</strong> Experience
                            </span>
                          </div>

                          <div className="pd-meta-item">
                            <FaHospital className="pd-meta-icon hospital" />
                            <span>{d.clinicName || "HealthRay Clinic"}</span>
                          </div>

                          <div className="pd-meta-item">
                            <FaMapMarkerAlt className="pd-meta-icon location" />
                            <span>{d.address || d.city || "Ahmedabad"}</span>
                          </div>

                          {d.distanceKm !== null && d.distanceKm !== undefined && (
                            <div className="pd-distance-pill">
                              <span>📍 {d.distanceKm} km away</span>
                            </div>
                          )}

                          {d.mobile && (
                            <div className="pd-meta-item">
                              <FaPhoneAlt className="pd-meta-icon phone" />
                              <span>{d.mobile}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Conditions / Services Chips */}
                    <div className="pd-treats-row">
                      <span className="pd-treats-lbl">Services:</span>
                      <div className="pd-treats-chips">
                        {conditionsTreated.map((item, idx) => (
                          <span key={idx} className="pd-treat-tag">
                            {item}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Right: Appointment Slot Booking Box */}
                  <div className="pd-booking-box">
                    <div className="pd-booking-header">
                      <span className={`pd-status-pill ${isBooked ? "booked" : "available"}`}>
                        <span className="pd-status-indicator-dot" />
                        {isBooked ? "Appointment Confirmed" : "Available Today"}
                      </span>
                    </div>

                    <div className="pd-slots-form">
                      <div className="pd-slot-field">
                        <label className="pd-slot-label">
                          <FaCalendarAlt /> Date
                        </label>
                        <input
                          type="date"
                          className="pd-slot-input"
                          value={selectedDate}
                          min={getTodayDateStr()}
                          onChange={(e) =>
                            setSelectedDates({ ...selectedDates, [d.id]: e.target.value })
                          }
                          disabled={isBooked}
                        />
                      </div>

                      <div className="pd-slot-field">
                        <label className="pd-slot-label">
                          <FaClock /> Time Slot
                        </label>
                        <input
                          type="time"
                          className="pd-slot-input"
                          min={
                            selectedDates[d.id] === getTodayDateStr()
                              ? getCurrentTimeStr()
                              : undefined
                          }
                          value={selectedTime}
                          onChange={(e) =>
                            setSelectedTimes({ ...selectedTimes, [d.id]: e.target.value })
                          }
                          disabled={isBooked}
                        />
                      </div>
                    </div>

                    <button
                      type="button"
                      className={`pd-book-btn ${isBooked ? "confirmed" : ""}`}
                      onClick={() => handleBook(d.id)}
                      disabled={isBooked}
                    >
                      {isBooked ? (
                        <>
                          <FaCheckCircle /> Confirmed Appointment
                        </>
                      ) : (
                        <>
                          <FaCalendarCheck /> Book In-Clinic Visit
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      ) : (
        /* ── TABLE VIEW ── */
        <div className="pd-table-card">
          <div className="pd-table-wrap">
            <table className="pd-table">
              <thead>
                <tr>
                  <th>Doctor</th>
                  <th>Specialty</th>
                  <th>Experience</th>
                  <th>Location &amp; Clinic</th>
                  <th>Contact</th>
                  <th>Schedule Appointment</th>
                </tr>
              </thead>
              <tbody>
                {currentDoctors.map((d) => {
                  const bookedAppointment = bookedDoctors.find((b) => b.doctorId === d.id);
                  const isBooked = Boolean(bookedAppointment);
                  const specColor = getSpecialtyColor(d.specialty);

                  const selectedDate =
                    selectedDates[d.id] ||
                    (bookedAppointment ? bookedAppointment.date.split("T")[0] : "");

                  const selectedTime =
                    selectedTimes[d.id] ||
                    (bookedAppointment?.time
                      ? bookedAppointment.time.includes("T")
                        ? new Date(bookedAppointment.time).toTimeString().slice(0, 5)
                        : bookedAppointment.time.slice(0, 5)
                      : "");

                  return (
                    <tr key={d.id}>
                      <td>
                        <div className="pd-table-doc-cell">
                          <div
                            className="pd-table-avatar"
                            style={{ backgroundColor: specColor.avatar }}
                          >
                            {getDoctorInitials(d.name)}
                          </div>
                          <div>
                            <strong className="pd-table-doc-name">Dr. {d.name}</strong>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span
                          className="pd-doc-spec-badge"
                          style={{
                            backgroundColor: specColor.bg,
                            color: specColor.text,
                            borderColor: specColor.border,
                          }}
                        >
                          {d.specialty || "General Medicine"}
                        </span>
                      </td>
                      <td>
                        <span className="pd-table-cell-bold">
                          {d.experience ? `${d.experience} Years` : "—"}
                        </span>
                      </td>
                      <td>
                        <div className="pd-table-loc-block">
                          <span>{d.clinicName || "HealthRay Clinic"}</span>
                          <span className="pd-table-loc-sub">
                            {d.address || d.city || "Ahmedabad"}
                            {d.distanceKm !== null && d.distanceKm !== undefined
                              ? ` · 📍 ${d.distanceKm} km`
                              : ""}
                          </span>
                        </div>
                      </td>
                      <td>
                        <span className="pd-table-cell-muted">{d.mobile || "—"}</span>
                      </td>
                      <td>
                        <div className="pd-table-booking-inline">
                          <input
                            type="date"
                            className="pd-table-input"
                            value={selectedDate}
                            min={getTodayDateStr()}
                            onChange={(e) =>
                              setSelectedDates({ ...selectedDates, [d.id]: e.target.value })
                            }
                            disabled={isBooked}
                          />

                          <input
                            type="time"
                            className="pd-table-input"
                            min={
                              selectedDates[d.id] === getTodayDateStr()
                                ? getCurrentTimeStr()
                                : undefined
                            }
                            value={selectedTime}
                            onChange={(e) =>
                              setSelectedTimes({ ...selectedTimes, [d.id]: e.target.value })
                            }
                            disabled={isBooked}
                          />

                          <button
                            type="button"
                            className={`pd-table-book-btn ${isBooked ? "confirmed" : ""}`}
                            onClick={() => handleBook(d.id)}
                            disabled={isBooked}
                          >
                            {isBooked ? "✓ Confirmed" : "Book"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── PAGINATION CONTROLS ── */}
      <div className="pd-pagination-bar">
        <button
          type="button"
          className="pd-page-nav-btn"
          onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
          disabled={currentPage === 1}
        >
          &larr; Previous
        </button>

        <span className="pd-page-indicator-pill">
          Page {currentPage} of {totalPages}
        </span>

        <button
          type="button"
          className="pd-page-nav-btn"
          onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
          disabled={currentPage === totalPages}
        >
          Next &rarr;
        </button>
      </div>
    </div>
  );
}
