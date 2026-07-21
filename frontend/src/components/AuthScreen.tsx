import { useState } from "react";
import { login, register } from "../net/api";
import { HudButton } from "./hud-ui";

type Props = {
  onAuth: (playerData: any) => void;
};

// Login/registration on native HUD panels (hud_preview design language) —
// the baked auth-login.png / auth-register.png art windows are retired.
// All auth logic is unchanged.

function Field({
  label, type = "text", value, onChange, autoComplete,
}: {
  label: string; type?: string; value: string; onChange: (v: string) => void; autoComplete?: string;
}) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <span style={{ fontSize: 11, letterSpacing: "0.22em", color: "var(--hud-cyan)", textShadow: "0 0 6px rgba(78,226,255,0.4)" }}>
        {label}
      </span>
      <input
        className="ginput"
        type={type}
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ fontSize: 14, padding: "9px 12px", letterSpacing: "0.06em", fontFamily: "var(--font-display)" }}
      />
    </label>
  );
}

export default function AuthScreen({ onAuth }: Props) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submitLogin(e?: React.FormEvent) {
    e?.preventDefault();
    if (loading) return;
    setError("");
    setLoading(true);
    try {
      const data = await login(username, password);
      onAuth(data.player);
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function submitRegister(e?: React.FormEvent) {
    e?.preventDefault();
    if (loading) return;
    setError("");
    if (!username || !password || !email) { setError("All fields are required"); return; }
    if (password !== confirm) { setError("Passwords do not match"); return; }
    setLoading(true);
    try {
      // pilot name = account name (both unique, one identity)
      const data = await register(username, email, password, username);
      onAuth(data.player);
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  const switchMode = (m: "login" | "register") => { setMode(m); setError(""); };

  const tabStyle = (active: boolean): React.CSSProperties => ({
    flex: 1,
    padding: "8px 4px",
    cursor: "pointer",
    background: active ? "rgba(78,226,255,0.1)" : "transparent",
    border: "none",
    borderBottom: active ? "2px solid var(--hud-cyan)" : "2px solid transparent",
    fontFamily: "var(--font-display)",
    fontSize: 12,
    fontWeight: active ? 700 : 400,
    letterSpacing: "0.24em",
    color: active ? "var(--hud-cyan)" : "var(--hud-text-dim)",
    textShadow: active ? "0 0 8px rgba(78,226,255,0.45)" : "none",
    transition: "color 0.12s, background 0.12s",
  });

  return (
    <div
      style={{
        position: "fixed", inset: 0,
        backgroundImage: "url(/assets/ui/login-bg.jpg?v=1)",
        backgroundSize: "cover",
        backgroundPosition: "center",
        fontFamily: "var(--font-display)",
        display: "flex", alignItems: "flex-end", justifyContent: "center",
      }}
    >
      {/* darkening scrim so the login panel stays readable over the art */}
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 50% 78%, rgba(2,4,10,0.55) 0%, rgba(2,4,10,0.35) 45%, rgba(2,4,10,0.15) 100%)", pointerEvents: "none" }} />
      <style>{`@keyframes authTwinkle { 0%, 100% { opacity: 0.15; } 50% { opacity: 0.7; } }`}</style>

      <form
        onSubmit={mode === "login" ? submitLogin : submitRegister}
        className="panel"
        style={{ width: "min(420px, 92vw)", display: "flex", flexDirection: "column", position: "relative", zIndex: 1, marginBottom: "8vh" }}
      >
        <div className="hud-titleband" style={{ fontSize: 15, letterSpacing: "0.4em", padding: "10px 14px", justifyContent: "center" }}>
          Cosmic Realm
        </div>

        {/* mode tabs */}
        <div style={{ display: "flex", borderBottom: "1px solid var(--hud-border-dim)" }}>
          <button type="button" style={tabStyle(mode === "login")} onClick={() => switchMode("login")}>
            PILOT LOGIN
          </button>
          <button type="button" style={tabStyle(mode === "register")} onClick={() => switchMode("register")}>
            REGISTER
          </button>
        </div>

        {/* fields */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14, padding: "20px 22px 8px" }}>
          <Field label="USERNAME" value={username} onChange={setUsername} autoComplete="username" />
          {mode === "register" && (
            <Field label="E-MAIL" type="email" value={email} onChange={setEmail} autoComplete="email" />
          )}
          <Field
            label="PASSWORD" type="password" value={password} onChange={setPassword}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
          />
          {mode === "register" && (
            <Field label="CONFIRM PASSWORD" type="password" value={confirm} onChange={setConfirm} autoComplete="new-password" />
          )}
        </div>

        {/* status line */}
        <div
          style={{
            textAlign: "center", fontSize: 11, letterSpacing: "0.12em", minHeight: 18,
            padding: "2px 16px",
            color: error ? "var(--hud-hp)" : "var(--hud-text-dim)",
            textShadow: error ? "0 0 8px rgba(255,77,94,0.4)" : "none",
          }}
        >
          {loading
            ? (mode === "login" ? "CONNECTING..." : "CREATING PILOT...")
            : error || (mode === "login" ? "ENTER CREDENTIALS AND PRESS LAUNCH" : "")}
        </div>

        {/* action */}
        <div style={{ display: "flex", justifyContent: "center", padding: "10px 16px 18px" }}>
          <HudButton type="submit" variant="primary" disabled={loading} style={{ padding: "10px 44px", fontSize: 13, letterSpacing: "0.22em" }}>
            {mode === "login" ? "▶ LAUNCH" : "▶ REGISTRATE"}
          </HudButton>
        </div>
      </form>

      {/* copyright — bottom-left corner */}
      <div style={{
        position: "absolute", left: 16, bottom: 12, zIndex: 1,
        fontFamily: "var(--font-display)", fontSize: 11, letterSpacing: "0.14em",
        color: "rgba(200,225,255,0.65)", textShadow: "0 1px 3px #000",
        userSelect: "none", pointerEvents: "none",
      }}>
        © 2026 TAMMAPAC · ALL RIGHTS RESERVED
      </div>
    </div>
  );
}
