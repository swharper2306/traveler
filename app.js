// Traveler’s Space Arcade — immersive edition (ISS + Docking + Missions)
const KID_NAME = "Traveler";
const SAVE_KEY = "traveler_space_arcade_v2"; // bump version so missions don't collide with old saves

// NASA API key (DEMO_KEY is fine for testing; for reliability make a free key at api.nasa.gov)
const NASA_KEY = "EY0x32jlX2stzDdedqe67P77g0qDefQnGiH8T8NE";

const ISS_PHOTOS = [
  "./assets/images/iss1.webp",
  "./assets/images/iss2.webp",
  "./assets/images/iss3.jpg",
];

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const clamp = (n,a,b) => Math.max(a, Math.min(b, n));
const rand = (a,b) => a + Math.random()*(b-a);

let soundOn = true;
let ttsOn = true;

function setupIssPhotos(){
  const img = document.getElementById("issPhoto");
  if(!img) return;

  // Pick a random one when the site loads
  const pick = ISS_PHOTOS[(Math.random() * ISS_PHOTOS.length) | 0];
  img.src = pick;

  // Tap to cycle photos (kid-friendly)
  img.style.cursor = "pointer";
  img.title = "Tap to change the ISS photo";
  img.addEventListener("click", ()=>{
    const next = ISS_PHOTOS[(Math.random() * ISS_PHOTOS.length) | 0];
    img.src = next;
  });
}

// ---------- SAVE ----------
const state = loadState();
function loadState(){
  try{
    const raw = localStorage.getItem(SAVE_KEY);
    if(!raw) throw 0;
    const s = JSON.parse(raw);

    // ensure defaults exist
    s.stars ??= 0;
    s.badges ??= {};
    s.bestMeteor ??= 0;
    s.bestRocket ??= 0;
    s.bestDock ??= 0;      // best docking score (lower is better)
    s.missions ??= {};     // mission completion flags
    s.planetSeen ??= {};   // track unique planets explored
    s.quizBestStreak ??= 0;
    return s;
  }catch{
    return {
      stars: 0,
      badges: {},
      bestMeteor: 0,
      bestRocket: 0,
      bestDock: 0,
      missions: {},
      planetSeen: {},
      quizBestStreak: 0
    };
  }
}
function save(){
  localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  renderHUD();
  renderBadges();
  renderMissions();
}
function addStars(n){
  state.stars += n;
  save();
}
function unlock(key, title, desc){
  if(state.badges[key]) return;
  state.badges[key] = { title, desc, when: Date.now() };
  confetti(40);
  beep(660,0.06,"triangle"); setTimeout(()=>beep(880,0.08,"triangle"),80);
  save();
}

// ---------- SOUND (simple beeps) ----------
const AudioCtx = window.AudioContext || window.webkitAudioContext;
let audioCtx;
function beep(freq=440, time=0.08, type="sine"){
  if(!soundOn) return;
  try{
    if(!audioCtx) audioCtx = new AudioCtx();
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = type;
    o.frequency.value = freq;
    o.connect(g);
    g.connect(audioCtx.destination);
    g.gain.setValueAtTime(0.0001, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.22, audioCtx.currentTime + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + time);
    o.start();
    o.stop(audioCtx.currentTime + time);
  }catch{}
}
function say(text){
  if(!ttsOn) return;
  if(!("speechSynthesis" in window)) return;
  try{
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 0.95; u.pitch = 1.05;
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  }catch{}
}

// ---------- CONFETTI ----------
function confetti(count=28){
  const colors = ["#22c55e","#60a5fa","#a78bfa","#f59e0b","#fb7185","#fde68a"];
  for(let i=0;i<count;i++){
    const c = document.createElement("div");
    c.style.position="fixed";
    c.style.top="-10px";
    c.style.left=(Math.random()*100)+"vw";
    c.style.width=(6+Math.random()*10)+"px";
    c.style.height=(10+Math.random()*14)+"px";
    c.style.background=colors[(Math.random()*colors.length)|0];
    c.style.borderRadius="3px";
    c.style.opacity=(0.6+Math.random()*0.4);
    c.style.zIndex=9999;
    c.style.pointerEvents="none";
    const dur=1200+Math.random()*1600;
    const rot=(Math.random()*720)|0;
    c.animate(
      [{transform:"translateY(0) rotate(0deg)"},
       {transform:`translateY(110vh) rotate(${rot}deg)`}],
      {duration:dur, easing:"linear", fill:"forwards"}
    );
    document.body.appendChild(c);
    setTimeout(()=>c.remove(), dur+200);
  }
}

// ---------- TABS ----------
function setupTabs(){
  $$(".tab").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      beep(660,0.05,"triangle");
      $$(".tab").forEach(b=>b.classList.remove("active"));
      btn.classList.add("active");
      const t = btn.dataset.tab;
      $$(".panel").forEach(p=>p.classList.remove("active"));
      const panel = $(`#tab-${t}`);
      if(panel) panel.classList.add("active");

      // Leaflet maps need a size invalidate after becoming visible
      if(t === "iss" && issMap){
        setTimeout(()=>{ try{ issMap.invalidateSize(); }catch{} }, 220);
      }
    });
  });
}

function openTab(tabName){
  const btn = $(`.tab[data-tab="${tabName}"]`);
  if(btn) btn.click();
}

