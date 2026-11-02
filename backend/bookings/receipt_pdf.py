import io
import os
from decimal import Decimal
from django.utils import timezone
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    HRFlowable,
    KeepTogether,
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

# Attempt to register true-type unicode fonts with Rupee symbol support
FONT_REGULAR = "Helvetica"
FONT_BOLD = "Helvetica-Bold"

for p in [
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "/usr/share/fonts/dejavu/DejaVuSans.ttf",
]:
    if os.path.exists(p):
        try:
            pdfmetrics.registerFont(TTFont("DejaVuSans", p))
            FONT_REGULAR = "DejaVuSans"
            bold_p = p.replace("DejaVuSans.ttf", "DejaVuSans-Bold.ttf")
            if os.path.exists(bold_p):
                pdfmetrics.registerFont(TTFont("DejaVuSans-Bold", bold_p))
                FONT_BOLD = "DejaVuSans-Bold"
            else:
                FONT_BOLD = "DejaVuSans"
            break
        except Exception:
            pass


def _fmt_curr(val):
    """Format decimal/numeric amount as INR with Rs. / ₹ notation."""
    try:
        d = Decimal(str(val or "0.00"))
        if d == d.to_integral():
            return f"Rs. {int(d):,}"
        return f"Rs. {d:,.2f}"
    except Exception:
        return f"Rs. {val}"


