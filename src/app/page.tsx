import Image from "next/image";

export default function Home() {
  return (
    <div>
      {/* Navbar */}
      <nav style={{ position: "sticky", top: 0, backdropFilter: "saturate(180%) blur(8px)", borderBottom: "1px solid var(--border)", zIndex: 20 }}>
        <div className="container" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: 64 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 10, fontWeight: 800, fontSize: 18 }}>
            <Image src="/file.svg" alt="SlideCraft" width={24} height={24} />
            SlideCraft
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <a className="btn btn-outline" href="#features">Features</a>
            <a className="btn btn-primary" href="#get-started">Get Started</a>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="container" style={{ padding: "96px 0 48px 0" }}>
        <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--muted)" }}>Create. Present. Collaborate.</p>
        <h1 style={{ fontSize: 42, lineHeight: 1.15, fontWeight: 900, marginTop: 8 }}>Design beautiful slide decks in your browser</h1>
        <p style={{ color: "var(--muted)", fontSize: 18, marginTop: 12, maxWidth: 700 }}>
          SlideCraft is a fast, modern alternative to Google Slides. Build decks, collaborate in real time,
          and present anywhere.
        </p>
        <div style={{ display: "flex", gap: 12, marginTop: 20, flexWrap: "wrap" }}>
          <a className="btn btn-primary" id="get-started" href="#">Start a new deck</a>
          <a className="btn btn-outline" href="#features">See features</a>
        </div>

        {/* Mock preview card */}
        <div style={{ marginTop: 28, border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden", boxShadow: "0 8px 24px rgba(0,0,0,0.08)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, padding: 10, borderBottom: "1px solid var(--border)" }}>
            <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#ef4444", display: "inline-block" }} />
            <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#f59e0b", display: "inline-block" }} />
            <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#22c55e", display: "inline-block" }} />
          </div>
          <div style={{ background: "linear-gradient(180deg,#ffffff, #f8fafc)", padding: 24 }}>
            <Image src="/window.svg" alt="Editor preview" width={1200} height={700} style={{ width: "100%", height: "auto" }} />
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="container" style={{ padding: "24px 0 24px 0" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(1, minmax(0, 1fr))", gap: 16 }}>
          <div style={{ border: "1px solid var(--border)", borderRadius: 12, padding: 20 }}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>Real-time Collaboration</div>
            <div style={{ color: "var(--muted)" }}>Work together with your team with presence and live cursors.</div>
          </div>
          <div style={{ border: "1px solid var(--border)", borderRadius: 12, padding: 20 }}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>Beautiful Templates</div>
            <div style={{ color: "var(--muted)" }}>Pick from curated templates and customize with drag-and-drop.</div>
          </div>
          <div style={{ border: "1px solid var(--border)", borderRadius: 12, padding: 20 }}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>One‑click Present</div>
            <div style={{ color: "var(--muted)" }}>Share a link or present full-screen with keyboard controls.</div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="container" style={{ padding: "40px 0", marginTop: 40, borderTop: "1px solid var(--border)", color: "var(--muted)", fontSize: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Image src="/globe.svg" alt="language" width={16} height={16} />
          <span>© {new Date().getFullYear()} SlideCraft</span>
        </div>
      </footer>
    </div>
  );
}
