import { useState, useEffect, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../../api/axios";
import "../../styles/workerManagement.css";

// Mockup reference workers matching the user uploaded screenshot exactly
const REFERENCE_STAFF = [
  {
    id: 1,
    full_name: "Rahul Kumar",
    role_badge: "Senior Specialist",
    specialization: "Hair Specialist & Master Trichologist",
    rating: 4.9,
    reviews_count: 142,
    today_commission: "₹1,850 comm",
    service_value: "₹8,600 service value",
    status: "ACTIVE_FLOOR",
    status_label: "Active • On Floor (Chair #01)",
    chair: "Chair #01",
    bay: "Bay 1",
    station_display: "Chair #01 (Front Bay)",
    phone: "+91 98450 89319",
    email: "rahul.k@salon.in",
    joined_date: "March 2022 (2.6 yrs)",
    profile_photo: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80",
    assigned_services: ["Haircut", "Hair Styling", "Scalp Detox", "Keratin Ritual", "+2 more"],
    capacity_booked: 6,
    capacity_total: 8,
    next_client_text: "Next: 4:00 PM • Vishnu Prasad",
    next_station_text: "Station #01 • Bay 1",
    department: "hair",
    shift_hours: "10:00 AM – 7:00 PM",
    lunch_break: "1:30 PM – 2:15 PM",
    service_matrix: [
      { name: "Haircut & Styling", sub: "Primary Lead Specialist", active: true },
      { name: "Scalp Detox & Trichology", sub: "Certified Organic Treatment", active: true },
      { name: "Keratin Infusion Ritual", sub: "Master Grade • 90 min", active: true },
    ],
  },
  {
    id: 2,
    full_name: "Anil Sharma",
    role_badge: "Stylist",
    specialization: "Hair & Beard Specialist",
    rating: 4.8,
    reviews_count: 98,
    today_commission: "₹1,400 comm",
    service_value: "₹5,900 service value",
    status: "ACTIVE_STATION",
    status_label: "Active • Station #03",
    chair: "Station #03",
    bay: "Men's Bay",
    station_display: "Station #03 (Men's Bay)",
    phone: "+91 97410 77123",
    email: "anil.s@salon.in",
    joined_date: "August 2022 (2.2 yrs)",
    profile_photo: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80",
    assigned_services: ["Classic Haircut", "Beard Grooming & Trim", "Royal Shave", "Mustache Styling"],
    capacity_booked: 5,
    capacity_total: 7,
    next_client_text: "In service: Beard Trim",
    next_station_text: "Station #03 • Men's Bay",
    department: "hair",
    shift_hours: "09:30 AM – 6:30 PM",
    lunch_break: "1:00 PM – 1:45 PM",
    service_matrix: [
      { name: "Classic Haircut", sub: "Standard Styling & Wash", active: true },
      { name: "Beard Grooming & Trim", sub: "Hot Towel Shave", active: true },
      { name: "Royal Shave", sub: "Signature Barbering", active: true },
    ],
  },
  {
    id: 3,
    full_name: "Anjali Sen",
    role_badge: "Senior Aesthetician",
    specialization: "Beauty Specialist & Senior Aesthetician",
    rating: 4.95,
    reviews_count: 165,
    today_commission: "₹2,100 comm",
    service_value: "₹9,200 service value",
    status: "ACTIVE_SPA",
    status_label: "Active • Spa Pod #02",
    chair: "Spa Pod #02",
    bay: "Wellness Wing",
    station_display: "Spa Pod #02 (Wellness Wing)",
    phone: "+91 98860 44219",
    email: "anjali.sen@salon.in",
    joined_date: "January 2021 (3.8 yrs)",
    profile_photo: "https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=200&q=80",
    assigned_services: ["Hydra Facial", "Botanical Cleanse", "Gold Radiance", "Detox Scrub"],
    capacity_booked: 4,
    capacity_total: 6,
    next_client_text: "Next: 4:30 PM • Divya M.",
    next_station_text: "Spa Pod #02 • Wellness Wing",
    department: "skin",
    shift_hours: "11:00 AM – 8:00 PM",
    lunch_break: "2:00 PM – 2:45 PM",
    service_matrix: [
      { name: "Hydra Facial Glow", sub: "Medical Grade Skin Therapy", active: true },
      { name: "Botanical Cleanse", sub: "100% Organic Products", active: true },
      { name: "Detox Scrub", sub: "Exfoliating Herbal Care", active: true },
    ],
  },
  {
    id: 4,
    full_name: "Sameer Khan",
    role_badge: "Junior Stylist",
    specialization: "Junior Stylist & Grooming Associate",
    rating: 4.7,
    reviews_count: 42,
    today_commission: "₹0 comm Today",
    service_value: "Shift starts evening",
    status: "OFF_SHIFT",
    status_label: "Off Shift • Starts 5:00 PM",
    chair: "Station #04",
    bay: "Express Floor",
    station_display: "Station #04 (Express Floor)",
    phone: "+91 99160 33451",
    email: "sameer.k@salon.in",
    joined_date: "November 2023 (11 mos)",
    profile_photo: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80",
    assigned_services: ["Hair Wash & Blowdry", "Express Beard Trim"],
    capacity_booked: 0,
    capacity_total: 5,
    next_client_text: "Shift: 5:00 PM – 10:00 PM",
    next_station_text: "Evening Floor Roster",
    department: "hair",
    shift_hours: "05:00 PM – 10:00 PM",
    lunch_break: "7:30 PM – 8:00 PM",
    service_matrix: [
      { name: "Hair Wash & Blowdry", sub: "Express Styling", active: true },
      { name: "Express Beard Trim", sub: "Quick Contouring", active: true },
    ],
  },
];

export default function WorkerManagement() {
  const navigate = useNavigate();

  // State: Staff roster data (merged with backend workers)
  const [staffList, setStaffList] = useState(REFERENCE_STAFF);
  const [selectedStaffId, setSelectedStaffId] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [viewMode, setViewMode] = useState("list"); // 'list' | 'grid'
  const [toastMessage, setToastMessage] = useState("");

  // Modal: Add Worker
  const [isAddWorkerOpen, setIsAddWorkerOpen] = useState(false);
  const [submittingWorker, setSubmittingWorker] = useState(false);
  const [workerError, setWorkerError] = useState("");
  const [workerSuccessModal, setWorkerSuccessModal] = useState(null);

  const [workerForm, setWorkerForm] = useState({
    full_name: "",
    email: "",
    phone_number: "",
    specialization: "Senior Hair Stylist",
    experience: "3-5 Years (Mid-level)",
    profile_photo: "",
    password: `Worker@${Math.floor(1000 + Math.random() * 9000)}`,
  });

  // Selected Specialist for Inspection Sidebar
  const selectedSpecialist = useMemo(() => {
    return staffList.find((s) => s.id === selectedStaffId) || staffList[0] || REFERENCE_STAFF[0];
  }, [staffList, selectedStaffId]);

  // Load backend workers and merge with reference staff
  const loadWorkersFromBackend = async () => {
    try {
      const token = localStorage.getItem("access_token");
      const config = token ? { headers: { Authorization: `Bearer ${token}` } } : {};
      const res = await api.get("/salons/owner/workers/", config);
      if (res.data) {
        const backendWorkers = res.data.workers || (Array.isArray(res.data) ? res.data : []);
        if (backendWorkers.length > 0) {
          // Format backend workers to match full rich roster shape
          const formattedBackend = backendWorkers.map((bw, idx) => ({
            id: bw.id + 100,
            full_name: bw.full_name || bw.email,
            role_badge: bw.experience ? bw.experience.split(" ")[0] : "Stylist",
            specialization: bw.specialization || "Professional Stylist",
            rating: 4.9,
            reviews_count: 10 + (idx * 14),
            today_commission: "₹1,200 comm",
            service_value: "₹5,400 service value",
            status: bw.is_active ? "ACTIVE_FLOOR" : "OFF_SHIFT",
            status_label: bw.is_active ? `Active • Station #${(idx % 4) + 1}` : "Inactive • Off Shift",
            chair: `Chair #${(idx % 4) + 1}`,
            bay: `Bay ${(idx % 2) + 1}`,
            station_display: `Chair #${(idx % 4) + 1} (Floor Bay)`,
            phone: bw.phone_number || "+91 98450 11223",
            email: bw.email,
            joined_date: "Recent Addition",
            profile_photo: bw.profile_photo || "",
            assigned_services: [bw.specialization || "Styling", "Haircut", "Grooming"],
            capacity_booked: 3,
            capacity_total: 6,
            next_client_text: "Next: 3:00 PM • Client",
            next_station_text: `Station #${(idx % 4) + 1}`,
            department: (bw.specialization || "").toLowerCase().includes("skin") ? "skin" : "hair",
            shift_hours: "10:00 AM – 7:00 PM",
            lunch_break: "1:30 PM – 2:15 PM",
            service_matrix: [
              { name: bw.specialization || "Salon Service", sub: "Lead Specialist", active: true },
            ],
          }));

          // Merge without duplicate names
          const existingNames = new Set(formattedBackend.map((b) => b.full_name.toLowerCase()));
          const dedupedRef = REFERENCE_STAFF.filter((r) => !existingNames.has(r.full_name.toLowerCase()));
          setStaffList([...formattedBackend, ...dedupedRef]);
        }
      }
    } catch (err) {
      console.log("Using reference staff for Worker Management");
    }
  };

  useEffect(() => {
    loadWorkersFromBackend();
  }, []);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 3500);
  };

  // Filtered staff list
  const filteredStaff = useMemo(() => {
    return staffList.filter((staff) => {
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        staff.full_name.toLowerCase().includes(q) ||
        staff.specialization.toLowerCase().includes(q) ||
        staff.chair.toLowerCase().includes(q) ||
        staff.assigned_services.some((s) => s.toLowerCase().includes(q));

      const matchDept =
        departmentFilter === "all" ||
        staff.department === departmentFilter ||
        staff.specialization.toLowerCase().includes(departmentFilter);

      const matchStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && staff.status.startsWith("ACTIVE")) ||
        (statusFilter === "off" && staff.status === "OFF_SHIFT");

      return matchSearch && matchDept && matchStatus;
    });
  }, [staffList, searchQuery, departmentFilter, statusFilter]);

  // Handle Photo upload
  const handlePhotoUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setWorkerForm((prev) => ({
        ...prev,
        profile_photo: reader.result,
      }));
    };
    reader.readAsDataURL(file);
  };

  // Submit Add Worker Form
  const handleAddWorkerSubmit = async (e) => {
    e.preventDefault();
    setWorkerError("");

    if (!workerForm.full_name.trim()) {
      setWorkerError("Full Name is required.");
      return;
    }
    if (!workerForm.email.trim()) {
      setWorkerError("Email is required.");
      return;
    }

    setSubmittingWorker(true);
    try {
      const token = localStorage.getItem("access_token");
      const config = token ? { headers: { Authorization: `Bearer ${token}` } } : {};
      const response = await api.post("/salons/owner/workers/", workerForm, config);
      const newWorker = response.data?.worker || response.data;

      // Add to local staff list
      const newStaffEntry = {
        id: Date.now(),
        full_name: workerForm.full_name,
        role_badge: "New Stylist",
        specialization: workerForm.specialization,
        rating: 5.0,
        reviews_count: 1,
        today_commission: "₹0 comm",
        service_value: "Ready for bookings",
        status: "ACTIVE_FLOOR",
        status_label: "Active • On Floor (Station #02)",
        chair: "Station #02",
        bay: "Bay 2",
        station_display: "Station #02 (Front Floor)",
        phone: workerForm.phone_number || "+91 98450 00000",
        email: workerForm.email,
        joined_date: "Today",
        profile_photo: workerForm.profile_photo || "",
        assigned_services: [workerForm.specialization, "General Care"],
        capacity_booked: 0,
        capacity_total: 8,
        next_client_text: "Ready for appointments",
        next_station_text: "Station #02",
        department: workerForm.specialization.toLowerCase().includes("skin") ? "skin" : "hair",
        shift_hours: "10:00 AM – 7:00 PM",
        lunch_break: "1:30 PM – 2:15 PM",
        service_matrix: [{ name: workerForm.specialization, sub: "Certified Specialist", active: true }],
      };

      setStaffList((prev) => [newStaffEntry, ...prev]);
      setSelectedStaffId(newStaffEntry.id);

      setWorkerSuccessModal({
        name: workerForm.full_name,
        email: workerForm.email,
        password: workerForm.password || newWorker?.temporary_password || "Worker@123",
        salon: "Indiranagar Flagship Salon",
      });

      // Reset form
      setWorkerForm({
        full_name: "",
        email: "",
        phone_number: "",
        specialization: "Senior Hair Stylist",
        experience: "3-5 Years (Mid-level)",
        profile_photo: "",
        password: `Worker@${Math.floor(1000 + Math.random() * 9000)}`,
      });
      setIsAddWorkerOpen(false);
      showToast(`Worker ${workerForm.full_name} created successfully!`);
    } catch (err) {
      console.error("Worker creation error:", err);
      const errorMsg =
        err.response?.data?.email?.[0] ||
        err.response?.data?.error ||
        err.response?.data?.detail ||
        "Failed to create worker account. Please check details.";
      setWorkerError(errorMsg);
    } finally {
      setSubmittingWorker(false);
    }
  };

  // Change Floor State in Inspector (Active / On Break / Inactive)
  const handleChangeFloorState = (newState) => {
    setStaffList((prev) =>
      prev.map((s) => {
        if (s.id !== selectedSpecialist.id) return s;
        if (newState === "Active") {
          return { ...s, status: "ACTIVE_FLOOR", status_label: `Active • On Floor (${s.chair})` };
        } else if (newState === "On Break") {
          return { ...s, status: "ON_BREAK", status_label: "On Lunch Break • Returns 2:15 PM" };
        } else {
          return { ...s, status: "OFF_SHIFT", status_label: "Inactive • Off Shift" };
        }
      })
    );
    showToast(`Floor status for ${selectedSpecialist.full_name} updated to ${newState}`);
  };

  // Toggle single service in service matrix
  const handleToggleMatrixService = (idx) => {
    setStaffList((prev) =>
      prev.map((s) => {
        if (s.id !== selectedSpecialist.id) return s;
        const updatedMatrix = [...(s.service_matrix || [])];
        if (updatedMatrix[idx]) {
          updatedMatrix[idx] = { ...updatedMatrix[idx], active: !updatedMatrix[idx].active };
        }
        return { ...s, service_matrix: updatedMatrix };
      })
    );
  };

  // Copy worker credentials
  const handleCopyCredentials = () => {
    if (!workerSuccessModal) return;
    const text = `BookMySalon Worker Credentials:\nFull Name: ${workerSuccessModal.name}\nEmail: ${workerSuccessModal.email}\nPassword: ${workerSuccessModal.password}\nLogin URL: ${window.location.origin}/login`;
    navigator.clipboard?.writeText(text);
    showToast("Credentials copied to clipboard!");
  };

  return (
    <div className="wm-page-wrapper">
      {/* --------------------------------------------------------------------
          TOP NAVBAR
          -------------------------------------------------------------------- */}
      <header className="wm-top-navbar">
        <div className="wm-top-navbar-inner">
          {/* Brand */}
          <Link to="/owner/dashboard" className="wm-brand-group">
            <div className="wm-brand-logo-icon">B</div>
            <span className="wm-brand-title">BookMySalon</span>
            <span className="wm-brand-partner-badge">PARTNER</span>
          </Link>

          {/* Nav Tabs */}
          <nav className="wm-nav-links">
            <Link to="/owner/dashboard" className="wm-nav-link-btn">
              Floor Plan
            </Link>
            <Link to="/owner/dashboard" className="wm-nav-link-btn">
              Bookings
            </Link>
            <button type="button" className="wm-nav-link-btn active">
              Workers
            </button>
            <Link to="/owner/dashboard" className="wm-nav-link-btn">
              Services & Pricing
            </Link>
            <Link to="/owner/dashboard" className="wm-nav-link-btn">
              Reports
            </Link>
          </nav>

          {/* Right Area */}
          <div className="wm-navbar-right">
            <div className="wm-outlet-pill">
              <span className="wm-outlet-dot" />
              <span>Indiranagar Flagship Salon</span>
              <span style={{ fontSize: "10px", color: "#7b8e83" }}>⌵</span>
            </div>

            <button
              type="button"
              className="wm-icon-btn"
              title="Notifications"
              onClick={() => showToast("All system alerts up to date.")}
            >
              🔔
            </button>

            <div className="wm-user-avatar" title="Owner Profile">
              AP
            </div>
          </div>
        </div>
      </header>

      {/* --------------------------------------------------------------------
          MAIN CONTENT CONTAINER
          -------------------------------------------------------------------- */}
      <main className="wm-main-container">
        {/* Breadcrumb */}
        <div className="wm-breadcrumb">
          <Link to="/owner/dashboard" className="wm-breadcrumb-item">
            Owner Suite
          </Link>
          <span>/</span>
          <span className="wm-breadcrumb-item">Staff & Operations</span>
          <span>/</span>
          <span className="wm-breadcrumb-item active">Worker Management</span>
        </div>

        {/* Header Row */}
        <div className="wm-header-row">
          <div>
            <h1 className="wm-header-title">Worker Management</h1>
            <p className="wm-header-subtitle">
              Manage staff profiles, chair allocations, service assignments, performance metrics, and shift schedules.
            </p>
          </div>

          <div className="wm-header-actions">
            <button
              type="button"
              className="btn-wm-add-worker"
              onClick={() => {
                setWorkerError("");
                setIsAddWorkerOpen(true);
              }}
            >
              <span>+ Add Worker</span>
            </button>

            <div className="wm-view-actions-row">
              <button
                type="button"
                className="btn-wm-secondary"
                onClick={() => showToast("Exporting roster schedule to PDF/CSV...")}
              >
                Export Roster
              </button>
              <button
                type="button"
                className="btn-wm-secondary"
                onClick={() => setViewMode((prev) => (prev === "list" ? "grid" : "list"))}
              >
                {viewMode === "list" ? "Grid View" : "List View"}
              </button>
            </div>
          </div>
        </div>

        {/* Search & Filter Toolbar */}
        <section className="wm-search-filters-card">
          <div className="wm-search-input-wrap">
            <span className="wm-search-icon">🔍</span>
            <input
              type="text"
              className="wm-search-input"
              placeholder="Search worker by name, skill, chair..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="wm-filters-row">
            <select
              className="wm-filter-dropdown"
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
            >
              <option value="all">All Departments ⌵</option>
              <option value="hair">Hair Styling ⌵</option>
              <option value="skin">Skin & Facial ⌵</option>
              <option value="spa">Spa & Massage ⌵</option>
            </select>

            <select
              className="wm-filter-dropdown"
              value={departmentFilter === "hair" ? "hair" : "all"}
              onChange={(e) => setDepartmentFilter(e.target.value)}
            >
              <option value="all">Hair Styling ⌵</option>
              <option value="hair">Hair Specialist</option>
              <option value="barber">Men's Barbering</option>
            </select>

            <select
              className="wm-filter-dropdown"
              value={departmentFilter === "skin" ? "skin" : "all"}
              onChange={(e) => setDepartmentFilter(e.target.value)}
            >
              <option value="all">Skin & Facial ⌵</option>
              <option value="skin">Aesthetics & Glow</option>
            </select>

            <select
              className="wm-filter-dropdown"
              value={departmentFilter === "spa" ? "spa" : "all"}
              onChange={(e) => setDepartmentFilter(e.target.value)}
            >
              <option value="all">Spa & Massage ⌵</option>
              <option value="spa">Ayurvedic Wellness</option>
            </select>

            <select
              className="wm-filter-dropdown"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">Status: All ⌵</option>
              <option value="active">Active On Floor</option>
              <option value="off">Off Shift</option>
            </select>

            <select
              className="wm-filter-dropdown"
              value={viewMode}
              onChange={(e) => setViewMode(e.target.value)}
            >
              <option value="list">View: List View ⌵</option>
              <option value="grid">View: Grid View ⌵</option>
            </select>
          </div>
        </section>

        {/* 4 KPI Summary Cards */}
        <section className="wm-kpi-grid">
          {/* Card 1: TOTAL ACTIVE STAFF */}
          <div className="wm-kpi-card">
            <div>
              <div className="wm-kpi-header">
                <span className="wm-kpi-label">TOTAL ACTIVE STAFF</span>
                <span className="wm-kpi-icon-circle staff">👥</span>
              </div>
              <div className="wm-kpi-val">{staffList.length} Specialists</div>
              <div className="wm-kpi-subtext">6 Active on floor • 2 on break/shift</div>
            </div>
            <div className="wm-kpi-progress">
              <div className="wm-progress-fill-main" style={{ width: "75%" }} />
              <div className="wm-progress-fill-sub" style={{ width: "25%" }} />
            </div>
          </div>

          {/* Card 2: TODAY'S UTILIZATION */}
          <div className="wm-kpi-card">
            <div>
              <div className="wm-kpi-header">
                <span className="wm-kpi-label">TODAY'S UTILIZATION</span>
                <span className="wm-kpi-icon-circle util">🪑</span>
              </div>
              <div className="wm-kpi-val">84% Booked</div>
              <div className="wm-kpi-subtext">28 total slots filled across chairs</div>
            </div>
            <div className="wm-kpi-progress">
              <div className="wm-progress-fill-main" style={{ width: "84%" }} />
              <div className="wm-progress-fill-sub" style={{ width: "16%" }} />
            </div>
          </div>

          {/* Card 3: TOP PERFORMER */}
          <div className="wm-kpi-card">
            <div>
              <div className="wm-kpi-header">
                <span className="wm-kpi-label">TOP PERFORMER</span>
                <span className="wm-kpi-icon-circle top">💡</span>
              </div>
              <div className="wm-kpi-val">
                Rahul Kumar <span style={{ color: "#d97706", fontSize: "16px" }}>4.9 ★</span>
              </div>
              <div className="wm-kpi-subtext">12 bookings today • ₹6,400 rev • Lead Trichologist</div>
            </div>
            <div className="wm-kpi-trend">
              <span>📈</span>
              <span>18% higher than salon daily avg</span>
            </div>
          </div>

          {/* Card 4: PAYOUT & COMMISSION */}
          <div className="wm-kpi-card">
            <div>
              <div className="wm-kpi-header">
                <span className="wm-kpi-label">PAYOUT & COMMISSION</span>
                <span className="wm-kpi-icon-circle payout">📄</span>
              </div>
              <div className="wm-kpi-val">Real-time Linked</div>
              <div className="wm-kpi-subtext">Cycle: Oct 31 • Pool: ₹64,280 calculated</div>
            </div>
            <div className="wm-kpi-footer-sync">
              <span>Auto-calculating</span>
              <span>Synced 4m ago</span>
            </div>
          </div>
        </section>

        {/* --------------------------------------------------------------------
            MAIN SPLIT VIEW: ROSTER & INSPECTION SIDEBAR
            -------------------------------------------------------------------- */}
        <div className="wm-split-layout">
          {/* Left Column: Staff Roster */}
          <section className="wm-roster-column">
            <div className="wm-roster-header">
              <h2 className="wm-roster-title">
                Staff Roster & Chair Allocation ({filteredStaff.length})
              </h2>
              <span className="wm-roster-shifts-note">
                Showing active shifts for Today, 24 Oct
              </span>
            </div>

            {filteredStaff.map((staff) => {
              const isSelected = staff.id === selectedStaffId;
              const isOff = staff.status === "OFF_SHIFT";

              return (
                <div
                  key={staff.id}
                  className={`wm-worker-card ${isSelected ? "selected" : ""}`}
                  onClick={() => setSelectedStaffId(staff.id)}
                >
                  {/* Card Top Row: Avatar, Identity, Rating, Status */}
                  <div className="wm-card-top-row">
                    <div className="wm-card-worker-identity">
                      {staff.profile_photo ? (
                        <img
                          src={staff.profile_photo}
                          alt={staff.full_name}
                          className="wm-card-avatar-img"
                        />
                      ) : (
                        <div className="wm-card-avatar-fallback">
                          {staff.full_name.charAt(0)}
                        </div>
                      )}

                      <div>
                        <div className="wm-worker-name-line">
                          <h3 className="wm-worker-card-name">{staff.full_name}</h3>
                          <span className="wm-role-badge">{staff.role_badge}</span>
                        </div>

                        <div className="wm-worker-card-specialty">
                          {staff.specialization}
                        </div>

                        <div className="wm-worker-card-meta">
                          <span style={{ color: "#d97706", fontWeight: 700 }}>
                            ★ {staff.rating}
                          </span>{" "}
                          ({staff.reviews_count} verified reviews) • Today:{" "}
                          <strong>{staff.today_commission}</strong> ({staff.service_value})
                        </div>
                      </div>
                    </div>

                    <div>
                      <span
                        className={`wm-status-badge ${
                          isOff
                            ? "off-shift"
                            : staff.status === "ON_BREAK"
                            ? "break"
                            : "active-floor"
                        }`}
                      >
                        <span className="wm-status-badge-dot" />
                        <span>{staff.status_label}</span>
                      </span>
                    </div>
                  </div>

                  {/* Assigned Services Pills */}
                  <div className="wm-services-row">
                    <span className="wm-services-label">Assigned Services:</span>
                    {staff.assigned_services.map((srv, idx) => (
                      <span
                        key={idx}
                        className={`wm-service-pill ${srv.startsWith("+") ? "more" : ""}`}
                      >
                        {srv}
                      </span>
                    ))}
                  </div>

                  {/* Daily Capacity Progress Box */}
                  <div className="wm-capacity-box">
                    <div className="wm-capacity-top-labels">
                      <span className="wm-capacity-count">
                        Daily Capacity: {staff.capacity_booked}/{staff.capacity_total} Appointments booked
                      </span>
                      <span className="wm-capacity-next">
                        {staff.next_client_text}
                      </span>
                    </div>

                    <div className="wm-capacity-progress-bar">
                      <div
                        className="wm-capacity-fill"
                        style={{
                          width: `${(staff.capacity_booked / staff.capacity_total) * 100}%`,
                          background: isOff ? "#d97706" : "#2e5a44",
                        }}
                      />
                    </div>

                    <div className="wm-capacity-bottom-info">
                      <span>Shift progress</span>
                      <span>{staff.next_station_text}</span>
                    </div>
                  </div>

                  {/* Action Buttons Row */}
                  <div className="wm-card-actions-row">
                    <div className="wm-card-actions-left">
                      {isOff ? (
                        <>
                          <button
                            type="button"
                            className="btn-wm-action activate-floor"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedStaffId(staff.id);
                              handleChangeFloorState("Active");
                            }}
                          >
                            ⚡ Activate Floor Status
                          </button>
                          <button
                            type="button"
                            className="btn-wm-action"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedStaffId(staff.id);
                              showToast(`Editing profile for ${staff.full_name}`);
                            }}
                          >
                            ✏️ Edit Profile
                          </button>
                          <button
                            type="button"
                            className="btn-wm-action"
                            onClick={(e) => {
                              e.stopPropagation();
                              showToast(`Schedule opened for ${staff.full_name}`);
                            }}
                          >
                            📅 Schedule
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            className="btn-wm-action"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedStaffId(staff.id);
                              showToast(`Editing profile for ${staff.full_name}`);
                            }}
                          >
                            ✏️ Edit Profile
                          </button>
                          <button
                            type="button"
                            className="btn-wm-action"
                            onClick={(e) => {
                              e.stopPropagation();
                              showToast(`Managing schedule for ${staff.full_name}`);
                            }}
                          >
                            📅 Manage Schedule
                          </button>
                          <button
                            type="button"
                            className="btn-wm-action"
                            onClick={(e) => {
                              e.stopPropagation();
                              showToast(`Assigning services to ${staff.full_name}`);
                            }}
                          >
                            ✂️ Assign Services
                          </button>
                          <button
                            type="button"
                            className="btn-wm-action"
                            onClick={(e) => {
                              e.stopPropagation();
                              showToast(`Viewing performance report for ${staff.full_name}`);
                            }}
                          >
                            📊 View Performance
                          </button>
                        </>
                      )}
                    </div>

                    {!isOff && (
                      <button
                        type="button"
                        className="btn-wm-action pause"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedStaffId(staff.id);
                          handleChangeFloorState("On Break");
                        }}
                      >
                        ⏸ Pause
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </section>

          {/* Right Column: Specialist Inspection Sidebar */}
          <aside className="wm-inspector-card">
            <div className="wm-inspector-header-top">
              <span className="wm-inspector-section-label">SPECIALIST INSPECTION</span>
              <span className="wm-chair-badge">{selectedSpecialist.chair}</span>
            </div>

            <h3 className="wm-inspector-name">{selectedSpecialist.full_name}</h3>
            <p className="wm-inspector-sub">
              {selectedSpecialist.specialization.split("&")[0]} • Indiranagar Flagship
            </p>

            {/* REAL-TIME FLOOR STATE */}
            <div className="wm-field-block">
              <span className="wm-field-title">REAL-TIME FLOOR STATE</span>
              <div className="wm-segmented-control">
                <button
                  type="button"
                  className={`wm-segment-btn ${
                    selectedSpecialist.status.startsWith("ACTIVE") ? "active" : ""
                  }`}
                  onClick={() => handleChangeFloorState("Active")}
                >
                  Active
                </button>
                <button
                  type="button"
                  className={`wm-segment-btn ${
                    selectedSpecialist.status === "ON_BREAK" ? "active" : ""
                  }`}
                  onClick={() => handleChangeFloorState("On Break")}
                >
                  On Break
                </button>
                <button
                  type="button"
                  className={`wm-segment-btn ${
                    selectedSpecialist.status === "OFF_SHIFT" ? "active" : ""
                  }`}
                  onClick={() => handleChangeFloorState("Inactive")}
                >
                  Inactive
                </button>
              </div>
            </div>

            {/* Specialist Details List */}
            <div className="wm-inspector-details-list">
              <div className="wm-inspector-detail-row">
                <span className="wm-inspector-detail-label">Direct Phone:</span>
                <span className="wm-inspector-detail-val">{selectedSpecialist.phone}</span>
              </div>
              <div className="wm-inspector-detail-row">
                <span className="wm-inspector-detail-label">Salon Email:</span>
                <span className="wm-inspector-detail-val">{selectedSpecialist.email}</span>
              </div>
              <div className="wm-inspector-detail-row">
                <span className="wm-inspector-detail-label">Station Allocation:</span>
                <span className="wm-inspector-detail-val">{selectedSpecialist.station_display}</span>
              </div>
              <div className="wm-inspector-detail-row">
                <span className="wm-inspector-detail-label">Joined Date:</span>
                <span className="wm-inspector-detail-val">{selectedSpecialist.joined_date}</span>
              </div>
            </div>

            {/* SERVICE MATRIX */}
            <div className="wm-field-block">
              <div className="wm-matrix-header">
                <span className="wm-field-title" style={{ margin: 0 }}>
                  SERVICE MATRIX
                </span>
                <span
                  className="wm-matrix-link"
                  onClick={() => showToast("Add/Remove Services modal opened")}
                >
                  + Add / Remove Services
                </span>
              </div>

              <div className="wm-matrix-list">
                {(selectedSpecialist.service_matrix || []).map((srv, idx) => (
                  <div key={idx} className="wm-matrix-item">
                    <div className="wm-matrix-item-info">
                      <span className="wm-matrix-item-name">{srv.name}</span>
                      <span className="wm-matrix-item-sub">{srv.sub}</span>
                    </div>
                    <button
                      type="button"
                      className="wm-matrix-status-pill"
                      style={{
                        cursor: "pointer",
                        background: srv.active ? "#e6f4ea" : "#f1f5f2",
                        color: srv.active ? "#137333" : "#627267",
                      }}
                      onClick={() => handleToggleMatrixService(idx)}
                      title="Click to toggle service activity"
                    >
                      {srv.active ? "Active" : "Inactive"}
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* WEEKLY SHIFT SCHEDULE */}
            <div className="wm-field-block">
              <div className="wm-matrix-header">
                <span className="wm-field-title" style={{ margin: 0 }}>
                  WEEKLY SHIFT SCHEDULE
                </span>
                <span
                  className="wm-matrix-link"
                  onClick={() => showToast("Edit shift schedule opened")}
                >
                  Edit Shift & Breaks
                </span>
              </div>

              <div className="wm-shift-box">
                <div className="wm-shift-row">
                  <span className="wm-shift-label">Mon – Fri Shift:</span>
                  <span className="wm-shift-val">{selectedSpecialist.shift_hours}</span>
                </div>
                <div className="wm-shift-row">
                  <span className="wm-shift-label">Daily Lunch Break:</span>
                  <span className="wm-shift-val">{selectedSpecialist.lunch_break}</span>
                </div>
              </div>
            </div>

            {/* Save Button */}
            <button
              type="button"
              className="btn-wm-save-changes"
              onClick={() => showToast(`Profile changes saved for ${selectedSpecialist.full_name}!`)}
            >
              💾 Save Profile Changes
            </button>
          </aside>
        </div>
      </main>

      {/* --------------------------------------------------------------------
          FOOTER
          -------------------------------------------------------------------- */}
      <footer className="wm-page-footer">
        <div className="wm-page-footer-inner">
          <div>
            <strong>BookMySalon Partner v4.2</strong> • Staff Shift Allocation & Commission Registry Engine
          </div>
          <div className="wm-footer-links">
            <a href="#safety" className="wm-footer-link" onClick={(e) => e.preventDefault()}>
              Floor Safety Guidelines
            </a>
            <a href="#commission" className="wm-footer-link" onClick={(e) => e.preventDefault()}>
              Commission Policy
            </a>
            <a href="#help" className="wm-footer-link" onClick={(e) => e.preventDefault()}>
              Help Desk
            </a>
          </div>
        </div>
      </footer>

      {/* --------------------------------------------------------------------
          MODAL: ADD NEW WORKER
          -------------------------------------------------------------------- */}
      {isAddWorkerOpen && (
        <div className="studio-modal-backdrop" onClick={() => setIsAddWorkerOpen(false)}>
          <div
            className="studio-modal-card"
            style={{
              maxWidth: "540px",
              background: "#fff",
              borderRadius: "14px",
              padding: "24px",
              boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
              margin: "auto",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "16px",
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: "18px", color: "#1a2e22" }}>Add Salon Worker</h3>
                <p style={{ margin: "2px 0 0", fontSize: "12px", color: "#627267" }}>
                  Create a worker account with authentication & salon assignment.
                </p>
              </div>
              <button
                type="button"
                style={{
                  background: "transparent",
                  border: "none",
                  fontSize: "18px",
                  cursor: "pointer",
                }}
                onClick={() => setIsAddWorkerOpen(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddWorkerSubmit}>
              <div style={{ maxHeight: "65vh", overflowY: "auto", paddingRight: "4px" }}>
                {workerError && (
                  <div
                    style={{
                      background: "#fef2f2",
                      color: "#dc2626",
                      padding: "8px 12px",
                      borderRadius: "6px",
                      fontSize: "12px",
                      marginBottom: "12px",
                    }}
                  >
                    ⚠️ {workerError}
                  </div>
                )}

                {/* 1. Full Name */}
                <div style={{ marginBottom: "12px" }}>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px" }}>
                    Full Name <span style={{ color: "#dc2626" }}>*</span>
                  </label>
                  <input
                    type="text"
                    required
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      border: "1px solid #dce4df",
                      borderRadius: "6px",
                      fontSize: "13px",
                    }}
                    placeholder="e.g. Rahul Kumar"
                    value={workerForm.full_name}
                    onChange={(e) => setWorkerForm({ ...workerForm, full_name: e.target.value })}
                  />
                </div>

                {/* 2. Email & 3. Phone */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "12px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px" }}>
                      Email (Login ID) <span style={{ color: "#dc2626" }}>*</span>
                    </label>
                    <input
                      type="email"
                      required
                      style={{
                        width: "100%",
                        padding: "8px 12px",
                        border: "1px solid #dce4df",
                        borderRadius: "6px",
                        fontSize: "13px",
                      }}
                      placeholder="rahul@salon.in"
                      value={workerForm.email}
                      onChange={(e) => setWorkerForm({ ...workerForm, email: e.target.value })}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px" }}>
                      Phone Number <span style={{ color: "#dc2626" }}>*</span>
                    </label>
                    <input
                      type="tel"
                      required
                      style={{
                        width: "100%",
                        padding: "8px 12px",
                        border: "1px solid #dce4df",
                        borderRadius: "6px",
                        fontSize: "13px",
                      }}
                      placeholder="+91 98450 89319"
                      value={workerForm.phone_number}
                      onChange={(e) => setWorkerForm({ ...workerForm, phone_number: e.target.value })}
                    />
                  </div>
                </div>

                {/* 4. Specialization & 5. Experience */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "12px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px" }}>
                      Specialization <span style={{ color: "#dc2626" }}>*</span>
                    </label>
                    <select
                      style={{
                        width: "100%",
                        padding: "8px 12px",
                        border: "1px solid #dce4df",
                        borderRadius: "6px",
                        fontSize: "13px",
                      }}
                      value={workerForm.specialization}
                      onChange={(e) => setWorkerForm({ ...workerForm, specialization: e.target.value })}
                    >
                      <option value="Senior Hair Stylist">Senior Hair Stylist</option>
                      <option value="Hair Specialist & Master Trichologist">Master Trichologist</option>
                      <option value="Hair & Beard Specialist">Hair & Beard Specialist</option>
                      <option value="Beauty Specialist & Senior Aesthetician">Senior Aesthetician</option>
                      <option value="Spa & Massage Therapist">Spa & Massage Therapist</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px" }}>
                      Experience <span style={{ color: "#dc2626" }}>*</span>
                    </label>
                    <select
                      style={{
                        width: "100%",
                        padding: "8px 12px",
                        border: "1px solid #dce4df",
                        borderRadius: "6px",
                        fontSize: "13px",
                      }}
                      value={workerForm.experience}
                      onChange={(e) => setWorkerForm({ ...workerForm, experience: e.target.value })}
                    >
                      <option value="1-2 Years (Junior Stylist)">1-2 Years (Junior)</option>
                      <option value="3-5 Years (Mid-level)">3-5 Years (Mid-level)</option>
                      <option value="5+ Years (Senior Stylist)">5+ Years (Senior)</option>
                      <option value="8+ Years (Master Stylist)">8+ Years (Master)</option>
                    </select>
                  </div>
                </div>

                {/* 6. Profile Photo */}
                <div style={{ marginBottom: "12px" }}>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px" }}>
                    Profile Photo
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoUpload}
                    style={{ fontSize: "12px" }}
                  />
                </div>

                {/* 7. Password */}
                <div style={{ marginBottom: "14px" }}>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px" }}>
                    Worker Password
                  </label>
                  <input
                    type="text"
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      border: "1px solid #dce4df",
                      borderRadius: "6px",
                      fontSize: "13px",
                    }}
                    value={workerForm.password}
                    onChange={(e) => setWorkerForm({ ...workerForm, password: e.target.value })}
                  />
                  <p style={{ margin: "4px 0 0", fontSize: "11px", color: "#627267" }}>
                    Worker uses this to log into the Worker Studio portal.
                  </p>
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: "10px",
                  marginTop: "16px",
                  borderTop: "1px solid #edf2ef",
                  paddingTop: "14px",
                }}
              >
                <button
                  type="button"
                  style={{
                    background: "#f4f7f5",
                    border: "1px solid #d5ded8",
                    padding: "8px 16px",
                    borderRadius: "6px",
                    fontSize: "13px",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                  onClick={() => setIsAddWorkerOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingWorker}
                  style={{
                    background: "#1e392a",
                    color: "#fff",
                    border: "none",
                    padding: "8px 18px",
                    borderRadius: "6px",
                    fontSize: "13px",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  {submittingWorker ? "Creating..." : "Create Worker Account"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------
          MODAL: WORKER ADDED SUCCESSFULLY
          -------------------------------------------------------------------- */}
      {workerSuccessModal && (
        <div className="studio-modal-backdrop" onClick={() => setWorkerSuccessModal(null)}>
          <div
            className="studio-modal-card"
            style={{
              maxWidth: "460px",
              background: "#fff",
              borderRadius: "14px",
              padding: "24px",
              boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
              margin: "auto",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ textAlign: "center", marginBottom: "16px" }}>
              <span style={{ fontSize: "36px" }}>🎉</span>
              <h3 style={{ margin: "8px 0 4px", fontSize: "18px", color: "#137333" }}>
                Worker Added Successfully!
              </h3>
              <p style={{ margin: 0, fontSize: "12px", color: "#627267" }}>
                Account created and allocated to {workerSuccessModal.salon}.
              </p>
            </div>

            <div
              style={{
                background: "#f7faf8",
                border: "1px solid #e1e8e3",
                borderRadius: "8px",
                padding: "14px",
                marginBottom: "18px",
                fontSize: "13px",
                display: "flex",
                flexDirection: "column",
                gap: "8px",
              }}
            >
              <div>
                <span style={{ color: "#7b8e83" }}>Full Name: </span>
                <strong>{workerSuccessModal.name}</strong>
              </div>
              <div>
                <span style={{ color: "#7b8e83" }}>Login Email: </span>
                <strong>{workerSuccessModal.email}</strong>
              </div>
              <div>
                <span style={{ color: "#7b8e83" }}>Password: </span>
                <strong>{workerSuccessModal.password}</strong>
              </div>
              <div>
                <span style={{ color: "#7b8e83" }}>Portal: </span>
                <span style={{ color: "#137333", fontWeight: 600 }}>/login (Worker Studio)</span>
              </div>
            </div>

            <div style={{ display: "flex", gap: "10px" }}>
              <button
                type="button"
                style={{
                  flex: 1,
                  background: "#f4f7f5",
                  border: "1px solid #d5ded8",
                  padding: "9px",
                  borderRadius: "6px",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
                onClick={handleCopyCredentials}
              >
                📋 Copy Credentials
              </button>
              <button
                type="button"
                style={{
                  flex: 1,
                  background: "#1e392a",
                  color: "#fff",
                  border: "none",
                  padding: "9px",
                  borderRadius: "6px",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
                onClick={() => setWorkerSuccessModal(null)}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div
          style={{
            position: "fixed",
            bottom: "24px",
            right: "24px",
            background: "#1e392a",
            color: "#ffffff",
            padding: "12px 20px",
            borderRadius: "10px",
            fontSize: "13px",
            fontWeight: 500,
            boxShadow: "0 6px 20px rgba(0,0,0,0.15)",
            zIndex: 9999,
          }}
        >
          ✓ {toastMessage}
        </div>
      )}
    </div>
  );
}
