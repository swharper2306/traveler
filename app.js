// Traveler’s Space Arcade — small, fun, and actually interactive
const KID_NAME = "Traveler";
const SAVE_KEY = "traveler_space_arcade_v1";

// NASA API key (DEMO_KEY is fine for testing; for reliability make a free key at api.nasa.gov) :contentReference[oaicite:2]{index=2}
const NASA_KEY = "DEMO_KEY";

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const clamp = (n,a,b) => Math.max(a, Math.min(b, n));
const rand = (a,b) => a + Math.random()*(b-a);

let soundOn = true;
let ttsOn = true;

// ---------- SAVE ----------
const state = loadState();
function loadState(){
  try{
    const raw = localStorage.getItem(SAVE_KEY);
    if(!raw) throw 0;
    return JSON.parse(raw);
  }catch{
    return { stars:0, badges:{}, bestMeteor:0, bestRocket:0 };
  }
}
function save(){
  localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  renderHUD();
  renderBadges();
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
      $(`#tab-${t}`).classList.add("active");

      // Leaflet maps need a size invalidate after becoming visible
      if(t === "iss" && issMap){
        setTimeout(()=>{ try{ issMap.invalidateSize(); }catch{} }, 220);
      }
    });
  });
}

// ---------- STARFIELD BACKGROUND ----------
function setupBG(){
  const c = $("#bg");
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
  $("#stars").textContent = String(state.stars);
  $("#badges").textContent = String(Object.keys(state.badges||{}).length);
  $("#subline").textContent = `Welcome, Commander ${KID_NAME} — tap a tab to play!`;
}

