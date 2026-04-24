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
        background: "radial-gradient(ellipse at center, #0a0e1a 0%, #020408 100%)",
        fontFamily: "'Inter', sans-serif",
      }}
    >
      {/* Animated stars background */}
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
              opacity: Math.random() * 0.6 + 0.2,
              animation: `pulse ${2 + Math.random() * 3}s ease-in-out infinite`,
              animationDelay: `${Math.random() * 3}s`,
            }}
          />
        ))}
      </div>

      <div
        style={{
          position: "relative",
          width: 380,
          padding: "32px 28px",
          background: "rgba(10, 14, 26, 0.92)",
          border: "1px solid rgba(78, 226, 255, 0.25)",
          borderRadius: 12,
          boxShadow: "0 0 40px rgba(78, 226, 255, 0.08), 0 0 80px rgba(78, 226, 255, 0.04)",
        }}
      >
        <h1
          style={{
            textAlign: "center",
            fontSize: 28,
            fontWeight: 700,
            color: "#4ee2ff",
            marginBottom: 4,
            letterSpacing: 2,
            textShadow: "0 0 20px rgba(78, 226, 255, 0.4)",
          }}
        >
          COSMIC REALM
        </h1>
        <p
          style={{
            textAlign: "center",
            fontSize: 12,
            color: "rgba(210, 220, 240, 0.5)",
            marginBottom: 24,
            letterSpacing: 4,
          }}
        >
          {mode === "login" ? "PILOT LOGIN" : "NEW PILOT REGISTRATION"}
        </p>

        <form onSubmit={handleSubmit}>
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            style={inputStyle}
            autoComplete="username"
          />
          {mode === "register" && (
            <>
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={inputStyle}
                autoComplete="email"
              />
              <input
                type="text"
                placeholder="Pilot Name (in-game)"
                value={pilotName}
                onChange={(e) => setPilotName(e.target.value)}
                style={inputStyle}
              />
            </>
          )}
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={inputStyle}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
          />

          {error && (
            <p style={{ color: "#ff5c6c", fontSize: 13, marginBottom: 12, textAlign: "center" }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              padding: "12px 0",
              background: loading
                ? "rgba(78, 226, 255, 0.15)"
                : "linear-gradient(135deg, rgba(78, 226, 255, 0.2) 0%, rgba(78, 226, 255, 0.08) 100%)",
              border: "1px solid rgba(78, 226, 255, 0.4)",
              borderRadius: 8,
              color: "#4ee2ff",
              fontSize: 14,
              fontWeight: 600,
              letterSpacing: 2,
              cursor: loading ? "not-allowed" : "pointer",
              transition: "all 0.2s",
              marginBottom: 16,
            }}
          >
            {loading ? "..." : mode === "login" ? "LAUNCH" : "CREATE PILOT"}
          </button>
        </form>

        <p style={{ textAlign: "center", fontSize: 13, color: "rgba(210, 220, 240, 0.5)" }}>
          {mode === "login" ? "No account? " : "Already a pilot? "}
          <button
            onClick={() => {
              setMode(mode === "login" ? "register" : "login");
              setError("");
            }}
            style={{
              background: "none",
              border: "none",
              color: "#4ee2ff",
              cursor: "pointer",
              fontSize: 13,
              textDecoration: "underline",
              padding: 0,
            }}
          >
            {mode === "login" ? "Register" : "Login"}
          </button>
        </p>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.2; }
          50% { opacity: 0.8; }
        }
      `}</style>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 14px",
  marginBottom: 12,
  background: "rgba(255, 255, 255, 0.04)",
  border: "1px solid rgba(78, 226, 255, 0.15)",
  borderRadius: 6,
  color: "#d2dcf0",
  fontSize: 14,
  outline: "none",
  boxSizing: "border-box",
};
