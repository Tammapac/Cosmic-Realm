import { useState } from "react";
import { login, register } from "../net/api";

type Props = {
  onAuth: (playerData: any) => void;
};

// Auth screens on the PNG GUI window art:
//  - login.png (1122x691): title banner, two tab plates, two field rows
//    (label plate + dark input box) and the central play-button octagon.
//  - registration.png (675x837): four baked labeled fields (USERNAME /
//    PASSWORD / CONFIRM PASSWORD / E-MAIL), REGISTRATE button, close ⊘.
// All content is percent-positioned over the art so it scales cleanly.

const inputStyle: React.CSSProperties = {
  position: "absolute",
  background: "transparent",
  border: "none",
  outline: "none",
  color: "#ffce7a",
  fontFamily: "var(--font-display, 'Courier New', monospace)",
  fontSize: 17,
  letterSpacing: "0.06em",
  textAlign: "center",
};

function Starfield() {
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
      {Array.from({ length: 90 }, (_, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            width: Math.random() * 2 + 1,
            height: Math.random() * 2 + 1,
            background: i % 7 === 0 ? "#f7a832" : "#fff",
            borderRadius: "50%",
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            opacity: Math.random() * 0.5 + 0.15,
            animation: `authTwinkle ${2 + Math.random() * 3}s ease-in-out infinite`,
            animationDelay: `${Math.random() * 3}s`,
          }}
        />
      ))}
    </div>
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

  return (
    <div
      style={{
        position: "fixed", inset: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "radial-gradient(ellipse at 50% 35%, #100a20 0%, #05030a 55%, #020204 100%)",
        fontFamily: "var(--font-display, 'Courier New', monospace)",
      }}
    >
      <Starfield />
      <style>{`
        @keyframes authTwinkle { 0%, 100% { opacity: 0.15; } 50% { opacity: 0.7; } }
        .auth-zone { position: absolute; background: transparent; border: none; cursor: pointer;
          transition: filter 0.12s, box-shadow 0.12s; border-radius: 6px; }
        .auth-zone:hover { box-shadow: 0 0 18px rgba(247,168,50,0.45); }
        .auth-zone:active { filter: brightness(1.2); }
        .auth-input::placeholder { color: rgba(247,168,50,0.35); }
      `}</style>

      {mode === "login" ? (
        <form
          onSubmit={submitLogin}
          style={{
            position: "relative",
            width: "min(880px, 94vw)",
            aspectRatio: "1122 / 691",
            backgroundImage: "url(/assets/ui/auth-login.png)",
            backgroundSize: "100% 100%",
            filter: "drop-shadow(0 14px 50px rgba(0,0,0,0.8))",
          }}
        >
          {/* title banner */}
          <div style={{
            position: "absolute", left: "27%", top: "4.6%", width: "46%", height: "7.6%",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#3a2000", fontWeight: 800, fontSize: "clamp(16px, 2.6vw, 26px)",
            letterSpacing: "0.28em", textShadow: "0 1px 0 rgba(255,255,255,0.25)",
            userSelect: "none",
          }}>
            COSMIC REALM
          </div>

          {/* tab plates: LOGIN (active) / REGISTER */}
          <div style={{
            position: "absolute", left: "11.5%", top: "18.2%", width: "20.4%", height: "6.6%",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#ffce7a", fontWeight: 800, fontSize: 15, letterSpacing: "0.3em",
            textShadow: "0 0 8px rgba(247,168,50,0.6), 0 1px 2px #000", userSelect: "none",
          }}>
            PILOT LOGIN
          </div>
          <button type="button" className="auth-zone" onClick={() => switchMode("register")}
            style={{ left: "66.2%", top: "18.2%", width: "21%", height: "6.6%" }}>
            <span style={{
              color: "#9a9484", fontWeight: 800, fontSize: 15, letterSpacing: "0.3em",
              textShadow: "0 1px 2px #000", fontFamily: "inherit",
            }}>REGISTER</span>
          </button>

          {/* field labels on the amber plates */}
          <div style={{
            position: "absolute", left: "25.8%", top: "42%", width: "20.6%", height: "6%",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#3a2000", fontWeight: 800, fontSize: 15, letterSpacing: "0.22em", userSelect: "none",
          }}>USERNAME</div>
          <div style={{
            position: "absolute", left: "53.4%", top: "42%", width: "20.6%", height: "6%",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#3a2000", fontWeight: 800, fontSize: 15, letterSpacing: "0.22em", userSelect: "none",
          }}>PASSWORD</div>

          {/* inputs over the dark field boxes */}
          <input
            className="auth-input" autoComplete="username" placeholder="· · ·"
            value={username} onChange={(e) => setUsername(e.target.value)}
            style={{ ...inputStyle, left: "23.5%", top: "49.8%", width: "21.5%", height: "6.6%" }}
          />
          <input
            className="auth-input" type="password" autoComplete="current-password" placeholder="· · ·"
            value={password} onChange={(e) => setPassword(e.target.value)}
            style={{ ...inputStyle, left: "53%", top: "49.8%", width: "22.5%", height: "6.6%" }}
          />

          {/* play button (launch) */}
          <button type="submit" className="auth-zone" disabled={loading}
            title={loading ? "Connecting..." : "Launch"}
            style={{ left: "43.2%", top: "55.6%", width: "12.2%", height: "19.6%", borderRadius: 18 }}
          />

          {/* status / error line over the bottom console lines */}
          <div style={{
            position: "absolute", left: "20%", width: "60%", top: "79%",
            textAlign: "center", fontSize: 14, letterSpacing: "0.12em",
            color: error ? "#ff5c6c" : "#9a9484",
            textShadow: "0 1px 2px #000", userSelect: "none",
          }}>
            {loading ? "CONNECTING..." : error || "ENTER CREDENTIALS AND PRESS LAUNCH"}
          </div>
        </form>
      ) : (
        <form
          onSubmit={submitRegister}
          style={{
            position: "relative",
            height: "min(760px, 92vh)",
            aspectRatio: "675 / 837",
            backgroundImage: "url(/assets/ui/auth-register.png)",
            backgroundSize: "100% 100%",
            filter: "drop-shadow(0 14px 50px rgba(0,0,0,0.8))",
          }}
        >
          {/* close ⊘ → back to login */}
          <button type="button" className="auth-zone" onClick={() => switchMode("login")}
            title="Back to login"
            style={{ left: "81.5%", top: "11.5%", width: "9.5%", height: "6.2%" }} />

          {/* inputs over the four baked labeled boxes */}
          <input className="auth-input" autoComplete="username" placeholder="· · ·"
            value={username} onChange={(e) => setUsername(e.target.value)}
            style={{ ...inputStyle, left: "26%", top: "23%", width: "49.5%", height: "7%" }} />
          <input className="auth-input" type="password" autoComplete="new-password" placeholder="· · ·"
            value={password} onChange={(e) => setPassword(e.target.value)}
            style={{ ...inputStyle, left: "26%", top: "39.2%", width: "49.5%", height: "7%" }} />
          <input className="auth-input" type="password" autoComplete="new-password" placeholder="· · ·"
            value={confirm} onChange={(e) => setConfirm(e.target.value)}
            style={{ ...inputStyle, left: "26%", top: "54.8%", width: "49.5%", height: "7%" }} />
          <input className="auth-input" type="email" autoComplete="email" placeholder="· · ·"
            value={email} onChange={(e) => setEmail(e.target.value)}
            style={{ ...inputStyle, left: "26%", top: "69.8%", width: "49.5%", height: "7%" }} />

          {/* REGISTRATE (baked button) */}
          <button type="submit" className="auth-zone" disabled={loading}
            style={{ left: "24.5%", top: "85%", width: "50%", height: "7.6%", borderRadius: 24 }} />

          {/* error line between email and button */}
          <div style={{
            position: "absolute", left: "12%", width: "76%", top: "79.5%",
            textAlign: "center", fontSize: 13, letterSpacing: "0.1em",
            color: error ? "#ff5c6c" : "#9a9484",
            textShadow: "0 1px 2px #000", userSelect: "none",
          }}>
            {loading ? "CREATING PILOT..." : error || ""}
          </div>
        </form>
      )}
    </div>
  );
}
