import { useState, useEffect, useCallback } from "react";
import api from "../../api/axios";
import AdminSidebar from "../../components/admin/AdminSidebar";
import NotificationBell from "../../components/common/NotificationBell";
import { resolveImageUrl } from "../../utils/imageUtils";
import "../../styles/adminSubscriptions.css";

export default function AdminSubscriptionsManagement() {
  const [activeTab, setActiveTab] = useState("salons"); // salons, plans, wallet, payments

  // Stats state
  const [stats, setStats] = useState({
    total_revenue: "0.00",
    wallet_balance: "0.00",
    total_salons: 0,
    active_trials_count: 0,
    active_paid_count: 0,
    expiring_soon_count: 0,
    expired_count: 0,
    total_successful_payments: 0,
  });

  // Salons list state
  const [salonsSubs, setSalonsSubs] = useState([]);
  const [salonsLoading, setSalonsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  console.log(salonsSubs);
  

  // Plans & Settings state
  const [plans, setPlans] = useState([]);
  const [settings, setSettings] = useState({ default_trial_days: 30, trial_reminder_days: [7, 3, 1] });
  const [savingPlanId, setSavingPlanId] = useState(null);
  const [savingSettings, setSavingSettings] = useState(false);

  // Platform Wallet & Transactions state
  const [walletData, setWalletData] = useState({ balance: "0.00", total_subscription_revenue: "0.00" });
  const [transactions, setTransactions] = useState([]);
  const [walletLoading, setWalletLoading] = useState(false);

  // Payments / Invoices state
  const [payments, setPayments] = useState([]);
  const [paymentsLoading, setPaymentsLoading] = useState(false);

  // Extend Modal state
  const [extendModalSalon, setExtendModalSalon] = useState(null);
  const [extendDays, setExtendDays] = useState(30);
  const [extendReason, setExtendReason] = useState("");
  const [extendSubmitting, setExtendSubmitting] = useState(false);

  // Toast banner
  const [toastMessage, setToastMessage] = useState(null);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // 1. Fetch Global Stats
  const fetchStats = useCallback(async () => {
    try {
      const res = await api.get("/subscriptions/admin/stats/");
      if (res.data) setStats(res.data);
    } catch (err) {
      console.error("Error fetching subscription stats:", err);
    }
  }, []);

  // 2. Fetch Salons Subscriptions
  const fetchSalonsSubs = useCallback(async () => {
    setSalonsLoading(true);
    try {
      const params = {};
      if (searchQuery) params.search = searchQuery;
      if (statusFilter !== "all") params.status = statusFilter;
      const res = await api.get("/subscriptions/admin/salons/", { params });
      setSalonsSubs(res.data || []);
    } catch (err) {
      console.error("Error fetching salon subscriptions:", err);
    } finally {
      setSalonsLoading(false);
    }
  }, [searchQuery, statusFilter]);

  // 3. Fetch Plans & Settings
  const fetchPlansAndSettings = useCallback(async () => {
    try {
      const [plansRes, settingsRes] = await Promise.all([
        api.get("/subscriptions/admin/plans/"),
        api.get("/subscriptions/admin/settings/"),
      ]);
      setPlans(plansRes.data || []);
      if (settingsRes.data) setSettings(settingsRes.data);
    } catch (err) {
      console.error("Error fetching plans or settings:", err);
    }
  }, []);

  // 4. Fetch Wallet & Transactions
  const fetchWallet = useCallback(async () => {
    setWalletLoading(true);
    try {
      const res = await api.get("/subscriptions/admin/wallet/");
      if (res.data?.wallet) setWalletData(res.data.wallet);
      if (res.data?.transactions) setTransactions(res.data.transactions);
    } catch (err) {
      console.error("Error fetching platform wallet:", err);
    } finally {
      setWalletLoading(false);
    }
  }, []);

  // 5. Fetch Payments
  const fetchPayments = useCallback(async () => {
    setPaymentsLoading(true);
    try {
      const res = await api.get("/subscriptions/admin/payments/");
      setPayments(res.data || []);
    } catch (err) {
      console.error("Error fetching payments log:", err);
    } finally {
      setPaymentsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    fetchPlansAndSettings();
  }, [fetchStats, fetchPlansAndSettings]);

  useEffect(() => {
    if (activeTab === "salons") fetchSalonsSubs();
    if (activeTab === "wallet") fetchWallet();
    if (activeTab === "payments") fetchPayments();
  }, [activeTab, fetchSalonsSubs, fetchWallet, fetchPayments]);

  // Handle plan price/feature edit
  const handleUpdatePlan = async (planId, updatedFields) => {
    setSavingPlanId(planId);
    try {
      const res = await api.put(`/subscriptions/admin/plans/${planId}/`, updatedFields);
      setPlans((prev) => prev.map((p) => (p.id === planId ? res.data : p)));
      showToast("Plan details updated successfully!");
    } catch (err) {
      showToast(err.response?.data?.error || "Failed to update plan.");
    } finally {
      setSavingPlanId(null);
    }
  };

  // Handle settings update
  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      const res = await api.put("/subscriptions/admin/settings/", {
        default_trial_days: Number(settings.default_trial_days),
      });
      setSettings(res.data);
      showToast("Default trial duration updated successfully!");
    } catch (err) {
      showToast(err.response?.data?.error || "Failed to save settings.");
    } finally {
      setSavingSettings(false);
    }
  };

  // Handle manual extension
  const handleExtendSubmit = async (e) => {
    e.preventDefault();
    if (!extendModalSalon) return;
    setExtendSubmitting(true);
    try {
      const res = await api.post(`/subscriptions/admin/salons/${extendModalSalon.salon_id}/extend/`, {
        extra_days: Number(extendDays),
        reason: extendReason,
      });
      showToast(res.data?.message || `Extended by ${extendDays} days!`);
      setExtendModalSalon(null);
      setExtendReason("");
      fetchStats();
      fetchSalonsSubs();
    } catch (err) {
      showToast(err.response?.data?.error || "Failed to extend subscription.");
    } finally {
      setExtendSubmitting(false);
    }
  };

  return (
    <div className="admin-subs-page">
      <AdminSidebar activeTab="subscriptions" />

      <main className="admin-subs-main">
        {/* Header & Platform Wallet Banner */}
        <div className="admin-subs-header">
          <div className="admin-subs-header-info">
            <h1>Platform Subscriptions & Revenue</h1>
            <p>100% subscription-based model with zero booking commissions. Manage plans, trials, and platform wallet.</p>
          </div>

          <div className="admin-subs-wallet-hero">
            <div>
              <div className="admin-subs-wallet-label">Super Admin Wallet Balance</div>
              <div className="admin-subs-wallet-balance">
                ₹{Number(stats.wallet_balance || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                <span className="admin-subs-wallet-currency">INR</span>
              </div>
            </div>
            <div className="admin-subs-wallet-stats">
              <div>
                <div className="admin-subs-substat-label">Total Subscriptions Revenue</div>
                <div className="admin-subs-substat-val">
                  ₹{Number(stats.total_revenue || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </div>
              </div>
              <div>
                <div className="admin-subs-substat-label">Paid Transactions</div>
                <div className="admin-subs-substat-val">{stats.total_successful_payments}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Metrics Bar */}
        <div className="admin-subs-metrics-grid">
          <div className="admin-subs-metric-card">
            <div className="admin-subs-metric-top">
              <span className="admin-subs-metric-title">Active Free Trials</span>
              <span className="admin-subs-metric-icon">🎁</span>
            </div>
            <div className="admin-subs-metric-num">{stats.active_trials_count}</div>
            <div className="admin-subs-metric-desc">Newly approved salons enjoying 30 days trial</div>
          </div>

          <div className="admin-subs-metric-card">
            <div className="admin-subs-metric-top">
              <span className="admin-subs-metric-title">Active Paid Plans</span>
              <span className="admin-subs-metric-icon">✨</span>
            </div>
            <div className="admin-subs-metric-num">{stats.active_paid_count}</div>
            <div className="admin-subs-metric-desc">Monthly, Half-Yearly & Yearly partners</div>
          </div>

          <div className="admin-subs-metric-card">
            <div className="admin-subs-metric-top">
              <span className="admin-subs-metric-title">Expiring Soon</span>
              <span className="admin-subs-metric-icon">⏳</span>
            </div>
            <div className="admin-subs-metric-num" style={{ color: "#b06000" }}>
              {stats.expiring_soon_count}
            </div>
            <div className="admin-subs-metric-desc">Expirations within the next 7 days</div>
          </div>

          <div className="admin-subs-metric-card">
            <div className="admin-subs-metric-top">
              <span className="admin-subs-metric-title">Expired Subscriptions</span>
              <span className="admin-subs-metric-icon">🚫</span>
            </div>
            <div className="admin-subs-metric-num" style={{ color: "#c5221f" }}>
              {stats.expired_count}
            </div>
            <div className="admin-subs-metric-desc">Booking reception currently disabled</div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="admin-subs-tabs">
          <button
            type="button"
            className={`admin-subs-tab-btn ${activeTab === "salons" ? "active" : ""}`}
            onClick={() => setActiveTab("salons")}
          >
            <span>🏪 Salon Subscriptions Directory</span>
            <span className="admin-subs-tab-badge">{stats.total_salons}</span>
          </button>

          <button
            type="button"
            className={`admin-subs-tab-btn ${activeTab === "plans" ? "active" : ""}`}
            onClick={() => setActiveTab("plans")}
          >
            <span>🏷️ Subscription Plans & Trial Settings</span>
          </button>

          <button
            type="button"
            className={`admin-subs-tab-btn ${activeTab === "wallet" ? "active" : ""}`}
            onClick={() => setActiveTab("wallet")}
          >
            <span>💳 Super Admin Wallet & Transactions</span>
          </button>

          <button
            type="button"
            className={`admin-subs-tab-btn ${activeTab === "payments" ? "active" : ""}`}
            onClick={() => setActiveTab("payments")}
          >
            <span>📄 Payment Invoices & Audits</span>
          </button>
        </div>

        {/* TAB 1: Salons Directory */}
        {activeTab === "salons" && (
          <div className="admin-subs-panel">
            <div className="admin-subs-toolbar">
              <div className="admin-subs-search-box">
                <span>🔍</span>
                <input
                  type="text"
                  placeholder="Search salon name, city, owner email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <div className="admin-subs-filters">
                {[
                  { key: "all", label: "All Salons" },
                  { key: "trial", label: "Free Trials" },
                  { key: "active", label: "Paid Active" },
                  { key: "expiring_soon", label: "Expiring Soon" },
                  { key: "expired", label: "Expired" },
                ].map((f) => (
                  <button
                    key={f.key}
                    type="button"
                    className={`admin-subs-filter-chip ${statusFilter === f.key ? "active" : ""}`}
                    onClick={() => setStatusFilter(f.key)}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {salonsLoading ? (
              <div style={{ textAlign: "center", padding: "48px 0", color: "#658270" }}>
                Loading salon subscriptions...
              </div>
            ) : salonsSubs.length === 0 ? (
              <div style={{ textAlign: "center", padding: "48px 0", color: "#658270" }}>
                No salon subscriptions match the selected criteria.
              </div>
            ) : (
              <div className="admin-subs-table-wrap">
                <table className="admin-subs-table">
                  <thead>
                    <tr>
                      <th>Salon Details</th>
                      <th>Plan Type</th>
                      <th>Subscription Status</th>
                      <th>Valid Period</th>
                      <th>Days Left</th>
                      <th style={{ textAlign: "right" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {salonsSubs.map((sub) => {
                      const isExpired = !sub.is_currently_active;
                      const isExpiringSoon = sub.is_expiring_soon;
                      const isTrial = sub.subscription_type === "TRIAL";

                      return (
                        <tr key={sub.id}>
                          <td>
                            <div className="admin-salon-cell">
                              <img
                                src={resolveImageUrl(sub.salon_cover_image)}
                                alt={sub.salon_name}
                                className="admin-salon-avatar"
                                onError={(e) => {
                                  e.target.src = "https://images.unsplash.com/photo-1560066984-138dadb4c035?w=100";
                                }}
                              />
                              <div>
                                <span className="admin-salon-name">{sub.salon_name}</span>
                                <span className="admin-salon-city">{sub.salon_city || "All India"} · {sub.owner_email}</span>
                              </div>
                            </div>
                          </td>

                          <td>
                            <strong>{sub.plan ? sub.plan.name : "30-Day Free Trial"}</strong>
                          </td>

                          <td>
                            {isExpired ? (
                              <span className="admin-sub-badge expired">
                                <span className="admin-sub-badge-dot" /> Expired (Bookings Paused)
                              </span>
                            ) : isExpiringSoon ? (
                              <span className="admin-sub-badge expiring">
                                <span className="admin-sub-badge-dot" /> Expiring Soon ({sub.days_remaining}d)
                              </span>
                            ) : isTrial ? (
                              <span className="admin-sub-badge trial">
                                <span className="admin-sub-badge-dot" /> Free Trial Active
                              </span>
                            ) : (
                              <span className="admin-sub-badge active">
                                <span className="admin-sub-badge-dot" /> Paid Active
                              </span>
                            )}
                          </td>

                          <td style={{ fontSize: "12.5px", color: "#4f6758" }}>
                            {new Date(sub.start_date).toLocaleDateString("en-IN", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}{" "}
                            &rarr;{" "}
                            <strong style={{ color: isExpired ? "#c5221f" : "#1a3d27" }}>
                              {new Date(sub.end_date).toLocaleDateString("en-IN", {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              })}
                            </strong>
                          </td>

                          <td>
                            <span
                              style={{
                                fontWeight: 700,
                                color: isExpired ? "#c5221f" : sub.days_remaining <= 7 ? "#b06000" : "#1e693b",
                              }}
                            >
                              {isExpired ? "0 days" : `${sub.days_remaining} days`}
                            </span>
                          </td>

                          <td style={{ textAlign: "right" }}>
                            <button
                              type="button"
                              className="admin-sub-action-btn"
                              onClick={() => {
                                setExtendModalSalon(sub);
                                setExtendDays(30);
                                setExtendReason("");
                              }}
                            >
                              <span>➕</span>
                              <span>Extend Days</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: Plan Pricing & Trial Settings */}
        {activeTab === "plans" && (
          <div className="admin-subs-panel">
            <h2 style={{ fontSize: "18px", color: "#163622", marginTop: 0, marginBottom: "8px" }}>
              Configure Subscription Plans & Billing Rates
            </h2>
            <p style={{ color: "#557260", fontSize: "13.5px", marginBottom: "24px" }}>
              Update the subscription rates offered to salon owners. Changes take effect immediately for all upcoming purchases.
            </p>

            <div className="admin-plans-grid">
              {plans.map((p) => (
                <div key={p.id} className={`admin-plan-card ${p.badge_text ? "featured" : ""}`}>
                  {p.badge_text && <div className="admin-plan-badge-top">{p.badge_text}</div>}

                  <div className="admin-plan-card-header">
                    <h3>{p.name}</h3>
                    <div className="admin-plan-duration-tag">Billing Duration: {p.duration_months} Month(s)</div>
                  </div>

                  <div className="admin-plan-price-editor">
                    <span className="admin-plan-currency-sym">₹</span>
                    <input
                      type="number"
                      className="admin-plan-price-input"
                      value={p.price}
                      onChange={(e) => {
                        const val = e.target.value;
                        setPlans((prev) => prev.map((item) => (item.id === p.id ? { ...item, price: val } : item)));
                      }}
                    />
                    <span style={{ fontSize: "13px", color: "#668472" }}>/ {p.duration_months} mo</span>
                  </div>

                  <ul className="admin-plan-features-list">
                    {(p.features || []).map((feat, idx) => (
                      <li key={idx}>{feat}</li>
                    ))}
                  </ul>

                  <button
                    type="button"
                    className="admin-plan-save-btn"
                    disabled={savingPlanId === p.id}
                    onClick={() => handleUpdatePlan(p.id, { price: p.price })}
                  >
                    {savingPlanId === p.id ? "Saving Rate..." : "Save Plan Price"}
                  </button>
                </div>
              ))}
            </div>

            {/* Trial Settings Box */}
            <div className="admin-subs-settings-box">
              <h4>Platform Free Trial Policy</h4>
              <p>
                Every newly approved salon automatically receives complimentary access upon Super Admin verification.
                Free trial is available only once per salon.
              </p>

              <div className="admin-subs-settings-row">
                <div className="admin-subs-input-group">
                  <input
                    type="number"
                    value={settings.default_trial_days}
                    onChange={(e) => setSettings({ ...settings, default_trial_days: e.target.value })}
                  />
                  <span style={{ fontWeight: 600, color: "#4f6857", marginLeft: "4px" }}>Days Free</span>
                </div>

                <button
                  type="button"
                  className="admin-btn-primary"
                  disabled={savingSettings}
                  onClick={handleSaveSettings}
                >
                  {savingSettings ? "Updating..." : "Save Free Trial Duration"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: Super Admin Wallet & Transactions */}
        {activeTab === "wallet" && (
          <div className="admin-subs-panel">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <div>
                <h2 style={{ fontSize: "18px", color: "#163622", margin: 0 }}>Super Admin Platform Wallet</h2>
                <p style={{ color: "#557260", fontSize: "13px", margin: "4px 0 0 0" }}>
                  Audited financial ledger where 100% of all salon subscription payments are credited.
                </p>
              </div>

              <div style={{ textAlign: "right" }}>
                <span style={{ fontSize: "12px", color: "#557260" }}>Live Available Balance</span>
                <div style={{ fontSize: "24px", fontWeight: 800, color: "#163622" }}>
                  ₹{Number(walletData.balance || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </div>
              </div>
            </div>

            {walletLoading ? (
              <div style={{ textAlign: "center", padding: "48px 0", color: "#658270" }}>Loading ledger...</div>
            ) : transactions.length === 0 ? (
              <div style={{ textAlign: "center", padding: "48px 0", color: "#658270" }}>
                No wallet transactions recorded yet.
              </div>
            ) : (
              <div className="admin-subs-table-wrap">
                <table className="admin-subs-table">
                  <thead>
                    <tr>
                      <th>Transaction ID</th>
                      <th>Date & Time</th>
                      <th>Salon & Plan</th>
                      <th>Credit Amount</th>
                      <th>Balance Prior</th>
                      <th>Balance After</th>
                      <th>Narrative</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((tx) => (
                      <tr key={tx.id}>
                        <td>
                          <span className="admin-tx-code">{tx.transaction_id}</span>
                        </td>
                        <td style={{ fontSize: "12px", color: "#557260" }}>
                          {new Date(tx.created_at).toLocaleString("en-IN", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                        <td>
                          <strong>{tx.salon_name || "Platform"}</strong>
                          <div style={{ fontSize: "11.5px", color: "#607d6b" }}>{tx.plan_name}</div>
                        </td>
                        <td>
                          <span className="admin-tx-credit">+₹{Number(tx.amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                        </td>
                        <td style={{ color: "#607d6b" }}>₹{Number(tx.balance_before).toFixed(2)}</td>
                        <td>
                          <strong>₹{Number(tx.balance_after).toFixed(2)}</strong>
                        </td>
                        <td style={{ fontSize: "12px", color: "#557260", maxWidth: "260px" }}>{tx.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: Payment Invoices & Audits */}
        {activeTab === "payments" && (
          <div className="admin-subs-panel">
            <div style={{ marginBottom: "20px" }}>
              <h2 style={{ fontSize: "18px", color: "#163622", margin: 0 }}>Subscription Payment Logs</h2>
              <p style={{ color: "#557260", fontSize: "13px", margin: "4px 0 0 0" }}>
                Razorpay payment records and digital invoice receipts.
              </p>
            </div>

            {paymentsLoading ? (
              <div style={{ textAlign: "center", padding: "48px 0", color: "#658270" }}>Loading invoices...</div>
            ) : payments.length === 0 ? (
              <div style={{ textAlign: "center", padding: "48px 0", color: "#658270" }}>
                No subscription payments recorded yet.
              </div>
            ) : (
              <div className="admin-subs-table-wrap">
                <table className="admin-subs-table">
                  <thead>
                    <tr>
                      <th>Invoice Receipt</th>
                      <th>Salon & Owner</th>
                      <th>Plan Purchased</th>
                      <th>Amount Paid</th>
                      <th>Gateway Payment ID</th>
                      <th>Status</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((pmt) => (
                      <tr key={pmt.id}>
                        <td>
                          <strong style={{ color: "#163622" }}>{pmt.receipt_number}</strong>
                        </td>
                        <td>
                          <strong>{pmt.salon_name}</strong>
                          <div style={{ fontSize: "11.5px", color: "#557260" }}>{pmt.owner_email}</div>
                        </td>
                        <td>{pmt.plan_name} ({pmt.plan_duration_months} mo)</td>
                        <td>
                          <strong style={{ color: "#184d28" }}>₹{Number(pmt.amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</strong>
                        </td>
                        <td>
                          <span className="admin-tx-code">{pmt.razorpay_payment_id || "Direct Verified"}</span>
                        </td>
                        <td>
                          <span className="admin-sub-badge active">
                            <span className="admin-sub-badge-dot" /> {pmt.status}
                          </span>
                        </td>
                        <td style={{ fontSize: "12px", color: "#557260" }}>
                          {new Date(pmt.created_at).toLocaleDateString("en-IN", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Manual Extension Modal */}
      {extendModalSalon && (
        <div className="admin-modal-overlay">
          <div className="admin-modal-card">
            <div className="admin-modal-header">
              <h3>Extend Subscription: {extendModalSalon.salon_name}</h3>
              <button
                type="button"
                className="admin-modal-close-btn"
                onClick={() => setExtendModalSalon(null)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleExtendSubmit}>
              <div className="admin-modal-form-group">
                <label>Select Extension Duration</label>
                <div style={{ display: "flex", gap: "8px", marginBottom: "10px" }}>
                  {[7, 15, 30, 60].map((d) => (
                    <button
                      key={d}
                      type="button"
                      className={`admin-subs-filter-chip ${extendDays === d ? "active" : ""}`}
                      onClick={() => setExtendDays(d)}
                    >
                      +{d} Days
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  min="1"
                  value={extendDays}
                  onChange={(e) => setExtendDays(e.target.value)}
                  placeholder="Enter custom days..."
                  required
                />
              </div>

              <div className="admin-modal-form-group">
                <label>Audit Reason / Administrative Note</label>
                <textarea
                  rows="3"
                  value={extendReason}
                  onChange={(e) => setExtendReason(e.target.value)}
                  placeholder="e.g. VIP salon partner complimentary extension, promotional courtesy..."
                />
              </div>

              <div className="admin-modal-actions">
                <button
                  type="button"
                  className="admin-btn-secondary"
                  onClick={() => setExtendModalSalon(null)}
                >
                  Cancel
                </button>
                <button type="submit" className="admin-btn-primary" disabled={extendSubmitting}>
                  {extendSubmitting ? "Extending..." : `Grant +${extendDays} Days Extension`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Toast Notification Banner */}
      {toastMessage && (
        <div className="admin-toast-banner">
          <span>🔔</span>
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}