// ---------- STARFIELD BACKGROUND ----------
function setupBG(){
  const c = $("#bg");
  if(!c) return;
  const ctx = c.getContext("2d");
  let w=0,h=0,dpr=1;
  const stars = [];
  const shoots = [];

  function resize(){
    dpr = clamp(window.devicePixelRatio||1, 1, 2);
    w = c.width = Math.floor(innerWidth*dpr);
    h = c.height = Math.floor(innerHeight*dpr);
    c.style.width = innerWidth+"px";
    c.style.height = innerHeight+"px";
    stars.length = 0;
    for(let i=0;i<260;i++){
      stars.push({ x:Math.random()*w, y:Math.random()*h, z:Math.random()*1+0.2, r:Math.random()*1.6+0.3, tw:Math.random()*6.28 });
    }
  }
  addEventListener("resize", resize, {passive:true});
  resize();

  let last = performance.now();
  function tick(now){
    const dt = clamp((now-last)/16.67, 0.6, 2.2);
    last = now;
    ctx.clearRect(0,0,w,h);

    for(const s of stars){
      s.y += (0.16*s.z)*dt*dpr;
      s.x += (0.05*s.z)*dt*dpr;
      s.tw += 0.03*dt;
      if(s.y>h+10) s.y=-10;
      if(s.x>w+10) s.x=-10;

      const tw = 0.55 + 0.45*Math.sin(s.tw);
      ctx.globalAlpha = 0.25 + 0.75*tw;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r*dpr, 0, Math.PI*2);
      ctx.fillStyle = "white";
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    if(Math.random()<0.015){
      shoots.push({ x:Math.random()*w*0.6, y:Math.random()*h*0.35, vx:(6+Math.random()*6)*dpr, vy:(3+Math.random()*5)*dpr, life:0 });
    }
    for(let i=shoots.length-1;i>=0;i--){
      const sh = shoots[i];
      sh.x += sh.vx*dt;
      sh.y += sh.vy*dt;
      sh.life += dt;

      ctx.globalAlpha = clamp(1 - sh.life/25, 0, 1);
      ctx.strokeStyle = "rgba(255,255,255,.9)";
      ctx.lineWidth = 2*dpr;
      ctx.beginPath();
      ctx.moveTo(sh.x, sh.y);
      ctx.lineTo(sh.x - 70*dpr, sh.y - 30*dpr);
      ctx.stroke();

      if(sh.x>w+200 || sh.y>h+200 || sh.life>30) shoots.splice(i,1);
    }
    ctx.globalAlpha = 1;

    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

// ---------- HUD / BADGES ----------
function renderHUD(){
  const starsEl = $("#stars");
  const badgesEl = $("#badges");
  const subline = $("#subline");
  if(starsEl) starsEl.textContent = String(state.stars);
  if(badgesEl) badgesEl.textContent = String(Object.keys(state.badges||{}).length);
  if(subline) subline.textContent = `Welcome, Commander ${KID_NAME} — tap a tab to play!`;
}

function renderBadges(){
  const grid = $("#badgeGrid");
  if(!grid) return;
  grid.innerHTML = "";

  const defs = [
    {k:"explorer",   t:"🪐 Planet Explorer",  d:"Explore 5 different planets"},
    {k:"discoverer", t:"✨ Space Discoverer", d:"Used Discover 10 times"},
    {k:"apod",       t:"📸 Cosmic Curator",   d:"Viewed a NASA space picture"},
    {k:"iss",        t:"🛰️ Satellite Scout",  d:"Tracked the ISS"},
    {k:"dock",       t:"🧩 Docking Pro",      d:"Docked successfully"},
    {k:"dockfast",   t:"⚡ Smooth Dock",      d:"Docked with a great score"},
    {k:"quiz",       t:"🧠 Planet Brain",     d:"Got a quiz right"},
    {k:"quizstreak", t:"🔥 Quiz Hot Streak",  d:"Got 8 quiz answers in a row"},
    {k:"rocket50",   t:"🚀 Upper Atmosphere", d:"Rocket reached 50 km"},
    {k:"rocket100",  t:"🌌 Space Bound",      d:"Rocket reached 100 km (space!)"},
    {k:"mission1",   t:"🎯 Mission Rookie",   d:"Completed 3 missions"},
    {k:"mission2",   t:"🏅 Mission Master",   d:"Completed all missions"},
  ];

  for(const b of defs){
    const owned = !!state.badges[b.k];
    const el = document.createElement("div");
    el.className = "badge" + (owned ? "" : " locked");
    el.innerHTML = `<div>${b.t}</div><div class="bdesc">${owned ? "UNLOCKED!" : b.d}</div>`;
    grid.appendChild(el);
  }
}

// ---------- TOP BUTTONS ----------
function setupTop(){
  const soundBtn = $("#soundBtn");
  const ttsBtn = $("#ttsBtn");
  const resetAll = $("#resetAll");

  if(soundBtn){
    soundBtn.addEventListener("click", ()=>{
      soundOn = !soundOn;
      soundBtn.textContent = soundOn ? "🔊 Sound: ON" : "🔇 Sound: OFF";
      beep(520,0.05,"square");
    });
  }

  if(ttsBtn){
    ttsBtn.addEventListener("click", ()=>{
      ttsOn = !ttsOn;
      ttsBtn.textContent = ttsOn ? "🗣️ Read: ON" : "🙊 Read: OFF";
      beep(330,0.05,"triangle");
    });
  }

  if(resetAll){
    resetAll.addEventListener("click", ()=>{
      localStorage.removeItem(SAVE_KEY);
      location.reload();
    });
    resetAll.classList.add("danger");
  }
}

// ================================
// PLANET EXPLORER (with stats + discover facts)
// ================================
const PLANETS = [
  {
    id:"mercury", emoji:"🪨", name:"Mercury", color:"#9ca3af",
    fact:"Mercury is the closest planet to the Sun. It’s super hot AND super cold!",
    stats:{ temp: 80, grav: 30, moons: 0 },
    discovers:[
      "A year on Mercury is only 88 Earth days!",
      "Mercury has no moons.",
      "It has lots of craters like our Moon."
    ]
  },
  {
    id:"venus", emoji:"🌕", name:"Venus", color:"#fbbf24",
    fact:"Venus is the hottest planet. It has thick clouds!",
    stats:{ temp: 100, grav: 90, moons: 0 },
    discovers:[
      "Venus is hotter than Mercury even though it’s farther from the Sun.",
      "Its clouds are very thick and trap heat.",
      "Venus spins very slowly!"
    ]
  },
  {
    id:"earth", emoji:"🌍", name:"Earth", color:"#60a5fa",
    fact:"Earth is our home. It has oceans, air, and lots of life!",
    stats:{ temp: 55, grav: 60, moons: 1 },
    discovers:[
      "Earth is the only world we know with lots of life.",
      "About 71% of Earth is covered in water!",
      "Earth has one Moon."
    ]
  },
  {
    id:"mars", emoji:"🔴", name:"Mars", color:"#fb7185",
    fact:"Mars is the Red Planet. It has huge volcanoes!",
    stats:{ temp: 35, grav: 35, moons: 2 },
    discovers:[
      "Mars has the largest volcano in the solar system: Olympus Mons!",
      "Mars has two tiny moons: Phobos and Deimos.",
      "Robots called rovers explore Mars."
    ]
  },
  {
    id:"jupiter", emoji:"🟠", name:"Jupiter", color:"#f59e0b",
    fact:"Jupiter is the biggest planet. It has a giant storm called the Great Red Spot!",
    stats:{ temp: 25, grav: 95, moons: 80 }, // simplified
    discovers:[
      "Jupiter is so big that all the other planets could fit inside it (almost).",
      "The Great Red Spot is a huge storm.",
      "Jupiter has lots and lots of moons!"
    ]
  },
  {
    id:"saturn", emoji:"🪐", name:"Saturn", color:"#fde68a",
    fact:"Saturn has rings made of ice and rock. It’s like a planet wearing a hula hoop!",
    stats:{ temp: 20, grav: 70, moons: 80 }, // simplified
    discovers:[
      "Saturn’s rings are made of ice chunks and rock.",
      "Saturn is very light for its size (it’s mostly gas).",
      "Saturn has many moons — Titan is a famous one!"
    ]
  },
  {
    id:"uranus", emoji:"🧊", name:"Uranus", color:"#93c5fd",
    fact:"Uranus is icy and spins kind of on its side. Weird and awesome!",
    stats:{ temp: 10, grav: 55, moons: 27 },
    discovers:[
      "Uranus spins on its side like a rolling ball.",
      "It’s very cold and very windy.",
      "It has faint rings too!"
    ]
  },
  {
    id:"neptune", emoji:"🔵", name:"Neptune", color:"#3b82f6",
    fact:"Neptune is very windy. Its storms can be super fast!",
    stats:{ temp: 8, grav: 65, moons: 14 },
    discovers:[
      "Neptune’s winds can be faster than a jet airplane.",
      "It’s the farthest planet from the Sun.",
      "Neptune looks blue because of its atmosphere."
    ]
  },
];

let planetClicks = 0;
let discoverCount = 0;
let lastPlanetId = "saturn";

function setupPlanets(){
  const row = $("#planetRow");
  if(!row) return;
  row.innerHTML = "";

  PLANETS.forEach(p=>{
    const b = document.createElement("button");
    b.className = "planetBtn";
    b.textContent = p.emoji;
    b.title = p.name;
    b.addEventListener("click", ()=> selectPlanet(p.id, true));
    row.appendChild(b);
  });

  const randomBtn = $("#randomPlanet");
  if(randomBtn){
    randomBtn.addEventListener("click", ()=>{
      const p = PLANETS[(Math.random()*PLANETS.length)|0];
      selectPlanet(p.id, true);
    });
  }

  const discoverBtn = $("#planetDiscover");
  if(discoverBtn){
    discoverBtn.addEventListener("click", ()=>{
      const p = PLANETS.find(x=>x.id===lastPlanetId) || PLANETS[0];
      const msg = p.discovers[(Math.random()*p.discovers.length)|0];
      $("#planetNote").textContent = `✨ Discover: ${msg}`;
      say(msg);
      discoverCount++;
      addStars(1);
      if(discoverCount >= 10) unlock("discoverer","✨ Space Discoverer","Used Discover 10 times");

      // mission check
      missionComplete("discover", true);
    });
  }

  const quizBtn = $("#planetQuiz");
  if(quizBtn){
    quizBtn.addEventListener("click", ()=>{
      beep(660,0.06,"triangle");
      say("Space quiz time!");
      openTab("quiz");
    });
  }

  // default
  selectPlanet("saturn", false);
}

function selectPlanet(id, reward){
  const p = PLANETS.find(x=>x.id===id);
  if(!p) return;
  lastPlanetId = id;

  // highlight
  const btns = $$(".planetBtn");
  btns.forEach((b,i)=>{
    b.classList.toggle("active", PLANETS[i].id===id);
  });

  const nameEl = $("#planetName");
  const factEl = $("#planetFact");
  if(nameEl) nameEl.textContent = `${p.emoji} ${p.name}`;
  if(factEl) factEl.textContent = p.fact;

  // big visual
  const big = $("#bigPlanet");
  if(big){
    big.innerHTML = "";
    const ball = document.createElement("div");
    ball.className = "planetBall";
    ball.style.background = `radial-gradient(110px 110px at 30% 30%, rgba(255,255,255,.25), transparent 55%), ${p.color}`;
    big.appendChild(ball);

    if(p.id === "saturn"){
      const rings = document.createElement("div");
      rings.className = "rings";
      big.appendChild(rings);
    }

    const spark = document.createElement("div");
    spark.className = "sparkle";
    for(let i=0;i<10;i++){
      const s = document.createElement("div");
      s.className = "spark";
      s.style.left = rand(5,95)+"%";
      s.style.top = rand(5,95)+"%";
      s.style.transform = `scale(${rand(0.6,1.2)})`;
      spark.appendChild(s);
    }
    big.appendChild(spark);
  }

  // stats placeholders in index.html
  const tempEl = $("#pTemp");
  const gravEl = $("#pGrav");
  const moonsEl = $("#pMoons");
  if(tempEl) tempEl.textContent = labelTemp(p.stats.temp);
  if(gravEl) gravEl.textContent = labelGrav(p.stats.grav);
  if(moonsEl) moonsEl.textContent = labelMoons(p.stats.moons);

  // track unique planets
  state.planetSeen[p.id] = true;
  const uniqueCount = Object.keys(state.planetSeen).length;

  if(reward){
    planetClicks++;
    addStars(1);
    beep(523,0.05,"triangle");
    say(`${p.name}. ${p.fact}`);

    // mission + badge logic
    missionProgress("planets", uniqueCount);
    if(uniqueCount >= 5) unlock("explorer","🪐 Planet Explorer","Explore 5 different planets");
  }
}

function labelTemp(v){
  // 0-100
  if(v >= 85) return "Very Hot 🔥";
  if(v >= 60) return "Warm ☀️";
  if(v >= 35) return "Mild 🙂";
  if(v >= 18) return "Cold 🧊";
  return "Super Cold ❄️";
}
function labelGrav(v){
  if(v >= 85) return "Heavy 💪";
  if(v >= 60) return "Strong 🙂";
  if(v >= 40) return "Light 🪶";
  return "Very Light 🫧";
}
function labelMoons(n){
  if(n === 0) return "None";
  if(n === 1) return "1";
  if(n <= 3) return "A few";
  if(n <= 20) return "Many";
  return "Tons!";
}

// ================================
// NASA PICS (APOD)
// ================================
let lastApodSpeak = "";

async function fetchApod(dateStr=null){
  const url = new URL("https://api.nasa.gov/planetary/apod");
  url.searchParams.set("api_key", NASA_KEY);
  if(dateStr) url.searchParams.set("date", dateStr);

  const res = await fetch(url.toString());
  if(!res.ok) throw new Error("APOD fetch failed");
  return await res.json();
}

function randomApodDate(){
  const start = new Date("1995-06-16T00:00:00");
  const end = new Date();
  const t = start.getTime() + Math.random() * (end.getTime() - start.getTime());
  const d = new Date(t);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth()+1).padStart(2,"0");
  const dd = String(d.getDate()).padStart(2,"0");
  return `${yyyy}-${mm}-${dd}`;
}

function kidifyApod(title, explanation){
  const short = (explanation || "").replace(/\s+/g," ").slice(0, 260);
  return `This space picture is called: ${title}. Here’s the fun part: ${short}${short.endsWith(".") ? "" : "…"} `;
}

function renderApod(d){
  const media = $("#apodMedia");
  if(!media) return;

  $("#apodTitle").textContent = d.title || "NASA Space Pic";
  $("#apodMeta").textContent = d.date ? `📅 ${d.date}` : "";

  const kidText = kidifyApod(d.title, d.explanation);
  $("#apodKid").textContent = kidText;
  lastApodSpeak = kidText;

  media.innerHTML = "";
  if(d.media_type === "video" && d.url){
    const iframe = document.createElement("iframe");
    iframe.src = d.url;
    iframe.title = d.title || "NASA Video";
    iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture";
    iframe.referrerPolicy = "no-referrer";
    iframe.style.border = "0";
    media.appendChild(iframe);
  } else if(d.url){
    const img = document.createElement("img");
    img.src = d.hdurl || d.url;
    img.alt = d.title || "NASA APOD";
    img.loading = "lazy";
    media.appendChild(img);
  } else {
    media.textContent = "No NASA picture available today.";
  }

  addStars(2);
  unlock("apod","📸 Cosmic Curator","Viewed a NASA space picture");
  missionComplete("nasa", true);
}

function setupApodUI(){
  const btnToday = $("#apodToday");
  const btnRandom = $("#apodRandom");
  const btnRead = $("#apodRead");
  if(!btnToday) return;

  btnToday.addEventListener("click", async ()=>{
    beep(660,0.06,"triangle");
    $("#apodMedia").textContent = "Loading NASA picture…";
    try{ renderApod(await fetchApod()); }
    catch{
      $("#apodMedia").textContent = "NASA is busy (or blocked). Try Random!";
      $("#apodKid").textContent = "If this keeps happening, you may be hitting a browser CORS limit on static sites.";
    }
  });

  btnRandom.addEventListener("click", async ()=>{
    beep(784,0.06,"triangle");
    const date = randomApodDate();
    $("#apodMedia").textContent = `Jumping to ${date}…`;
    try{ renderApod(await fetchApod(date)); confetti(18); }
    catch{
      $("#apodMedia").textContent = "Random jump failed. Try again!";
    }
  });

  btnRead.addEventListener("click", ()=>{
    beep(523,0.06,"sine");
    say(lastApodSpeak || `Hi ${KID_NAME}! Let’s look at space pictures!`);
  });

  // auto-load once
  btnToday.click();
}

// ================================
// ISS TRACKER (Leaflet map) + stats + Read button
// ================================
let issMap, issMarker, issAutoOn=false, issTimer=null;
let lastIssSpeak = "";

function setupIss(){
  const mapEl = $("#issMap");
  if(!mapEl || typeof L === "undefined") return;

  issMap = L.map("issMap", { worldCopyJump:true }).setView([0,0], 2);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 7,
    attribution: "&copy; OpenStreetMap contributors"
  }).addTo(issMap);

  issMarker = L.marker([0,0], {
    icon: L.divIcon({
      className: "issIcon",
      html: `<div style="width:34px;height:34px;border-radius:999px;
        background:rgba(96,165,250,.25);
        border:2px solid rgba(96,165,250,.8);
        display:grid;place-items:center;font-weight:950;">🛰️</div>`,
      iconSize:[34,34],
      iconAnchor:[17,17]
    })
  }).addTo(issMap);

  async function ping(){
    const res = await fetch("https://api.wheretheiss.at/v1/satellites/25544");
    if(!res.ok) throw new Error("ISS fetch failed");
    const data = await res.json();

    const lat = Number(data.latitude);
    const lon = Number(data.longitude);
    const alt = Number(data.altitude);   // km
    const vel = Number(data.velocity);   // km/h

    const nowStr = new Date().toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" });

    const latEl = $("#issLat"), lonEl = $("#issLon"), timeEl = $("#issTime");
    if(latEl) latEl.textContent = lat.toFixed(3);
    if(lonEl) lonEl.textContent = lon.toFixed(3);
    if(timeEl) timeEl.textContent = nowStr;

    const altEl = $("#issAlt"), velEl = $("#issVel"), orbitsEl = $("#issOrbits");
    if(altEl) altEl.textContent = isFinite(alt) ? alt.toFixed(0) : "—";
    if(velEl) velEl.textContent = isFinite(vel) ? vel.toFixed(0) : "—";

    // simple kid-friendly orbit estimate: period ~ 90 minutes -> ~16 orbits/day
    // if velocity/alt are present, we’ll keep it simple & stable (kids don’t care about perfect math)
    if(orbitsEl) orbitsEl.textContent = "≈16";

    issMarker.setLatLng([lat, lon]);
    issMap.panTo([lat, lon], { animate:true, duration: 0.6 });

    $("#issMsg").textContent = "There it is! The ISS is zooming around Earth!";
    addStars(2);
    unlock("iss","🛰️ Satellite Scout","Tracked the ISS");
    missionComplete("iss", true);

    lastIssSpeak = `The space station is at latitude ${lat.toFixed(1)} and longitude ${lon.toFixed(1)}. It is about ${alt.toFixed(0)} kilometers up, and it is moving about ${vel.toFixed(0)} kilometers per hour!`;
    beep(392,0.05,"square"); setTimeout(()=>beep(523,0.05,"square"),60);
  }

  const pingBtn = $("#issPing");
  if(pingBtn){
    pingBtn.addEventListener("click", ()=> ping().catch(()=>{
      $("#issMsg").textContent = "ISS ping failed. Try again!";
    }));
  }

  const autoBtn = $("#issAuto");
  if(autoBtn){
    autoBtn.addEventListener("click", async ()=>{
      issAutoOn = !issAutoOn;
      autoBtn.textContent = issAutoOn ? "Auto: ON" : "Auto: OFF";
      beep(330,0.06,"triangle");

      if(issAutoOn){
        $("#issMsg").textContent = "Auto mode ON — watch it move!";
        await ping().catch(()=>{});
        issTimer = setInterval(()=> ping().catch(()=>{}), 6000);
      } else {
        clearInterval(issTimer);
        issTimer = null;
        $("#issMsg").textContent = "Auto mode OFF.";
      }
    });
  }

  const readBtn = $("#issRead");
  if(readBtn){
    readBtn.addEventListener("click", ()=>{
      beep(523,0.06,"sine");
      say(lastIssSpeak || `The ISS is a science lab in space. Tap Ping to find it!`);
    });
  }

  // initial ping
  ping().catch(()=>{});
}

