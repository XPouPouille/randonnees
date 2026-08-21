import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth";

export function LoginPage() {
  const navigate = useNavigate();
  const auth = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (mode === "login") {
        await auth.login(email, password);
      } else {
        await auth.register(email, password);
      }
      navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <h2>{mode === "login" ? "Connexion" : "Créer un compte"}</h2>

      <form onSubmit={handleSubmit}>
        <p>
          <label>
            Email
            <br />
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required style={{ width: 300 }} />
          </label>
        </p>
        <p>
          <label>
            Mot de passe
            <br />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={mode === "register" ? 8 : undefined}
              style={{ width: 300 }}
            />
          </label>
          {mode === "register" && (
            <>
              <br />
              <small>8 caractères minimum</small>
            </>
          )}
        </p>

        {error && <p style={{ color: "red" }}>{error}</p>}

        <p>
          <button type="submit" disabled={submitting}>
            {submitting ? "…" : mode === "login" ? "Se connecter" : "Créer le compte"}
          </button>
        </p>
      </form>

      <p>
        {mode === "login" ? (
          <>
            Pas encore de compte ?{" "}
            <button type="button" onClick={() => setMode("register")}>
              Créer un compte
            </button>
          </>
        ) : (
          <>
            Déjà un compte ?{" "}
            <button type="button" onClick={() => setMode("login")}>
              Se connecter
            </button>
          </>
        )}
      </p>
    </div>
  );
}
