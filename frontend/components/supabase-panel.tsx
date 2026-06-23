"use client";

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import type { AnalysisResponse } from "@/lib/types";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import {
  listSavedAnalyses,
  saveAnalysis,
  type SavedAnalysisSummary,
} from "@/lib/supabase/save-analysis";

interface SupabasePanelProps {
  analysis: AnalysisResponse;
  sourceFiles: File[];
}

export function SupabasePanel({ analysis, sourceFiles }: SupabasePanelProps) {
  const configured = isSupabaseConfigured();
  const [user, setUser] = useState<User | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [analysisName, setAnalysisName] = useState("Mechanical test analysis");
  const [saved, setSaved] = useState<SavedAnalysisSummary[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function refreshSaved() {
    if (!configured) return;
    try {
      setSaved(await listSavedAnalyses());
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load saved analyses.");
    }
  }

  useEffect(() => {
    if (!configured) return;
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user ?? null);
      if (data.user) void refreshSaved();
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) void refreshSaved();
      else setSaved([]);
    });
    return () => listener.subscription.unsubscribe();
    // The configuration is fixed for the life of the page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configured]);

  async function signIn() {
    setBusy(true);
    setMessage("");
    try {
      const { error } = await createClient().auth.signInWithPassword({ email, password });
      if (error) throw error;
      setMessage("Signed in.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Sign-in failed.");
    } finally {
      setBusy(false);
    }
  }

  async function signUp() {
    setBusy(true);
    setMessage("");
    try {
      const { data, error } = await createClient().auth.signUp({ email, password });
      if (error) throw error;
      setMessage(data.session ? "Account created and signed in." : "Account created. Check your email to confirm it, then sign in.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Account creation failed.");
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    setBusy(true);
    setMessage("");
    try {
      const { error } = await createClient().auth.signOut();
      if (error) throw error;
      setMessage("Signed out.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Sign-out failed.");
    } finally {
      setBusy(false);
    }
  }

  async function saveCurrentAnalysis() {
    setBusy(true);
    setMessage("");
    try {
      await saveAnalysis(analysisName, analysis, sourceFiles);
      setMessage("Analysis saved to Supabase.");
      await refreshSaved();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save analysis.");
    } finally {
      setBusy(false);
    }
  }

  if (!configured) {
    return (
      <div className="supabase-box">
        <h3>Saved analyses</h3>
        <p className="muted">
          Add the two Supabase values from <code>frontend/.env.local.example</code> to enable accounts, database saving, and private source-file storage.
        </p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="supabase-box">
        <h3>Sign in to save analyses</h3>
        <div className="account-grid">
          <label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
          <label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>
        </div>
        <div className="button-row">
          <button className="primary" disabled={busy || !email || password.length < 6} onClick={signIn}>Sign in</button>
          <button disabled={busy || !email || password.length < 6} onClick={signUp}>Create account</button>
        </div>
        {message && <p className="form-message">{message}</p>}
      </div>
    );
  }

  return (
    <div className="supabase-box">
      <div className="saved-heading">
        <div>
          <h3>Saved analyses</h3>
          <p className="muted">Signed in as {user.email}</p>
        </div>
        <button disabled={busy} onClick={signOut}>Sign out</button>
      </div>
      <label>
        Analysis name
        <input value={analysisName} onChange={(event) => setAnalysisName(event.target.value)} />
      </label>
      <button className="primary save-button" disabled={busy} onClick={saveCurrentAnalysis}>
        {busy ? "Saving…" : "Save current analysis"}
      </button>
      {message && <p className="form-message">{message}</p>}
      {saved.length > 0 && (
        <div className="saved-list">
          {saved.map((item) => (
            <div className="saved-row" key={item.id}>
              <strong>{item.name}</strong>
              <span>{new Date(item.created_at).toLocaleString()}</span>
              <span>{item.summary.files_plotted} file(s) · {item.summary.clean_rows} cleaned rows</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