// ================================
// ISS DOCKING GAME (skill-based)
// ================================
let dockOn = false;
let dockX = 0;      // ship x offset
let dockVX = 0;     // sideways drift
let dockDist = 100; // distance to ISS (0 = dock)
let dockSpeed = 0.9; // approach speed
let dockBest = 0;
let dockLoop = null;
let dockStartTime = 0;

function setupDocking(){
  if(!$("#dockArena")) return;

  dockBest = state.bestDock || 0;
  $("#dockBest").textContent = dockBest ? `${dockBest.toFixed(1)}s` : "—";

  const startBtn = $("#dockStart");
  const leftBtn = $("#dockLeft");
  const rightBtn = $("#dockRight");
  const slowBtn = $("#dockSlow");
  const boostBtn = $("#dockBoost");
  const resetBtn = $("#dockReset");

  const shipEl = $("#dockShip");
  const issEl = $("#dockISS");
  const msgEl = $("#dockMsg");

  function reset(){
    dockOn = false;
    dockX = 0;
    dockVX = 0;
    dockDist = 110;
    dockSpeed = 0.9;
    updateUI();
    if(msgEl) msgEl.textContent = "Goal: match the lane and approach slowly. Too fast = bump!";
    if(dockLoop) cancelAnimationFrame(dockLoop);
    dockLoop = null;

    if(shipEl){
      shipEl.style.left = "50%";
      shipEl.style.bottom = "40px";
      shipEl.style.transform = "translateX(-50%)";
    }
  }

  function updateUI(){
    const distEl = $("#dockDist");
    const alignEl = $("#dockAlign");
    const speedEl = $("#dockSpeed");

    const align = Math.abs(dockX); // 0 = perfect
    if(distEl) distEl.textContent = `${Math.max(0, dockDist).toFixed(0)} m`;
    if(alignEl) alignEl.textContent = align < 6 ? "Perfect ✅" : align < 14 ? "Good 🙂" : "Off 😬";
    if(speedEl) speedEl.textContent = dockSpeed < 0.7 ? "Slow 🐢" : dockSpeed < 1.1 ? "Okay 🙂" : "Fast ⚠️";
  }

  function bump(){
    dockOn = false;
    document.body.classList.remove("docking-on");
    if(msgEl) msgEl.textContent = "BUMP! Too fast. Try slower! 🐢";
    beep(180,0.09,"sawtooth");
    confetti(10);
    if(dockLoop) cancelAnimationFrame(dockLoop);
    dockLoop = null;
  }

  function win(){
    dockOn = false;
    document.body.classList.remove("docking-on");
    const t = (performance.now() - dockStartTime) / 1000;
    if(msgEl) msgEl.textContent = `DOCKED! 🧩 Great job! Time: ${t.toFixed(1)}s`;
    say("Docking complete! Great job!");
    confetti(70);
    beep(660,0.06,"triangle"); setTimeout(()=>beep(880,0.08,"triangle"),80);

    addStars(8);
    unlock("dock","🧩 Docking Pro","Docked successfully");
    missionComplete("dock", true);

    // best score: lower time is better
    if(!dockBest || t < dockBest){
      dockBest = t;
      state.bestDock = dockBest;
      save();
      $("#dockBest").textContent = `${dockBest.toFixed(1)}s`;
      confetti(40);
      beep(740,0.06,"triangle");
    }

    if(t <= 12) unlock("dockfast","⚡ Smooth Dock","Docked with a great score");
  }

  function loop(){
    if(!dockOn) return;

    // sideways drift gently returns toward center unless user pushes
    dockVX *= 0.92;
    dockX += dockVX;

    // approach
    dockDist -= dockSpeed;

    // update visuals
    if(shipEl){
      shipEl.style.left = `calc(50% + ${dockX}px)`;
      // move ship upward as it approaches
      const up = clamp((110 - dockDist) * 2.4, 0, 280);
      shipEl.style.bottom = `${40 + up}px`;
    }

    updateUI();

    // docking checks near the end
    if(dockDist <= 0){
      const align = Math.abs(dockX);
      const safeSpeed = dockSpeed <= 0.85;
      if(align <= 10 && safeSpeed){
        win();
        return;
      } else {
        bump();
        return;
      }
    }

    dockLoop = requestAnimationFrame(loop);
  }

  function start(){
    reset();
    document.body.classList.remove("docking-on");
    dockOn = true;
    document.body.classList.add("docking-on");
    dockStartTime = performance.now();
    if(msgEl) msgEl.textContent = "Docking started! Line up and go slow near the end!";
    say("Docking started. Line up, and go slow.");
    beep(523,0.06,"triangle");
    dockLoop = requestAnimationFrame(loop);
  }

  const nudge = (dir)=>{
    if(!dockOn) return;
    dockVX += dir * 1.9;
    beep(440,0.03,"square");
  };

  const adjustSpeed = (delta)=>{
    if(!dockOn) return;
    dockSpeed = clamp(dockSpeed + delta, 0.45, 1.4);
    updateUI();
    beep(330,0.04,"triangle");
  };

  if(startBtn) startBtn.addEventListener("click", start);
  if(leftBtn) leftBtn.addEventListener("click", ()=> nudge(-1));
  if(rightBtn) rightBtn.addEventListener("click", ()=> nudge(1));
  if(slowBtn) slowBtn.addEventListener("click", ()=> adjustSpeed(-0.12));
  if(boostBtn) boostBtn.addEventListener("click", ()=> adjustSpeed(+0.12));
  if(resetBtn) resetBtn.addEventListener("click", reset);

  // keyboard support (nice on desktop)
  addEventListener("keydown", (e)=>{
    if(!dockOn) return;
    if(e.key === "ArrowLeft") nudge(-1);
    if(e.key === "ArrowRight") nudge(1);
    if(e.key === "ArrowDown") adjustSpeed(-0.08);
    if(e.key === "ArrowUp") adjustSpeed(+0.08);
  });

  reset();
}

