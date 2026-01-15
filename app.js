// Traveler’s Space Arcade — small, fun, and actually interactive
const KID_NAME = "Traveler";
const SAVE_KEY = "traveler_space_arcade_v1";

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
    return { stars:0, badges:{}, bestMeteor:0 };
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
  grid.innerHTML = "";
  const defs = [
    {k:"explorer", t:"🪐 Planet Explorer", d:"Clicked 3 planets"},
    {k:"quiz",     t:"🧠 Planet Brain",   d:"Got a quiz right"},
    {k:"hunter",   t:"🛸 Alien Hunter",   d:"Found 10 aliens"},
    {k:"streak",   t:"🔥 Hot Streak",     d:"Alien streak of 5"},
    {k:"meteor",   t:"☄️ Meteor Master",  d:"Catch 15 meteors"},
    {k:"perfect",  t:"🏆 No Misses",      d:"Meteor round with 0 misses"},
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

  // disco mode is just a fun visual
  $("#resetAll").parentElement.insertAdjacentHTML("beforebegin", "");
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

  $("#planetQuiz").addEventListener("click", ()=>{
    const p = PLANETS[(Math.random()*PLANETS.length)|0];
    const question = `Which planet has rings?`;
    const correct = "Saturn";
    const guess = prompt(question + "\n(Type your answer, like: Saturn)");
    if(!guess) return;
    if(guess.trim().toLowerCase() === correct.toLowerCase()){
      $("#planetNote").textContent = "Correct! 🎉 You’re a space genius!";
      addStars(5);
      unlock("quiz","🧠 Planet Brain","Got a quiz right");
      say("Correct! Saturn has rings!");
      confetti(50);
      beep(660,0.06,"triangle"); beep(880,0.08,"triangle");
    }else{
      $("#planetNote").textContent = `Nice try! The answer was ${correct}.`;
      say(`Nice try! The answer was Saturn.`);
      beep(180,0.08,"sawtooth");
    }
  });

  // default
  selectPlanet("saturn", false);
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

// ---------- INIT ----------
function init(){
  setupTabs();
  setupBG();
  setupTop();
  setupPlanets();
  setupAliens();
  setupMeteors();

  // disco button (simple class toggle)
  const disco = document.createElement("button");
  disco.className = "chip";
  disco.textContent = "🪩 Cosmic Mode";
  disco.addEventListener("click", ()=>{
    document.body.classList.toggle("disco");
    confetti(30);
    beep(330,0.06,"triangle"); setTimeout(()=>beep(392,0.06,"triangle"),70); setTimeout(()=>beep(494,0.08,"triangle"),140);
  });
  $(".hud").insertBefore(disco, $("#resetAll"));

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

  renderHUD();
  renderBadges();
}
init();
