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
        // Stretch the key art edge-to-edge (fills the whole screen, no
        // black side bars); the title sits top-center and stays visible.
        background: "#04070e url(/assets/ui/login-bg.jpg?v=1) no-repeat center center",
        backgroundSize: "100% 100%",
        fontFamily: "var(--font-display)",
        display: "flex", alignItems: "flex-end", justifyContent: "center",
      }}
    >
      {/* darkening scrim so the login panel stays readable over the art */}
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, transparent 45%, rgba(2,4,10,0.4) 72%, rgba(2,4,10,0.75) 100%)", pointerEvents: "none" }} />
      <style>{`
        @keyframes authTwinkle { 0%, 100% { opacity: 0.15; } 50% { opacity: 0.7; } }
        /* breathing cyan glow around the login panel */
        @keyframes authPanelPulse {
          0%, 100% { box-shadow: 0 6px 26px rgba(0,0,0,0.55), 0 0 16px rgba(78,226,255,0.18); }
          50%      { box-shadow: 0 6px 26px rgba(0,0,0,0.55), 0 0 30px rgba(78,226,255,0.42); }
        }
        /* diagonal sheen sweeping slowly across the glass */
        @keyframes authPanelSheen {
          0%   { transform: translateX(-140%) skewX(-18deg); opacity: 0; }
          12%  { opacity: 0.9; }
          40%  { opacity: 0; }
          100% { transform: translateX(140%) skewX(-18deg); opacity: 0; }
        }
        /* Semi-transparent glass: the key art shows through. Must beat the
           opaque .panel rule (which is !important) — so this is more
           specific (form.auth-glass) AND drops the border-image fill that
           paints the dark panel interior; a slim cyan border + clipped
           corners keep the HUD look. */
        form.auth-glass {
          background:
            linear-gradient(180deg, rgba(14,24,44,0.48) 0%, rgba(8,14,28,0.54) 100%) !important;
          border-image: none !important;
          border: 1.5px solid rgba(78,226,255,0.55) !important;
          border-radius: 0 !important;
          clip-path: polygon(12px 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%, 0 12px) !important;
          backdrop-filter: blur(7px) saturate(1.05) !important;
          -webkit-backdrop-filter: blur(7px) saturate(1.05) !important;
          animation: authPanelPulse 4.5s ease-in-out infinite;
          overflow: hidden;
        }
        form.auth-glass .auth-sheen {
          content: ""; position: absolute; top: 0; bottom: 0; left: 0; width: 45%;
          background: linear-gradient(90deg, transparent, rgba(180,235,255,0.16), rgba(255,255,255,0.1), transparent);
          pointer-events: none; z-index: 1;
          animation: authPanelSheen 7s ease-in-out infinite;
        }
        /* keep all interactive content above the sheen */
        form.auth-glass > *:not(.auth-sheen) { position: relative; z-index: 4; }
      `}</style>

      <form
        onSubmit={mode === "login" ? submitLogin : submitRegister}
        className="panel auth-glass"
        style={{ width: "min(420px, 92vw)", display: "flex", flexDirection: "column", position: "relative", zIndex: 1, marginBottom: "8vh" }}
      >
        <span className="auth-sheen" />
        <div className="hud-titleband" style={{ fontSize: 15, letterSpacing: "0.4em", padding: "10px 14px", justifyContent: "center", position: "relative", zIndex: 4 }}>
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
