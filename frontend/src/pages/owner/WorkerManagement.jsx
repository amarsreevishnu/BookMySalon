import { useState, useEffect, useMemo, useCallback } from "react";
import { Link } from "react-router-dom";
import api from "../../api/axios";
import OwnerNavbar from "../../components/owner/OwnerNavbar";
import OwnerNavbarHeader from "../../components/owner/OwnerNavbarHeader";
import OwnerStickyFooter from "../../components/owner/OwnerStickyFooter";
import "../../styles/workerManagement.css";

const DAYS_OF_WEEK = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

const SPECIALIZATION_OPTIONS = [
  "Senior Hair Stylist",
  "Master Colorist",
  "Barber & Grooming Specialist",
  "Skin & Aesthetics Therapist",
  "Spa & Ayurvedic Specialist",
  "Nail & Manicure Artist",
  "Bridal Makeup Specialist",
  "Hair & Scalp Therapist",
];

const EXPERIENCE_OPTIONS = [
  "1-2 Years (Junior Stylist)",
  "3-5 Years (Specialist)",
  "5-8 Years (Senior Specialist)",
  "8+ Years (Master Stylist / Director)",
];

const EMPLOYMENT_STATUS_OPTIONS = [
  "Full-Time Specialist",
  "Part-Time Specialist",
  "Contract Specialist",
  "Freelance Consultant",
];

const COMMISSION_PRESETS = [
  { label: "Apprentice (40%)", rate: 40, tier: "Tier 1 • Junior Specialist (40%)" },
  { label: "Standard (50%)", rate: 50, tier: "Standard Specialist (50%)" },
  { label: "Senior (60% - Default)", rate: 60, tier: "Tier 2 • Senior Specialist (60%)" },
  { label: "Lead (70%)", rate: 70, tier: "Tier 3 • Lead Specialist (70%)" },
  { label: "Master (80%)", rate: 80, tier: "Tier 4 • Master Director (80%)" },
];

