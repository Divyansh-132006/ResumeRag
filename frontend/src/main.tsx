import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const API =
  import.meta.env.VITE_API_URL ??
  (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
    ? "http://localhost:5000/api"
    : "https://resumerag-j9p1.onrender.com/api");
const TOKEN_KEY = "resume-token";
const PAGES = ["dashboard", "review", "jobs", "history", "settings"];

type Resume = {
  _id: string;
  originalName: string;
  status: string;
  ingestionStatus: string;
  structuredResume: Record<string, unknown>;
};

type Job = {
  _id: string;
  title: string;
  text: string;
  analysis: { keywords: string[] };
};

type Generation = {
  _id: string;
  output: Record<string, unknown>;
  createdAt: string;
};

const latexTemplateExample = `% RESUMERAG:SUMMARY:START
Paste your tailored summary here.
% RESUMERAG:SUMMARY:END`;

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const response = await fetch(`${API}${path}`, { ...options, headers });
  const body = await response.json().catch(() => ({}));

  if (!response.ok) throw new Error(body.message ?? "Request failed");
  return body as T;
}

const jsonPost = (method: string, data: unknown): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(data),
});

const errorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

/* -------------------------------------------------------------------------- */
/* App                                                                        */
/* -------------------------------------------------------------------------- */

function App() {
  // Auth
  const [token, setToken] = useState(localStorage.getItem(TOKEN_KEY));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [authMode, setAuthMode] = useState<"login" | "register">("login");

  // Navigation
  const [page, setPage] = useState(location.hash.slice(1) || "dashboard");

  // Data
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [generations, setGenerations] = useState<Generation[]>([]);
  const [selected, setSelected] = useState<Resume | null>(null); // currently unused

  // Job form
  const [jobTitle, setJobTitle] = useState("");
  const [jobText, setJobText] = useState("");
  const [latexTemplate, setLatexTemplate] = useState(latexTemplateExample);
  const [latexFile, setLatexFile] = useState<File | null>(null);
  const [latexSource, setLatexSource] = useState("");
  const [tailoredLatex, setTailoredLatex] = useState("");
  const [latexDragging, setLatexDragging] = useState(false);
  const [latexStep, setLatexStep] = useState<"source" | "job">("source");

  // UI state
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [pendingConfirmation, setPendingConfirmation] = useState<{ kind: "resume" | "job" | "generation" | "account"; id?: string } | null>(null);

  /* ----------------------------- Navigation ------------------------------ */

  const go = (next: string) => {
    location.hash = next;
    setPage(next);
    setMessage("");
  };

  /* ----------------------------- Data loading ---------------------------- */

  const load = async () => {
    try {
      const [r, j, g] = await Promise.all([
        request<{ data: Resume[] }>("/resumes"),
        request<{ data: Job[] }>("/job-descriptions"),
        request<{ data: Generation[] }>("/generations"),
      ]);
      setResumes(r.data);
      setJobs(j.data);
      setGenerations(g.data);
    } catch (error) {
      setMessage(errorMessage(error, "Could not load workspace"));
    }
  };

  useEffect(() => {
    if (token) void load();
  }, [token]);

  /* ------------------------------- Actions ------------------------------- */

  const auth = async (mode: "login" | "register") => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setMessage("Enter a valid email address.");
      return;
    }
    if (mode === "register" && password.length < 12) {
      setMessage("Registration passwords must contain at least 12 characters.");
      return;
    }
    if (mode === "register" && password !== passwordConfirmation) {
      setMessage("Passwords do not match.");
      return;
    }
    if (!password) {
      setMessage("Enter your password.");
      return;
    }
    setBusy(true);
    try {
      const result = await request<{ data: { token: string } }>(
        `/auth/${mode}`,
        jsonPost("POST", { email: normalizedEmail, password })
      );
      localStorage.setItem(TOKEN_KEY, result.data.token);
      setToken(result.data.token);
      setMessage(mode === "register" ? "Account created successfully." : "Welcome back.");
    } catch (error) {
      setMessage(errorMessage(error, "Authentication failed"));
    } finally {
      setBusy(false);
    }
  };

  const signOut = () => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setMessage("You have been signed out.");
    setResumes([]);
    setJobs([]);
    setGenerations([]);
  };

  const upload = async (file: File) => {
    setBusy(true);
    try {
      const form = new FormData();
      form.append("resume", file);
      await request("/resumes/upload", { method: "POST", body: form });

      setMessage("Resume uploaded. Open Review to approve canonical facts.");
      await load();
      go("review");
    } catch (error) {
      setMessage(errorMessage(error, "Upload failed"));
    } finally {
      setBusy(false);
    }
  };

  const approve = async (resume: Resume) => {
    setBusy(true);
    try {
      let structuredResume = resume.structuredResume;
      if (!structuredResume || Object.keys(structuredResume).length === 0) {
        const fullResume = await request<{ data: Resume }>(`/resumes/${resume._id}`);
        structuredResume = fullResume.data.structuredResume;
      }
      await request(
        `/resumes/${resume._id}`,
        jsonPost("PATCH", {
          structuredResume,
          status: "approved",
        })
      );
      setMessage("Resume approved. Vector ingestion status is shown below.");
      await load();
    } catch (error) {
      setMessage(errorMessage(error, "Approval failed"));
    } finally {
      setBusy(false);
    }
  };

  const saveJob = async () => {
    setBusy(true);
    try {
      await request(
        "/job-descriptions",
        jsonPost("POST", { title: jobTitle, text: jobText })
      );
      setJobTitle("");
      setMessage("Job description analyzed and saved.");
      await load();
    } catch (error) {
      setMessage(errorMessage(error, "Could not save job description"));
    } finally {
      setBusy(false);
    }
  };

  const generate = async (jobId: string) => {
    const resume = resumes.find(
      (item) => item.status === "approved" && item.ingestionStatus === "indexed"
    );
    if (!resume) {
      setMessage("Approve and index a resume before generating.");
      return;
    }

    setBusy(true);
    try {
      await request(
        "/generations",
        jsonPost("POST", { resumeId: resume._id, jobDescriptionId: jobId })
      );
      setMessage("Grounded resume generated.");
      await load();
      go("history");
    } catch (error) {
      setMessage(errorMessage(error, "Generation failed"));
    } finally {
      setBusy(false);
    }
  };

  const exportGeneration = async (id: string) => {
    setBusy(true);
    try {
      const response = await fetch(`${API}/generations/${id}/export`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem(TOKEN_KEY) ?? ""}`,
        },
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.message ?? `PDF export failed (${response.status})`);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "tailored-resume.pdf";
      anchor.click();
      URL.revokeObjectURL(url);
      setMessage("PDF exported.");
    } catch (error) {
      setMessage(errorMessage(error, "PDF export failed"));
    } finally {
      setBusy(false);
    }
  };

  const generateLatex = async (id: string) => {
    if (!latexTemplate.includes("% RESUMERAG:SUMMARY:START") ||
        !latexTemplate.includes("% RESUMERAG:SUMMARY:END")) {
      setMessage("Add both ResumeRag summary markers to the LaTeX template.");
      return;
    }
    setBusy(true);
    try {
      const result = await request<{
        data: { latex: string; pdfBase64: string };
      }>(`/latex/${id}/generate`, jsonPost("POST", { template: latexTemplate }));
      const latexBlob = new Blob([result.data.latex], { type: "application/x-tex" });
      const latexUrl = URL.createObjectURL(latexBlob);
      const latexLink = document.createElement("a");
      latexLink.href = latexUrl;
      latexLink.download = "tailored-resume.tex";
      latexLink.click();
      URL.revokeObjectURL(latexUrl);

      const binary = atob(result.data.pdfBase64);
      const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
      const pdfUrl = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
      const pdfLink = document.createElement("a");
      pdfLink.href = pdfUrl;
      pdfLink.download = "tailored-resume.pdf";
      pdfLink.click();
      URL.revokeObjectURL(pdfUrl);
      setMessage("Tailored LaTeX source and PDF downloaded.");
    } catch (error) {
      setMessage(errorMessage(error, "LaTeX generation failed"));
    } finally {
      setBusy(false);
    }
  };

  const tailorLatex = async () => {
    if (!latexSource.trim()) {
      setMessage("Drop, upload, or paste your complete Overleaf .tex source first.");
      return;
    }
    if (jobText.trim().length < 30) {
      setMessage("Enter a job description with at least 30 characters.");
      return;
    }
    setBusy(true);
    try {
      const form = new FormData();
      form.append("source", latexSource);
      form.append("jobDescription", jobText);
      const result = await request<{
        data: { latex: string; pdfBase64?: string; compileError?: string };
      }>("/latex/tailor", {
        method: "POST",
        body: form,
      });
      setTailoredLatex(result.data.latex);
      if (result.data.pdfBase64) {
        const binary = atob(result.data.pdfBase64);
        const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
        const pdfUrl = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
        const pdfLink = document.createElement("a");
        pdfLink.href = pdfUrl;
        pdfLink.download = "tailored-resume.pdf";
        pdfLink.click();
        URL.revokeObjectURL(pdfUrl);
      }
      setMessage(
        result.data.compileError
          ? `LaTeX source is ready, but PDF compilation failed: ${result.data.compileError}`
          : "Complete tailored LaTeX source and PDF are ready.",
      );
    } catch (error) {
      setMessage(errorMessage(error, "LaTeX tailoring failed"));
    } finally {
      setBusy(false);
    }
  };

  const readLatexFile = async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".tex")) {
      setMessage("Choose a .tex Overleaf file.");
      return;
    }
    setLatexFile(file);
    setLatexSource(await file.text());
    setTailoredLatex("");
    setLatexStep("source");
  };

  const moveToLatexJob = () => {
    if (!latexSource.trim()) {
      setMessage("Drop, upload, or paste your complete Overleaf .tex source first.");
      return;
    }
    setLatexStep("job");
    setMessage("");
  };

  const downloadLatex = () => {
    const url = URL.createObjectURL(
      new Blob([tailoredLatex], { type: "application/x-tex" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "tailored-resume.tex";
    link.click();
    URL.revokeObjectURL(url);
  };

  const copyLatex = async () => {
    try {
      await navigator.clipboard.writeText(tailoredLatex);
      setMessage("Tailored LaTeX copied to the clipboard.");
    } catch {
      setMessage("Clipboard access failed. Select and copy the LaTeX from the editor.");
    }
  };

  const deleteResume = async (id: string) => {
    if (pendingConfirmation?.kind !== "resume" || pendingConfirmation.id !== id) {
      setPendingConfirmation({ kind: "resume", id });
      return;
    }
    setPendingConfirmation(null);
    setBusy(true);
    try {
      await request(`/resumes/${id}`, { method: "DELETE" });
      setMessage("Resume deleted.");
      await load();
    } catch (error) {
      setMessage(errorMessage(error, "Resume deletion failed"));
    } finally {
      setBusy(false);
    }
  };

  const deleteJob = async (id: string) => {
    if (pendingConfirmation?.kind !== "job" || pendingConfirmation.id !== id) {
      setPendingConfirmation({ kind: "job", id });
      return;
    }
    setPendingConfirmation(null);
    setBusy(true);
    try {
      await request(`/job-descriptions/${id}`, { method: "DELETE" });
      setMessage("Job description deleted.");
      await load();
    } catch (error) {
      setMessage(errorMessage(error, "Job description deletion failed"));
    } finally {
      setBusy(false);
    }
  };

  const deleteGeneration = async (id: string) => {
    if (pendingConfirmation?.kind !== "generation" || pendingConfirmation.id !== id) {
      setPendingConfirmation({ kind: "generation", id });
      return;
    }
    setPendingConfirmation(null);
    setBusy(true);
    try {
      await request(`/generations/${id}`, { method: "DELETE" });
      setMessage("Generated resume deleted.");
      await load();
    } catch (error) {
      setMessage(errorMessage(error, "Generated resume deletion failed"));
    } finally {
      setBusy(false);
    }
  };

  const deleteAccount = async () => {
    if (pendingConfirmation?.kind !== "account") {
      setPendingConfirmation({ kind: "account" });
      return;
    }
    setPendingConfirmation(null);
    setBusy(true);
    try {
      await request("/account", { method: "DELETE" });
      signOut();
    } catch (error) {
      setMessage(errorMessage(error, "Account deletion failed"));
    } finally {
      setBusy(false);
    }
  };

  /* ---------------------------- Login / register ------------------------- */

  if (!token) {
    return (
      <main className="shell">
        <h1>Resume RAG</h1>
        <p>Evidence-first resume tailoring without invented candidate facts.</p>

        <section className="panel">
          <h2>{authMode === "login" ? "Sign in" : "Create account"}</h2>
          <p className="form-hint">
            {authMode === "login"
              ? "Use your account to access your private resume workspace."
              : "Create an account to securely save your resumes and job descriptions."}
          </p>
          <form onSubmit={(event) => { event.preventDefault(); void auth(authMode); }}>
          <input
            type="email"
            placeholder="Email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            type="password"
            placeholder={authMode === "register" ? "Password (12+ characters)" : "Password"}
            autoComplete={authMode === "register" ? "new-password" : "current-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {authMode === "register" && (
            <input
              type="password"
              placeholder="Confirm password"
              autoComplete="new-password"
              value={passwordConfirmation}
              onChange={(e) => setPasswordConfirmation(e.target.value)}
            />
          )}
          <div className="actions">
            <button
              type="submit"
              disabled={busy}
            >
              {authMode === "login" ? "Sign in" : "Create account"}
            </button>
            <button
              type="button"
              className="secondary"
              disabled={busy}
              onClick={() => {
                setAuthMode(authMode === "login" ? "register" : "login");
                setMessage("");
                setPassword("");
                setPasswordConfirmation("");
              }}
            >
              {authMode === "login" ? "Create account" : "Back to sign in"}
            </button>
          </div>
          </form>
        </section>

        {message && <p className="message" role="status">{message}</p>}
      </main>
    );
  }

  /* ------------------------------ Main layout ---------------------------- */

  return (
    <main className="shell">
      <header>
        <div>
          <h1>Resume RAG</h1>
          <p>Private evidence-first workspace</p>
        </div>
        <button className="secondary" onClick={signOut}>
          Sign out
        </button>
      </header>

      <nav>
        {PAGES.map((item) => (
          <button
            key={item}
            className={page === item ? "" : "secondary"}
            onClick={() => go(item)}
          >
            {item}
          </button>
        ))}
      </nav>

      {/* Dashboard */}
      {page === "dashboard" && (
        <>
          <section className="panel">
            <h2>Choose your resume format</h2>
            <p>
              Use the PDF option for the existing Resume RAG review and grounded
              generation flow, or use LaTeX for an Overleaf source file.
            </p>
            <label className="drop">
              Choose a text-based PDF (Resume RAG)
              <input
                type="file"
                accept="application/pdf"
                disabled={busy}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void upload(file);
                }}
              />
            </label>
          </section>

          <section className="panel">
            <h2>One job description for both formats</h2>
            <input
              placeholder="Role title"
              value={jobTitle}
              onChange={(event) => setJobTitle(event.target.value)}
            />
            <textarea
              placeholder="Paste the job description here (at least 30 characters)"
              value={jobText}
              onChange={(event) => setJobText(event.target.value)}
            />
            <button
              disabled={busy || !jobTitle.trim() || jobText.trim().length < 30}
              onClick={() => void saveJob()}
            >
              Analyze and save job description
            </button>
            <p>
              This same job description is used for PDF generation and LaTeX
              tailoring. You do not need to enter it twice.
            </p>
          </section>

          <section className="panel">
            <h2>Workspace</h2>
            <p>
              {resumes.length} resumes · {jobs.length} job descriptions ·{" "}
              {generations.length} generations
            </p>
          </section>
          <section className="panel">
            <h2>Option 2: tailor an Overleaf LaTeX resume</h2>
            <p>
              Choose PDF or LaTeX as your resume format. The job description entered
              below is shared by both flows.
            </p>
            <label
              className={`drop${latexDragging ? " drop-active" : ""}`}
              onDragOver={(event) => {
                event.preventDefault();
                setLatexDragging(true);
              }}
              onDragLeave={() => setLatexDragging(false)}
              onDrop={(event) => {
                event.preventDefault();
                setLatexDragging(false);
                const file = event.dataTransfer.files[0];
                if (file) void readLatexFile(file);
              }}
            >
              {latexFile ? latexFile.name : "Choose an Overleaf .tex file"}
              <input
                type="file"
                accept=".tex,text/x-tex"
                disabled={busy}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void readLatexFile(file);
                }}
              />
            </label>
            <textarea
              className="latex-template"
              aria-label="Original Overleaf LaTeX source"
              value={latexSource}
              onChange={(event) => {
                setLatexSource(event.target.value);
                setLatexFile(null);
                setTailoredLatex("");
              }}
              placeholder="Or paste the complete contents of main.tex here."
            />
            {latexStep === "source" ? (
              <button disabled={busy || !latexSource.trim()} onClick={moveToLatexJob}>
                Continue to job description
              </button>
            ) : (
              <>
                <div className="actions">
                  <button className="secondary" disabled={busy} onClick={() => setLatexStep("source")}>
                    Back to LaTeX source
                  </button>
                  <button disabled={busy || jobText.trim().length < 30} onClick={() => void tailorLatex()}>
                    Analyze shared JD and generate LaTeX
                  </button>
                </div>
              </>
            )}
            {tailoredLatex && (
              <>
                <div className="actions">
                  <button className="secondary" onClick={() => void copyLatex()}>
                    Copy LaTeX
                  </button>
                  <button className="secondary" onClick={downloadLatex}>
                    Download .tex
                  </button>
                </div>
                <textarea
                  className="latex-template"
                  aria-label="Tailored LaTeX source"
                  value={tailoredLatex}
                  onChange={(event) => setTailoredLatex(event.target.value)}
                />
              </>
            )}
          </section>
        </>
      )}

      {/* Review */}
      {page === "review" && (
        <section className="panel">
          <h2>Review and approve</h2>
          {resumes.map((resume) => (
            <article className="item" key={resume._id}>
              <strong>{resume.originalName}</strong>
              <span>
                {resume.status} · vectors: {resume.ingestionStatus}
              </span>
              <button
                disabled={busy || resume.status === "approved"}
                onClick={() => void approve(resume)}
              >
                Approve canonical data
              </button>
              <button
                className="secondary"
                disabled={busy}
                onClick={() => void deleteResume(resume._id)}
              >
                Delete resume
              </button>
              <pre>{JSON.stringify(resume.structuredResume, null, 2)}</pre>
            </article>
          ))}
        </section>
      )}

      {/* Jobs */}
      {page === "jobs" && (
        <>
          <section className="panel">
            <h2>Saved job descriptions</h2>
            <p>New job descriptions are added from the dashboard and can be used by the existing PDF generation flow.</p>
            {jobs.map((job) => (
              <article className="item" key={job._id}>
                <strong>{job.title}</strong>
                <span>{job.analysis.keywords.length} keywords detected</span>
                <button disabled={busy} onClick={() => void generate(job._id)}>
                  Generate grounded resume
                </button>
                <button
                  className="secondary"
                  disabled={busy}
                  onClick={() => void deleteJob(job._id)}
                >
                  Delete job
                </button>
              </article>
            ))}
          </section>
        </>
      )}

      {/* History */}
      {page === "history" && (
        <section className="panel">
          <h2>Generation history</h2>
          {generations.map((generation) => (
            <article className="item" key={generation._id}>
              <span>{new Date(generation.createdAt).toLocaleString()}</span>
              <button
                className="secondary"
                onClick={() => void exportGeneration(generation._id)}
              >
                Export PDF
              </button>
              <textarea
                className="latex-template"
                aria-label="Overleaf LaTeX template"
                value={latexTemplate}
                onChange={(event) => setLatexTemplate(event.target.value)}
                placeholder="Paste your Overleaf main.tex and add the ResumeRag summary markers."
              />
              <small>
                Add <code>% RESUMERAG:SUMMARY:START</code> and{" "}
                <code>% RESUMERAG:SUMMARY:END</code> around the summary only.
                All other LaTeX stays unchanged.
              </small>
              <button
                className="secondary"
                disabled={busy}
                onClick={() => void generateLatex(generation._id)}
              >
                Generate LaTeX + PDF
              </button>
              <button
                className="secondary"
                disabled={busy}
                onClick={() => void deleteGeneration(generation._id)}
              >
                Delete
              </button>
              <pre>{JSON.stringify(generation.output, null, 2)}</pre>
            </article>
          ))}
        </section>
      )}

      {/* Settings */}
      {page === "settings" && (
        <section className="panel">
          <h2>Settings</h2>
          <p>
            Delete individual resumes, job descriptions, and generated results
            from their respective pages. Your account remains active.
          </p>
          <button disabled={busy} onClick={() => void deleteAccount()}>
            Delete entire account
          </button>
        </section>
      )}

      {pendingConfirmation && (
        <section className="confirmation" role="alert">
          <strong>
            {pendingConfirmation.kind === "account"
              ? "Delete your account and all saved data?"
              : "Delete this item?"}
          </strong>
          <span>
            {pendingConfirmation.kind === "account"
              ? "This action cannot be undone."
              : "This action cannot be undone."}
          </span>
          <div className="actions">
            <button
              onClick={() => {
                if (pendingConfirmation.kind === "account") {
                  void deleteAccount();
                } else if (pendingConfirmation.id) {
                  const id = pendingConfirmation.id;
                  if (pendingConfirmation.kind === "resume") void deleteResume(id);
                  if (pendingConfirmation.kind === "job") void deleteJob(id);
                  if (pendingConfirmation.kind === "generation") void deleteGeneration(id);
                }
              }}
              disabled={busy}
            >
              Confirm deletion
            </button>
            <button className="secondary" onClick={() => setPendingConfirmation(null)}>
              Cancel
            </button>
          </div>
        </section>
      )}
      {message && <p className="message" role="status">{message}</p>}
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);