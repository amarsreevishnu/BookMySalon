import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api/axios";
import { useAuth } from "../../hooks/useAuth";
import AdminSidebar from "../../components/admin/AdminSidebar";
import UserViewModal from "../../components/admin/UserViewModal";
import "../../styles/adminSalonsList.css";
import "../../styles/adminUserList.css";

export default function AdminUserList() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const searchInputRef = useRef(null);

  // State
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("ALL"); // ALL | ACTIVE | BLOCKED
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("newest"); // newest | oldest | name-asc | name-desc
  const [inspectingUser, setInspectingUser] = useState(null);
  const [blockConfirmUser, setBlockConfirmUser] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10); // 10 customers per page default

  // Reset pagination to page 1 whenever filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, activeTab, sortBy, pageSize]);

  const showToast = (msg, duration = 3500) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? "" : prev));
    }, duration);
  };

  // Keyboard shortcut: '/' to search, 'Escape' to close modals
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "/" && document.activeElement !== searchInputRef.current) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      if (e.key === "Escape") {
        if (blockConfirmUser) {
          setBlockConfirmUser(null);
        } else if (inspectingUser) {
          setInspectingUser(null);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [blockConfirmUser, inspectingUser]);

  // Fetch Customers from Backend
  const fetchUsers = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("access_token");
      const config = token ? { headers: { Authorization: `Bearer ${token}` } } : {};
      const res = await api.get("/accounts/admin/users/?role=CUSTOMER", config);
      if (res.data) {
        setUsers(Array.isArray(res.data) ? res.data : []);
      }
    } catch (err) {
      console.error("Failed to fetch customers list:", err);
      if (err.response?.status === 401) {
        showToast("⚠️ Session expired or unauthorized. Redirecting to login...", 3000);
        setTimeout(() => navigate("/login"), 1500);
      } else {
        showToast("⚠️ Failed to load customers from server. Please refresh.", 4000);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // Trigger block action: asks for confirmation before blocking active customer; unblocks directly
  const handleInitiateBlock = (user) => {
    if (!user) return;
    if (user.is_active) {
      setBlockConfirmUser(user);
    } else {
      executeToggleBlock(user);
    }
  };

  // Alias so both handleToggleBlock and handleInitiateBlock resolve reliably
  const handleToggleBlock = handleInitiateBlock;

  // Perform backend call to block or unblock
  const executeToggleBlock = async (user) => {
    if (!user) return;
    setIsProcessing(true);
    try {
      const token = localStorage.getItem("access_token");
      const config = token ? { headers: { Authorization: `Bearer ${token}` } } : {};
      const res = await api.post(
        `/accounts/admin/users/${user.id}/toggle-block/`,
        {},
        config
      );

      const updatedUser = res.data.user;
      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? updatedUser : u))
      );

      if (inspectingUser && inspectingUser.id === user.id) {
        setInspectingUser(updatedUser);
      }

      showToast(
        updatedUser.is_active
          ? `✅ Customer ${updatedUser.email} has been unblocked.`
          : `🚫 Customer ${updatedUser.email} has been blocked.`
      );
      setBlockConfirmUser(null);
    } catch (err) {
      console.error("Failed to toggle user block status:", err);
      const errMsg = err.response?.data?.error || "Failed to update user block status.";
      showToast(`⚠️ ${errMsg}`, 4000);
    } finally {
      setIsProcessing(false);
    }
  };

  // Metrics calculation
  const totalCount = users.length;
  const activeCount = users.filter((u) => u.is_active).length;
  const blockedCount = users.filter((u) => !u.is_active).length;

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const newThisMonthCount = users.filter(
    (u) => u.date_joined && new Date(u.date_joined) >= thirtyDaysAgo
  ).length;

  // Filtered & Sorted Users
  const filteredUsers = users
    .filter((u) => {
      // Tab filter
      if (activeTab === "ACTIVE" && !u.is_active) return false;
      if (activeTab === "BLOCKED" && u.is_active) return false;

      // Search query
      const q = searchQuery.toLowerCase().trim();
      if (q) {
        const matches =
          (u.full_name && u.full_name.toLowerCase().includes(q)) ||
          (u.first_name && u.first_name.toLowerCase().includes(q)) ||
          (u.last_name && u.last_name.toLowerCase().includes(q)) ||
          (u.email && u.email.toLowerCase().includes(q)) ||
          String(u.id).includes(q);
        if (!matches) return false;
      }
      return true;
    })
    .sort((a, b) => {
      if (sortBy === "newest") {
        return new Date(b.date_joined || 0) - new Date(a.date_joined || 0);
      }
      if (sortBy === "oldest") {
        return new Date(a.date_joined || 0) - new Date(b.date_joined || 0);
      }
      if (sortBy === "name-asc") {
        return (a.full_name || a.email || "").localeCompare(b.full_name || b.email || "");
      }
      if (sortBy === "name-desc") {
        return (b.full_name || b.email || "").localeCompare(a.full_name || a.email || "");
      }
      return 0;
    });

  // Pagination Calculations
  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / pageSize));
  const validCurrentPage = Math.min(Math.max(1, currentPage), totalPages);
  const startIndex = (validCurrentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, filteredUsers.length);
  const paginatedUsers = filteredUsers.slice(startIndex, endIndex);

  // Helper for generating page numbers with smart ellipsis
  const getPageNumbers = () => {
    if (totalPages <= 5) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    if (validCurrentPage <= 3) {
      return [1, 2, 3, 4, "...", totalPages];
    }
    if (validCurrentPage >= totalPages - 2) {
      return [1, "...", totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    }
    return [
      1,
      "...",
      validCurrentPage - 1,
      validCurrentPage,
      validCurrentPage + 1,
      "...",
      totalPages,
    ];
  };

  // CSV Export
  const exportUsersCSV = () => {
    if (!filteredUsers.length) {
      showToast("No customers available to export.", 2500);
      return;
    }
    const headers = [
      "ID",
      "Full Name",
      "Email",
      "Role",
      "Status",
      "Joined Date",
      "Last Login",
    ];
    const rows = filteredUsers.map((u) => [
      u.id,
      `"${u.full_name || ""}"`,
      `"${u.email || ""}"`,
      u.role || "CUSTOMER",
      u.is_active ? "Active" : "Blocked",
      u.date_joined ? new Date(u.date_joined).toISOString().slice(0, 10) : "",
      u.last_login ? new Date(u.last_login).toISOString().slice(0, 10) : "Never",
    ]);
    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `bookmysalon-customers-${activeTab.toLowerCase()}-${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="asl-layout">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          style={{
            position: "fixed",
            top: 20,
            right: 20,
            background: "#1e3a29",
            color: "#ffffff",
            padding: "14px 20px",
            borderRadius: "10px",
            boxShadow: "0 10px 25px rgba(0,0,0,0.2)",
            zIndex: 9999,
            fontSize: "13px",
            display: "flex",
            alignItems: "center",
            gap: "12px",
            border: "1px solid rgba(255,255,255,0.15)",
          }}
        >
          <span>{toastMessage}</span>
          <button
            onClick={() => setToastMessage("")}
            style={{
              background: "none",
              border: "none",
              color: "#ffffff",
              fontSize: "14px",
              cursor: "pointer",
            }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Shared Admin Navigation Sidebar */}
      <AdminSidebar
        usersCount={totalCount}
        onLogout={handleLogout}
      />

      {/* Main Container */}
      <main className="asl-main">
        {/* Top Sticky Bar */}
        <header className="asl-topbar">
          <div className="asl-topbar-title">
            <span className="asl-breadcrumb">Super Admin /</span>
            <h1>Customer Users Directory</h1>
          </div>

          <div className="asl-topbar-actions">
            <button
              type="button"
              className="asl-btn-outline"
              onClick={fetchUsers}
              title="Refresh customer directory"
            >
              <span>🔄</span> Refresh
            </button>
            <button
              type="button"
              className="asl-btn-outline"
              onClick={exportUsersCSV}
              title="Export visible list to CSV"
            >
              <span>📥</span> Export CSV
            </button>
          </div>
        </header>

        {/* Body Content */}
        <div className="asl-body">
          {/* KPI Summary Cards */}
          <section className="asl-metrics-grid" aria-label="Customer metrics">
            <div
              className={`asl-metric-card ${activeTab === "ALL" ? "active-tab" : ""}`}
              onClick={() => setActiveTab("ALL")}
              style={{ cursor: "pointer" }}
            >
              <div className="asl-metric-top">
                <span className="asl-metric-label">All Customers</span>
                <div className="asl-metric-icon blue">👥</div>
              </div>
              <div className="asl-metric-value">{totalCount}</div>
              <div className="asl-metric-subtext">Registered customer accounts</div>
            </div>

            <div
              className={`asl-metric-card ${activeTab === "ACTIVE" ? "active-tab" : ""}`}
              onClick={() => setActiveTab("ACTIVE")}
              style={{ cursor: "pointer" }}
            >
              <div className="asl-metric-top">
                <span className="asl-metric-label">Active Customers</span>
                <div className="asl-metric-icon green">✓</div>
              </div>
              <div className="asl-metric-value" style={{ color: "#047857" }}>
                {activeCount}
              </div>
              <div className="asl-metric-subtext">Can browse & make bookings</div>
            </div>

            <div
              className={`asl-metric-card ${activeTab === "BLOCKED" ? "active-tab" : ""}`}
              onClick={() => setActiveTab("BLOCKED")}
              style={{ cursor: "pointer" }}
            >
              <div className="asl-metric-top">
                <span className="asl-metric-label">Blocked Customers</span>
                <div className="asl-metric-icon red">🚫</div>
              </div>
              <div className="asl-metric-value" style={{ color: "#b91c1c" }}>
                {blockedCount}
              </div>
              <div className="asl-metric-subtext">Restricted from platform access</div>
            </div>

            <div className="asl-metric-card">
              <div className="asl-metric-top">
                <span className="asl-metric-label">New This Month</span>
                <div className="asl-metric-icon purple">✨</div>
              </div>
              <div className="asl-metric-value" style={{ color: "#6b21a8" }}>
                {newThisMonthCount}
              </div>
              <div className="asl-metric-subtext">Joined within last 30 days</div>
            </div>
          </section>

          {/* Control Bar: Tabs + Search + Sort */}
          <div className="asl-controls-card">
            {/* Tabs */}
           

            {/* Toolbar Filters: Search & Sort */}
            <div className="asl-toolbar-filters">
              <div className="asl-search-wrap">
                <span className="asl-search-icon">🔍</span>
                <input
                  ref={searchInputRef}
                  type="search"
                  placeholder="Search customer name, email, ID... (Press '/' to focus)"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="asl-search-input"
                />
                {searchQuery && (
                  <button
                    type="button"
                    className="asl-search-clear"
                    onClick={() => setSearchQuery("")}
                    aria-label="Clear search"
                  >
                    ✕
                  </button>
                )}
              </div>

              <div className="asl-filter-group">
                <label htmlFor="user-sort-select" className="asl-filter-label">
                  Sort:
                </label>
                <select
                  id="user-sort-select"
                  className="asl-select"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                >
                  <option value="newest">Newest Joined</option>
                  <option value="oldest">Oldest Joined</option>
                  <option value="name-asc">Name (A–Z)</option>
                  <option value="name-desc">Name (Z–A)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Results Summary */}
          <div className="asl-results-bar">
            <span>
              Showing <strong>{filteredUsers.length}</strong> of {totalCount} customers
              {activeTab !== "ALL" && ` (${activeTab.toLowerCase()})`}
              {searchQuery && ` matching "${searchQuery}"`}
            </span>
            {(searchQuery || activeTab !== "ALL") && (
              <button
                type="button"
                className="asl-link-btn"
                onClick={() => {
                  setSearchQuery("");
                  setActiveTab("ALL");
                }}
              >
                Reset filters
              </button>
            )}
          </div>

          {/* Loading Skeleton */}
          {loading && (
            <div className="asl-loading-wrap">
              <div className="asl-spinner" />
              <p>Loading customers directory...</p>
            </div>
          )}

          {/* Empty State */}
          {!loading && filteredUsers.length === 0 && (
            <div className="asl-empty-card">
              <div className="asl-empty-icon">👥</div>
              <h3>No customers found</h3>
              <p>
                {searchQuery
                  ? `No customer profiles matching "${searchQuery}". Try a different search term.`
                  : activeTab !== "ALL"
                  ? `There are currently no customers under the "${activeTab.toLowerCase()}" filter.`
                  : "No registered customers have signed up yet."}
              </p>
              {(searchQuery || activeTab !== "ALL") && (
                <button
                  type="button"
                  className="asl-btn-primary"
                  style={{ marginTop: 16 }}
                  onClick={() => {
                    setSearchQuery("");
                    setActiveTab("ALL");
                  }}
                >
                  Show All Customers
                </button>
              )}
            </div>
          )}

          {/* Customers Table */}
          {!loading && filteredUsers.length > 0 && (
            <div className="asl-table-card">
              <div className="asl-table-responsive">
                <table className="asl-table" aria-label="Customers directory table">
                  <thead>
                    <tr>
                      <th style={{ width: "30%" }}>Customer Profile</th>
                      <th style={{ width: "25%" }}>Email Address</th>
                      <th style={{ width: "12%" }}>Role</th>
                      <th style={{ width: "12%" }}>Status</th>
                      <th style={{ width: "13%" }}>Joined Date</th>
                      <th style={{ width: "8%", textAlign: "center" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedUsers.map((user, index) => {
                      const initial =
                        user.first_name?.[0]?.toUpperCase() ||
                        user.email?.[0]?.toUpperCase() ||
                        "C";

                      return (
                        <tr key={user.id} className={!user.is_active ? "row-blocked" : ""}>
                          {/* Profile / Thumb */}
                          <td>
                            <div className="asl-user-info-cell">
                              <div className="asl-user-thumb-wrap">
                                {user.avatar ? (
                                  <img
                                    src={user.avatar}
                                    alt={user.full_name || user.email}
                                    className="asl-user-thumb"
                                    onError={(e) => {
                                      e.target.style.display = "none";
                                      e.target.nextSibling.style.display = "flex";
                                    }}
                                  />
                                ) : null}
                                <div
                                  className="asl-user-thumb"
                                  style={{
                                    display: user.avatar ? "none" : "flex",
                                  }}
                                >
                                  {initial}
                                </div>
                                <span
                                  className={
                                    user.is_active
                                      ? "asl-user-thumb-online"
                                      : "asl-user-thumb-blocked"
                                  }
                                  title={user.is_active ? "Active account" : "Blocked account"}
                                />
                              </div>

                              <div className="asl-user-meta">
                                <div className="asl-user-name-title">
                                  {user.full_name || "Unnamed Customer"}
                                </div>
                                <span className="asl-user-id-sub">
                                  #CUST-{index+1}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* Email Address */}
                          <td>
                            <div className="asl-contact-cell">
                              <span className="asl-contact-city">{user.email}</span>
                            </div>
                          </td>

                          {/* Role */}
                          <td>
                            <span className="asl-badge-pill customer">
                              Customer
                            </span>
                          </td>

                          {/* Status */}
                          <td>
                            {user.is_active ? (
                              <span className="asl-status-badge approved">
                                <span
                                  style={{
                                    width: 6,
                                    height: 6,
                                    borderRadius: "50%",
                                    background: "#10b981",
                                  }}
                                />
                                Active
                              </span>
                            ) : (
                              <span className="asl-status-badge blocked">
                                <span
                                  style={{
                                    width: 6,
                                    height: 6,
                                    borderRadius: "50%",
                                    background: "#ef4444",
                                  }}
                                />
                                Blocked
                              </span>
                            )}
                          </td>

                          {/* Joined Date */}
                          <td>
                            <span style={{ fontSize: 13, color: "#495e50" }}>
                              {user.date_joined
                                ? new Date(user.date_joined).toLocaleDateString(undefined, {
                                    year: "numeric",
                                    month: "short",
                                    day: "numeric",
                                  })
                                : "—"}
                            </span>
                          </td>

                          {/* Actions (Icon-Only Buttons) */}
                          <td style={{ textAlign: "center" }}>
                            <div className="asl-icon-actions-wrap" style={{ justifyContent: "center" }}>
                              {/* View User Modal Trigger */}
                              <button
                                type="button"
                                className="asl-action-icon-btn view"
                                title="View Customer Details"
                                onClick={() => setInspectingUser(user)}
                                aria-label={`View details for ${user.full_name || user.email}`}
                              >
                                👁️
                              </button>

                              {/* Block / Unblock Action Button */}
                              {user.is_active ? (
                                <button
                                  type="button"
                                  className="asl-action-icon-btn block"
                                  title="Block Customer"
                                  disabled={isProcessing}
                                  onClick={() => handleInitiateBlock(user)}
                                  aria-label={`Block customer ${user.full_name || user.email}`}
                                >
                                  🚫
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  className="asl-action-icon-btn unblock"
                                  title="Unblock Customer"
                                  disabled={isProcessing}
                                  onClick={() => handleInitiateBlock(user)}
                                  aria-label={`Unblock customer ${user.full_name || user.email}`}
                                >
                                  🔓
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

              {/* Pagination Footer */}
              {filteredUsers.length > 0 && (
                <div className="asl-pagination-bar">
                  <div className="asl-pagination-info">
                    Showing <strong>{filteredUsers.length === 0 ? 0 : startIndex + 1}</strong> to{" "}
                    <strong>{endIndex}</strong> of <strong>{filteredUsers.length}</strong> customers
                  </div>

                  <div className="asl-pagination-controls">
                    {/* Rows per page selector */}
                    <div className="asl-pagination-size-select">
                      <label htmlFor="user-page-size">Per page:</label>
                      <select
                        id="user-page-size"
                        value={pageSize}
                        onChange={(e) => setPageSize(Number(e.target.value))}
                        className="asl-select-compact"
                      >
                        <option value={5}>5</option>
                        <option value={10}>10</option>
                        <option value={20}>20</option>
                        <option value={50}>50</option>
                      </select>
                    </div>

                    {/* Navigation Buttons */}
                    <div className="asl-pagination-buttons">
                      <button
                        type="button"
                        className="asl-pagination-btn"
                        disabled={validCurrentPage === 1}
                        onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                        aria-label="Previous Page"
                      >
                        ‹ Prev
                      </button>

                      {getPageNumbers().map((pageNum, idx) => {
                        if (pageNum === "...") {
                          return (
                            <span key={`ellipsis-${idx}`} className="asl-pagination-ellipsis">
                              …
                            </span>
                          );
                        }
                        return (
                          <button
                            key={pageNum}
                            type="button"
                            className={`asl-pagination-btn ${
                              pageNum === validCurrentPage ? "active" : ""
                            }`}
                            onClick={() => setCurrentPage(pageNum)}
                          >
                            {pageNum}
                          </button>
                        );
                      })}

                      <button
                        type="button"
                        className="asl-pagination-btn"
                        disabled={validCurrentPage === totalPages}
                        onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                        aria-label="Next Page"
                      >
                        Next ›
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* View User Details Modal */}
      <UserViewModal
        user={inspectingUser}
        onClose={() => setInspectingUser(null)}
        onToggleBlock={handleInitiateBlock}
        isProcessing={isProcessing}
      />

      {/* ======================================================================
          BLOCK CONFIRMATION MODAL (Yes or Cancel)
         ====================================================================== */}
      {blockConfirmUser && (
        <div
          className="asl-modal-backdrop user-modal-backdrop"
          onClick={() => !isProcessing && setBlockConfirmUser(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Confirm Block Customer Modal"
          style={{ zIndex: 100000 }}
        >
          <div
            className="asl-dialog-panel user-confirm-panel"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="user-confirm-content">
              <div className="user-confirm-icon-wrap">
                <span>⚠️</span>
              </div>
              <div className="user-confirm-text">
                <h3>Block Customer Account?</h3>
                <p>
                  Are you sure you want to block{" "}
                  <strong style={{ color: "#172a1d" }}>
                    {blockConfirmUser.full_name || blockConfirmUser.email}
                  </strong>{" "}
                  (<code>#CUST-{blockConfirmUser.id}</code>)?
                  <br />
                  <br />
                  This customer will be restricted from accessing the platform and cannot log in or make appointments.
                </p>
              </div>
            </div>

            <div className="user-confirm-actions">
              <button
                type="button"
                className="asl-btn-outline"
                disabled={isProcessing}
                onClick={() => setBlockConfirmUser(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="asl-btn-danger"
                disabled={isProcessing}
                onClick={() => executeToggleBlock(blockConfirmUser)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "9px 18px",
                  borderRadius: 8,
                  background: "#dc2626",
                  color: "#ffffff",
                  border: "none",
                  fontWeight: 600,
                  fontSize: "13px",
                  cursor: "pointer",
                }}
              >
                <span>🚫</span>
                <span>{isProcessing ? "Blocking..." : "Yes, Block User"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}