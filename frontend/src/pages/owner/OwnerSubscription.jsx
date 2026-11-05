import { useState, useEffect, useCallback } from "react";
import api from "../../api/axios";
import OwnerNavbar from "../../components/owner/OwnerNavbar";
import OwnerNavbarHeader from "../../components/owner/OwnerNavbarHeader";
import NotificationBell from "../../components/common/NotificationBell";
import { useAuth } from "../../hooks/useAuth";
import "../../styles/ownerSubscription.css";

// Helper to dynamically load Razorpay script
const loadRazorpayScript = () => {
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
};

export default function OwnerSubscription() {
  const { user } = useAuth();

  const [subscription, setSubscription] = useState(null);
  const [plans, setPlans] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);

  // Checkout state
  const [processingPlanId, setProcessingPlanId] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);

  // Success celebration modal
  const [successModalData, setSuccessModalData] = useState(null);

  // View receipt modal
  const [activeReceipt, setActiveReceipt] = useState(null);

  const showToast = (text, type = "success") => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3800);
  };

  // 1. Fetch Current Subscription
  const fetchSubscription = useCallback(async () => {
    try {
      const res = await api.get("/subscriptions/owner/current/");
      setSubscription(res.data);
    } catch (err) {
      console.error("Error fetching current subscription:", err);
    }
  }, []);

  // 2. Fetch Available Plans
  const fetchPlans = useCallback(async () => {
    try {
      const res = await api.get("/subscriptions/owner/plans/");
      setPlans(res.data || []);
    } catch (err) {
      console.error("Error fetching available plans:", err);
    }
  }, []);

  // 3. Fetch Billing & Invoices
  const fetchHistory = useCallback(async () => {
    try {
      const res = await api.get("/subscriptions/owner/history/");
      setInvoices(res.data?.invoices || []);
    } catch (err) {
      console.error("Error fetching invoices:", err);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await Promise.all([fetchSubscription(), fetchPlans(), fetchHistory()]);
      setLoading(false);
    };
    init();
  }, [fetchSubscription, fetchPlans, fetchHistory]);

  // Initiate Razorpay Subscription Payment
  const handleSubscribe = async (plan) => {
    setProcessingPlanId(plan.id);

    try {
      // 1. Ensure Razorpay SDK is loaded
      const isLoaded = await loadRazorpayScript();
      if (!isLoaded) {
        showToast("Razorpay SDK failed to load. Please check your internet connection.", "error");
        setProcessingPlanId(null);
        return;
      }

      // 2. Create order on backend
      const orderRes = await api.post("/subscriptions/owner/create-order/", {
        plan_id: plan.id,
      });
      const orderData = orderRes.data;

      // 3. Configure Razorpay modal
      const options = {
        key: orderData.key_id,
        amount: orderData.amount_paise,
        currency: orderData.currency || "INR",
        name: "BookMySalon Partner Network",
        description: `Subscription: ${plan.name} (${plan.duration_months} Months)`,
        order_id: orderData.order_id,
        handler: async (response) => {
          try {
            // 4. Verify payment on backend
            const verifyRes = await api.post("/subscriptions/owner/verify-payment/", {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });

            // 5. Update state and show success modal
            setSubscription(verifyRes.data?.subscription);
            setSuccessModalData({
              planName: plan.name,
              amount: plan.price,
              receipt: verifyRes.data?.payment?.receipt_number,
              endDate: verifyRes.data?.subscription?.end_date,
            });

            fetchSubscription();
            fetchHistory();
          } catch (verifyErr) {
            showToast(verifyErr.response?.data?.error || "Payment signature verification failed.", "error");
          } finally {
            setProcessingPlanId(null);
          }
        },
        prefill: {
          name: user?.name || subscription?.salon_name || "",
          email: user?.email || "",
        },
        theme: {
          color: "#234d34",
        },
        modal: {
          ondismiss: () => {
            setProcessingPlanId(null);
          },
        },
      };

      const razorpayInstance = new window.Razorpay(options);
      razorpayInstance.on("payment.failed", (err) => {
        showToast(err.error?.description || "Payment failed or was cancelled.", "error");
        setProcessingPlanId(null);
      });
      razorpayInstance.open();
    } catch (err) {
      showToast(err.response?.data?.error || "Could not initiate payment order.", "error");
      setProcessingPlanId(null);
    }
  };

  // Determine status classification
  const isExpired = subscription && !subscription.is_currently_active;
  const isExpiringSoon = subscription && subscription.is_expiring_soon;
  const isTrial = subscription && subscription.subscription_type === "TRIAL";
  const daysLeft = subscription ? subscription.days_remaining : 0;

  let statusCardClass = "active";
  if (isExpired) statusCardClass = "expired";
  else if (isExpiringSoon) statusCardClass = "expiring";
  else if (isTrial) statusCardClass = "trial";

  return (
    <div className="owner-subs-page" style={{ flexDirection: "column" }}>
      <OwnerNavbarHeader salonInfo={{ name: subscription?.salon_name || "Salon" }} />
      <OwnerNavbar activeTab="Subscription" />

      <main className="owner-subs-main">
        {/* Header */}
        <div className="owner-subs-header">
          <h1>Subscription & Billing</h1>
          <p>Manage your salon partnership plan, access invoices, and enjoy zero booking commissions.</p>
        </div>

        {/* Current Status Hero Banner */}
        {subscription && (
          <div className={`owner-subs-status-card ${statusCardClass}`}>
            <div className="owner-subs-status-left">
              <span className="owner-subs-status-badge">
                {isExpired
                  ? "🚫 Subscription Expired"
                  : isExpiringSoon
                  ? "⏳ Expiring Soon"
                  : isTrial
                  ? "🎁 30-Day Free Trial Active"
                  : "✨ Paid Active Partner"}
              </span>

              <h2 className="owner-subs-status-title">
                {isExpired
                  ? "New Customer Bookings are Currently Restricted"
                  : isTrial
                  ? `Free Trial Active for ${subscription.salon_name}`
                  : `${subscription.plan?.name || "Active Plan"} – Full Platform Privileges`}
              </h2>

              <p className="owner-subs-status-desc">
                {isExpired
                  ? "Your subscription period has ended. Select a plan below to immediately restore client bookings and showcase your salon on BookMySalon explore."
                  : isExpiringSoon
                  ? `Your subscription concludes in ${daysLeft} days. Renew now to avoid any disruption to customer appointment bookings.`
                  : "Enjoy 100% zero booking commissions, unlimited specialist scheduling, and direct customer reviews."}
              </p>

              <div className="owner-subs-status-dates">
                <span>
                  Start Date:{" "}
                  <strong>
                    {new Date(subscription.start_date).toLocaleDateString("en-IN", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </strong>
                </span>
                <span>
                  Expiration Date:{" "}
                  <strong>
                    {new Date(subscription.end_date).toLocaleDateString("en-IN", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </strong>
                </span>
              </div>
            </div>

            <div className="owner-subs-countdown-box">
              <div
                className="owner-subs-countdown-num"
                style={{
                  color: isExpired ? "#b91c1c" : isExpiringSoon ? "#b45309" : statusCardClass === "active" ? "#ffffff" : "#1e693b",
                }}
              >
                {isExpired ? "0" : daysLeft}
              </div>
              <div className="owner-subs-countdown-label">
                {isExpired ? "Days Remaining" : daysLeft === 1 ? "Day Remaining" : "Days Remaining"}
              </div>
            </div>
          </div>
        )}

        {/* Early Renewal Callout */}
        {!isExpired && subscription?.is_currently_active && (
          <div className="owner-early-renewal-tip">
            <span>💡</span>
            <span>
              <strong>Early Renewal Benefit:</strong> Purchasing a plan before your current period expires will automatically append the full plan duration to your existing expiry date ({new Date(subscription.end_date).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" })}). You will not lose any remaining days!
            </span>
          </div>
        )}

        {/* Available Plans Section */}
        <div className="owner-plans-section">
          <div className="owner-plans-header">
            <h2>{isExpired ? "Select a Plan to Reactivate Bookings" : "Choose or Extend Your Plan"}</h2>
            <p>100% subscription-based revenue model. Keep 100% of all customer service earnings with zero platform cuts.</p>
          </div>

          <div className="owner-plans-grid">
            {plans.map((p) => {
              const isPopular = p.badge_text || p.duration_months === 6;
              const isProcessing = processingPlanId === p.id;

              return (
                <div key={p.id} className={`owner-plan-card ${isPopular ? "featured" : ""}`}>
                  {p.badge_text && <div className="owner-plan-badge">{p.badge_text}</div>}

                  <h3 className="owner-plan-title">{p.name}</h3>
                  <div className="owner-plan-duration">Billing Duration: {p.duration_months} Month(s)</div>

                  <div className="owner-plan-pricing">
                    <span className="owner-plan-price-curr">₹</span>
                    <span className="owner-plan-price-val">{Number(p.price).toLocaleString("en-IN")}</span>
                    {p.original_price && (
                      <span className="owner-plan-price-orig">₹{Number(p.original_price).toLocaleString("en-IN")}</span>
                    )}
                    <span className="owner-plan-price-cycle">/ {p.duration_months === 1 ? "month" : `${p.duration_months} mos`}</span>
                  </div>

                  <ul className="owner-plan-features">
                    {(p.features || [
                      "Full access to online appointment schedule",
                      "0% platform booking commission",
                      "Unlimited specialist workers & service menu",
                      "Customer reviews & ratings management",
                      "Automated client appointment reminders",
                      "Verified Salon Badge on explore",
                    ]).map((feat, idx) => (
                      <li key={idx}>{feat}</li>
                    ))}
                  </ul>

                  <button
                    type="button"
                    className="owner-plan-cta-btn"
                    disabled={isProcessing}
                    onClick={() => handleSubscribe(p)}
                  >
                    {isProcessing ? "Opening Gateway..." : isExpired ? `Activate for ₹${Number(p.price).toLocaleString("en-IN")}` : `Renew / Extend for ₹${Number(p.price).toLocaleString("en-IN")}`}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Invoices & History Section */}
        <div className="owner-history-section">
          <div className="owner-history-header">
            <h3>Billing History & Receipts</h3>
            <p>Review past subscription payments and download official tax receipts.</p>
          </div>

          {invoices.length === 0 ? (
            <div style={{ textAlign: "center", padding: "36px 0", color: "#658270", fontSize: "14px" }}>
              No paid subscription invoices yet. Your free trial is complimentary.
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="owner-history-table">
                <thead>
                  <tr>
                    <th>Invoice #</th>
                    <th>Date</th>
                    <th>Plan</th>
                    <th>Amount Paid</th>
                    <th>Payment Method</th>
                    <th>Status</th>
                    <th style={{ textAlign: "right" }}>Receipt</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => (
                    <tr key={inv.id}>
                      <td>
                        <span className="owner-history-receipt-code">{inv.receipt_number}</span>
                      </td>
                      <td>
                        {new Date(inv.created_at).toLocaleDateString("en-IN", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </td>
                      <td><strong>{inv.plan_name}</strong> ({inv.plan_duration_months} mo)</td>
                      <td>
                        <strong style={{ color: "#184d28" }}>₹{Number(inv.amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</strong>
                      </td>
                      <td>Razorpay ({inv.razorpay_payment_id || "Online"})</td>
                      <td>
                        <span style={{ color: "#137333", fontWeight: 700, fontSize: "12px" }}>
                          ✓ SUCCESS
                        </span>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <button
                          type="button"
                          className="owner-history-print-btn"
                          onClick={() => setActiveReceipt(inv)}
                        >
                          📄 View Receipt
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Celebration Success Modal */}
      {successModalData && (
        <div className="admin-modal-overlay">
          <div className="owner-receipt-modal" style={{ textAlign: "center" }}>
            <div style={{ fontSize: "48px", marginBottom: "12px" }}>🎉</div>
            <h2 style={{ fontSize: "22px", color: "#163622", margin: "0 0 8px 0" }}>Subscription Activated!</h2>
            <p style={{ color: "#557260", fontSize: "14px", margin: "0 0 20px 0" }}>
              Thank you! Your payment of <strong>₹{Number(successModalData.amount).toLocaleString("en-IN")}</strong> has been received and verified.
            </p>

            <div style={{ background: "#f7faf8", border: "1px dashed #234d34", borderRadius: "10px", padding: "16px", marginBottom: "20px", textAlign: "left" }}>
              <div className="owner-receipt-row"><span className="label">Plan:</span> <span className="val">{successModalData.planName}</span></div>
              <div className="owner-receipt-row"><span className="label">Receipt Number:</span> <span className="val">{successModalData.receipt}</span></div>
              <div className="owner-receipt-row" style={{ marginBottom: 0 }}>
                <span className="label">Valid Until:</span>{" "}
                <span className="val" style={{ color: "#234d34" }}>
                  {new Date(successModalData.endDate).toLocaleDateString("en-IN", { month: "long", day: "numeric", year: "numeric" })}
                </span>
              </div>
            </div>

            <button
              type="button"
              className="admin-btn-primary"
              style={{ width: "100%", padding: "12px" }}
              onClick={() => setSuccessModalData(null)}
            >
              Continue to Salon Dashboard
            </button>
          </div>
        </div>
      )}

      {/* Invoice / Receipt Modal */}
      {activeReceipt && (
        <div className="admin-modal-overlay">
          <div className="owner-receipt-modal">
            <div className="owner-receipt-brand">
              <h2>BookMySalon Partner Network</h2>
              <p>Official Subscription Payment Invoice</p>
            </div>

            <div className="owner-receipt-row">
              <span className="label">Invoice Receipt:</span>
              <span className="val">{activeReceipt.receipt_number}</span>
            </div>
            <div className="owner-receipt-row">
              <span className="label">Date:</span>
              <span className="val">
                {new Date(activeReceipt.created_at).toLocaleDateString("en-IN", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
            </div>
            <div className="owner-receipt-row">
              <span className="label">Salon:</span>
              <span className="val">{activeReceipt.salon_name}</span>
            </div>
            <div className="owner-receipt-row">
              <span className="label">Plan Subscribed:</span>
              <span className="val">{activeReceipt.plan_name} ({activeReceipt.plan_duration_months} Months)</span>
            </div>
            <div className="owner-receipt-row">
              <span className="label">Payment Gateway:</span>
              <span className="val">Razorpay</span>
            </div>
            <div className="owner-receipt-row">
              <span className="label">Payment ID:</span>
              <span className="val" style={{ fontFamily: "monospace" }}>{activeReceipt.razorpay_payment_id || "Direct Verified"}</span>
            </div>

            <div className="owner-receipt-total">
              <span>Total Paid:</span>
              <span>₹{Number(activeReceipt.amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })} INR</span>
            </div>

            <div style={{ textAlign: "center", fontSize: "12px", color: "#627c6c", marginBottom: "20px" }}>
              ✓ 0% Platform Booking Commission Applied
            </div>

            <div style={{ display: "flex", gap: "10px" }}>
              <button
                type="button"
                className="admin-btn-secondary"
                style={{ flex: 1 }}
                onClick={() => setActiveReceipt(null)}
              >
                Close
              </button>
              <button
                type="button"
                className="admin-btn-primary"
                style={{ flex: 1 }}
                onClick={() => window.print()}
              >
                🖨️ Print Receipt
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification Banner */}
      {toastMessage && (
        <div className="admin-toast-banner" style={{ background: toastMessage.type === "error" ? "#b91c1c" : "#183e26" }}>
          <span>{toastMessage.type === "error" ? "⚠️" : "🔔"}</span>
          <span>{toastMessage.text}</span>
        </div>
      )}
    </div>
  );
}
