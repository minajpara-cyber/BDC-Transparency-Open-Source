export default function NaQuartileTrend() {
  return (
    <div className="rounded-xl border px-4 py-3" style={{ background: "#111118", borderColor: "#1e1e2e" }}>
      <h2 className="text-lg font-semibold text-white">Non-accrual forecasts pending validation</h2>
      <p className="text-xs mt-1 max-w-4xl" style={{ color: "#8b8ba8" }}>
        Forecasts and their historical comparisons are withheld while model inputs are aligned
        with the corrected non-accrual definitions. Projections will return after retraining and validation.
      </p>
    </div>
  );
}
