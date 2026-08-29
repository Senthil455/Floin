import './style.css'
import * as THREE from 'three'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

const $ = s => document.querySelector(s)
const clamp = (v,a,b)=>Math.max(a,Math.min(b,v))

let scene, camera, renderer, terrain, water, buildingsGroup, roadsGroup
let raf, playing = true, timePhase = 0.45

const state = { P:120, CN:78, t:45 }

function scs(P, CN){
  const S = (25400/CN)-254
  const Ia = 0.2*S
  let Q=0
  if(P>Ia) Q = Math.pow(P-Ia,2)/(P+0.8*S)
  return {S,Ia,Q}
}
function depthFrom(Q, t){
  const norm = clamp(Q/120,0,1)
  const timeFactor = 0.3 + 0.7*(t/100)
  return norm * 2.2 * timeFactor
}

function updateMetrics(){
  const {S,Ia,Q}=scs(state.P, state.CN)
  const d = depthFrom(Q, state.t)
  $('#vP').textContent=state.P
  $('#vCN').textContent=state.CN
  $('#vT').textContent=state.t
  $('#mS').textContent=S.toFixed(2)+' mm'
  $('#mIa').textContent=Ia.toFixed(2)+' mm'
  $('#mQ').textContent=Q.toFixed(1)+' mm'
  $('#mD').textContent=d.toFixed(2)+' m'
  $('#mB').textContent='~'+Math.round(80 + d*900 + Q*3)
  $('#mV').textContent=(0.2+d*0.5).toFixed(1)+' m/s'
  const hd=$('#hero-depth'), hr=$('#hero-runoff')
  if(hd) hd.textContent=d.toFixed(2)+' m'
  if(hr) hr.textContent=Q.toFixed(0)+' mm'
  if(water){
    const y = -0.9 + d*0.9
    water.position.y = y
    const mat = water.material
    if(d<0.5) mat.color.set(0x0ea5e9)
    else if(d<1.5) mat.color.set(0xf59e0b)
    else mat.color.set(0xef4444)
    mat.opacity = 0.35 + clamp(d/2.5,0,1)*0.35
  }
}

function initSliders(){
  $('#sP').addEventListener('input', e=>{state.P=+e.target.value;updateMetrics()})
  $('#sCN').addEventListener('input', e=>{state.CN=+e.target.value;updateMetrics()})
  $('#sT').addEventListener('input', e=>{state.t=+e.target.value; timePhase=state.t/100; updateMetrics()})
  $('#btnPlay').addEventListener('click', ()=>{
    playing=!playing
    $('#btnPlay').textContent=playing?'⏸ Pause':'▶ Play'
  })
  $('#btnReset').addEventListener('click', ()=>{
    state.P=120;state.CN=78;state.t=45
    $('#sP').value=120;$('#sCN').value=78;$('#sT').value=45
    timePhase=0.45
    updateMetrics()
  })
  $('#btnExport').addEventListener('click', ()=>{
    const {Q}=scs(state.P,state.CN)
    const d=depthFrom(Q,state.t)
    const gj={type:"FeatureCollection",features:[{type:"Feature",properties:{rainfall_mm:state.P,CN:state.CN,runoff_mm:+Q.toFixed(2),flood_depth_m:+d.toFixed(2),timestamp:new Date().toISOString()},geometry:{type:"Polygon",coordinates:[[[80.15,13.0],[80.35,13.0],[80.35,13.15],[80.15,13.15],[80.15,13.0]]]}}]}
    const blob=new Blob([JSON.stringify(gj,null,2)],{type:'application/json'})
    const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='floin-snapshot.geojson';a.click()
  })
}

