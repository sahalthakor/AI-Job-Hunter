import React, { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";
import Auth from "./Auth";
import JobMatching from "./pages/JobMatching";

const API_BASE_URL = "http://127.0.0.1:8000";

async function apiFetch(endpoint, options = {}) {
  const token =
    localStorage.getItem("access_token") ||
    localStorage.getItem("token") ||
    localStorage.getItem("jwt_token");

  const headers = {
    ...(options.headers || {}),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

    if (response.status === 401) {
      localStorage.removeItem("access_token");
      localStorage.removeItem("token");
      localStorage.removeItem("jwt_token");
      localStorage.removeItem("user");
      localStorage.removeItem("role");
      localStorage.removeItem("user_role");
      window.location.reload();
    }

    return response;
  } catch (error) {
    console.error("Network or API call failed:", error);
    throw error;
  }
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function calculateCompleteness(profile) {
  if (!profile) return 0;

  const checks = [
    Boolean(profile.name),
    Boolean(profile.email),
    Boolean(profile.phone),
    Boolean(profile.headline),
    safeArray(profile.skills).filter(Boolean).length > 0,
    safeArray(profile.education).length > 0,
    safeArray(profile.experience).length > 0,
    safeArray(profile.projects).length > 0,
    safeArray(profile.preferred_roles).filter(Boolean).length > 0,
    safeArray(profile.preferred_locations).filter(Boolean).length > 0,
  ];

  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

function normalizeProfile(profile) {
  if (!profile) return null;

  return {
    ...profile,
    skills: safeArray(profile.skills),
    education: safeArray(profile.education),
    experience: safeArray(profile.experience),
    projects: safeArray(profile.projects),
    certifications: safeArray(profile.certifications),
    preferred_roles: safeArray(profile.preferred_roles),
    preferred_locations: safeArray(profile.preferred_locations),
  };
}

function ConfirmModal({
  open,
  title,
  message,
  confirmText = "Delete",
  onConfirm,
  onCancel,
  loading = false,
}) {
  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="confirm-modal" onClick={(e) => e.stopPropagation()}>
        <div className="confirm-icon">!</div>
        <h2>{title}</h2>
        <p>{message}</p>
        <div className="confirm-actions">
          <button className="secondary-button" onClick={onCancel} disabled={loading}>
            Cancel
          </button>
          <button className="danger-button" onClick={onConfirm} disabled={loading}>
            {loading ? "Deleting..." : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

function EditorSection({
  title,
  subtitle,
  number,
  open,
  onToggle,
  action,
  children,
}) {
  return (
    <section className={`editor-section ${open ? "is-open" : ""}`}>
      <div className="editor-section-header">
        <button type="button" className="editor-section-title" onClick={onToggle}>
          <span className="section-number">{number}</span>
          <span className="section-title-content">
            <strong>{title}</strong>
            <small>{subtitle}</small>
          </span>
          <span className="section-chevron">{open ? "▲" : "▼"}</span>
        </button>

        {action && (
          <div className="editor-section-action" onClick={(e) => e.stopPropagation()}>
            {action}
          </div>
        )}
      </div>

      {open && <div className="editor-section-body">{children}</div>}
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  wide = false,
  textarea = false,
  placeholder = "",
}) {
  return (
    <label className={`field ${wide ? "field-wide" : ""}`}>
      <span>{label}</span>
      {textarea ? (
        <textarea
          value={value ?? ""}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          rows={4}
        />
      ) : (
        <input
          value={value ?? ""}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </label>
  );
}

function ChecklistItem({ label, done }) {
  return (
    <div className={`checklist-item ${done ? "done" : ""}`}>
      <span className="checklist-icon">{done ? "✓" : "○"}</span>
      <span>{label}</span>
    </div>
  );
}

function AdminPage({
  apiFetch,
  navigate,
  setSuccess,
  setError,
  deleteTarget,
  setDeleteTarget,
}) {
  const [adminStats, setAdminStats] = useState({
    total_candidates: 0,
    total_resumes: 0,
  });

  const [adminCandidates, setAdminCandidates] = useState([]);
  const [adminResumes, setAdminResumes] = useState([]);
  const [adminLoading, setAdminLoading] = useState(true);
  const [adminError, setAdminError] = useState("");
  const [adminTab, setAdminTab] = useState("overview");

  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [candidateDetails, setCandidateDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);

  async function loadAdminData() {
    setAdminLoading(true);
    setAdminError("");

    try {
      const [dashboardResponse, candidatesResponse, resumesResponse] = await Promise.all([
        apiFetch("/admin/dashboard"),
        apiFetch("/admin/candidates"),
        apiFetch("/admin/resumes"),
      ]);

      if (
        dashboardResponse.status === 403 ||
        candidatesResponse.status === 403 ||
        resumesResponse.status === 403
      ) {
        throw new Error("You do not have permission to access the Admin Panel.");
      }

      const dashboardData = await dashboardResponse.json();
      const candidatesData = await candidatesResponse.json();
      const resumesData = await resumesResponse.json();

      if (!dashboardResponse.ok) {
        throw new Error(dashboardData.detail || "Could not load admin dashboard.");
      }

      setAdminStats(dashboardData);
      setAdminCandidates(Array.isArray(candidatesData) ? candidatesData : []);
      setAdminResumes(Array.isArray(resumesData) ? resumesData : []);
    } catch (error) {
      console.error(error);
      setAdminError(error.message || "Could not load admin data.");
    } finally {
      setAdminLoading(false);
    }
  }

  useEffect(() => {
    loadAdminData();
  }, []);

  async function openCandidate(candidate) {
    setSelectedCandidate(candidate);
    setCandidateDetails(null);
    setDetailsLoading(true);

    try {
      const response = await apiFetch(`/admin/candidates/${candidate.id}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Could not load candidate.");
      }

      setCandidateDetails(data);
    } catch (error) {
      setAdminError(error.message);
    } finally {
      setDetailsLoading(false);
    }
  }

  async function deleteResume(resumeId) {
    try {
      const response = await apiFetch(`/admin/resumes/${resumeId}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Could not delete resume.");
      }

      setAdminResumes((prev) => prev.filter((item) => item.id !== resumeId));
      setAdminStats((prev) => ({
        ...prev,
        total_resumes: Math.max(0, prev.total_resumes - 1),
      }));

      setSuccess("Resume deleted successfully.");
    } catch (error) {
      setAdminError(error.message);
    } finally {
      setDeleteTarget(null);
    }
  }

  if (adminLoading) {
    return (
      <div className="page-content">
        <div className="admin-loading">
          <div className="admin-loading-spinner">AI</div>
          <h2>Loading Admin Panel</h2>
          <p>Verifying access and loading candidate data...</p>
        </div>
      </div>
    );
  }

  if (adminError) {
    return (
      <div className="page-content">
        <div className="admin-access-denied">
          <div className="admin-denied-icon">!</div>
          <span className="section-kicker">ACCESS RESTRICTED</span>
          <h1>Admin access required</h1>
          <p>{adminError}</p>
          <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
            <button className="secondary-button" onClick={() => navigate("dashboard")}>
              Return to Dashboard
            </button>
            <button className="primary-button" onClick={loadAdminData}>
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-content">
      <div className="admin-page-header">
        <div>
          <div className="eyebrow">ADMINISTRATION</div>
          <h1>Admin Dashboard</h1>
          <p>Manage candidates and review resumes uploaded to AI Job Hunter.</p>
        </div>
        <div className="admin-status">
          <span className="status-dot" />
          System operational
        </div>
      </div>

      <div className="admin-stat-grid">
        <div className="admin-stat-card">
          <span className="admin-stat-icon">◉</span>
          <div>
            <small>Candidate accounts</small>
            <strong>{adminStats.total_candidates}</strong>
          </div>
        </div>

        <div className="admin-stat-card">
          <span className="admin-stat-icon">CV</span>
          <div>
            <small>Saved resumes</small>
            <strong>{adminStats.total_resumes}</strong>
          </div>
        </div>

        <div className="admin-stat-card">
          <span className="admin-stat-icon">AI</span>
          <div>
            <small>AI extraction</small>
            <strong className="system-good">Active</strong>
          </div>
        </div>

        <div className="admin-stat-card">
          <span className="admin-stat-icon">DB</span>
          <div>
            <small>Database</small>
            <strong className="system-good">Connected</strong>
          </div>
        </div>
      </div>

      <div className="admin-tabs">
        <button
          className={adminTab === "overview" ? "active" : ""}
          onClick={() => setAdminTab("overview")}
        >
          Overview
        </button>
        <button
          className={adminTab === "candidates" ? "active" : ""}
          onClick={() => setAdminTab("candidates")}
        >
          Candidates
          <span>{adminCandidates.length}</span>
        </button>
        <button
          className={adminTab === "resumes" ? "active" : ""}
          onClick={() => setAdminTab("resumes")}
        >
          All Resumes
          <span>{adminResumes.length}</span>
        </button>
      </div>

      {adminTab === "overview" && (
        <div className="admin-overview-grid">
          <div className="admin-panel-card">
            <div className="admin-panel-header">
              <div>
                <span className="section-kicker">RECENT ACTIVITY</span>
                <h3>Recent Resume Profiles</h3>
              </div>
              <button className="text-button" onClick={() => setAdminTab("resumes")}>
                View all →
              </button>
            </div>

            {adminResumes.length === 0 ? (
              <div className="admin-empty">No resumes have been saved yet.</div>
            ) : (
              <div className="admin-resume-list">
                {adminResumes.slice(0, 6).map((resume) => (
                  <div className="admin-resume-row" key={resume.id}>
                    <div className="admin-file-icon">CV</div>
                    <div className="admin-resume-main">
                      <strong>{resume.candidate_name || resume.name || "Candidate"}</strong>
                      <span>{resume.resume_filename || "Resume"}</span>
                    </div>
                    <div className="admin-resume-role">{resume.headline || "Profile"}</div>
                    <button
                      className="icon-danger-button"
                      title="Delete resume"
                      onClick={() =>
                        setDeleteTarget({
                          type: "admin",
                          id: resume.id,
                          title: resume.resume_filename || "this resume",
                        })
                      }
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="admin-panel-card">
            <div className="admin-panel-header">
              <div>
                <span className="section-kicker">SYSTEM</span>
                <h3>Platform overview</h3>
              </div>
            </div>

            <div className="admin-system-list">
              <div>
                <span>Candidate accounts</span>
                <strong>{adminStats.total_candidates}</strong>
              </div>
              <div>
                <span>Saved resume profiles</span>
                <strong>{adminStats.total_resumes}</strong>
              </div>
              <div>
                <span>AI extraction</span>
                <strong className="system-good">Active</strong>
              </div>
              <div>
                <span>Database</span>
                <strong className="system-good">Connected</strong>
              </div>
            </div>
          </div>
        </div>
      )}

      {adminTab === "candidates" && (
        <div className="admin-panel-card">
          <div className="admin-panel-header">
            <div>
              <span className="section-kicker">CANDIDATE MANAGEMENT</span>
              <h3>All Candidates</h3>
            </div>
            <span className="admin-result-count">{adminCandidates.length} accounts</span>
          </div>

          {adminCandidates.length === 0 ? (
            <div className="admin-empty">No candidates registered yet.</div>
          ) : (
            <div className="admin-table-wrapper">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Candidate</th>
                    <th>Email</th>
                    <th>Resumes</th>
                    <th>Account</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {adminCandidates.map((candidate) => (
                    <tr key={candidate.id}>
                      <td>
                        <div className="candidate-table-user">
                          <div className="candidate-table-avatar">
                            {(candidate.name || "C").charAt(0).toUpperCase()}
                          </div>
                          <strong>{candidate.name || "Candidate"}</strong>
                        </div>
                      </td>
                      <td>{candidate.email}</td>
                      <td>
                        <span className="table-count">{candidate.resume_count}</span>
                      </td>
                      <td>
                        <span className="account-badge">Candidate</span>
                      </td>
                      <td>
                        <button className="small-button" onClick={() => openCandidate(candidate)}>
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {adminTab === "resumes" && (
        <div className="admin-panel-card">
          <div className="admin-panel-header">
            <div>
              <span className="section-kicker">RESUME MANAGEMENT</span>
              <h3>All Saved Resumes</h3>
            </div>
            <span className="admin-result-count">{adminResumes.length} resumes</span>
          </div>

          {adminResumes.length === 0 ? (
            <div className="admin-empty">No saved resumes yet.</div>
          ) : (
            <div className="admin-resume-grid">
              {adminResumes.map((resume) => (
                <div className="admin-resume-card" key={resume.id}>
                  <div className="admin-resume-card-top">
                    <div className="admin-file-icon large">CV</div>
                    <span className="resume-id">#{resume.id}</span>
                  </div>

                  <h3>{resume.candidate_name || resume.name || "Candidate"}</h3>
                  <p className="admin-email">{resume.candidate_email || resume.email || "No email"}</p>

                  <div className="admin-resume-file">
                    <span>Resume</span>
                    <strong>{resume.resume_filename || "Uploaded resume"}</strong>
                  </div>

                  <div className="admin-card-section">
                    <span>Skills</span>
                    <div className="admin-mini-skills">
                      {safeArray(resume.skills).slice(0, 6).map((skill, index) => (
                        <span key={index}>{skill}</span>
                      ))}
                      {safeArray(resume.skills).length > 6 && (
                        <span>+{safeArray(resume.skills).length - 6}</span>
                      )}
                    </div>
                  </div>

                  <div className="admin-card-section">
                    <span>Target roles</span>
                    <p>
                      {safeArray(resume.preferred_roles).length > 0
                        ? safeArray(resume.preferred_roles).join(", ")
                        : "Not specified"}
                    </p>
                  </div>

                  <div className="admin-card-footer">
                    <span>Candidate ID: {resume.user_id}</span>
                    <button
                      className="delete-resume-button"
                      onClick={() =>
                        setDeleteTarget({
                          type: "admin",
                          id: resume.id,
                          title: resume.resume_filename || "this resume",
                        })
                      }
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {selectedCandidate && (
        <div className="modal-overlay" onClick={() => setSelectedCandidate(null)}>
          <div className="candidate-detail-modal" onClick={(e) => e.stopPropagation()}>
            <div className="candidate-detail-header">
              <div>
                <span className="section-kicker">CANDIDATE PROFILE</span>
                <h2>{candidateDetails?.name || selectedCandidate.name}</h2>
                <p>{candidateDetails?.email || selectedCandidate.email}</p>
              </div>
              <button className="modal-close" onClick={() => setSelectedCandidate(null)}>
                ×
              </button>
            </div>

            {detailsLoading ? (
              <div className="loading-card">
                <div className="spinner" />
                Loading candidate details...
              </div>
            ) : (
              <div>
                <div className="candidate-detail-stats">
                  <div>
                    <span>Resumes</span>
                    <strong>{safeArray(candidateDetails?.resumes).length}</strong>
                  </div>
                  <div>
                    <span>Account</span>
                    <strong>Candidate</strong>
                  </div>
                </div>

                <h3 style={{ marginBottom: "12px", fontSize: "14px", fontWeight: "700" }}>
                  Saved Resumes
                </h3>

                {safeArray(candidateDetails?.resumes).map((resume) => (
                  <div className="candidate-resume-detail" key={resume.id}>
                    <div>
                      <strong>{resume.resume_filename || "Resume"}</strong>
                      <span>{resume.headline || resume.name || "Profile"}</span>
                    </div>
                    <button
                      className="delete-resume-button"
                      onClick={() => {
                        setSelectedCandidate(null);
                        setDeleteTarget({
                          type: "admin",
                          id: resume.id,
                          title: resume.resume_filename || "this resume",
                        });
                      }}
                    >
                      Delete
                    </button>
                  </div>
                ))}

                {safeArray(candidateDetails?.resumes).length === 0 && (
                  <div className="admin-empty">No saved resumes for this candidate.</div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <ConfirmModal
        open={deleteTarget?.type === "admin"}
        title="Delete resume?"
        message={`This will permanently delete "${deleteTarget?.title || "this resume"}" and its saved profile from the system.`}
        confirmText="Delete Resume"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => deleteResume(deleteTarget.id)}
      />
    </div>
  );
}

function App() {
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem("user");
    try {
      return savedUser ? JSON.parse(savedUser) : null;
    } catch {
      return null;
    }
  });

  const [page, setPage] = useState("dashboard");
  const [profile, setProfile] = useState(null);
  const [resumes, setResumes] = useState([]);

  const [selectedFile, setSelectedFile] = useState(null);
  const [dragActive, setDragActive] = useState(false);

  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [loadingResumes, setLoadingResumes] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [expandedSections, setExpandedSections] = useState({
    personal: true,
    skills: true,
    education: false,
    experience: false,
    projects: false,
    preferences: true,
  });

  const [deleteTarget, setDeleteTarget] = useState(null);
  const fileInputRef = useRef(null);

  const completeness = useMemo(() => calculateCompleteness(profile), [profile]);

  const userRole =
    user?.role ||
    localStorage.getItem("role") ||
    localStorage.getItem("user_role") ||
    "candidate";

  useEffect(() => {
    if (!user) return;
    loadLatestProfile();
    loadResumeHistory();
  }, [user]);

  async function handleLogin(loggedInUser) {
    setUser(loggedInUser);
    localStorage.setItem("user", JSON.stringify(loggedInUser));
    localStorage.setItem("role", loggedInUser?.role || "candidate");
    localStorage.setItem("user_role", loggedInUser?.role || "candidate");
    setError("");
    setSuccess("");
    setPage("dashboard");
  }

  function logout() {
    localStorage.removeItem("access_token");
    localStorage.removeItem("token");
    localStorage.removeItem("jwt_token");
    localStorage.removeItem("user");
    localStorage.removeItem("role");
    localStorage.removeItem("user_role");
    setUser(null);
    setProfile(null);
    setResumes([]);
  }

  async function loadLatestProfile() {
    setLoadingProfile(true);
    try {
      const response = await apiFetch("/candidate/me");
      if (response.status === 404) {
        setProfile(null);
        return;
      }
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || "Could not load your profile.");
      }
      setProfile(normalizeProfile(data));
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingProfile(false);
    }
  }

  async function loadResumeHistory() {
    setLoadingResumes(true);
    try {
      const response = await apiFetch("/candidate/history");
      if (!response.ok) {
        throw new Error("Could not load your resumes.");
      }
      const data = await response.json();
      setResumes(Array.isArray(data) ? data.map(normalizeProfile) : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingResumes(false);
    }
  }

  function navigate(nextPage) {
    setError("");
    setSuccess("");
    setPage(nextPage);

    if (nextPage === "resumes") loadResumeHistory();
    if (nextPage === "dashboard") {
      loadLatestProfile();
      loadResumeHistory();
    }
    if (nextPage === "profile") loadLatestProfile();
  }

  function validateFile(file) {
    if (!file) return false;
    const allowedExtensions = [".pdf", ".doc", ".docx"];
    const extension = "." + file.name.split(".").pop().toLowerCase();

    if (!allowedExtensions.includes(extension)) {
      setError("Please upload a PDF, DOC or DOCX file.");
      return false;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("File size must be less than 10 MB.");
      return false;
    }
    return true;
  }

  function handleFileSelect(file) {
    setError("");
    setSuccess("");
    if (!validateFile(file)) return;
    setSelectedFile(file);
  }

  function handleFileInput(e) {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
    e.target.value = "";
  }

  function handleDragOver(e) {
    e.preventDefault();
    setDragActive(true);
  }

  function handleDragLeave(e) {
    e.preventDefault();
    setDragActive(false);
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileSelect(file);
  }

  async function analyzeResume() {
    if (!selectedFile) {
      setError("Please select a resume first.");
      return;
    }

    setUploading(true);
    setError("");
    setSuccess("");

    const formData = new FormData();
    formData.append("file", selectedFile);

    try {
      const response = await apiFetch("/resume/upload", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Resume analysis failed.");
      }

      setProfile(
        normalizeProfile({
          ...data.profile,
          resume_filename: data.filename || selectedFile.name,
          resume_storage_name: data.storage_filename || data.stored_filename || "",
        })
      );

      setSelectedFile(null);
      setSuccess("AI extraction completed. Review your profile before saving.");
      setPage("review");
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setUploading(false);
    }
  }

  /* Profile manipulation handlers */
  function updateProfileField(field, value) {
    setProfile((prev) => ({ ...(prev || {}), [field]: value }));
  }

  function updateArrayObject(arrayName, index, field, value) {
    setProfile((prev) => {
      const array = safeArray(prev?.[arrayName]).map((item, i) =>
        i === index ? { ...item, [field]: value } : item
      );
      return { ...prev, [arrayName]: array };
    });
  }

  function removeArrayItem(arrayName, index) {
    setProfile((prev) => ({
      ...prev,
      [arrayName]: safeArray(prev?.[arrayName]).filter((_, i) => i !== index),
    }));
  }

  function addSkill() {
    setProfile((prev) => ({
      ...prev,
      skills: [...safeArray(prev?.skills), ""],
    }));
  }

  function updateSkill(index, value) {
    setProfile((prev) => {
      const skills = [...safeArray(prev?.skills)];
      skills[index] = value;
      return { ...prev, skills };
    });
  }

  function removeSkill(index) {
    removeArrayItem("skills", index);
  }

  function addEducation() {
    setProfile((prev) => ({
      ...prev,
      education: [
        ...safeArray(prev?.education),
        { degree: "", institution: "", year: "", details: "" },
      ],
    }));
  }

  function addExperience() {
    setProfile((prev) => ({
      ...prev,
      experience: [
        ...safeArray(prev?.experience),
        { company: "", role: "", duration: "", description: "" },
      ],
    }));
  }

  function addProject() {
    setProfile((prev) => ({
      ...prev,
      projects: [
        ...safeArray(prev?.projects),
        { name: "", technologies: [], description: "" },
      ],
    }));
  }

  function addRole() {
    setProfile((prev) => ({
      ...prev,
      preferred_roles: [...safeArray(prev?.preferred_roles), ""],
    }));
  }

  function addLocation() {
    setProfile((prev) => ({
      ...prev,
      preferred_locations: [...safeArray(prev?.preferred_locations), ""],
    }));
  }

  async function saveProfile() {
    if (!profile) {
      setError("There is no profile to save.");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const isExisting = Boolean(profile.id);
      const endpoint = isExisting ? `/candidate/${profile.id}` : "/candidate";
      const method = isExisting ? "PUT" : "POST";

      const payload = {
        resume_filename: profile.resume_filename || "",
        resume_storage_name: profile.resume_storage_name || "",
        name: profile.name || "",
        email: profile.email || "",
        phone: profile.phone || "",
        headline: profile.headline || "",
        skills: safeArray(profile.skills).map((x) => String(x).trim()).filter(Boolean),
        education: safeArray(profile.education),
        experience: safeArray(profile.experience),
        projects: safeArray(profile.projects),
        certifications: safeArray(profile.certifications),
        preferred_roles: safeArray(profile.preferred_roles).map((x) => String(x).trim()).filter(Boolean),
        preferred_locations: safeArray(profile.preferred_locations).map((x) => String(x).trim()).filter(Boolean),
      };

      const response = await apiFetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Could not save profile.");
      }

      const savedCandidate = data.candidate || data;
      setProfile(normalizeProfile(savedCandidate));
      await loadResumeHistory();

      setSuccess("Resume profile saved successfully.");
      setPage("resumes");
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function deleteCandidateResume(resumeId) {
    try {
      const response = await apiFetch(`/candidate/resume/${resumeId}`, {
        method: "DELETE",
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Could not delete resume.");
      }

      setResumes((prev) => prev.filter((item) => item.id !== resumeId));
      if (profile?.id === resumeId) {
        setProfile(null);
        await loadLatestProfile();
      }

      setSuccess("Resume deleted successfully.");
    } catch (err) {
      setError(err.message);
    } finally {
      setDeleteTarget(null);
    }
  }

  function toggleSection(section) {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  }

  function searchSimilarJobs() {
    setError("");
    setSuccess("");
    if (!profile) {
      setError("Please save your resume profile first.");
      return;
    }
    setPage("job-matching");
  }

  function Dashboard() {
    const skills = safeArray(profile?.skills);
    const roles = safeArray(profile?.preferred_roles);

    return (
      <div className="page-content">
        <div className="page-heading">
          <div>
            <div className="eyebrow">CANDIDATE DASHBOARD</div>
            <h1>Welcome back, {user?.name || profile?.name || "Candidate"}</h1>
            <p>Build your AI-ready career profile and discover tailored high-growth opportunities.</p>
          </div>
          <button className="primary-button" onClick={() => navigate("upload")}>
            + Upload Resume
          </button>
        </div>

        {success && <div className="success-banner"><span>✓</span>{success}</div>}
        {error && <div className="error-banner"><span>!</span>{error}</div>}

        <div className="dashboard-grid">
          <div className="profile-overview-card">
            <div className="profile-card-top">
              <div className="avatar-large">
                {(profile?.name || user?.name || "C").charAt(0).toUpperCase()}
              </div>
              <div>
                <span className="section-kicker">YOUR PROFILE</span>
                <h2>{profile?.name || user?.name || "Complete your profile"}</h2>
                <p>{profile?.headline || "Upload a resume to initialize your AI career profile."}</p>
              </div>
            </div>

            <div className="completeness">
              <div className="completeness-head">
                <span>Profile completeness</span>
                <strong>{completeness}%</strong>
              </div>
              <div className="progress-track">
                <div className="progress-value" style={{ width: `${completeness}%` }} />
              </div>
            </div>

            <div className="profile-actions">
              <button className="secondary-button" onClick={() => navigate("profile")}>
                Edit Profile
              </button>
              <button className="primary-button" onClick={searchSimilarJobs}>
                Find Similar Jobs →
              </button>
            </div>
          </div>

          <div className="job-search-card">
            <div className="job-search-orb">✦</div>
            <span className="section-kicker">AI CAREER MATCHING</span>
            <h2>Find jobs that fit you.</h2>
            <p>We'll match your verified skills, experience, and target roles against high-impact engineering opportunities.</p>
            <button className="dark-button" onClick={searchSimilarJobs}>
              Search Similar Jobs <span>→</span>
            </button>
          </div>
        </div>

        <div className="stats-grid">
          <div className="stat-card">
            <span>Saved resumes</span>
            <strong>{resumes.length}</strong>
            <small>Profile versions</small>
          </div>
          <div className="stat-card">
            <span>Skills</span>
            <strong>{skills.length}</strong>
            <small>Extracted skills</small>
          </div>
          <div className="stat-card">
            <span>Target roles</span>
            <strong>{roles.length}</strong>
            <small>Career preferences</small>
          </div>
          <div className="stat-card">
            <span>AI profile</span>
            <strong>{profile ? "Ready" : "—"}</strong>
            <small>Extraction status</small>
          </div>
        </div>

        <div className="dashboard-lower-grid">
          <div className="content-card">
            <div className="card-header">
              <div>
                <span className="section-kicker">SKILLS</span>
                <h3>Your skill set</h3>
              </div>
              <button className="text-button" onClick={() => navigate("profile")}>
                Edit →
              </button>
            </div>

            {skills.length ? (
              <div className="skill-cloud">
                {skills.slice(0, 15).map((skill, index) => (
                  <span key={index}>{skill}</span>
                ))}
              </div>
            ) : (
              <div className="empty-state-small">Upload a resume to extract your skills.</div>
            )}
          </div>

          <div className="content-card">
            <div className="card-header">
              <div>
                <span className="section-kicker">CAREER TARGET</span>
                <h3>Preferred roles</h3>
              </div>
            </div>

            {roles.length ? (
              <div className="role-list">
                {roles.map((role, index) => (
                  <div className="role-row" key={index}>
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <strong>{role}</strong>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state-small">No target roles added yet.</div>
            )}
          </div>
        </div>

        <div className="content-card recent-card">
          <div className="card-header">
            <div>
              <span className="section-kicker">RECENT</span>
              <h3>Recent resume profiles</h3>
            </div>
            <button className="text-button" onClick={() => navigate("resumes")}>
              View all →
            </button>
          </div>

          {resumes.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">CV</div>
              <h3>No saved resumes yet</h3>
              <p>Upload your resume to create your first AI career profile.</p>
              <button className="primary-button" onClick={() => navigate("upload")}>
                Upload Resume
              </button>
            </div>
          ) : (
            <div className="recent-resume-list">
              {resumes.slice(0, 4).map((item) => (
                <div className="recent-resume-row" key={item.id}>
                  <div className="file-icon">CV</div>
                  <div>
                    <strong>{item.resume_filename || "Resume"}</strong>
                    <span>{item.headline || item.name || "Profile"}</span>
                  </div>
                  <button
                    className="small-button"
                    onClick={() => {
                      setProfile(normalizeProfile(item));
                      navigate("profile");
                    }}
                  >
                    View
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  function UploadPage() {
    return (
      <div className="page-content narrow-page">
        <div className="page-heading">
          <div>
            <div className="eyebrow">AI RESUME ANALYSIS</div>
            <h1>Upload your resume</h1>
            <p>Our intelligent parser extracts your experience, education, skills, and projects automatically.</p>
          </div>
        </div>

        {error && <div className="error-banner"><span>!</span>{error}</div>}
        {success && <div className="success-banner"><span>✓</span>{success}</div>}

        <div className="upload-workspace">
          <div
            className={`drop-zone ${dragActive ? "drag-active" : ""} ${selectedFile ? "has-file" : ""}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              hidden
              accept=".pdf,.doc,.docx"
              onChange={handleFileInput}
            />

            {!selectedFile ? (
              <>
                <div className="upload-icon">↑</div>
                <h2>Drop your resume here</h2>
                <p>or click to browse files from your computer</p>
                <span className="upload-hint">Supports PDF, DOC, DOCX · Max 10 MB</span>
              </>
            ) : (
              <>
                <div className="selected-file-icon">CV</div>
                <h2>{selectedFile.name}</h2>
                <p>{(selectedFile.size / 1024 / 1024).toFixed(2)} MB · Ready for AI analysis</p>
                <button
                  className="small-button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedFile(null);
                  }}
                >
                  Remove
                </button>
              </>
            )}
          </div>

          <div className="analysis-side-card">
            <span className="section-kicker">WHAT HAPPENS NEXT</span>
            <h3>AI-powered extraction</h3>

            <div className="analysis-step">
              <span>01</span>
              <div>
                <strong>Read resume</strong>
                <small>Extract text structure and headings</small>
              </div>
            </div>

            <div className="analysis-step">
              <span>02</span>
              <div>
                <strong>Analyze profile</strong>
                <small>Identify skills, metrics, and milestones</small>
              </div>
            </div>

            <div className="analysis-step">
              <span>03</span>
              <div>
                <strong>Review & edit</strong>
                <small>You inspect and approve every attribute</small>
              </div>
            </div>

            <div className="analysis-step">
              <span>04</span>
              <div>
                <strong>Save profile</strong>
                <small>Stored securely for intelligent matching</small>
              </div>
            </div>
          </div>
        </div>

        <div className="upload-footer">
          <button className="secondary-button" onClick={() => navigate("dashboard")}>
            Cancel
          </button>
          <button
            className="primary-button"
            disabled={!selectedFile || uploading}
            onClick={analyzeResume}
          >
            {uploading ? "Analyzing resume..." : "Analyze Resume →"}
          </button>
        </div>
      </div>
    );
  }

  function ReviewPage() {
    if (!profile) {
      return (
        <div className="page-content">
          <div className="empty-state">
            <h2>No profile to review</h2>
            <button className="primary-button" onClick={() => navigate("upload")}>
              Upload Resume
            </button>
          </div>
        </div>
      );
    }

    const education = safeArray(profile.education);
    const experience = safeArray(profile.experience);
    const projects = safeArray(profile.projects);
    const skills = safeArray(profile.skills);
    const roles = safeArray(profile.preferred_roles);
    const locations = safeArray(profile.preferred_locations);

    return (
      <div className="page-content review-page">
        <div className="review-top">
          <div>
            <div className="eyebrow">AI EXTRACTION COMPLETE</div>
            <h1>Review your profile</h1>
            <p>We've structured your information below. Review and adjust any section before saving.</p>
          </div>

          <div className="review-progress">
            <div className="review-progress-circle">{completeness}%</div>
            <div>
              <strong>Profile ready</strong>
              <span>{completeness >= 80 ? "Excellent profile coverage" : "Add missing details for higher match score"}</span>
            </div>
          </div>
        </div>

        {error && <div className="error-banner"><span>!</span>{error}</div>}
        {success && <div className="success-banner"><span>✓</span>{success}</div>}

        <div className="review-layout">
          <main className="review-main">
            <EditorSection
              title="Personal information"
              subtitle="Basic identity and professional headline"
              number="01"
              open={expandedSections.personal}
              onToggle={() => toggleSection("personal")}
            >
              <div className="form-grid">
                <Field
                  label="Full name"
                  value={profile.name || ""}
                  onChange={(val) => updateProfileField("name", val)}
                />
                <Field
                  label="Email"
                  value={profile.email || ""}
                  onChange={(val) => updateProfileField("email", val)}
                />
                <Field
                  label="Phone"
                  value={profile.phone || ""}
                  onChange={(val) => updateProfileField("phone", val)}
                />
                <Field
                  label="Professional headline"
                  value={profile.headline || ""}
                  wide
                  onChange={(val) => updateProfileField("headline", val)}
                />
              </div>
            </EditorSection>

            <EditorSection
              title="Skills"
              subtitle={`${skills.length} skills detected`}
              number="02"
              open={expandedSections.skills}
              onToggle={() => toggleSection("skills")}
              action={
                <button className="add-button" onClick={addSkill}>
                  + Add skill
                </button>
              }
            >
              <div className="editable-chip-grid">
                {skills.map((skill, index) => (
                  <div className="editable-chip" key={index}>
                    <input
                      value={skill}
                      placeholder="Skill"
                      onChange={(e) => updateSkill(index, e.target.value)}
                    />
                    <button onClick={() => removeSkill(index)}>×</button>
                  </div>
                ))}
                {skills.length === 0 && (
                  <div className="inline-empty">No skills detected. Add one manually.</div>
                )}
              </div>
            </EditorSection>

            <EditorSection
              title="Education"
              subtitle={`${education.length} entries`}
              number="03"
              open={expandedSections.education}
              onToggle={() => toggleSection("education")}
              action={
                <button className="add-button" onClick={addEducation}>
                  + Add education
                </button>
              }
            >
              <div className="editor-list">
                {education.map((item, index) => (
                  <div className="nested-editor" key={index}>
                    <div className="nested-editor-head">
                      <span>Education {index + 1}</span>
                      <button className="remove-button" onClick={() => removeArrayItem("education", index)}>
                        Remove
                      </button>
                    </div>

                    <div className="form-grid">
                      <Field
                        label="Degree"
                        value={item.degree || ""}
                        onChange={(val) => updateArrayObject("education", index, "degree", val)}
                      />
                      <Field
                        label="Institution"
                        value={item.institution || ""}
                        onChange={(val) => updateArrayObject("education", index, "institution", val)}
                      />
                      <Field
                        label="Year"
                        value={item.year || ""}
                        onChange={(val) => updateArrayObject("education", index, "year", val)}
                      />
                      <Field
                        label="Details"
                        value={item.details || ""}
                        wide
                        textarea
                        onChange={(val) => updateArrayObject("education", index, "details", val)}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </EditorSection>

            <EditorSection
              title="Experience"
              subtitle={`${experience.length} entries`}
              number="04"
              open={expandedSections.experience}
              onToggle={() => toggleSection("experience")}
              action={
                <button className="add-button" onClick={addExperience}>
                  + Add experience
                </button>
              }
            >
              <div className="editor-list">
                {experience.map((item, index) => (
                  <div className="nested-editor" key={index}>
                    <div className="nested-editor-head">
                      <span>Experience {index + 1}</span>
                      <button className="remove-button" onClick={() => removeArrayItem("experience", index)}>
                        Remove
                      </button>
                    </div>

                    <div className="form-grid">
                      <Field
                        label="Company"
                        value={item.company || ""}
                        onChange={(val) => updateArrayObject("experience", index, "company", val)}
                      />
                      <Field
                        label="Role"
                        value={item.role || ""}
                        onChange={(val) => updateArrayObject("experience", index, "role", val)}
                      />
                      <Field
                        label="Duration"
                        value={item.duration || ""}
                        onChange={(val) => updateArrayObject("experience", index, "duration", val)}
                      />
                      <Field
                        label="Description"
                        value={item.description || ""}
                        wide
                        textarea
                        onChange={(val) => updateArrayObject("experience", index, "description", val)}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </EditorSection>

            <EditorSection
              title="Projects"
              subtitle={`${projects.length} projects`}
              number="05"
              open={expandedSections.projects}
              onToggle={() => toggleSection("projects")}
              action={
                <button className="add-button" onClick={addProject}>
                  + Add project
                </button>
              }
            >
              <div className="editor-list">
                {projects.map((item, index) => (
                  <div className="nested-editor" key={index}>
                    <div className="nested-editor-head">
                      <span>Project {index + 1}</span>
                      <button className="remove-button" onClick={() => removeArrayItem("projects", index)}>
                        Remove
                      </button>
                    </div>

                    <div className="form-grid">
                      <Field
                        label="Project name"
                        value={item.name || ""}
                        onChange={(val) => updateArrayObject("projects", index, "name", val)}
                      />
                      <Field
                        label="Technologies"
                        value={safeArray(item.technologies).join(", ")}
                        onChange={(val) =>
                          updateArrayObject(
                            "projects",
                            index,
                            "technologies",
                            val.split(",").map((x) => x.trim()).filter(Boolean)
                          )
                        }
                      />
                      <Field
                        label="Description"
                        value={item.description || ""}
                        wide
                        textarea
                        onChange={(val) => updateArrayObject("projects", index, "description", val)}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </EditorSection>

            <EditorSection
              title="Career preferences"
              subtitle="Guide matching by desired roles and locations"
              number="06"
              open={expandedSections.preferences}
              onToggle={() => toggleSection("preferences")}
            >
              <div className="preference-columns">
                <div>
                  <div className="preference-head">
                    <label>Preferred roles</label>
                    <button className="add-button" onClick={addRole}>+ Add</button>
                  </div>
                  {roles.map((role, index) => (
                    <div className="inline-edit-row" key={index}>
                      <input
                        value={role}
                        onChange={(e) =>
                          updateProfileField(
                            "preferred_roles",
                            roles.map((item, i) => (i === index ? e.target.value : item))
                          )
                        }
                      />
                      <button onClick={() => removeArrayItem("preferred_roles", index)}>×</button>
                    </div>
                  ))}
                  {roles.length === 0 && <div className="inline-empty">No preferred roles yet.</div>}
                </div>

                <div>
                  <div className="preference-head">
                    <label>Preferred locations</label>
                    <button className="add-button" onClick={addLocation}>+ Add</button>
                  </div>
                  {locations.map((loc, index) => (
                    <div className="inline-edit-row" key={index}>
                      <input
                        value={loc}
                        onChange={(e) =>
                          updateProfileField(
                            "preferred_locations",
                            locations.map((item, i) => (i === index ? e.target.value : item))
                          )
                        }
                      />
                      <button onClick={() => removeArrayItem("preferred_locations", index)}>×</button>
                    </div>
                  ))}
                  {locations.length === 0 && <div className="inline-empty">No preferred locations yet.</div>}
                </div>
              </div>
            </EditorSection>
          </main>

          <aside className="review-sidebar">
            <div className="sticky-card">
              <span className="section-kicker">RESUME PROFILE</span>
              <div className="resume-preview">
                <div className="file-icon large">CV</div>
                <div>
                  <strong>{profile.resume_filename || "Resume"}</strong>
                  <span>AI Analyzed</span>
                </div>
              </div>

              <div className="sidebar-divider" />

              <div className="review-checklist">
                <ChecklistItem
                  label="Personal information"
                  done={Boolean(profile.name) && Boolean(profile.email)}
                />
                <ChecklistItem label="Skills" done={skills.length > 0} />
                <ChecklistItem label="Education" done={education.length > 0} />
                <ChecklistItem label="Experience" done={experience.length > 0} />
                <ChecklistItem label="Projects" done={projects.length > 0} />
                <ChecklistItem label="Career preferences" done={roles.length > 0} />
              </div>

              <button className="primary-button full-button" onClick={saveProfile} disabled={saving}>
                {saving ? "Saving profile..." : "Save Profile →"}
              </button>

              <button className="secondary-button full-button" onClick={() => navigate("upload")}>
                Upload Different Resume
              </button>
            </div>
          </aside>
        </div>
      </div>
    );
  }

  function ResumeHistoryPage() {
    return (
      <div className="page-content">
        <div className="page-heading">
          <div>
            <div className="eyebrow">MY RESUMES</div>
            <h1>Uploaded resumes</h1>
            <p>Every saved resume profile is isolated to your secure candidate account.</p>
          </div>
          <button className="primary-button" onClick={() => navigate("upload")}>
            + Upload New Resume
          </button>
        </div>

        {success && <div className="success-banner"><span>✓</span>{success}</div>}
        {error && <div className="error-banner"><span>!</span>{error}</div>}

        {loadingResumes ? (
          <div className="loading-card">
            <div className="spinner" />
            Loading your resumes...
          </div>
        ) : resumes.length === 0 ? (
          <div className="empty-state large-empty">
            <div className="empty-icon">CV</div>
            <h2>Your resume library is empty</h2>
            <p>Upload a resume and save the extracted profile to see it here.</p>
            <button className="primary-button" onClick={() => navigate("upload")}>
              Upload Resume
            </button>
          </div>
        ) : (
          <div className="resume-library-grid">
            {resumes.map((item, index) => (
              <div className="resume-library-card" key={item.id}>
                <div className="resume-card-top">
                  <div className="file-icon large">CV</div>
                  <span className="resume-number">#{String(index + 1).padStart(2, "0")}</span>
                </div>

                <h2>{item.resume_filename || "Uploaded Resume"}</h2>
                <p className="resume-card-name">{item.name || "Candidate"}</p>

                <div className="resume-meta">
                  <span>{safeArray(item.skills).length} skills</span>
                  <span>{safeArray(item.experience).length} experience</span>
                  <span>{safeArray(item.projects).length} projects</span>
                </div>

                <div className="mini-skill-cloud">
                  {safeArray(item.skills).slice(0, 5).map((skill, i) => (
                    <span key={i}>{skill}</span>
                  ))}
                </div>

                <div className="resume-card-actions">
                  <button
                    className="secondary-button"
                    onClick={() => {
                      setProfile(normalizeProfile(item));
                      setPage("profile");
                    }}
                  >
                    View / Edit
                  </button>
                  <button
                    className="delete-resume-button"
                    onClick={() =>
                      setDeleteTarget({
                        type: "candidate",
                        id: item.id,
                        title: item.resume_filename || "this resume",
                      })
                    }
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <ConfirmModal
          open={deleteTarget?.type === "candidate"}
          title="Delete this resume?"
          message={`"${deleteTarget?.title || "This resume"}" will be permanently removed from your resume library.`}
          confirmText="Delete Resume"
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => deleteCandidateResume(deleteTarget.id)}
        />
      </div>
    );
  }

  function ProfilePage() {
    if (loadingProfile) {
      return (
        <div className="page-content">
          <div className="loading-card">
            <div className="spinner" />
            Loading your profile...
          </div>
        </div>
      );
    }

    if (!profile) {
      return (
        <div className="page-content">
          <div className="empty-state large-empty">
            <div className="empty-icon">+</div>
            <h2>Create your profile</h2>
            <p>Upload a resume to generate your AI profile.</p>
            <button className="primary-button" onClick={() => navigate("upload")}>
              Upload Resume
            </button>
          </div>
        </div>
      );
    }

    const skills = safeArray(profile.skills);
    const education = safeArray(profile.education);
    const experience = safeArray(profile.experience);
    const projects = safeArray(profile.projects);

    return (
      <div className="page-content">
        <div className="page-heading">
          <div>
            <div className="eyebrow">MY PROFILE</div>
            <h1>{profile.name || "Your profile"}</h1>
            <p>{profile.headline || "Professional profile"}</p>
          </div>
          <button className="primary-button" onClick={() => setPage("review")}>
            Edit Profile →
          </button>
        </div>

        <div className="profile-detail-grid">
          <div className="profile-detail-card">
            <div className="profile-detail-header">
              <div className="avatar-xl">
                {(profile.name || "C").charAt(0).toUpperCase()}
              </div>
              <div>
                <span className="section-kicker">PROFESSIONAL PROFILE</span>
                <h2>{profile.name || "Candidate"}</h2>
                <p>{profile.headline || "Professional"}</p>
              </div>
            </div>

            <div className="profile-contact-grid">
              <div>
                <span>Email</span>
                <strong>{profile.email || "Not provided"}</strong>
              </div>
              <div>
                <span>Phone</span>
                <strong>{profile.phone || "Not provided"}</strong>
              </div>
            </div>

            <div>
              <span className="section-kicker">SKILLS</span>
              {skills.length ? (
                <div className="skill-cloud">
                  {skills.map((skill, index) => (
                    <span key={index}>{skill}</span>
                  ))}
                </div>
              ) : (
                <p style={{ fontSize: "13px", color: "var(--text-secondary)" }}>No skills added.</p>
              )}
            </div>
          </div>

          <div className="profile-detail-card">
            <span className="section-kicker">PROFILE HEALTH</span>
            <div className="profile-health-score">
              <strong>{completeness}%</strong>
              <span>Complete</span>
            </div>

            <div className="progress-track">
              <div className="progress-value" style={{ width: `${completeness}%` }} />
            </div>

            <div className="health-list">
              <ChecklistItem
                label="Personal information"
                done={Boolean(profile.name) && Boolean(profile.email)}
              />
              <ChecklistItem label="Skills" done={skills.length > 0} />
              <ChecklistItem label="Education" done={education.length > 0} />
              <ChecklistItem label="Experience" done={experience.length > 0} />
              <ChecklistItem label="Projects" done={projects.length > 0} />
            </div>
          </div>
        </div>

        <div className="profile-detail-grid">
          <div className="profile-detail-card">
            <div className="card-header">
              <div>
                <span className="section-kicker">EDUCATION</span>
                <h3>Education history</h3>
              </div>
            </div>

            {education.length ? (
              <div className="timeline-list">
                {education.map((item, index) => (
                  <div className="timeline-item" key={index}>
                    <div className="timeline-dot" />
                    <div>
                      <strong>{item.degree || "Degree"}</strong>
                      <span>{item.institution || "Institution"}</span>
                      <small>{item.year || ""}</small>
                      {item.details && <p>{item.details}</p>}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state-small">No education added.</div>
            )}
          </div>

          <div className="profile-detail-card">
            <div className="card-header">
              <div>
                <span className="section-kicker">EXPERIENCE</span>
                <h3>Work experience</h3>
              </div>
            </div>

            {experience.length ? (
              <div className="timeline-list">
                {experience.map((item, index) => (
                  <div className="timeline-item" key={index}>
                    <div className="timeline-dot" />
                    <div>
                      <strong>{item.role || "Role"}</strong>
                      <span>{item.company || "Company"}</span>
                      <small>{item.duration || ""}</small>
                      {item.description && <p>{item.description}</p>}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state-small">No experience added.</div>
            )}
          </div>
        </div>

        <div className="profile-detail-card">
          <div className="card-header">
            <div>
              <span className="section-kicker">PROJECTS</span>
              <h3>Featured projects</h3>
            </div>
          </div>

          {projects.length ? (
            <div className="project-detail-grid">
              {projects.map((proj, index) => (
                <div className="project-detail-card" key={index}>
                  <div className="project-index">{String(index + 1).padStart(2, "0")}</div>
                  <h3>{proj.name || "Project"}</h3>
                  <div className="mini-skill-cloud">
                    {safeArray(proj.technologies).map((tech, i) => (
                      <span key={i}>{tech}</span>
                    ))}
                  </div>
                  <p>{proj.description || "No description provided."}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state-small">No projects added.</div>
          )}
        </div>
      </div>
    );
  }

  /* Page Router */
  function renderPage() {
    switch (page) {
      case "upload":
        return <UploadPage />;
      case "review":
        return <ReviewPage />;
      case "resumes":
        return <ResumeHistoryPage />;
      case "profile":
        return <ProfilePage />;
      case "job-matching":
        return <JobMatching />;
      case "admin":
        if (userRole !== "admin") {
          return (
            <div className="page-content">
              <div className="admin-access-denied">
                <div className="admin-denied-icon">!</div>
                <span className="section-kicker">ACCESS RESTRICTED</span>
                <h1>Admin access required</h1>
                <p>This area is restricted to administrator accounts.</p>
                <button className="primary-button" onClick={() => navigate("dashboard")}>
                  Return to Dashboard
                </button>
              </div>
            </div>
          );
        }
        return (
          <AdminPage
            apiFetch={apiFetch}
            navigate={navigate}
            setSuccess={setSuccess}
            setError={setError}
            deleteTarget={deleteTarget}
            setDeleteTarget={setDeleteTarget}
          />
        );
      case "dashboard":
      default:
        return <Dashboard />;
    }
  }

  /* Unauthenticated Guard */
  if (!user) {
    return <Auth onLogin={handleLogin} />;
  }

  return (
    <div className="app-shell">
      {/* Persistent Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="brand-mark">AI</div>
          <div>
            <strong>AI Job Hunter</strong>
            <span>Career Intelligence</span>
          </div>
        </div>

        <div className="sidebar-user">
          <div className="sidebar-avatar">
            {(user.name || profile?.name || "C").charAt(0).toUpperCase()}
          </div>
          <div>
            <strong>{user.name || profile?.name || "Candidate"}</strong>
            <span>{userRole === "admin" ? "Administrator" : "Candidate"}</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-label">WORKSPACE</div>

          <button
            className={`nav-item ${page === "dashboard" ? "active" : ""}`}
            onClick={() => navigate("dashboard")}
          >
            <span className="nav-icon">◫</span>
            <span className="nav-text">Dashboard</span>
          </button>

          <button
            className={`nav-item ${page === "upload" ? "active" : ""}`}
            onClick={() => navigate("upload")}
          >
            <span className="nav-icon">↑</span>
            <span className="nav-text">Upload Resume</span>
          </button>

          <button
            className={`nav-item ${page === "resumes" ? "active" : ""}`}
            onClick={() => navigate("resumes")}
          >
            <span className="nav-icon">CV</span>
            <span className="nav-text">Uploaded Resumes</span>
            {resumes.length > 0 && <span className="nav-count">{resumes.length}</span>}
          </button>

          <button
            className={`nav-item ${page === "profile" || page === "review" ? "active" : ""}`}
            onClick={() => navigate("profile")}
          >
            <span className="nav-icon">◉</span>
            <span className="nav-text">My Profile</span>
          </button>

          <button
            className={`nav-item ${page === "job-matching" ? "active" : ""}`}
            onClick={() => navigate("job-matching")}
          >
            <span className="nav-icon">✦</span>
            <span className="nav-text">AI Job Matching</span>
          </button>

          {userRole === "admin" && (
            <>
              <div className="nav-label admin-nav-label">ADMINISTRATION</div>
              <button
                className={`nav-item admin-nav-item ${page === "admin" ? "active" : ""}`}
                onClick={() => navigate("admin")}
              >
                <span className="nav-icon">⚙</span>
                <span className="nav-text">Admin Panel</span>
              </button>
            </>
          )}
        </nav>

        <div className="sidebar-bottom">
          <div className="sidebar-ai-card">
            <div className="sidebar-ai-icon">✦</div>
            <div>
              <strong>AI Matching</strong>
              <span>System active</span>
            </div>
          </div>

          <button className="logout-button" onClick={logout}>
            <span>↪</span>
            <span>Sign out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="main-area">
        <header className="topbar">
          <div className="topbar-breadcrumb">
            <span>AI Job Hunter</span>
            <span>/</span>
            <strong>
              {page === "dashboard"
                ? "Dashboard"
                : page === "upload"
                ? "Upload Resume"
                : page === "review"
                ? "Review Profile"
                : page === "resumes"
                ? "Uploaded Resumes"
                : page === "profile"
                ? "My Profile"
                : page === "job-matching"
                ? "AI Job Matching"
                : "Admin Panel"}
            </strong>
          </div>

          <div className="topbar-actions">
            <div className="ai-status-pill">
              <span className="status-dot" />
              AI System Online
            </div>
            <div className="topbar-avatar" onClick={() => navigate("profile")}>
              {(user.name || "C").charAt(0).toUpperCase()}
            </div>
          </div>
        </header>

        {renderPage()}
      </main>

      {/* Global Fallback Candidate Delete Modal */}
      <ConfirmModal
        open={deleteTarget?.type === "candidate" && page !== "resumes"}
        title="Delete this resume?"
        message={`"${deleteTarget?.title || "This resume"}" will be permanently removed from your resume library.`}
        confirmText="Delete Resume"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => deleteCandidateResume(deleteTarget.id)}
      />
    </div>
  );
}

export default App;