import type { AnalysisResponse, AnalysisSettings } from "@/lib/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

async function parseResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    const detail = payload?.detail;
    throw new Error(typeof detail === "string" ? detail : `Request failed (${response.status})`);
  }
  return response.json() as Promise<T>;
}

export async function analyzeFiles(
  files: File[],
  settings: AnalysisSettings,
): Promise<AnalysisResponse> {
  const form = new FormData();
  files.forEach((file) => form.append("files", file));
  form.append("smoothing", settings.smoothing);
  form.append("smooth_window", String(settings.smooth_window));
  form.append("remove_outliers", String(settings.remove_outliers));
  form.append("crop_failure", String(settings.crop_failure));
  form.append("modulus_min", String(settings.modulus_min));
  form.append("modulus_max", String(settings.modulus_max));

  const response = await fetch(`${API_URL}/analysis`, {
    method: "POST",
    body: form,
  });
  return parseResponse<AnalysisResponse>(response);
}

export async function loadDemo(): Promise<AnalysisResponse> {
  const response = await fetch(`${API_URL}/analysis/demo`, { cache: "no-store" });
  return parseResponse<AnalysisResponse>(response);
}
