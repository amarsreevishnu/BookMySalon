import { useState, useEffect, useRef, useCallback } from "react";
import OwnerNavbar from "../../components/owner/OwnerNavbar";
import api from "../../api/axios";
import "../../styles/ownerSupport.css";

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
  { value: "LOW", label: "Low" },
  { value: "MEDIUM", label: "Medium" },
  { value: "HIGH", label: "High" },
  { value: "URGENT", label: "Urgent" },
];

export default function OwnerSupport() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [totalCount, setTotalCount] = useState(0);

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [priorityFilter, setPriorityFilter] = useState("ALL");
  const [page, setPage] = useState(1);

  // Modals & Active Ticket
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [activeTicket, setActiveTicket] = useState(null);
  const [ticketLoading, setTicketLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("conversation"); // "conversation" or "activity"

  // Reply state
  const [replyText, setReplyText] = useState("");
  const [replyFile, setReplyFile] = useState(null);
  const [replyLoading, setReplyLoading] = useState(false);
  const [replyError, setReplyError] = useState("");

  // Reopen state
  const [showReopenModal, setShowReopenModal] = useState(false);
  const [reopenReason, setReopenReason] = useState("");
  const [reopenLoading, setReopenLoading] = useState(false);
  const [reopenError, setReopenError] = useState("");

  // Create form state
  const [createSubject, setCreateSubject] = useState("");
  const [createCategory, setCreateCategory] = useState("TECHNICAL");
  const [createPriority, setCreatePriority] = useState("MEDIUM");
  const [createDescription, setCreateDescription] = useState("");
  const [createFile, setCreateFile] = useState(null);
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState("");

  const chatBottomRef = useRef(null);

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

      const res = await api.get("/support/owner/tickets/", { params });
      setTickets(res.data?.tickets || []);
      setTotalCount(res.data?.total_count || 0);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || "Failed to load support tickets.");
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, categoryFilter, priorityFilter, search]);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  // Open ticket detail and auto-clear unreads
  const handleOpenTicket = async (ticketId) => {
    setTicketLoading(true);
    setActiveTab("conversation");
    setReplyError("");
    try {
      const res = await api.get(`/support/owner/tickets/${ticketId}/`);
      setActiveTicket(res.data);
      // Update list to clear unread flag for this ticket
      setTickets((prev) =>
        prev.map((t) => (t.id === ticketId ? { ...t, unread_count: 0 } : t))
      );
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.error || "Could not load ticket details.");
    } finally {
      setTicketLoading(false);
    }
  };

  // Scroll chat to bottom
  useEffect(() => {
    if (activeTicket && activeTab === "conversation") {
      setTimeout(() => {
        chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    }
  }, [activeTicket, activeTab]);

  // Create Ticket
  const handleCreateTicket = async (e) => {
    e.preventDefault();
    if (!createSubject.trim()) {
      setCreateError("Please enter a ticket subject.");
      return;
    }
    if (createSubject.trim().length < 5) {
      setCreateError("Subject must be at least 5 characters long.");
      return;
    }
    if (!createDescription.trim() || createDescription.trim().length < 10) {
      setCreateError("Please provide a detailed description (at least 10 characters).");
      return;
    }

    setCreateLoading(true);
    setCreateError("");

    try {
      const formData = new FormData();
      formData.append("subject", createSubject.trim());
      formData.append("category", createCategory);
      formData.append("priority", createPriority);
      formData.append("description", createDescription.trim());
      if (createFile) {
        formData.append("attachment", createFile);
      }

      const res = await api.post("/support/owner/tickets/", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setShowCreateModal(false);
      setCreateSubject("");
      setCreateDescription("");
      setCreateFile(null);
      setCreatePriority("MEDIUM");
      setCreateCategory("TECHNICAL");

      // Reload list and open the newly created ticket
      fetchTickets();
      if (res.data?.id) {
        setActiveTicket(res.data);
      }
    } catch (err) {
      console.error(err);
      const data = err.response?.data;
      const errMsg =
        data?.detail ||
        data?.error ||
        (typeof data === "object" ? Object.values(data).flat().join(" ") : "Failed to create ticket.");
      setCreateError(errMsg);
    } finally {
      setCreateLoading(false);
    }
  };

  // Send Reply
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
      if (replyFile) {
        formData.append("attachment", replyFile);
      }

      const res = await api.post(
        `/support/owner/tickets/${activeTicket.id}/reply/`,
        formData,
        { headers: { "Content-Type": "multipart/form-data" } }
      );

      setReplyText("");
      setReplyFile(null);

      // Append message to active ticket conversation
      if (res.data?.message) {
        setActiveTicket((prev) => ({
          ...prev,
          status: res.data.ticket_status || prev.status,
          status_display: res.data.ticket_status_display || prev.status_display,
          messages: [...(prev.messages || []), res.data.message],
        }));
      }

      fetchTickets();
    } catch (err) {
      console.error(err);
      setReplyError(err.response?.data?.error || "Failed to send reply.");
    } finally {
      setReplyLoading(false);
    }
  };

  // Reopen Ticket
  const handleReopenTicket = async (e) => {
    e.preventDefault();
    if (!reopenReason.trim() || reopenReason.trim().length < 5) {
      setReopenError("Please specify why this ticket is being reopened (minimum 5 characters).");
      return;
    }
    if (!activeTicket) return;

    setReopenLoading(true);
    setReopenError("");

    try {
      const res = await api.post(`/support/owner/tickets/${activeTicket.id}/reopen/`, {
        reason: reopenReason.trim(),
      });

      setShowReopenModal(false);
      setReopenReason("");
      setActiveTicket(res.data);
      fetchTickets();
    } catch (err) {
      console.error(err);
      setReopenError(err.response?.data?.error || "Failed to reopen ticket.");
    } finally {
      setReopenLoading(false);
    }
  };

  // Stats calculation
  const stats = {
    total: totalCount,
    open: tickets.filter((t) => t.status === "OPEN").length,
    inProgress: tickets.filter((t) => t.status === "IN_PROGRESS").length,
    waiting: tickets.filter((t) => t.status === "WAITING_FOR_CUSTOMER").length,
    resolved: tickets.filter((t) => t.status === "RESOLVED" || t.status === "CLOSED").length,
  };

  return (
    <div className="owner-support-container">
      <OwnerNavbar activeTab="Support" withHeader={true} />

      <main className="owner-support-main">
        {/* Header Row */}
        <div className="os-header-row">
          <div className="os-title-wrap">
            <h1>🎫 Help & Support Center</h1>
            <p>
              Direct support channel with the BookMySalon Super Admin team for payment, technical, or booking assistance.
            </p>
          </div>
          <button
            type="button"
            className="os-raise-btn"
            onClick={() => {
              setCreateError("");
              setShowCreateModal(true);
            }}
          >
            <span>+</span> Raise Support Ticket
          </button>
        </div>

        {/* Metrics Grid */}
        <div className="os-stats-grid">
          <div className="os-stat-card">
            <div className="os-stat-icon-wrap total">📋</div>
            <div className="os-stat-info">
              <span className="os-stat-label">Total Tickets</span>
              <span className="os-stat-num">{stats.total}</span>
            </div>
          </div>
          <div className="os-stat-card">
            <div className="os-stat-icon-wrap open">🟢</div>
            <div className="os-stat-info">
              <span className="os-stat-label">Open</span>
              <span className="os-stat-num">{stats.open}</span>
            </div>
          </div>
          <div className="os-stat-card">
            <div className="os-stat-icon-wrap progress">⚡</div>
            <div className="os-stat-info">
              <span className="os-stat-label">In Progress</span>
              <span className="os-stat-num">{stats.inProgress}</span>
            </div>
          </div>
          <div className="os-stat-card">
            <div className="os-stat-icon-wrap waiting">⏳</div>
            <div className="os-stat-info">
              <span className="os-stat-label">Awaiting You</span>
              <span className="os-stat-num">{stats.waiting}</span>
            </div>
          </div>
          <div className="os-stat-card">
            <div className="os-stat-icon-wrap resolved">✓</div>
            <div className="os-stat-info">
              <span className="os-stat-label">Resolved / Closed</span>
              <span className="os-stat-num">{stats.resolved}</span>
            </div>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="os-controls-card">
          <div className="os-search-wrap">
            <span className="os-search-icon">🔍</span>
            <input
              type="text"
              className="os-search-input"
              placeholder="Search by ticket #, subject, or keywords..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="os-filters-wrap">
            <select
              className="os-select"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              {CATEGORIES.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>

            <select
              className="os-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              {STATUSES.map((st) => (
                <option key={st.value} value={st.value}>
                  {st.label}
                </option>
              ))}
            </select>

            <select
              className="os-select"
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
            >
              {PRIORITIES.map((pr) => (
                <option key={pr.value} value={pr.value}>
                  {pr.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div
            style={{
              background: "#fef2f2",
              border: "1px solid #fecaca",
              color: "#b91c1c",
              padding: "12px 16px",
              borderRadius: "10px",
              marginBottom: "20px",
              fontSize: "0.88rem",
            }}
          >
            ⚠️ {error}
          </div>
        )}

        {/* Ticket Cards Grid */}
        {loading ? (
          <div style={{ textAlign: "center", padding: "60px 20px", color: "#64748b" }}>
            Loading your support tickets…
          </div>
        ) : tickets.length === 0 ? (
          <div className="os-empty-card">
            <div className="os-empty-icon">🎟️</div>
            <h3 className="os-empty-title">No Support Tickets Found</h3>
            <p className="os-empty-desc">
              {search || statusFilter !== "ALL" || categoryFilter !== "ALL"
                ? "No tickets match your active filter criteria. Try adjusting your filters."
                : "You haven't raised any support tickets yet. If you encounter any technical issues, payment queries, or booking problems, raise a ticket and our Super Admin team will assist you."}
            </p>
            <button
              type="button"
              className="os-raise-btn"
              style={{ marginTop: "10px" }}
              onClick={() => setShowCreateModal(true)}
            >
              Raise a Support Ticket
            </button>
          </div>
        ) : (
          <div className="os-tickets-grid">
            {tickets.map((t) => (
              <div
                key={t.id}
                className={`os-ticket-card ${t.unread_count > 0 ? "has-unread" : ""}`}
                onClick={() => handleOpenTicket(t.id)}
              >
                <div>
                  <div className="os-ticket-top">
                    <span className="os-ticket-num-pill">{t.ticket_number}</span>
                    <div className="os-badges-row">
                      <span className={`os-priority-badge ${t.priority.toLowerCase()}`}>
                        {t.priority_display}
                      </span>
                      <span className={`os-status-pill ${t.status.toLowerCase()}`}>
                        {t.status_display}
                      </span>
                    </div>
                  </div>

                  <h3 className="os-ticket-subject" style={{ marginTop: "10px" }}>
                    {t.subject}
                  </h3>

                  <div style={{ fontSize: "0.78rem", color: "#0f766e", fontWeight: 700, margin: "4px 0 8px" }}>
                    📂 {t.category_display}
                  </div>

                  {t.last_message ? (
                    <p className="os-ticket-desc-snippet">
                      <span style={{ fontWeight: 600, color: "#334155" }}>
                        {t.last_message.sender_type === "SUPER_ADMIN" ? "Admin: " : "You: "}
                      </span>
                      {t.last_message.message}
                    </p>
                  ) : null}
                </div>

                <div className="os-ticket-footer">
                  <span>
                    Updated: {new Date(t.updated_at).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  {t.unread_count > 0 && (
                    <span className="os-unread-badge">
                      ● {t.unread_count} New Reply{t.unread_count > 1 ? "ies" : ""}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* =========================================================================
          RAISE TICKET MODAL
          ========================================================================= */}
      {showCreateModal && (
        <div className="os-modal-backdrop" onClick={() => setShowCreateModal(false)}>
          <div
            className="os-modal-dialog"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: "600px" }}
          >
            <div className="os-modal-header">
              <h3>🎫 Raise Support Ticket</h3>
              <button
                type="button"
                className="os-close-btn"
                onClick={() => setShowCreateModal(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateTicket} style={{ padding: "20px 24px", overflowY: "auto" }}>
              {createError && (
                <div
                  style={{
                    background: "#fef2f2",
                    border: "1px solid #fecaca",
                    color: "#dc2626",
                    padding: "10px 14px",
                    borderRadius: "8px",
                    marginBottom: "16px",
                    fontSize: "0.85rem",
                  }}
                >
                  ⚠️ {createError}
                </div>
              )}

              <div className="os-form-group">
                <label className="os-form-label">Subject *</label>
                <input
                  type="text"
                  className="os-form-input"
                  placeholder="Brief summary of the issue (e.g., Payment payout delay)"
                  value={createSubject}
                  onChange={(e) => setCreateSubject(e.target.value)}
                  maxLength={255}
                  required
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
                <div className="os-form-group">
                  <label className="os-form-label">Category *</label>
                  <select
                    className="os-form-select"
                    value={createCategory}
                    onChange={(e) => setCreateCategory(e.target.value)}
                  >
                    <option value="TECHNICAL">Technical Issue</option>
                    <option value="PAYMENT">Payment Problem</option>
                    <option value="BOOKING">Booking Issue</option>
                    <option value="ACCOUNT">Account-related Problem</option>
                    <option value="OTHER">Other Difficulties</option>
                  </select>
                </div>

                <div className="os-form-group">
                  <label className="os-form-label">Priority *</label>
                  <select
                    className="os-form-select"
                    value={createPriority}
                    onChange={(e) => setCreatePriority(e.target.value)}
                  >
                    <option value="LOW">Low - General query</option>
                    <option value="MEDIUM">Medium - Normal issue</option>
                    <option value="HIGH">High - Affecting bookings</option>
                    <option value="URGENT">Urgent - Critical blocker</option>
                  </select>
                </div>
              </div>

              <div className="os-form-group">
                <label className="os-form-label">Description *</label>
                <textarea
                  className="os-form-textarea"
                  placeholder="Provide detailed information regarding the problem, steps to reproduce, booking IDs, error messages, etc."
                  value={createDescription}
                  onChange={(e) => setCreateDescription(e.target.value)}
                  rows={4}
                  required
                />
              </div>

              <div className="os-form-group">
                <label className="os-form-label">Attachment (Optional)</label>
                <input
                  type="file"
                  accept="image/*,.pdf,.doc,.docx,.txt"
                  onChange={(e) => setCreateFile(e.target.files[0] || null)}
                  style={{ fontSize: "0.85rem" }}
                />
                <span style={{ fontSize: "0.75rem", color: "#94a3b8", marginTop: "2px" }}>
                  Supported formats: PNG, JPG, PDF, DOC, TXT (Max 10MB)
                </span>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "20px" }}>
                <button
                  type="button"
                  className="os-reopen-btn"
                  onClick={() => setShowCreateModal(false)}
                  style={{ color: "#64748b", borderColor: "#cbd5e1", background: "#f8fafc" }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="os-raise-btn"
                  disabled={createLoading}
                >
                  {createLoading ? "Submitting Ticket..." : "Submit Ticket"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          TICKET DETAIL & CHAT CONVERSATION MODAL
          ========================================================================= */}
      {activeTicket && (
        <div className="os-modal-backdrop" onClick={() => setActiveTicket(null)}>
          <div
            className="os-modal-dialog os-detail-dialog"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="os-modal-header">
              <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                <span className="os-ticket-num-pill" style={{ fontSize: "0.9rem" }}>
                  {activeTicket.ticket_number}
                </span>
                <h3 style={{ margin: 0, fontSize: "1.1rem" }}>{activeTicket.subject}</h3>
              </div>
              <button
                type="button"
                className="os-close-btn"
                onClick={() => setActiveTicket(null)}
              >
                ✕
              </button>
            </div>

            {/* Meta Bar */}
            <div className="os-ticket-meta-bar">
              <div className="os-meta-left">
                <span className={`os-status-pill ${activeTicket.status.toLowerCase()}`}>
                  {activeTicket.status_display}
                </span>
                <span className={`os-priority-badge ${activeTicket.priority.toLowerCase()}`}>
                  {activeTicket.priority_display}
                </span>
                <span style={{ fontSize: "0.8rem", color: "#64748b" }}>
                  • Category: <strong>{activeTicket.category_display}</strong>
                </span>
                <span style={{ fontSize: "0.8rem", color: "#94a3b8" }}>
                  • Created: {new Date(activeTicket.created_at).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </span>
              </div>

              <div className="os-meta-right">
                {/* Tabs */}
                <div style={{ display: "flex", gap: "4px" }}>
                  <button
                    type="button"
                    onClick={() => setActiveTab("conversation")}
                    style={{
                      padding: "4px 10px",
                      borderRadius: "6px",
                      fontSize: "0.78rem",
                      fontWeight: 700,
                      border: "none",
                      background: activeTab === "conversation" ? "#0f766e" : "#e2e8f0",
                      color: activeTab === "conversation" ? "#ffffff" : "#475569",
                      cursor: "pointer",
                    }}
                  >
                    💬 Conversation
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("activity")}
                    style={{
                      padding: "4px 10px",
                      borderRadius: "6px",
                      fontSize: "0.78rem",
                      fontWeight: 700,
                      border: "none",
                      background: activeTab === "activity" ? "#0f766e" : "#e2e8f0",
                      color: activeTab === "activity" ? "#ffffff" : "#475569",
                      cursor: "pointer",
                    }}
                  >
                    📋 Timeline ({activeTicket.activities?.length || 0})
                  </button>
                </div>

                {/* Reopen Button if Resolved or Closed */}
                {(activeTicket.status === "RESOLVED" || activeTicket.status === "CLOSED") && (
                  <button
                    type="button"
                    className="os-reopen-btn"
                    onClick={() => {
                      setReopenError("");
                      setShowReopenModal(true);
                    }}
                  >
                    🔄 Reopen Ticket
                  </button>
                )}
              </div>
            </div>

            {/* Modal Body */}
            <div className="os-detail-body">
              {activeTab === "conversation" ? (
                <>
                  <div className="os-chat-stream">
                    {/* Original Ticket Description Card */}
                    <div className="os-ticket-original-card">
                      <div className="os-orig-header">
                        <span>Original Issue Description</span>
                        <span>{activeTicket.created_by_details?.name} (Salon Owner)</span>
                      </div>
                      <p className="os-orig-desc">{activeTicket.description}</p>
                      {activeTicket.attachment_url && (
                        <div>
                          <a
                            href={activeTicket.attachment_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="os-attachment-pill"
                          >
                            📎 View Initial Attachment
                          </a>
                        </div>
                      )}
                    </div>

                    {/* Chat Messages */}
                    {activeTicket.messages?.map((msg) => {
                      const isOwner = msg.sender_type === "SALON_OWNER";
                      return (
                        <div
                          key={msg.id}
                          className={`os-msg-row ${isOwner ? "owner" : "admin"}`}
                        >
                          <div className="os-msg-header">
                            {isOwner ? (
                              <span>You (Salon Owner)</span>
                            ) : (
                              <>
                                <span className="os-admin-tag">Super Admin</span>
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

                          <div className="os-msg-bubble">
                            {msg.message}
                            {msg.attachment_url && (
                              <div>
                                <a
                                  href={msg.attachment_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="os-msg-attachment-link"
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

                  {/* Reply Input Bar */}
                  {activeTicket.status === "CLOSED" ? (
                    <div
                      style={{
                        padding: "16px 24px",
                        background: "#f1f5f9",
                        borderTop: "1px solid #e2e8f0",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <span style={{ fontSize: "0.85rem", color: "#64748b" }}>
                        🔒 This ticket has been marked as <strong>Closed</strong>.
                      </span>
                      <button
                        type="button"
                        className="os-reopen-btn"
                        onClick={() => setShowReopenModal(true)}
                      >
                        🔄 Reopen Ticket
                      </button>
                    </div>
                  ) : (
                    <div className="os-chat-composer">
                      {replyError && (
                        <div
                          style={{
                            color: "#dc2626",
                            fontSize: "0.82rem",
                            marginBottom: "6px",
                          }}
                        >
                          ⚠️ {replyError}
                        </div>
                      )}
                      <form onSubmit={handleSendReply} className="os-composer-form">
                        <textarea
                          className="os-composer-textarea"
                          placeholder="Type your response to the Super Admin support team..."
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          rows={2}
                        />

                        <div className="os-composer-actions">
                          <div>
                            <label className="os-attach-btn">
                              📎 {replyFile ? replyFile.name : "Attach Screenshot / File"}
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
                                style={{
                                  background: "none",
                                  border: "none",
                                  color: "#dc2626",
                                  marginLeft: "8px",
                                  fontSize: "0.8rem",
                                  cursor: "pointer",
                                }}
                              >
                                Remove ✕
                              </button>
                            )}
                          </div>

                          <button
                            type="submit"
                            className="os-send-btn"
                            disabled={replyLoading || (!replyText.trim() && !replyFile)}
                          >
                            {replyLoading ? "Sending..." : "Send Reply ➤"}
                          </button>
                        </div>
                      </form>
                    </div>
                  )}
                </>
              ) : (
                /* Activity Log Timeline */
                <div style={{ padding: "24px", overflowY: "auto", flex: 1 }}>
                  <h4 style={{ margin: "0 0 16px 0", fontSize: "0.95rem", color: "#0f172a" }}>
                    Chronological Ticket Activity & Audit Log
                  </h4>
                  <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    {activeTicket.activities?.map((act) => (
                      <div
                        key={act.id}
                        style={{
                          background: "#ffffff",
                          border: "1px solid #e2e8f0",
                          borderRadius: "10px",
                          padding: "12px 16px",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "flex-start",
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 700, fontSize: "0.86rem", color: "#0f172a" }}>
                            {act.activity_type_display}
                          </div>
                          {act.details && (
                            <div style={{ fontSize: "0.82rem", color: "#475569", marginTop: "2px" }}>
                              {act.details}
                            </div>
                          )}
                          <div style={{ fontSize: "0.74rem", color: "#94a3b8", marginTop: "4px" }}>
                            By {act.user_name || "System"}
                          </div>
                        </div>
                        <span style={{ fontSize: "0.75rem", color: "#94a3b8", whiteSpace: "nowrap" }}>
                          {new Date(act.created_at).toLocaleString("en-IN", {
                            day: "numeric",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          REOPEN TICKET MODAL
          ========================================================================= */}
      {showReopenModal && (
        <div className="os-modal-backdrop" onClick={() => setShowReopenModal(false)}>
          <div
            className="os-modal-dialog"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: "520px" }}
          >
            <div className="os-modal-header">
              <h3>🔄 Reopen Support Ticket</h3>
              <button
                type="button"
                className="os-close-btn"
                onClick={() => setShowReopenModal(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleReopenTicket} style={{ padding: "20px 24px" }}>
              {reopenError && (
                <div
                  style={{
                    background: "#fef2f2",
                    border: "1px solid #fecaca",
                    color: "#dc2626",
                    padding: "8px 12px",
                    borderRadius: "6px",
                    marginBottom: "12px",
                    fontSize: "0.84rem",
                  }}
                >
                  ⚠️ {reopenError}
                </div>
              )}

              <p style={{ fontSize: "0.88rem", color: "#475569", margin: "0 0 12px 0" }}>
                If your issue was not completely resolved, please provide details on what is still pending so the Super Admin team can re-investigate.
              </p>

              <div className="os-form-group">
                <label className="os-form-label">Reason for Reopening *</label>
                <textarea
                  className="os-form-textarea"
                  placeholder="Explain why the resolution was incomplete or what further action is required..."
                  value={reopenReason}
                  onChange={(e) => setReopenReason(e.target.value)}
                  rows={3}
                  required
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "16px" }}>
                <button
                  type="button"
                  className="os-reopen-btn"
                  onClick={() => setShowReopenModal(false)}
                  style={{ color: "#64748b", borderColor: "#cbd5e1", background: "#f8fafc" }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="os-raise-btn"
                  disabled={reopenLoading}
                >
                  {reopenLoading ? "Reopening..." : "Reopen Ticket"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

