import { useState, useEffect } from "react";
import api from "../../api/axios";
import "../../styles/receipt.css";

export default function ServiceReceiptModal({ isOpen, bookingId, onClose }) {
  const [receipt, setReceipt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (!isOpen || !bookingId) {
      setReceipt(null);
      setError("");
      return;
    }

    let isMounted = true;
    async function fetchReceipt() {
      setLoading(true);
      setError("");
      try {
        const response = await api.get(`/bookings/${bookingId}/receipt/`);
        if (isMounted) {
          setReceipt(response.data.receipt);
        }
      } catch (err) {
        if (isMounted) {
          const errMsg =
            err.response?.data?.error ||
            err.response?.data?.detail ||
            "Unable to generate receipt. The appointment must be completed and payment confirmed first.";
          setError(errMsg);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    fetchReceipt();
    return () => {
      isMounted = false;
    };
  }, [isOpen, bookingId]);

  if (!isOpen) return null;

  const handleDownloadPdf = async () => {
    if (!bookingId) return;
    setDownloading(true);
    try {
      const response = await api.get(`/bookings/${bookingId}/receipt/pdf/`, {
        responseType: "blob",
      });
      const blob = new Blob([response.data], { type: "application/pdf" });
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      const filename = receipt?.receipt_number
        ? `BookMySalon-Receipt-${receipt.receipt_number}.pdf`
        : `BookMySalon-Receipt-BMS-${bookingId}.pdf`;
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      console.error("Failed to download PDF receipt:", err);
      alert("Failed to download receipt PDF. Please try again.");
    } finally {
      setDownloading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const formatCurrency = (val) => {
    const num = Number(val || 0);
    return `₹${num.toLocaleString("en-IN")}`;
  };

  // Safe fallback financial calculations if backend historical record had 0 fields
  const servicesSnapshot = receipt?.services_snapshot || [];
  const servicesSum = servicesSnapshot.reduce((acc, s) => acc + Number(s.price || 0), 0);

  const rawSubtotal = Number(receipt?.pricing_details?.subtotal || 0);
  const subtotal = rawSubtotal > 0 ? rawSubtotal : (servicesSum > 0 ? servicesSum : Number(receipt?.pricing_details?.total_amount || 0));

  const discount = Number(receipt?.pricing_details?.discount_amount || 0);
  const tax = Number(receipt?.pricing_details?.tax_amount || 0);

  const rawTotal = Number(receipt?.pricing_details?.total_amount || 0);
  const totalAmount = rawTotal > 0 ? rawTotal : (subtotal - discount + tax > 0 ? subtotal - discount + tax : subtotal);

  const rawPaid = Number(receipt?.pricing_details?.amount_paid || 0);
  const amountPaid = rawPaid > 0 ? rawPaid : totalAmount;

  return (
    <div className="bms-receipt-backdrop" onClick={onClose}>
      <div className="bms-receipt-container" onClick={(e) => e.stopPropagation()}>
        {/* Top bar with quick actions */}
        <div className="bms-receipt-topbar">
          <div className="bms-receipt-topbar-title">
            <span>📄</span> Official Service Receipt
          </div>
          <div className="bms-receipt-topbar-actions">
            {receipt && (
              <>
                <button
                  type="button"
                  className="bms-btn-action bms-btn-action-primary"
                  onClick={handleDownloadPdf}
                  disabled={downloading}
                >
                  {downloading ? "Downloading…" : "⬇ Download PDF"}
                </button>
                <button
                  type="button"
                  className="bms-btn-action bms-btn-action-secondary"
                  onClick={handlePrint}
                >
                  🖨 Print
                </button>
              </>
            )}
            <button
              type="button"
              className="bms-btn-action bms-btn-action-close"
              onClick={onClose}
              title="Close Receipt"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="bms-receipt-body">
          {loading && (
            <div className="bms-receipt-loading">
              <div className="bms-receipt-spinner" />
              <p style={{ color: "#64748b", fontSize: "13px" }}>Loading verified receipt…</p>
            </div>
          )}

          {!loading && error && (
            <div className="bms-receipt-error">
              <div style={{ fontSize: "36px", marginBottom: "12px" }}>⚠️</div>
              <h3 style={{ fontSize: "16px", color: "#b91c1c", marginBottom: "8px" }}>
                Receipt Unavailable
              </h3>
              <p style={{ fontSize: "13px", color: "#64748b", maxWidth: "420px", margin: "0 auto 16px" }}>
                {error}
              </p>
              <button
                type="button"
                className="bms-btn-action bms-btn-action-secondary"
                onClick={onClose}
              >
                Close
              </button>
            </div>
          )}

          {!loading && !error && receipt && (
            <div className="bms-receipt-sheet">
              {/* Header: Brand & Invoice Meta */}
              <div className="bms-receipt-header">
                <div>
                  <div className="bms-receipt-brand">BookMySalon</div>
                  <div className="bms-receipt-brand-tag">Premium Salon &amp; Wellness Platform</div>
                </div>
                <div className="bms-receipt-title-block">
                  <div className="bms-receipt-doc-title">TAX INVOICE / RECEIPT</div>
                  <div className="bms-receipt-inv-num">#{receipt.receipt_number}</div>
                  <div className="bms-receipt-date">
                    Issued: {new Date(receipt.created_at).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </div>
                </div>
              </div>


              {/* Two Column Metadata */}
              <div className="bms-receipt-parties-grid">
                {/* Salon Info */}
                <div className="bms-party-col">
                  <h4>Issued By (Salon)</h4>
                  <div className="bms-party-name">{receipt.salon_details.name}</div>
                  <div className="bms-party-info">
                    {receipt.salon_details.address}
                    {receipt.salon_details.phone && <div>Phone: {receipt.salon_details.phone}</div>}
                    {receipt.salon_details.email && <div>Email: {receipt.salon_details.email}</div>}
                    {receipt.salon_details.gst_number && (
                      <div><strong>GSTIN:</strong> {receipt.salon_details.gst_number}</div>
                    )}
                  </div>
                </div>

                {/* Customer Info */}
                <div className="bms-party-col">
                  <h4>Billed To (Customer)</h4>
                  <div className="bms-party-name">{receipt.customer_details.name}</div>
                  <div className="bms-party-info">
                    <div><strong>Email:</strong> {receipt.customer_details.email || "On File"}</div>
                    {receipt.customer_details.phone && (
                      <div>Phone: {receipt.customer_details.phone}</div>
                    )}
                    <div style={{ marginTop: "4px" }}>
                      <strong>Appointment:</strong> {receipt.appointment_details.booking_date}
                      {receipt.appointment_details.booking_time && ` at ${receipt.appointment_details.booking_time}`}
                    </div>
                    {receipt.appointment_details.specialist_name && (
                      <div><strong>Specialist:</strong> {receipt.appointment_details.specialist_name}</div>
                    )}
                    {receipt.appointment_details.station && (
                      <div><strong>Station:</strong> {receipt.appointment_details.station}</div>
                    )}
                  </div>
                </div>
              </div>

              {/* Itemized Services Breakdown */}
              <div className="bms-receipt-table-wrapper">
                <table className="bms-receipt-table">
                  <thead>
                    <tr>
                      <th style={{ width: "30px" }}>#</th>
                      <th>Service Description</th>
                      <th style={{ width: "90px" }}>Duration</th>
                      <th style={{ width: "110px", textAlign: "right" }}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(receipt.services_snapshot || []).map((svc, idx) => (
                      <tr key={idx}>
                        <td>{idx + 1}</td>
                        <td>
                          <strong>{svc.name}</strong>
                        </td>
                        <td>{svc.duration || "—"}</td>
                        <td>{formatCurrency(svc.price)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Bottom Financial & Payment Summary */}
              <div className="bms-receipt-summary-grid">
                {/* Left: Payment Info */}
                <div className="bms-payment-info-box">
                  <h5>Payment Transaction</h5>
                  <div className="bms-pay-row">
                    <span>Method:</span>
                    <strong>{receipt.payment_details.payment_method}</strong>
                  </div>
                  <div className="bms-pay-row">
                    <span>Status:</span>
                    <strong style={{ color: "#166534" }}>{receipt.payment_details.payment_status}</strong>
                  </div>
                  <div className="bms-pay-row">
                    <span>Ref / Txn ID:</span>
                    <span style={{ fontFamily: "monospace", fontSize: "11px" }}>
                      {receipt.payment_details.transaction_id || `BMS-${receipt.booking_id}`}
                    </span>
                  </div>
                  {receipt.payment_details.paid_at && (
                    <div className="bms-pay-row">
                      <span>Paid On:</span>
                      <span>
                        {new Date(receipt.payment_details.paid_at).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  )}
                  {Number(receipt.pricing_details.advance_amount) > 0 && (
                    <div style={{ marginTop: "6px", paddingTop: "6px", borderTop: "1px dashed #cbd5e1" }}>
                      <div className="bms-pay-row">
                        <span>Advance Paid:</span>
                        <span>{formatCurrency(receipt.pricing_details.advance_amount)}</span>
                      </div>
                      <div className="bms-pay-row">
                        <span>Counter Settlement:</span>
                        <span>
                          {formatCurrency(
                            Number(receipt.pricing_details.remaining_amount) > 0
                              ? receipt.pricing_details.remaining_amount
                              : Math.max(0, totalAmount - Number(receipt.pricing_details.advance_amount))
                          )}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Right: Price Calculation */}
                <div className="bms-calc-box">
                  <div className="bms-calc-row">
                    <span>Services Subtotal:</span>
                    <span>{formatCurrency(subtotal)}</span>
                  </div>

                  {discount > 0 && (
                    <div className="bms-calc-row bms-discount-row">
                      <span>
                        Discount{" "}
                        {receipt.pricing_details.voucher_code
                          ? `(${receipt.pricing_details.voucher_code})`
                          : receipt.pricing_details.applied_offer_title
                          ? `(${receipt.pricing_details.applied_offer_title})`
                          : ""}:
                      </span>
                      <span>- {formatCurrency(discount)}</span>
                    </div>
                  )}

                  {tax > 0 && (
                    <div className="bms-calc-row">
                      <span>Taxes &amp; Hygiene Fee:</span>
                      <span>+ {formatCurrency(tax)}</span>
                    </div>
                  )}

                  <div className="bms-calc-divider" />

                  <div className="bms-calc-row" style={{ fontWeight: 600 }}>
                    <span>Total Payable:</span>
                    <span>{formatCurrency(totalAmount)}</span>
                  </div>

                  <div className="bms-calc-row bms-total-row">
                    <span>FINAL AMOUNT PAID:</span>
                    <span>{formatCurrency(amountPaid)}</span>
                  </div>
                </div>
              </div>
                  {/* Status Banner */}
              {receipt.audit_details?.is_refunded ? (
                <div className="bms-receipt-status-banner bms-status-refunded">
                  <span>↩</span>
                  <div>
                    <strong>STATUS: REFUNDED</strong> • Amount of{" "}
                    {formatCurrency(receipt.audit_details.refund_amount)} was refunded on{" "}
                    {receipt.audit_details.refund_date
                      ? new Date(receipt.audit_details.refund_date).toLocaleDateString("en-IN")
                      : "record"}
                    . Preserved for accounting audit.
                  </div>
                </div>
              ) : receipt.audit_details?.is_cancelled ? (
                <div className="bms-receipt-status-banner bms-status-cancelled">
                  <span>⚠️</span>
                  <div>
                    <strong>STATUS: CANCELLED</strong> • Appointment was cancelled. Bill preserved for accounting records.
                  </div>
                </div>
              ) : (
                <div className="bms-receipt-status-banner bms-status-paid">
                  <span>✓</span>
                  <div>
                    <strong>STATUS: PAID IN FULL</strong> • Service completed &amp; payment confirmed.
                  </div>
                </div>
              )}
              
              {/* Disclaimer */}
              <div className="bms-receipt-footer">
                This is a computer-generated receipt issued through BookMySalon and does not require a physical signature.
                <br />
                Thank you for choosing {receipt.salon_details.name}!
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

