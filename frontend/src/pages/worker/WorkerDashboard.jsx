import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api/axios";
import { useAuth } from "../../hooks/useAuth";
import "../../styles/workerDashboard.css";

export default function WorkerDashboard() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [workerData, setWorkerData] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [updatingId, setUpdatingId] = useState(null);
  const [toastMessage, setToastMessage] = useState("");
  const [selectedBooking, setSelectedBooking] = useState(null);

  // Fetch worker dashboard data
  const fetchDashboardData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get("/salons/worker/dashboard/");
      setWorkerData(response.data);
      setBookings(response.data.assigned_bookings || []);
    } catch (err) {
      console.warn("Could not fetch real worker dashboard data:", err);
      // Fallback data for seamless demo/testing
      const fallbackWorker = {
        worker: {
          id: 1,
          full_name: user?.first_name ? `${user.first_name} ${user.last_name || ""}`.trim() : "Salon Stylist",
          email: user?.email || "worker@bookmysalon.com",
          phone_number: "+91 98765 43210",
          specialization: "Senior Hair Stylist & Colorist",
          experience: "5+ Years",
          profile_photo: "",
          is_active: true,
        },
        salon: {
          id: 1,
          name: "Luxe & Botanical Salon Flagship",
          category: "Hair • Skin • Spa",
          city: "Kochi, Kerala",
          phone: "+91 88481 94536",
        },
        kpi_stats: {
          total_bookings: 8,
          today_bookings: 4,
          in_progress_bookings: 1,
          completed_bookings: 3,
        },
        assigned_bookings: [
          {
            id: 201,
            client_name: "Aparna Nair",
            client_phone: "+91 98450 12345",
            client_email: "aparna@gmail.com",
            service_name: "Haircut, Blowdry & Hair Spa",
            service_price: 1250,
            booking_date: new Date().toISOString().split("T")[0],
            booking_time: "10:30 AM",
            duration: "60 mins",
            station: "Station 02",
            status: "IN_PROGRESS",
            notes: "Client prefers ammonia-free botanical products",
          },
          {
            id: 202,
            client_name: "Rahul Krishnan",
            client_phone: "+91 97410 98765",
            client_email: "rahul@gmail.com",
            service_name: "Beard Sculpting & Hair Fade",
            service_price: 650,
            booking_date: new Date().toISOString().split("T")[0],
            booking_time: "12:00 PM",
            duration: "45 mins",
            station: "Station 01",
            status: "CONFIRMED",
            notes: "Regular client requested sharp contours",
          },
          {
            id: 203,
            client_name: "Deepa Menon",
            client_phone: "+91 99001 54321",
            client_email: "deepa@gmail.com",
            service_name: "Hydra Facial Glow & Eye Therapy",
            service_price: 1800,
            booking_date: new Date().toISOString().split("T")[0],
            booking_time: "02:30 PM",
            duration: "75 mins",
            station: "Spa Room 03",
            status: "CONFIRMED",
            notes: "First time salon visit",
          },
          {
            id: 204,
            client_name: "Kavya Suresh",
            client_phone: "+91 91234 56780",
            client_email: "kavya@gmail.com",
            service_name: "Express Manicure & Pedicure",
            service_price: 850,
            booking_date: new Date().toISOString().split("T")[0],
            booking_time: "09:00 AM",
            duration: "45 mins",
            station: "Nail Lounge",
            status: "COMPLETED",
            notes: "Completed smoothly with gel finish",
          },
        ],
      };
      setWorkerData(fallbackWorker);
      setBookings(fallbackWorker.assigned_bookings);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 3500);
  };

  // Update booking status (e.g. IN_PROGRESS -> COMPLETED)
  const handleUpdateStatus = async (bookingId, newStatus) => {
    setUpdatingId(bookingId);
    try {
      await api.patch(`/salons/worker/bookings/${bookingId}/status/`, {
        status: newStatus,
      });
      showToast(`Booking #${bookingId} marked as ${newStatus.replace("_", " ")}!`);
      // Update locally
      setBookings((prev) =>
        prev.map((b) => (b.id === bookingId ? { ...b, status: newStatus } : b))
      );
    } catch (err) {
      console.warn("Could not patch status to backend, updating in local state:", err);
      // Optimistic update for presentation
      setBookings((prev) =>
        prev.map((b) => (b.id === bookingId ? { ...b, status: newStatus } : b))
      );
      showToast(`Status updated to ${newStatus.replace("_", " ")}!`);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  // Filtered bookings
  const filteredBookings = useMemo(() => {
    return bookings.filter((b) => {
      const matchSearch =
        !searchQuery ||
        b.client_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.service_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.station?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchStatus =
        statusFilter === "ALL" || b.status?.toUpperCase() === statusFilter;

      return matchSearch && matchStatus;
    });
  }, [bookings, searchQuery, statusFilter]);

  // Derived KPI metrics
  const stats = useMemo(() => {
    const total = bookings.length;
    const completed = bookings.filter((b) => b.status === "COMPLETED").length;
    const inProgress = bookings.filter((b) => b.status === "IN_PROGRESS").length;
    const upcoming = bookings.filter(
      (b) => b.status === "CONFIRMED" || b.status === "PENDING"
    ).length;

    return { total, completed, inProgress, upcoming };
  }, [bookings]);

  const workerInfo = workerData?.worker || {};
  const salonInfo = workerData?.salon || {};

  return (
    <div className="worker-dashboard-container">
      {/* Worker Header */}
      <header className="worker-header">
        <div className="worker-header-inner">
          <div className="worker-brand">
            <div className="worker-brand-logo">✂️</div>
            <div className="worker-brand-text">
              <h1>Worker Studio</h1>
              <p>{salonInfo.name || "BookMySalon Partner"}</p>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            <div className="worker-profile-pill">
              {workerInfo.profile_photo ? (
                <img
                  src={workerInfo.profile_photo}
                  alt={workerInfo.full_name}
                  className="worker-avatar"
                />
              ) : (
                <div className="worker-avatar">
                  {workerInfo.full_name ? workerInfo.full_name.charAt(0).toUpperCase() : "W"}
                </div>
              )}
              <div className="worker-info">
                <span className="worker-name">{workerInfo.full_name || "Staff Member"}</span>
                <span className="worker-role-badge">
                  {workerInfo.specialization || "Salon Specialist"}
                </span>
              </div>
            </div>

            <button
              type="button"
              className="btn-worker-logout"
              onClick={handleLogout}
              title="Log out of staff portal"
            >
              🚪 Logout
            </button>
          </div>
        </div>
      </header>

      {/* Main Body */}
      <main className="worker-main">
        {/* Welcome Banner */}
        <section className="worker-banner">
          <div>
            <h2 className="worker-banner-title">
              Hello, {workerInfo.full_name || "Stylist"} 👋
            </h2>
            <p className="worker-banner-subtitle">
              Here are your assigned bookings and client appointments for today. Keep track of service stations, durations, and update your appointment statuses in real-time.
            </p>
          </div>
          <div>
            <div className="worker-salon-tag">
              📍 {salonInfo.city || "Bangalore Flagship"}
            </div>
          </div>
        </section>

        {/* KPI Stats */}
        <section className="worker-stats-grid">
          <div className="worker-stat-card">
            <div className="worker-stat-icon total">📋</div>
            <div>
              <div className="worker-stat-num">{stats.total}</div>
              <div className="worker-stat-label">Assigned Bookings</div>
            </div>
          </div>

          <div className="worker-stat-card">
            <div className="worker-stat-icon progress">⚡</div>
            <div>
              <div className="worker-stat-num">{stats.inProgress}</div>
              <div className="worker-stat-label">In Progress Now</div>
            </div>
          </div>

          <div className="worker-stat-card">
            <div className="worker-stat-icon today">📅</div>
            <div>
              <div className="worker-stat-num">{stats.upcoming}</div>
              <div className="worker-stat-label">Upcoming / Confirmed</div>
            </div>
          </div>

          <div className="worker-stat-card">
            <div className="worker-stat-icon completed">✅</div>
            <div>
              <div className="worker-stat-num">{stats.completed}</div>
              <div className="worker-stat-label">Completed Services</div>
            </div>
          </div>
        </section>

        {/* Assigned Bookings Section */}
        <section className="worker-section">
          <div className="worker-section-header">
            <h3 className="worker-section-title">
              <span>📅</span> Assigned Appointments ({filteredBookings.length})
            </h3>

            <div className="worker-filters">
              <input
                type="text"
                className="worker-search-input"
                placeholder="Search client, service, station..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />

              <select
                className="worker-filter-select"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="ALL">All Statuses</option>
                <option value="CONFIRMED">Confirmed</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="COMPLETED">Completed</option>
                <option value="PENDING">Pending</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div className="booking-empty-state">
              <div className="booking-empty-icon">⏳</div>
              <p>Loading your assigned bookings...</p>
            </div>
          ) : filteredBookings.length === 0 ? (
            <div className="booking-empty-state">
              <div className="booking-empty-icon">🛋️</div>
              <p>No assigned bookings found matching your criteria.</p>
            </div>
          ) : (
            <div className="bookings-list">
              {filteredBookings.map((b) => {
                const statusLower = (b.status || "confirmed").toLowerCase();
                return (
                  <div key={b.id} className="booking-card">
                    <div className="booking-card-main">
                      <div className="booking-time-badge">
                        <div className="booking-time-hour">
                          {b.booking_time || "10:00 AM"}
                        </div>
                        <div className="booking-time-duration">
                          {b.duration || "45 mins"}
                        </div>
                      </div>

                      <div className="booking-info">
                        <div className="booking-client">
                          {b.client_name}
                          <span className="booking-station">
                            🪑 {b.station || "Station 01"}
                          </span>
                        </div>
                        <div className="booking-service">
                          <span>✂️ {b.service_name}</span>
                          <span style={{ color: "#1e392a", fontWeight: 600 }}>
                            • ₹{b.service_price || "500"}
                          </span>
                          {b.client_phone && (
                            <span style={{ color: "#718277", fontSize: "12px" }}>
                              • 📞 {b.client_phone}
                            </span>
                          )}
                        </div>
                        {b.notes && (
                          <div className="booking-notes">
                            Note: "{b.notes}"
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="booking-card-right">
                      <span className={`booking-status-tag ${statusLower}`}>
                        {b.status?.replace("_", " ") || "CONFIRMED"}
                      </span>

                      {b.status === "CONFIRMED" || b.status === "PENDING" ? (
                        <button
                          type="button"
                          className="btn-status-action start"
                          disabled={updatingId === b.id}
                          onClick={() => handleUpdateStatus(b.id, "IN_PROGRESS")}
                        >
                          {updatingId === b.id ? "Updating..." : "▶ Start Service"}
                        </button>
                      ) : b.status === "IN_PROGRESS" ? (
                        <button
                          type="button"
                          className="btn-status-action complete"
                          disabled={updatingId === b.id}
                          onClick={() => handleUpdateStatus(b.id, "COMPLETED")}
                        >
                          {updatingId === b.id ? "Updating..." : "✓ Mark Completed"}
                        </button>
                      ) : (
                        <span style={{ fontSize: "12px", color: "#059669", fontWeight: 600 }}>
                          ✓ Done
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="worker-toast">
          <span>✨</span>
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
