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

  // UI state
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

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
    } catch (error) {
      setMessage(errorMessage(error, "Authentication failed"));
    } finally {
      setBusy(false);
    }
  };

  const signOut = () => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
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
      setJobText("");
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

  const deleteResume = async (id: string) => {
    if (!confirm("Delete this resume, its uploaded PDF, vectors, and related generations?")) return;
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
    if (!confirm("Delete this job description and its related generations?")) return;
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
    if (!confirm("Delete this generated resume from history?")) return;
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
    if (!confirm("Delete your entire account and all saved data? This cannot be undone.")) return;
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
          <div className="actions">
            <button
              disabled={busy}
              onClick={() => {
                setAuthMode("login");
                void auth("login");
              }}
            >
              Sign in
            </button>
            <button
              className="secondary"
              disabled={busy}
              onClick={() => {
                setAuthMode("register");
                void auth("register");
              }}
            >
              Register
            </button>
          </div>
        </section>

        {message && <p className="message">{message}</p>}
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
            <h2>Upload a resume</h2>
            <label className="drop">
              Choose a text-based PDF
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
            <h2>Workspace</h2>
            <p>
              {resumes.length} resumes · {jobs.length} job descriptions ·{" "}
              {generations.length} generations
            </p>
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
            <h2>Analyze job description</h2>
            <input
              placeholder="Role title"
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
            />
            <textarea
              placeholder="Paste at least 30 characters"
              value={jobText}
              onChange={(e) => setJobText(e.target.value)}
            />
            <button
              disabled={busy || jobText.length < 30}
              onClick={() => void saveJob()}
            >
              Analyze and save
            </button>
          </section>

          <section className="panel">
            <h2>Saved jobs</h2>
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

      {message && <p className="message">{message}</p>}
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);