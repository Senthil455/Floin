import './style.css'
import * as THREE from 'three'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

const $ = (s) => document.querySelector(s)
const clamp = (v, a, b) => Math.max(a, Math.min(b, v))

let heroScene, heroCamera, heroRenderer, heroWater, heroRaf
let simScene, simCamera, simRenderer, simWater, simTerrain, simBuildings, simRoads, simRaf
let playing = true
let timePhase = 0.45
const state = { P: 120, CN: 78, t: 45 }
const CHENNAI_BOUNDS = { xmin: 80.10, xmax: 80.35, ymin: 12.88, ymax: 13.25 }

function scs(P, CN) {
  const S = 25400 / CN - 254
  const Ia = 0.2 * S
  const Q = P <= Ia ? 0 : (P - Ia) ** 2 / (P + 0.8 * S)
  return { S, Ia, Q }
}
function depthFrom(Q, t) {
  const norm = clamp(Q / 120, 0, 1)
  const tF = 0.3 + 0.7 * (t / 100)
  return norm * 2.2 * tF
}
function lngLatToXZ(lng, lat, size = 14) {
  const nx = (lng - CHENNAI_BOUNDS.xmin) / (CHENNAI_BOUNDS.xmax - CHENNAI_BOUNDS.xmin)
  const ny = (lat - CHENNAI_BOUNDS.ymin) / (CHENNAI_BOUNDS.ymax - CHENNAI_BOUNDS.ymin)
  return [(nx - 0.5) * size, (ny - 0.5) * size]
}
function updateMetrics() {
  const { S, Ia, Q } = scs(state.P, state.CN)
  const d = depthFrom(Q, state.t)
  const vP = $('#vP'), vCN = $('#vCN'), vT = $('#vT')
  if (vP) vP.textContent = state.P
  if (vCN) vCN.textContent = state.CN
  if (vT) vT.textContent = state.t
  const mS = $('#mS'), mIa = $('#mIa'), mQ = $('#mQ'), mD = $('#mD'), mB = $('#mB'), mV = $('#mV')
  if (mS) mS.textContent = S.toFixed(2) + ' mm'
  if (mIa) mIa.textContent = Ia.toFixed(2) + ' mm'
  if (mQ) mQ.textContent = Q.toFixed(1) + ' mm'
  if (mD) mD.textContent = d.toFixed(2) + ' m'
  if (mB) mB.textContent = '~' + Math.round(80 + d * 900 + Q * 3).toLocaleString()
  if (mV) mV.textContent = (0.2 + d * 0.5).toFixed(1) + ' m/s'
  const hd = $('#hero-depth'), hr = $('#hero-runoff')
  if (hd) hd.textContent = d.toFixed(2) + ' m'
  if (hr) hr.textContent = Q.toFixed(0) + ' mm'
  updateWater(simWater, d)
  updateWater(heroWater, d)
}
function updateWater(water, d) {
  if (!water) return
  water.position.y = -0.9 + d * 0.9
  const mat = water.material
  if (d < 0.5) mat.color.set(0x0ea5e9)
  else if (d < 1.5) mat.color.set(0xf59e0b)
  else mat.color.set(0xef4444)
  mat.opacity = 0.35 + clamp(d / 2.5, 0, 1) * 0.35
}
function initSliders() {
  const sP = $('#sP'), sCN = $('#sCN'), sT = $('#sT')
  if (sP) sP.addEventListener('input', (e) => { state.P = +e.target.value; updateMetrics() })
  if (sCN) sCN.addEventListener('input', (e) => { state.CN = +e.target.value; updateMetrics() })
  if (sT) sT.addEventListener('input', (e) => { state.t = +e.target.value; timePhase = state.t / 100; updateMetrics() })
  const btnPlay = $('#btnPlay')
  if (btnPlay) btnPlay.addEventListener('click', () => {
    playing = !playing
    btnPlay.textContent = playing ? 'Pause' : 'Play'
    btnPlay.setAttribute('aria-pressed', String(playing))
  })
  const btnReset = $('#btnReset')
  if (btnReset) btnReset.addEventListener('click', () => {
    state.P = 120; state.CN = 78; state.t = 45
    if (sP) sP.value = 120; if (sCN) sCN.value = 78; if (sT) sT.value = 45
    timePhase = 0.45; updateMetrics()
  })
  const btnExport = $('#btnExport')
  if (btnExport) btnExport.addEventListener('click', () => {
    const { Q } = scs(state.P, state.CN)
    const d = depthFrom(Q, state.t)
    const gj = { type: 'FeatureCollection', features: [{ type: 'Feature', properties: { rainfall_mm: state.P, CN: state.CN, runoff_mm: +Q.toFixed(2), flood_depth_m: +d.toFixed(2), timestamp: new Date().toISOString() }, geometry: { type: 'Polygon', coordinates: [[[CHENNAI_BOUNDS.xmin, 13.0], [CHENNAI_BOUNDS.xmax, 13.0], [CHENNAI_BOUNDS.xmax, 13.15], [CHENNAI_BOUNDS.xmin, 13.15], [CHENNAI_BOUNDS.xmin, 13.0]]] } }] }
    const blob = new Blob([JSON.stringify(gj, null, 2)], { type: 'application/json' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'floin-snapshot.geojson'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000)
  })
}
function makeTerrain(size = 14, seg = 90) {
  const geo = new THREE.PlaneGeometry(size, size, seg, seg)
  const pos = geo.attributes.position
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i)
    const d = Math.hypot(x, y)
    let z = Math.sin(x * 0.6) * 0.6 + Math.cos(y * 0.7) * 0.5
    z += Math.sin(x * 1.3 + y * 0.9) * 0.25
    z -= clamp((d - 4) / 6, 0, 1) * 1.2
    z += (Math.random() - 0.5) * 0.06
    pos.setZ(i, z)
  }
  geo.computeVertexNormals()
  return geo
}
function createScene(canvas) {
  const w = canvas.clientWidth || 400, h = canvas.clientHeight || 280
  const scene = new THREE.Scene()
  scene.fog = new THREE.Fog(0x071220, 12, 30)
  const camera = new THREE.PerspectiveCamera(42, w / h, 0.1, 100)
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
  renderer.setSize(w, h, false)
  renderer.setClearColor(0x071220, 1)
  scene.add(new THREE.HemisphereLight(0xcde9ff, 0x0a1a2e, 0.9))
  const dir = new THREE.DirectionalLight(0xffffff, 1.0)
  dir.position.set(6, 10, 4); scene.add(dir)
  const terrainGeo = makeTerrain(14, 90)
  const tmat = new THREE.MeshStandardMaterial({ color: 0x1a3a2a, roughness: 0.95 })
  const terrain = new THREE.Mesh(terrainGeo, tmat)
  terrain.rotation.x = -Math.PI / 2; terrain.position.y = -1.2; scene.add(terrain)
  const wgeo = new THREE.PlaneGeometry(13.3, 13.3, 40, 40)
  const wmat = new THREE.MeshStandardMaterial({ color: 0x0ea5e9, transparent: true, opacity: 0.45, roughness: 0.2, side: THREE.DoubleSide })
  const water = new THREE.Mesh(wgeo, wmat)
  water.rotation.x = -Math.PI / 2; water.position.y = -0.4; scene.add(water)
  const buildingsGroup = new THREE.Group()
  const roadsGroup = new THREE.Group()
  scene.add(buildingsGroup); scene.add(roadsGroup)
  let drag = false, lastX = 0, lastY = 0, yaw = 0.7, pitch = 0.9, dist = 14
  function updateCam() {
    const x = Math.cos(yaw) * Math.sin(pitch) * dist
    const y = Math.cos(pitch) * dist
    const z = Math.sin(yaw) * Math.sin(pitch) * dist
    camera.position.set(x, y, z); camera.lookAt(0, -0.2, 0)
  }
  updateCam()
  canvas.addEventListener('pointerdown', (e) => { drag = true; lastX = e.clientX; lastY = e.clientY; canvas.setPointerCapture(e.pointerId) })
  canvas.addEventListener('pointerup', () => { drag = false })
  canvas.addEventListener('pointermove', (e) => {
    if (!drag) return
    yaw += (e.clientX - lastX) * 0.005
    pitch = clamp(pitch - (e.clientY - lastY) * 0.004, 0.25, 1.45)
    lastX = e.clientX; lastY = e.clientY; updateCam()
  })
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault(); dist = clamp(dist + e.deltaY * 0.01, 6, 24); updateCam()
  }, { passive: false })
  const ro = new ResizeObserver(() => {
    const W = canvas.clientWidth, H = canvas.clientHeight
    if (W === 0 || H === 0) return
    camera.aspect = W / H; camera.updateProjectionMatrix(); renderer.setSize(W, H, false)
  })
  ro.observe(canvas)
  return { scene, camera, renderer, terrain, water, buildingsGroup, roadsGroup }
}
async function loadVectors(buildingsGroup, roadsGroup, statusEl) {
  try {
    const [bRes, hRes, wRes] = await Promise.all([
      fetch('/buildings.geojson').then((r) => { if (!r.ok) throw new Error('buildings'); return r.json() }),
      fetch('/highway.geojson').then((r) => { if (!r.ok) throw new Error('roads'); return r.json() }),
      fetch('/waterway.geojson').then((r) => r.ok ? r.json() : { features: [] }).catch(() => ({ features: [] })),
    ])
    buildBuildings(buildingsGroup, bRes.features.slice(0, 400))
    buildRoads(roadsGroup, hRes.features.slice(0, 300).concat(wRes.features.slice(0, 80)))
    if (statusEl) {
      statusEl.textContent = `Loaded ${Math.min(400, bRes.features.length)} buildings - ${hRes.features.length} roads`
      setTimeout(() => { statusEl.style.display = 'none' }, 2500)
    }
  } catch {
    if (statusEl) statusEl.textContent = 'Using procedural demo data'
    buildProceduralBuildings(buildingsGroup)
  }
}
function buildBuildings(group, features) {
  group.clear()
  const mat = new THREE.MeshStandardMaterial({ color: 0x8aa0b8, roughness: 0.8 })
  const matHi = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.7 })
  features.forEach((f) => {
    const geom = f.geometry
    if (!geom) return
    const polys = geom.type === 'Polygon' ? [geom.coordinates] : geom.type === 'MultiPolygon' ? geom.coordinates : []
    polys.forEach((poly) => {
      const outer = poly[0]
      if (!outer || outer.length < 3) return
      const shape = new THREE.Shape()
      outer.forEach(([lng, lat], i) => {
        const [x, z] = lngLatToXZ(lng, lat)
        if (i === 0) shape.moveTo(x, z); else shape.lineTo(x, z)
      })
      const levels = parseInt(f.properties?.['building:levels']) || (2 + Math.floor(Math.random() * 3))
      const h = levels * 0.18 + Math.random() * 0.12
      const g = new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: false })
      g.rotateX(Math.PI / 2)
      const m = Math.random() > 0.7 ? matHi : mat
      const mesh = new THREE.Mesh(g, m)
      mesh.position.y = -1.05
      group.add(mesh)
    })
  })
}
function buildRoads(group, features) {
  group.clear()
  features.forEach((f) => {
    const g = f.geometry
    if (!g) return
    const lines = g.type === 'LineString' ? [g.coordinates] : g.type === 'MultiLineString' ? g.coordinates : g.type === 'Polygon' ? [g.coordinates[0]] : g.type === 'MultiPolygon' ? g.coordinates.map((p) => p[0]) : []
    lines.forEach((coords) => {
      if (!coords || coords.length < 2) return
      const pts = coords.map(([lng, lat]) => {
        const [x, z] = lngLatToXZ(lng, lat)
        return new THREE.Vector3(x, -0.92, z)
      })
      const geo = new THREE.BufferGeometry().setFromPoints(pts)
      const mat = new THREE.LineBasicMaterial({ color: 0xfacc15, transparent: true, opacity: 0.55 })
      group.add(new THREE.Line(geo, mat))
    })
  })
}
function buildProceduralBuildings(group) {
  group.clear()
  for (let i = 0; i < 80; i++) {
    const x = (Math.random() - 0.5) * 11, z = (Math.random() - 0.5) * 11
    const w = 0.15 + Math.random() * 0.25, d = 0.15 + Math.random() * 0.25, h = 0.25 + Math.random() * 0.7
    const g = new THREE.BoxGeometry(w, h, d)
    const m = new THREE.MeshStandardMaterial({ color: 0x94a3b8 })
    const mesh = new THREE.Mesh(g, m)
    mesh.position.set(x, -0.9 + h / 2, z)
    group.add(mesh)
  }
}
function animateHero() {
  heroRaf = requestAnimationFrame(animateHero)
  if (playing && heroWater) {
    timePhase = (timePhase + 0.0007) % 1
    const p = heroWater.geometry.attributes.position
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i)
      p.setZ(i, Math.sin(x * 1.2 + timePhase * 6) * 0.04 + Math.cos(y * 1.0 + timePhase * 5) * 0.03)
    }
    p.needsUpdate = true
  }
  if (heroRenderer && heroScene && heroCamera) heroRenderer.render(heroScene, heroCamera)
}
function animateSim() {
  simRaf = requestAnimationFrame(animateSim)
  if (playing) {
    timePhase = (timePhase + 0.0007) % 1
    if (document.activeElement?.tagName !== 'INPUT') {
      state.t = Math.round(30 + Math.sin(timePhase * Math.PI * 2) * 20 + timePhase * 15) % 100
      const sT = $('#sT'); if (sT) sT.value = state.t
      updateMetrics()
    }
    if (simWater) {
      const p = simWater.geometry.attributes.position
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), y = p.getY(i)
        p.setZ(i, Math.sin(x * 1.2 + timePhase * 6) * 0.04 + Math.cos(y * 1.0 + timePhase * 5) * 0.03)
      }
      p.needsUpdate = true
    }
  }
  if (simRenderer && simScene && simCamera) simRenderer.render(simScene, simCamera)
}