// ================================
// MULTIPLE CHOICE SPACE QUIZ
// ================================
const QUIZ = [
  { q:"What is the Sun?", a:["A planet","A star","A moon","A spaceship"], c:1 },
  { q:"Which planet is the Red Planet?", a:["Mars","Neptune","Jupiter","Venus"], c:0 },
  { q:"What do we call Earth’s moon?", a:["Luna","Sol","Titan","Phobos"], c:0 },
  { q:"Which planet has rings?", a:["Earth","Saturn","Mercury","Mars"], c:1 },
  { q:"Which planet is the biggest?", a:["Jupiter","Mars","Earth","Venus"], c:0 },
  { q:"Where do astronauts live in space?", a:["ISS","Underwater","On the Sun","In a cave"], c:0 },
  { q:"What do rockets push out to go up?", a:["Cookies","Exhaust gas","Clouds","Leaves"], c:1 },
  { q:"What is a telescope for?", a:["Seeing far things","Cooking","Driving","Swimming"], c:0 },
  { q:"Which planet is closest to the Sun?", a:["Mercury","Mars","Saturn","Neptune"], c:0 },
  { q:"What is gravity?", a:["A pulling force","A snack","A song","A spaceship"], c:0 },
  { q:"What is the Moon?", a:["A planet","A star","A natural satellite","A rocket"], c:2 },
  { q:"What is a comet?", a:["Icy space rock","A puppy","A plane","A volcano"], c:0 },
  { q:"Which is a galaxy?", a:["Milky Way","Mount Everest","Pacific Ocean","Grand Canyon"], c:0 },
  { q:"What is an astronaut?", a:["Space explorer","Chef","Race car","Dinosaur"], c:0 },
];