function createScene(canvas, opts={hero:false}){
  const w=canvas.clientWidth||400, h=canvas.clientHeight||280
  scene=new THREE.Scene()
  scene.fog=new THREE.Fog(0x071220, 12, 30)
  camera=new THREE.PerspectiveCamera(42, w/h, 0.1, 100)
  camera.position.set(opts.hero?6:8, 6, 8)
  camera.lookAt(0,0,0)
  renderer=new THREE.WebGLRenderer({canvas, antialias:true, alpha:true})
  renderer.setPixelRatio(Math.min(devicePixelRatio,2))
  renderer.setSize(w,h,false)
  renderer.setClearColor(0x071220,1)

  scene.add(new THREE.HemisphereLight(0xcde9ff, 0x0a1a2e, 0.9))
  const dir=new THREE.DirectionalLight(0xffffff,1.0)
  dir.position.set(6,10,4); scene.add(dir)

  const size=14, seg=90
  const geo=new THREE.PlaneGeometry(size,size,seg,seg)
  const pos=geo.attributes.position
  for(let i=0;i<pos.count;i++){
    const x=pos.getX(i), y=pos.getY(i)
    const d=Math.hypot(x,y)
    let z = Math.sin(x*0.6)*0.6 + Math.cos(y*0.7)*0.5
    z += Math.sin(x*1.3+y*0.9)*0.25
    z -= clamp((d-4)/6,0,1)*1.2
    z += (Math.random()-0.5)*0.06
    pos.setZ(i,z)
  }
  geo.computeVertexNormals()
  const tmat=new THREE.MeshStandardMaterial({color:0x1a3a2a, roughness:0.95, metalness:0, flatShading:false, wireframe:false})
  tmat.onBeforeCompile = sh=>{
    sh.vertexColors=false
  }
  terrain=new THREE.Mesh(geo,tmat)
  terrain.rotation.x=-Math.PI/2
  terrain.position.y=-1.2
  scene.add(terrain)

  const wgeo=new THREE.PlaneGeometry(size*0.95,size*0.95,40,40)
  const wmat=new THREE.MeshStandardMaterial({color:0x0ea5e9, transparent:true, opacity:0.45, roughness:0.2, metalness:0.1, side:THREE.DoubleSide})
  water=new THREE.Mesh(wgeo,wmat)
  water.rotation.x=-Math.PI/2
  water.position.y=-0.4
  scene.add(water)

  buildingsGroup=new THREE.Group()
  roadsGroup=new THREE.Group()
  scene.add(buildingsGroup)
  scene.add(roadsGroup)

  let drag=false, lastX=0, lastY=0, yaw=0.7, pitch=0.9, dist=14
  function updateCam(){
    const x=Math.cos(yaw)*Math.sin(pitch)*dist
    const y=Math.cos(pitch)*dist
    const z=Math.sin(yaw)*Math.sin(pitch)*dist
    camera.position.set(x,y,z)
    camera.lookAt(0,-0.2,0)
  }
  updateCam()
  canvas.addEventListener('pointerdown', e=>{drag=true;lastX=e.clientX;lastY=e.clientY;canvas.setPointerCapture(e.pointerId)})
  canvas.addEventListener('pointerup', ()=>drag=false)
  canvas.addEventListener('pointermove', e=>{
    if(!drag) return
    yaw += (e.clientX-lastX)*0.005
    pitch = clamp(pitch - (e.clientY-lastY)*0.004, 0.25, 1.45)
    lastX=e.clientX;lastY=e.clientY;updateCam()
  })
  canvas.addEventListener('wheel', e=>{
    e.preventDefault()
    dist=clamp(dist+e.deltaY*0.01,6,24)
    updateCam()
  },{passive:false})
  window.addEventListener('resize', ()=>{
    const W=canvas.clientWidth, H=canvas.clientHeight
    camera.aspect=W/H;camera.updateProjectionMatrix()
    renderer.setSize(W,H,false)
  })
  return {scene,camera,renderer,water}
}

function lngLatToXZ(lng,lat, size=14){
  const xmin=80.15, xmax=80.35, ymin=12.95, ymax=13.15
  const nx=(lng - xmin)/(xmax - xmin)
  const ny=(lat - ymin)/(ymax - ymin)
  return [(nx-0.5)*size, (ny-0.5)*size]
}

