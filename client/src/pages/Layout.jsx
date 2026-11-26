import { NavLink, Outlet, useNavigate } from "react-router-dom";
import "../styles/layout.css";
import "../styles/patientWebsite.css";
import "../styles/doctorWebsite.css";
import { BsHospital, BsCalendar2Check, BsPeople, BsActivity, BsShieldLock, BsFileEarmarkMedical, BsCheckCircleFill, BsClockHistory } from "react-icons/bs";
import { FaUserMd, FaUserInjured, FaSignOutAlt, FaPhoneAlt, FaMapMarkerAlt, FaLock, FaShieldAlt, FaStethoscope } from "react-icons/fa";
import ChatBox from "../components/ChatBox";

export default function Layout() {
  const user = JSON.parse(localStorage.getItem("user"));
  const navigate = useNavigate();

  const logout = () => {
    localStorage.removeItem("user");
    localStorage.removeItem("token");
    navigate("/");
  };

  // ─────────────────────────────────────────────────────────────
  // 1. PATIENT VIEW: PRACTO-STYLE CONSUMER HEALTHCARE WEBSITE
  // ─────────────────────────────────────────────────────────────
  if (user?.role === "patient") {
    return (
      <div className="patient-website-root">
    

        {/* Ultra-Modern Glassmorphic Header & Navbar */}
        <header className="practo-navbar">
          <div className="practo-navbar-container">
            {/* 1. Left: Brand Logo */}
            <div className="practo-brand" onClick={() => navigate("/dashboard")} title="CareScribe Home">
              <div className="practo-brand-icon-box">
                <BsHospital />
                <span className="brand-glow-ring"></span>
              </div>
              <div className="practo-brand-text">
                <div className="practo-brand-title">
                  <span className="brand-main-practo">CareScribe</span>
                  <span className="brand-badge-super">+ CLINICAL</span>
                </div>
                <span className="brand-sub-practo">Modern Healthcare Portal</span>
              </div>
            </div>

            {/* 2. Center Pillar: Navigation Capsule */}
            <div className="practo-header-center" style={{ display: "flex", alignItems: "center", margin: "0 auto" }}>
              <nav className="practo-nav-menu">
                <NavLink 
                  to="/patient-notes" 
                  className={({ isActive }) => isActive ? "practo-nav-link active" : "practo-nav-link"}
                >
                  <BsFileEarmarkMedical className="nav-icon" />
                  <span>Consultation Notes</span>
                </NavLink>

                <NavLink 
                  to="/patient-profile" 
                  className={({ isActive }) => isActive ? "practo-nav-link active" : "practo-nav-link"}
                >
                  <BsActivity className="nav-icon" />
                  <span>Health Records</span>
                </NavLink>
              </nav>
            </div>

            {/* 3. Right: Header User Controls */}
            <div className="practo-nav-actions">
              <div 
                className="practo-user-pill" 
                onClick={() => navigate("/patient-profile")}
                title="View your patient medical records & profile"
              >
                <div className="practo-user-avatar">
                  {user?.name?.[0]?.toUpperCase() || "P"}
                  <span className="user-online-dot"></span>
                </div>
                <div className="practo-user-meta">
                  <span className="practo-user-name">{user?.name || "Patient"}</span>
                  <span className="practo-user-badge">
                    <BsCheckCircleFill className="verified-icon" /> Verified
                  </span>
                </div>
              </div>

              <button className="doctor-logout-btn" onClick={logout} title="Log Out of Portal">
                <FaSignOutAlt />
                <span>Log out</span>
              </button>
            </div>
          </div>
        </header>

        {/* Main Viewport */}
        <main className="patient-web-main">
          <Outlet />
        </main>

        {/* User-Friendly Healthcare Patient Footer */}
        <footer className="practo-footer">
          <div className="practo-footer-container">
            {/* Col 1: CareScribe Platform Info */}
            <div className="practo-footer-col">
              <div className="practo-footer-brand">
                <div className="practo-brand-icon-box" style={{ width: 34, height: 34, fontSize: 16 }}>
                  <BsHospital />
                </div>
                <div>
                  <strong style={{ fontSize: "16px", color: "#0f172a" }}>CareScribe</strong>
                  <span className="brand-badge-super" style={{ marginLeft: "6px", fontSize: "9px" }}>+ CLINICAL</span>
                </div>
              </div>
              <p className="footer-tagline">
                Next-generation digital outpatient healthcare portal connecting patients with verified medical specialists, smart clinic visits, and real-time electronic health records.
              </p>
              <div className="footer-trust-chips">
                <span className="footer-trust-chip">
                  <FaShieldAlt style={{ color: "#0284c7" }} /> ISO 27001 &amp; HIPAA Certified
                </span>
                <span className="footer-trust-chip">
                  <FaLock style={{ color: "#10b981" }} /> 256-Bit Encrypted Health Vault
                </span>
              </div>
            </div>

            {/* Col 2: Unique Patient Navigation Links (Zero Duplicates!) */}
            <div className="practo-footer-col">
              <h4>Patient Care Desk</h4>
              <ul className="practo-footer-links">
                <li><NavLink to="/dashboard">Dashboard Overview</NavLink></li>
                <li><NavLink to="/patient-doctors">Find &amp; Book Doctor</NavLink></li>
                <li><NavLink to="/find-clinics">Explore OPD Clinics</NavLink></li>
                <li><NavLink to="/patient-notes">Consultation Notes</NavLink></li>
                <li><NavLink to="/patient-profile">My Health Profile</NavLink></li>
              </ul>
            </div>

            {/* Col 3: Clinical Care Resources */}
            <div className="practo-footer-col">
              <h4>Clinical Features</h4>
              <ul className="practo-footer-links">
                <li><span>Verified OPD Specialists</span></li>
                <li><span>Real-time Doctor Availability</span></li>
                <li><span>Digital Prescriptions &amp; Notes</span></li>
                <li><span>Automated Visit Reminders</span></li>
                <li><span>Google Calendar Sync</span></li>
              </ul>
            </div>

            {/* Col 4: 24/7 Patient Helpdesk */}
            <div className="practo-footer-col">
              <h4>Patient Support</h4>
              <div className="footer-helpline-card">
                <div className="helpline-card-badge">
                  <FaPhoneAlt /> Live Care Hotline
                </div>
                <div className="helpline-phone">1800-CARE-SCRIBE</div>
                <div className="helpline-email">care@carescribe.com</div>
                <div className="helpline-hours">Available 24/7 • Dedicated Support Desk</div>
              </div>
            </div>
          </div>

          <div className="practo-footer-bottom">
            <div className="footer-bottom-inner">
              <p>© {new Date().getFullYear()} CareScribe Technologies. All rights reserved.</p>
              <div className="footer-system-status">
                <span className="system-status-dot"></span>
                <span>System Operational • All Clinical Services Live</span>
              </div>
            </div>
          </div>
        </footer>

        {/* Floating AI Healthcare ChatBot */}
        <ChatBox />
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // 2. DOCTOR VIEW: PRACTO PRO & NEXOPD HEALTHCARE WEBSITE
  // ─────────────────────────────────────────────────────────────
  if (user?.role === "doctor") {
    return (
      <div className="doctor-website-root">
        {/* Practo Pro & NexOPD-inspired Glassmorphic Header & Navbar */}
        <header className="doctor-navbar">
          <div className="doctor-navbar-container">
            {/* Brand Logo */}
            <div className="doctor-brand" onClick={() => navigate("/dashboard")} title="CareScribe Practice Home">
              <div className="doctor-brand-icon-box">
                <BsHospital />
                <span className="brand-glow-ring"></span>
              </div>
              <div className="doctor-brand-text">
                <div className="doctor-brand-title">
                  <span className="brand-main-practo">CareScribe</span>
                  <span className="brand-badge-doc">DOCTOR</span>
                </div>
                <span className="brand-sub-practo">Clinical OPD &amp; Practice Management</span>
              </div>
            </div>

            {/* Doctor Navigation Menu */}
            <nav className="doctor-nav-menu">
              <NavLink 
                to="/appointments" 
                className={({ isActive }) => isActive ? "doctor-nav-link active" : "doctor-nav-link"}
              >
                <BsCalendar2Check className="nav-icon" />
                <span>Appointments</span>
              </NavLink>

              <NavLink 
                to="/patients-details" 
                className={({ isActive }) => isActive ? "doctor-nav-link active" : "doctor-nav-link"}
              >
                <FaUserInjured className="nav-icon" />
                <span>Patient EHR &amp; Analysis</span>
              </NavLink>

              <NavLink 
                to="/patient-history" 
                className={({ isActive }) => isActive ? "doctor-nav-link active" : "doctor-nav-link"}
              >
                <BsClockHistory className="nav-icon" />
                <span>Patient History</span>
              </NavLink>
            </nav>

            {/* Right Actions: Doctor Profile Pill & Sign Out */}
            <div className="doctor-nav-actions">
              <div 
                className="doctor-user-pill" 
                onClick={() => navigate("/doctor-profile")}
                title={`Doctor Practice Profile: Dr. ${user?.name}`}
              >
                <div className="doctor-user-avatar">
                  {user?.name?.[0]?.toUpperCase() || "D"}
                  <span className="user-online-dot"></span>
                </div>
                <div className="doctor-user-meta">
                  <span className="doctor-user-name">Dr. {user?.name || "Doctor"}</span>
                  <span className="doctor-user-badge">
                    <BsCheckCircleFill className="verified-icon" /> Verified Specialist
                  </span>
                </div>
              </div>

              <button className="doctor-logout-btn" onClick={logout} title="Log Out of Portal">
                <FaSignOutAlt />
                <span>Log out</span>
              </button>
            </div>
          </div>
        </header>

        {/* Main Viewport for Doctor */}
        <main className="doctor-web-main">
          <Outlet />
        </main>

        {/* User-Friendly Healthcare Doctor Footer */}
        <footer className="doctor-footer">
          <div className="doctor-footer-container">
            {/* Col 1: Doctor Practice Pro Info */}
            <div className="doctor-footer-col">
              <div className="doctor-footer-brand">
                <div className="doctor-brand-icon-box" style={{ width: 34, height: 34, fontSize: 16 }}>
                  <BsHospital />
                </div>
                <div>
                  <strong style={{ fontSize: "16px", color: "#0f172a" }}>CareScribe</strong>
                  <span className="brand-badge-super" style={{ marginLeft: "6px", fontSize: "9px" }}>DOCTOR</span>
                </div>
              </div>
              <p className="footer-tagline">
                Clinical practice portal empowering attending physicians with smart OPD scheduling, AI consultation transcription, and electronic health records.
              </p>
              <div className="footer-trust-chips">
                <span className="footer-trust-chip">
                  <FaShieldAlt style={{ color: "#0284c7" }} /> Clinical HIPAA Compliance
                </span>
                <span className="footer-trust-chip">
                  <FaLock style={{ color: "#10b981" }} /> 256-Bit Encrypted EHR Vault
                </span>
              </div>
            </div>

            {/* Col 2: Unique Doctor Workspace Links (Zero Duplicates!) */}
            <div className="doctor-footer-col">
              <h4>Doctor Workspace</h4>
              <ul className="doctor-footer-links">
                <li><NavLink to="/dashboard">Practice Overview &amp; KPIs</NavLink></li>
                <li><NavLink to="/appointments">Consultation Schedule &amp; Slots</NavLink></li>
                <li><NavLink to="/patients-details">Patient EHR Directory</NavLink></li>
                <li><NavLink to="/doctor-profile">My Doctor Profile &amp; OPD</NavLink></li>
              </ul>
            </div>

            {/* Col 3: Clinical Operations Standards */}
            <div className="doctor-footer-col">
              <h4>Clinical Operations</h4>
              <ul className="doctor-footer-links">
                <li><span>AI SOAP Notes Generation</span></li>
                <li><span>OPD Queue &amp; Patient Check-in</span></li>
                <li><span>Digital Rx &amp; Diagnosis Filing</span></li>
                <li><span>Automated Follow-up Alerts</span></li>
                <li><span>Clinical Tele-consultation</span></li>
              </ul>
            </div>

            {/* Col 4: Physician Support Desk */}
            <div className="doctor-footer-col">
              <h4>Physician Support Desk</h4>
              <div className="footer-helpline-card">
                <div className="helpline-card-badge">
                  <FaPhoneAlt /> Priority Doctor Line
                </div>
                <div className="helpline-phone">1800-CARE-SCRIBE</div>
                <div className="helpline-email">doctorsupport@carescribe.com</div>
                <div className="helpline-hours">Dedicated Clinical IT Desk • 24/7</div>
              </div>
            </div>
          </div>

          <div className="doctor-footer-bottom">
            <div className="footer-bottom-inner">
              <p>© {new Date().getFullYear()} CareScribe Technologies. All rights reserved.</p>
              <div className="footer-system-status">
                <span className="system-status-dot"></span>
                <span>Doctor Portal Online • Encrypted Clinical Vault</span>
              </div>
            </div>
          </div>
        </footer>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // 3. ADMIN VIEW: DASHBOARD WORKSPACE (UNCHANGED)
  // ─────────────────────────────────────────────────────────────
  return (
    <div className="clinic-workspace">
      
      {/* ── LEFT CLINIC SIDEBAR ── */}
      <aside className="clinic-sidebar">
        {/* Brand Logo */}
        <div className="sidebar-brand" onClick={() => navigate("/dashboard")}>
          <div className="brand-icon-box">
            <BsHospital />
          </div>
          <div className="brand-name-box">
            <span className="brand-company">CareScribe</span>
            <span className="brand-dept">Clinical Portal</span>
          </div>
        </div>

        {/* Sidebar Navigation */}
        <nav className="sidebar-nav">
          <div className="nav-group-label">General</div>
          <NavLink to="/dashboard" className={({ isActive }) => isActive ? "sidebar-link active" : "sidebar-link"}>
            <BsActivity className="link-icon" />
            <span>Workspace</span>
          </NavLink>

          {user?.role === "admin" && (
            <>
              <div className="nav-group-label">Management</div>
              <NavLink to="/patients" className={({ isActive }) => isActive ? "sidebar-link active" : "sidebar-link"}>
                <FaUserInjured className="link-icon" />
                <span>Patients Directory</span>
              </NavLink>
              <NavLink to="/doctors" className={({ isActive }) => isActive ? "sidebar-link active" : "sidebar-link"}>
                <FaUserMd className="link-icon" />
                <span>Medical Staff</span>
              </NavLink>
              <NavLink to="/appointments" className={({ isActive }) => isActive ? "sidebar-link active" : "sidebar-link"}>
                <BsCalendar2Check className="link-icon" />
                <span>Appointments</span>
              </NavLink>
              <NavLink to="/patients-details" className={({ isActive }) => isActive ? "sidebar-link active" : "sidebar-link"}>
                <BsPeople className="link-icon" />
                <span>Analysis</span>
              </NavLink>
            </>
          )}

          {user?.role === "doctor" && (
            <>
              <div className="nav-group-label">Clinical</div>
              <NavLink to="/appointments" className={({ isActive }) => isActive ? "sidebar-link active" : "sidebar-link"}>
                <BsCalendar2Check className="link-icon" />
                <span>Schedule Calendar</span>
              </NavLink>
              <NavLink to="/patients-details" className={({ isActive }) => isActive ? "sidebar-link active" : "sidebar-link"}>
                <FaUserInjured className="link-icon" />
                <span>My Patient List</span>
              </NavLink>
              <NavLink to="/patient-history" className={({ isActive }) => isActive ? "sidebar-link active" : "sidebar-link"}>
                <BsClockHistory className="link-icon" />
                <span>Patient History</span>
              </NavLink>
            </>
          )}
           {user?.role === "patient" && (
            <>
              <div className="nav-group-label">Patient Desk</div>
              <NavLink to="/find-clinics" className={({ isActive }) => isActive ? "sidebar-link active" : "sidebar-link"}>
                <BsHospital className="link-icon" />
                <span>Find Clinics by City</span>
              </NavLink>
              <NavLink to="/patient-profile" className={({ isActive }) => isActive ? "sidebar-link active" : "sidebar-link"}>
                <BsShieldLock className="link-icon" />
                <span>My Health Profile</span>
              </NavLink>
              <NavLink to="/patient-doctors" className={({ isActive }) => isActive ? "sidebar-link active" : "sidebar-link"}>
                <FaUserMd className="link-icon" />
                <span>Find & Book Doctor</span>
              </NavLink>
              <NavLink to="/patient-notes" className={({ isActive }) => isActive ? "sidebar-link active" : "sidebar-link"}>
                <BsFileEarmarkMedical className="link-icon" />
                <span>Consultation Notes</span>
              </NavLink>
            </>
          )}
        </nav>

        {/* Sidebar User Profile Footer */}
        <div className="sidebar-profile-footer">
          <div className="user-profile-summary">
            <div className="user-avatar-initial">
              {user?.name?.[0]?.toUpperCase() || "U"}
            </div>
            <div className="user-profile-meta">
              <span className="user-profile-name">{user?.name || "User"}</span>
              <span className="user-profile-role">{user?.role}</span>
            </div>
          </div>
        </div>
      </aside>

      {/* ── RIGHT VIEWPORT ── */}
      <div className="clinic-viewport">
        
        {/* Top Header Bar */}
        <header className="clinic-topbar">
          <div className="topbar-search-bar">
            <span className="topbar-status-indicator">
              <span className="pulse-dot"></span>
              <span>HMS Operational • Clinical Services</span>
            </span>
          </div>

          <div className="topbar-actions">
            <button className="topbar-logout-btn" onClick={logout}>
              <FaSignOutAlt />
              <span>Log out</span>
            </button>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="clinic-main-content">
          <Outlet />
        </main>
      </div>

    </div>
  );
}