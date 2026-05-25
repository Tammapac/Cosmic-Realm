import { useState } from "react";
import { login, register } from "../net/api";

type Props = {
  onAuth: (playerData: any) => void;
};

export default function AuthScreen({ onAuth }: Props) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pilotName, setPilotName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (mode === "login") {
        const data = await login(username, password);
        onAuth(data.player);
      } else {
        const data = await register(username, email, password, pilotName);
        onAuth(data.player);
      }
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "radial-gradient(ellipse at 50% 40%, #0c1228 0%, #020408 100%)",
        fontFamily: "'Courier New', 'Lucida Console', monospace",
      }}
    >
      {/* Star field */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          overflow: "hidden",
          pointerEvents: "none",
        }}
      >
        {Array.from({ length: 80 }, (_, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              width: Math.random() * 2 + 1,
              height: Math.random() * 2 + 1,
              background: "#fff",
              borderRadius: "50%",
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              opacity: Math.random() * 0.5 + 0.15,
              animation: `pulse ${2 + Math.random() * 3}s ease-in-out infinite`,
              animationDelay: `${Math.random() * 3}s`,
            }}
          />
        ))}
      </div>

      {/* Decorative horizontal lines */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: "50%",
          transform: "translateY(-50%)",
          height: 1,
          background: "linear-gradient(90deg, transparent 0%, rgba(78,226,255,0.08) 30%, rgba(78,226,255,0.15) 50%, rgba(78,226,255,0.08) 70%, transparent 100%)",
          pointerEvents: "none",
        }}
      />

      {/* Auth card */}
      <div
        style={{
          position: "relative",
          width: 380,
          padding: "32px 28px 28px",
          background: "rgba(8, 12, 26, 0.94)",
          border: "1px solid rgba(78, 226, 255, 0.22)",
          borderRadius: 6,
          boxShadow:
            "0 0 40px rgba(78, 226, 255, 0.07), 0 0 80px rgba(0,0,0,0.9), inset 0 1px 0 rgba(78, 226, 255, 0.08)",
        }}
      >
        {/* Corner accents */}
        <div style={cornerTL} />
        <div style={cornerTR} />
        <div style={cornerBL} />
        <div style={cornerBR} />

        {/* Title */}
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <h1
            style={{
              fontSize: 26,
              fontWeight: 700,
              color: "#4ee2ff",
              margin: "0 0 4px",
              letterSpacing: "0.2em",
              textShadow: "0 0 24px rgba(78, 226, 255, 0.45)",
            }}
          >
            COSMIC REALM
          </h1>
          <p
            style={{
              fontSize: 10,
              color: "rgba(160, 176, 216, 0.7)",
              margin: 0,
              letterSpacing: "0.35em",
            }}
          >
            {mode === "login" ? "PILOT LOGIN" : "NEW PILOT REGISTRATION"}
          </p>
        </div>

        {/* Divider */}
        <div
          style={{
            height: 1,
            background: "linear-gradient(90deg, transparent, rgba(78,226,255,0.18), transparent)",
            marginBottom: 20,
          }}
        />

        <form onSubmit={handleSubmit}>
          <AuthInput
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
          />
          {mode === "register" && (
            <>
              <AuthInput
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
              <AuthInput
                type="text"
                placeholder="Pilot Name (in-game)"
                value={pilotName}
                onChange={(e) => setPilotName(e.target.value)}
              />
            </>
          )}
          <AuthInput
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
          />

          {error && (
            <p
              style={{
                color: "#ff5c6c",
                fontSize: 12,
                marginBottom: 12,
                textAlign: "center",
                background: "rgba(255,92,108,0.08)",
                border: "1px solid rgba(255,92,108,0.2)",
                padding: "6px 10px",
                borderRadius: 3,
              }}
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              padding: "11px 0",
              background: loading
                ? "rgba(78, 226, 255, 0.1)"
                : "linear-gradient(135deg, rgba(78, 226, 255, 0.18) 0%, rgba(78, 226, 255, 0.07) 100%)",
              border: "1px solid rgba(78, 226, 255, 0.38)",
              borderRadius: 4,
              color: "#4ee2ff",
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: "0.2em",
              cursor: loading ? "not-allowed" : "pointer",
              fontFamily: "inherit",
              transition: "background 0.15s, border-color 0.15s, box-shadow 0.15s",
              marginBottom: 14,
              textShadow: "0 0 10px rgba(78,226,255,0.5)",
            }}
            onMouseEnter={(e) => {
              if (!loading) {
                (e.currentTarget as HTMLButtonElement).style.background =
                  "linear-gradient(135deg, rgba(78, 226, 255, 0.28) 0%, rgba(78, 226, 255, 0.12) 100%)";
                (e.currentTarget as HTMLButtonElement).style.boxShadow =
                  "0 0 14px rgba(78,226,255,0.3)";
              }
            }}
            onMouseLeave={(e) => {
              if (!loading) {
                (e.currentTarget as HTMLButtonElement).style.background =
                  "linear-gradient(135deg, rgba(78, 226, 255, 0.18) 0%, rgba(78, 226, 255, 0.07) 100%)";
                (e.currentTarget as HTMLButtonElement).style.boxShadow = "none";
              }
            }}
          >
            {loading ? "CONNECTING..." : mode === "login" ? "LAUNCH" : "CREATE PILOT"}
          </button>
        </form>

        <p style={{ textAlign: "center", fontSize: 12, color: "rgba(160, 176, 216, 0.55)", margin: 0 }}>
          {mode === "login" ? "No account? " : "Already a pilot? "}
          <button
            onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }}
            style={{
              background: "none",
              border: "none",
              color: "#4ee2ff",
              cursor: "pointer",
              fontSize: 12,
              fontFamily: "inherit",
              textDecoration: "underline",
              textDecorationColor: "rgba(78,226,255,0.4)",
              padding: 0,
            }}
          >
            {mode === "login" ? "Register" : "Login"}
          </button>
        </p>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.15; }
          50% { opacity: 0.7; }
        }
      `}</style>
    </div>
  );
}

function AuthInput({
  type, placeholder, value, onChange, autoComplete,
}: {
  type: string;
  placeholder: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  autoComplete?: string;
}) {
  return (
    <input
      type={type}
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      autoComplete={autoComplete}
      style={{
        display: "block",
        width: "100%",
        padding: "9px 12px",
        marginBottom: 10,
        background: "rgba(255, 255, 255, 0.03)",
        border: "1px solid rgba(78, 226, 255, 0.14)",
        borderRadius: 4,
        color: "#d2dcf0",
        fontSize: 13,
        fontFamily: "'Courier New', monospace",
        outline: "none",
        boxSizing: "border-box",
        transition: "border-color 0.15s",
      }}
      onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(78,226,255,0.4)"; }}
      onBlur={(e) => { e.currentTarget.style.borderColor = "rgba(78,226,255,0.14)"; }}
    />
  );
}

/* Sci-fi corner accent styles */
const cornerBase: React.CSSProperties = {
  position: "absolute",
  width: 10,
  height: 10,
  pointerEvents: "none",
};
const cornerTL: React.CSSProperties = {
  ...cornerBase, top: 4, left: 4,
  borderTop: "1px solid rgba(78,226,255,0.45)",
  borderLeft: "1px solid rgba(78,226,255,0.45)",
};
const cornerTR: React.CSSProperties = {
  ...cornerBase, top: 4, right: 4,
  borderTop: "1px solid rgba(78,226,255,0.45)",
  borderRight: "1px solid rgba(78,226,255,0.45)",
};
const cornerBL: React.CSSProperties = {
  ...cornerBase, bottom: 4, left: 4,
  borderBottom: "1px solid rgba(78,226,255,0.45)",
  borderLeft: "1px solid rgba(78,226,255,0.45)",
};
const cornerBR: React.CSSProperties = {
  ...cornerBase, bottom: 4, right: 4,
  borderBottom: "1px solid rgba(78,226,255,0.45)",
  borderRight: "1px solid rgba(78,226,255,0.45)",
};