export default function WorkerManagement() {
  // State: Staff roster data fetched from backend
  const [staffList, setStaffList] = useState([]);
  const [loadingWorkers, setLoadingWorkers] = useState(true);
  const [salonInfo, setSalonInfo] = useState({ name: "Your Salon", city: "", services: [] });
  const [availableSalonServices, setAvailableSalonServices] = useState([]);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [specializationFilter, setSpecializationFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all"); // 'all' | 'active' | 'blocked'
  const [toastMessage, setToastMessage] = useState("");

  // Action / Modal State
  const [viewingWorker, setViewingWorker] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [blockingWorkerId, setBlockingWorkerId] = useState(null);
  const [calcTestPrice, setCalcTestPrice] = useState(1000);

  // Edit Form in Modal
  const [editForm, setEditForm] = useState({
    full_name: "",
    phone_number: "",
    specialization: "",
    experience: "",
    station: "",
    employment_status: "",
    commission_tier: "",
    commission_rate: 60.0,
    time_in: "09:00",
    time_out: "19:00",
    weekly_off: "Wednesday",
    bio: "",
    assigned_services: [],
    is_active: true,
  });

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 3500);
  };

  // Load workers and salon services strictly from backend
  const loadWorkersFromBackend = useCallback(async () => {
    setLoadingWorkers(true);
    try {
      const res = await api.get("/salons/owner/workers/");
      if (res.data) {
        if (res.data.salon) {
          setSalonInfo(res.data.salon);
          const salonSvcs = res.data.salon.services || [];
          if (Array.isArray(salonSvcs) && salonSvcs.length > 0) {
            setAvailableSalonServices(salonSvcs);
          }
        }

        const backendWorkers = res.data.workers || (Array.isArray(res.data) ? res.data : []);

        const formatted = backendWorkers.map((bw) => {
          let shiftHoursObj = { time_in: "09:00 AM", time_out: "07:00 PM", weekly_off: "Wednesday" };
          if (bw.shift_hours && typeof bw.shift_hours === "object") {
            shiftHoursObj = {
              time_in: bw.shift_hours.time_in || "09:00 AM",
              time_out: bw.shift_hours.time_out || "07:00 PM",
              weekly_off: bw.shift_hours.weekly_off || "Wednesday",
            };
          } else if (typeof bw.shift_hours === "string" && bw.shift_hours.includes("–")) {
            const parts = bw.shift_hours.split("–");
            shiftHoursObj.time_in = parts[0]?.trim() || "09:00 AM";
            shiftHoursObj.time_out = parts[1]?.trim() || "07:00 PM";
          }

          // Normalize assigned services
          const servicesList = Array.isArray(bw.assigned_services) && bw.assigned_services.length > 0
            ? bw.assigned_services.map((s) => (typeof s === "string" ? s : s.name || s.title || "Service"))
            : Array.isArray(bw.specializations) && bw.specializations.length > 0
            ? bw.specializations
            : [bw.specialization || "General Salon Services"];

          return {
            id: bw.id,
            user_id: bw.user_id,
            full_name: bw.full_name || bw.email || "Staff Member",
            email: bw.email || "",
            phone_number: bw.phone_number || "Not provided",
            specialization: bw.specialization || "Specialist",
            experience: bw.experience || "Specialist",
            station: bw.station || "Station #01",
            employment_status: bw.employment_status || "Full-Time Specialist",
            commission_tier: bw.commission_tier || "Standard Tier",
            commission_rate: bw.commission_rate || 60.0,
            shift_hours: shiftHoursObj,
            assigned_services: servicesList,
            bio: bw.bio || "",
            profile_photo: bw.profile_photo || "",
            is_active: Boolean(bw.is_active),
            assigned_bookings_count: bw.assigned_bookings_count || 0,
            created_at: bw.created_at,
          };
        });

        setStaffList(formatted);
      }
    } catch (err) {
      console.error("Could not load salon workers:", err);
      showToast("Error loading workers directory.");
    } finally {
      setLoadingWorkers(false);
    }
  }, []);

  useEffect(() => {
    loadWorkersFromBackend();
  }, [loadWorkersFromBackend]);

  // Derived KPI metrics
  const activeStaffCount = useMemo(() => staffList.filter((s) => s.is_active).length, [staffList]);
  const blockedStaffCount = useMemo(() => staffList.filter((s) => !s.is_active).length, [staffList]);
  const totalAllocatedStations = useMemo(
    () => new Set(staffList.map((s) => s.station)).size,
    [staffList]
  );

  // Extract unique specializations for filter dropdown
  const uniqueSpecializations = useMemo(() => {
    const set = new Set();
    staffList.forEach((s) => {
      if (s.specialization) set.add(s.specialization.trim());
    });
    return Array.from(set);
  }, [staffList]);

  // Filter staff list
  const filteredStaff = useMemo(() => {
    return staffList.filter((staff) => {
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        staff.full_name.toLowerCase().includes(q) ||
        staff.email.toLowerCase().includes(q) ||
        staff.phone_number.toLowerCase().includes(q) ||
        staff.specialization.toLowerCase().includes(q) ||
        staff.station.toLowerCase().includes(q) ||
        staff.assigned_services.some((srv) => srv.toLowerCase().includes(q));

      const matchSpec =
        specializationFilter === "all" ||
        staff.specialization.toLowerCase() === specializationFilter.toLowerCase();

      const matchStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && staff.is_active) ||
        (statusFilter === "blocked" && !staff.is_active);

      return matchSearch && matchSpec && matchStatus;
    });
  }, [staffList, searchQuery, specializationFilter, statusFilter]);

  // Handle Block / Unblock Worker (One-click toggle)
  const handleToggleBlock = async (worker) => {
    setBlockingWorkerId(worker.id);
    const newStatus = !worker.is_active;
    try {
      await api.patch(`/salons/owner/workers/${worker.id}/`, {
        is_active: newStatus,
      });

      setStaffList((prev) =>
        prev.map((s) => (s.id === worker.id ? { ...s, is_active: newStatus } : s))
      );

      if (viewingWorker && viewingWorker.id === worker.id) {
        setViewingWorker((prev) => ({ ...prev, is_active: newStatus }));
        setEditForm((prev) => ({ ...prev, is_active: newStatus }));
      }

      showToast(
        newStatus
          ? `✓ ${worker.full_name} has been unblocked. Account active.`
          : `🔒 ${worker.full_name} has been blocked. Account access revoked.`
      );
    } catch (err) {
      console.error("Failed to update worker active status:", err);
      alert("Failed to update worker status: " + (err.response?.data?.error || err.message));
    } finally {
      setBlockingWorkerId(null);
    }
  };

  // Open Edit Modal
  const handleOpenEditModal = (worker) => {
    setViewingWorker(worker);
    setCalcTestPrice(1000);
    setEditForm({
      full_name: worker.full_name,
      phone_number: worker.phone_number === "Not provided" ? "" : worker.phone_number,
      specialization: worker.specialization,
      experience: worker.experience,
      station: worker.station,
      employment_status: worker.employment_status,
      commission_tier: worker.commission_tier || "Tier 2 • Senior Specialist (60%)",
      commission_rate: worker.commission_rate !== undefined ? Number(worker.commission_rate) : 60,
      time_in: worker.shift_hours?.time_in || "09:00 AM",
      time_out: worker.shift_hours?.time_out || "07:00 PM",
      weekly_off: worker.shift_hours?.weekly_off || "Wednesday",
      bio: worker.bio || "",
      assigned_services: [...worker.assigned_services],
      is_active: worker.is_active,
    });
  };

  // Select Commission Preset
  const handleSelectCommissionPreset = (preset) => {
    setEditForm((prev) => ({
      ...prev,
      commission_rate: preset.rate,
      commission_tier: preset.tier,
    }));
  };

  const activeCommissionRate = Math.min(
    100,
    Math.max(0, Number(editForm.commission_rate) || 0)
  );
  const calculatedWorkerEarning = ((calcTestPrice * activeCommissionRate) / 100).toFixed(2);
  const calculatedSalonShare = Math.max(0, calcTestPrice - Number(calculatedWorkerEarning)).toFixed(2);

  // Close Edit Modal
  const handleCloseEditModal = () => {
    setViewingWorker(null);
  };

  // Toggle assigned service in modal
  const handleToggleAssignedService = (serviceName) => {
    setEditForm((prev) => {
      const exists = prev.assigned_services.includes(serviceName);
      return {
        ...prev,
        assigned_services: exists
          ? prev.assigned_services.filter((s) => s !== serviceName)
          : [...prev.assigned_services, serviceName],
      };
    });
  };

  // Save changes from Edit Modal
  const handleSaveWorker = async (e) => {
    e.preventDefault();
    if (!viewingWorker) return;

    if (!editForm.full_name.trim()) {
      alert("Worker full name is required.");
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        full_name: editForm.full_name.trim(),
        phone_number: editForm.phone_number.trim(),
        specialization: editForm.specialization.trim(),
        experience: editForm.experience.trim(),
        station: editForm.station.trim(),
        employment_status: editForm.employment_status.trim(),
        commission_tier: editForm.commission_tier.trim(),
        commission_rate: Number(editForm.commission_rate) || 60.0,
        bio: editForm.bio.trim(),
        assigned_services: editForm.assigned_services,
        shift_hours: {
          time_in: editForm.time_in,
          time_out: editForm.time_out,
          weekly_off: editForm.weekly_off,
        },
        is_active: editForm.is_active,
      };

      const res = await api.patch(`/salons/owner/workers/${viewingWorker.id}/`, payload);
      const updated = res.data?.worker;

      setStaffList((prev) =>
        prev.map((s) => {
          if (s.id !== viewingWorker.id) return s;
          return {
            ...s,
            full_name: payload.full_name,
            phone_number: payload.phone_number || "Not provided",
            specialization: payload.specialization,
            experience: payload.experience,
            station: payload.station,
            employment_status: payload.employment_status,
            commission_tier: payload.commission_tier,
            commission_rate: payload.commission_rate,
            bio: payload.bio,
            assigned_services: payload.assigned_services,
            shift_hours: payload.shift_hours,
            is_active: payload.is_active,
            ...(updated || {}),
          };
        })
      );

      showToast(`✓ Specialist ${editForm.full_name} updated successfully!`);
      setViewingWorker(null);
    } catch (err) {
      console.error("Failed to save worker edits:", err);
      alert("Failed to save worker changes: " + (err.response?.data?.error || err.message));
    } finally {
      setIsSaving(false);
    }
  };

  // Combined list of service options (from salon services + any currently assigned services)
  const allSelectableServices = useMemo(() => {
    const names = new Set();
    availableSalonServices.forEach((s) => {
      if (s.name) names.add(s.name);
      else if (typeof s === "string") names.add(s);
    });
    if (viewingWorker) {
      viewingWorker.assigned_services.forEach((s) => names.add(s));
    }
    // Fallback standard services if salon has not created services yet
    if (names.size === 0) {
      return ["Haircut", "Hair Styling", "Beard Trim", "Hair Spa", "Facial Treatment", "Head Massage"];
    }
    return Array.from(names);
  }, [availableSalonServices, viewingWorker]);

  return (
    <div className="wm-page-wrapper">
      {/* Top Navbar Header & Owner Navigation */}
      <OwnerNavbarHeader
        onNotificationsClick={() => showToast("All system alerts up to date.")}
      />
      <OwnerNavbar activeTab="Workers" workersCount={staffList.length} />

      {/* Main Container */}
      <main className="wm-main-container">
        {/* Breadcrumb */}
        <div className="wm-breadcrumb">
          <Link to="/owner/dashboard" className="wm-breadcrumb-item">
            Owner Dashboard
          </Link>
          <span>/</span>
          <span className="wm-breadcrumb-item active">Worker Management</span>
        </div>

        {/* Header Row */}
        <div className="wm-header-row">
          <div>
            <h1 className="wm-header-title">Worker &amp; Staff Management</h1>
            <p className="wm-header-subtitle">
             
              <strong>{salonInfo.name}</strong>.
            </p>
          </div>

          <div className="wm-header-actions">
            <button
              type="button"
              className="btn-wm-refresh"
              onClick={loadWorkersFromBackend}
              disabled={loadingWorkers}
              title="Reload staff roster"
            >
              🔄 Refresh
            </button>

            <Link to="/owner/workers/new" className="btn-wm-add-worker">
              <span>+ Add New Worker</span>
            </Link>
          </div>
        </div>

        {/* KPI Summary Cards */}
        <section className="wm-kpi-grid">
          <div className="wm-kpi-card">
            <div className="wm-kpi-header">
              <span className="wm-kpi-label">TOTAL REGISTERED STAFF</span>
              <span className="wm-kpi-icon-circle">👥</span>
            </div>
            <div className="wm-kpi-val">{staffList.length} Specialists</div>
            <div className="wm-kpi-subtext">
              {activeStaffCount} Active · {blockedStaffCount} Blocked / Inactive
            </div>
          </div>

          <div className="wm-kpi-card">
            <div className="wm-kpi-header">
              <span className="wm-kpi-label">ACTIVE ON FLOOR</span>
              <span className="wm-kpi-icon-circle">🟢</span>
            </div>
            <div className="wm-kpi-val" style={{ color: "#166534" }}>
              {activeStaffCount} Active
            </div>
            <div className="wm-kpi-subtext">Available to take client bookings</div>
          </div>

          <div className="wm-kpi-card">
            <div className="wm-kpi-header">
              <span className="wm-kpi-label">BLOCKED / SUSPENDED</span>
              <span className="wm-kpi-icon-circle">🔒</span>
            </div>
            <div className="wm-kpi-val" style={{ color: blockedStaffCount > 0 ? "#b91c1c" : "inherit" }}>
              {blockedStaffCount} Blocked
            </div>
            <div className="wm-kpi-subtext">Access revoked from bookings</div>
          </div>

          <div className="wm-kpi-card">
            <div className="wm-kpi-header">
              <span className="wm-kpi-label">ALLOCATED STATIONS</span>
              <span className="wm-kpi-icon-circle">🪑</span>
            </div>
            <div className="wm-kpi-val">{totalAllocatedStations} Stations</div>
            <div className="wm-kpi-subtext">{salonInfo.city || "Salon Floor Layout"}</div>
          </div>
        </section>

        {/* Search & Filter Toolbar */}
        <section className="wm-search-filters-card">
          <div className="wm-search-input-wrap">
            <span className="wm-search-icon">🔍</span>
            <input
              type="text"
              className="wm-search-input"
              placeholder="Search staff by name, email, phone, specialization, station..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="wm-filters-row">
            {/* Specialization Filter */}
            <select
              className="wm-filter-dropdown"
              value={specializationFilter}
              onChange={(e) => setSpecializationFilter(e.target.value)}
            >
              <option value="all">All Specializations ⌵</option>
              {uniqueSpecializations.map((spec) => (
                <option key={spec} value={spec}>
                  {spec}
                </option>
              ))}
            </select>

            {/* Status Filter */}
            <select
              className="wm-filter-dropdown"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">Status: All Staff ⌵</option>
              <option value="active">Active Only</option>
              <option value="blocked">Blocked / Suspended</option>
            </select>
          </div>
        </section>

        {/* Staff Table Card */}
        <section className="wm-table-card">
          <div className="wm-table-header-bar">
            <div>
              <h2 className="wm-table-header-title">Staff Directory &amp; Permissions</h2>
              <p className="wm-table-header-sub">
                Click <strong>View / Edit</strong> to update worker details or use the action buttons to block/unblock access.
              </p>
            </div>
            <span className="wm-table-stats-badge">
              Showing {filteredStaff.length} of {staffList.length} staff
            </span>
          </div>

          <div className="wm-table-container">
            <table className="wm-table">
              <thead>
                <tr>
                  <th>Specialist</th>
                  <th>Contact Info</th>
                 
                  <th>Assigned Services</th>
                  <th>Shift &amp; Hours</th>
                  <th>Commission</th>
                  <th>Status</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loadingWorkers ? (
                  <tr>
                    <td colSpan={8}>
                      <div className="wm-empty-table-box">
                        <span style={{ fontSize: "24px" }}>🔄</span>
                        <div className="wm-empty-heading" style={{ marginTop: 8 }}>
                          Loading salon team &amp; specialists...
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : filteredStaff.length === 0 ? (
                  <tr>
                    <td colSpan={8}>
                      <div className="wm-empty-table-box">
                        <span className="wm-empty-icon">👥</span>
                        <div className="wm-empty-heading">No staff members found</div>
                        <div className="wm-empty-subtext">
                          {searchQuery || specializationFilter !== "all" || statusFilter !== "all"
                            ? "No specialists match your search criteria. Try adjusting or clearing your filters."
                            : "Your salon has no staff members registered yet. Add your first worker to get started."}
                        </div>
                        {searchQuery || specializationFilter !== "all" || statusFilter !== "all" ? (
                          <button
                            type="button"
                            className="btn-wm-refresh"
                            onClick={() => {
                              setSearchQuery("");
                              setSpecializationFilter("all");
                              setStatusFilter("all");
                            }}
                          >
                            Reset Filters
                          </button>
                        ) : (
                          <Link to="/owner/workers/new" className="btn-wm-add-worker">
                            + Add First Worker
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredStaff.map((staff) => {
                    const isBlocked = !staff.is_active;
                    return (
                      <tr key={staff.id} className={isBlocked ? "row-blocked" : ""}>
                        {/* Specialist Cell */}
                        <td>
                          <div className="wm-staff-cell">
                            <div className="wm-staff-avatar">
                              {staff.profile_photo ? (
                                <img
                                  src={staff.profile_photo}
                                  alt={staff.full_name}
                                  onError={(e) => {
                                    e.target.style.display = "none";
                                  }}
                                />
                              ) : (
                                staff.full_name.charAt(0).toUpperCase()
                              )}
                            </div>
                            <div className="wm-staff-info">
                              <div className="wm-staff-name-wrap">
                                <span className="wm-staff-name">{staff.full_name}</span>
                                
                              </div>
                              <span className="wm-staff-spec">{staff.specialization}</span>
                              
                            </div>
                          </div>
                        </td>

                        {/* Contact Info Cell */}
                        <td>
                          <div className="wm-contact-cell">
                            <div className="wm-contact-line">
                              <span>✉️</span>
                              <a href={`mailto:${staff.email}`}>{staff.email}</a>
                            </div>
                            <div className="wm-contact-line">
                              <span>📞</span>
                              <span>{staff.phone_number}</span>
                            </div>
                          </div>
                        </td>

                       

                        {/* Assigned Services Cell */}
                        <td>
                          <div className="wm-services-cell">
                            {staff.assigned_services.slice(0, 3).map((srv, idx) => (
                              <span key={idx} className="wm-service-chip">
                                {srv}
                              </span>
                            ))}
                            {staff.assigned_services.length > 3 && (
                              <span className="wm-service-chip more">
                                +{staff.assigned_services.length - 3} more
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Shift & Hours Cell */}
                        <td>
                          <div className="wm-shift-cell">
                            <span className="wm-shift-hours">
                              🕒 {staff.shift_hours.time_in} – {staff.shift_hours.time_out}
                            </span>
                            <span className="wm-shift-off">
                              📅 Off: <strong>{staff.shift_hours.weekly_off}</strong>
                            </span>
                          </div>
                        </td>

                        {/* Commission Cell */}
                        <td>
                          <div className="wm-commission-cell">
                            <div
                              className="wm-commission-badge"
                              onClick={() => handleOpenEditModal(staff)}
                              style={{ cursor: "pointer" }}
                              title="Click to edit worker commission rate"
                            >
                              <span>💰</span>
                              <span>{staff.commission_rate}% Commission</span>
                            </div>
                           
                            <span className="wm-commission-split-preview">
                              {staff.experience && (
                                  <span className="wm-role-pill">
                                    {staff.experience.split("(")[0].trim()}
                                  </span>
                                )}
                            </span>
                          </div>
                        </td>

                        {/* Status Cell */}
                        <td>
                          {staff.is_active ? (
                            <span className="wm-status-pill active">
                              <span className="wm-status-dot" />
                              <span>Active</span>
                            </span>
                          ) : (
                            <span className="wm-status-pill blocked">
                              <span className="wm-status-dot" />
                              <span>Blocked</span>
                            </span>
                          )}
                        </td>

                        {/* Actions Cell */}
                        <td>
                          <div className="wm-actions-cell" style={{ justifyContent: "flex-end" }}>
                            {/* View / Edit Modal Trigger */}
                            <button
                              type="button"
                              className="btn-wm-action-view"
                              onClick={() => handleOpenEditModal(staff)}
                              title="View & Edit Worker Details"
                            >
                              <span>👁️ View / Edit</span>
                            </button>

                            {/* Block / Unblock Action Button */}
                            {staff.is_active ? (
                              <button
                                type="button"
                                className="btn-wm-action-block"
                                onClick={() => handleToggleBlock(staff)}
                                disabled={blockingWorkerId === staff.id}
                                title="Block this worker from appointments and dashboard login"
                              >
                                <span>🔒 Block</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                className="btn-wm-action-unblock"
                                onClick={() => handleToggleBlock(staff)}
                                disabled={blockingWorkerId === staff.id}
                                title="Unblock this worker and restore full access"
                              >
                                <span>🔓 Unblock</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      {/* View & Edit Worker Modal */}
      {viewingWorker && (
        <div
          className="wm-modal-backdrop"
          onClick={(e) => {
            if (e.target.classList.contains("wm-modal-backdrop")) {
              handleCloseEditModal();
            }
          }}
        >
          <div className="wm-modal-card">
            {/* Modal Header */}
            <div className="wm-modal-header">
              <div className="wm-modal-header-left">
                <div className="wm-modal-avatar">
                  {viewingWorker.profile_photo ? (
                    <img src={viewingWorker.profile_photo} alt={viewingWorker.full_name} />
                  ) : (
                    viewingWorker.full_name.charAt(0).toUpperCase()
                  )}
                </div>
                <div>
                  <h3 className="wm-modal-title">{viewingWorker.full_name}</h3>
                  <p className="wm-modal-sub">
                    Worker ID #{viewingWorker.id} · {viewingWorker.email} · {salonInfo.name}
                  </p>
                </div>
              </div>

              <button
                type="button"
                className="wm-modal-close-btn"
                onClick={handleCloseEditModal}
                title="Close modal"
              >
                ✕
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveWorker} className="wm-modal-body">
              {/* Section 1: Personal & Contact */}
              <div className="wm-modal-section">
                <h4 className="wm-modal-section-title">👤 Specialist Profile &amp; Contact</h4>
                <div className="wm-form-grid-2">
                  <div className="wm-form-group">
                    <label className="wm-form-label">Full Name *</label>
                    <input
                      type="text"
                      className="wm-form-input"
                      value={editForm.full_name}
                      onChange={(e) =>
                        setEditForm((prev) => ({ ...prev, full_name: e.target.value }))
                      }
                      required
                    />
                  </div>

                  <div className="wm-form-group">
                    <label className="wm-form-label">Contact Phone Number</label>
                    <input
                      type="text"
                      className="wm-form-input"
                      value={editForm.phone_number}
                      onChange={(e) =>
                        setEditForm((prev) => ({ ...prev, phone_number: e.target.value }))
                      }
                      placeholder="+91 9876543210"
                    />
                  </div>
                </div>

                <div className="wm-form-grid-2">
                  <div className="wm-form-group">
                    <label className="wm-form-label">Worker Email (Login Account)</label>
                    <input
                      type="email"
                      className="wm-form-input"
                      value={viewingWorker.email}
                      disabled
                      title="Worker email cannot be changed as it is the registered login identity"
                    />
                  </div>

                  <div className="wm-form-group">
                    <label className="wm-form-label">Employment Type</label>
                    <select
                      className="wm-form-select"
                      value={editForm.employment_status}
                      onChange={(e) =>
                        setEditForm((prev) => ({ ...prev, employment_status: e.target.value }))
                      }
                    >
                      {EMPLOYMENT_STATUS_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Section 2: Specialization & Chair Allocation */}
              <div className="wm-modal-section">
                <h4 className="wm-modal-section-title">🪑 Role, Specialization &amp; Station</h4>
                <div className="wm-form-grid-3">
                  <div className="wm-form-group">
                    <label className="wm-form-label">Specialization</label>
                    <select
                      className="wm-form-select"
                      value={editForm.specialization}
                      onChange={(e) =>
                        setEditForm((prev) => ({ ...prev, specialization: e.target.value }))
                      }
                    >
                      {SPECIALIZATION_OPTIONS.map((spec) => (
                        <option key={spec} value={spec}>
                          {spec}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="wm-form-group">
                    <label className="wm-form-label">Experience Level</label>
                    <select
                      className="wm-form-select"
                      value={editForm.experience}
                      onChange={(e) =>
                        setEditForm((prev) => ({ ...prev, experience: e.target.value }))
                      }
                    >
                      {EXPERIENCE_OPTIONS.map((exp) => (
                        <option key={exp} value={exp}>
                          {exp}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="wm-form-group">
                    <label className="wm-form-label">Station / Chair Allocation</label>
                    <input
                      type="text"
                      className="wm-form-input"
                      value={editForm.station}
                      onChange={(e) =>
                        setEditForm((prev) => ({ ...prev, station: e.target.value }))
                      }
                      placeholder="e.g. Chair #02 • Styling Bay 1"
                    />
                  </div>
                </div>
              </div>

              {/* Section 3: Shift Hours & Weekly Off */}
              <div className="wm-modal-section">
                <h4 className="wm-modal-section-title">🕒 Operating Shift &amp; Working Hours</h4>
                <div className="wm-form-grid-3">
                  <div className="wm-form-group">
                    <label className="wm-form-label">Shift Start Time</label>
                    <input
                      type="text"
                      className="wm-form-input"
                      value={editForm.time_in}
                      onChange={(e) =>
                        setEditForm((prev) => ({ ...prev, time_in: e.target.value }))
                      }
                      placeholder="09:00 AM"
                    />
                  </div>

                  <div className="wm-form-group">
                    <label className="wm-form-label">Shift End Time</label>
                    <input
                      type="text"
                      className="wm-form-input"
                      value={editForm.time_out}
                      onChange={(e) =>
                        setEditForm((prev) => ({ ...prev, time_out: e.target.value }))
                      }
                      placeholder="07:00 PM"
                    />
                  </div>

                  <div className="wm-form-group">
                    <label className="wm-form-label">Weekly Off Day</label>
                    <select
                      className="wm-form-select"
                      value={editForm.weekly_off}
                      onChange={(e) =>
                        setEditForm((prev) => ({ ...prev, weekly_off: e.target.value }))
                      }
                    >
                      {DAYS_OF_WEEK.map((day) => (
                        <option key={day} value={day}>
                          {day}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Section 4: Commission Settings & Live Calculator */}
              <div className="wm-modal-section">
                <h4 className="wm-modal-section-title">
                  💰 Worker Commission &amp; Compensation Model
                </h4>
                <p style={{ margin: "0 0 6px 0", fontSize: "12px", color: "var(--wm-text-muted)" }}>
                  Decide the commission percentage this specialist earns per completed service. The payout split is calculated automatically upon booking completion.
                </p>

                <div className="wm-commission-container">
                  {/* Preset Pills */}
                  <div>
                    <span style={{ fontSize: "11px", fontWeight: "700", color: "var(--wm-text-muted)", textTransform: "uppercase" }}>
                      Quick Commission Presets:
                    </span>
                    <div className="wm-commission-presets-row" style={{ marginTop: "6px" }}>
                      {COMMISSION_PRESETS.map((preset) => {
                        const isSelected = Number(editForm.commission_rate) === preset.rate;
                        return (
                          <button
                            key={preset.rate}
                            type="button"
                            className={`wm-commission-preset-pill ${isSelected ? "active" : ""}`}
                            onClick={() => handleSelectCommissionPreset(preset)}
                          >
                            {preset.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Manual Inputs: Tier Label & Custom Percentage */}
                  <div className="wm-commission-rate-row">
                    <div className="wm-form-group">
                      <label className="wm-form-label">Commission Tier Label</label>
                      <input
                        type="text"
                        className="wm-form-input"
                        value={editForm.commission_tier}
                        onChange={(e) =>
                          setEditForm((prev) => ({ ...prev, commission_tier: e.target.value }))
                        }
                        placeholder="e.g. Tier 2 • Senior Specialist"
                      />
                    </div>

                    <div className="wm-form-group">
                      <label className="wm-form-label">Worker Commission Rate (%) *</label>
                      <div style={{ position: "relative" }}>
                        <input
                          type="number"
                          step="0.5"
                          min="0"
                          max="100"
                          className="wm-form-input"
                          style={{ paddingRight: "36px", fontWeight: "700", color: "#166534" }}
                          value={editForm.commission_rate}
                          onChange={(e) =>
                            setEditForm((prev) => ({
                              ...prev,
                              commission_rate: Math.min(100, Math.max(0, e.target.value)),
                            }))
                          }
                          required
                        />
                        <span
                          style={{
                            position: "absolute",
                            right: "12px",
                            top: "50%",
                            transform: "translateY(-50%)",
                            fontSize: "13px",
                            fontWeight: "700",
                            color: "var(--wm-text-muted)",
                          }}
                        >
                          %
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Range Slider */}
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="1"
                      value={activeCommissionRate}
                      onChange={(e) =>
                        setEditForm((prev) => ({
                          ...prev,
                          commission_rate: Number(e.target.value),
                        }))
                      }
                      style={{
                        flex: 1,
                        accentColor: "var(--wm-primary)",
                        cursor: "pointer",
                      }}
                    />
                    <span style={{ fontSize: "12px", fontWeight: "700", minWidth: "48px", textAlign: "right", color: "var(--wm-primary)" }}>
                      {activeCommissionRate}%
                    </span>
                  </div>

                  {/* Live Calculation Preview Card */}
                  <div className="wm-commission-calc-box">
                    <div className="wm-commission-calc-header">
                      <span>🧮 Live Commission Calculation Preview</span>
                      <span style={{ fontSize: "11px", color: "var(--wm-text-muted)", fontWeight: "500" }}>
                        Real-time revenue split
                      </span>
                    </div>

                    <div className="wm-commission-test-input-row">
                      <div className="wm-commission-price-input-wrap">
                        <span>Test Service Price: ₹</span>
                        <input
                          type="number"
                          min="1"
                          max="100000"
                          step="50"
                          className="wm-commission-price-input"
                          value={calcTestPrice}
                          onChange={(e) => setCalcTestPrice(Math.max(1, Number(e.target.value) || 0))}
                        />
                      </div>

                      <div className="wm-commission-quick-chips">
                        {[500, 1000, 2000, 5000].map((amt) => (
                          <button
                            key={amt}
                            type="button"
                            className={`wm-commission-quick-chip ${calcTestPrice === amt ? "active" : ""}`}
                            onClick={() => setCalcTestPrice(amt)}
                          >
                            ₹{amt.toLocaleString()}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Split Cards */}
                    <div className="wm-commission-split-grid">
                      <div className="wm-commission-split-card worker">
                        <span className="wm-split-card-label">💇 Worker Payout</span>
                        <span className="wm-split-card-amount">₹{calculatedWorkerEarning}</span>
                        <span className="wm-split-card-sub">
                          {activeCommissionRate}% of ₹{calcTestPrice.toLocaleString()} service
                        </span>
                      </div>

                      <div className="wm-commission-split-card salon">
                        <span className="wm-split-card-label">🏪 Salon Owner Retention</span>
                        <span className="wm-split-card-amount">₹{calculatedSalonShare}</span>
                        <span className="wm-split-card-sub">
                          {(100 - activeCommissionRate).toFixed(1)}% retained by salon
                        </span>
                      </div>
                    </div>

                    {/* Split Visual Progress Bar */}
                    <div>
                      <div className="wm-commission-split-bar-wrap">
                        <div
                          className="wm-commission-split-bar-worker"
                          style={{ width: `${activeCommissionRate}%` }}
                          title={`Worker Share: ${activeCommissionRate}%`}
                        />
                        <div
                          className="wm-commission-split-bar-salon"
                          style={{ width: `${100 - activeCommissionRate}%` }}
                          title={`Salon Share: ${100 - activeCommissionRate}%`}
                        />
                      </div>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          fontSize: "10.5px",
                          color: "var(--wm-text-muted)",
                          marginTop: "4px",
                        }}
                      >
                        <span>Worker Share: {activeCommissionRate}%</span>
                        <span>Salon Share: {(100 - activeCommissionRate).toFixed(0)}%</span>
                      </div>
                    </div>

                    <div className="wm-commission-formula-note">
                      💡 <strong>Automated Payout Rule:</strong> When this worker completes any service appointment, BookMySalon automatically credits <strong>{activeCommissionRate}%</strong> of the service fee directly to their staff wallet, and deducts the payout from the salon's gross balance.
                    </div>
                  </div>
                </div>
              </div>

              {/* Section 5: Assigned Services */}
              <div className="wm-modal-section">
                <h4 className="wm-modal-section-title">
                  ✂️ Assigned Services Capability ({editForm.assigned_services.length} Selected)
                </h4>
                <p style={{ margin: "0 0 6px 0", fontSize: "12px", color: "var(--wm-text-muted)" }}>
                  Select which services this staff specialist is authorized to perform for clients.
                </p>
                <div className="wm-services-checkbox-grid">
                  {allSelectableServices.map((srvName) => {
                    const isChecked = editForm.assigned_services.includes(srvName);
                    return (
                      <label key={srvName} className="wm-service-check-item">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleAssignedService(srvName)}
                        />
                        <span>{srvName}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Section 6: Account Access & Status (Block / Unblock) */}
              <div className="wm-modal-section">
                <h4 className="wm-modal-section-title">🔒 Platform Access &amp; Floor Status</h4>
                <div className="wm-status-control-box">
                  <div className="wm-status-control-info">
                    <h4>
                      Account Status:{" "}
                      <span style={{ color: editForm.is_active ? "#15803d" : "#b91c1c" }}>
                        {editForm.is_active ? "Active & Permitted" : "Blocked & Suspended"}
                      </span>
                    </h4>
                    <p>
                      {editForm.is_active
                        ? "This specialist can sign in, receive customer bookings, and access their appointments dashboard."
                        : "Account is blocked. The specialist cannot log in and will not be assigned to new customer appointments."}
                    </p>
                  </div>

                  <button
                    type="button"
                    className={editForm.is_active ? "btn-wm-action-block" : "btn-wm-action-unblock"}
                    onClick={() =>
                      setEditForm((prev) => ({ ...prev, is_active: !prev.is_active }))
                    }
                  >
                    {editForm.is_active ? "🔒 Block Worker" : "🔓 Unblock Worker"}
                  </button>
                </div>
              </div>

              {/* Section 7: Bio / Notes */}
              <div className="wm-modal-section">
                <h4 className="wm-modal-section-title">📝 Bio &amp; Professional Notes</h4>
                <textarea
                  className="wm-form-textarea"
                  rows={3}
                  value={editForm.bio}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, bio: e.target.value }))}
                  placeholder="Additional notes, client feedback, or certifications..."
                />
              </div>

              {/* Modal Footer Actions */}
              <div className="wm-modal-footer">
                <button
                  type="button"
                  className="btn-wm-cancel"
                  onClick={handleCloseEditModal}
                  disabled={isSaving}
                >
                  Cancel
                </button>

                <button type="submit" className="btn-wm-save" disabled={isSaving}>
                  {isSaving ? "Saving Changes..." : "💾 Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Sticky Salon Details Footer */}
      <OwnerStickyFooter salonInfo={salonInfo} />

      {/* Toast Notification */}
      {toastMessage && <div className="wm-toast">{toastMessage}</div>}
    </div>
  );
}
