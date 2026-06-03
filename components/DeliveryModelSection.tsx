"use client";

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import {
  deliveryModelAsOf, modelByManager, softwareByVertical,
} from "@/data/delivery_model";

const VBAR = ["#6366f1", "#22c55e", "#f59e0b", "#06b6d4", "#ec4899", "#a855f7", "#64748b"];

function fmtB(m: number) {
  return m >= 1000 ? `$${(m / 1000).toFixed(1)}B` : `$${m.toFixed(0)}M`;
}

export default function DeliveryModelSection() {
  const totalSW = softwareByVertical.reduce((s, r) => s + r.fv_m, 0);
  const horizontal = softwareByVertical.find((r) => r.vertical === "Horizontal tech")?.fv_m ?? 0;
  const vertical = totalSW - horizontal;
  const healthSW = softwareByVertical.find((r) => r.vertical === "Healthcare")?.fv_m ?? 0;

  const mgrs = [...modelByManager]
    .filter((m) => (m.total_m as number) > 500)
    .sort((a, b) => (b.software_pct as number) - (a.software_pct as number));

  return (
    <section className="rounded-xl border p-5 mb-6" style={{ background: "#111118", borderColor: "#1e1e2e" }}>
      <h2 className="font-semibold text-white mb-1">Delivery model × end-market (LLM dual-axis)</h2>
      <p className="text-sm mb-4" style={{ color: "#9ca3af" }}>
        BDC filings give one muddy &quot;industry&quot; per loan. We add the axis they never provide — what the
        company <span className="text-white">is</span> (software vs services vs provider) — layered on the
        parser-cleaned end-market. The payoff: <span className="text-white">{fmtB(vertical)}</span> of what looks
        like &quot;software&quot; is actually <span className="text-white">vertical</span> software selling into a
        specific industry — including <span className="text-white">{fmtB(healthSW)}</span> of healthcare software
        (Inovalon, Symplr, ModMed, HealthEdge…), distinct from healthcare <em>providers</em>. As of {deliveryModelAsOf}.
      </p>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Software by vertical */}
        <div>
          <div className="text-xs uppercase tracking-wider mb-2" style={{ color: "#8b8ba8" }}>
            &quot;Software&quot; broken out by end-market
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={softwareByVertical} layout="vertical" margin={{ left: 24, right: 16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e1e2e" horizontal={false} />
              <XAxis type="number" tick={{ fill: "#8b8ba8", fontSize: 11 }}
                tickFormatter={(v) => `$${(v / 1000).toFixed(0)}B`} />
              <YAxis type="category" dataKey="vertical" width={90} interval={0}
                tick={{ fill: "#c7c7e0", fontSize: 11 }} />
              <Tooltip contentStyle={{ background: "#0d0d14", border: "1px solid #2d2d50", borderRadius: 8, fontSize: 12 }}
                formatter={(v) => [fmtB(Number(v)), "fair value"]} />
              <Bar dataKey="fv_m" radius={[0, 4, 4, 0]}>
                {softwareByVertical.map((_, i) => <Cell key={i} fill={VBAR[i % VBAR.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Software % of book by manager */}
        <div>
          <div className="text-xs uppercase tracking-wider mb-2" style={{ color: "#8b8ba8" }}>
            True software exposure by manager (% of book)
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={mgrs} layout="vertical" margin={{ left: 24, right: 16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e1e2e" horizontal={false} />
              <XAxis type="number" tick={{ fill: "#8b8ba8", fontSize: 11 }} unit="%" />
              <YAxis type="category" dataKey="key" width={90} interval={0} tick={{ fill: "#c7c7e0", fontSize: 11 }} />
              <Tooltip contentStyle={{ background: "#0d0d14", border: "1px solid #2d2d50", borderRadius: 8, fontSize: 12 }}
                formatter={(v) => [`${v}%`, "software % of book"]} />
              <Bar dataKey="software_pct" radius={[0, 4, 4, 0]} fill="#6366f1" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      <p className="text-xs mt-3" style={{ color: "#6b6b88" }}>
        Delivery model is derived from a rule map over the cleaned industry plus an LLM override for the
        software-hiding-in-a-vertical names the labels miss. Vertical = end-market the company serves.
      </p>
    </section>
  );
}
