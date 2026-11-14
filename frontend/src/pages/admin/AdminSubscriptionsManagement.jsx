import { useState, useEffect, useCallback } from "react";
import api from "../../api/axios";
import AdminSidebar from "../../components/admin/AdminSidebar";
import NotificationBell from "../../components/common/NotificationBell";
import { resolveImageUrl } from "../../utils/imageUtils";
import "../../styles/adminSubscriptions.css";

const getPageNumbers = (current = 1, total = 1) => {
  const safeTotal = Math.max(1, Number(total) || 1);
  const safeCurrent = Math.max(1, Math.min(Number(current) || 1, safeTotal));
  if (safeTotal <= 5) {
    return Array.from({ length: safeTotal }, (_, i) => i + 1);
  }
  const pages = [];
  pages.push(1);
  if (safeCurrent > 3) {
    pages.push("...");
  }
  const start = Math.max(2, safeCurrent - 1);
  const end = Math.min(safeTotal - 1, safeCurrent + 1);
  for (let i = start; i <= end; i++) {
    if (!pages.includes(i)) pages.push(i);
  }
  if (safeCurrent < safeTotal - 2) {
    pages.push("...");
  }
  if (!pages.includes(safeTotal)) {
    pages.push(safeTotal);
  }
  return pages;
};

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
  const [salonsPage, setSalonsPage] = useState(1);
  const [salonsPageSize, setSalonsPageSize] = useState(10);
  const [salonsTotalCount, setSalonsTotalCount] = useState(0);
  const [salonsTotalPages, setSalonsTotalPages] = useState(1);

  // Plans & Settings state
  const [plans, setPlans] = useState([]);
  const [settings, setSettings] = useState({ default_trial_days: 30, trial_reminder_days: [7, 3, 1] });
  const [savingPlanId, setSavingPlanId] = useState(null);
  const [savingSettings, setSavingSettings] = useState(false);

  // Create / Edit Plan Modal state
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);
  const [planForm, setPlanForm] = useState({
    name: "",
    duration_months: 1,
    price: "",
    original_price: "",
    badge_text: "",
    description: "",
    features: "",
    is_active: true,
  });
  const [submittingPlan, setSubmittingPlan] = useState(false);
  const [togglingPlanId, setTogglingPlanId] = useState(null);

  // View Subscribed Salons Modal state
  const [viewingPlanSalons, setViewingPlanSalons] = useState(null);
  const [planSalonsData, setPlanSalonsData] = useState({ salons: [], active_salons_count: 0, total_salons_count: 0 });
  const [planSalonsLoading, setPlanSalonsLoading] = useState(false);

  // Platform Wallet & Transactions state
  const [walletData, setWalletData] = useState({ balance: "0.00", total_subscription_revenue: "0.00" });
  const [transactions, setTransactions] = useState([]);
  const [walletLoading, setWalletLoading] = useState(false);
  const [walletPage, setWalletPage] = useState(1);
  const [walletPageSize, setWalletPageSize] = useState(10);
  const [walletTotalCount, setWalletTotalCount] = useState(0);
  const [walletTotalPages, setWalletTotalPages] = useState(1);

  // Payments / Invoices state
  const [payments, setPayments] = useState([]);
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [paymentsPage, setPaymentsPage] = useState(1);
  const [paymentsPageSize, setPaymentsPageSize] = useState(10);
  const [paymentsTotalCount, setPaymentsTotalCount] = useState(0);
  const [paymentsTotalPages, setPaymentsTotalPages] = useState(1);

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
      const params = {
        page: salonsPage,
        page_size: salonsPageSize,
      };
      if (searchQuery) params.search = searchQuery;
      if (statusFilter !== "all") params.status = statusFilter;
      const res = await api.get("/subscriptions/admin/salons/", { params });
      const dataList = Array.isArray(res.data)
        ? res.data
        : res.data?.results || res.data?.salons || [];
      setSalonsSubs(dataList);
      setSalonsTotalCount(res.data?.total_count ?? res.data?.count ?? dataList.length);
      setSalonsTotalPages(res.data?.total_pages ?? 1);
    } catch (err) {
      console.error("Error fetching salon subscriptions:", err);
    } finally {
      setSalonsLoading(false);
    }
  }, [searchQuery, statusFilter, salonsPage, salonsPageSize]);

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
      const params = {
        page: walletPage,
        page_size: walletPageSize,
      };
      const res = await api.get("/subscriptions/admin/wallet/", { params });
      if (res.data?.wallet) setWalletData(res.data.wallet);
      const txs = Array.isArray(res.data?.transactions)
        ? res.data.transactions
        : res.data?.results || [];
      setTransactions(txs);
      setWalletTotalCount(res.data?.total_count ?? res.data?.count ?? txs.length);
      setWalletTotalPages(res.data?.total_pages ?? 1);
    } catch (err) {
      console.error("Error fetching platform wallet:", err);
    } finally {
      setWalletLoading(false);
    }
  }, [walletPage, walletPageSize]);

  // 5. Fetch Payments
  const fetchPayments = useCallback(async () => {
    setPaymentsLoading(true);
    try {
      const params = {
        page: paymentsPage,
        page_size: paymentsPageSize,
      };
      const res = await api.get("/subscriptions/admin/payments/", { params });
      const pmts = Array.isArray(res.data)
        ? res.data
        : res.data?.results || res.data?.payments || [];
      setPayments(pmts);
      setPaymentsTotalCount(res.data?.total_count ?? res.data?.count ?? pmts.length);
      setPaymentsTotalPages(res.data?.total_pages ?? 1);
    } catch (err) {
      console.error("Error fetching payments log:", err);
    } finally {
      setPaymentsLoading(false);
    }
  }, [paymentsPage, paymentsPageSize]);

  useEffect(() => {
    fetchStats();
    fetchPlansAndSettings();
  }, [fetchStats, fetchPlansAndSettings]);

  useEffect(() => {
    if (activeTab === "salons") fetchSalonsSubs();
    if (activeTab === "wallet") fetchWallet();
    if (activeTab === "payments") fetchPayments();
  }, [activeTab, fetchSalonsSubs, fetchWallet, fetchPayments]);

  // Open modal to create a new plan
  const handleOpenCreatePlan = () => {
    setEditingPlan(null);
    setPlanForm({
      name: "",
      duration_months: 1,
      price: "",
      original_price: "",
      badge_text: "",
      description: "Save more with our flexible salon subscription plan with 0% platform booking commission.",
      features: "0% platform booking commission\nUnlimited specialist workers & service catalog\nVerified Salon Badge on explore\nAutomated appointment reminders\nPriority customer support",
      is_active: true,
    });
    setIsPlanModalOpen(true);
  };

  // Open modal to edit an existing plan
  const handleOpenEditPlan = (plan) => {
    setEditingPlan(plan);
    setPlanForm({
      name: plan.name || "",
      duration_months: plan.duration_months || 1,
      price: plan.price || "",
      original_price: plan.original_price || "",
      badge_text: plan.badge_text || "",
      description: plan.description || "",
      features: Array.isArray(plan.features) ? plan.features.join("\n") : (plan.features || ""),
      is_active: Boolean(plan.is_active),
    });
    setIsPlanModalOpen(true);
  };

  // Save (Create or Update) plan
  const handleSavePlan = async (e) => {
    e.preventDefault();
    if (!planForm.name.trim()) {
      showToast("Please enter a plan name.");
      return;
    }
    if (!planForm.duration_months || Number(planForm.duration_months) < 1) {
      showToast("Please specify a valid duration of at least 1 month.");
      return;
    }
    if (planForm.price === "" || Number(planForm.price) < 0) {
      showToast("Please specify a valid plan price.");
      return;
    }

    setSubmittingPlan(true);

    const payload = {
      name: planForm.name.trim(),
      duration_months: Number(planForm.duration_months),
      price: Number(planForm.price),
      original_price: planForm.original_price ? Number(planForm.original_price) : null,
      badge_text: planForm.badge_text.trim(),
      description: planForm.description.trim() || "Full access to BookMySalon platform with 0% booking commission.",
      features: planForm.features,
      is_active: Boolean(planForm.is_active),
    };

    try {
      if (editingPlan) {
        const res = await api.put(`/subscriptions/admin/plans/${editingPlan.id}/`, payload);
        setPlans((prev) => prev.map((p) => (p.id === editingPlan.id ? res.data : p)));
        showToast(`Plan "${res.data.name}" updated successfully! (Applies to all future purchases)`);
      } else {
        const res = await api.post("/subscriptions/admin/plans/", payload);
        setPlans((prev) => [...prev, res.data]);
        showToast(`New plan "${res.data.name}" created and immediately active!`);
      }
      setIsPlanModalOpen(false);
      setEditingPlan(null);
      fetchPlansAndSettings();
    } catch (err) {
      const errData = err.response?.data;
      const errMsg =
        typeof errData === "string"
          ? errData
          : errData?.error || Object.values(errData || {})[0] || "Failed to save plan.";
      showToast(Array.isArray(errMsg) ? errMsg[0] : String(errMsg));
    } finally {
      setSubmittingPlan(false);
    }
  };

  // Toggle active / inactive status of plan
  const handleTogglePlanStatus = async (plan) => {
    setTogglingPlanId(plan.id);
    const newStatus = !plan.is_active;
    try {
      const res = await api.patch(`/subscriptions/admin/plans/${plan.id}/`, {
        is_active: newStatus,
      });
      setPlans((prev) => prev.map((p) => (p.id === plan.id ? res.data : p)));
      showToast(
        newStatus
          ? `Plan "${plan.name}" is now Active and immediately available to salons!`
          : `Plan "${plan.name}" is now Inactive. New salon purchases are paused.`
      );
    } catch (err) {
      showToast(err.response?.data?.error || "Failed to update plan status.");
    } finally {
      setTogglingPlanId(null);
    }
  };

  // View salons subscribed to a plan
  const handleViewPlanSalons = async (plan) => {
    setViewingPlanSalons(plan);
    setPlanSalonsLoading(true);
    try {
      const res = await api.get(`/subscriptions/admin/plans/${plan.id}/salons/`);
      setPlanSalonsData(res.data);
    } catch (err) {
      console.error("Error fetching subscribed salons:", err);
      showToast("Failed to fetch salons for this plan.");
    } finally {
      setPlanSalonsLoading(false);
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

  const renderPaginationBar = (
    currentPage,
    totalPages,
    totalCount,
    pageSize,
    onPageChange,
    onPageSizeChange,
    label = "records"
  ) => {
    if (totalCount === 0) return null;

    const startRecord = (currentPage - 1) * pageSize + 1;
    const endRecord = Math.min(currentPage * pageSize, totalCount);

    return (
      <div className="admin-subs-pagination-bar">
        <div className="admin-subs-pagination-info">
          Showing <strong>{startRecord}</strong>–<strong>{endRecord}</strong> of{" "}
          <strong>{totalCount}</strong> {label}
        </div>

        <div className="admin-subs-pagination-controls">
          <div className="admin-subs-pagination-size-select">
            <span>Rows per page:</span>
            <select
              className="admin-subs-select-compact"
              value={pageSize}
              onChange={(e) => {
                onPageSizeChange(Number(e.target.value));
                onPageChange(1);
              }}
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
          </div>

          <div className="admin-subs-pagination-buttons">
            <button
              type="button"
              className="admin-subs-pagination-btn"
              disabled={currentPage <= 1}
              onClick={() => onPageChange(Math.max(1, currentPage - 1))}
              aria-label="Previous Page"
            >
              ‹ Prev
            </button>

            {getPageNumbers(currentPage, totalPages).map((pageNum, idx) => {
              if (pageNum === "...") {
                return (
                  <span key={`ellipsis-${idx}`} className="admin-subs-pagination-ellipsis">
                    …
                  </span>
                );
              }
              return (
                <button
                  key={`page-${pageNum}`}
                  type="button"
                  className={`admin-subs-pagination-btn ${pageNum === currentPage ? "active" : ""}`}
                  onClick={() => onPageChange(pageNum)}
                >
                  {pageNum}
                </button>
              );
            })}

            <button
              type="button"
              className="admin-subs-pagination-btn"
              disabled={currentPage >= totalPages}
              onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
              aria-label="Next Page"
            >
              Next ›
            </button>
          </div>
        </div>
      </div>
    );
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
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setSalonsPage(1);
                  }}
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
                    onClick={() => {
                      setStatusFilter(f.key);
                      setSalonsPage(1);
                    }}
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
              <>
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

              {renderPaginationBar(
                salonsPage,
                salonsTotalPages,
                salonsTotalCount,
                salonsPageSize,
                setSalonsPage,
                setSalonsPageSize,
                "salons"
              )}
            </>
          )}
        </div>
      )}

        {/* TAB 2: Subscription Plans Management & Trial Settings */}
        {activeTab === "plans" && (
          <div className="admin-subs-panel">
            <div className="admin-plans-header-row">
              <div>
                <h2 style={{ fontSize: "20px", color: "#163622", margin: "0 0 6px 0" }}>
                  Subscription Plans Management
                </h2>
                <p style={{ color: "#557260", fontSize: "13.5px", margin: 0 }}>
                  Create and manage dynamic subscription tiers. Deactivating a plan prevents new purchases without affecting existing subscriptions.
                </p>
              </div>

              <button
                type="button"
                className="admin-btn-primary admin-create-plan-btn"
                onClick={handleOpenCreatePlan}
              >
                <span>➕</span>
                <span>Create New Plan</span>
              </button>
            </div>

            <div className="admin-plans-grid">
              {plans.map((p) => {
                const isActive = Boolean(p.is_active);
                const isToggling = togglingPlanId === p.id;
                const durationLabel =
                  p.duration_months === 1
                    ? "1 Month (Monthly)"
                    : p.duration_months === 3
                    ? "3 Months (Quarterly)"
                    : p.duration_months === 6
                    ? "6 Months (Half-Yearly)"
                    : p.duration_months === 12
                    ? "12 Months (Yearly)"
                    : p.duration_months === 24
                    ? "24 Months (2-Year Premium)"
                    : `${p.duration_months} Months`;

                return (
                  <div
                    key={p.id}
                    className={`admin-plan-card ${isActive ? "active-plan" : "inactive-plan"} ${p.badge_text ? "featured" : ""}`}
                  >
                    <div className="admin-plan-card-top-status">
                      <span className={`admin-plan-status-pill ${isActive ? "active" : "inactive"}`}>
                        <span className="status-dot" />
                        {isActive ? "Active (Live)" : "Inactive (Hidden)"}
                      </span>
                      {p.badge_text && (
                        <span className="admin-plan-marketing-badge">{p.badge_text}</span>
                      )}
                    </div>

                    <div className="admin-plan-card-header">
                      <h3>{p.name}</h3>
                      <div className="admin-plan-duration-tag">
                        <span>⏱</span>
                        <span>{durationLabel}</span>
                      </div>
                    </div>

                    <div className="admin-plan-pricing-display">
                      <div className="admin-plan-price-main">
                        <span className="admin-plan-currency-sym">₹</span>
                        <span className="admin-plan-price-val">
                          {Number(p.price).toLocaleString("en-IN")}
                        </span>
                        <span className="admin-plan-cycle">
                          / {p.duration_months === 1 ? "mo" : `${p.duration_months} mos`}
                        </span>
                      </div>
                      {p.original_price && Number(p.original_price) > Number(p.price) && (
                        <div className="admin-plan-original-row">
                          <span className="admin-plan-orig-val">
                            ₹{Number(p.original_price).toLocaleString("en-IN")}
                          </span>
                          <span className="admin-plan-savings-pill">
                            Save {Math.round(((Number(p.original_price) - Number(p.price)) / Number(p.original_price)) * 100)}%
                          </span>
                        </div>
                      )}
                    </div>

                    {p.description && (
                      <p className="admin-plan-description" title={p.description}>
                        {p.description}
                      </p>
                    )}

                    {/* Subscribed Salons Counter Button */}
                    <button
                      type="button"
                      className="admin-plan-subscribers-pill"
                      onClick={() => handleViewPlanSalons(p)}
                      title="Click to view all subscribed salons"
                    >
                      <span className="subscribers-icon">🏪</span>
                      <span className="subscribers-count">
                        <strong>{p.active_salons_count || 0}</strong> Active Salons
                        <span className="subscribers-total">({p.total_salons_count || 0} Total)</span>
                      </span>
                      <span className="subscribers-arrow">&rarr;</span>
                    </button>

                    <ul className="admin-plan-features-list">
                      {(p.features || []).map((feat, idx) => (
                        <li key={idx}>{feat}</li>
                      ))}
                    </ul>

                    <div className="admin-plan-card-actions">
                      <button
                        type="button"
                        className="admin-plan-action-btn edit"
                        onClick={() => handleOpenEditPlan(p)}
                      >
                        <span>✏️</span>
                        <span>Edit Plan</span>
                      </button>

                      <button
                        type="button"
                        className={`admin-plan-action-btn toggle ${isActive ? "deactivate" : "activate"}`}
                        disabled={isToggling}
                        onClick={() => handleTogglePlanStatus(p)}
                      >
                        <span>{isActive ? "⏸" : "▶"}</span>
                        <span>{isToggling ? "Updating..." : isActive ? "Deactivate" : "Activate"}</span>
                      </button>

                      <button
                        type="button"
                        className="admin-plan-action-btn salons"
                        onClick={() => handleViewPlanSalons(p)}
                        title="View salons currently on this plan"
                      >
                        <span>👥</span>
                        <span>Salons</span>
                      </button>
                    </div>
                  </div>
                );
              })}
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
              <>
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

              {renderPaginationBar(
                walletPage,
                walletTotalPages,
                walletTotalCount,
                walletPageSize,
                setWalletPage,
                setWalletPageSize,
                "transactions"
              )}
            </>
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
              <>
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

              {renderPaginationBar(
                paymentsPage,
                paymentsTotalPages,
                paymentsTotalCount,
                paymentsPageSize,
                setPaymentsPage,
                setPaymentsPageSize,
                "invoices"
              )}
            </>
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

      {/* Create / Edit Plan Modal */}
      {isPlanModalOpen && (
        <div className="admin-modal-overlay">
          <div className="admin-modal-card admin-modal-wide">
            <div className="admin-modal-header">
              <div>
                <h3>{editingPlan ? `Edit Subscription Plan: ${editingPlan.name}` : "Create New Subscription Plan"}</h3>
                <p style={{ margin: "4px 0 0 0", fontSize: "12.5px", color: "#557260" }}>
                  {editingPlan
                    ? "Editing applies to future salon purchases. Existing subscriptions retain their original price, duration, and benefits."
                    : "New subscription plans become available to salons immediately once activated."}
                </p>
              </div>
              <button
                type="button"
                className="admin-modal-close-btn"
                onClick={() => {
                  setIsPlanModalOpen(false);
                  setEditingPlan(null);
                }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSavePlan}>
              <div className="admin-modal-grid-2">
                <div className="admin-modal-form-group">
                  <label>Plan Name *</label>
                  <input
                    type="text"
                    value={planForm.name}
                    onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })}
                    placeholder="e.g. 2-Year Premium, Quarterly Pro..."
                    required
                  />
                </div>

                <div className="admin-modal-form-group">
                  <label>Marketing Badge (Optional)</label>
                  <input
                    type="text"
                    value={planForm.badge_text}
                    onChange={(e) => setPlanForm({ ...planForm, badge_text: e.target.value })}
                    placeholder="e.g. Best Value, Save 40%, Most Popular..."
                  />
                </div>
              </div>

              <div className="admin-modal-form-group">
                <label>Billing Duration (Months) *</label>
                <div className="admin-duration-presets">
                  {[
                    { months: 1, label: "1 Mo (Monthly)" },
                    { months: 3, label: "3 Mos (Quarterly)" },
                    { months: 6, label: "6 Mos (Half-Yearly)" },
                    { months: 12, label: "12 Mos (Yearly)" },
                    { months: 24, label: "24 Mos (2-Year Premium)" },
                  ].map((preset) => (
                    <button
                      key={preset.months}
                      type="button"
                      className={`admin-duration-preset-btn ${Number(planForm.duration_months) === preset.months ? "active" : ""}`}
                      onClick={() => setPlanForm({ ...planForm, duration_months: preset.months })}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "12px", marginTop: "8px", flexWrap: "wrap" }}>
                  <input
                    type="number"
                    min="1"
                    value={planForm.duration_months}
                    onChange={(e) => setPlanForm({ ...planForm, duration_months: e.target.value })}
                    placeholder="Duration in months..."
                    style={{ maxWidth: "160px" }}
                    required
                  />
                  <span style={{ fontSize: "13px", color: "#4f6758", fontWeight: 600 }}>
                    Month(s) = {Number(planForm.duration_months || 0) * 30} Days Platform Access
                  </span>
                </div>
              </div>

              <div className="admin-modal-grid-2">
                <div className="admin-modal-form-group">
                  <label>Current Plan Price (₹ INR) *</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={planForm.price}
                    onChange={(e) => setPlanForm({ ...planForm, price: e.target.value })}
                    placeholder="e.g. 7999"
                    required
                  />
                </div>

                <div className="admin-modal-form-group">
                  <label>Original Strikethrough Price (₹ INR, Optional)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={planForm.original_price}
                    onChange={(e) => setPlanForm({ ...planForm, original_price: e.target.value })}
                    placeholder="e.g. 11999 (shows savings strikethrough)"
                  />
                </div>
              </div>

              <div className="admin-modal-form-group">
                <label>Description *</label>
                <textarea
                  rows="2"
                  value={planForm.description}
                  onChange={(e) => setPlanForm({ ...planForm, description: e.target.value })}
                  placeholder="e.g. Save more with a 2-year plan. 100% revenue model with zero commission..."
                  required
                />
              </div>

              <div className="admin-modal-form-group">
                <label>Features (One bullet point per line) *</label>
                <textarea
                  rows="4"
                  value={planForm.features}
                  onChange={(e) => setPlanForm({ ...planForm, features: e.target.value })}
                  placeholder={"All premium features\n0% platform booking commission\nUnlimited specialist workers & service catalog\nVerified Salon Badge on explore\nAutomated appointment reminders"}
                  required
                />
              </div>

              <div className="admin-modal-form-group">
                <label>Plan Status *</label>
                <div className="admin-status-radio-group">
                  <label className={`admin-status-radio-label ${planForm.is_active ? "selected active" : ""}`}>
                    <input
                      type="radio"
                      name="planStatus"
                      checked={Boolean(planForm.is_active)}
                      onChange={() => setPlanForm({ ...planForm, is_active: true })}
                    />
                    <div>
                      <strong>Active (Live)</strong>
                      <span>Immediately purchasable by salon owners</span>
                    </div>
                  </label>

                  <label className={`admin-status-radio-label ${!planForm.is_active ? "selected inactive" : ""}`}>
                    <input
                      type="radio"
                      name="planStatus"
                      checked={!planForm.is_active}
                      onChange={() => setPlanForm({ ...planForm, is_active: false })}
                    />
                    <div>
                      <strong>Inactive (Deactivated)</strong>
                      <span>Hidden from salons; new purchases paused</span>
                    </div>
                  </label>
                </div>
              </div>

              <div className="admin-modal-actions">
                <button
                  type="button"
                  className="admin-btn-secondary"
                  onClick={() => {
                    setIsPlanModalOpen(false);
                    setEditingPlan(null);
                  }}
                >
                  Cancel
                </button>
                <button type="submit" className="admin-btn-primary" disabled={submittingPlan}>
                  {submittingPlan ? "Saving Plan..." : editingPlan ? "Save Plan Changes" : "Create & Activate Plan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Subscribed Salons Modal */}
      {viewingPlanSalons && (
        <div className="admin-modal-overlay">
          <div className="admin-modal-card admin-modal-wide">
            <div className="admin-modal-header">
              <div>
                <h3>Subscribed Salons: {viewingPlanSalons.name}</h3>
                <p style={{ margin: "4px 0 0 0", fontSize: "12.5px", color: "#557260" }}>
                  Billing Duration: {viewingPlanSalons.duration_months} Month(s) • ₹{Number(viewingPlanSalons.price).toLocaleString("en-IN")}
                </p>
              </div>
              <button
                type="button"
                className="admin-modal-close-btn"
                onClick={() => {
                  setViewingPlanSalons(null);
                  setPlanSalonsData({ salons: [], active_salons_count: 0, total_salons_count: 0 });
                }}
              >
                ✕
              </button>
            </div>

            <div className="admin-plan-salons-summary-bar">
              <div className="salons-summary-chip active">
                <span className="dot" />
                <span>Active Subscriptions: <strong>{planSalonsData.active_salons_count || 0}</strong></span>
              </div>
              <div className="salons-summary-chip total">
                <span>Total Enrolled: <strong>{planSalonsData.total_salons_count || 0}</strong></span>
              </div>
            </div>

            {planSalonsLoading ? (
              <div style={{ textAlign: "center", padding: "40px", color: "#668472" }}>
                Loading subscribed salons...
              </div>
            ) : !planSalonsData.salons || planSalonsData.salons.length === 0 ? (
              <div className="admin-plan-salons-empty">
                <div style={{ fontSize: "36px", marginBottom: "8px" }}>🏪</div>
                <h4>No Salons Subscribed Yet</h4>
                <p>No partner salon has subscribed to "{viewingPlanSalons.name}" yet.</p>
              </div>
            ) : (
              <div style={{ maxHeight: "420px", overflowY: "auto" }}>
                <table className="admin-subs-table">
                  <thead>
                    <tr>
                      <th>Salon</th>
                      <th>Owner Email</th>
                      <th>Status</th>
                      <th>Active Period</th>
                      <th>Days Left</th>
                      <th style={{ textAlign: "right" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {planSalonsData.salons.map((sub) => {
                      const isExpired = !sub.is_currently_active;
                      const isExpiringSoon = sub.is_expiring_soon;

                      return (
                        <tr key={sub.id}>
                          <td>
                            <div className="admin-sub-salon-cell">
                              <img
                                src={resolveImageUrl(sub.salon_cover_image)}
                                alt=""
                                className="admin-sub-salon-avatar"
                              />
                              <div>
                                <div className="admin-sub-salon-name">{sub.salon_name}</div>
                                <div className="admin-sub-salon-city">📍 {sub.salon_city || "Kerala"}</div>
                              </div>
                            </div>
                          </td>
                          <td>
                            <span style={{ fontSize: "13px", color: "#4f6758" }}>{sub.owner_email}</span>
                          </td>
                          <td>
                            {isExpired ? (
                              <span className="admin-sub-badge expired">
                                <span className="admin-sub-badge-dot" /> Expired
                              </span>
                            ) : isExpiringSoon ? (
                              <span className="admin-sub-badge expiring">
                                <span className="admin-sub-badge-dot" /> Expiring Soon ({sub.days_remaining}d)
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
                            <strong>
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
                              <span>Extend</span>
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
