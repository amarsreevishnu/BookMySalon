import { useState, useEffect, useRef, useCallback } from "react";
import AdminSidebar from "../../components/admin/AdminSidebar";
import api from "../../api/axios";
import "../../styles/adminSupport.css";

const CATEGORIES = [
  { value: "ALL", label: "All Categories" },
  { value: "TECHNICAL", label: "Technical Issue" },
  { value: "PAYMENT", label: "Payment Problem" },
  { value: "BOOKING", label: "Booking Issue" },
  { value: "ACCOUNT", label: "Account-related Problem" },
  { value: "OTHER", label: "Other Difficulties" },
];

const STATUSES = [
  { value: "ALL", label: "All Statuses" },
  { value: "OPEN", label: "Open" },
  { value: "IN_PROGRESS", label: "In Progress" },
  { value: "WAITING_FOR_CUSTOMER", label: "Waiting for Customer" },
  { value: "RESOLVED", label: "Resolved" },
  { value: "CLOSED", label: "Closed" },
];

const PRIORITIES = [
  { value: "ALL", label: "All Priorities" },
  { value: "URGENT", label: "Urgent" },
  { value: "HIGH", label: "High" },
  { value: "MEDIUM", label: "Medium" },
  { value: "LOW", label: "Low" },
];

export default function AdminSupport() {
  const [tickets, setTickets] = useState([]);
  const [stats, setStats] = useState({
    total_tickets: 0,
    open_tickets: 0,
    in_progress_tickets: 0,
    waiting_customer_tickets: 0,
    resolved_tickets: 0,
    closed_tickets: 0,
    urgent_tickets: 0,
    unread_messages_count: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [priorityFilter, setPriorityFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Active Ticket Management Modal
  const [activeTicket, setActiveTicket] = useState(null);
  const [ticketLoading, setTicketLoading] = useState(false);

  // Admin reply state
  const [replyText, setReplyText] = useState("");
  const [replyFile, setReplyFile] = useState(null);
  const [statusOnReply, setStatusOnReply] = useState("");
  const [replyLoading, setReplyLoading] = useState(false);
  const [replyError, setReplyError] = useState("");

  // Status/Priority quick updates
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [updatingPriority, setUpdatingPriority] = useState(false);

  const chatBottomRef = useRef(null);

  // Fetch Stats
  const fetchStats = async () => {
    try {
      const res = await api.get("/support/admin/stats/");
      setStats(res.data || {});
    } catch (err) {
      console.error("Failed to load admin stats:", err);
    }
  };

  // Fetch Tickets List
  const fetchTickets = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = {
        page,
        status: statusFilter,
        category: categoryFilter,
        priority: priorityFilter,
      };
      if (search.trim()) params.search = search.trim();

      const res = await api.get("/support/admin/tickets/", { params });
      setTickets(res.data?.tickets || []);
      setTotalCount(res.data?.total_count || 0);
      setTotalPages(res.data?.total_pages || 1);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || "Failed to load support tickets.");
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, categoryFilter, priorityFilter, search]);

  useEffect(() => {
    fetchStats();
    fetchTickets();
  }, [fetchTickets]);

  // Open ticket detail
  const handleOpenTicket = async (ticketId) => {
    setTicketLoading(true);
    setReplyError("");
    setReplyText("");
    setReplyFile(null);
    setStatusOnReply("");
    try {
      const res = await api.get(`/support/admin/tickets/${ticketId}/`);
      setActiveTicket(res.data);
      // Mark unread as read in local table list
      setTickets((prev) =>
        prev.map((t) => (t.id === ticketId ? { ...t, unread_count: 0 } : t))
      );
      fetchStats();
    } catch (err) {
      console.error(err);
      alert("Could not load ticket details.");
    } finally {
      setTicketLoading(false);
    }
  };

  // Scroll chat to bottom
  useEffect(() => {
    if (activeTicket) {
      setTimeout(() => {
        chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    }
  }, [activeTicket]);

  // Admin Send Reply
  const handleSendReply = async (e) => {
    e.preventDefault();
    if (!replyText.trim() && !replyFile) {
      setReplyError("Please enter a reply message or attach a file.");
      return;
    }
    if (!activeTicket) return;

    setReplyLoading(true);
    setReplyError("");

    try {
      const formData = new FormData();
      formData.append("message", replyText.trim());
      if (replyFile) formData.append("attachment", replyFile);
      if (statusOnReply) formData.append("status_update", statusOnReply);

      const res = await api.post(
        `/support/admin/tickets/${activeTicket.id}/reply/`,
        formData,
        { headers: { "Content-Type": "multipart/form-data" } }
      );

      setReplyText("");
      setReplyFile(null);
      setStatusOnReply("");

      // Append reply to conversation
      if (res.data?.message) {
        setActiveTicket((prev) => ({
          ...prev,
          status: res.data.ticket_status || prev.status,
          status_display: res.data.ticket_status_display || prev.status_display,
          messages: [...(prev.messages || []), res.data.message],
        }));
      }

      fetchTickets();
      fetchStats();
    } catch (err) {
      console.error(err);
      setReplyError(err.response?.data?.error || "Failed to send admin reply.");
    } finally {
      setReplyLoading(false);
    }
  };

  // Direct Status Update
  const handleUpdateStatus = async (newStatus) => {
    if (!activeTicket || updatingStatus) return;
    setUpdatingStatus(true);
    try {
      const res = await api.patch(
        `/support/admin/tickets/${activeTicket.id}/status/`,
        { status: newStatus }
      );
      setActiveTicket(res.data);
      fetchTickets();
      fetchStats();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.error || "Failed to update status.");
    } finally {
      setUpdatingStatus(false);
    }
  };

  // Direct Priority Update
  const handleUpdatePriority = async (newPriority) => {
    if (!activeTicket || updatingPriority) return;
    setUpdatingPriority(true);
    try {
      const res = await api.patch(
        `/support/admin/tickets/${activeTicket.id}/priority/`,
        { priority: newPriority }
      );
      setActiveTicket(res.data);
      fetchTickets();
      fetchStats();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.error || "Failed to update priority.");
    } finally {
      setUpdatingPriority(false);
    }
  };

  return (
    <div className="admin-support-layout">
      <AdminSidebar activeTab="SUPPORT" />

      <main className="admin-support-main">
        {/* Header */}
        <div className="as-header-row">
          <div className="as-title-wrap">
            <h1>🎫 Support Ticket Central Management</h1>
            <p>
              Review, communicate, prioritize, and resolve support requests from all registered salon owners.
            </p>
          </div>
        </div>

        {/* Top Metric Cards */}
        <div className="as-metrics-grid">
          <div className="as-metric-card">
            <div className="as-metric-icon total">📁</div>
            <div>
              <span className="as-metric-label">Total Tickets</span>
              <div className="as-metric-val">{stats.total_tickets}</div>
            </div>
          </div>

          <div className="as-metric-card">
            <div className="as-metric-icon open">🟢</div>
            <div>
              <span className="as-metric-label">Open</span>
              <div className="as-metric-val">{stats.open_tickets}</div>
            </div>
          </div>

          <div className="as-metric-card">
            <div className="as-metric-icon progress">⚡</div>
            <div>
              <span className="as-metric-label">In Progress</span>
              <div className="as-metric-val">{stats.in_progress_tickets}</div>
            </div>
          </div>

          <div className="as-metric-card">
            <div className="as-metric-icon waiting">⏳</div>
            <div>
              <span className="as-metric-label">Waiting Salon</span>
              <div className="as-metric-val">{stats.waiting_customer_tickets}</div>
            </div>
          </div>

          <div className="as-metric-card">
            <div className="as-metric-icon resolved">✓</div>
            <div>
              <span className="as-metric-label">Resolved</span>
              <div className="as-metric-val">{stats.resolved_tickets}</div>
            </div>
          </div>

          <div className="as-metric-card">
            <div className="as-metric-icon closed">🔒</div>
            <div>
              <span className="as-metric-label">Closed</span>
              <div className="as-metric-val">{stats.closed_tickets}</div>
            </div>
          </div>

          <div className={`as-metric-card ${stats.urgent_tickets > 0 ? "urgent" : ""}`}>
            <div className="as-metric-icon urgent">🚨</div>
            <div>
              <span className="as-metric-label">Urgent Action</span>
              <div className="as-metric-val" style={{ color: stats.urgent_tickets > 0 ? "#dc2626" : "inherit" }}>
                {stats.urgent_tickets}
              </div>
            </div>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="as-controls-card">
          <div className="as-search-input-wrap">
            <span className="as-search-icon">🔍</span>
            <input
              type="text"
              className="as-search-input"
              placeholder="Search by ticket #, salon name, subject, or owner email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="as-filters-group">
            <select
              className="as-select"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
            >
              {STATUSES.map((st) => (
                <option key={st.value} value={st.value}>
                  {st.label}
                </option>
              ))}
            </select>

            <select
              className="as-select"
              value={priorityFilter}
              onChange={(e) => {
                setPriorityFilter(e.target.value);
                setPage(1);
              }}
            >
              {PRIORITIES.map((pr) => (
                <option key={pr.value} value={pr.value}>
                  {pr.label}
                </option>
              ))}
            </select>

            <select
              className="as-select"
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                setPage(1);
              }}
            >
              {CATEGORIES.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>

            <button
              type="button"
              className="as-refresh-btn"
              onClick={() => {
                fetchTickets();
                fetchStats();
              }}
              title="Refresh tickets list"
            >
              🔄 Refresh
            </button>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div
            style={{
              background: "#fef2f2",
              border: "1px solid #fecaca",
              color: "#b91c1c",
              padding: "12px 18px",
              borderRadius: "10px",
              marginBottom: "20px",
            }}
          >
            ⚠️ {error}
          </div>
        )}

        {/* Tickets Table */}
        <div className="as-table-card">
          <div className="as-table-responsive">
            <table className="as-table">
              <thead>
                <tr>
                  <th>Ticket & Salon</th>
                  <th>Subject</th>
                  <th>Category</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Last Updated</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="7" style={{ textAlign: "center", padding: "40px", color: "#64748b" }}>
                      Loading tickets...
                    </td>
                  </tr>
                ) : tickets.length === 0 ? (
                  <tr>
                    <td colSpan="7" style={{ textAlign: "center", padding: "40px", color: "#64748b" }}>
                      No support tickets found matching current filters.
                    </td>
                  </tr>
                ) : (
                  tickets.map((t) => (
                    <tr key={t.id}>
                      <td>
                        <div className="as-ticket-cell">
                          <span className="as-tkt-num">{t.ticket_number}</span>
                          <span className="as-tkt-salon">🏪 {t.salon_name}</span>
                        </div>
                      </td>

                      <td>
                        <div style={{ fontWeight: 600, color: "#0f172a", maxWidth: "280px" }}>
                          {t.subject}
                        </div>
                        {t.unread_count > 0 && (
                          <span className="os-unread-badge" style={{ marginTop: "4px" }}>
                            ● {t.unread_count} Salon Reply
                          </span>
                        )}
                      </td>

                      <td>
                        <span style={{ fontSize: "0.82rem", color: "#475569", fontWeight: 600 }}>
                          {t.category_display}
                        </span>
                      </td>

                      <td>
                        <span className={`os-priority-badge ${t.priority.toLowerCase()}`}>
                          {t.priority_display}
                        </span>
                      </td>

                      <td>
                        <span className={`os-status-pill ${t.status.toLowerCase()}`}>
                          {t.status_display}
                        </span>
                      </td>

                      <td style={{ fontSize: "0.8rem", color: "#64748b", whiteSpace: "nowrap" }}>
                        {new Date(t.updated_at).toLocaleString("en-IN", {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>

                      <td style={{ textAlign: "right" }}>
                        <button
                          type="button"
                          className="as-manage-btn"
                          onClick={() => handleOpenTicket(t.id)}
                        >
                          Manage / Chat 💬
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Table Pagination */}
          <div className="as-pagination-bar">
            <span>
              Showing Page <strong>{page}</strong> of <strong>{totalPages}</strong> ({totalCount} Total Tickets)
            </span>
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                type="button"
                className="as-page-btn"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                ◀ Previous
              </button>
              <button
                type="button"
                className="as-page-btn"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Next ▶
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* =========================================================================
          ADMIN TICKET DETAIL & CONVERSATION MODAL
          ========================================================================= */}
      {activeTicket && (
        <div className="as-modal-backdrop" onClick={() => setActiveTicket(null)}>
          <div
            className="as-modal-dialog"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="as-modal-header">
              <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                <span className="as-tkt-num" style={{ fontSize: "1.1rem" }}>
                  {activeTicket.ticket_number}
                </span>
                <span style={{ fontSize: "1.15rem", fontWeight: 800, color: "#0f172a" }}>
                  {activeTicket.subject}
                </span>
                <span className={`os-status-pill ${activeTicket.status.toLowerCase()}`}>
                  {activeTicket.status_display}
                </span>
              </div>
              <button
                type="button"
                className="os-close-btn"
                onClick={() => setActiveTicket(null)}
              >
                ✕
              </button>
            </div>

            {/* Body (Split View) */}
            <div className="as-modal-body">
              {/* Left Pane: Conversation Stream */}
              <div className="as-conv-pane">
                <div className="os-chat-stream">
                  {/* Original Ticket Description */}
                  <div className="os-ticket-original-card" style={{ borderColor: "#cbd5e1" }}>
                    <div className="os-orig-header">
                      <span style={{ color: "#4f46e5" }}>Salon Issue Description</span>
                      <span>
                        {activeTicket.created_by_details?.name} ({activeTicket.created_by_details?.email})
                      </span>
                    </div>
                    <p className="os-orig-desc">{activeTicket.description}</p>
                    {activeTicket.attachment_url && (
                      <div>
                        <a
                          href={activeTicket.attachment_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="os-attachment-pill"
                          style={{ color: "#4f46e5" }}
                        >
                          📎 View Initial Attachment
                        </a>
                      </div>
                    )}
                  </div>

                  {/* Previous Messages */}
                  {activeTicket.messages?.map((msg) => {
                    const isAdmin = msg.sender_type === "SUPER_ADMIN";
                    return (
                      <div
                        key={msg.id}
                        className={`os-msg-row ${isAdmin ? "owner" : "admin"}`}
                        style={{
                          alignSelf: isAdmin ? "flex-end" : "flex-start",
                        }}
                      >
                        <div
                          className="os-msg-header"
                          style={{ justifyContent: isAdmin ? "flex-end" : "flex-start" }}
                        >
                          {isAdmin ? (
                            <>
                              <span className="os-admin-tag">You (Super Admin)</span>
                              <span>{msg.sender_name}</span>
                            </>
                          ) : (
                            <>
                              <span style={{ fontWeight: 700, color: "#0f766e" }}>Salon Owner</span>
                              <span>{msg.sender_name}</span>
                            </>
                          )}
                          <span>•</span>
                          <span>
                            {new Date(msg.created_at).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>

                        <div
                          className="os-msg-bubble"
                          style={{
                            background: isAdmin ? "#4f46e5" : "#ffffff",
                            color: isAdmin ? "#ffffff" : "#0f172a",
                            border: isAdmin ? "none" : "1px solid #e2e8f0",
                          }}
                        >
                          {msg.message}
                          {msg.attachment_url && (
                            <div>
                              <a
                                href={msg.attachment_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="os-msg-attachment-link"
                                style={{
                                  background: isAdmin ? "rgba(255,255,255,0.2)" : "#f1f5f9",
                                  color: isAdmin ? "#ffffff" : "#4f46e5",
                                }}
                              >
                                📎 Download Attachment
                              </a>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  <div ref={chatBottomRef} />
                </div>

                {/* Admin Reply Composer */}
                <div className="os-chat-composer">
                  {replyError && (
                    <div style={{ color: "#dc2626", fontSize: "0.82rem", marginBottom: "6px" }}>
                      ⚠️ {replyError}
                    </div>
                  )}

                  <form onSubmit={handleSendReply} className="os-composer-form">
                    <textarea
                      className="os-composer-textarea"
                      placeholder="Type your official administrative reply to the salon owner..."
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      rows={2}
                    />

                    <div className="os-composer-actions">
                      <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                        <label className="os-attach-btn">
                          📎 {replyFile ? replyFile.name : "Attach File"}
                          <input
                            type="file"
                            accept="image/*,.pdf,.doc,.docx,.txt"
                            style={{ display: "none" }}
                            onChange={(e) => setReplyFile(e.target.files[0] || null)}
                          />
                        </label>
                        {replyFile && (
                          <button
                            type="button"
                            onClick={() => setReplyFile(null)}
                            style={{ background: "none", border: "none", color: "#dc2626", cursor: "pointer", fontSize: "0.8rem" }}
                          >
                            Remove ✕
                          </button>
                        )}

                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <span style={{ fontSize: "0.76rem", color: "#64748b", fontWeight: 600 }}>
                            Status on send:
                          </span>
                          <select
                            className="as-select"
                            style={{ padding: "4px 8px", fontSize: "0.78rem" }}
                            value={statusOnReply}
                            onChange={(e) => setStatusOnReply(e.target.value)}
                          >
                            <option value="">Keep / Auto-transition</option>
                            <option value="WAITING_FOR_CUSTOMER">Waiting for Customer</option>
                            <option value="IN_PROGRESS">In Progress</option>
                            <option value="RESOLVED">Resolved</option>
                            <option value="CLOSED">Closed</option>
                          </select>
                        </div>
                      </div>

                      <button
                        type="submit"
                        className="as-manage-btn"
                        style={{ padding: "8px 20px" }}
                        disabled={replyLoading || (!replyText.trim() && !replyFile)}
                      >
                        {replyLoading ? "Sending Reply..." : "Send Reply ➤"}
                      </button>
                    </div>
                  </form>
                </div>
              </div>

              {/* Right Pane: Ticket Meta & Administration */}
              <div className="as-info-pane">
                {/* Salon Information */}
                <div className="as-info-block">
                  <h4 className="as-info-title">Salon & Owner Details</h4>
                  <div className="as-detail-row">
                    <span className="as-detail-label">Salon Name</span>
                    <span className="as-detail-val">{activeTicket.salon_details?.name}</span>
                  </div>
                  <div className="as-detail-row">
                    <span className="as-detail-label">Location / City</span>
                    <span className="as-detail-val">{activeTicket.salon_details?.city}</span>
                  </div>
                  <div className="as-detail-row">
                    <span className="as-detail-label">Owner Name</span>
                    <span className="as-detail-val">{activeTicket.created_by_details?.name}</span>
                  </div>
                  <div className="as-detail-row">
                    <span className="as-detail-label">Owner Email</span>
                    <span className="as-detail-val">{activeTicket.created_by_details?.email}</span>
                  </div>
                  {activeTicket.salon_details?.phone && (
                    <div className="as-detail-row">
                      <span className="as-detail-label">Phone</span>
                      <span className="as-detail-val">{activeTicket.salon_details.phone}</span>
                    </div>
                  )}
                </div>

                {/* Status & Priority Management */}
                <div className="as-info-block">
                  <h4 className="as-info-title">Status & Priority Controls</h4>

                  <div className="as-action-row">
                    <label className="as-action-label">Ticket Status</label>
                    <select
                      className="as-full-select"
                      value={activeTicket.status}
                      disabled={updatingStatus}
                      onChange={(e) => handleUpdateStatus(e.target.value)}
                    >
                      <option value="OPEN">Open</option>
                      <option value="IN_PROGRESS">In Progress</option>
                      <option value="WAITING_FOR_CUSTOMER">Waiting for Customer</option>
                      <option value="RESOLVED">Resolved</option>
                      <option value="CLOSED">Closed</option>
                    </select>
                  </div>

                  <div className="as-action-row">
                    <label className="as-action-label">Ticket Priority</label>
                    <select
                      className="as-full-select"
                      value={activeTicket.priority}
                      disabled={updatingPriority}
                      onChange={(e) => handleUpdatePriority(e.target.value)}
                    >
                      <option value="LOW">Low</option>
                      <option value="MEDIUM">Medium</option>
                      <option value="HIGH">High</option>
                      <option value="URGENT">Urgent</option>
                    </select>
                  </div>

                  <div className="as-detail-row" style={{ marginTop: "12px" }}>
                    <span className="as-detail-label">Category</span>
                    <span className="as-detail-val">{activeTicket.category_display}</span>
                  </div>
                  <div className="as-detail-row">
                    <span className="as-detail-label">Created At</span>
                    <span className="as-detail-val">
                      {new Date(activeTicket.created_at).toLocaleString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                </div>

                {/* Activity Log */}
                <div className="as-info-block" style={{ flex: 1, overflowY: "auto" }}>
                  <h4 className="as-info-title">Audit Trail ({activeTicket.activities?.length || 0})</h4>
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    {activeTicket.activities?.map((act) => (
                      <div
                        key={act.id}
                        style={{
                          fontSize: "0.78rem",
                          borderBottom: "1px solid #f1f5f9",
                          paddingBottom: "8px",
                        }}
                      >
                        <div style={{ fontWeight: 700, color: "#1e293b" }}>
                          {act.activity_type_display}
                        </div>
                        {act.details && <div style={{ color: "#475569" }}>{act.details}</div>}
                        <div style={{ color: "#94a3b8", fontSize: "0.72rem", marginTop: "2px" }}>
                          {new Date(act.created_at).toLocaleString("en-IN", {
                            day: "numeric",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}{" "}
                          by {act.user_name || "System"}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

