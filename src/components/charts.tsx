/** Compact monochrome charts used on the overview. */
export function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const w = 300, h = 56, pad = 6;
  const min = Math.min(...values), max = Math.max(...values), span = max - min || 1;
  const pts = values.map((v, i) => [pad + (i * (w - 2 * pad)) / (values.length - 1), h - pad - ((v - min) / span) * (h - 2 * pad)] as const);
  const [lx, ly] = pts.at(-1)!;
  return (
    <svg className="spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" role="img" aria-label="Динамика за период">
      <polyline points={pts.map((p) => p.join(",")).join(" ")} fill="none" stroke="currentColor" strokeWidth="1.6" vectorEffect="non-scaling-stroke" />
      <circle cx={lx} cy={ly} r="3.5" fill="currentColor" />
    </svg>
  );
}
export function Bars({ values }: { values: number[] }) {
  const max = Math.max(...values, 1);
  return <div className="bars" role="img" aria-label="Значения по периодам">{values.map((v, i) => <i key={i} style={{ height: `${Math.max(6, (v / max) * 100)}%` }} />)}</div>;
}