def generate_receipt_pdf(receipt) -> bytes:
    
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        leftMargin=36,
        rightMargin=36,
        topMargin=36,
        bottomMargin=36,
    )

    base_styles = getSampleStyleSheet()

    # Custom styling
    brand_style = ParagraphStyle(
        "BrandHeader",
        parent=base_styles["Normal"],
        fontName=FONT_BOLD,
        fontSize=20,
        leading=24,
        textColor=colors.HexColor("#0f172a"),
    )
    brand_sub = ParagraphStyle(
        "BrandSub",
        parent=base_styles["Normal"],
        fontName=FONT_REGULAR,
        fontSize=8.5,
        leading=11,
        textColor=colors.HexColor("#64748b"),
    )
    title_style = ParagraphStyle(
        "DocTitle",
        parent=base_styles["Normal"],
        fontName=FONT_BOLD,
        fontSize=13,
        leading=16,
        alignment=2,  # Right align
        textColor=colors.HexColor("#0f766e"),
    )
    meta_right = ParagraphStyle(
        "MetaRight",
        parent=base_styles["Normal"],
        fontName=FONT_REGULAR,
        fontSize=8.5,
        leading=12,
        alignment=2,  # Right align
        textColor=colors.HexColor("#334155"),
    )
    section_heading = ParagraphStyle(
        "SectionHeading",
        parent=base_styles["Normal"],
        fontName=FONT_BOLD,
        fontSize=9.5,
        leading=13,
        textColor=colors.HexColor("#0f172a"),
    )
    body_text = ParagraphStyle(
        "ReceiptBody",
        parent=base_styles["Normal"],
        fontName=FONT_REGULAR,
        fontSize=8.5,
        leading=12,
        textColor=colors.HexColor("#334155"),
    )
    body_bold = ParagraphStyle(
        "ReceiptBodyBold",
        parent=base_styles["Normal"],
        fontName=FONT_BOLD,
        fontSize=8.5,
        leading=12,
        textColor=colors.HexColor("#0f172a"),
    )
    table_header_text = ParagraphStyle(
        "TableHeaderText",
        parent=base_styles["Normal"],
        fontName=FONT_BOLD,
        fontSize=8.5,
        leading=11,
        textColor=colors.white,
    )
    table_cell_text = ParagraphStyle(
        "TableCellText",
        parent=base_styles["Normal"],
        fontName=FONT_REGULAR,
        fontSize=8.5,
        leading=11,
        textColor=colors.HexColor("#1e293b"),
    )
    table_cell_right = ParagraphStyle(
        "TableCellRight",
        parent=base_styles["Normal"],
        fontName=FONT_REGULAR,
        fontSize=8.5,
        leading=11,
        alignment=2,
        textColor=colors.HexColor("#1e293b"),
    )
    summary_label = ParagraphStyle(
        "SummaryLabel",
        parent=base_styles["Normal"],
        fontName=FONT_REGULAR,
        fontSize=8.5,
        leading=12,
        alignment=2,
        textColor=colors.HexColor("#475569"),
    )
    summary_val = ParagraphStyle(
        "SummaryVal",
        parent=base_styles["Normal"],
        fontName=FONT_BOLD,
        fontSize=8.5,
        leading=12,
        alignment=2,
        textColor=colors.HexColor("#0f172a"),
    )
    footer_text = ParagraphStyle(
        "FooterText",
        parent=base_styles["Normal"],
        fontName=FONT_REGULAR,
        fontSize=7.5,
        leading=10,
        alignment=1,  # Center
        textColor=colors.HexColor("#94a3b8"),
    )

    elements = []

    # 1. Header Grid: Brand on Left, Invoice details on Right
    issued_date_str = receipt.created_at.strftime("%d %b %Y, %I:%M %p") if receipt.created_at else ""
    paid_date_str = receipt.paid_at.strftime("%d %b %Y, %I:%M %p") if receipt.paid_at else issued_date_str

    header_left = [
        Paragraph("<b>BOOKMYSALON</b>", brand_style),
        Paragraph("Premium Salon &amp; Wellness Platform", brand_sub),
        Paragraph("Official Service Tax Invoice", brand_sub),
    ]
    header_right = [
        Paragraph("TAX INVOICE / RECEIPT", title_style),
        Paragraph(f"<b>Invoice #:</b> {receipt.receipt_number}", meta_right),
        Paragraph(f"<b>Booking Ref:</b> BMS-{receipt.booking_id}", meta_right),
        Paragraph(f"<b>Date Issued:</b> {issued_date_str}", meta_right),
    ]

    header_table = Table([[header_left, header_right]], colWidths=[270, 270])
    header_table.setStyle(
        TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING", (0, 0), (-1, -1), 0),
            ("RIGHTPADDING", (0, 0), (-1, -1), 0),
            ("TOPPADDING", (0, 0), (-1, -1), 0),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ])
    )
    elements.append(header_table)

    elements.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor("#0f766e"), spaceBefore=8, spaceAfter=12))

    # 2. Status Badge / Alert
    if receipt.is_refunded:
        status_bg = colors.HexColor("#fef2f2")
        status_border = colors.HexColor("#ef4444")
        status_msg = f"<b>STATUS: REFUNDED</b> &nbsp;•&nbsp; Amount of {_fmt_curr(receipt.refund_amount)} was refunded on {receipt.refund_date.strftime('%d %b %Y') if receipt.refund_date else 'N/A'}. This bill is preserved for accounting records."
        status_text_color = colors.HexColor("#991b1b")
    elif receipt.is_cancelled:
        status_bg = colors.HexColor("#fffbeb")
        status_border = colors.HexColor("#f59e0b")
        status_msg = f"<b>STATUS: CANCELLED</b> &nbsp;•&nbsp; This booking was cancelled. Bill is archived for accounting records."
        status_text_color = colors.HexColor("#92400e")
    else:
        status_bg = colors.HexColor("#f0fdf4")
        status_border = colors.HexColor("#22c55e")
        status_msg = f"<b>STATUS: PAID IN FULL ✓</b> &nbsp;•&nbsp; Service completed &amp; payment confirmed on {paid_date_str}."
        status_text_color = colors.HexColor("#166534")

    badge_style = ParagraphStyle(
        "StatusBadge",
        parent=base_styles["Normal"],
        fontName=FONT_REGULAR,
        fontSize=8.5,
        leading=12,
        textColor=status_text_color,
    )
    badge_table = Table([[Paragraph(status_msg, badge_style)]], colWidths=[540])
    badge_table.setStyle(
        TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), status_bg),
            ("BOX", (0, 0), (-1, -1), 1, status_border),
            ("TOPPADDING", (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ("LEFTPADDING", (0, 0), (-1, -1), 10),
            ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ])
    )
    # elements.append(badge_table)
    # elements.append(Spacer(1, 12))

    # 3. Two-Column Metadata: Salon on Left, Customer & Appointment on Right
    salon_lines = [
        Paragraph("<b>ISSUED BY (SERVICE PROVIDER)</b>", section_heading),
        Paragraph(f"<b>{receipt.salon_name}</b>", body_bold),
        Paragraph(f"{receipt.salon_address or 'Address on file'}", body_text),
        Paragraph(f"Phone: {receipt.salon_phone or 'N/A'}", body_text),
        Paragraph(f"Email: {receipt.salon_email or 'N/A'}", body_text),
    ]
    if receipt.salon_gst_number:
        salon_lines.append(Paragraph(f"<b>GSTIN:</b> {receipt.salon_gst_number}", body_text))

    appt_time_fmt = f"{receipt.booking_date.strftime('%d %b %Y')}"
    if receipt.booking_time:
        appt_time_fmt += f" at {receipt.booking_time}"

    customer_lines = [
        Paragraph("<b>BILLED TO (CUSTOMER)</b>", section_heading),
        Paragraph(f"<b>{receipt.customer_name}</b>", body_bold),
        Paragraph(f"Email: {receipt.customer_email or 'N/A'}", body_text),
        Paragraph(f"Phone: {receipt.customer_phone or 'N/A'}", body_text),
        Paragraph(f"<b>Appointment Date:</b> {appt_time_fmt}", body_text),
    ]
    if receipt.specialist_name:
        customer_lines.append(Paragraph(f"<b>Stylist / Specialist:</b> {receipt.specialist_name}", body_text))
    if receipt.station:
        customer_lines.append(Paragraph(f"<b>Station:</b> {receipt.station}", body_text))

    parties_table = Table([[salon_lines, customer_lines]], colWidths=[265, 275])
    parties_table.setStyle(
        TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING", (0, 0), (-1, -1), 8),
            ("RIGHTPADDING", (0, 0), (-1, -1), 8),
            ("TOPPADDING", (0, 0), (-1, -1), 8),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
            ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
            ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
        ])
    )
    elements.append(parties_table)
    elements.append(Spacer(1, 14))

    # 4. Itemized Services Table
    services = receipt.services_snapshot or []
    if not services:
        services = [{"name": "Salon Service", "price": str(receipt.subtotal), "duration": receipt.duration or ""}]

    service_rows = [
        [
            Paragraph("<b>#</b>", table_header_text),
            Paragraph("<b>SERVICE DESCRIPTION</b>", table_header_text),
            Paragraph("<b>DURATION</b>", table_header_text),
            Paragraph("<b>AMOUNT (INR)</b>", ParagraphStyle("RightHdr", parent=table_header_text, alignment=2)),
        ]
    ]

    for idx, s in enumerate(services, 1):
        s_name = s.get("name", "Service")
        s_price = s.get("price", "0.00")
        s_dur = s.get("duration", "")
        service_rows.append([
            Paragraph(str(idx), table_cell_text),
            Paragraph(f"<b>{s_name}</b>", table_cell_text),
            Paragraph(s_dur or "—", table_cell_text),
            Paragraph(_fmt_curr(s_price), table_cell_right),
        ])

    service_table = Table(service_rows, colWidths=[30, 310, 90, 110])
    service_table.setStyle(
        TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0f172a")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("TOPPADDING", (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ("LEFTPADDING", (0, 0), (-1, -1), 8),
            ("RIGHTPADDING", (0, 0), (-1, -1), 8),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
        ])
    )
    elements.append(service_table)
    elements.append(Spacer(1, 10))

    # 5. Bottom Financial Summary and Payment Metadata
    # Left Box: Payment Details
    pay_lines = [
        Paragraph("<b>PAYMENT TRANSACTION SUMMARY</b>", section_heading),
        Paragraph(f"<b>Payment Method:</b> {receipt.payment_method}", body_text),
        Paragraph(f"<b>Payment Status:</b> {receipt.payment_status}", body_text),
        Paragraph(f"<b>Transaction / Ref ID:</b> {receipt.transaction_id or 'TXN-CONFIRMED'}", body_text),
        Paragraph(f"<b>Settled On:</b> {paid_date_str}", body_text),
    ]
    if receipt.advance_amount and receipt.advance_amount > Decimal("0.00"):
        pay_lines.append(Paragraph(f"• Advance Token: {_fmt_curr(receipt.advance_amount)}", body_text))
        pay_lines.append(Paragraph(f"• Counter Settlement: {_fmt_curr(receipt.remaining_amount)}", body_text))

    payment_info_table = Table([[pay_lines]], colWidths=[250])
    payment_info_table.setStyle(
        TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f1f5f9")),
            ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
            ("TOPPADDING", (0, 0), (-1, -1), 8),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
            ("LEFTPADDING", (0, 0), (-1, -1), 10),
            ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ])
    )

    # Right Box: Financial Breakdown
    services_sum = sum(
        (Decimal(str(s.get("price", "0.00"))) for s in services if isinstance(s, dict)),
        Decimal("0.00"),
    )
    pdf_subtotal = receipt.subtotal if (receipt.subtotal and receipt.subtotal > Decimal("0.00")) else services_sum
    pdf_discount = receipt.discount_amount or Decimal("0.00")
    pdf_tax = receipt.tax_amount or Decimal("0.00")
    pdf_total = (
        receipt.total_amount
        if (receipt.total_amount and receipt.total_amount > Decimal("0.00"))
        else (pdf_subtotal - pdf_discount + pdf_tax if (pdf_subtotal - pdf_discount + pdf_tax) > Decimal("0.00") else pdf_subtotal)
    )
    pdf_paid = receipt.amount_paid if (receipt.amount_paid and receipt.amount_paid > Decimal("0.00")) else pdf_total

    calc_rows = [
        [Paragraph("Services Subtotal:", summary_label), Paragraph(_fmt_curr(pdf_subtotal), summary_val)],
    ]
    if pdf_discount > Decimal("0.00"):
        disc_label = "Discount / Coupon:"
        if receipt.voucher_code:
            disc_label += f" ({receipt.voucher_code})"
        elif receipt.applied_offer_title:
            disc_label += f" ({receipt.applied_offer_title})"
        calc_rows.append([
            Paragraph(disc_label, summary_label),
            Paragraph(f"- {_fmt_curr(pdf_discount)}", ParagraphStyle("DiscVal", parent=summary_val, textColor=colors.HexColor("#15803d"))),
        ])

    if pdf_tax > Decimal("0.00"):
        calc_rows.append([
            Paragraph("Taxes &amp; Hygiene Fee:", summary_label),
            Paragraph(f"+ {_fmt_curr(pdf_tax)}", summary_val),
        ])

    calc_rows.append([
        Paragraph("<b>Total Payable Amount:</b>", summary_label),
        Paragraph(f"<b>{_fmt_curr(pdf_total)}</b>", summary_val),
    ])

    calc_rows.append([
        Paragraph("<b>FINAL AMOUNT PAID:</b>", ParagraphStyle("FinalPaidLabel", parent=summary_label, fontName=FONT_BOLD, fontSize=9.5, textColor=colors.HexColor("#0f766e"))),
        Paragraph(f"<b>{_fmt_curr(pdf_paid)}</b>", ParagraphStyle("FinalPaidVal", parent=summary_val, fontName=FONT_BOLD, fontSize=10, textColor=colors.HexColor("#0f766e"))),
    ])

    pricing_table = Table(calc_rows, colWidths=[150, 120])
    pricing_table.setStyle(
        TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("TOPPADDING", (0, 0), (-1, -1), 3),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
            ("LINEBELOW", (0, -2), (-1, -2), 0.5, colors.HexColor("#cbd5e1")),
            ("LINEBELOW", (0, -1), (-1, -1), 1.5, colors.HexColor("#0f766e")),
        ])
    )

    bottom_grid = Table([[payment_info_table, pricing_table]], colWidths=[260, 280])
    bottom_grid.setStyle(
        TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING", (0, 0), (-1, -1), 0),
            ("RIGHTPADDING", (0, 0), (-1, -1), 0),
            ("TOPPADDING", (0, 0), (-1, -1), 0),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
        ])
    )
    elements.append(KeepTogether(bottom_grid))

    elements.append(Spacer(1, 12))
    elements.append(badge_table)
    
    elements.append(Spacer(1, 25))
    elements.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#cbd5e1"), spaceBefore=5, spaceAfter=8))



    # 6. Footer Disclaimer
    elements.append(
        Paragraph(
            "This is a system-generated electronic receipt issued via BookMySalon platform. "
            "It does not require a physical signature.<br/>"
            f"Thank you for booking with {receipt.salon_name}! For inquiries, contact {receipt.salon_email or receipt.salon_phone or 'support@bookmysalon.com'}.",
            footer_text,
        )
    )

    doc.build(elements)
    pdf_bytes = buffer.getvalue()
    buffer.close()
    return pdf_bytes