let qScore=0, qStreak=0, qStars=0;
let currentQ=null;

function shuffle(arr){
  for(let i=arr.length-1;i>0;i--){
    const j = (Math.random()*(i+1))|0;
    [arr[i],arr[j]]=[arr[j],arr[i]];
  }
  return arr;
}

function pickQuestion(){
  currentQ = QUIZ[(Math.random()*QUIZ.length)|0];
  $("#qText").textContent = currentQ.q;
  $("#qMsg").textContent = "Pick an answer!";

  const answers = currentQ.a.map((txt, idx)=>({txt, idx}));
  shuffle(answers);

  const wrap = $("#qAnswers");
  if(!wrap) return;
  wrap.innerHTML = "";
  answers.forEach(({txt, idx})=>{
    const b = document.createElement("button");
    b.className = "answerBtn";
    b.textContent = txt;
    b.addEventListener("click", ()=> answerQuestion(idx, b));
    wrap.appendChild(b);
  });
}

function answerQuestion(chosenIdx, btn){
  const buttons = $$("#qAnswers .answerBtn");
  buttons.forEach(b=>b.disabled = true);

  if(chosenIdx === currentQ.c){
    btn.classList.add("correct");
    qScore++; qStreak++;
    state.quizBestStreak = Math.max(state.quizBestStreak || 0, qStreak);

    const starGain = (qStreak >= 5 ? 3 : 1);
    qStars += starGain;
    addStars(starGain);
    confetti(20);
    beep(660,0.06,"triangle"); setTimeout(()=>beep(880,0.08,"triangle"),80);

    $("#qMsg").textContent = qStreak >= 5
      ? `SUPER STREAK! 🔥 ${qStreak} in a row!`
      : "Correct! ⭐";

    if(qStreak >= 8) unlock("quizstreak","🔥 Quiz Hot Streak","Got 8 quiz answers in a row");
    if(qScore === 1) unlock("quiz","🧠 Planet Brain","Got a quiz right");

    missionProgress("quiz", qScore);
  } else {
    btn.classList.add("wrong");
    qStreak = 0;
    beep(180,0.08,"sawtooth");
    $("#qMsg").textContent = `Nice try! The right answer was: ${currentQ.a[currentQ.c]}`;
    buttons.forEach(b=>{
      if(b.textContent === currentQ.a[currentQ.c]) b.classList.add("correct");
    });
  }

  $("#qScore").textContent = String(qScore);
  $("#qStreak").textContent = String(qStreak);
  $("#qStars").textContent = String(qStars);

  setTimeout(pickQuestion, 1200);
}

