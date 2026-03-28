import { AlertTriangle, AlertCircle, Info, CheckCircle } from "lucide-react";

type Severity = "Critical" | "High" | "Medium" | "Low";

const config: Record<Severity, { color: string; bg: string; border: string; icon: typeof AlertTriangle }> = {
  Critical: { color: "#ef4444", bg: "#450a0a", border: "#7f1d1d", icon: AlertTriangle },
  High: { color: "#f97316", bg: "#431407", border: "#7c2d12", icon: AlertCircle },
  Medium: { color: "#eab308", bg: "#422006", border: "#713f12", icon: Info },
  Low: { color: "#22c55e", bg: "#052e16", border: "#14532d", icon: CheckCircle },
};

interface AlertBadgeProps {
  severity: Severity;
  label?: boolean;
}

export default function AlertBadge({ severity, label = false }: AlertBadgeProps) {
  const c = config[severity];
  const Icon = c.icon;
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border"
      style={{ color: c.color, background: c.bg, borderColor: c.border }}
    >
      <Icon size={11} />
      {label !== false && severity}
    </span>
  );
}

export { type Severity };
