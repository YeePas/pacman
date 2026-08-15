/* ============================================================
   Timo & Kaj Pac-Man  🍔
   - Grote rondjes = hamburgers (power-pellets)
   - Spookjes = foto van je vriendin (assets/vriendin.png)
   - Pac-Man = Timo of Kaj (assets/timo.png / assets/kaj.png)
   Foto's ontbreken? Dan tekent de game automatisch een
   vervanger, dus het werkt ook meteen zonder foto's.
   ============================================================ */

(() => {
  "use strict";

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");

  // ---- Afbeeldingen laden (met nette fallback) ----
  function loadImg(src) {
    const img = new Image();
    img.ok = false;
    img.onload = () => { img.ok = true; };
    img.onerror = () => { img.ok = false; };
    img.src = src;
    return img;
  }
  const IMG = {
    timo: loadImg("assets/timo.png"),
    kaj: loadImg("assets/kaj.png"),
    vriendin: loadImg("assets/vriendin.png"),
  };

  // Toon foto in menu-avatar zodra geladen
  function wireAvatar(imgKey, elId) {
    const el = document.getElementById(elId);
    const img = IMG[imgKey];
    const apply = () => {
      if (img.ok) {
        const f = FOCUS[imgKey] || { x: 0.5, y: 0.5, zoom: 1 };
        el.style.backgroundImage = `url(${img.src})`;
        el.style.backgroundSize = `${f.zoom * 100}%`;
        el.style.backgroundPosition = `${f.x * 100}% ${f.y * 100}%`;
        el.textContent = "";
      }
    };
    img.addEventListener("load", apply);
    apply();
  }
  wireAvatar("timo", "av-timo");
  wireAvatar("kaj", "av-kaj");

  // ---- Grid-instellingen ----
  const COLS = MAZES[0][0].length; // 19
  const ROWS = MAZES[0].length;    // 21
  let TS = 24;                     // tegelgrootte in px (wordt geschaald)

  function resize() {
    // Canvas intern op resolutie van het doolhof, CSS schaalt.
    const dpr = window.devicePixelRatio || 1;
    const cssW = canvas.clientWidth;
    const cssH = canvas.clientHeight;
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    TS = cssW / COLS;
  }
  window.addEventListener("resize", resize);

  // ---- Spelstatus ----
  const DIRS = {
    up: { x: 0, y: -1 }, down: { x: 0, y: 1 },
    left: { x: -1, y: 0 }, right: { x: 1, y: 0 },
    stop: { x: 0, y: 0 },
  };
  const OPP = { up: "down", down: "up", left: "right", right: "left", stop: "stop" };

  const LEVEL_CFG = [
    { ghostSpeed: 0.070, frightSec: 7 },
    { ghostSpeed: 0.078, frightSec: 6 },
    { ghostSpeed: 0.086, frightSec: 5 },
  ];
  const PAC_SPEED = 0.082;      // tegels per logica-stap (60/s)
  const FRIGHT_SPEED = 0.050;
  const EATEN_SPEED = 0.150;

  const state = {
    scene: "menu",        // menu | play | message
    char: null,           // 'timo' | 'kaj'
    levelIndex: 0,        // 0-based
    score: 0,
    lives: 3,
    grid: null,           // muren: true=muur
    dots: null,           // 2D: '.', 'o' of null
    dotsLeft: 0,
    pac: null,
    ghosts: [],
    frightTimer: 0,
    pacSpawn: null,
    ghostSpawns: [],
    time: 0,
    ready: 0,             // korte "klaar"-pauze bij (her)start
  };

  // ---- Doolhof inladen ----
  function loadLevel(idx) {
    const maze = MAZES[idx];
    const grid = [];
    const dots = [];
    state.ghostSpawns = [];
    state.dotsLeft = 0;
    for (let y = 0; y < ROWS; y++) {
      grid[y] = [];
      dots[y] = [];
      for (let x = 0; x < COLS; x++) {
        const ch = maze[y][x];
        grid[y][x] = ch === "#";
        if (ch === "." || ch === "o") {
          dots[y][x] = ch;
          state.dotsLeft++;
        } else {
          dots[y][x] = null;
        }
        if (ch === "P") state.pacSpawn = { x, y };
        if (ch === "G") state.ghostSpawns.push({ x, y });
      }
    }
    state.grid = grid;
    state.dots = dots;

    // Pac-Man
    state.pac = {
      x: state.pacSpawn.x, y: state.pacSpawn.y,
      dir: DIRS.left, dirName: "left",
      want: DIRS.left, wantName: "left",
      speed: PAC_SPEED, mouth: 0,
    };

    // Spookjes
    const colors = ["#ff5b8a", "#8ac6ff", "#ffb86b", "#c792ff"];
    state.ghosts = state.ghostSpawns.map((sp, i) => ({
      x: sp.x, y: sp.y, spawn: { ...sp },
      dir: DIRS.up, dirName: "up",
      color: colors[i % colors.length],
      state: "chase",           // chase | fright | eaten
      releaseAt: i * 1.6,       // gespreid loslaten (seconden)
      blink: false,
    }));

    state.frightTimer = 0;
    state.ready = 1.2;
  }

  // ---- Hulpfuncties ----
  function wrapX(x) {
    if (x < 0) return COLS - 1;
    if (x > COLS - 1) return 0;
    return x;
  }
  function isWall(cx, cy) {
    cx = wrapX(cx);
    if (cy < 0 || cy >= ROWS) return true;
    return state.grid[cy][cx];
  }
  function canGo(cx, cy, dir) {
    return !isWall(cx + dir.x, cy + dir.y);
  }

  const EPS = 0.06;
  function atCenter(e) {
    return Math.abs(e.x - Math.round(e.x)) < EPS &&
           Math.abs(e.y - Math.round(e.y)) < EPS;
  }

  // ---- Beweging Pac-Man ----
  function movePac(pac) {
    if (atCenter(pac)) {
      const cx = Math.round(pac.x), cy = Math.round(pac.y);
      pac.x = cx; pac.y = cy;
      // eten
      const d = state.dots[cy][cx];
      if (d === ".") { state.dots[cy][cx] = null; state.score += 10; state.dotsLeft--; }
      else if (d === "o") { state.dots[cy][cx] = null; state.score += 50; state.dotsLeft--; frighten(); }
      // richting kiezen
      if (canGo(cx, cy, pac.want)) { pac.dir = pac.want; pac.dirName = pac.wantName; }
      if (!canGo(cx, cy, pac.dir)) { pac.dir = DIRS.stop; }
    }
    pac.x = wrapX(pac.x + pac.dir.x * pac.speed);
    pac.y += pac.dir.y * pac.speed;
    if (pac.dir !== DIRS.stop) pac.mouth += 0.25;
  }

  // ---- Beweging spookje ----
  function moveGhost(g, cfg) {
    // wachten tot loslaten
    if (state.time < g.releaseAt && g.state === "chase") return;

    let speed = cfg.ghostSpeed;
    if (g.state === "fright") speed = FRIGHT_SPEED;
    if (g.state === "eaten") speed = EATEN_SPEED;

    if (atCenter(g)) {
      const cx = Math.round(g.x), cy = Math.round(g.y);
      g.x = cx; g.y = cy;

      // teruggekeerd bij spawn -> weer normaal
      if (g.state === "eaten" && cx === g.spawn.x && cy === g.spawn.y) {
        g.state = "chase";
      }

      // doel bepalen
      let target;
      if (g.state === "eaten") target = g.spawn;
      else target = { x: Math.round(state.pac.x), y: Math.round(state.pac.y) };

      // opties: alle richtingen behalve terug (tenzij doodlopend)
      const names = ["up", "down", "left", "right"];
      let opts = names.filter(n => n !== OPP[g.dirName] && canGo(cx, cy, DIRS[n]));
      if (opts.length === 0) opts = names.filter(n => canGo(cx, cy, DIRS[n]));
      if (opts.length === 0) opts = ["up"]; // veiligheid

      let choice;
      if (g.state === "fright") {
        choice = opts[Math.floor(Math.random() * opts.length)];
      } else {
        // kies richting die dichtst bij het doel komt
        let best = Infinity;
        for (const n of opts) {
          const nx = wrapX(cx + DIRS[n].x), ny = cy + DIRS[n].y;
          const dist = (nx - target.x) ** 2 + (ny - target.y) ** 2;
          if (dist < best) { best = dist; choice = n; }
        }
      }
      g.dir = DIRS[choice];
      g.dirName = choice;
    }
    g.x = wrapX(g.x + g.dir.x * speed);
    g.y += g.dir.y * speed;
  }

  function frighten() {
    const cfg = LEVEL_CFG[state.levelIndex];
    state.frightTimer = cfg.frightSec;
    for (const g of state.ghosts) {
      if (g.state !== "eaten") {
        g.state = "fright";
        g.dir = DIRS[OPP[g.dirName]] || DIRS.stop; // omdraaien
        g.dirName = OPP[g.dirName];
      }
    }
  }

  // ---- Botsingen pac <-> spookje ----
  function checkGhostCollisions() {
    for (const g of state.ghosts) {
      if (g.state === "eaten") continue;
      const dx = g.x - state.pac.x, dy = g.y - state.pac.y;
      if (dx * dx + dy * dy < 0.35) {
        if (g.state === "fright") {
          g.state = "eaten";
          state.score += 200;
        } else {
          pacDies();
          return;
        }
      }
    }
  }

  function pacDies() {
    state.lives--;
    if (state.lives <= 0) {
      showMessage("Game over", `Score: ${state.score}`, "Opnieuw", () => {
        state.scene = "menu";
        document.getElementById("menu").classList.remove("hidden");
      });
    } else {
      // reset posities, doolhof blijft
      state.pac.x = state.pacSpawn.x; state.pac.y = state.pacSpawn.y;
      state.pac.dir = DIRS.left; state.pac.dirName = "left";
      state.pac.want = DIRS.left; state.pac.wantName = "left";
      state.ghosts.forEach((g, i) => {
        g.x = g.spawn.x; g.y = g.spawn.y;
        g.state = "chase"; g.dir = DIRS.up; g.dirName = "up";
        g.releaseAt = state.time + i * 1.2;
      });
      state.frightTimer = 0;
      state.ready = 1.2;
    }
    updateHud();
  }

  function levelClear() {
    if (state.levelIndex < MAZES.length - 1) {
      showMessage(`Level ${state.levelIndex + 1} gehaald!`, "Door naar het volgende level", "Verder", () => {
        state.levelIndex++;
        loadLevel(state.levelIndex);
        state.scene = "play";
        updateHud();
      });
    } else {
      showMessage("Gewonnen! 🎉", `Alle levels uit! Score: ${state.score}`, "Nog een keer", () => {
        state.scene = "menu";
        document.getElementById("menu").classList.remove("hidden");
      });
    }
  }

  // ---- Tekenen ----
  function draw() {
    ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);

    // muren
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        if (state.grid[y][x]) {
          roundRect(x * TS + TS * 0.08, y * TS + TS * 0.08, TS * 0.84, TS * 0.84, TS * 0.28);
          ctx.fillStyle = "#1f2b7a";
          ctx.fill();
          ctx.strokeStyle = "#3a5bff";
          ctx.lineWidth = Math.max(1, TS * 0.06);
          ctx.stroke();
        }
      }
    }

    // puntjes & hamburgers
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const d = state.dots[y][x];
        if (d === ".") {
          ctx.beginPath();
          ctx.arc(x * TS + TS / 2, y * TS + TS / 2, TS * 0.08, 0, Math.PI * 2);
          ctx.fillStyle = "#ffe08a";
          ctx.fill();
        } else if (d === "o") {
          // hamburger als emoji
          ctx.font = `${TS * 0.9}px serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText("🍔", x * TS + TS / 2, y * TS + TS / 2 + TS * 0.02);
        }
      }
    }

    // spookjes
    for (const g of state.ghosts) {
      drawGhost(g);
    }

    // Pac-Man
    drawPac(state.pac);

    // "Klaar?"-tekst
    if (state.ready > 0) {
      ctx.fillStyle = "#ffd54a";
      ctx.font = `bold ${TS * 0.9}px system-ui`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("Klaar?", COLS * TS / 2, ROWS * TS * 0.58);
    }
  }

  // Focuspunt per persoon (waar zit het gezicht in de vierkante foto?)
  // x/y als fractie 0..1, zoom = hoe strak op het gezicht.
  const FOCUS = {
    timo:     { x: 0.42, y: 0.33, zoom: 1.75 },
    kaj:      { x: 0.66, y: 0.40, zoom: 1.80 },
    vriendin: { x: 0.60, y: 0.30, zoom: 1.85 },
  };

  function drawCircleImg(img, cx, cy, r, focusKey) {
    const f = FOCUS[focusKey] || { x: 0.5, y: 0.5, zoom: 1 };
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.clip();
    const iw = img.naturalWidth, ih = img.naturalHeight;
    const base = Math.max((2 * r) / iw, (2 * r) / ih);
    const scale = base * f.zoom;
    const w = iw * scale, h = ih * scale;
    // gezicht op (cx,cy) richten, maar binnen de cirkel blijven
    let dx = cx - f.x * w;
    let dy = cy - f.y * h;
    dx = Math.min(cx - r, Math.max(cx + r - w, dx));
    dy = Math.min(cy - r, Math.max(cy + r - h, dy));
    ctx.drawImage(img, dx, dy, w, h);
    ctx.restore();
  }

  function drawPac(pac) {
    const cx = pac.x * TS + TS / 2, cy = pac.y * TS + TS / 2;
    const r = TS * 0.46;
    const img = IMG[state.char];
    if (img && img.ok) {
      drawCircleImg(img, cx, cy, r, state.char);
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.strokeStyle = "#ffd54a";
      ctx.lineWidth = Math.max(1.5, TS * 0.06);
      ctx.stroke();
    } else {
      // klassieke gele Pac-Man met happende mond
      const open = (Math.sin(pac.mouth) * 0.5 + 0.5) * 0.35 + 0.03;
      let a = 0;
      if (pac.dirName === "right") a = 0;
      else if (pac.dirName === "down") a = Math.PI / 2;
      else if (pac.dirName === "left") a = Math.PI;
      else if (pac.dirName === "up") a = -Math.PI / 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, a + open * Math.PI, a - open * Math.PI + Math.PI * 2);
      ctx.closePath();
      ctx.fillStyle = "#ffd54a";
      ctx.fill();
    }
  }

  function drawGhost(g) {
    const cx = g.x * TS + TS / 2, cy = g.y * TS + TS / 2;
    const r = TS * 0.46;
    const img = IMG.vriendin;

    if (g.state === "eaten") {
      // alleen "oogjes" die naar huis zweven
      drawEyes(cx, cy, r, g.dirName);
      return;
    }

    const frightBlink = g.state === "fright" && state.frightTimer < 2 &&
      Math.floor(state.frightTimer * 6) % 2 === 0;

    if (img && img.ok && g.state === "chase") {
      drawCircleImg(img, cx, cy, r, "vriendin");
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.strokeStyle = g.color;
      ctx.lineWidth = Math.max(1.5, TS * 0.06);
      ctx.stroke();
    } else {
      // klassiek spookje (of blauw als 'fright')
      let body = g.color;
      if (g.state === "fright") body = frightBlink ? "#ffffff" : "#2b5bff";
      ctx.beginPath();
      ctx.arc(cx, cy - r * 0.1, r, Math.PI, 0);
      ctx.lineTo(cx + r, cy + r * 0.8);
      // golfjes onderkant
      const n = 4;
      for (let i = 0; i < n; i++) {
        const x2 = cx + r - (2 * r) * (i + 0.5) / n;
        const x3 = cx + r - (2 * r) * (i + 1) / n;
        ctx.lineTo(x2, cy + r * 0.55);
        ctx.lineTo(x3, cy + r * 0.8);
      }
      ctx.closePath();
      ctx.fillStyle = body;
      ctx.fill();
      // oogjes
      if (g.state === "fright") {
        ctx.fillStyle = frightBlink ? "#ff4444" : "#fff";
        dot(cx - r * 0.35, cy, r * 0.12);
        dot(cx + r * 0.35, cy, r * 0.12);
      } else {
        drawEyes(cx, cy, r, g.dirName);
      }
    }
  }

  function drawEyes(cx, cy, r, dirName) {
    const dx = (DIRS[dirName] || DIRS.stop).x, dy = (DIRS[dirName] || DIRS.stop).y;
    for (const s of [-1, 1]) {
      const ex = cx + s * r * 0.35, ey = cy - r * 0.1;
      ctx.fillStyle = "#fff";
      dot(ex, ey, r * 0.22);
      ctx.fillStyle = "#1030c0";
      dot(ex + dx * r * 0.1, ey + dy * r * 0.1, r * 0.11);
    }
  }

  function dot(x, y, r) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // ---- Hoofdlus (vaste logica-stap) ----
  let last = 0, acc = 0;
  const STEP = 1 / 60;

  function frame(t) {
    requestAnimationFrame(frame);
    if (!last) last = t;
    let dt = (t - last) / 1000;
    last = t;
    if (dt > 0.1) dt = 0.1; // na tabwissel niet gek doen

    if (state.scene === "play") {
      acc += dt;
      while (acc >= STEP) {
        update(STEP);
        acc -= STEP;
      }
      draw();
    }
  }

  function update(dt) {
    state.time += dt;

    if (state.ready > 0) {
      state.ready -= dt;
      draw();
      return;
    }

    const cfg = LEVEL_CFG[state.levelIndex];

    movePac(state.pac);

    if (state.frightTimer > 0) {
      state.frightTimer -= dt;
      if (state.frightTimer <= 0) {
        state.frightTimer = 0;
        for (const g of state.ghosts) if (g.state === "fright") g.state = "chase";
      }
    }

    for (const g of state.ghosts) moveGhost(g, cfg);

    checkGhostCollisions();
    updateHud();

    if (state.dotsLeft <= 0 && state.scene === "play") {
      state.scene = "message";
      levelClear();
    }
  }

  // ---- HUD ----
  function updateHud() {
    document.getElementById("score").textContent = state.score;
    document.getElementById("level").textContent = state.levelIndex + 1;
    document.getElementById("lives").textContent = "❤️".repeat(Math.max(0, state.lives)) || "—";
  }

  // ---- Berichten ----
  function showMessage(title, text, btn, cb) {
    const m = document.getElementById("message");
    document.getElementById("msg-title").textContent = title;
    document.getElementById("msg-text").textContent = text;
    const b = document.getElementById("msg-btn");
    b.textContent = btn;
    m.classList.remove("hidden");
    b.onclick = () => {
      m.classList.add("hidden");
      cb();
    };
    state.scene = "message";
  }

  // ---- Invoer ----
  const keyMap = {
    ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right",
    w: "up", s: "down", a: "left", d: "right",
    W: "up", S: "down", A: "left", D: "right",
  };
  window.addEventListener("keydown", (e) => {
    const dir = keyMap[e.key];
    if (dir) {
      e.preventDefault();
      state.pac.want = DIRS[dir];
      state.pac.wantName = dir;
    }
  });

  // Swipe
  let touchStart = null;
  canvas.addEventListener("touchstart", (e) => {
    const t = e.touches[0];
    touchStart = { x: t.clientX, y: t.clientY };
  }, { passive: true });
  canvas.addEventListener("touchmove", (e) => {
    if (!touchStart) return;
    const t = e.touches[0];
    const dx = t.clientX - touchStart.x, dy = t.clientY - touchStart.y;
    if (Math.abs(dx) < 24 && Math.abs(dy) < 24) return;
    let dir;
    if (Math.abs(dx) > Math.abs(dy)) dir = dx > 0 ? "right" : "left";
    else dir = dy > 0 ? "down" : "up";
    state.pac.want = DIRS[dir];
    state.pac.wantName = dir;
    touchStart = { x: t.clientX, y: t.clientY };
    e.preventDefault();
  }, { passive: false });

  // ---- Menu ----
  let selectedLevel = null;
  function refreshStart() {
    document.getElementById("start").disabled = !(state.char && selectedLevel);
  }
  document.querySelectorAll(".char").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".char").forEach(b => b.classList.remove("selected"));
      btn.classList.add("selected");
      state.char = btn.dataset.char;
      refreshStart();
    });
  });
  document.querySelectorAll(".lvl").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".lvl").forEach(b => b.classList.remove("selected"));
      btn.classList.add("selected");
      selectedLevel = parseInt(btn.dataset.lvl, 10);
      refreshStart();
    });
  });
  document.getElementById("start").addEventListener("click", () => {
    document.getElementById("menu").classList.add("hidden");
    state.score = 0;
    state.lives = 3;
    state.levelIndex = selectedLevel - 1;
    state.time = 0;
    resize();
    loadLevel(state.levelIndex);
    updateHud();
    state.scene = "play";
  });

  // ---- Start ----
  resize();
  requestAnimationFrame(frame);
})();
