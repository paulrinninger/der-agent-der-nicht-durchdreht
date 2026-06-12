/**
 * Passwort-Gate im Look der App. Reines HTML-Formular (kein Client-JS):
 * POST auf /api/gate setzt den Cookie und leitet weiter.
 */
export default async function GatePage({
  searchParams,
}: {
  searchParams: Promise<{ falsch?: string }>;
}) {
  const sp = await searchParams;

  return (
    <div className="page" style={{ maxWidth: 520 }}>
      <div className="brand" style={{ marginBottom: 44 }}>
        <span className="brand-mark" />
        <span className="label">Diffusion · Take-Home</span>
      </div>

      <h1 style={{ fontSize: 32, fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1.1 }}>
        Der Agent, der nicht durchdreht.
      </h1>
      <p className="caption" style={{ margin: "12px 0 24px" }}>
        Diese Demo gehört zu Pauls Probeaufgabe. Das Passwort ist dasselbe wie das der
        Aufgaben-Seite — es steht in der Bewerbungs-Mail.
      </p>

      {sp.falsch && (
        <div className="banner banner-danger">
          <span className="banner-mark">◼</span>
          Falsches Passwort — bitte nochmal probieren.
        </div>
      )}

      <form method="POST" action="/api/gate" style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <input
          className="input"
          type="password"
          name="password"
          placeholder="Passwort"
          aria-label="Passwort"
          autoFocus
          required
          style={{ flex: 1, padding: "10px 12px" }}
        />
        <button className="btn btn-primary" type="submit">
          Öffnen
        </button>
      </form>

      <footer className="foot label">
        Quellcode &amp; lokaler Start ohne Passwort: README im GitHub-Repo. Demo-Modus
        kostet $0 und läuft deterministisch ohne API-Key.
      </footer>
    </div>
  );
}
