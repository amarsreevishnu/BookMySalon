import { useState, useEffect, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../../api/axios";
import OwnerNavbar from "../../components/owner/OwnerNavbar";
import "../../styles/workerManagement.css";

export default function WorkerManagement() {
  const navigate = useNavigate();

  // State: Staff roster data fetched from backend
  const [staffList, setStaffList] = useState([]);
  const [selectedStaffId, setSelectedStaffId] = useState(null);
  const [loadingWorkers, setLoadingWorkers] = useState(true);
  const [salonInfo, setSalonInfo] = useState({ name: "Indiranagar Flagship Salon", city: "" });

  const [searchQuery, setSearchQuery] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [viewMode, setViewMode] = useState("list"); // 'list' | 'grid'
  const [toastMessage, setToastMessage] = useState("");

  // Selected Specialist for Inspection Sidebar
  const selectedSpecialist = useMemo(() => {
    if (!staffList || staffList.length === 0) return null;
    return staffList.find((s) => s.id === selectedStaffId) || staffList[0] || null;
  }, [staffList, selectedStaffId]);

  // Load workers strictly from backend
  const loadWorkersFromBackend = async () => {
    setLoadingWorkers(true);
    try {
      const res = await api.get("/salons/owner/workers/");
      if (res.data) {
        if (res.data.salon) {
          setSalonInfo(res.data.salon);
        }
        const backendWorkers = res.data.workers || (Array.isArray(res.data) ? res.data : []);
        
        // Format backend workers to match rich UI roster presentation
        const formattedBackend = backendWorkers.map((bw, idx) => ({
          id: bw.id,
          full_name: bw.full_name || bw.email,
          role_badge: bw.experience ? bw.experience.split("|")[0].trim() : "Specialist",
          specialization: bw.specialization || "Professional Specialist",
          rating: 5.0,
          reviews_count: bw.assigned_bookings_count || 0,
          today_commission: bw.commission_tier || "Standard Tier",
          service_value: `${bw.assigned_bookings_count || 0} active bookings`,
          status: bw.is_active ? "ACTIVE_FLOOR" : "OFF_SHIFT",
          status_label: bw.is_active
            ? `Active • ${bw.station || `Station #${(idx % 6) + 1}`}`
            : "Inactive • Off Shift",
          chair: bw.station || `Station #${(idx % 6) + 1}`,
          bay: bw.station && bw.station.includes("•")
            ? bw.station.split("•")[1].trim()
            : `Bay ${(idx % 2) + 1}`,
          station_display: bw.station || `Station #${(idx % 6) + 1}`,
          phone: bw.phone_number || "Not provided",
          email: bw.email,
          joined_date: bw.created_at
            ? new Date(bw.created_at).toLocaleDateString("en-US", { month: "short", year: "numeric" })
            : "Recent Addition",
          profile_photo: bw.profile_photo || "",
          assigned_services: Array.isArray(bw.assigned_services) && bw.assigned_services.length > 0
            ? bw.assigned_services.map((s) => (typeof s === "string" ? s : s.name || s.title || "Service"))
            : (Array.isArray(bw.specializations) && bw.specializations.length > 0
                ? bw.specializations
                : [bw.specialization || "General Salon Services"]),
          capacity_booked: bw.assigned_bookings_count || 0,
          capacity_total: 8,
          next_client_text: bw.is_active ? "Ready for bookings" : "Off Shift",
          next_station_text: bw.station || `Station #${(idx % 6) + 1}`,
          department: (bw.specialization || "").toLowerCase().includes("skin")
            ? "skin"
            : (bw.specialization || "").toLowerCase().includes("spa")
            ? "spa"
            : "hair",
          shift_hours: (bw.shift_hours && bw.shift_hours.time_in && bw.shift_hours.time_out)
            ? `${bw.shift_hours.time_in} – ${bw.shift_hours.time_out}`
            : "09:00 AM – 07:00 PM",
          lunch_break: "1:30 PM – 2:15 PM",
          service_matrix: Array.isArray(bw.assigned_services) && bw.assigned_services.length > 0
            ? bw.assigned_services.map((s) => ({
                name: typeof s === "string" ? s : s.name || "Service",
                sub: "Assigned Service Capability",
                active: true,
              }))
            : [{ name: bw.specialization || "General Services", sub: "Primary Specialty", active: true }],
          is_active: bw.is_active,
          commission_tier: bw.commission_tier || "Tier 2 • Senior Specialist",
          bio: bw.bio || "",
        }));

        setStaffList(formattedBackend);
        if (formattedBackend.length > 0) {
          setSelectedStaffId(formattedBackend[0].id);
        } else {
          setSelectedStaffId(null);
        }
      }
    } catch (err) {
      console.error("Could not load salon workers:", err);
      setStaffList([]);
      setSelectedStaffId(null);
    } finally {
      setLoadingWorkers(false);
    }
  };

  useEffect(() => {
    loadWorkersFromBackend();
  }, []);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 3500);
  };

  // Filtered staff list based on real backend data
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
        (statusFilter === "active" && staff.is_active) ||
        (statusFilter === "off" && !staff.is_active);

      return matchSearch && matchDept && matchStatus;
    });
  }, [staffList, searchQuery, departmentFilter, statusFilter]);

  // Derived KPI metrics from real data
  const activeStaffCount = useMemo(() => {
    return staffList.filter((s) => s.is_active).length;
  }, [staffList]);

  const totalBookingsCount = useMemo(() => {
    return staffList.reduce((acc, curr) => acc + (curr.capacity_booked || 0), 0);
  }, [staffList]);

  const topPerformer = useMemo(() => {
    if (staffList.length === 0) return null;
    return [...staffList].sort((a, b) => (b.capacity_booked || 0) - (a.capacity_booked || 0))[0];
  }, [staffList]);

  // Change Floor State in Inspector (Active / On Break / Inactive)
  const handleChangeFloorState = async (newState) => {
    if (!selectedSpecialist) return;
    const isActivating = newState === "Active";
    try {
      await api.patch(`/salons/owner/workers/${selectedSpecialist.id}/`, {
        is_active: isActivating,
      });
    } catch (err) {
      console.warn("Could not patch floor state to backend:", err);
    }

    setStaffList((prev) =>
      prev.map((s) => {
        if (s.id !== selectedSpecialist.id) return s;
        if (newState === "Active") {
          return {
            ...s,
            is_active: true,
            status: "ACTIVE_FLOOR",
            status_label: `Active • ${s.chair}`,
          };
        } else if (newState === "On Break") {
          return {
            ...s,
            is_active: true,
            status: "ON_BREAK",
            status_label: "On Lunch Break",
          };
        } else {
          return {
            ...s,
            is_active: false,
            status: "OFF_SHIFT",
            status_label: "Inactive • Off Shift",
          };
        }
      })
    );
    showToast(`Floor status for ${selectedSpecialist.full_name} updated to ${newState}`);
  };

  // Toggle single service in service matrix
  const handleToggleMatrixService = (idx) => {
    if (!selectedSpecialist) return;
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

  return (
    <div className="wm-page-wrapper">
      {/* --------------------------------------------------------------------
          REUSABLE OWNER SUITE NAVBAR
          -------------------------------------------------------------------- */}
      <OwnerNavbar
        activeTab="Workers"
        workersCount={staffList.length}
        searchQuery={searchQuery}
        onSearchChange={(e) => setSearchQuery(e.target.value)}
        searchPlaceholder="Search workers, chairs, skills..."
        onNotificationsClick={() => showToast("All system alerts up to date.")}
      />

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
          <Link to="/owner/dashboard" className="wm-breadcrumb-item">
            Staff &amp; Operations
          </Link>
          <span>/</span>
          <span className="wm-breadcrumb-item active">Worker Management</span>
        </div>

        {/* Header Row */}
        <div className="wm-header-row">
          <div>
            <h1 className="wm-header-title">Worker Management</h1>
            <p className="wm-header-subtitle">
              Manage staff profiles, chair allocations, service assignments, and real-time floor statuses for {salonInfo.name}.
            </p>
          </div>

          <div className="wm-header-actions">
            <Link to="/owner/add-worker" className="btn-wm-add-worker">
              <span>+ Add Worker</span>
            </Link>

            <div className="wm-view-actions-row">
              <Link to="/owner/dashboard" className="btn-wm-dashboard-link">
                ← Dashboard
              </Link>
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
              value={departmentFilter === "hair" ? "hair" : "all"}
              onChange={(e) => setDepartmentFilter(e.target.value)}
            >
              <option value="all">Hair Styling ⌵</option>
              <option value="hair">Hair Only</option>
            </select>

            <select
              className="wm-filter-dropdown"
              value={departmentFilter === "skin" ? "skin" : "all"}
              onChange={(e) => setDepartmentFilter(e.target.value)}
            >
              <option value="all">Skin &amp; Facial ⌵</option>
              <option value="skin">Aesthetics &amp; Glow</option>
            </select>

            <select
              className="wm-filter-dropdown"
              value={departmentFilter === "spa" ? "spa" : "all"}
              onChange={(e) => setDepartmentFilter(e.target.value)}
            >
              <option value="all">Spa &amp; Massage ⌵</option>
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

        {/* 4 KPI Summary Cards (Calculated strictly from fetched backend data) */}
        <section className="wm-kpi-grid">
          {/* Card 1: TOTAL ACTIVE STAFF */}
          <div className="wm-kpi-card">
            <div>
              <div className="wm-kpi-header">
                <span className="wm-kpi-label">TOTAL ACTIVE STAFF</span>
                <span className="wm-kpi-icon-circle staff">👥</span>
              </div>
              <div className="wm-kpi-val">{staffList.length} Specialists</div>
              <div className="wm-kpi-subtext">
                {activeStaffCount} Active on floor • {staffList.length - activeStaffCount} off shift
              </div>
            </div>
            <div className="wm-kpi-progress">
              <div
                className="wm-progress-fill-main"
                style={{
                  width: `${staffList.length > 0 ? (activeStaffCount / staffList.length) * 100 : 0}%`,
                }}
              />
            </div>
          </div>

          {/* Card 2: TODAY'S APPOINTMENTS / CAPACITY */}
          <div className="wm-kpi-card">
            <div>
              <div className="wm-kpi-header">
                <span className="wm-kpi-label">TODAY&apos;S UTILIZATION</span>
                <span className="wm-kpi-icon-circle util">🪑</span>
              </div>
              <div className="wm-kpi-val">
                {staffList.length > 0 ? `${totalBookingsCount} Booked` : "0% Booked"}
              </div>
              <div className="wm-kpi-subtext">
                {staffList.length > 0
                  ? `${totalBookingsCount} booked appointments across team`
                  : "No staff assigned yet"}
              </div>
            </div>
            <div className="wm-kpi-progress">
              <div
                className="wm-progress-fill-main"
                style={{
                  width: `${
                    staffList.length > 0
                      ? Math.min(100, Math.round((totalBookingsCount / (staffList.length * 8)) * 100))
                      : 0
                  }%`,
                }}
              />
            </div>
          </div>

          {/* Card 3: TOP SPECIALIST */}
          <div className="wm-kpi-card">
            <div>
              <div className="wm-kpi-header">
                <span className="wm-kpi-label">TOP SPECIALIST</span>
                <span className="wm-kpi-icon-circle top">💡</span>
              </div>
              <div className="wm-kpi-val">
                {topPerformer ? topPerformer.full_name : "No Specialists"}
              </div>
              <div className="wm-kpi-subtext">
                {topPerformer
                  ? `${topPerformer.specialization} • ${topPerformer.capacity_booked} bookings`
                  : "Add workers to track performance"}
              </div>
            </div>
            {topPerformer && (
              <div className="wm-kpi-trend">
                <span>★ {topPerformer.rating}</span>
                <span>• {topPerformer.status_label}</span>
              </div>
            )}
          </div>

          {/* Card 4: ALLOCATED STATIONS */}
          <div className="wm-kpi-card">
            <div>
              <div className="wm-kpi-header">
                <span className="wm-kpi-label">STATIONS ALLOCATED</span>
                <span className="wm-kpi-icon-circle payout">📍</span>
              </div>
              <div className="wm-kpi-val">
                {staffList.length > 0
                  ? `${new Set(staffList.map((s) => s.chair)).size} Stations`
                  : "0 Stations"}
              </div>
              <div className="wm-kpi-subtext">
                {salonInfo?.name || "Indiranagar Flagship Salon"}
              </div>
            </div>
            <div className="wm-kpi-footer-sync">
              <span>Live Salon Sync</span>
              <span>Backend Connected</span>
            </div>
          </div>
        </section>

        {/* --------------------------------------------------------------------
            MAIN SPLIT VIEW: ROSTER & INSPECTION SIDEBAR OR EMPTY STATE
            -------------------------------------------------------------------- */}
        {loadingWorkers ? (
          <div className="wm-loading-container">
            <div className="wm-loading-spinner" />
            <p className="wm-loading-text">Loading salon team &amp; specialists...</p>
          </div>
        ) : staffList.length === 0 ? (
          <div className="wm-empty-roster-card">
            <div className="wm-empty-icon-box">👥</div>
            <h3 className="wm-empty-title">No Workers Added Yet</h3>
            <p className="wm-empty-desc">
              Your salon doesn&apos;t have any team members or stylists registered yet.
              Add specialists to assign styling chairs, configure service menus, and automatically generate email login credentials.
            </p>
            <Link to="/owner/add-worker" className="btn-wm-add-worker-cta">
              <span>+ Add First Worker</span>
            </Link>
          </div>
        ) : filteredStaff.length === 0 ? (
          <div className="wm-empty-roster-card">
            <div className="wm-empty-icon-box">🔍</div>
            <h3 className="wm-empty-title">No Matching Workers Found</h3>
            <p className="wm-empty-desc">
              No salon workers matched &ldquo;{searchQuery}&rdquo; or your current filter selection.
            </p>
            <button
              type="button"
              className="btn-wm-clear-filters"
              onClick={() => {
                setSearchQuery("");
                setDepartmentFilter("all");
                setStatusFilter("all");
              }}
            >
              Reset All Filters
            </button>
          </div>
        ) : (
          <div className="wm-split-layout">
            {/* Left Column: Staff Roster */}
            <section className="wm-roster-column">
              <div className="wm-roster-header">
                <h2 className="wm-roster-title">
                  Staff Roster &amp; Chair Allocation ({filteredStaff.length})
                </h2>
                <span className="wm-roster-shifts-note">
                  Active team roster for {salonInfo.name}
                </span>
              </div>

              {filteredStaff.map((staff) => {
                const isSelected = staff.id === selectedStaffId;
                const isOff = !staff.is_active || staff.status === "OFF_SHIFT";

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
                            {staff.full_name.charAt(0).toUpperCase()}
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
                            ({staff.reviews_count} bookings) • Tier:{" "}
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
                        ) : (
                          <button
                            type="button"
                            className="btn-wm-action pause"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedStaffId(staff.id);
                              handleChangeFloorState("Inactive");
                            }}
                          >
                            ⏸ Mark Inactive / Off Shift
                          </button>
                        )}
                        <button
                          type="button"
                          className="btn-wm-action"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedStaffId(staff.id);
                            showToast(`Contact: ${staff.phone} • ${staff.email}`);
                          }}
                        >
                          📞 View Contact
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </section>

            {/* Right Column: Specialist Inspection Sidebar */}
            {selectedSpecialist && (
              <aside className="wm-inspector-card">
                <div className="wm-inspector-header-top">
                  <span className="wm-inspector-section-label">SPECIALIST INSPECTION</span>
                  <span className="wm-chair-badge">{selectedSpecialist.chair}</span>
                </div>

                <h3 className="wm-inspector-name">{selectedSpecialist.full_name}</h3>
                <p className="wm-inspector-sub">
                  {selectedSpecialist.specialization.split("&")[0]} • {salonInfo.name}
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
                    <span className="wm-inspector-detail-label">Worker Email:</span>
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
                  <div className="wm-inspector-detail-row">
                    <span className="wm-inspector-detail-label">Commission Tier:</span>
                    <span className="wm-inspector-detail-val">{selectedSpecialist.commission_tier}</span>
                  </div>
                </div>

                {/* SERVICE MATRIX */}
                <div className="wm-field-block">
                  <div className="wm-matrix-header">
                    <span className="wm-field-title" style={{ margin: 0 }}>
                      SERVICE MATRIX
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
                          title="Click to toggle service capability"
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
                      SHIFT HOURS
                    </span>
                  </div>

                  <div className="wm-shift-box">
                    <div className="wm-shift-row">
                      <span className="wm-shift-label">Working Hours:</span>
                      <span className="wm-shift-val">{selectedSpecialist.shift_hours}</span>
                    </div>
                    <div className="wm-shift-row">
                      <span className="wm-shift-label">Daily Lunch Break:</span>
                      <span className="wm-shift-val">{selectedSpecialist.lunch_break}</span>
                    </div>
                  </div>
                </div>
              </aside>
            )}
          </div>
        )}
      </main>

      {/* --------------------------------------------------------------------
          FOOTER
          -------------------------------------------------------------------- */}
      <footer className="wm-page-footer">
        <div className="wm-page-footer-inner">
          <div>
            <strong>BookMySalon Partner</strong> • Staff Shift Allocation &amp; Commission Registry Engine
          </div>
          <div className="wm-footer-links">
            <span className="wm-footer-link">
              Active Salon: {salonInfo.name}
            </span>
          </div>
        </div>
      </footer>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="wm-toast">
          ✓ {toastMessage}
        </div>
      )}
    </div>
  );
}