function setupQuiz(){
  if(!$("#qNew")) return;
  $("#qNew").addEventListener("click", ()=>{ beep(523,0.06,"square"); pickQuestion(); });
  $("#qReset").addEventListener("click", ()=>{
    qScore=0; qStreak=0; qStars=0;
    $("#qScore").textContent="0";
    $("#qStreak").textContent="0";
    $("#qStars").textContent="0";
    $("#qMsg").textContent="Quiz reset! Let’s go!";
    confetti(15);
    beep(330,0.06,"triangle");
    pickQuestion();
  });
  pickQuestion();
}

// ================================
// ROCKET LAUNCH MINI-GAME (unchanged for now)
// ================================
let rocketFuel = 0;
let fueling = false;
let rocketLaunched = false;
let rocketAlt = 0;
let rocketVel = 0;
let rocketBest = 0;
let rocketRAF = null;
let rocketFuelTimer = null;

function setupRocket(){
  if(!$("#rocketStart")) return;

  rocketBest = state.bestRocket || 0;
  $("#rocketBest").textContent = String(rocketBest);

  $("#rocketStart").addEventListener("click", ()=>{
    resetRocketRound();
    $("#rocketMsg").textContent = "Hold Fuel to fill the tank, then press Launch!";
    say("Rocket ready. Hold to fuel, then launch!");
    beep(523,0.06,"triangle");
  });

  const holdBtn = $("#rocketHold");
  const startFuel = ()=>{
    if(rocketLaunched) return;
    fueling = true;
    $("#rocketMsg").textContent = "Fueling… keep holding!";
    igniteRocket(false);

    if(rocketFuelTimer) clearInterval(rocketFuelTimer);
    rocketFuelTimer = setInterval(()=>{
      if(!fueling) return;
      rocketFuel = clamp(rocketFuel + 2.2, 0, 100);
      updateFuelUI();
      if(rocketFuel >= 100){
        fueling = false;
        $("#rocketMsg").textContent = "Tank full! Press Launch! 🚀";
        beep(880,0.08,"triangle");
        confetti(12);
        clearInterval(rocketFuelTimer);
        rocketFuelTimer = null;
      } else {
        beep(220 + rocketFuel*2, 0.02, "sine");
      }
    }, 90);
  };

  const stopFuel = ()=>{
    fueling = false;
    if(rocketFuelTimer) clearInterval(rocketFuelTimer);
    rocketFuelTimer = null;
    if(!rocketLaunched) $("#rocketMsg").textContent = "Fuel paused. Hold again or press Launch.";
  };

  if(holdBtn){
    holdBtn.addEventListener("pointerdown", (e)=>{ e.preventDefault(); startFuel(); });
    holdBtn.addEventListener("pointerup", stopFuel);
    holdBtn.addEventListener("pointercancel", stopFuel);
    holdBtn.addEventListener("pointerleave", stopFuel);
  }

  $("#rocketLaunch")?.addEventListener("click", ()=>{
    if(rocketLaunched) return;
    if(rocketFuel < 10){
      $("#rocketMsg").textContent = "Need more fuel! Hold Fuel first. ⛽";
      beep(180,0.07,"sawtooth");
      return;
    }
    launchRocket();
  });

  $("#rocketAbort")?.addEventListener("click", ()=>{
    abortRocket();
  });

  updateFuelUI();
  updateRocketUI();
}