function renderBadges(){
  const grid = $("#badgeGrid");
  if(!grid) return;
  grid.innerHTML = "";

  const defs = [
    {k:"explorer",   t:"🪐 Planet Explorer",  d:"Clicked 3 planets"},
    {k:"quiz",       t:"🧠 Planet Brain",     d:"Got the planet quiz right"},
    {k:"hunter",     t:"🛸 Alien Hunter",     d:"Found 10 aliens"},
    {k:"streak",     t:"🔥 Hot Streak",       d:"Alien streak of 5"},
    {k:"meteor",     t:"☄️ Meteor Master",    d:"Catch 15 meteors"},
    {k:"perfect",    t:"🏆 No Misses",        d:"Meteor round with 0 misses"},
    {k:"apod",       t:"📸 Cosmic Curator",   d:"Viewed a NASA space picture"},
    {k:"iss",        t:"🛰️ Satellite Scout",  d:"Tracked the ISS"},
    {k:"quizstreak", t:"🔥 Quiz Hot Streak",  d:"Got 8 quiz answers in a row"},
    {k:"rocket50",   t:"🚀 Upper Atmosphere", d:"Rocket reached 50 km"},
    {k:"rocket100",  t:"🌌 Space Bound",      d:"Rocket reached 100 km (space!)"},
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
  $("#soundBtn").addEventListener("click", ()=>{
    soundOn = !soundOn;
    $("#soundBtn").textContent = soundOn ? "🔊 Sound: ON" : "🔇 Sound: OFF";
    beep(520,0.05,"square");
  });

  $("#ttsBtn").addEventListener("click", ()=>{
    ttsOn = !ttsOn;
    $("#ttsBtn").textContent = ttsOn ? "🗣️ Read: ON" : "🙊 Read: OFF";
    beep(330,0.05,"triangle");
  });

  $("#resetAll").addEventListener("click", ()=>{
    localStorage.removeItem(SAVE_KEY);
    location.reload();
  });

  $("#resetAll").classList.add("danger");
}

// ---------- PLANET EXPLORER ----------
const PLANETS = [
  { id:"mercury", emoji:"🪨", name:"Mercury", color:"#9ca3af", fact:"Mercury is the closest planet to the Sun. It’s super hot AND super cold!" },
  { id:"venus",   emoji:"🌕", name:"Venus",   color:"#fbbf24", fact:"Venus is the hottest planet. It has thick clouds!" },
  { id:"earth",   emoji:"🌍", name:"Earth",   color:"#60a5fa", fact:"Earth is our home. It has oceans, air, and lots of life!" },
  { id:"mars",    emoji:"🔴", name:"Mars",    color:"#fb7185", fact:"Mars is the Red Planet. It has huge volcanoes!" },
  { id:"jupiter", emoji:"🟠", name:"Jupiter", color:"#f59e0b", fact:"Jupiter is the biggest planet. It has a giant storm called the Great Red Spot!" },
  { id:"saturn",  emoji:"🪐", name:"Saturn",  color:"#fde68a", fact:"Saturn has rings made of ice and rock. It’s like a planet wearing a hula hoop!" },
  { id:"uranus",  emoji:"🧊", name:"Uranus",  color:"#93c5fd", fact:"Uranus is icy and spins kind of on its side. Weird and awesome!" },
  { id:"neptune", emoji:"🔵", name:"Neptune", color:"#3b82f6", fact:"Neptune is very windy. Its storms can be super fast!" },
];

let planetClicks = 0;
function setupPlanets(){
  const row = $("#planetRow");
  row.innerHTML = "";

  PLANETS.forEach(p=>{
    const b = document.createElement("button");
    b.className = "planetBtn";
    b.textContent = p.emoji;
    b.title = p.name;
    b.addEventListener("click", ()=> selectPlanet(p.id, true));
    row.appendChild(b);
  });

  $("#randomPlanet").addEventListener("click", ()=>{
    const p = PLANETS[(Math.random()*PLANETS.length)|0];
    selectPlanet(p.id, true);
  });

  // Replace old "type answer" with: jump to the quiz tab (kid-friendly)
  $("#planetQuiz").addEventListener("click", ()=>{
    beep(660,0.06,"triangle");
    say("Space quiz time!");
    openTab("quiz");
  });

  // default
  selectPlanet("saturn", false);
}

function openTab(tabName){
  const btn = $(`.tab[data-tab="${tabName}"]`);
  if(btn) btn.click();
}

function selectPlanet(id, reward){
  const p = PLANETS.find(x=>x.id===id);
  if(!p) return;

  // highlight
  const btns = $$(".planetBtn");
  btns.forEach((b,i)=>{
    b.classList.toggle("active", PLANETS[i].id===id);
  });

  $("#planetName").textContent = `${p.emoji} ${p.name}`;
  $("#planetFact").textContent = p.fact;

  // big visual
  const big = $("#bigPlanet");
  big.innerHTML = "";
  const ball = document.createElement("div");
  ball.className = "planetBall";
  ball.style.background = `radial-gradient(110px 110px at 30% 30%, rgba(255,255,255,.25), transparent 55%), ${p.color}`;
  big.appendChild(ball);

  // saturn rings
  if(p.id === "saturn"){
    const rings = document.createElement("div");
    rings.className = "rings";
    big.appendChild(rings);
  }

  // sparkles
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

  // reward loop
  if(reward){
    planetClicks++;
    addStars(1);
    beep(523,0.05,"triangle");
    say(`${p.name}. ${p.fact}`);
    if(planetClicks >= 3) unlock("explorer","🪐 Planet Explorer","Clicked 3 planets");
  }
}

// ---------- ALIEN HUNT ----------
let alienTimer=null, alienSpawnMs=900, alienGame=false;
let alienFound=0, alienStreak=0, alienTime=0, alienClock=null;

function setupAliens(){
  $("#alienStart").addEventListener("click", startAliens);
  $("#alienHard").addEventListener("click", ()=> { alienSpawnMs = Math.max(420, alienSpawnMs-120); $("#alienMsg").textContent="Harder! Faster aliens!"; beep(660,0.05,"square"); });
  $("#alienEasy").addEventListener("click", ()=> { alienSpawnMs = Math.min(1400, alienSpawnMs+140); $("#alienMsg").textContent="Easier! Slower aliens."; beep(330,0.05,"triangle"); });
}

function startAliens(){
  stopAliens();
  alienGame = true;
  alienFound = 0; alienStreak = 0; alienTime = 0;
  $("#alienFound").textContent="0";
  $("#alienStreak").textContent="0";
  $("#alienTime").textContent="0";
  $("#alienMsg").textContent="Aliens incoming! TAP THEM!";
  say("Alien hunt started. Tap the aliens!");

  const arena = $("#arena");
  arena.innerHTML = "";

  // clock
  alienClock = setInterval(()=>{
    alienTime++;
    $("#alienTime").textContent = String(alienTime);
    if(alienTime === 20){
      $("#alienMsg").textContent = "20 seconds! You’re doing great!";
      beep(523,0.06,"triangle");
    }
  }, 1000);

  spawnAlien();
  alienTimer = setInterval(spawnAlien, alienSpawnMs);
}

function stopAliens(){
  alienGame = false;
  if(alienTimer) clearInterval(alienTimer);
  if(alienClock) clearInterval(alienClock);
  alienTimer=null; alienClock=null;
}

function spawnAlien(){
  if(!alienGame) return;
  const arena = $("#arena");
  const rect = arena.getBoundingClientRect();
  const pad = 50;
  const x = rand(pad, rect.width - pad);
  const y = rand(pad, rect.height - pad);

  const a = document.createElement("div");
  a.className = "alien";
  a.textContent = Math.random() < 0.25 ? "👾" : "👽";
  a.style.left = x + "px";
  a.style.top = y + "px";

  // disappears quickly → tension loop
  const life = rand(650, 1100);

  a.addEventListener("click", (e)=>{
    e.stopPropagation();
    alienFound++;
    alienStreak++;
    $("#alienFound").textContent = String(alienFound);
    $("#alienStreak").textContent = String(alienStreak);
    addStars(2);
    beep(784,0.05,"triangle");
    if(alienStreak >= 5) unlock("streak","🔥 Hot Streak","Alien streak of 5");
    if(alienFound >= 10) unlock("hunter","🛸 Alien Hunter","Found 10 aliens");
    confetti(10);
    a.remove();
  });

  arena.appendChild(a);
  setTimeout(()=>{
    if(a.isConnected){
      a.remove();
      alienStreak = 0;
      $("#alienStreak").textContent = "0";
      beep(180,0.06,"sawtooth");
    }
  }, life);
}

// ---------- METEOR CATCH ----------
let meteorOn=false, meteorLoop=null, meteorSpeed=1.0;
let mCaught=0, mMissed=0, mBest=0;

function setupMeteors(){
  $("#meteorStart").addEventListener("click", startMeteors);
  $("#meteorStop").addEventListener("click", stopMeteors);
  $("#meteorBoost").addEventListener("click", ()=>{
    meteorSpeed = clamp(meteorSpeed + 0.25, 1.0, 2.0);
    $("#meteorMsg").textContent = `Turbo set to x${meteorSpeed.toFixed(2)} ⚡`;
    beep(660,0.05,"square");
  });

  mBest = state.bestMeteor || 0;
  $("#mBest").textContent = String(mBest);
}

function startMeteors(){
  stopMeteors();
  meteorOn = true;
  meteorSpeed = 1.0;
  mCaught = 0; mMissed = 0;
  $("#mCaught").textContent="0";
  $("#mMissed").textContent="0";
  $("#meteorMsg").textContent="Go! Tap the meteors!";
  say("Meteor catch started. Tap the meteors!");
  spawnMeteor();
  meteorLoop = setInterval(spawnMeteor, 650);
}

function stopMeteors(){
  meteorOn = false;
  if(meteorLoop) clearInterval(meteorLoop);
  meteorLoop = null;
}

function spawnMeteor(){
  if(!meteorOn) return;
  const field = $("#meteorField");
  const rect = field.getBoundingClientRect();
  const x = rand(10, rect.width - 64);
  const m = document.createElement("div");
  m.className = "meteor";
  m.textContent = Math.random() < 0.2 ? "🌠" : "☄️";
  m.style.left = x + "px";
  m.style.top = "-60px";

  let y = -60;
  const fall = rand(2.2, 3.4) * meteorSpeed; // px per frame-ish
  let alive = true;

  m.addEventListener("click", ()=>{
    if(!alive) return;
    alive = false;
    mCaught++;
    $("#mCaught").textContent = String(mCaught);
    addStars(1);
    beep(740,0.05,"triangle");
    confetti(8);
    m.remove();

    if(mCaught >= 15) unlock("meteor","☄️ Meteor Master","Catch 15 meteors");
  });

  field.appendChild(m);

  function step(){
    if(!meteorOn || !m.isConnected) return;
    y += fall * 4; // tuned for smoothness
    m.style.top = y + "px";

    if(y > rect.height + 30){
      if(alive){
        mMissed++;
        $("#mMissed").textContent = String(mMissed);
        beep(180,0.06,"sawtooth");
      }
      m.remove();

      // end condition: too many misses
      if(mMissed >= 8){
        endMeteorRound();
      }
      return;
    }
    requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

function endMeteorRound(){
  stopMeteors();
  $("#meteorMsg").textContent = `Round over! Caught ${mCaught}, missed ${mMissed}.`;
  say(`Round over. You caught ${mCaught} meteors.`);
  if(mMissed === 0 && mCaught >= 8) unlock("perfect","🏆 No Misses","Meteor round with 0 misses");
  if(mCaught > mBest){
    mBest = mCaught;
    state.bestMeteor = mBest;
    save();
    $("#mBest").textContent = String(mBest);
    confetti(55);
  }
}

// ================================
// NASA PICS (APOD)
// ================================
let lastApodSpeak = "";

async function fetchApod(dateStr=null){
  const url = new URL("https://api.nasa.gov/planetary/apod");
  url.searchParams.set("api_key", NASA_KEY);
  if(dateStr) url.searchParams.set("date", dateStr);

  // Note: Some browsers/environments can still hit CORS limits from static sites.
  // If you ever see CORS errors, switch to a simple proxy (Cloudflare Worker / Netlify function),
  // or just add your own NASA key (helps reliability). :contentReference[oaicite:3]{index=3}
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
  const short = (explanation || "")
    .replace(/\s+/g," ")
    .slice(0, 260);
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
// ISS TRACKER (Leaflet map) — HTTPS via wheretheiss.at :contentReference[oaicite:4]{index=4}
// ================================
let issMap, issMarker, issAutoOn=false, issTimer=null;

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
    // HTTPS endpoint safe for GitHub Pages
    const res = await fetch("https://api.wheretheiss.at/v1/satellites/25544");
    if(!res.ok) throw new Error("ISS fetch failed");
    const data = await res.json();

    const lat = Number(data.latitude);
    const lon = Number(data.longitude);

    $("#issLat").textContent = lat.toFixed(3);
    $("#issLon").textContent = lon.toFixed(3);
    $("#issTime").textContent = new Date().toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" });

    issMarker.setLatLng([lat, lon]);
    issMap.panTo([lat, lon], { animate:true, duration: 0.6 });

    $("#issMsg").textContent = "There it is! The ISS is zooming around Earth!";
    addStars(2);
    unlock("iss","🛰️ Satellite Scout","Tracked the space station");
    beep(392,0.05,"square"); setTimeout(()=>beep(523,0.05,"square"),60);
  }

  $("#issPing").addEventListener("click", ()=> ping().catch(()=>{
    $("#issMsg").textContent = "ISS ping failed. Try again!";
  }));

  $("#issAuto").addEventListener("click", async ()=>{
    issAutoOn = !issAutoOn;
    $("#issAuto").textContent = issAutoOn ? "Auto: ON" : "Auto: OFF";
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

  // initial ping (map might still be hidden; tabs handler will invalidate size)
  ping().catch(()=>{});
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
  { q:"What do astronauts wear in space?", a:["Raincoat","Space suit","Pajamas","Soccer jersey"], c:1 },
  { q:"Where do astronauts live in space?", a:["ISS","Underwater","On the Sun","In a cave"], c:0 },
  { q:"What do rockets push out to go up?", a:["Cookies","Exhaust gas","Clouds","Leaves"], c:1 },
  { q:"What is a telescope for?", a:["Seeing far things","Cooking","Driving","Swimming"], c:0 },
  { q:"What shape is Earth?", a:["Flat","Round-ish","Triangle","Square"], c:1 },
  { q:"Which is a planet?", a:["Saturn","Spoon","Sock","Sandwich"], c:0 },
  { q:"What’s in the Milky Way?", a:["Lots of stars","Only one star","Only water","Only robots"], c:0 },
  { q:"What is a comet?", a:["Icy space rock","A puppy","A plane","A volcano"], c:0 },
  { q:"What is an astronaut?", a:["Space explorer","Chef","Race car","Dinosaur"], c:0 },
  { q:"What do we call a big group of stars that makes a picture?", a:["Constellation","Sandcastle","Volcano","Elevator"], c:0 },
  { q:"Which planet is closest to the Sun?", a:["Mercury","Mars","Saturn","Neptune"], c:0 },
  { q:"What is gravity?", a:["A pulling force","A snack","A song","A spaceship"], c:0 },
  { q:"Which is a galaxy?", a:["Milky Way","Mount Everest","Pacific Ocean","Grand Canyon"], c:0 },
  { q:"What is a meteor?", a:["Rock burning in air","A fish","A cloud","A tree"], c:0 },
  { q:"What is the Moon?", a:["A planet","A star","A natural satellite","A rocket"], c:2 },
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
    const starGain = (qStreak >= 5 ? 3 : 1); // streak bonus
    qStars += starGain;
    addStars(starGain);
    confetti(20);
    beep(660,0.06,"triangle"); setTimeout(()=>beep(880,0.08,"triangle"),80);

    $("#qMsg").textContent = qStreak >= 5
      ? `SUPER STREAK! 🔥 ${qStreak} in a row!`
      : "Correct! ⭐";

    if(qStreak >= 8) unlock("quizstreak","🔥 Quiz Hot Streak","Got 8 quiz answers in a row");
    if(qScore === 1) unlock("quiz","🧠 Planet Brain","Got a quiz right");
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
// ROCKET LAUNCH MINI-GAME
// Hold to fuel, then launch — altitude + best record
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

  // Hold-to-fuel on mouse/touch/pointer
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

  holdBtn.addEventListener("pointerdown", (e)=>{ e.preventDefault(); startFuel(); });
  holdBtn.addEventListener("pointerup", stopFuel);
  holdBtn.addEventListener("pointercancel", stopFuel);
  holdBtn.addEventListener("pointerleave", stopFuel);

  $("#rocketLaunch").addEventListener("click", ()=>{
    if(rocketLaunched) return;
    if(rocketFuel < 10){
      $("#rocketMsg").textContent = "Need more fuel! Hold Fuel first. ⛽";
      beep(180,0.07,"sawtooth");
      return;
    }
    launchRocket();
  });

  $("#rocketAbort").addEventListener("click", ()=>{
    abortRocket();
  });

  // initialize UI
  updateFuelUI();
  updateRocketUI();
}

function updateFuelUI(){
  $("#rocketFuelText").textContent = String(Math.round(rocketFuel));
  const bar = $("#fuelBar");
  if(bar) bar.style.width = `${rocketFuel}%`;
}

function updateRocketUI(){
  $("#rocketAlt").textContent = String(Math.max(0, Math.round(rocketAlt)));
  $("#rocketBest").textContent = String(Math.round(rocketBest));
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
  if(rocket){
    rocket.style.transform = "translateX(-50%) translateY(0px)";
  }
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

  // Physics-ish: fuel becomes initial thrust/velocity
  rocketVel = 0.9 + (rocketFuel / 12); // km per tick-ish
  const fuelBurn = rocketFuel; // keep for scoring
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

    // thrust decays + gravity drag
    rocketVel *= (1 - 0.006*dt);   // air resistance
    rocketVel -= 0.03*dt;          // gravity-ish
    rocketAlt += rocketVel * dt;

    if(rocket){
      // visual translate: altitude -> pixels (cap to keep in frame)
      const px = clamp(rocketAlt * 2.2, 0, 300);
      rocket.style.transform = `translateX(-50%) translateY(${-px}px)`;
    }

    updateRocketUI();

    // milestones / rewards
    if(rocketAlt >= 50) unlock("rocket50","🚀 Upper Atmosphere","Rocket reached 50 km");
    if(rocketAlt >= 100) unlock("rocket100","🌌 Space Bound","Rocket reached 100 km (space!)");

    // keep running while moving upward or still above ground slightly
    if(rocketAlt > 0 && rocketVel > -0.4){
      rocketRAF = requestAnimationFrame(step);
      return;
    }

    // end of flight
    igniteRocket(false);
    rocketAlt = Math.max(0, rocketAlt);
    updateRocketUI();

    const finalAlt = Math.round(Math.max(0, rocketAlt));
    $("#rocketMsg").textContent =
      finalAlt >= 100 ? `YOU REACHED SPACE! 🌌 (${finalAlt} km)` :
      finalAlt >= 50  ? `Great flight! (${finalAlt} km)` :
                        `Nice launch! (${finalAlt} km) Try more fuel!`;

    // Stars for effort (scaled gently)
    const starGain = clamp(Math.round(finalAlt / 25), 1, 8);
    addStars(starGain);

    // Best record
    if(finalAlt > rocketBest){
      rocketBest = finalAlt;
      state.bestRocket = rocketBest;
      save();
      confetti(60);
      beep(660,0.06,"triangle"); setTimeout(()=>beep(880,0.08,"triangle"),80);
    }

    // small extra reward if he fueled a lot
    if(fuelBurn >= 80) addStars(1);

    rocketLaunched = false;
    rocketVel = 0;
    rocketRAF = null;
  }

  rocketRAF = requestAnimationFrame(step);
}

// ---------- INIT ----------
function init(){
  setupTabs();
  setupBG();
  setupTop();
  setupPlanets();
  setupRocket();
  setupAliens();
  setupMeteors();
  setupApodUI();
  setupIss();
  setupQuiz();

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
  if(hud) hud.insertBefore(disco, $("#soundBtn"));

  renderHUD();
  renderBadges();
}
init();
