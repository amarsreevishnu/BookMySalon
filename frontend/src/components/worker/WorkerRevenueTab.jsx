import React, { useState, useEffect, useCallback } from "react";
import api from "../../api/axios";
import "../../styles/workerRevenue.css";

const formatINR = (val) => {
  const num = Number(val || 0);
  return num.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const getLocalDateStr = (d) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export default function WorkerRevenueTab() {
  // Main sub-tabs: "earnings" | "transactions"
  const [subTab, setSubTab] = useState("earnings");

  // Summary state
  const [summary, setSummary] = useState(null);
  const [loadingSummary, setLoadingSummary] = useState(true);

  // Period / Date filters
  const [period, setPeriod] = useState("all"); // "all" | "today" | "week" | "month" | "custom"
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [customRangeApplied, setCustomRangeApplied] = useState(false);

  // Earnings tab state
  const [earnings, setEarnings] = useState([]);
  const [earningsLoading, setEarningsLoading] = useState(false);
  const [earningsCount, setEarningsCount] = useState(0);
  const [earningsTotalPages, setEarningsTotalPages] = useState(1);
  const [earningsPage, setEarningsPage] = useState(1);
  const [earningsSearch, setEarningsSearch] = useState("");
  const [earningsStatus, setEarningsStatus] = useState("");

  // Transactions tab state
  const [transactions, setTransactions] = useState([]);
  const [transactionsLoading, setTransactionsLoading] = useState(false);
  const [transactionsCount, setTransactionsCount] = useState(0);
  const [transactionsTotalPages, setTransactionsTotalPages] = useState(1);
  const [transactionsPage, setTransactionsPage] = useState(1);
  const [transactionsSearch, setTransactionsSearch] = useState("");
  const [transactionsFlow, setTransactionsFlow] = useState("");
  const [transactionsType, setTransactionsType] = useState("");

  /* ------------------------------------------------------------------------ */
  /* Fetch Revenue Summary                                                    */
  /* ------------------------------------------------------------------------ */
  const fetchSummary = useCallback(async (sDate = startDate, eDate = endDate) => {
    try {
      setLoadingSummary(true);
      const params = new URLSearchParams();
      if (sDate) params.append("start_date", sDate);
      if (eDate) params.append("end_date", eDate);

      const res = await api.get(`/payments/worker/revenue-summary/?${params.toString()}`);
      setSummary(res.data);
    } catch (err) {
      console.error("Failed to load worker revenue summary:", err);
    } finally {
      setLoadingSummary(false);
    }
  }, [startDate, endDate]);

  /* ------------------------------------------------------------------------ */
  /* Fetch Booking Earnings List                                              */
  /* ------------------------------------------------------------------------ */
  const fetchEarnings = useCallback(async () => {
    try {
      setEarningsLoading(true);
      const params = new URLSearchParams();
      params.append("page", earningsPage);
      params.append("page_size", 10);
      if (earningsStatus) params.append("status", earningsStatus);
      if (earningsSearch.trim()) params.append("search", earningsSearch.trim());
      if (startDate) params.append("start_date", startDate);
      if (endDate) params.append("end_date", endDate);

      const res = await api.get(`/payments/worker/earnings/?${params.toString()}`);
      setEarnings(res.data.results || []);
      setEarningsCount(res.data.count || 0);
      setEarningsTotalPages(res.data.total_pages || 1);
    } catch (err) {
      console.error("Failed to load worker earnings:", err);
    } finally {
      setEarningsLoading(false);
    }
  }, [earningsPage, earningsStatus, earningsSearch, startDate, endDate]);

  /* ------------------------------------------------------------------------ */
  /* Fetch Wallet Transactions List                                           */
  /* ------------------------------------------------------------------------ */
  const fetchTransactions = useCallback(async () => {
    try {
      setTransactionsLoading(true);
      const params = new URLSearchParams();
      params.append("page", transactionsPage);
      params.append("page_size", 10);
      if (transactionsFlow) params.append("flow", transactionsFlow);
      if (transactionsType) params.append("transaction_type", transactionsType);
      if (transactionsSearch.trim()) params.append("search", transactionsSearch.trim());
      if (startDate) params.append("start_date", startDate);
      if (endDate) params.append("end_date", endDate);

      const res = await api.get(`/payments/worker/transactions/?${params.toString()}`);
      setTransactions(res.data.results || []);
      setTransactionsCount(res.data.count || 0);
      setTransactionsTotalPages(res.data.total_pages || 1);
    } catch (err) {
      console.error("Failed to load worker transactions:", err);
    } finally {
      setTransactionsLoading(false);
    }
  }, [transactionsPage, transactionsFlow, transactionsType, transactionsSearch, startDate, endDate]);

  /* ------------------------------------------------------------------------ */
  /* Handle Period Preset Clicks                                              */
  /* ------------------------------------------------------------------------ */
  const handlePeriodChange = (newPeriod) => {
    setPeriod(newPeriod);
    const now = new Date();
    let s = "";
    let e = "";

    if (newPeriod === "today") {
      s = getLocalDateStr(now);
      e = s;
      setCustomRangeApplied(true);
    } else if (newPeriod === "week") {
      const startOfWeek = new Date(now);
      const day = startOfWeek.getDay();
      const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1); // Monday
      startOfWeek.setDate(diff);
      s = getLocalDateStr(startOfWeek);
      e = getLocalDateStr(now);
      setCustomRangeApplied(true);
    } else if (newPeriod === "month") {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      s = getLocalDateStr(startOfMonth);
      e = getLocalDateStr(now);
      setCustomRangeApplied(true);
    } else if (newPeriod === "all") {
      s = "";
      e = "";
      setCustomRangeApplied(false);
    } else if (newPeriod === "custom") {
      setCustomRangeApplied(true);
      return;
    }

    setStartDate(s);
    setEndDate(e);
    setEarningsPage(1);
    setTransactionsPage(1);
    fetchSummary(s, e);
  };

  const handleApplyCustomDates = () => {
    if (!startDate || !endDate) return;
    setCustomRangeApplied(true);
    setEarningsPage(1);
    setTransactionsPage(1);
    fetchSummary(startDate, endDate);
  };

  const handleResetDates = () => {
    setPeriod("all");
    setStartDate("");
    setEndDate("");
    setCustomRangeApplied(false);
    setEarningsPage(1);
    setTransactionsPage(1);
    fetchSummary("", "");
  };

  // Initial load
  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  // Load active tab data
  useEffect(() => {
    if (subTab === "earnings") {
      fetchEarnings();
    } else if (subTab === "transactions") {
      fetchTransactions();
    }
  }, [subTab, fetchEarnings, fetchTransactions]);

  return (
    <div className="worker-revenue-container">
      {/* ------------------------------------------------------------------ */}
      {/* 1. Master Worker Wallet Hero Banner                                */}
      {/* ------------------------------------------------------------------ */}
      <section className="worker-wallet-hero">
        <div className="worker-hero-left">
          <div className="worker-hero-tag">
            <span className="tag-dot" />
            Specialist Commission Wallet
          </div>
          <div className="worker-hero-balance-label">Current Available Balance</div>
          <div className="worker-hero-balance-val">
            ₹{loadingSummary ? "..." : formatINR(summary?.wallet_balance)}
          </div>
          <div className="worker-hero-subtitle">
            <span>{summary?.worker_name || "Specialist"}</span>
            {summary?.station && <span className="pill">🪑 {summary.station}</span>}
            {summary?.salon_name && <span className="pill">🏛️ {summary.salon_name}</span>}
          </div>
        </div>

        <div className="worker-hero-right">
          <div className="worker-commission-badge">
            <div className="worker-commission-rate-val">
              {summary?.commission_rate || "60.00"}%
            </div>
            <div className="worker-commission-rate-label">
              {summary?.commission_tier || "Agreed Commission Share"}
            </div>
          </div>

          <button
            type="button"
            className="worker-hero-refresh-btn"
            onClick={() => {
              fetchSummary();
              if (subTab === "earnings") fetchEarnings();
              else fetchTransactions();
            }}
            title="Refresh revenue metrics"
          >
            <span>🔄</span> Refresh
          </button>
        </div>
      </section>

      {/* Pending Reconciliation Alert Banner */}
      {Number(summary?.unreconciled_bookings_count || 0) > 0 && (
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
            margin: "0 0 20px 0",
            boxShadow: "0 2px 10px rgba(217, 119, 6, 0.08)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <span style={{ fontSize: "24px" }}>⚠️</span>
            <div>
              <div style={{ fontWeight: 800, color: "#92400e", fontSize: "14px" }}>
                {summary.unreconciled_bookings_count} Completed Service{summary.unreconciled_bookings_count > 1 ? "s" : ""} Pending Commission Credit
              </div>
              <div style={{ color: "#b45309", fontSize: "12.5px" }}>
                You have completed services where commission has not posted to your wallet yet.
              </div>
            </div>
          </div>
          <a
            href="/worker/appointments"
            className="worker-apply-dates-btn"
            style={{
              textDecoration: "none",
              background: "#d97706",
              borderColor: "#b45309",
              padding: "8px 18px",
              fontSize: "12.5px",
              fontWeight: 700,
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <span>🔄</span> Review & Sync in Appointments &rarr;
          </a>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* 2. Date Range & Period Filter Bar                                  */}
      {/* ------------------------------------------------------------------ */}
      <section className="worker-date-filter-bar">
        <div className="worker-date-pills">
          <button
            type="button"
            className={`worker-date-pill-btn ${period === "all" ? "active" : ""}`}
            onClick={() => handlePeriodChange("all")}
          >
            All Time
          </button>
          <button
            type="button"
            className={`worker-date-pill-btn ${period === "today" ? "active" : ""}`}
            onClick={() => handlePeriodChange("today")}
          >
            Today
          </button>
          <button
            type="button"
            className={`worker-date-pill-btn ${period === "week" ? "active" : ""}`}
            onClick={() => handlePeriodChange("week")}
          >
            This Week
          </button>
          <button
            type="button"
            className={`worker-date-pill-btn ${period === "month" ? "active" : ""}`}
            onClick={() => handlePeriodChange("month")}
          >
            This Month
          </button>
          <button
            type="button"
            className={`worker-date-pill-btn ${period === "custom" ? "active" : ""}`}
            onClick={() => setPeriod("custom")}
          >
            Custom Range
          </button>
        </div>

        {(period === "custom" || customRangeApplied) && (
          <div className="worker-custom-date-controls">
            <div className="worker-date-input-wrap">
              <span>From:</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="worker-date-input-wrap">
              <span>To:</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            <button
              type="button"
              className="worker-apply-dates-btn"
              onClick={handleApplyCustomDates}
            >
              Apply Filter
            </button>
            {customRangeApplied && (
              <button
                type="button"
                className="worker-reset-dates-btn"
                onClick={handleResetDates}
              >
                Clear
              </button>
            )}
          </div>
        )}
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* 3. 4-Card Performance Stats Grid                                   */}
      {/* ------------------------------------------------------------------ */}
      <section className="worker-stats-grid">
        {/* Card 1: Wallet Balance */}
        <div className="worker-stat-card">
          <div className="worker-stat-top">
            <span className="worker-stat-label">Available Balance</span>
            <div className="worker-stat-icon-wrap emerald">💳</div>
          </div>
          <div className="worker-stat-val">
            ₹{loadingSummary ? "..." : formatINR(summary?.wallet_balance)}
          </div>
          <div className="worker-stat-subtext">
            <span className="worker-stat-badge green">Active</span>
            <span>Ready for payout</span>
          </div>
        </div>

        {/* Card 2: Lifetime Cumulative Earnings */}
        <div className="worker-stat-card">
          <div className="worker-stat-top">
            <span className="worker-stat-label">Total Lifetime Earned</span>
            <div className="worker-stat-icon-wrap teal">🏆</div>
          </div>
          <div className="worker-stat-val">
            ₹{loadingSummary ? "..." : formatINR(summary?.total_earned)}
          </div>
          <div className="worker-stat-subtext">
            <span>{summary?.completed_services_count ?? 0} Services Completed</span>
          </div>
        </div>

        {/* Card 3: Today's / Filtered Period Earnings */}
        <div className="worker-stat-card">
          <div className="worker-stat-top">
            <span className="worker-stat-label">
              {summary?.has_custom_range ? "Selected Range Earned" : "Today's Earned"}
            </span>
            <div className="worker-stat-icon-wrap indigo">📈</div>
          </div>
          <div className="worker-stat-val">
            ₹
            {loadingSummary
              ? "..."
              : formatINR(
                  summary?.has_custom_range
                    ? summary?.range_earned
                    : summary?.today_earned
                )}
          </div>
          <div className="worker-stat-subtext">
            <span>
              {summary?.has_custom_range
                ? `${summary?.range_services_count ?? 0} jobs in range`
                : "Credited today"}
            </span>
          </div>
        </div>

        {/* Card 4: Agreed Commission Rate */}
        <div className="worker-stat-card">
          <div className="worker-stat-top">
            <span className="worker-stat-label">Commission Share</span>
            <div className="worker-stat-icon-wrap gold">✂️</div>
          </div>
          <div className="worker-stat-val">
            {summary?.commission_rate || "60.00"}%
          </div>
          <div className="worker-stat-subtext">
            <span className="worker-stat-badge blue">
              {summary?.commission_tier || "Standard Tier"}
            </span>
            <span>Per Completed Service</span>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* 4. Sub-Tabs Navigation (Booking Earnings vs Transaction Ledger)     */}
      {/* ------------------------------------------------------------------ */}
      <div className="worker-revenue-tabs-nav">
        <button
          type="button"
          className={`worker-subtab-btn ${subTab === "earnings" ? "active" : ""}`}
          onClick={() => setSubTab("earnings")}
        >
          <span>📋 Booking Earnings</span>
          <span className="worker-tab-count-pill">{earningsCount}</span>
        </button>

        <button
          type="button"
          className={`worker-subtab-btn ${subTab === "transactions" ? "active" : ""}`}
          onClick={() => setSubTab("transactions")}
        >
          <span>📜 Transaction Ledger</span>
          <span className="worker-tab-count-pill">{transactionsCount}</span>
        </button>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* TAB A: Booking Earnings View                                       */}
      {/* ------------------------------------------------------------------ */}
      {subTab === "earnings" && (
        <div className="worker-tab-content">
          <div className="worker-table-controls">
            <div className="worker-search-input-wrap">
              <span className="search-icon">🔍</span>
              <input
                type="text"
                placeholder="Search by Booking #, client name, service..."
                value={earningsSearch}
                onChange={(e) => {
                  setEarningsSearch(e.target.value);
                  setEarningsPage(1);
                }}
              />
            </div>

            <div className="worker-filter-select-group">
              <select
                className="worker-filter-select"
                value={earningsStatus}
                onChange={(e) => {
                  setEarningsStatus(e.target.value);
                  setEarningsPage(1);
                }}
              >
                <option value="">All Statuses</option>
                <option value="CREDITED">Credited</option>
                <option value="REVERSED">Reversed</option>
                <option value="PENDING">Pending</option>
              </select>
            </div>
          </div>

          <div className="worker-table-card">
            {earningsLoading ? (
              <div className="worker-loading-state">
                <div className="worker-spinner" />
                <span>Loading your booking earnings...</span>
              </div>
            ) : earnings.length === 0 ? (
              <div className="worker-empty-state">
                <div className="worker-empty-icon">✂️</div>
                <div className="worker-empty-title">No booking earnings found</div>
                <div className="worker-empty-sub">
                  Completed appointments assigned to you will automatically record your
                  commission share here.
                </div>
              </div>
            ) : (
              <div className="worker-table-wrap">
                <table className="worker-data-table">
                  <thead>
                    <tr>
                      <th>Booking Ref</th>
                      <th>Client Name</th>
                      <th>Service Rendered</th>
                      <th>Gross Price</th>
                      <th>Commission</th>
                      <th>Your Earning</th>
                      <th>Salon Share</th>
                      <th>Date Credited</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {earnings.map((e) => (
                      <tr key={e.id}>
                        <td>
                          <span className="worker-booking-id-pill">
                            #{e.booking || e.id}
                          </span>
                        </td>
                        <td>
                          <div className="worker-client-cell">
                            <span className="worker-client-name">
                              {e.booking_client_name || "Client"}
                            </span>
                          </div>
                        </td>
                        <td>
                          <div className="worker-service-cell">
                            <span className="worker-service-title">
                              {e.booking_service_name || "Salon Service"}
                            </span>
                            {e.description && (
                              <span className="worker-service-sub">
                                {e.description}
                              </span>
                            )}
                          </div>
                        </td>
                        <td>
                          <strong>₹{formatINR(e.service_price)}</strong>
                        </td>
                        <td>
                          <span>{Number(e.commission_rate || 60)}%</span>
                        </td>
                        <td>
                          <span
                            className={
                              e.status === "REVERSED"
                                ? "worker-reversal-highlight"
                                : "worker-earning-highlight"
                            }
                          >
                            ₹{formatINR(e.earning_amount)}
                          </span>
                        </td>
                        <td>
                          <span style={{ color: "#64748b" }}>
                            ₹{formatINR(e.salon_share)}
                          </span>
                        </td>
                        <td>
                          <span style={{ fontSize: "0.82rem", color: "#64748b" }}>
                            {e.formatted_date || e.created_at?.slice(0, 10)}
                          </span>
                        </td>
                        <td>
                          <span
                            className={`worker-status-badge ${
                              e.status === "CREDITED"
                                ? "credited"
                                : e.status === "REVERSED"
                                ? "reversed"
                                : "pending"
                            }`}
                          >
                            {e.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination Controls */}
            {earningsTotalPages > 1 && (
              <div className="worker-table-footer">
                <div className="worker-footer-count">
                  Showing page {earningsPage} of {earningsTotalPages} ({earningsCount} total)
                </div>
                <div className="worker-pagination-btns">
                  <button
                    type="button"
                    className="worker-page-btn"
                    disabled={earningsPage <= 1}
                    onClick={() => setEarningsPage((prev) => Math.max(1, prev - 1))}
                  >
                    &larr; Previous
                  </button>
                  <span className="worker-page-indicator">
                    {earningsPage} / {earningsTotalPages}
                  </span>
                  <button
                    type="button"
                    className="worker-page-btn"
                    disabled={earningsPage >= earningsTotalPages}
                    onClick={() => setEarningsPage((prev) => prev + 1)}
                  >
                    Next &rarr;
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* TAB B: Wallet Transaction Ledger View                              */}
      {/* ------------------------------------------------------------------ */}
      {subTab === "transactions" && (
        <div className="worker-tab-content">
          <div className="worker-table-controls">
            <div className="worker-search-input-wrap">
              <span className="search-icon">🔍</span>
              <input
                type="text"
                placeholder="Search transaction description, booking #..."
                value={transactionsSearch}
                onChange={(e) => {
                  setTransactionsSearch(e.target.value);
                  setTransactionsPage(1);
                }}
              />
            </div>

            <div className="worker-filter-select-group">
              <select
                className="worker-filter-select"
                value={transactionsFlow}
                onChange={(e) => {
                  setTransactionsFlow(e.target.value);
                  setTransactionsPage(1);
                }}
              >
                <option value="">All Flows</option>
                <option value="CREDIT">Credits (+)</option>
                <option value="DEBIT">Debits (-)</option>
              </select>

              <select
                className="worker-filter-select"
                value={transactionsType}
                onChange={(e) => {
                  setTransactionsType(e.target.value);
                  setTransactionsPage(1);
                }}
              >
                <option value="">All Transaction Types</option>
                <option value="COMMISSION_CREDIT">Commission Credit</option>
                <option value="COMMISSION_REVERSAL">Commission Reversal</option>
                <option value="PAYOUT">Payout</option>
                <option value="ADJUSTMENT">Adjustment</option>
              </select>
            </div>
          </div>

          <div className="worker-table-card">
            {transactionsLoading ? (
              <div className="worker-loading-state">
                <div className="worker-spinner" />
                <span>Loading transaction audit records...</span>
              </div>
            ) : transactions.length === 0 ? (
              <div className="worker-empty-state">
                <div className="worker-empty-icon">📜</div>
                <div className="worker-empty-title">No transactions recorded yet</div>
                <div className="worker-empty-sub">
                  Every wallet credit or adjustment generates an immutable audit record here.
                </div>
              </div>
            ) : (
              <div className="worker-table-wrap">
                <table className="worker-data-table">
                  <thead>
                    <tr>
                      <th>Tx Ref</th>
                      <th>Type &amp; Flow</th>
                      <th>Amount</th>
                      <th>Balance After</th>
                      <th>Booking Ref</th>
                      <th>Date &amp; Time</th>
                      <th>Audit Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((tx) => (
                      <tr key={tx.id}>
                        <td>
                          <span className="worker-booking-id-pill">
                            TX #{tx.id}
                          </span>
                        </td>
                        <td>
                          <span
                            className={`worker-status-badge ${
                              tx.flow === "CREDIT" ? "credit-flow" : "debit-flow"
                            }`}
                          >
                            {tx.flow === "CREDIT" ? "+ " : "- "}
                            {tx.transaction_type?.replace(/_/g, " ")}
                          </span>
                        </td>
                        <td>
                          <span
                            className={
                              tx.flow === "CREDIT"
                                ? "worker-earning-highlight"
                                : "worker-reversal-highlight"
                            }
                          >
                            {tx.flow === "CREDIT" ? "+" : "-"}₹{formatINR(tx.amount)}
                          </span>
                        </td>
                        <td>
                          <strong>₹{formatINR(tx.balance_after)}</strong>
                        </td>
                        <td>
                          {tx.booking_id ? (
                            <span className="worker-booking-id-pill">
                              #{tx.booking_id}
                            </span>
                          ) : (
                            <span style={{ color: "#94a3b8" }}>—</span>
                          )}
                        </td>
                        <td>
                          <span style={{ fontSize: "0.82rem", color: "#64748b" }}>
                            {tx.formatted_date || tx.created_at?.slice(0, 10)}
                          </span>
                        </td>
                        <td>
                          <div className="worker-desc-cell">{tx.description}</div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination Controls */}
            {transactionsTotalPages > 1 && (
              <div className="worker-table-footer">
                <div className="worker-footer-count">
                  Showing page {transactionsPage} of {transactionsTotalPages} (
                  {transactionsCount} total)
                </div>
                <div className="worker-pagination-btns">
                  <button
                    type="button"
                    className="worker-page-btn"
                    disabled={transactionsPage <= 1}
                    onClick={() =>
                      setTransactionsPage((prev) => Math.max(1, prev - 1))
                    }
                  >
                    &larr; Previous
                  </button>
                  <span className="worker-page-indicator">
                    {transactionsPage} / {transactionsTotalPages}
                  </span>
                  <button
                    type="button"
                    className="worker-page-btn"
                    disabled={transactionsPage >= transactionsTotalPages}
                    onClick={() => setTransactionsPage((prev) => prev + 1)}
                  >
                    Next &rarr;
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

