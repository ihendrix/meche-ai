import type { AnalysisResponse } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";

export interface SavedAnalysisSummary {
  id: string;
  name: string;
  created_at: string;
  summary: AnalysisResponse["summary"];
}

function safeStorageName(filename: string) {
  return filename.replace(/[^a-zA-Z0-9._-]+/g, "_");
}

export async function saveAnalysis(
  name: string,
  result: AnalysisResponse,
  sourceFiles: File[],
) {
  const supabase = createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) throw new Error("Sign in before saving an analysis.");

  const { data: analysis, error: analysisError } = await supabase
    .from("analyses")
    .insert({
      user_id: authData.user.id,
      name: name.trim() || "Untitled analysis",
      settings: result.settings,
      summary: result.summary,
    })
    .select("id")
    .single();
  if (analysisError) throw analysisError;

  const sourcePaths = new Map<string, string>();
  for (const file of sourceFiles) {
    const path = `${authData.user.id}/${analysis.id}/source/${safeStorageName(file.name)}`;
    const { error: uploadError } = await supabase.storage
      .from("mechanical-files")
      .upload(path, file, { upsert: false });
    if (uploadError) throw uploadError;
    sourcePaths.set(file.name, path);
  }

  const fileRows = result.files.map((file) => ({
    analysis_id: analysis.id,
    filename: file.name,
    data_kind: file.data_kind,
    status: file.status,
    strain_column: file.strain_column,
    stress_column: file.stress_column,
    source_stress_unit: file.source_stress_unit,
    diagnostics: { warnings: file.warnings },
    curve_data: file.points,
    source_path: sourcePaths.get(file.name) ?? null,
  }));

  const metricRows = result.metrics.map(({ file, ...metric }) => ({
    analysis_id: analysis.id,
    file_name: file,
    ...metric,
  }));

  const [{ error: filesError }, { error: metricsError }] = await Promise.all([
    supabase.from("analysis_files").insert(fileRows),
    supabase.from("analysis_metrics").insert(metricRows),
  ]);
  if (filesError) throw filesError;
  if (metricsError) throw metricsError;
  return analysis.id as string;
}

export async function listSavedAnalyses(): Promise<SavedAnalysisSummary[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("analyses")
    .select("id,name,created_at,summary")
    .order("created_at", { ascending: false })
    .limit(10);
  if (error) throw error;
  return (data ?? []) as SavedAnalysisSummary[];
}
