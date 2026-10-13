import { useState } from "react";
import "./Auth.css";

const API_BASE_URL = "http://127.0.0.1:8000";

export default function Auth({ onLogin }) {
  const [tab, setTab] = useState("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [loading, setLoading] = useState(false);

  function switchTab(nextTab) {
    setTab(nextTab);
    setAuthError("");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setAuthError("");

    const cleanName = name.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail || !password) {
      setAuthError("Email and password are required.");
      return;
    }

    if (tab === "register" && !cleanName) {
      setAuthError("Please enter your full name.");
      return;
    }

    setLoading(true);

    try {
      if (tab === "register") {
        const registerResponse = await fetch(
          `${API_BASE_URL}/auth/register`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: cleanName,
              email: cleanEmail,
              password,
            }),
          }
        );

        const registerData = await registerResponse.json().catch(() => ({}));

        if (!registerResponse.ok) {
          throw new Error(
            registerData.detail || "Could not create your account."
          );
        }
      }

      const loginResponse = await fetch(
        `${API_BASE_URL}/auth/login`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: cleanEmail,
            password,
          }),
        }
      );

      const loginData = await loginResponse.json().catch(() => ({}));

      if (!loginResponse.ok || !loginData.access_token) {
        throw new Error(
          loginData.detail || "Invalid email or password."
        );
      }

      const loggedInUser = loginData.user || {
        id: null,
        name: cleanName || cleanEmail.split("@")[0],
        email: cleanEmail,
        role: "candidate",
      };

      localStorage.setItem(
        "access_token",
        loginData.access_token
      );
      localStorage.removeItem("token");
      localStorage.removeItem("jwt_token");

      localStorage.setItem(
        "user",
        JSON.stringify(loggedInUser)
      );
      localStorage.setItem(
        "role",
        loggedInUser.role || "candidate"
      );
      localStorage.setItem(
        "user_role",
        loggedInUser.role || "candidate"
      );

      onLogin(loggedInUser);
    } catch (error) {
      console.error(error);
      setAuthError(
        error.message || "Authentication failed."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-screen">
      <div className="auth-background-glow auth-glow-one" />
      <div className="auth-background-glow auth-glow-two" />

      <main className="auth-card">
        <div className="auth-brand">
          <div className="auth-brand-mark">AI</div>
          <div className="auth-brand-copy">
            <strong>AI Job Hunter</strong>
            <span>Intelligent career discovery</span>
          </div>
        </div>

        <div className="auth-intro">
          <span className="auth-kicker">
            CAREER INTELLIGENCE PLATFORM
          </span>
          <h1>
            {tab === "login"
              ? "Welcome back"
              : "Create your account"}
          </h1>
          <p>
            {tab === "login"
              ? "Continue your AI-powered job search."
              : "Build your profile and discover jobs matched to your skills."}
          </p>
        </div>

        <div className="auth-tabs">
          <button
            type="button"
            className={tab === "login" ? "active" : ""}
            onClick={() => switchTab("login")}
          >
            Sign In
          </button>
          <button
            type="button"
            className={tab === "register" ? "active" : ""}
            onClick={() => switchTab("register")}
          >
            Create Account
          </button>
        </div>

        {authError && (
          <div className="auth-error">
            <span className="auth-error-icon">!</span>
            <span>{authError}</span>
          </div>
        )}

        <form className="auth-form" onSubmit={handleSubmit}>
          {tab === "register" && (
            <label className="auth-field">
              <span>Full Name</span>
              <input
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Your full name"
                autoComplete="name"
                disabled={loading}
              />
            </label>
          )}

          <label className="auth-field">
            <span>Email Address</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              disabled={loading}
            />
          </label>

          <label className="auth-field">
            <span>Password</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter your password"
              autoComplete={
                tab === "login"
                  ? "current-password"
                  : "new-password"
              }
              disabled={loading}
            />
          </label>

          <button
            type="submit"
            className="auth-submit"
            disabled={loading}
          >
            {loading
              ? "Please wait..."
              : tab === "login"
              ? "Sign In"
              : "Create Account"}
            {!loading && <span aria-hidden="true">→</span>}
          </button>
        </form>

        <div className="auth-switch">
          <span>
            {tab === "login"
              ? "Don't have an account?"
              : "Already have an account?"}
          </span>
          <button
            type="button"
            onClick={() =>
              switchTab(tab === "login" ? "register" : "login")
            }
          >
            {tab === "login" ? "Create one" : "Sign in"}
          </button>
        </div>

        <div className="auth-security">
          <span className="auth-security-icon">✓</span>
          <span>
            Your resume data is protected and belongs only to your account.
          </span>
        </div>
      </main>
    </div>
  );
}
