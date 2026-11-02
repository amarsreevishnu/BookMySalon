import React, { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import CustomerHeader from "../../components/customer/CustomerHeader";
import api from "../../api/axios";
import "../../styles/customerWallet.css";

const MAX_TOPUP_AMOUNT = 10000;

function loadRazorpayScript() {
  return new Promise((resolve) => {
    if (window.Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

function validateAmount(val) {
  if (val === "" || val === null || val === undefined) {
    return "Amount must be entered.";
  }
  const cleanStr = String(val).trim();
  const num = Number(cleanStr);
  if (isNaN(num)) {
    return "Amount must be a valid numeric value.";
  }
  if (num <= 0) {
    return "Amount must be greater than zero. Negative and zero values are not accepted.";
  }
  if (num > MAX_TOPUP_AMOUNT) {
    return `Maximum top-up amount per transaction is ₹${MAX_TOPUP_AMOUNT.toLocaleString("en-IN")}.`;
  }
  if (cleanStr.includes(".")) {
    const decimals = cleanStr.split(".")[1];
    if (decimals && decimals.length > 2) {
      return "Amount cannot have more than 2 decimal places.";
    }
  }
  return null;
}

export default function CustomerWallet() {
  const [wallet, setWallet] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [txLoading, setTxLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // Filters & Search
  const [filterType, setFilterType] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Top Up Modal State
  const [showTopUpModal, setShowTopUpModal] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState(1000);
  const [topUpNotes, setTopUpNotes] = useState("");
  const [topUpSubmitting, setTopUpSubmitting] = useState(false);
  const [topUpLoadingText, setTopUpLoadingText] = useState("");
  const [topUpError, setTopUpError] = useState("");
  const [copiedTxId, setCopiedTxId] = useState("");

  const presetAmounts = [500, 1000, 2000, 5000];

  // Fetch Wallet Overview
  const fetchWallet = useCallback(async () => {
    try {
      const res = await api.get("/wallet/");
      setWallet(res.data);
    } catch (err) {
      console.error("Failed to load customer wallet:", err);
      setError("Unable to load your wallet information. Please refresh.");
    }
  }, []);

  // Fetch Transactions with filter and search
  const fetchTransactions = useCallback(async () => {
    setTxLoading(true);
    try {
      const params = {};
      if (filterType !== "ALL") {
        params.type = filterType;
      }
      if (searchQuery.trim()) {
        params.search = searchQuery.trim();
      }
      const res = await api.get("/wallet/transactions/", { params });
      setTransactions(res.data?.results || res.data || []);
    } catch (err) {
      console.error("Failed to load transactions:", err);
    } finally {
      setTxLoading(false);
    }
  }, [filterType, searchQuery]);

  useEffect(() => {
    async function init() {
      setLoading(true);
      await Promise.all([fetchWallet(), fetchTransactions()]);
      setLoading(false);
    }
    init();
  }, [fetchWallet, fetchTransactions]);

  // Handle Top-Up Submission via Razorpay
  const handleTopUpSubmit = async (e) => {
    e.preventDefault();
    if (topUpSubmitting) return;

    setTopUpError("");
    const validationErr = validateAmount(topUpAmount);
    if (validationErr) {
      setTopUpError(validationErr);
      return;
    }

    const amt = Number(topUpAmount);
    setTopUpSubmitting(true);
    setTopUpLoadingText("Creating secure Razorpay order…");

    try {
      const isLoaded = await loadRazorpayScript();
      if (!isLoaded || !window.Razorpay) {
        throw new Error("Unable to load Razorpay checkout SDK. Please verify your internet connection.");
      }

      // 1. Separate wallet top-up order creation
      const orderRes = await api.post("/wallet/topup/create-order/", {
        amount: amt,
      });

      const orderData = orderRes.data;
      const orderId = orderData.order_id;

      setTopUpLoadingText("Opening Razorpay checkout…");

      // 2. Configure Razorpay checkout options
      const options = {
        key: orderData.key_id,
        amount: orderData.amount_in_paise,
        currency: orderData.currency || "INR",
        name: "BookMySalon",
        description: `Wallet Top-Up (₹${amt.toLocaleString("en-IN")})`,
        order_id: orderId,
        prefill: {
          name: orderData.customer?.name || "",
          email: orderData.customer?.email || "",
          contact: orderData.customer?.phone || "",
        },
        theme: {
          color: "#0f766e",
        },
        handler: async function (response) {
          setTopUpLoadingText("Verifying payment with bank…");
          try {
            // 3. Cryptographic signature and payment verification on backend
            const verifyRes = await api.post("/wallet/topup/verify-payment/", {
              razorpay_order_id: response.razorpay_order_id || orderId,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });

            // 4. Success: close modal, show success alert and update wallet
            setShowTopUpModal(false);
            setSuccessMessage(verifyRes.data?.message || `₹${amt.toLocaleString("en-IN")} credited to your wallet successfully!`);
            setTimeout(() => setSuccessMessage(""), 6000);

            // Re-fetch updated balance & transaction history
            fetchWallet();
            fetchTransactions();
          } catch (verifyErr) {
            const failMsg =
              verifyErr.response?.data?.message ||
              verifyErr.response?.data?.error ||
              "Money not credited. Payment verification failed.";
            setTopUpError(failMsg);
          } finally {
            setTopUpSubmitting(false);
            setTopUpLoadingText("");
          }
        },
        modal: {
          ondismiss: async function () {
            setTopUpSubmitting(false);
            setTopUpLoadingText("");
            try {
              await api.post("/wallet/topup/payment-failed/", {
                razorpay_order_id: orderId,
                reason: "Payment window was closed or cancelled by customer",
                error_code: "CUSTOMER_CANCELLED",
              });
            } catch (err) {
              console.warn("Could not record topup cancellation:", err);
            }
            setTopUpError("Money not credited. Payment cancelled.");
          },
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.on("payment.failed", async function (response) {
        setTopUpSubmitting(false);
        setTopUpLoadingText("");
        const failReason = response.error?.description || "Transaction declined by bank/gateway";
        try {
          await api.post("/wallet/topup/payment-failed/", {
            razorpay_order_id: orderId,
            reason: failReason,
            error_code: response.error?.code || "",
          });
        } catch (err) {
          console.warn("Could not record topup failure:", err);
        }
        setTopUpError(`Money not credited. Payment failed: ${failReason}`);
      });

      rzp.open();
    } catch (err) {
      const msg = err.response?.data?.error || err.response?.data?.detail || err.message || "Failed to initiate top-up payment. Please try again.";
      setTopUpError(msg);
      setTopUpSubmitting(false);
      setTopUpLoadingText("");
    }
  };

  const copyToClipboard = (txId) => {
    navigator.clipboard.writeText(txId);
    setCopiedTxId(txId);
    setTimeout(() => setCopiedTxId(""), 2500);
  };

  // Helper formatting
  const formatINR = (val) => {
    const num = Number(val || 0);
    return num.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "-";
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Calculate statistics from loaded transactions
  const totalSpent = transactions
    .filter((t) => t.transaction_type === "BOOKING_PAYMENT" || t.transaction_type === "DEBIT")
    .reduce((sum, t) => sum + Number(t.amount || 0), 0);

  const totalRefunds = transactions
    .filter((t) => t.transaction_type === "REFUND")
    .reduce((sum, t) => sum + Number(t.amount || 0), 0);

  return (
    <div className="c-wallet-page">
      <CustomerHeader />

      <main className="c-wallet-container">
        {/* Header Title & Badges */}
        <div className="c-wallet-header">
          <div className="c-wallet-header-info">
            <h1>
              <span>👛</span> My Salon Wallet
            </h1>
            <p>Your unified balance for quick 1-click booking payments and instant cancellation refunds.</p>
          </div>
          <div>
            <span className="c-wallet-badge-active">
              <span className="c-wallet-badge-dot" />
              Verified Customer Account
            </span>
          </div>
        </div>

        {/* Success Alert Banner */}
        {successMessage && (
          <div
            style={{
              padding: "14px 20px",
              background: "#ecfdf5",
              color: "#065f46",
              borderRadius: "12px",
              border: "1px solid #a7f3d0",
              fontWeight: 600,
              marginBottom: "24px",
              display: "flex",
              alignItems: "center",
              gap: "10px",
            }}
          >
            <span>✓</span> {successMessage}
          </div>
        )}

        {/* Error Alert Banner */}
        {error && (
          <div
            style={{
              padding: "14px 20px",
              background: "#fef2f2",
              color: "#991b1b",
              borderRadius: "12px",
              border: "1px solid #fecaca",
              fontWeight: 600,
              marginBottom: "24px",
            }}
          >
            {error}
          </div>
        )}

        {/* Hero Grid: Main Balance Card + Quick Stats */}
        <div className="c-wallet-hero-grid">
          {/* Main Balance Card */}
          <div className="c-wallet-card">
            <div>
              <div className="c-wallet-card-chip">
                <div className="c-wallet-brand">
                  <span>🌿</span>
                  <span>BookMySalon Wellness Pass</span>
                </div>
                <span
                  style={{
                    background: "rgba(255, 255, 255, 0.2)",
                    padding: "4px 10px",
                    borderRadius: "20px",
                    fontSize: "0.76rem",
                    fontWeight: 700,
                    letterSpacing: "0.04em",
                  }}
                >
                  INR • INDIA
                </span>
              </div>

              <div className="c-wallet-label">Available Balance</div>
              <div className="c-wallet-balance-row">
                <span className="c-wallet-currency">₹</span>
                <span className="c-wallet-balance-num">
                  {loading ? "..." : formatINR(wallet?.balance)}
                </span>
              </div>
            </div>

            <div className="c-wallet-actions">
              <button
                type="button"
                className="c-wallet-btn c-wallet-btn--topup"
                onClick={() => {
                  setTopUpError("");
                  setShowTopUpModal(true);
                }}
              >
                <span>+</span> Add Money / Top Up
              </button>

              <Link to="/customer/salons" className="c-wallet-btn c-wallet-btn--explore">
                <span>🔍</span> Book Salon Service
              </Link>
            </div>
          </div>

          {/* Quick Stats Column */}
          <div className="c-wallet-stats-card">
            <div className="c-wallet-stats-title">
              <span>📊</span>
              <span>Wallet Activity Overview</span>
            </div>

            <div className="c-wallet-stats-list">
              <div className="c-wallet-stat-item">
                <span className="c-wallet-stat-label">Total Spent</span>
                <span className="c-wallet-stat-value">₹{formatINR(totalSpent)}</span>
              </div>

              <div className="c-wallet-stat-item">
                <span className="c-wallet-stat-label">Refunds Credited</span>
                <span className="c-wallet-stat-value c-wallet-stat-value--green">
                  ₹{formatINR(totalRefunds)}
                </span>
              </div>

              <div className="c-wallet-stat-item">
                <span className="c-wallet-stat-label">Total Transactions</span>
                <span className="c-wallet-stat-value">{transactions.length}</span>
              </div>

              <div className="c-wallet-stat-item">
                <span className="c-wallet-stat-label">Status</span>
                <span className="c-wallet-stat-value" style={{ color: "#0d9488", fontSize: "1rem" }}>
                  Active & Protected
                </span>
              </div>
            </div>

            <div className="c-wallet-security-banner">
              <span>🔒</span>
              <span>Encrypted atomic transactions with instant refund protection.</span>
            </div>
          </div>
        </div>

        {/* Transaction History Section */}
        <section className="c-wallet-tx-section">
          <div className="c-wallet-tx-header">
            <h2 className="c-wallet-tx-title">Transaction History</h2>

            <div className="c-wallet-filters-bar">
              {/* Filter Tabs */}
              <div className="c-wallet-tab-group">
                {[
                  { key: "ALL", label: "All" },
                  { key: "BOOKING_PAYMENT", label: "Bookings" },
                  { key: "REFUND", label: "Refunds" },
                  { key: "CREDIT", label: "Top-Ups" },
                ].map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    className={`c-wallet-tab-btn ${filterType === tab.key ? "c-wallet-tab-btn--active" : ""}`}
                    onClick={() => setFilterType(tab.key)}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Search Box */}
              <div className="c-wallet-search-box">
                <span className="c-wallet-search-icon">🔍</span>
                <input
                  type="text"
                  placeholder="Search Tx ID, salon..."
                  className="c-wallet-search-input"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Transactions Table / Rows */}
          {txLoading ? (
            <div style={{ textAlign: "center", padding: "40px", color: "#64748b" }}>
              Loading transactions…
            </div>
          ) : transactions.length === 0 ? (
            <div className="c-wallet-empty">
              <div className="c-wallet-empty-icon">🌱</div>
              <h3>No Transactions Found</h3>
              <p>Your wallet operations, booking payments, and cancellation refunds will appear here.</p>
              <button
                type="button"
                className="c-wallet-btn c-wallet-btn--topup"
                style={{ background: "#0f766e", color: "#ffffff" }}
                onClick={() => setShowTopUpModal(true)}
              >
                Add First Deposit
              </button>
            </div>
          ) : (
            <div className="c-wallet-table-wrap">
              <table className="c-wallet-table">
                <thead>
                  <tr>
                    <th>Transaction ID</th>
                    <th>Type</th>
                    <th>Details & Booking</th>
                    <th>Date</th>
                    <th style={{ textAlign: "right" }}>Amount & Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((tx) => {
                    const isCredit = tx.transaction_type === "CREDIT" || tx.transaction_type === "REFUND";
                    return (
                      <tr key={tx.id} className="c-wallet-row">
                        {/* Transaction ID */}
                        <td className="c-wallet-td">
                          <span
                            className="c-wallet-tx-id-badge"
                            onClick={() => copyToClipboard(tx.transaction_id)}
                            title="Click to copy Transaction ID"
                          >
                            {tx.transaction_id}
                          </span>
                          {copiedTxId === tx.transaction_id && (
                            <span style={{ fontSize: "0.7rem", color: "#059669", marginLeft: "6px" }}>
                              Copied!
                            </span>
                          )}
                        </td>

                        {/* Transaction Type */}
                        <td className="c-wallet-td">
                          <span className={`c-wallet-badge-type c-wallet-badge-type--${tx.transaction_type}`}>
                            {tx.transaction_type === "CREDIT" && "📥 TOP UP"}
                            {tx.transaction_type === "REFUND" && "↩ REFUND"}
                            {tx.transaction_type === "BOOKING_PAYMENT" && "💳 BOOKING"}
                            {tx.transaction_type === "DEBIT" && "📤 DEBIT"}
                          </span>
                        </td>

                        {/* Details */}
                        <td className="c-wallet-td">
                          <div className="c-wallet-tx-meta">
                            <span className="c-wallet-tx-reason" title={tx.reason}>
                              {tx.reason || "Wallet Operation"}
                            </span>
                            {tx.booking_details && (
                              <span style={{ fontSize: "0.75rem", color: "#0f766e", fontWeight: 600 }}>
                                Booking #{tx.booking_details.id} • {tx.booking_details.service_name} at{" "}
                                {tx.booking_details.salon_name}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Date */}
                        <td className="c-wallet-td">
                          <span className="c-wallet-tx-date">{formatDate(tx.created_at)}</span>
                        </td>

                        {/* Amount & Balance Flow */}
                        <td className="c-wallet-td">
                          <div
                            className={`c-wallet-amount-val ${
                              isCredit ? "c-wallet-amount-val--credit" : "c-wallet-amount-val--debit"
                            }`}
                          >
                            {isCredit ? "+" : "-"}₹{formatINR(tx.amount)}
                          </div>
                          <div className="c-wallet-balance-flow">
                            ₹{formatINR(tx.balance_before)} → ₹{formatINR(tx.balance_after)}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Top-Up Modal */}
        {showTopUpModal && (
          <div className="c-wallet-modal-backdrop" onClick={() => setShowTopUpModal(false)}>
            <div className="c-wallet-modal" onClick={(e) => e.stopPropagation()}>
              <div className="c-wallet-modal-header">
                <h3>Add Funds to Wallet</h3>
                <button
                  type="button"
                  className="c-wallet-modal-close"
                  onClick={() => setShowTopUpModal(false)}
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleTopUpSubmit}>
                <div className="c-wallet-modal-body">
                  {topUpError && (
                    <div
                      style={{
                        padding: "10px 14px",
                        background: "#fef2f2",
                        color: "#991b1b",
                        borderRadius: "8px",
                        marginBottom: "16px",
                        fontSize: "0.85rem",
                      }}
                    >
                      {topUpError}
                    </div>
                  )}

                  {/* Preset Amount Chips */}
                  <label
                    style={{
                      display: "block",
                      fontSize: "0.82rem",
                      fontWeight: 700,
                      color: "#475569",
                      marginBottom: "8px",
                      textTransform: "uppercase",
                    }}
                  >
                    Quick Select
                  </label>
                  <div className="c-wallet-preset-chips">
                    {presetAmounts.map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        className={`c-wallet-preset-chip ${
                          Number(topUpAmount) === amt ? "c-wallet-preset-chip--selected" : ""
                        }`}
                        onClick={() => setTopUpAmount(amt)}
                      >
                        +₹{amt.toLocaleString("en-IN")}
                      </button>
                    ))}
                  </div>

                  {/* Custom Amount Input */}
                  <div className="c-wallet-input-group">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "6px" }}>
                      <label style={{ margin: 0 }}>Enter Amount (INR)</label>
                      <span style={{ fontSize: "0.74rem", color: "#64748b", fontWeight: 600 }}>
                        Max limit: ₹{MAX_TOPUP_AMOUNT.toLocaleString("en-IN")}
                      </span>
                    </div>

                    <div className="c-wallet-amount-input-wrap">
                      <span className="c-wallet-input-prefix">₹</span>
                      <input
                        type="number"
                        min="1"
                        max="10000"
                        step="any"
                        className="c-wallet-amount-input"
                        value={topUpAmount}
                        onChange={(e) => setTopUpAmount(e.target.value)}
                        placeholder="1000"
                        disabled={topUpSubmitting}
                        required
                      />
                    </div>

                    {/* Dynamic Limit & Validation Hints */}
                    <div style={{ marginTop: "6px", display: "flex", justifyContent: "space-between", fontSize: "0.74rem" }}>
                      <span style={{ color: Number(topUpAmount) > MAX_TOPUP_AMOUNT ? "#dc2626" : "#64748b", fontWeight: Number(topUpAmount) > MAX_TOPUP_AMOUNT ? 700 : 500 }}>
                        {Number(topUpAmount) > MAX_TOPUP_AMOUNT
                          ? `⚠️ Amount exceeds limit of ₹${MAX_TOPUP_AMOUNT.toLocaleString("en-IN")}`
                          : "Min ₹1.00 • Max ₹10,000.00 per transaction"}
                      </span>
                      {Number(topUpAmount) <= 0 && topUpAmount !== "" && (
                        <span style={{ color: "#dc2626", fontWeight: 600 }}>Must be greater than ₹0</span>
                      )}
                    </div>
                  </div>

                  {/* Optional Notes */}
                  <div className="c-wallet-input-group">
                    <label>Notes (Optional)</label>
                    <input
                      type="text"
                      className="c-wallet-search-input"
                      style={{ paddingLeft: "12px" }}
                      placeholder="e.g. For upcoming salon appointments"
                      value={topUpNotes}
                      onChange={(e) => setTopUpNotes(e.target.value)}
                    />
                  </div>

                  {/* Payment Methods Notice */}
                  <div
                    style={{
                      padding: "12px",
                      background: "#f8fafc",
                      borderRadius: "10px",
                      border: "1px solid #e2e8f0",
                      fontSize: "0.82rem",
                      color: "#64748b",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                    }}
                  >
                    <span>💳</span>
                    <span>Supports UPI, Cards, and Net Banking with instant wallet credit.</span>
                  </div>
                </div>

                <div className="c-wallet-modal-footer">
                  <button
                    type="button"
                    className="c-wallet-btn"
                    style={{ background: "#f1f5f9", color: "#475569" }}
                    onClick={() => setShowTopUpModal(false)}
                    disabled={topUpSubmitting}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="c-wallet-btn"
                    style={{
                      background: topUpSubmitting || Boolean(validateAmount(topUpAmount)) ? "#94a3b8" : "#0f766e",
                      color: "#ffffff",
                      cursor: topUpSubmitting || Boolean(validateAmount(topUpAmount)) ? "not-allowed" : "pointer",
                      minWidth: "160px",
                    }}
                    disabled={topUpSubmitting || Boolean(validateAmount(topUpAmount))}
                  >
                    {topUpSubmitting
                      ? (topUpLoadingText || "Processing…")
                      : `Proceed to Pay ₹${Number(topUpAmount || 0).toLocaleString("en-IN")}`}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