async function loadVectors(){
  try{
    const [bRes, hRes, wRes]=await Promise.all([
      fetch('/buildings.geojson').then(r=>r.json()),
      fetch('/highway.geojson').then(r=>r.json()),
      fetch('/waterway.geojson').then(r=>r.json()).catch(()=>({features:[]}))
    ])
    buildBuildings(bRes.features.slice(0,400))
    buildRoads(hRes.features.slice(0,300).concat(wRes.features.slice(0,80)))
    $('#sim-status').textContent = `Loaded ${Math.min(400,bRes.features.length)} buildings • ${hRes.features.length} roads`
    setTimeout(()=>$('#sim-status').style.display='none',2500)
  }catch(e){
    $('#sim-status').textContent='Using procedural demo data (geojson not found)'
    buildProceduralBuildings()
  }
}

function buildBuildings(features){
  buildingsGroup.clear()
  const mat=new THREE.MeshStandardMaterial({color:0x8aa0b8, roughness:0.8})
  const matHi=new THREE.MeshStandardMaterial({color:0xcbd5e1, roughness:0.7})
  features.forEach(f=>{
    const geom=f.geometry
    if(!geom) return
    const polys = geom.type==='Polygon' ? [geom.coordinates] : geom.type==='MultiPolygon' ? geom.coordinates : []
    polys.forEach(poly=>{
      const outer=poly[0]
      if(!outer || outer.length<3) return
      const shape=new THREE.Shape()
      outer.forEach(([lng,lat],i)=>{
        const [x,z]=lngLatToXZ(lng,lat)
        if(i===0) shape.moveTo(x,z); else shape.lineTo(x,z)
      })
      const levels=parseInt(f.properties?.['building:levels'])|| (2+Math.floor(Math.random()*3))
      const h=levels*0.18 + Math.random()*0.12
      const g=new THREE.ExtrudeGeometry(shape,{depth:h, bevelEnabled:false})
      g.rotateX(Math.PI/2)
      const m=Math.random()>0.7?matHi:mat
      const mesh=new THREE.Mesh(g,m)
      mesh.position.y=-1.05
      buildingsGroup.add(mesh)
    })
  })
}

function buildRoads(features){
  roadsGroup.clear()
  features.forEach(f=>{
    const g=f.geometry
    if(!g) return
    const lines = g.type==='LineString' ? [g.coordinates] : g.type==='MultiLineString' ? g.coordinates : g.type==='Polygon' ? [g.coordinates[0]] : g.type==='MultiPolygon' ? g.coordinates.map(p=>p[0]) : []
    lines.forEach(coords=>{
      if(!coords || coords.length<2) return
      const pts=coords.map(([lng,lat])=>{
        const [x,z]=lngLatToXZ(lng,lat)
        return new THREE.Vector3(x,-0.92,z)
      })
      const geo=new THREE.BufferGeometry().setFromPoints(pts)
      const mat=new THREE.LineBasicMaterial({color:0xfacc15, transparent:true, opacity:0.55})
      roadsGroup.add(new THREE.Line(geo,mat))
    })
  })
}

function buildProceduralBuildings(){
  buildingsGroup.clear()
  for(let i=0;i<80;i++){
    const x=(Math.random()-0.5)*11, z=(Math.random()-0.5)*11
    const w=0.15+Math.random()*0.25, d=0.15+Math.random()*0.25, h=0.25+Math.random()*0.7
    const g=new THREE.BoxGeometry(w,h,d)
    const m=new THREE.MeshStandardMaterial({color:0x94a3b8})
    const mesh=new THREE.Mesh(g,m)
    mesh.position.set(x,-0.9+h/2,z)
    buildingsGroup.add(mesh)
  }
}

