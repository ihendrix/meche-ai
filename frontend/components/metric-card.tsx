interface MetricCardProps {
  label: string;
  value: string | number;
  sub: string;
}

export function MetricCard({ label, value, sub }: MetricCardProps) {
  return (
    <article className="metric-card">
      <div className="metric-label">{label}</div>
      <div className="metric-value">{value}</div>
      <div className="metric-sub">{sub}</div>
    </article>
  );
}
