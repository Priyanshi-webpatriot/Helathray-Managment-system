import { useEffect, useState, useRef } from "react";
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
  FaChevronLeft,
  FaChevronRight,
  FaChevronDown,
  FaChevronUp,
  FaEye,
  FaLungs,
  FaTooth,
  FaUserMd,
  FaFilter,
  FaHandsWash,
} from "react-icons/fa";
import {
  generateDoctorSlots,
  isSlotPastForToday,
  formatTimeTo12Hour,
  formatDateToDDMMYYYY,
} from "../utils/slotHelper";
import {
  calculateHaversineDistance,
  resolveDoctorCoordinatesDynamic,
  geocodeAddressDynamic,
  detectLiveUserCity,
} from "../utils/geoHelper";

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

  const [modalDoctor, setModalDoctor] = useState(null);
  const [modalDate, setModalDate] = useState("");
  const [modalTime, setModalTime] = useState("");
  const [modalBookedSlots, setModalBookedSlots] = useState([]);
  const [loadingModalSlots, setLoadingModalSlots] = useState(false);
  const [isSubmittingModal, setIsSubmittingModal] = useState(false);

  useEffect(() => {
    if (!modalDoctor || !modalDate) {
      setModalBookedSlots([]);
      return;
    }
    let isCancelled = false;
    setLoadingModalSlots(true);
    API.get(`/patient-appointments/booked-slots?doctorId=${modalDoctor.id}&date=${modalDate}`)
      .then((res) => {
        if (!isCancelled) {
          setModalBookedSlots(res.data?.bookedSlots || []);
        }
      })
      .catch((err) => {
        console.error("Failed to load doctor slots", err);
        if (!isCancelled) setModalBookedSlots([]);
      })
      .finally(() => {
        if (!isCancelled) setLoadingModalSlots(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [modalDoctor, modalDate]);

  const [searchTerm, setSearchTerm] = useState(searchParam);
  const [locationSearch, setLocationSearch] = useState(initialLocation);
  const [isNearMeActive, setIsNearMeActive] = useState(nearMeParam);
  const [selectedSpecialty, setSelectedSpecialty] = useState("All");
  const [isSpecialtiesExpanded, setIsSpecialtiesExpanded] = useState(false);
  const specialtyScrollRef = useRef(null);

  const scrollSpecialties = (direction) => {
    if (specialtyScrollRef.current) {
      specialtyScrollRef.current.scrollBy({
        left: direction === "left" ? -280 : 280,
        behavior: "smooth",
      });
    }
  };
  const [viewMode, setViewMode] = useState("cards");

  const [userCoords, setUserCoords] = useState(null);
  const [userCity, setUserCity] = useState("");
  const [doctorCoordsMap, setDoctorCoordsMap] = useState({});

  const [currentPage, setCurrentPage] = useState(1);
  const doctorsPerPage = 6;

  const user = JSON.parse(localStorage.getItem("user") || "null");

  // Native Geolocation & Real Dynamic Reverse-Geocoding Handler (Universal worldwide)
  const handleDetectLocation = async () => {
    // If Near Me is already active, clicking again toggles it off
    if (isNearMeActive) {
      setIsNearMeActive(false);
      setLocationSearch("");
      setUserCoords(null);
      setUserCity("");
      toast.info("Near Me filter disabled.");
      return;
    }

    const fallbackCity = user?.city || user?.address || "";

    if (!navigator.geolocation) {
      toast.warn("Geolocation not supported by this browser." + (fallbackCity ? ` Using: ${fallbackCity}` : ""));
      if (fallbackCity) {
        setUserCity(fallbackCity);
        setIsNearMeActive(true);
        setLocationSearch(`Near Me (${fallbackCity})`);
      }
      return;
    }

    toast.info("Accessing live GPS location...", { toastId: "loc-detect" });
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setUserCoords({ lat, lng });

        // Real dynamic reverse-geocoding of patient GPS coordinates worldwide
        const geoResult = await detectLiveUserCity(lat, lng);
        const detectedLocation = geoResult?.city || geoResult?.state || fallbackCity || "Your Location";

        setUserCity(detectedLocation);
        setIsNearMeActive(true);
        setLocationSearch(`Near Me (${detectedLocation})`);
        setCurrentPage(1);

        toast.success(`Location detected: ${detectedLocation}! Showing nearest doctors first.`, {
          toastId: "loc-success",
        });
      },
      async (err) => {
        console.warn("Geolocation permission denied or unavailable, trying profile location:", err);
        if (fallbackCity) {
          const fallbackGeo = await geocodeAddressDynamic(fallbackCity);
          if (fallbackGeo) {
            setUserCoords({ lat: fallbackGeo.lat, lng: fallbackGeo.lng });
          }
          setUserCity(fallbackCity);
          setIsNearMeActive(true);
          setLocationSearch(`Near Me (${fallbackCity})`);
          toast.info(`Using your profile city (${fallbackCity}) for distance.`, { toastId: "loc-fallback" });
        } else {
          toast.error("Please allow location access to find doctors near you.");
        }
      },
      { timeout: 8000, enableHighAccuracy: true }
    );
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

  // Dynamically resolve GPS coordinates for every doctor worldwide (Canada, UK, Europe, India, US, etc.)
  useEffect(() => {
    if (!doctors || doctors.length === 0) return;
    let isCancelled = false;

    const resolveCoords = async () => {
      const updatedMap = { ...doctorCoordsMap };
      let hasNew = false;

      await Promise.all(
        doctors.map(async (doc) => {
          if (!doc.id || updatedMap[doc.id]) return;
          const geo = await resolveDoctorCoordinatesDynamic(doc);
          if (geo && !isCancelled) {
            updatedMap[doc.id] = geo;
            hasNew = true;
          }
        })
      );

      if (hasNew && !isCancelled) {
        setDoctorCoordsMap(updatedMap);
      }
    };

    resolveCoords();

    return () => {
      isCancelled = true;
    };
  }, [doctors]);

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

  // Returns an active upcoming appointment with this doctor (today upcoming or future)
  const getActiveDoctorBooking = (doctorId) => {
    const todayStr = getTodayDateStr();
    const upcoming = bookedDoctors
      .filter((b) => {
        if (b.doctorId !== doctorId) return false;
        const apptDate = (b.date || "").split("T")[0];
        if (apptDate > todayStr) return true;
        if (apptDate === todayStr) {
          return !isSlotPastForToday(apptDate, b.time);
        }
        return false;
      })
      .sort((a, b) => (a.date || "").localeCompare(b.date || ""));
    return upcoming[0] || null;
  };

  // Returns the most recent past completed appointment with this doctor
  const getPastDoctorBooking = (doctorId) => {
    const todayStr = getTodayDateStr();
    const past = bookedDoctors
      .filter((b) => {
        if (b.doctorId !== doctorId) return false;
        const apptDate = (b.date || "").split("T")[0];
        if (apptDate < todayStr) return true;
        if (apptDate === todayStr) {
          return isSlotPastForToday(apptDate, b.time);
        }
        return false;
      })
      .sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    return past[0] || null;
  };

  // BOOK APPOINTMENT
  const handleBook = async (doctorId, customDate, customTime) => {
    try {
      if (!user) {
        toast.warning("Please login first to book an appointment");
        return false;
      }

      const selectedDate = customDate || selectedDates[doctorId];
      const selectedTime = customTime || selectedTimes[doctorId];

      if (!selectedDate) {
        toast.warning("Please select an appointment date");
        return false;
      }

      const todayStr = getTodayDateStr();
      if (selectedDate < todayStr) {
        toast.error("Cannot book for a past date. Please select today or a future date.");
        return false;
      }

      if (!selectedTime) {
        toast.warning("Please select an appointment time slot");
        return false;
      }

      if (selectedDate === todayStr && selectedTime <= getCurrentTimeStr()) {
        toast.error("Cannot book for a past time. Please select an upcoming time slot.");
        return false;
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

      setSelectedDates((prev) => ({ ...prev, [doctorId]: selectedDate }));
      setSelectedTimes((prev) => ({ ...prev, [doctorId]: selectedTime }));

      setBookedDoctors((prev) => [
        ...prev,
        {
          doctorId,
          date: selectedDate,
          time: selectedTime,
        },
      ]);
      return true;
    } catch (error) {
      console.log("Booking error:", error);
      toast.error(error.response?.data?.error || "Booking failed. Please try again.");
      return false;
    }
  };

  const openBookingModal = (doctor) => {
    setModalDoctor(doctor);
    const initialDate = selectedDates[doctor.id] || "";
    setModalDate(initialDate);
    setModalTime("");
  };

  const handleModalConfirm = async () => {
    if (!modalDoctor) return;
    setIsSubmittingModal(true);
    const success = await handleBook(modalDoctor.id, modalDate, modalTime);
    setIsSubmittingModal(false);
    if (success) {
      setModalDoctor(null);
    }
  };

  // EXPORT EXCEL
  const exportToExcel = () => {
    const excelData = doctors.map((d) => {
      const activeAppointment = getActiveDoctorBooking(d.id);
      const pastAppointment = getPastDoctorBooking(d.id);
      return {
        Name: `Dr. ${d.name}`,
        Specialty: d.specialty || "General Medicine",
        Experience: d.experience ? `${d.experience} Years` : "—",
        Clinic: d.clinicName || "CareScribe Clinic",
        City: d.city || "—",
        Mobile: d.mobile || "—",
        Status: activeAppointment ? "Booked" : "Available",
        AppointmentDate: activeAppointment
          ? activeAppointment.date.split("T")[0]
          : pastAppointment
          ? `Past: ${pastAppointment.date.split("T")[0]}`
          : "-",
        AppointmentTime: activeAppointment?.time || "-",
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
    doc.text("CareScribe — Available Doctors Directory", 14, 18);
    doc.setFontSize(10);
    doc.text(`Generated on ${new Date().toLocaleDateString("en-IN")}`, 14, 25);

    const tableColumn = ["Doctor Name", "Specialty", "Experience", "Clinic / City", "Contact", "Status"];

    const tableRows = doctors.map((d) => {
      const activeAppointment = getActiveDoctorBooking(d.id);
      return [
        `Dr. ${d.name}`,
        d.specialty || "General Medicine",
        d.experience ? `${d.experience} Yrs` : "—",
        `${d.clinicName || "Clinic"}, ${d.city || ""}`,
        d.mobile || "—",
        activeAppointment ? "Booked" : "Available",
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

  // DYNAMIC SPECIALTY EXTRACTION FROM DATABASE DOCTORS
  const specialtyMap = new Map();
  doctors.forEach((d) => {
    const raw = (d.specialty || "").trim();
    if (!raw) return;
    const key = raw.toLowerCase();
    if (!specialtyMap.has(key)) {
      // Capitalize first letter of each word for clean display (e.g. "pediatric" -> "Pediatric")
      const label = raw
        .split(/\s+/)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(" ");
      specialtyMap.set(key, { raw, label, count: 0 });
    }
    specialtyMap.get(key).count += 1;
  });

  const getSpecialtyIcon = (specKey = "") => {
    const lower = specKey.toLowerCase();
    if (lower.includes("cardio") || lower.includes("heart")) return FaHeartbeat;
    if (lower.includes("pedia") || lower.includes("child")) return FaBaby;
    if (lower.includes("derma") || lower.includes("skin")) return FaPumpSoap;
    if (lower.includes("ortho") || lower.includes("bone")) return FaBone;
    if (lower.includes("neuro") || lower.includes("brain")) return FaBrain;
    if (lower.includes("ophthalm") || lower.includes("eye")) return FaEye;
    if (lower.includes("pulmon") || lower.includes("lung") || lower.includes("respir")) return FaLungs;
    if (lower.includes("dent") || lower.includes("tooth") || lower.includes("teeth")) return FaTooth;
    if (lower.includes("rheumat") || lower.includes("joint")) return FaHandsWash;
    if (lower.includes("general") || lower.includes("physician") || lower.includes("medicine")) return FaUserMd;
    return FaStethoscope;
  };

  const sortedSpecialties = Array.from(specialtyMap.entries())
    .map(([key, data]) => ({
      id: data.raw,
      label: data.label,
      icon: getSpecialtyIcon(key),
      count: data.count,
    }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

  const specialtyCategories = [
    {
      id: "All",
      label: "All Specialties",
      icon: FaThLarge,
      count: doctors.length,
    },
    ...sortedSpecialties,
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

  const makeGoogleCalendarUrl = (doc, bookedDate, bookedTime) => {
    const title = `Doctor Appointment - Dr. ${doc.name} (${doc.specialty || "General Medicine"})`;
    const location = `${doc.clinicName || "CareScribe Clinic"}, ${doc.address || doc.city || "Ahmedabad"}`;
    const details = `Medical Consultation with Dr. ${doc.name}.\nSpecialty: ${doc.specialty || "General Medicine"}\nClinic: ${location}\nScheduled Time: ${bookedTime || "Scheduled Time"}`;

    const dateStr = (bookedDate || "").split("T")[0];
    const [year, month, day] = (dateStr || "2026-01-01").split("-").map(Number);

    let hours = 10;
    let minutes = 0;
    if (bookedTime) {
      const parts = bookedTime.split(":");
      if (parts.length >= 2) {
        hours = parseInt(parts[0], 10) || 10;
        minutes = parseInt(parts[1], 10) || 0;
      }
    }

    const start = new Date(year, month - 1, day, hours, minutes);
    const end = new Date(start.getTime() + 30 * 60 * 1000);
    const formatUtc = (d) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

    const params = new URLSearchParams({
      action: "TEMPLATE",
      text: title,
      dates: `${formatUtc(start)}/${formatUtc(end)}`,
      details: details,
      location: location,
    });

    return `https://calendar.google.com/calendar/render?${params.toString()}`;
  };

  // REAL DISTANCE PROCESSING USING UNIVERSAL HAVERSINE FORMULA
  const activeUserCoords = userCoords;
  const currentDetectedCity = (userCity || "").trim().toLowerCase();

  const doctorsWithDistance = doctors.map((doc) => {
    const docGeo = doctorCoordsMap[doc.id];
    const docCity = (doc.city || "").toLowerCase();
    const docAddress = (doc.address || "").toLowerCase();

    // Check if in same city / locality dynamically
    const isSameCity =
      Boolean(currentDetectedCity) &&
      (docCity.includes(currentDetectedCity) ||
        currentDetectedCity.includes(docCity) ||
        docAddress.includes(currentDetectedCity));

    let distanceKm = null;
    if (activeUserCoords && docGeo) {
      distanceKm = calculateHaversineDistance(
        activeUserCoords.lat,
        activeUserCoords.lng,
        docGeo.lat,
        docGeo.lng
      );
    }

    return {
      ...doc,
      distanceKm,
      isSameCity,
      docLat: docGeo?.lat,
      docLng: docGeo?.lng,
    };
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
      selectedSpecialty === "All" ||
      spec === selectedSpecialty.toLowerCase() ||
      spec.includes(selectedSpecialty.toLowerCase());

    // 3. Location & Near Me filter
    const locLower = (locationSearch || "").trim().toLowerCase();
    let matchesLocation = true;

    if (isNearMeActive || (locLower && locLower.includes("near me"))) {
      // In Near Me mode, all doctors are shown sorted strictly by distance ascending!
      matchesLocation = true;
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

  // Sort by distance when Near Me is active (lowest distance first)
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
    setUserCoords(null);
    setUserCity("");
    setCurrentPage(1);
  };

  return (
    <div className="pd-shell">
      {/* ── BREADCRUMB / BACK ── */}
      <div className="pd-nav-bar">
        <button
          type="button"
          className="pd-back-action-btn"
          onClick={() => navigate(-1)}
          title="Go back"
        >
          <FaArrowLeft />
          <span>Back</span>
        </button>
      </div>

      {/* ── HEADER BANNER ── */}
      <div className="pd-header-card">
        <div className="pd-title-group">
          <span className="pd-eyebrow">Patient Portal · Doctor Consultations</span>
          <h1 className="pd-main-title">Find &amp; Book Doctors</h1>
          <p className="pd-sub-title">
            Connect with leading specialists for clinic visits and expert healthcare.
          </p>
        </div>

        <div className="pd-header-right-col">
          <div className="pd-count-badge">
            <span className="pd-count-dot" />
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
                  setUserCoords(null);
                  setUserCity("");
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
        <div className={`pd-specialty-bar ${isSpecialtiesExpanded ? "expanded" : ""}`}>
          <div className="pd-specialty-header">
            <span className="pd-specialty-lbl">
              <FaStethoscope className="pd-spec-lbl-icon" />
              Specialty
            </span>
          </div>

          <div className="pd-specialty-scroll-wrapper">
            {!isSpecialtiesExpanded && specialtyCategories.length > 5 && (
              <button
                type="button"
                className="pd-scroll-arrow-btn left"
                onClick={() => scrollSpecialties("left")}
                title="Scroll left"
                aria-label="Scroll left"
              >
                <FaChevronLeft />
              </button>
            )}

            <div
              ref={specialtyScrollRef}
              className={`pd-specialty-scroll ${isSpecialtiesExpanded ? "expanded" : ""}`}
            >
              {specialtyCategories.map((spec) => {
                const IconComp = spec.icon;
                const isActive =
                  selectedSpecialty.toLowerCase() === spec.id.toLowerCase() ||
                  (spec.id === "All" && selectedSpecialty === "All");
                return (
                  <button
                    key={spec.id}
                    type="button"
                    className={`pd-spec-chip ${isActive ? "active" : ""}`}
                    onClick={() => {
                      setSelectedSpecialty(isActive && spec.id !== "All" ? "All" : spec.id);
                      setCurrentPage(1);
                    }}
                    title={`Filter by ${spec.label} (${spec.count} doctor${spec.count === 1 ? "" : "s"})`}
                  >
                    <IconComp className="pd-spec-chip-icon" />
                    <span className="pd-spec-chip-label">{spec.label}</span>
                    <span className="pd-spec-chip-badge">{spec.count}</span>
                  </button>
                );
              })}
            </div>

            {!isSpecialtiesExpanded && specialtyCategories.length > 5 && (
              <button
                type="button"
                className="pd-scroll-arrow-btn right"
                onClick={() => scrollSpecialties("right")}
                title="Scroll right"
                aria-label="Scroll right"
              >
                <FaChevronRight />
              </button>
            )}
          </div>

          {specialtyCategories.length > 6 && (
            <button
              type="button"
              className={`pd-expand-specialties-btn ${isSpecialtiesExpanded ? "active" : ""}`}
              onClick={() => setIsSpecialtiesExpanded(!isSpecialtiesExpanded)}
              title={isSpecialtiesExpanded ? "Collapse to single row" : "View all specialties in grid"}
            >
              <span>{isSpecialtiesExpanded ? "Show Less" : `View All (${specialtyCategories.length - 1})`}</span>
              {isSpecialtiesExpanded ? <FaChevronUp /> : <FaChevronDown />}
            </button>
          )}
        </div>

        {/* Active Filters Summary Strip */}
        {hasActiveFilters && (
          <div className="pd-active-filter-strip">
            <div className="pd-filter-strip-left">
              <span className="pd-filter-pill-tag">
                <FaFilter /> Filter Active
              </span>
              <span className="pd-filter-status-text">
                Showing <strong>{filteredDoctors.length}</strong> of <strong>{doctors.length}</strong> doctors
              </span>
              {selectedSpecialty !== "All" && (
                <span className="pd-applied-badge">
                  Specialty: <strong>{selectedSpecialty}</strong>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedSpecialty("All");
                      setCurrentPage(1);
                    }}
                    className="pd-applied-remove"
                    title="Remove specialty filter"
                  >
                    <FaTimes />
                  </button>
                </span>
              )}
              {searchTerm && (
                <span className="pd-applied-badge">
                  Search: <strong>{searchTerm}</strong>
                  <button
                    type="button"
                    onClick={() => {
                      setSearchTerm("");
                      setCurrentPage(1);
                    }}
                    className="pd-applied-remove"
                    title="Clear search query"
                  >
                    <FaTimes />
                  </button>
                </span>
              )}
              {locationSearch && (
                <span className="pd-applied-badge">
                  Location: <strong>{locationSearch}</strong>
                  <button
                    type="button"
                    onClick={() => {
                      setLocationSearch("");
                      setCurrentPage(1);
                    }}
                    className="pd-applied-remove"
                    title="Clear location"
                  >
                    <FaTimes />
                  </button>
                </span>
              )}
              {isNearMeActive && (
                <span className="pd-applied-badge">
                  <strong>Near Me</strong>
                  <button
                    type="button"
                    onClick={() => {
                      setIsNearMeActive(false);
                      setUserCoords(null);
                      setUserCity("");
                      setLocationSearch("");
                    }}
                    className="pd-applied-remove"
                    title="Disable near me"
                  >
                    <FaTimes />
                  </button>
                </span>
              )}
            </div>
            <button
              type="button"
              className="pd-reset-strip-btn"
              onClick={handleResetFilters}
            >
              <FaUndo /> Reset all
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
              const activeAppointment = getActiveDoctorBooking(d.id);
              const pastAppointment = !activeAppointment ? getPastDoctorBooking(d.id) : null;
              const isDoctorBooked = Boolean(activeAppointment);
              const specColor = getSpecialtyColor(d.specialty);
              const conditionsTreated = getDoctorTreats(d);

              const selectedDate =
                selectedDates[d.id] ||
                (activeAppointment ? activeAppointment.date.split("T")[0] : "");

              const selectedTime =
                selectedTimes[d.id] ||
                (activeAppointment?.time
                  ? activeAppointment.time.includes("T")
                    ? new Date(activeAppointment.time).toTimeString().slice(0, 5)
                    : activeAppointment.time.slice(0, 5)
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
                            <span>{d.clinicName || "CareScribe Clinic"}</span>
                          </div>

                          <div className="pd-meta-item">
                            <FaMapMarkerAlt className="pd-meta-icon location" />
                            <span>{d.address || d.city || "Ahmedabad"}</span>
                          </div>

                          {d.distanceKm !== null && d.distanceKm !== undefined && (
                            <div className={`pd-distance-pill ${d.distanceKm <= 50 ? "near" : "far"}`}>
                              <span>
                                <FaMapMarkerAlt style={{ marginRight: 4 }} />
                                {d.distanceKm < 1 ? "< 1 km away" : `${d.distanceKm} km away`}
                                {d.distanceKm <= 35 ? " · Nearby" : ""}
                              </span>
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
                      <span className={`pd-status-pill ${isDoctorBooked ? "booked" : "available"}`}>
                        <span className="pd-status-indicator-dot" />
                        {isDoctorBooked ? "Upcoming Confirmed" : "Available Today"}
                      </span>
                      {!isDoctorBooked && pastAppointment && (
                        <span
                          className="pd-past-visit-tag"
                          style={{
                            fontSize: "11px",
                            color: "#64748b",
                            fontWeight: "600",
                            background: "#f1f5f9",
                            padding: "2px 8px",
                            borderRadius: "6px",
                          }}
                        >
                          Last Visit: {formatDateToDDMMYYYY(pastAppointment.date)}
                        </span>
                      )}
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
                          disabled={isDoctorBooked}
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
                          disabled={isDoctorBooked}
                        />
                      </div>
                    </div>

                    <button
                      type="button"
                      className={`pd-book-btn ${isDoctorBooked ? "confirmed" : ""}`}
                      onClick={() => handleBook(d.id)}
                      disabled={isDoctorBooked}
                    >
                      {isDoctorBooked ? (
                        <>
                          <FaCheckCircle /> Confirmed Appointment
                        </>
                      ) : (
                        <>
                          <FaCalendarCheck /> Book In-Clinic Visit
                        </>
                      )}
                    </button>

                    {isDoctorBooked && (
                      <>
                        <a
                          href={makeGoogleCalendarUrl(d, selectedDate, selectedTime)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="pd-cal-link-btn"
                          title="Add to Google Calendar for phone alerts"
                        >
                          <FaCalendarAlt /> Add to Google Calendar
                        </a>
                        <button
                          type="button"
                          className="pd-book-another-btn"
                          style={{
                            marginTop: "8px",
                            background: "transparent",
                            border: "none",
                            color: "#0284c7",
                            fontSize: "12px",
                            fontWeight: "750",
                            cursor: "pointer",
                            textAlign: "center",
                          }}
                          onClick={() => openBookingModal(d)}
                        >
                          + Book Another Appointment
                        </button>
                      </>
                    )}
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
                  <th style={{ textAlign: "right", paddingRight: "24px" }}>Schedule Appointment</th>
                </tr>
              </thead>
              <tbody>
                {currentDoctors.map((d) => {
                  const activeAppointment = getActiveDoctorBooking(d.id);
                  const pastAppointment = !activeAppointment ? getPastDoctorBooking(d.id) : null;
                  const isDoctorBooked = Boolean(activeAppointment);
                  const specColor = getSpecialtyColor(d.specialty);

                  const selectedDate =
                    selectedDates[d.id] ||
                    (activeAppointment ? activeAppointment.date.split("T")[0] : "");

                  const selectedTime =
                    selectedTimes[d.id] ||
                    (activeAppointment?.time
                      ? activeAppointment.time.includes("T")
                        ? new Date(activeAppointment.time).toTimeString().slice(0, 5)
                        : activeAppointment.time.slice(0, 5)
                      : "");

                  return (
                    <tr key={d.id} className={isDoctorBooked ? "row-booked" : ""}>
                      <td>
                        <div className="pd-table-doc-cell">
                          <div
                            className="pd-table-avatar"
                            style={{ backgroundColor: specColor.avatar }}
                          >
                            {getDoctorInitials(d.name)}
                          </div>
                          <div className="pd-table-doc-meta">
                            <strong className="pd-table-doc-name">Dr. {d.name}</strong>
                            <span className="pd-table-doc-sub">
                              <span className="pulse-dot-tiny"></span> Verified Doctor
                            </span>
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
                        <div className="pd-table-exp-pill">
                          {d.experience ? `${d.experience} Years` : "3+ Years"}
                        </div>
                      </td>
                      <td>
                        <div className="pd-table-loc-block">
                          <strong className="pd-table-clinic-name">{d.clinicName || "CareScribe Clinic"}</strong>
                          <span className="pd-table-loc-sub">
                            <FaMapMarkerAlt className="loc-pin-icon" />
                            {d.address || d.city || "Ahmedabad"}
                            {d.distanceKm !== null && d.distanceKm !== undefined
                              ? ` · ${d.distanceKm < 1 ? "< 1 km away" : `${d.distanceKm} km away`}${d.distanceKm <= 35 ? " (Nearby)" : ""}`
                              : ""}
                          </span>
                        </div>
                      </td>
                      <td>
                        <div className="pd-table-contact-cell">
                          <FaPhoneAlt className="contact-icon" />
                          <span>{d.mobile || "—"}</span>
                        </div>
                      </td>
                      <td>
                        <div className="pd-table-action-cell">
                          {isDoctorBooked ? (
                            <div className="pd-table-booked-group">
                              <span className="pd-table-confirmed-tag">
                                <FaCheckCircle /> Confirmed
                              </span>
                              <span className="pd-table-slot-text">
                                {selectedDate} · {formatTimeTo12Hour(selectedTime)}
                              </span>
                              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                <a
                                  href={makeGoogleCalendarUrl(d, selectedDate, selectedTime)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="pd-table-gcal-link"
                                  title="Add to Google Calendar"
                                >
                                  <FaCalendarAlt /> Sync
                                </a>
                                <button
                                  type="button"
                                  style={{
                                    background: "#e0f2fe",
                                    border: "none",
                                    color: "#0284c7",
                                    fontSize: "11px",
                                    fontWeight: "750",
                                    padding: "3px 8px",
                                    borderRadius: "6px",
                                    cursor: "pointer",
                                  }}
                                  onClick={() => openBookingModal(d)}
                                  title="Book another appointment on a different date"
                                >
                                  + Book
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              type="button"
                              className="pd-table-book-action-btn"
                              onClick={() => openBookingModal(d)}
                            >
                              <FaCalendarCheck /> Book Appointment
                            </button>
                          )}
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

      {/* ── APPOINTMENT BOOKING MODAL FOR TABLE VIEW ── */}
      {modalDoctor && (
        <div className="pd-modal-overlay" onClick={() => !isSubmittingModal && setModalDoctor(null)}>
          <div className="pd-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="pd-modal-header">
              <div className="pd-modal-title-wrap">
                <span className="pd-modal-pill">CONFIRMED OPD VISIT</span>
                <h3>Book Doctor Consultation</h3>
              </div>
              <button
                type="button"
                className="pd-modal-close-btn"
                onClick={() => !isSubmittingModal && setModalDoctor(null)}
              >
                <FaTimes />
              </button>
            </div>

            {/* Doctor summary */}
            <div className="pd-modal-doc-summary">
              <div
                className="pd-modal-avatar"
                style={{ backgroundColor: getSpecialtyColor(modalDoctor.specialty).avatar }}
              >
                {getDoctorInitials(modalDoctor.name)}
              </div>
              <div className="pd-modal-doc-info">
                <h4>Dr. {modalDoctor.name}</h4>
                <span className="pd-modal-spec">
                  {modalDoctor.specialty || "General Medicine"}
                </span>
                <p className="pd-modal-clinic">
                  <FaMapMarkerAlt /> {modalDoctor.clinicName || "CareScribe Clinic"}, {modalDoctor.city || "Ahmedabad"}
                </p>
                <p className="pd-modal-clinic" style={{ marginTop: "4px", color: "#0284c7" }}>
                  <FaClock /> OPD Timing: <strong>{modalDoctor.timing || "09:00 AM - 08:00 PM"}</strong>
                </p>
              </div>
            </div>

            {/* Booking Form */}
            <div className="pd-modal-form">
              <div className="pd-modal-field">
                <label>
                  <FaCalendarAlt /> Appointment Date
                </label>
                <input
                  type="date"
                  className="pd-modal-input"
                  min={getTodayDateStr()}
                  value={modalDate}
                  onChange={(e) => {
                    setModalDate(e.target.value);
                    setModalTime("");
                  }}
                  disabled={isSubmittingModal}
                />
              </div>

              <div className="pd-modal-field">
                <label>
                  <FaClock /> Consultation Time Slot
                </label>
                <select
                  className="pd-modal-input"
                  value={modalTime}
                  onChange={(e) => setModalTime(e.target.value)}
                  disabled={isSubmittingModal}
                >
                  <option value="">
                    {!modalDate
                      ? "-- First Choose Date --"
                      : loadingModalSlots
                      ? "-- Checking Doctor Availability... --"
                      : "-- Choose Time Slot --"}
                  </option>
                  {generateDoctorSlots(modalDoctor.timing).map((slot) => {
                    const isSlotBooked =
                      modalBookedSlots.includes(slot.value) ||
                      modalBookedSlots.includes(slot.label);
                    const isPast = isSlotPastForToday(modalDate, slot.value);
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
              </div>
            </div>

            <div className="pd-modal-guarantee-note">
              <FaCheckCircle className="text-green" />
              <span>Instant confirmed slot with automated reminders &amp; Google Calendar sync</span>
            </div>

            <div className="pd-modal-actions">
              <button
                type="button"
                className="pd-modal-cancel-btn"
                onClick={() => setModalDoctor(null)}
                disabled={isSubmittingModal}
              >
                Cancel
              </button>
              <button
                type="button"
                className="pd-modal-confirm-btn"
                onClick={handleModalConfirm}
                disabled={isSubmittingModal}
              >
                {isSubmittingModal ? "Booking..." : (
                  <>
                    <FaCalendarCheck /> Confirm Appointment
                  </>
                )}
              </button>
            </div>
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
          <FaChevronLeft style={{ marginRight: 6 }} /> Previous
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
          Next <FaChevronRight style={{ marginLeft: 6 }} />
        </button>
      </div>
    </div>
  );
}