const heroCanvas = document.createElement('canvas')
heroCanvas.width = 560; heroCanvas.height = 280
heroCanvas.setAttribute('aria-label', 'Hero flood preview')
const heroPreview = $('#hero-preview')
if (heroPreview) heroPreview.appendChild(heroCanvas)
const heroCtx = createScene(heroCanvas)
heroScene = heroCtx.scene; heroCamera = heroCtx.camera; heroRenderer = heroCtx.renderer; heroWater = heroCtx.water
loadVectors(heroCtx.buildingsGroup, heroCtx.roadsGroup, null)
animateHero()

const simCanvas = $('#sim')
if (simCanvas) {
  const simCtx = createScene(simCanvas)
  simScene = simCtx.scene; simCamera = simCtx.camera; simRenderer = simCtx.renderer; simWater = simCtx.water; simTerrain = simCtx.terrain; simBuildings = simCtx.buildingsGroup; simRoads = simCtx.roadsGroup
  const statusEl = $('#sim-status')
  loadVectors(simBuildings, simRoads, statusEl)
  animateSim()
}

initSliders()
updateMetrics()

document.addEventListener('visibilitychange', () => {
  if (document.hidden) { if (heroRaf) cancelAnimationFrame(heroRaf); if (simRaf) cancelAnimationFrame(simRaf) }
  else { animateHero(); animateSim() }
})

