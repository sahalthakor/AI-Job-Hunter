import { useCallback, useEffect, useState } from "react";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  "http://127.0.0.1:8000";

async function apiRequest(endpoint, options = {}) {
  const token = localStorage.getItem("access_token");

  const response = await fetch(
    `${API_BASE_URL}${endpoint}`,
    {
      ...options,
      headers: {
        ...(options.headers || {}),
        ...(token
          ? {
              Authorization: `Bearer ${token}`,
            }
          : {}),
      },
    }
  );

  if (response.status === 401) {
    localStorage.removeItem("access_token");
    localStorage.removeItem("user");
    localStorage.removeItem("role");
    localStorage.removeItem("user_role");
    window.location.reload();
  }

  return response;
}

function getMatchLabel(score) {
  if (score >= 90) return "Exceptional Match";
  if (score >= 80) return "Excellent Match";
  if (score >= 70) return "Strong Match";
  if (score >= 60) return "Good Match";
  return "Potential Match";
}

function getMatchClass(score) {
  if (score >= 80) return "excellent";
  if (score >= 60) return "good";
  return "average";
}

export default function JobMatching() {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");
  const [searched, setSearched] = useState(false);
  const [searchSummary, setSearchSummary] = useState(null);

  const runJobSearch = useCallback(async () => {
    setSearching(true);
    setError("");

    try {
      /*
       * Step 1:
       * Ask the backend to read the candidate profile,
       * search Adzuna and import new jobs.
       */
      const searchResponse = await apiRequest(
        "/candidate-jobs/search",
        {
          method: "POST",
        }
      );

      const searchData =
        await searchResponse.json().catch(() => ({}));

      if (!searchResponse.ok) {
        throw new Error(
          searchData.detail ||
            "Could not search for jobs using your profile."
        );
      }

      setSearchSummary(searchData.result || searchData);

      /*
       * Step 2:
       * Ask the backend for the highest AI matches.
       */
      const matchResponse = await apiRequest(
        "/top-matches?limit=10"
      );

      const matchData =
        await matchResponse.json().catch(() => ({}));

      if (!matchResponse.ok) {
        throw new Error(
          matchData.detail ||
            "Could not generate AI job matches."
        );
      }

      setMatches(
        Array.isArray(matchData.matches)
          ? matchData.matches
          : []
      );

      setSearched(true);
    } catch (err) {
      console.error(err);

      setError(
        err.message ||
          "Something went wrong while finding jobs."
      );
    } finally {
      setLoading(false);
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    runJobSearch();
  }, [runJobSearch]);

  if (loading || searching) {
    return (
      <div className="job-matching-page">
        <div className="job-match-loading">
          <div className="job-match-spinner" />

          <span className="eyebrow">
            AI JOB DISCOVERY
          </span>

          <h2>
            Finding your best opportunities
          </h2>

          <p>
            We're searching jobs based on your saved
            roles and location preferences, then using
            AI to rank the strongest matches.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="job-matching-page">

      {/* ==================================================
          HEADER
         ================================================== */}

      <div className="job-matching-header">

        <div>
          <span className="eyebrow">
            AI POWERED DISCOVERY
          </span>

          <h1>
            AI Job Matching
          </h1>

          <p>
            Jobs selected specifically for your profile
            and ranked by AI relevance.
          </p>
        </div>

        <div className="job-matching-controls">

          <button
            className="primary-button job-matching-refresh"
            onClick={runJobSearch}
            disabled={searching}
          >
            {searching
              ? "Finding jobs..."
              : "↻ Refresh matches"}
          </button>

        </div>
      </div>

      {/* ==================================================
          ERROR
         ================================================== */}

      {error && (
        <div className="error-banner">
          <span>!</span>
          {error}
        </div>
      )}

      {/* ==================================================
          SEARCH SUMMARY
         ================================================== */}

      {searched && !error && (
        <div className="content-card job-match-summary">

          <div>
            <span className="section-kicker">
              PERSONALIZED SEARCH
            </span>

            <h3>
              Your opportunities are ready
            </h3>

            <p>
              AI has evaluated the available jobs
              against your saved professional profile.
            </p>
          </div>

          <div className="job-match-summary-stat">
            <strong>
              {matches.length}
            </strong>

            <span>
              Top matches
            </span>
          </div>

        </div>
      )}

      {searched && searchSummary?.source_results && (
        <div className="content-card job-match-summary">
          <div>
            <span className="section-kicker">JOB SOURCES SEARCHED</span>
            <h3>Provider results</h3>
            <p>
              Results are merged and duplicate vacancies are removed before
              matching them to your profile.
            </p>
          </div>
          <div className="job-match-tags">
            {Object.entries(searchSummary.source_results).map(([source, result]) => (
              <span className="job-match-tag" key={source}>
                {source}: {result.fetched || 0} found
                {result.errors?.length ? " (partially unavailable)" : ""}
              </span>
            ))}
            {Object.keys(searchSummary.unavailable_sources || {}).map((source) => (
              <span className="job-match-tag" key={source}>
                {source}: not configured
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ==================================================
          EMPTY STATE
         ================================================== */}

      {matches.length === 0 ? (
        <div className="content-card">

          <div className="job-match-empty">

            <div className="job-match-empty-icon">
              ✦
            </div>

            <h2>
              No matches found
            </h2>

            <p>
              We couldn't find suitable jobs from the
              current job pool. Try refreshing after
              updating your preferred roles or location.
            </p>

            <button
              className="primary-button"
              onClick={runJobSearch}
            >
              Search Again →
            </button>

          </div>

        </div>
      ) : (

        /* =================================================
           MATCH LIST
           ================================================= */

        <div className="job-match-list">

          {matches.map((item) => {

            const job = item.job || {};
            const match = item.match || {};

            const score = Number(
              match.match_score || 0
            );

            const matchClass =
              getMatchClass(score);

            return (
              <article
                className="job-match-card"
                key={job.id}
              >

                <div className="job-match-main">

                  {/* JOB HEADER */}

                  <div className="job-match-top">

                    <div className="job-match-title">

                      <span
                        className={`job-match-label ${matchClass}`}
                      >
                        {getMatchLabel(score)}
                      </span>

                      <h2>
                        {job.title ||
                          "Untitled position"}
                      </h2>

                      <div className="job-match-company">
                        {job.company ||
                          "Company not specified"}
                      </div>

                      <div className="job-match-location">
                        📍{" "}
                        {job.location ||
                          "Location not specified"}
                      </div>

                    </div>

                    {/* SCORE */}

                    <div
                      className={`job-match-score ${matchClass}`}
                    >
                      <strong>
                        {score}%
                      </strong>

                      <span>
                        MATCH
                      </span>
                    </div>

                  </div>

                  {/* SKILLS */}

                  {Array.isArray(job.skills) &&
                    job.skills.length > 0 && (
                      <div className="job-match-tags">

                        {job.skills
                          .slice(0, 8)
                          .map(
                            (skill, index) => (
                              <span
                                className="job-match-tag"
                                key={`${skill}-${index}`}
                              >
                                {skill}
                              </span>
                            )
                          )}

                      </div>
                    )}

                  {/* WHY MATCH */}

                  {Array.isArray(
                    match.reasons
                  ) &&
                    match.reasons.length > 0 && (
                      <div className="job-match-section">

                        <h4>
                          Why this job matches you
                        </h4>

                        {match.reasons.map(
                          (reason, index) => (
                            <div
                              className="job-match-reason"
                              key={index}
                            >
                              <span className="job-match-reason-icon">
                                ✓
                              </span>

                              <span>
                                {reason}
                              </span>
                            </div>
                          )
                        )}

                      </div>
                    )}

                  {/* MATCHING SKILLS */}

                  {Array.isArray(
                    match.matching_skills
                  ) &&
                    match.matching_skills.length >
                      0 && (
                      <div className="job-match-section">

                        <h4>
                          Your matching skills
                        </h4>

                        <div className="job-match-skills">

                          {match.matching_skills.map(
                            (skill, index) => (
                              <span
                                className="job-match-skill"
                                key={`${skill}-${index}`}
                              >
                                {skill}
                              </span>
                            )
                          )}

                        </div>

                      </div>
                    )}

                  {/* MISSING SKILLS */}

                  {Array.isArray(
                    match.missing_skills
                  ) &&
                    match.missing_skills.length >
                      0 && (
                      <div className="job-match-section">

                        <h4>
                          Skills to strengthen
                        </h4>

                        <div className="job-match-skills">

                          {match.missing_skills.map(
                            (skill, index) => (
                              <span
                                className="job-match-missing"
                                key={`${skill}-${index}`}
                              >
                                {skill}
                              </span>
                            )
                          )}

                        </div>

                      </div>
                    )}

                  {/* AI RECOMMENDATION */}

                  {match.recommendation && (
                    <div className="job-match-recommendation">

                      <strong>
                        AI Recommendation
                      </strong>

                      <p>
                        {match.recommendation}
                      </p>

                    </div>
                  )}

                </div>

                {/* FOOTER */}

                <div className="job-match-footer">

                  <div className="job-match-meta">

                    {job.employment_type && (
                      <span>
                        💼{" "}
                        {job.employment_type}
                      </span>
                    )}

                    {job.experience_required && (
                      <span>
                        ◷{" "}
                        {job.experience_required}
                      </span>
                    )}

                    {job.salary && (
                      <span>
                        ₹ {job.salary}
                      </span>
                    )}

                    <span>
                      Source:{" "}
                      {job.source ||
                        "Job platform"}
                    </span>

                  </div>

                  {job.job_url ? (
                    <a
                      className="primary-button"
                      href={job.job_url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      View & Apply →
                    </a>
                  ) : (
                    <button
                      className="secondary-button"
                      disabled
                    >
                      Application link unavailable
                    </button>
                  )}

                </div>

              </article>
            );
          })}

        </div>
      )}

    </div>
  );
}