function animate(){
  raf=requestAnimationFrame(animate)
  if(playing){
    timePhase = (timePhase + 0.0007) % 1
    if(document.activeElement?.tagName!=='INPUT'){
      state.t = Math.round(30 + Math.sin(timePhase*Math.PI*2)*20 + timePhase*15) % 100
      const sT=$('#sT'); if(sT) sT.value=state.t
      updateMetrics()
    }
    if(water){
      const p=water.geometry.attributes.position
      for(let i=0;i<p.count;i++){
        const x=p.getX(i), y=p.getY(i)
        p.setZ(i, Math.sin(x*1.2+timePhase*6)*0.04 + Math.cos(y*1.0+timePhase*5)*0.03)
      }
      p.needsUpdate=true
      water.geometry.computeVertexNormals()
    }
  }
  renderer.render(scene,camera)
}

const heroCanvas=document.createElement('canvas')
heroCanvas.width=560;heroCanvas.height=280
$('#hero-preview').appendChild(heroCanvas)
createScene(heroCanvas,{hero:true})
loadVectors().then(()=>{})
animate()

setTimeout(()=>{
  const simCanvas=$('#sim')
  cancelAnimationFrame(raf)
  scene=null
  createScene(simCanvas,{hero:false})
  loadVectors().then(()=>{})
  updateMetrics()
  animate()
}, 800)

initSliders()
updateMetrics()

new ResizeObserver(()=>{
  if(renderer && scene){
    const c=renderer.domElement
    const w=c.clientWidth, h=c.clientHeight
    camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h,false)
  }
}).observe(document.body)

async function initModule1Map(){
  const el=$('#m1-map')
  if(!el) return
  const map=L.map(el).setView([13.08,80.27],12)
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OSM',maxZoom:18}).addTo(map)
  const layers={}
  const colors={buildings:'#8b5cf6',highway:'#facc15',water:'#06b6d4'}
  async function load(name, file, style){
    try{
      const j=await fetch('/'+file).then(r=>r.json())
      const l=L.geoJSON(j,{style:style, onEachFeature:(f,ly)=>ly.bindPopup(`<b>${f.properties?.name||f.properties?.highway||f.properties?.waterway||'feature'}</b><br><small class=mono>${f.geometry.type}</small>`)}).addTo(map)
      layers[name]=l
      return j.features.length
    }catch(e){ return 0}
  }
  const c1=await load('buildings','buildings.geojson',{color:colors.buildings,weight:1,fillOpacity:0.35})
  const c2=await load('highway','highway.geojson',{color:colors.highway,weight:2,fillOpacity:0.2})
  const c3=await load('water','natural_water.geojson',{color:colors.water,weight:1,fillOpacity:0.4})
  try{ const w=await fetch('/waterway.geojson').then(r=>r.json()); L.geoJSON(w,{style:{color:colors.water,weight:2}}).addTo(map)}catch(e){}
  const c4=await load('rainfall','rainfall_stations.geojson',{color:'#f59e0b',weight:2,fillOpacity:0.9})
  try{
    const rj=await fetch('/rainfall_stations.geojson').then(r=>r.json())
    L.geoJSON(rj,{pointToLayer:(f,latlng)=>L.circleMarker(latlng,{radius:6+ (f.properties.rainfall_mm/40),fillColor:'#ef4444',color:'#fff',weight:1,fillOpacity:0.85}).bindPopup(`<b>${f.properties.station}</b><br>${f.properties.rainfall_mm} mm • CN ${f.properties.cn_zone}<br><small>${f.properties.intensity}</small>`) }).addTo(map)
  }catch(e){}
  const total=c1+c2+c3+c4
  $('#layer-count').textContent=total.toLocaleString()+' features'
  setTimeout(()=>map.invalidateSize(),200)
  document.querySelectorAll('[data-layer]').forEach(btn=>{
    btn.addEventListener('click',()=>{
      document.querySelectorAll('[data-layer]').forEach(b=>b.className='btn btn-ghost')
      btn.className='btn btn-primary'
      const k=btn.dataset.layer
      Object.entries(layers).forEach(([name,l])=>{
        if(k==='all' || k===name) map.addLayer(l); else map.removeLayer(l)
      })
      const counts={buildings:c1,highway:c2,water:c3,rainfall:c4,all:total}
      $('#layer-count').textContent=(counts[k]||total).toLocaleString()+' features'
    })
  })
}
initModule1Map()