async function initModule1Map() {
  const el = $('#m1-map')
  if (!el) return
  const map = L.map(el, { zoomControl: true }).setView([13.08, 80.27], 11)
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: 'OpenStreetMap', maxZoom: 18 }).addTo(map)
  const layers = {}
  const colors = { buildings: '#8b5cf6', highway: '#facc15', water: '#06b6d4', rainfall: '#ef4444' }
  async function load(name, file, style) {
    try {
      const r = await fetch('/' + file)
      if (!r.ok) throw new Error(file)
      const j = await r.json()
      const l = L.geoJSON(j, { style, onEachFeature: (f, ly) => ly.bindPopup(`<b>${f.properties?.name || f.properties?.highway || f.properties?.waterway || f.properties?.station || 'feature'}</b><br><small>${f.geometry.type}</small>`) }).addTo(map)
      layers[name] = l
      return j.features.length
    } catch { return 0 }
  }
  const c1 = await load('buildings', 'buildings.geojson', { color: colors.buildings, weight: 1, fillOpacity: 0.35 })
  const c2 = await load('highway', 'highway.geojson', { color: colors.highway, weight: 2, fillOpacity: 0.2 })
  const c3 = await load('water', 'natural_water.geojson', { color: colors.water, weight: 1, fillOpacity: 0.4 })
  try {
    const w = await fetch('/waterway.geojson').then((r) => r.json())
    L.geoJSON(w, { style: { color: colors.water, weight: 2 } }).addTo(map)
  } catch {}
  let c4 = 0
  try {
    const rj = await fetch('/rainfall_stations.geojson').then((r) => r.json())
    const rl = L.geoJSON(rj, { pointToLayer: (f, latlng) => L.circleMarker(latlng, { radius: 6 + f.properties.rainfall_mm / 40, fillColor: colors.rainfall, color: '#fff', weight: 1, fillOpacity: 0.85 }).bindPopup(`<b>${f.properties.station}</b><br>${f.properties.rainfall_mm} mm - CN ${f.properties.cn_zone}<br><small>${f.properties.intensity}</small>`) }).addTo(map)
    layers.rainfall = rl
    c4 = rj.features.length
  } catch {}
  const total = c1 + c2 + c3 + c4
  const countEl = $('#layer-count')
  if (countEl) countEl.textContent = total.toLocaleString() + ' features'
  setTimeout(() => map.invalidateSize(), 200)
  document.querySelectorAll('[data-layer]').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-layer]').forEach((b) => { b.className = 'btn btn-ghost'; b.setAttribute('aria-pressed', 'false') })
      btn.className = 'btn btn-primary'; btn.setAttribute('aria-pressed', 'true')
      const k = btn.dataset.layer
      Object.entries(layers).forEach(([name, l]) => {
        if (k === 'all' || k === name) { if (!map.hasLayer(l)) map.addLayer(l) } else if (map.hasLayer(l)) map.removeLayer(l)
      })
      const counts = { buildings: c1, highway: c2, water: c3, rainfall: c4, all: total }
      if (countEl) countEl.textContent = (counts[k] ?? total).toLocaleString() + ' features'
    })
  })
}
initModule1Map()

const m4Result = $('#m4-result')
if (m4Result) {
  fetch('/simulation-result.json').then((r) => r.ok ? r.json() : null).then((j) => {
    if (!j) return
    m4Result.textContent = `P=${j.P} CN=${j.CN} t=${j.t} -> Q=${j.Q} depth_max=${j.depth_max} flooded=${j.flood_pct}% velocity=${j.velocity_mean}`
  }).catch(() => {})
}
