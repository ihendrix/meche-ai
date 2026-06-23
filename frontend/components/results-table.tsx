import type { MetricResult } from "@/lib/types";

function value(number: number | null, digits = 5) {
  return number == null ? "—" : number.toFixed(digits);
}

export function ResultsTable({ metrics }: { metrics: MetricResult[] }) {
  if (metrics.length === 0) return <div className="empty-state">No selected results.</div>;
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>File</th>
            <th>Peak Stress (MPa)</th>
            <th>Strain at Peak</th>
            <th>Young&apos;s Modulus (MPa)</th>
            <th>Modulus R²</th>
            <th>Modulus Fit</th>
            <th>Area Under Curve</th>
            <th>Rows</th>
          </tr>
        </thead>
        <tbody>
          {metrics.map((metric) => (
            <tr key={metric.file}>
              <td>{metric.file}</td>
              <td>{value(metric.peak_stress_mpa)}</td>
              <td>{value(metric.strain_at_peak)}</td>
              <td>{value(metric.youngs_modulus_mpa)}</td>
              <td>{value(metric.modulus_r2)}</td>
              <td><span className={`status ${metric.modulus_fit === "Valid" ? "valid" : "review"}`}>{metric.modulus_fit}</span></td>
              <td>{value(metric.area_under_curve)}</td>
              <td>{metric.rows}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
