export default function AnalyticsKpiCard({
  title,
  value,
  growth,
  periodLabel = "vs. previous period",
  icon,
  prefix = "",
  suffix = "",
  variant = "default",
  subtext,
  badgeText,
  onClick,
}) {
  // Safe extraction if value is passed as an object: { value: 42, growth: 10.5, period_label: "..." }
  let rawVal = value;
  let effectiveGrowth = growth;
  let effectivePeriod = periodLabel;

  if (value && typeof value === "object") {
    rawVal = value.value ?? value.count ?? value.total ?? value.amount ?? 0;
    if (growth === undefined && "growth" in value) {
      effectiveGrowth = value.growth;
    }
    if (periodLabel === "vs. previous period" && value.period_label) {
      effectivePeriod = value.period_label;
    }
  }

  const numGrowth =
    typeof effectiveGrowth === "number" ? effectiveGrowth : parseFloat(effectiveGrowth);
  const isPositive = !isNaN(numGrowth) && numGrowth > 0;
  const isNegative = !isNaN(numGrowth) && numGrowth < 0;
  const isNeutral = isNaN(numGrowth) || numGrowth === 0;

  const formattedValue =
    typeof rawVal === "number"
      ? prefix === "₹"
        ? `₹${rawVal.toLocaleString("en-IN", {
            minimumFractionDigits: 0,
            maximumFractionDigits: 2,
          })}`
        : rawVal.toLocaleString("en-IN")
      : rawVal !== undefined && rawVal !== null && typeof rawVal !== "object"
      ? `${prefix}${rawVal}${suffix}`
      : "0";

  return (
    <div
      className={`analytics-kpi-card variant-${variant} ${onClick ? "clickable" : ""}`}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <div className="analytics-kpi-header">
        <span className="analytics-kpi-title">{title}</span>
        {icon && <span className="analytics-kpi-icon">{icon}</span>}
      </div>

      <div className="analytics-kpi-value-row">
        <span className="analytics-kpi-value">{formattedValue}</span>
        {badgeText && <span className="analytics-kpi-badge">{badgeText}</span>}
      </div>

      <div className="analytics-kpi-footer">
        {effectiveGrowth !== undefined && effectiveGrowth !== null && (
          <span
            className={`analytics-kpi-growth ${
              isPositive ? "positive" : isNegative ? "negative" : "neutral"
            }`}
          >
            {isPositive && "↑ +"}
            {isNegative && "↓ "}
            {isNeutral && "• "}
            {Math.abs(numGrowth).toFixed(1)}%
          </span>
        )}
        <span className="analytics-kpi-period">{effectivePeriod}</span>
      </div>

      {subtext && <div className="analytics-kpi-subtext">{String(subtext)}</div>}
    </div>
  );
}
