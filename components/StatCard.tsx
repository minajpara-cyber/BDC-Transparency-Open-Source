import { ReactNode } from "react";

interface StatCardProps {
  label: string;
  value: string;
  sub?: string;
  icon?: ReactNode;
  trend?: "up" | "down" | "neutral";
  trendLabel?: string;
  highlight?: boolean;
  color?: string;
}

export default function StatCard({
  label,
  value,
  sub,
  icon,
  trend,
  trendLabel,
  highlight,
  color = "#6366f1",
}: StatCardProps) {
  const trendColor =
    trend === "up" ? "#22c55e" : trend === "down" ? "#ef4444" : "#8b8ba8";

  return (
    <div
      className="rounded-xl p-5 border"
      style={{
        background: "#111118",
        borderColor: highlight ? color : "#1e1e2e",
        boxShadow: highlight ? `0 0 0 1px ${color}22` : undefined,
      }}
    >
      <div className="flex items-start justify-between mb-3">
        <span className="text-xs font-medium uppercase tracking-wide" style={{ color: "#8b8ba8" }}>
          {label}
        </span>
        {icon && (
          <div className="text-sm opacity-60" style={{ color }}>
            {icon}
          </div>
        )}
      </div>
      <div className="text-2xl font-bold text-white mb-1">{value}</div>
      {(sub || trendLabel) && (
        <div className="flex items-center gap-2">
          {trendLabel && (
            <span className="text-xs font-medium" style={{ color: trendColor }}>
              {trend === "up" ? "↑" : trend === "down" ? "↓" : "–"} {trendLabel}
            </span>
          )}
          {sub && (
            <span className="text-xs" style={{ color: "#6b6b88" }}>
              {sub}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
