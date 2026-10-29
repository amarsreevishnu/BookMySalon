import React, { useState, useEffect, useCallback } from "react";
import api from "../../api/axios";
import "../../styles/ownerRevenue.css";

export default function OwnerRevenueTab({ salonId, onBackToDashboard }) {
  // Navigation tabs within Revenue
  const [subTab, setSubTab] = useState("ledger"); // "ledger" | "workers" | "pending" | "refunds"

  // Summary data
  const [summary, setSummary] = useState(null);
  const [loadingSummary, setLoadingSummary] = useState(true);

  // Transactions Ledger data
  const [transactions, setTransactions] = useState([]);
  const [txCount, setTxCount] = useState(0);
  const [txTotalPages, setTxTotalPages] = useState(1);
  const [txPage, setTxPage] = useState(1);
  const [txFilterType, setTxFilterType] = useState("");
  const [txFilterFlow, setTxFilterFlow] = useState("");
  const [txSearch, setTxSearch] = useState("");
  const [loadingTxs, setLoadingTxs] = useState(false);

  // Workers data
  const [workersData, setWorkersData] = useState([]);
  const [loadingWorkers, setLoadingWorkers] = useState(false);

  // Pending bookings awaiting counter settlement
  const [pendingBookings, setPendingBookings] = useState([]);
  const [loadingPending, setLoadingPending] = useState(false);

  // Unreconciled completed bookings
  const [unreconciledBookings, setUnreconciledBookings] = useState([]);
  const [loadingUnreconciled, setLoadingUnreconciled] = useState(false);
  const [reconcilingId, setReconcilingId] = useState(null);

  // Modals state
  const [settleModalBooking, setSettleModalBooking] = useState(null);
  const [settlePaymentMethod, setSettlePaymentMethod] = useState("CASH");
  const [settleNotes, setSettleNotes] = useState("");
  const [settlingLoading, setSettlingLoading] = useState(false);

  const [refundModalBooking, setRefundModalBooking] = useState(null);
  const [refundReason, setRefundReason] = useState("");
  const [refundLoading, setRefundLoading] = useState(false);

  const [toastMsg, setToastMsg] = useState("");

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(""), 4500);
  };

  /* ------------------------------------------------------------------------ */
  /* Fetch Revenue Summary                                                    */
  /* ------------------------------------------------------------------------ */
  const fetchSummary = useCallback(async () => {
    try {
      setLoadingSummary(true);
      const url = salonId
        ? `/payments/owner/revenue-summary/?salon_id=${salonId}`
        : `/payments/owner/revenue-summary/`;
      const res = await api.get(url);
      setSummary(res.data);
    } catch (err) {
      console.error("Failed to load revenue summary:", err);
    } finally {
      setLoadingSummary(false);
    }
  }, [salonId]);

  /* ------------------------------------------------------------------------ */
  /* Fetch Transactions Ledger                                                */
  /* ------------------------------------------------------------------------ */
  const fetchTransactions = useCallback(async () => {
    try {
      setLoadingTxs(true);
      const params = new URLSearchParams();
      if (salonId) params.append("salon_id", salonId);
      if (txPage) params.append("page", txPage);
      if (txFilterType) params.append("type", txFilterType);
      if (txFilterFlow) params.append("flow", txFilterFlow);
      if (txSearch.trim()) params.append("search", txSearch.trim());

      const res = await api.get(`/payments/owner/transactions/?${params.toString()}`);
      setTransactions(res.data.results || []);
      setTxCount(res.data.count || 0);
      setTxTotalPages(res.data.total_pages || 1);
    } catch (err) {
      console.error("Failed to load transactions:", err);
    } finally {
      setLoadingTxs(false);
    }
  }, [salonId, txPage, txFilterType, txFilterFlow, txSearch]);

  /* ------------------------------------------------------------------------ */
  /* Fetch Worker Earnings                                                    */
  /* ------------------------------------------------------------------------ */
  const fetchWorkerEarnings = useCallback(async () => {
    try {
      setLoadingWorkers(true);
      const url = salonId
        ? `/payments/owner/worker-earnings/?salon_id=${salonId}`
        : `/payments/owner/worker-earnings/`;
      const res = await api.get(url);
      setWorkersData(res.data.workers || []);
    } catch (err) {
      console.error("Failed to load worker earnings:", err);
    } finally {
      setLoadingWorkers(false);
    }
  }, [salonId]);

  /* ------------------------------------------------------------------------ */
  /* Fetch Pending Settlements                                                */
  /* ------------------------------------------------------------------------ */
  const fetchPendingSettlements = useCallback(async () => {
    try {
      setLoadingPending(true);
      const res = await api.get("/salons/owner/bookings/");
      const all = res.data.bookings || [];
      // Filter bookings that have advance paid and are not fully paid
      const pending = all.filter(
        (b) =>
          (b.is_advance_paid || Number(b.advance_amount) > 0) &&
          b.status !== "COMPLETED" &&
          b.status !== "CANCELLED"
      );
      setPendingBookings(pending);
    } catch (err) {
      console.error("Failed to load pending settlements:", err);
    } finally {
      setLoadingPending(false);
    }
  }, []);

  /* ------------------------------------------------------------------------ */
  /* Fetch Unreconciled Bookings                                              */
  /* ------------------------------------------------------------------------ */
  const fetchUnreconciledBookings = useCallback(async () => {
    try {
      setLoadingUnreconciled(true);
      const res = await api.get("/payments/owner/unreconciled-bookings/");
      setUnreconciledBookings(res.data.unreconciled_bookings || []);
    } catch (err) {
      console.error("Failed to load unreconciled bookings:", err);
    } finally {
      setLoadingUnreconciled(false);
    }
  }, []);

  /* ------------------------------------------------------------------------ */
  /* Handle Reconcile Booking                                                 */
  /* ------------------------------------------------------------------------ */
  const handleReconcileBooking = async (bookingId) => {
    try {
      setReconcilingId(bookingId);
      const res = await api.post(`/payments/bookings/${bookingId}/reconcile-revenue/`);
      showToast(res.data?.message || `Booking #${bookingId} revenue reconciled successfully!`);
      fetchSummary();
      fetchUnreconciledBookings();
      fetchTransactions();
      fetchWorkerEarnings();
    } catch (err) {
      const errMsg = err.response?.data?.error || err.response?.data?.detail || "Failed to reconcile revenue.";
      showToast(`Error: ${errMsg}`);
    } finally {
      setReconcilingId(null);
    }
  };

  // Initial and reactive loads
  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  useEffect(() => {
    if (subTab === "ledger") {
      fetchTransactions();
    } else if (subTab === "workers") {
      fetchWorkerEarnings();
    } else if (subTab === "pending") {
      fetchPendingSettlements();
    } else if (subTab === "reconciliation") {
      fetchUnreconciledBookings();
    }
  }, [subTab, fetchTransactions, fetchWorkerEarnings, fetchPendingSettlements, fetchUnreconciledBookings]);

  /* ------------------------------------------------------------------------ */
  /* Handle Collect Remaining Settlement                                      */
  /* ------------------------------------------------------------------------ */
  const handleConfirmCollectRemaining = async () => {
    if (!settleModalBooking) return;
    try {
      setSettlingLoading(true);
      const remainingVal =
        Number(settleModalBooking.remaining_amount) > 0
          ? settleModalBooking.remaining_amount
          : Math.max(
              0,
              Number(settleModalBooking.total_amount || settleModalBooking.service_price) -
                Number(settleModalBooking.advance_amount || 0)
            );

      const res = await api.post(
        `/payments/owner/bookings/${settleModalBooking.id}/collect-remaining/`,
        {
          remaining_amount: remainingVal,
          payment_method: settlePaymentMethod,
          notes: settleNotes.trim(),
        }
      );

      showToast(
        `✓ Remaining ₹${remainingVal} collected! Service #${settleModalBooking.id} completed.`
      );
      setSettleModalBooking(null);
      setSettleNotes("");

      // Refresh data
      fetchSummary();
      fetchTransactions();
      fetchPendingSettlements();
    } catch (err) {
      alert(
        "Settlement error: " +
          (err.response?.data?.error || err.message || "Could not complete payment.")
      );
    } finally {
      setSettlingLoading(false);
    }
  };

  /* ------------------------------------------------------------------------ */
  /* Handle Issue Refund                                                      */
  /* ------------------------------------------------------------------------ */
  const handleConfirmRefund = async () => {
    if (!refundModalBooking) return;
    if (!refundReason.trim()) {
      alert("Please enter a valid reason for this refund.");
      return;
    }
    try {
      setRefundLoading(true);
      const res = await api.post(
        `/payments/owner/bookings/${refundModalBooking.id}/refund/`,
        {
          reason: refundReason.trim(),
          force_refund: true,
        }
      );
      showToast(res.data.message || "✓ Refund processed successfully.");
      setRefundModalBooking(null);
      setRefundReason("");

      // Refresh data
      fetchSummary();
      fetchTransactions();
      fetchPendingSettlements();
    } catch (err) {
      alert(
        "Refund error: " +
          (err.response?.data?.error || err.message || "Could not process refund.")
      );
    } finally {
      setRefundLoading(false);
    }
  };

  const wallet = summary?.wallet || {};
  const metrics = summary?.metrics || {};

  return (
    <div className="revenue-hub-container">
      {/* Toast Alert */}
      {toastMsg && (
        <div
          style={{
            position: "fixed",
            top: 24,
            right: 24,
            background: "#1b382b",
            color: "#ffffff",
            padding: "14px 22px",
            borderRadius: "10px",
            boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
            zIndex: 99999,
            fontWeight: 600,
            fontSize: "0.9rem",
            display: "flex",
            alignItems: "center",
            gap: "12px",
          }}
        >
          <span>{toastMsg}</span>
          <button
            onClick={() => setToastMsg("")}
            style={{
              background: "none",
              border: "none",
              color: "#fff",
              cursor: "pointer",
            }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Hero Master Wallet Card */}
      <section className="revenue-wallet-hero">
        <div className="revenue-hero-left">
          <div className="revenue-hero-tag">
            <span className="tag-dot"></span>
            Salon Master Wallet • Active Ledger
          </div>
          <div className="revenue-hero-balance-label">Current Available Balance</div>
          <div className="revenue-hero-balance-val">
            ₹
            {Number(metrics.available_balance || 0).toLocaleString("en-IN", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </div>
          <div className="revenue-hero-subtitle">
            <span>🏛 {summary?.salon?.name || "Salon Partner"}</span>
            <span>•</span>
            <span>📍 {summary?.salon?.city || "Registered Venue"}</span>
            <span>•</span>
            <span>
              Net salon balance after staff commissions & customer refunds
            </span>
          </div>
        </div>

        <div className="revenue-hero-right">
          <button
            type="button"
            className="revenue-refresh-btn"
            onClick={() => {
              fetchSummary();
              if (subTab === "ledger") fetchTransactions();
              if (subTab === "workers") fetchWorkerEarnings();
              if (subTab === "pending") fetchPendingSettlements();
            }}
          >
            <span>🔄</span> Refresh 
          </button>
          {onBackToDashboard && (
            <button
              type="button"
              className="revenue-refresh-btn"
              onClick={onBackToDashboard}
              style={{ background: "transparent" }}
            >
              ← Back to Dashboard
            </button>
          )}
        </div>
      </section>

      {/* 6 Key Financial Metrics Grid */}
      <section className="revenue-metrics-grid">
        <div className="rev-metric-card accent-green">
          <div className="rev-metric-top">
            <span className="rev-metric-label">Total Collections</span>
            <span className="rev-metric-icon">💰</span>
          </div>
          <div className="rev-metric-value">
            ₹{Number(metrics.total_collected || 0).toLocaleString("en-IN")}
          </div>
          <span className="rev-metric-subtext">Gross payments from customers</span>
        </div>

        <div className="rev-metric-card accent-blue">
          <div className="rev-metric-top">
            <span className="rev-metric-label">Completed Services</span>
            <span className="rev-metric-icon">✂️</span>
          </div>
          <div className="rev-metric-value">
            ₹{Number(metrics.total_completed_services || 0).toLocaleString("en-IN")}
          </div>
          <span className="rev-metric-subtext">
            {metrics.completed_bookings_count || 0} completed bookings
          </span>
        </div>

        <div className="rev-metric-card accent-purple">
          <div className="rev-metric-top">
            <span className="rev-metric-label">Advances Received</span>
            <span className="rev-metric-icon">🔒</span>
          </div>
          <div className="rev-metric-value">
            ₹{Number(metrics.total_advances || 0).toLocaleString("en-IN")}
          </div>
          <span className="rev-metric-subtext">Online slot-lock tokens</span>
        </div>

        <div className="rev-metric-card">
          <div className="rev-metric-top">
            <span className="rev-metric-label">Worker Earnings</span>
            <span className="rev-metric-icon">👥</span>
          </div>
          <div className="rev-metric-value" style={{ color: "#0891b2" }}>
            ₹{Number(metrics.total_worker_payout || 0).toLocaleString("en-IN")}
          </div>
          <span className="rev-metric-subtext">Allocated staff commissions</span>
        </div>

        <div className="rev-metric-card accent-red">
          <div className="rev-metric-top">
            <span className="rev-metric-label">Total Refunds</span>
            <span className="rev-metric-icon">↩️</span>
          </div>
          <div className="rev-metric-value">
            ₹{Number(metrics.total_refunded || 0).toLocaleString("en-IN")}
          </div>
          <span className="rev-metric-subtext">
            {metrics.refunds_count || 0} cancellations refunded
          </span>
        </div>

        <div className="rev-metric-card">
          <div className="rev-metric-top">
            <span className="rev-metric-label">Net Salon Revenue</span>
            <span className="rev-metric-icon">✨</span>
          </div>
          <div className="rev-metric-value" style={{ color: "#166534" }}>
            ₹{Number(metrics.net_salon_revenue || 0).toLocaleString("en-IN")}
          </div>
          <span className="rev-metric-subtext">Net salon retained profit</span>
        </div>
      </section>

      {/* Pending Reconciliation Alert Banner */}
      {Number(metrics.unreconciled_bookings_count || 0) > 0 && (
        <div
          style={{
            background: "#fffbeb",
            border: "1px solid #fde68a",
            borderRadius: "14px",
            padding: "16px 22px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "14px",
            margin: "0 0 16px 0",
            boxShadow: "0 2px 10px rgba(217, 119, 6, 0.08)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <span style={{ fontSize: "24px" }}>⚠️</span>
            <div>
              <div style={{ fontWeight: 800, color: "#92400e", fontSize: "14px" }}>
                {metrics.unreconciled_bookings_count} Completed Appointment{metrics.unreconciled_bookings_count > 1 ? "s" : ""} Pending Revenue Sync
              </div>
              <div style={{ color: "#b45309", fontSize: "12.5px" }}>
                Completed service appointments have missing ledger entries or worker commission records.
              </div>
            </div>
          </div>
          <button
            type="button"
            className="btn-modal-primary"
            onClick={() => setSubTab("reconciliation")}
            style={{
              background: "#d97706",
              borderColor: "#b45309",
              padding: "8px 18px",
              fontSize: "12.5px",
              fontWeight: 700,
            }}
          >
            <span>🔄</span> Review & Sync Revenue &rarr;
          </button>
        </div>
      )}

      {/* Sub-Navigation Tabs */}
      <nav className="revenue-nav-bar">
        <div className="revenue-nav-tabs">
          <button
            type="button"
            className={`rev-tab-btn ${subTab === "ledger" ? "active" : ""}`}
            onClick={() => setSubTab("ledger")}
          >
            <span>📜</span> Financial Ledger
            <span className="rev-pill-badge">{txCount}</span>
          </button>

          <button
            type="button"
            className={`rev-tab-btn ${subTab === "workers" ? "active" : ""}`}
            onClick={() => setSubTab("workers")}
          >
            <span>👥</span> Worker Earnings & Commissions
            <span className="rev-pill-badge">{workersData.length}</span>
          </button>

          <button
            type="button"
            className={`rev-tab-btn ${subTab === "pending" ? "active" : ""}`}
            onClick={() => setSubTab("pending")}
          >
            <span>⏳</span> Pending Settlements
            {metrics.pending_settlements_count > 0 && (
              <span
                className="rev-pill-badge"
                style={{ background: "#fef3c7", color: "#92400e" }}
              >
                {metrics.pending_settlements_count} due
              </span>
            )}
          </button>

          <button
            type="button"
            className={`rev-tab-btn ${subTab === "reconciliation" ? "active" : ""}`}
            onClick={() => setSubTab("reconciliation")}
            style={Number(metrics.unreconciled_bookings_count || 0) > 0 ? { borderColor: "#fde68a", color: "#b45309" } : {}}
          >
            <span>🔄</span> Revenue Reconciliation
            {Number(metrics.unreconciled_bookings_count || 0) > 0 && (
              <span
                className="rev-pill-badge"
                style={{ background: "#fef3c7", color: "#92400e", fontWeight: 700 }}
              >
                {metrics.unreconciled_bookings_count} unsynced
              </span>
            )}
          </button>
        </div>
      </nav>

      {/* ==================================================================== */}
      {/* 1. FINANCIAL LEDGER (TRANSACTIONS)                                    */}
      {/* ==================================================================== */}
      {subTab === "ledger" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Search and Filters */}
          <div className="rev-filter-bar">
            <div className="rev-search-input-wrap">
              <span>🔍</span>
              <input
                type="text"
                placeholder="Search transaction description, customer name, booking #..."
                value={txSearch}
                onChange={(e) => {
                  setTxSearch(e.target.value);
                  setTxPage(1);
                }}
              />
              {txSearch && (
                <button
                  type="button"
                  onClick={() => {
                    setTxSearch("");
                    setTxPage(1);
                  }}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "#94a3b8",
                  }}
                >
                  ✕
                </button>
              )}
            </div>

            <div className="rev-filter-pills">
              <button
                type="button"
                className={`rev-filter-pill ${txFilterType === "" ? "active" : ""}`}
                onClick={() => {
                  setTxFilterType("");
                  setTxPage(1);
                }}
              >
                All Types
              </button>
              <button
                type="button"
                className={`rev-filter-pill ${
                  txFilterType === "ADVANCE_RECEIVED" ? "active" : ""
                }`}
                onClick={() => {
                  setTxFilterType("ADVANCE_RECEIVED");
                  setTxPage(1);
                }}
              >
                Advances
              </button>
              <button
                type="button"
                className={`rev-filter-pill ${
                  txFilterType === "REMAINING_RECEIVED" ? "active" : ""
                }`}
                onClick={() => {
                  setTxFilterType("REMAINING_RECEIVED");
                  setTxPage(1);
                }}
              >
                Remaining Collected
              </button>
              <button
                type="button"
                className={`rev-filter-pill ${
                  txFilterType === "FULL_PAYMENT_RECEIVED" ? "active" : ""
                }`}
                onClick={() => {
                  setTxFilterType("FULL_PAYMENT_RECEIVED");
                  setTxPage(1);
                }}
              >
                Full Payments
              </button>
              <button
                type="button"
                className={`rev-filter-pill ${
                  txFilterType === "REFUND_ISSUED" ? "active" : ""
                }`}
                onClick={() => {
                  setTxFilterType("REFUND_ISSUED");
                  setTxPage(1);
                }}
              >
                Refunds
              </button>
            </div>
          </div>

          {/* Ledger Table Card */}
          <div className="rev-table-card">
            <div className="rev-table-wrap">
              <table className="rev-table">
                <thead>
                  <tr>
                    <th>Date & Time</th>
                    <th>Ref / Booking</th>
                    <th>Type</th>
                    <th>Flow & Amount</th>
                    <th>Balance After</th>
                    <th>Explanatory Description</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingTxs ? (
                    <tr>
                      <td colSpan="6" style={{ textAlign: "center", padding: "40px" }}>
                        <span style={{ color: "#64748b" }}>Loading financial ledger...</span>
                      </td>
                    </tr>
                  ) : transactions.length === 0 ? (
                    <tr>
                      <td colSpan="6" style={{ textAlign: "center", padding: "50px" }}>
                        <div style={{ color: "#94a3b8", fontSize: "1.1rem" }}>
                          No transactions found matching the filter.
                        </div>
                      </td>
                    </tr>
                  ) : (
                    transactions.map((tx) => (
                      <tr key={tx.id}>
                        <td style={{ whiteSpace: "nowrap", color: "#64748b" }}>
                          {tx.formatted_date || tx.created_at?.slice(0, 16)}
                        </td>
                        <td>
                          {tx.booking ? (
                            <span
                              style={{
                                fontWeight: 700,
                                color: "var(--studio-primary)",
                                background: "#f0fdf4",
                                padding: "3px 8px",
                                borderRadius: "6px",
                                border: "1px solid #bbf7d0",
                              }}
                            >
                              #{tx.booking}
                            </span>
                          ) : (
                            <span style={{ color: "#94a3b8" }}>N/A</span>
                          )}
                        </td>
                        <td>
                          <span
                            className={`rev-badge ${
                              tx.transaction_type === "ADVANCE_RECEIVED"
                                ? "rev-badge--advance"
                                : tx.transaction_type === "REMAINING_RECEIVED"
                                ? "rev-badge--remaining"
                                : tx.transaction_type === "REFUND_ISSUED"
                                ? "rev-badge--refund"
                                : "rev-badge--full"
                            }`}
                          >
                            {tx.transaction_type.replace(/_/g, " ")}
                          </span>
                        </td>
                        <td>
                          <span
                            className={`rev-amount-cell ${
                              tx.flow === "CREDIT" ? "credit" : "debit"
                            }`}
                          >
                            {tx.flow === "CREDIT" ? "+" : "-"}₹
                            {Number(tx.amount).toLocaleString("en-IN", {
                              minimumFractionDigits: 2,
                            })}
                          </span>
                        </td>
                        <td style={{ fontWeight: 600, color: "#1e293b" }}>
                          ₹{Number(tx.balance_after).toLocaleString("en-IN")}
                        </td>
                        <td className="rev-narrative-cell">
                          <p style={{ margin: 0 }}>{tx.description}</p>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {txTotalPages > 1 && (
              <div className="rev-pagination-row">
                <span>
                  Showing page {txPage} of {txTotalPages} ({txCount} total entries)
                </span>
                <div className="rev-page-actions">
                  <button
                    type="button"
                    className="rev-page-btn"
                    disabled={txPage <= 1}
                    onClick={() => setTxPage((p) => Math.max(1, p - 1))}
                  >
                    ← Previous
                  </button>
                  <button
                    type="button"
                    className="rev-page-btn"
                    disabled={txPage >= txTotalPages}
                    onClick={() => setTxPage((p) => Math.min(txTotalPages, p + 1))}
                  >
                    Next →
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 2. WORKER EARNINGS & COMMISSIONS                                     */}
      {/* ==================================================================== */}
      {subTab === "workers" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {loadingWorkers ? (
            <div style={{ textAlign: "center", padding: "60px", color: "#64748b" }}>
              Loading staff commission performance...
            </div>
          ) : workersData.length === 0 ? (
            <div
              style={{
                background: "#ffffff",
                padding: "60px",
                textAlign: "center",
                borderRadius: "14px",
                border: "1px solid var(--studio-border)",
              }}
            >
              <h3>No Specialists Configured</h3>
              <p style={{ color: "#64748b" }}>
                Add workers to your salon team to track their commission shares and
                earnings.
              </p>
            </div>
          ) : (
            <div className="rev-worker-grid">
              {workersData.map((w) => (
                <div key={w.id} className="rev-worker-card">
                  <div className="rev-worker-top">
                    <div className="rev-worker-avatar">
                      {w.name ? w.name.charAt(0).toUpperCase() : "✂"}
                    </div>
                    <div className="rev-worker-info">
                      <h4>{w.name}</h4>
                      <p>
                        {w.specialization} • {w.station}
                      </p>
                      <span className="rev-worker-tier-tag">
                        {w.commission_tier} ({Number(w.commission_rate)}% Share)
                      </span>
                    </div>
                  </div>

                  <div className="rev-worker-stats-row">
                    <div className="rev-w-stat-col">
                      <span className="lbl">Services Done</span>
                      <span className="val">{w.completed_jobs}</span>
                    </div>
                    <div className="rev-w-stat-col">
                      <span className="lbl">Gross Generated</span>
                      <span className="val">
                        ₹{Number(w.gross_service_value || 0).toLocaleString("en-IN")}
                      </span>
                    </div>
                    <div className="rev-w-stat-col">
                      <span className="lbl">Worker Earned</span>
                      <span className="val green">
                        ₹{Number(w.total_worker_earned || 0).toLocaleString("en-IN")}
                      </span>
                    </div>
                    <div className="rev-w-stat-col">
                      <span className="lbl">Salon Share</span>
                      <span className="val" style={{ color: "var(--studio-primary)" }}>
                        ₹{Number(w.total_salon_share || 0).toLocaleString("en-IN")}
                      </span>
                    </div>
                  </div>

                  {w.reversals_count > 0 && (
                    <div
                      style={{
                        background: "#fee2e2",
                        padding: "8px 12px",
                        borderRadius: "8px",
                        fontSize: "0.78rem",
                        color: "#991b1b",
                        display: "flex",
                        justifyContent: "space-between",
                      }}
                    >
                      <span>↩ {w.reversals_count} Reversal(s) recorded:</span>
                      <strong>
                        -₹{Number(w.reversals_amount || 0).toLocaleString("en-IN")}
                      </strong>
                    </div>
                  )}

                  {/* Recent Earnings List */}
                  {w.recent_earnings && w.recent_earnings.length > 0 && (
                    <div style={{ marginTop: "4px" }}>
                      <span
                        style={{
                          fontSize: "0.74rem",
                          fontWeight: 700,
                          textTransform: "uppercase",
                          color: "#64748b",
                        }}
                      >
                        Recent Service Shares:
                      </span>
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: "6px",
                          marginTop: "6px",
                        }}
                      >
                        {w.recent_earnings.map((e) => (
                          <div
                            key={e.id}
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              fontSize: "0.82rem",
                              padding: "4px 0",
                              borderBottom: "1px dashed #f1f5f9",
                            }}
                          >
                            <span>
                              Booking #{e.booking} • {e.booking_service_name}
                            </span>
                            <strong style={{ color: "#166534" }}>
                              +₹{Number(e.earning_amount).toLocaleString("en-IN")}
                            </strong>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ==================================================================== */}
      {/* 3. PENDING SETTLEMENTS                                                */}
      {/* ==================================================================== */}
      {subTab === "pending" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div
            style={{
              background: "#eff6ff",
              border: "1px solid #bfdbfe",
              borderRadius: "12px",
              padding: "16px 20px",
              color: "#1e40af",
              fontSize: "0.88rem",
              display: "flex",
              alignItems: "center",
              gap: "12px",
            }}
          >
            <span style={{ fontSize: "1.4rem" }}>ℹ️</span>
            <div>
              <strong>Advance Paid Appointments:</strong> These customers paid token
              advance online. When their appointment completes at your salon counter,
              click <em>"Collect Remaining & Complete"</em> to calculate the worker's
              commission, credit your salon share, and finalize the revenue ledger.
            </div>
          </div>

          <div className="rev-table-card">
            <div className="rev-table-wrap">
              <table className="rev-table">
                <thead>
                  <tr>
                    <th>Booking #</th>
                    <th>Customer</th>
                    <th>Service & Specialist</th>
                    <th>Schedule</th>
                    <th>Advance Paid</th>
                    <th>Remaining Due</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingPending ? (
                    <tr>
                      <td colSpan="7" style={{ textAlign: "center", padding: "40px" }}>
                        Loading pending appointments...
                      </td>
                    </tr>
                  ) : pendingBookings.length === 0 ? (
                    <tr>
                      <td colSpan="7" style={{ textAlign: "center", padding: "50px" }}>
                        <div style={{ color: "#94a3b8" }}>
                          No pending advance bookings awaiting settlement.
                        </div>
                      </td>
                    </tr>
                  ) : (
                    pendingBookings.map((b) => {
                      const totalP = Number(b.total_amount || b.service_price || 0);
                      const advP = Number(b.advance_amount || 100);
                      const remDue = Number(b.remaining_amount || Math.max(0, totalP - advP));

                      return (
                        <tr key={b.id}>
                          <td>
                            <strong>#{b.id}</strong>
                          </td>
                          <td>
                            <div>{b.client_name}</div>
                            <small style={{ color: "#64748b" }}>{b.client_phone}</small>
                          </td>
                          <td>
                            <div>{b.service_name}</div>
                            <small style={{ color: "#64748b" }}>
                              Stylist: {b.worker_name || "Unassigned"}
                            </small>
                          </td>
                          <td style={{ whiteSpace: "nowrap" }}>
                            {b.booking_date} • {b.booking_time}
                          </td>
                          <td>
                            <span
                              style={{
                                color: "#166534",
                                fontWeight: 700,
                                background: "#f0fdf4",
                                padding: "4px 8px",
                                borderRadius: "6px",
                              }}
                            >
                              ₹{advP} Paid
                            </span>
                          </td>
                          <td>
                            <span
                              style={{
                                color: "#b45309",
                                fontWeight: 700,
                                background: "#fef3c7",
                                padding: "4px 8px",
                                borderRadius: "6px",
                              }}
                            >
                              ₹{remDue} Due
                            </span>
                          </td>
                          <td>
                            <div style={{ display: "flex", gap: "8px" }}>
                              <button
                                type="button"
                                className="btn-rev-primary"
                                style={{ padding: "6px 14px", fontSize: "0.8rem" }}
                                onClick={() => setSettleModalBooking(b)}
                              >
                                Settle ₹{remDue}
                              </button>
                              <button
                                type="button"
                                className="btn-rev-secondary"
                                style={{
                                  padding: "6px 12px",
                                  fontSize: "0.8rem",
                                  color: "#b91c1c",
                                }}
                                onClick={() => setRefundModalBooking(b)}
                              >
                                Refund
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 4. REVENUE RECONCILIATION & RETRY                                     */}
      {/* ==================================================================== */}
      {subTab === "reconciliation" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div className="rev-table-card">
            <div className="rev-table-card-header">
              <div>
                <h3 className="rev-table-title">🔄 Unsynchronized & Pending Revenue Bookings</h3>
                <p className="rev-table-sub">
                  Completed bookings that require ledger synchronization or worker commission reconciliation.
                </p>
              </div>
              <button
                type="button"
                className="btn-rev-secondary"
                onClick={fetchUnreconciledBookings}
                disabled={loadingUnreconciled}
                style={{ display: "flex", alignItems: "center", gap: "6px" }}
              >
                <span>🔄</span> {loadingUnreconciled ? "Checking..." : "Refresh Status"}
              </button>
            </div>

            <div className="rev-table-responsive">
              <table className="rev-table">
                <thead>
                  <tr>
                    <th>Booking ID</th>
                    <th>Date & Time</th>
                    <th>Customer</th>
                    <th>Service</th>
                    <th>Assigned Specialist</th>
                    <th>Total Price</th>
                    <th>Revenue Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingUnreconciled ? (
                    <tr>
                      <td colSpan="8" style={{ textAlign: "center", padding: "40px" }}>
                        <div className="rev-spinner"></div>
                        <span style={{ marginLeft: "10px", color: "#64748b" }}>Auditing booking revenue ledger...</span>
                      </td>
                    </tr>
                  ) : unreconciledBookings.length === 0 ? (
                    <tr>
                      <td colSpan="8" style={{ textAlign: "center", padding: "48px 20px" }}>
                        <div style={{ fontSize: "2.5rem", marginBottom: "10px" }}>🎉</div>
                        <div style={{ fontWeight: 700, color: "#166534", fontSize: "1.1rem" }}>
                          All Completed Bookings Are Fully Synchronized!
                        </div>
                        <div style={{ color: "#64748b", fontSize: "0.88rem", marginTop: "4px" }}>
                          There are no completed appointments with missing ledger transactions or worker commissions.
                        </div>
                      </td>
                    </tr>
                  ) : (
                    unreconciledBookings.map((b) => {
                      const isReconciling = reconcilingId === b.id;
                      const workerName = b.worker?.full_name || b.worker_name || "Specialist";
                      const clientName = b.client_name || (b.customer ? `${b.customer.first_name} ${b.customer.last_name}` : "Client");
                      const amount = b.total_amount ?? b.service_price;

                      return (
                        <tr key={b.id}>
                          <td style={{ fontWeight: 700, color: "#1e293b" }}>
                            {b.booking_id_display || `#BK${b.id}`}
                          </td>
                          <td style={{ fontSize: "0.84rem", color: "#64748b" }}>
                            {b.formatted_date_time || `${b.booking_date} ${b.booking_time || ""}`}
                          </td>
                          <td>
                            <div style={{ fontWeight: 600, color: "#1e293b" }}>{clientName}</div>
                            {b.client_phone && (
                              <div style={{ fontSize: "0.78rem", color: "#94a3b8" }}>{b.client_phone}</div>
                            )}
                          </td>
                          <td>
                            <div style={{ fontWeight: 600, color: "#1e293b" }}>{b.service_name}</div>
                          </td>
                          <td>
                            <span style={{ fontWeight: 600, color: "#475569" }}>{workerName}</span>
                          </td>
                          <td style={{ fontWeight: 700, color: "#1e293b" }}>
                            ₹{Number(amount || 0).toLocaleString("en-IN")}
                          </td>
                          <td>
                            <span
                              style={{
                                display: "inline-block",
                                fontSize: "0.75rem",
                                fontWeight: 700,
                                background: "#fef3c7",
                                color: "#b45309",
                                padding: "4px 8px",
                                borderRadius: "6px",
                              }}
                            >
                              ⚠️ Sync Pending
                            </span>
                          </td>
                          <td>
                            <button
                              type="button"
                              className="btn-rev-primary"
                              style={{
                                padding: "6px 14px",
                                fontSize: "0.8rem",
                                background: "#d97706",
                                borderColor: "#b45309",
                              }}
                              onClick={() => handleReconcileBooking(b.id)}
                              disabled={isReconciling}
                              title="Recalculate shares, credit worker wallet, and record salon revenue entry"
                            >
                              {isReconciling ? "Syncing..." : "🔄 Reconcile Revenue"}
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL: COLLECT REMAINING & COMPLETE SERVICE                          */}
      {/* ==================================================================== */}
      {settleModalBooking && (
        <div className="rev-modal-backdrop">
          <div className="rev-modal-box">
            <div className="rev-modal-header">
              <h3>Collect Remaining Balance</h3>
              <button
                type="button"
                className="rev-modal-close"
                onClick={() => setSettleModalBooking(null)}
              >
                ✕
              </button>
            </div>

            <div className="rev-modal-body">
              <p style={{ margin: 0, fontSize: "0.88rem", color: "#64748b" }}>
                Confirm remaining payment received from <strong>{settleModalBooking.client_name}</strong> for <strong>{settleModalBooking.service_name}</strong> (Booking #{settleModalBooking.id}).
              </p>

              {/* Financial Calculation breakdown */}
              {(() => {
                const totalP = Number(
                  settleModalBooking.total_amount || settleModalBooking.service_price || 0
                );
                const advP = Number(settleModalBooking.advance_amount || 0);
                const remDue =
                  Number(settleModalBooking.remaining_amount) > 0
                    ? Number(settleModalBooking.remaining_amount)
                    : Math.max(0, totalP - advP);
                const rate = 60; // 60% default worker share
                const workerShare = Math.round((totalP * rate) / 100);
                const salonShare = Math.max(0, totalP - workerShare);

                return (
                  <div className="rev-breakdown-box">
                    <div className="rev-breakdown-row">
                      <span>Total Service Price:</span>
                      <strong>₹{totalP.toLocaleString("en-IN")}</strong>
                    </div>
                    <div className="rev-breakdown-row">
                      <span>Advance Already Received:</span>
                      <strong style={{ color: "#166534" }}>-₹{advP}</strong>
                    </div>
                    <div className="rev-breakdown-row total">
                      <span>Remaining Balance Due Now:</span>
                      <strong style={{ color: "#b45309" }}>₹{remDue}</strong>
                    </div>
                    <div
                      style={{
                        marginTop: "8px",
                        paddingTop: "8px",
                        borderTop: "1px dashed #cbd5e1",
                        fontSize: "0.8rem",
                        color: "#475569",
                        display: "flex",
                        justifyContent: "space-between",
                      }}
                    >
                      <span>
                        Worker ({settleModalBooking.worker_name || "Specialist"}): ₹
                        {workerShare}
                      </span>
                      <span>Salon Net Share: ₹{salonShare}</span>
                    </div>
                  </div>
                );
              })()}

              <div className="rev-form-group">
                <label>Counter Payment Method</label>
                <select
                  className="rev-form-control"
                  value={settlePaymentMethod}
                  onChange={(e) => setSettlePaymentMethod(e.target.value)}
                >
                  <option value="CASH">Cash at Salon Counter</option>
                  <option value="UPI">UPI / QR Code</option>
                  <option value="CARD">Credit / Debit Card POS</option>
                  <option value="ONLINE">Online Direct</option>
                </select>
              </div>

              <div className="rev-form-group">
                <label>Payment Notes (Optional)</label>
                <input
                  type="text"
                  className="rev-form-control"
                  placeholder="e.g. Paid in cash at chair counter"
                  value={settleNotes}
                  onChange={(e) => setSettleNotes(e.target.value)}
                />
              </div>
            </div>

            <div className="rev-modal-footer">
              <button
                type="button"
                className="btn-rev-secondary"
                disabled={settlingLoading}
                onClick={() => setSettleModalBooking(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-rev-primary"
                disabled={settlingLoading}
                onClick={handleConfirmCollectRemaining}
              >
                {settlingLoading ? "Processing..." : "Confirm & Finalize Service"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL: PROCESS CANCELLATION REFUND                                   */}
      {/* ==================================================================== */}
      {refundModalBooking && (
        <div className="rev-modal-backdrop">
          <div className="rev-modal-box">
            <div className="rev-modal-header">
              <h3>Issue Booking Refund</h3>
              <button
                type="button"
                className="rev-modal-close"
                onClick={() => setRefundModalBooking(null)}
              >
                ✕
              </button>
            </div>

            <div className="rev-modal-body">
              <p style={{ margin: 0, fontSize: "0.88rem", color: "#64748b" }}>
                Process refund for Booking #{refundModalBooking.id} (
                <strong>{refundModalBooking.client_name}</strong> —{" "}
                {refundModalBooking.service_name}).
              </p>

              <div className="rev-breakdown-box">
                <div className="rev-breakdown-row">
                  <span>Advance Token Paid:</span>
                  <strong>
                    ₹{refundModalBooking.advance_amount || 100}
                  </strong>
                </div>
                <div className="rev-breakdown-row total">
                  <span>Refund Disbursed:</span>
                  <strong style={{ color: "#b91c1c" }}>
                    ₹{refundModalBooking.advance_amount || 100}
                  </strong>
                </div>
              </div>

              <div className="rev-form-group">
                <label>Reason for Cancellation / Refund *</label>
                <input
                  type="text"
                  className="rev-form-control"
                  placeholder="e.g. Customer cancelled due to emergency"
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                />
              </div>
            </div>

            <div className="rev-modal-footer">
              <button
                type="button"
                className="btn-rev-secondary"
                disabled={refundLoading}
                onClick={() => setRefundModalBooking(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-rev-danger"
                disabled={refundLoading}
                onClick={handleConfirmRefund}
              >
                {refundLoading ? "Processing Refund..." : "Authorize Refund"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