function updateFuelUI(){
  $("#rocketFuelText") && ($("#rocketFuelText").textContent = String(Math.round(rocketFuel)));
  const bar = $("#fuelBar");
  if(bar) bar.style.width = `${rocketFuel}%`;
}
function updateRocketUI(){
  $("#rocketAlt") && ($("#rocketAlt").textContent = String(Math.max(0, Math.round(rocketAlt))));
  $("#rocketBest") && ($("#rocketBest").textContent = String(Math.round(rocketBest)));
}

function igniteRocket(on){
  const rocket = $("#rocketReal");
  if(!rocket) return;
  rocket.classList.toggle("rocketIgnite", !!on);
}

function resetRocketRound(){
  rocketFuel = 0;
  fueling = false;
  rocketLaunched = false;
  rocketAlt = 0;
  rocketVel = 0;
  updateFuelUI();
  updateRocketUI();

  const rocket = $("#rocketReal");
  if(rocket) rocket.style.transform = "translateX(-50%) translateY(0px)";
  igniteRocket(false);

  if(rocketRAF) cancelAnimationFrame(rocketRAF);
  rocketRAF = null;

  if(rocketFuelTimer) clearInterval(rocketFuelTimer);
  rocketFuelTimer = null;
}

function abortRocket(){
  resetRocketRound();
  $("#rocketMsg").textContent = "Abort! Rocket reset. Try again.";
  beep(220,0.08,"square");
}

function launchRocket(){
  rocketLaunched = true;
  fueling = false;
  if(rocketFuelTimer) clearInterval(rocketFuelTimer);
  rocketFuelTimer = null;

  rocketVel = 0.9 + (rocketFuel / 12);
  const fuelBurn = rocketFuel;
  rocketFuel = 0;
  updateFuelUI();

  $("#rocketMsg").textContent = "LAUNCH! 🚀🚀🚀";
  say("Launch!");
  confetti(30);
  beep(330,0.08,"triangle"); setTimeout(()=>beep(494,0.08,"triangle"),80); setTimeout(()=>beep(659,0.10,"triangle"),160);

  igniteRocket(true);

  const rocket = $("#rocketReal");
  let last = performance.now();

  function step(now){
    const dt = clamp((now - last) / 16.67, 0.6, 2.2);
    last = now;

    rocketVel *= (1 - 0.006*dt);
    rocketVel -= 0.03*dt;
    rocketAlt += rocketVel * dt;

    if(rocket){
      const px = clamp(rocketAlt * 2.2, 0, 300);
      rocket.style.transform = `translateX(-50%) translateY(${-px}px)`;
    }

    updateRocketUI();

    if(rocketAlt >= 50) unlock("rocket50","🚀 Upper Atmosphere","Rocket reached 50 km");
    if(rocketAlt >= 100) unlock("rocket100","🌌 Space Bound","Rocket reached 100 km (space!)");

    if(rocketAlt > 0 && rocketVel > -0.4){
      rocketRAF = requestAnimationFrame(step);
      return;
    }

    igniteRocket(false);
    rocketAlt = Math.max(0, rocketAlt);
    updateRocketUI();

    const finalAlt = Math.round(Math.max(0, rocketAlt));
    $("#rocketMsg").textContent =
      finalAlt >= 100 ? `YOU REACHED SPACE! 🌌 (${finalAlt} km)` :
      finalAlt >= 50  ? `Great flight! (${finalAlt} km)` :
                        `Nice launch! (${finalAlt} km) Try more fuel!`;

    const starGain = clamp(Math.round(finalAlt / 25), 1, 8);
    addStars(starGain);

    if(finalAlt > rocketBest){
      rocketBest = finalAlt;
      state.bestRocket = rocketBest;
      save();
      confetti(60);
      beep(660,0.06,"triangle"); setTimeout(()=>beep(880,0.08,"triangle"),80);
    }
    if(fuelBurn >= 80) addStars(1);

    missionProgress("rocket", finalAlt);

    rocketLaunched = false;
    rocketVel = 0;
    rocketRAF = null;
  }

  rocketRAF = requestAnimationFrame(step);
}

