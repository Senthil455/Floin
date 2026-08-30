import dynamic from "next/dynamic";
const ChennaiMap = dynamic(() => import("@/components/ChennaiMap"), { ssr: false, loading: () => <div style={{ height: 380, display: "grid", placeItems: "center", background: "#08121f", borderRadius: 12 }}>Loading map...</div> });
const FloodSimulation = dynamic(() => import("@/components/FloodSimulation"), { ssr: false, loading: () => <div style={{ height: 520, display: "grid", placeItems: "center", background: "#08121f", borderRadius: 12 }}>Loading 3D...</div> });

export default function Page() {
  return (
    <>
      <nav id="nav">
        <div className="nav-inner">
          <a className="brand" href="#"><span className="brand-mark">◈</span> FLOIN</a>
          <div className="nav-links">
            <a href="#map">Chennai Map</a>
            <a href="#simulation">3D Simulation</a>
            <a href="#how">How it works</a>
          </div>
          <a className="btn btn-primary nav-cta" href="#simulation">Try Simulation</a>
        </div>
      </nav>

      <section id="hero">
        <div className="hero-bg"></div>
        <div className="hero-grid">
          <div className="hero-copy">
            <div className="pill"><span className="dot"></span> CHENNAI • FLOOD INTELLIGENCE • 2026</div>
            <h1>Floods are hard to predict.<br /><span className="accent">Seeing them in 3D</span> makes them understandable.</h1>
            <p className="lead">Explore how rainfall turns into flooding across Chennai - which neighborhoods, roads and buildings are affected, and how deep the water gets.</p>
            <div className="hero-actions">
              <a href="#simulation" className="btn btn-primary btn-lg">Explore 3D Flood</a>
              <a href="#map" className="btn btn-ghost btn-lg">View Chennai Map</a>
            </div>
            <div className="hero-stats">
              <div><b>1,811</b><span>Buildings<br />mapped</span></div>
              <div><b>8</b><span>Rainfall<br />stations</span></div>
              <div><b>3D</b><span>Interactive<br />terrain</span></div>
            </div>
          </div>
          <div className="hero-card">
            <div className="hero-card-head">
              <span className="live"><span className="live-dot"></span> LIVE PREVIEW</span>
              <span className="mono">13.08N, 80.27E • Chennai</span>
            </div>
            <div id="hero-preview"></div>
            <div className="hero-card-foot">
              <div><small>WATER DEPTH</small><b id="hero-depth">0.00 m</b></div>
              <div><small>RAINFALL IMPACT</small><b id="hero-runoff">0 mm</b></div>
              <div><small>STATUS</small><b className="ok">● IDLE</b></div>
            </div>
          </div>
        </div>
      </section>

      <section id="map" className="section" style={{ background: "linear-gradient(180deg,#0b1e33 0%, #0a1018 100%)", borderTop: "1px solid #1e3a5a", borderBottom: "1px solid #1e3a5a" }}>
        <div className="container">
          <div className="section-head">
            <h2>Explore Chennai</h2>
            <p>Buildings, roads, waterways and rainfall across the city. Switch layers to focus on what matters to you.</p>
          </div>
          <div className="pipe-cards">
            <div className="pipe-card" style={{ flex: 1.4 as any }}>
              <ChennaiMap />
            </div>
            <div className="pipe-card" style={{ flex: 0.9 as any, display: "flex", flexDirection: "column", gap: 12, justifyContent: "center" }}>
              <h4>What you can see</h4>
              <ul style={{ fontSize: ".85rem", color: "#8aa0b8", display: "grid", gap: 8, paddingLeft: 16 }}>
                <li><b style={{ color: "#e6eef8" }}>Buildings</b> - 1,811 structures</li>
                <li><b style={{ color: "#e6eef8" }}>Roads</b> - major network</li>
                <li><b style={{ color: "#e6eef8" }}>Water</b> - rivers, canals, lakes</li>
                <li><b style={{ color: "#e6eef8" }}>Rainfall</b> - 8 stations, sized by intensity</li>
              </ul>
              <p style={{ fontSize: ".82rem", color: "#8aa0b8", marginTop: 8 }}>Tap any feature for details. Centered on central Chennai.</p>
            </div>
          </div>
        </div>
      </section>

      <section id="simulation" className="section dark">
        <div className="container">
          <div className="section-head">
            <h2>Interactive 3D Flood Simulation</h2>
            <p>Adjust rainfall and watch water rise across the terrain. Drag to orbit, scroll to zoom.</p>
          </div>
          <FloodSimulation />
        </div>
      </section>

      <section id="how" className="section">
        <div className="container">
          <div className="section-head">
            <h2>How it works</h2>
            <p>Three simple steps from real data to clear flood insights.</p>
          </div>
          <div className="arch">
            <div className="arch-step"><div className="arch-icon">1</div><h4>Real City Data</h4><small>Elevation, rainfall and streets</small></div>
            <div className="arch-arrow">→</div>
            <div className="arch-step"><div className="arch-icon">2</div><h4>Flood Simulation</h4><small>Rain becomes runoff and flow</small></div>
            <div className="arch-arrow">→</div>
            <div className="arch-step"><div className="arch-icon">3</div><h4>Clear Insights</h4><small>Depth and affected areas in 3D</small></div>
          </div>
        </div>
      </section>

      <section className="section dark" style={{ padding: "32px 20px" }}>
        <div className="container">
          <div className="sdg-grid" style={{ gridTemplateColumns: "repeat(4,1fr)" } as any}>
            <div className="sdg"><span>6</span><h4>Clean Water</h4><p>Smarter drainage</p></div>
            <div className="sdg"><span>9</span><h4>Innovation</h4><p>Geospatial platform</p></div>
            <div className="sdg"><span>11</span><h4>Sustainable Cities</h4><p>Resilient planning</p></div>
            <div className="sdg"><span>13</span><h4>Climate Action</h4><p>Adaptation ready</p></div>
          </div>
        </div>
      </section>

      <footer>
        <div className="container foot">
          <span>◈ FLOIN - Flood Intelligence for Chennai</span>
          <span className="mono">Built for clarity, planning and safety • 2026</span>
        </div>
      </footer>
    </>
  );
}
