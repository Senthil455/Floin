---
# FLOIN DESIGN BUNDLE — Swiss Technical Ledger
# This is the single source of truth. No UI is built without reading this.

aesthetic: swiss-technical-ledger
archetype: [Sage, Ruler]
reference:
  - QGIS + Grafana + Bloomberg Terminal (dense, utilitarian, no marketing fluff)
  - Swiss Neo-Monolith (zero radius, hard rules, CAD indexing, 40/60 asymmetry)
  - ISRO/NRSC survey ledgers (ink on paper, revision colophon, mono telemetry)
direction: "A developer's field instrument, not a startup landing page. Ink on warm paper. Every pixel earns its place. If it doesn't help an engineer decide whether to evacuate a basin, it doesn't ship."
palette:
  dominant: "warm paper #F8F6F1 (oklch 0.98 0.02 80) — 60%"
  neutral: "surface #FFFFFF, rule #E6E1D8, muted #6B6B63, ink #111210 — 30%"
  accent: "vermillion #E63946 (oklch 0.62 0.22 25) — <10%, only for flood/danger, never decoration"
  semantic:
    hydro: "#0E7490 (oklch 0.55 0.12 220) — water/data, not brand"
    brass: "#8B7355 — neutral accent for borders, never CTA"
    signal: "#1A7F3D — success/verified, only for NSE/validaded"
    ink: "#111210"
  banned: ["indigo-600", "violet-500", "blue-600→indigo-700 gradient", "pure #fff/#000", "neon cyan glow", "glass blur"]
typography:
  display: "Instrument Serif (400/600) — headings, ledger titles"
  body: "IBM Plex Sans (400/500/600) — UI, tables, controls"
  mono: "IBM Plex Mono (400/500) / JetBrains Mono — every number, coordinate, telemetry, CAD tag"
  scale: "1.25 (apps) — 12/14/16/20/24/30/36, body ≥14px, measure 60-72ch"
  rules: ["no Inter/Poppins/Geist/Space Grotesk", "no single serif-italic accent word", "no ALL CAPS without tracking 0.12em", "text-wrap: balance on headings"]
radius: "0 (hard 90°) — only exception: 2px status pulse. No rounded-2xl."
elevation: "rules (1px solid #E6E1D8) > bg-shift (paper→white) > hard offset (1px ink). Never blur, never gradient, never soft shadow on everything."
spacing: "4pt base, dense. Section 24/32, component 12/16, compact tables. Hero py-20 is banned."
layout: "Asymmetric master-detail (38/62 or 30/70), never centered stack. CAD index 01// per section. 8pt grid, but dense — settings panel ≠ hero breathing room."
motion: "200ms ease-out, transform/opacity only, prefers-reduced-motion honored. No opacity+translateY(20) on every element."
components:
  card: "borderless by default: whitespace → bg-shift → hard rule. One radius site-wide. No card-in-card, no colored left strip, no icon-in-circle above heading."
  icon: "Stroke SVG 16-20px, currentColor, never emoji."
  button: "Primary=ink bg + white text + 1px ink border + hard press (translate 1px). Hover = brass rule, not glow. Must have :active, :focus-visible, :disabled."
  table: "Ledger tables with hairline rules, mono numbers right-aligned, no card wrappers."
donts:
  - "No indigo/violet gradient, no glassmorphism, no floating orbs, no neon glow"
  - "No rounded-2xl shadow-lg p-6 on every surface"
  - "No centered hero + badge above H1 + 3 equal cards"
  - "No bento grid by default"
  - "No emoji as iconography"
  - "No Inter everywhere"
  - "No decorative one-word serif italic highlight"
  - "No warm ivory/olive editorial unless justified — this is industrial, not café"
  - "No token role drift: vermillion = flood only, hydro = water only, brass = rule only"
a11y: "APCA Lc ≥75 body, ≥60 large, ≥45 UI. Real labels, landmark, focus ring 2px ink. Measured, not eyeballed."
---

# FLOIN — Why this direction

Chennai flood intelligence is not a SaaS to sell. It is a survey instrument for engineers deciding evacuation corridors under time pressure. The interface must read like a QGIS project and a printed NRSC ledger at once: dense, credible, printable, and instant to scan. Warm paper grounds the data, ink carries hierarchy, vermillion cuts through only when depth >0.8m or NSE < validated. Every number is mono, right-aligned, with unit. Every section opens `01 //` so an engineer can point to it on a call.

If you swap the logo for a coffee shop and it still feels plausible, the design has failed — it must feel wrong anywhere but a river basin.