// ================================
// MISSION BOARD (sticky loop)
// ================================
const MISSIONS = [
  { id:"iss",      title:"🛰️ Track the ISS",       hint:"Press Ping on the ISS tab.", reward: 5 },
  { id:"dock",     title:"🧩 Dock with the ISS",    hint:"Start docking and go slow near the end.", reward: 8 },
  { id:"planets",  title:"🪐 Explore 5 planets",    hint:"Tap 5 different planets.", reward: 6 },
  { id:"nasa",     title:"📸 View a NASA picture",  hint:"Use Today or Random.", reward: 5 },
  { id:"discover", title:"✨ Use Discover",         hint:"Press Discover 3 times.", reward: 4, target: 3 },
  { id:"quiz",     title:"🧠 Answer 5 quiz questions", hint:"Correct answers count.", reward: 6, target: 5 },
  { id:"rocket",   title:"🚀 Reach 100 km",         hint:"Launch and reach space.", reward: 8, target: 100 },
];

function missionComplete(id, truthy){
  if(!truthy) return;
  if(state.missions[id]) return;
  state.missions[id] = { done:true, when: Date.now(), progress:null };
  addStars(3);
  confetti(25);
  beep(660,0.06,"triangle");
  save();
  checkMissionBadges();
}

function missionProgress(id, value){
  // used for planet count, quiz correct count, rocket altitude, etc.
  const m = MISSIONS.find(x=>x.id===id);
  if(!m) return;

  const target = m.target ?? null;
  if(target == null) return;

  const current = Math.max(0, Number(value)||0);
  state.missions[id] ??= { done:false, when:null, progress:0 };
  state.missions[id].progress = Math.max(state.missions[id].progress || 0, current);

  if(current >= target){
    missionComplete(id, true);
  }else{
    save();
  }
}

function renderMissions(){
  const list = $("#missionList");
  if(!list) return;
  list.innerHTML = "";

  for(const m of MISSIONS){
    const st = state.missions[m.id];
    const done = !!st?.done;
    const progress = st?.progress ?? 0;

    const row = document.createElement("div");
    row.style.display = "flex";
    row.style.alignItems = "center";
    row.style.justifyContent = "space-between";
    row.style.gap = "10px";
    row.style.padding = "10px 12px";
    row.style.border = "1px solid rgba(255,255,255,.12)";
    row.style.borderRadius = "14px";
    row.style.background = done ? "rgba(34,197,94,.12)" : "rgba(255,255,255,.05)";
    row.style.marginBottom = "10px";

    const left = document.createElement("div");
    left.style.fontWeight = "950";
    left.textContent = done ? `✅ ${m.title}` : `⬜ ${m.title}`;

    const right = document.createElement("div");
    right.style.fontWeight = "950";
    right.style.color = "rgba(229,231,235,.85)";
    if(m.target != null && !done){
      right.textContent = `${progress}/${m.target}`;
    } else if(done){
      right.textContent = `+${m.reward}⭐`;
    } else {
      right.textContent = `${m.hint}`;
      right.style.fontWeight = "850";
      right.style.color = "rgba(229,231,235,.65)";
    }

    row.appendChild(left);
    row.appendChild(right);
    list.appendChild(row);
  }

  const msg = $("#missionMsg");
  if(msg){
    const doneCount = Object.values(state.missions).filter(x=>x?.done).length;
    msg.textContent = doneCount >= MISSIONS.length
      ? "ALL MISSIONS COMPLETE! 🏅"
      : `Missions complete: ${doneCount}/${MISSIONS.length}`;
  }
}

function setupMissions(){
  if(!$("#missionList")) return;

  $("#missionRead")?.addEventListener("click", ()=>{
    beep(523,0.06,"sine");
    const doneCount = Object.values(state.missions).filter(x=>x?.done).length;
    const next = MISSIONS.find(m=>!state.missions[m.id]?.done);
    const speak = next
      ? `You have completed ${doneCount} missions. Next mission is: ${next.title}. Hint: ${next.hint}`
      : `You completed all missions! Amazing job, Commander ${KID_NAME}!`;
    say(speak);
  });

  $("#missionReset")?.addEventListener("click", ()=>{
    state.missions = {};
    save();
    confetti(20);
    beep(220,0.08,"square");
  });

  renderMissions();
}

function checkMissionBadges(){
  const doneCount = Object.values(state.missions).filter(x=>x?.done).length;
  if(doneCount >= 3) unlock("mission1","🎯 Mission Rookie","Completed 3 missions");
  if(doneCount >= MISSIONS.length) unlock("mission2","🏅 Mission Master","Completed all missions");
}

// ================================
// LEGACY: Aliens/Meteors (kept, but guarded so it won't crash if elements are hidden)
// ================================
function setupAliens(){
  if(!$("#alienStart")) return;
  // legacy listeners remain if panel exists
}
function setupMeteors(){
  if(!$("#meteorStart")) return;
  // legacy listeners remain if panel exists
}

// ---------- INIT ----------
function init(){
  setupTabs();
  setupBG();
  setupTop();
  setupPlanets();
  setupDocking();
  setupRocket();
  setupAliens();   // safe no-op if hidden
  setupMeteors();  // safe no-op if hidden
  setupApodUI();
  setupIss();
  setupQuiz();
  setupMissions();
  setupIssPhotos();


  // disco button (simple class toggle)
  const disco = document.createElement("button");
  disco.className = "chip";
  disco.textContent = "🪩 Cosmic Mode";
  disco.addEventListener("click", ()=>{
    document.body.classList.toggle("disco");
    confetti(30);
    beep(330,0.06,"triangle");
    setTimeout(()=>beep(392,0.06,"triangle"),70);
    setTimeout(()=>beep(494,0.08,"triangle"),140);
  });

  // Put disco at the front of the HUD
  const hud = document.querySelector(".hud");
  if(hud && $("#soundBtn")) hud.insertBefore(disco, $("#soundBtn"));

  renderHUD();
  renderBadges();
  renderMissions();
  checkMissionBadges();
}
init();
