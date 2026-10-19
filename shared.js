/* Bubersurprise — utilità condivise: progresso (solo per la sessione), coriandoli, vibrazione */
const Buber = (() => {
  const KEY = 'buber_progress';

  /* sessionStorage: il progresso serve solo a impedire di saltare le pagine via URL,
     e sparisce quando si chiude la scheda, così si può rigiocare da capo. */
  const progress = () => Number(sessionStorage.getItem(KEY) || 0);

  /* Segna la tappa `step` come superata (1 = cover, 2 = primo gioco, ...). */
  function complete(step) {
    if (progress() < step) sessionStorage.setItem(KEY, String(step));
  }

  const isDone = (step) => progress() >= step;

  /* Da chiamare in cima a ogni pagina gioco: se la tappa precedente
     non è stata superata, rimanda alla cover. */
  function requireStep(step) {
    if (new URLSearchParams(location.search).has('test')) return;   // per provare una pagina da sola
    if (progress() < step - 1) location.replace('index.html');
  }

  function vibrate(pattern) {
    try { navigator.vibrate && navigator.vibrate(pattern); } catch (_) {}
  }

  /* Coriandoli su canvas, si autodistrugge dopo ~3.5s. */
  function confetti({ count = 160, origin } = {}) {
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) count = Math.round(count / 3);

    const canvas = document.createElement('canvas');
    canvas.id = 'confetti-canvas';
    document.body.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const W = innerWidth, H = innerHeight;
    canvas.width = W * dpr; canvas.height = H * dpr;
    ctx.scale(dpr, dpr);

    const colors = ['#cfc8e6', '#c3d1bd', '#ecc9c6', '#c6d8e3', '#efe3bd', '#1f1d1a'];
    const ox = origin ? origin.x : W / 2;
    const oy = origin ? origin.y : H * 0.6;
    const parts = [];
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 500 + Math.random() * 700;
      parts.push({
        x: ox, y: oy,
        vx: Math.cos(a) * s, vy: Math.sin(a) * s - 400,
        w: 6 + Math.random() * 8, h: 8 + Math.random() * 10,
        rot: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 12,
        color: colors[(Math.random() * colors.length) | 0],
        life: 2.4 + Math.random() * 1.2,
      });
    }

    let last = performance.now();
    function frame(now) {
      const dt = Math.max(0, Math.min((now - last) / 1000, 0.033));
      last = now;
      ctx.clearRect(0, 0, W, H);
      let alive = 0;
      for (const p of parts) {
        if (p.life <= 0) continue;
        alive++;
        p.life -= dt;
        p.vy += 1400 * dt;
        p.vx *= 0.985; p.vy *= 0.985;
        p.x += p.vx * dt; p.y += p.vy * dt;
        p.rot += p.vr * dt;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.globalAlpha = Math.max(0, Math.min(1, p.life));
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }
      if (alive > 0) requestAnimationFrame(frame);
      else canvas.remove();
    }
    requestAnimationFrame(frame);
  }

  return { progress, complete, isDone, requireStep, vibrate, confetti };
})();

/* ------------------------------------------------------------------
   Motore "cose che rimbalzano" su canvas: emoji o immagini, con
   frenata, velocità minima, rimbalzo sui bordi, tocco e lancio.
   ------------------------------------------------------------------ */
Buber.bouncer = function (canvas, opts = {}) {
  const ctx = canvas.getContext('2d');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const DAMP = opts.damp ?? 1.1;          // frenata (per secondo)
  const MIN_SPEED = opts.minSpeed ?? 22;  // px/s: sotto non scendono mai
  const MIN_SPIN = opts.minSpin ?? 0.35;  // rad/s
  const BOUNCE = opts.bounce ?? 0.88;
  const EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
  let W = 0, H = 0;
  const parts = [];
  let running = false, last = 0;

  function resize() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    W = innerWidth; H = innerHeight;
    canvas.width = W * dpr; canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  }
  addEventListener('resize', resize);
  resize();

  /* Normalizza un elemento: '🍣' | 'img/x.svg' | { src, size, ... } */
  function makeItem(e, defSize) {
    const size = (typeof e === 'object' && e.size) || defSize;
    if (typeof e === 'object' && e.src) { const img = new Image(); img.src = e.src; return { ...e, img, size }; }
    if (typeof e === 'string' && /\.(svg|png|webp)$/i.test(e)) { const img = new Image(); img.src = e; return { img, size }; }
    return { ch: typeof e === 'object' ? e.ch : e, size, ...(typeof e === 'object' ? e : {}) };
  }

  /* Fa schizzare `items` dal punto (x, y) verso l'alto. */
  function burst(items, x, y, { copies = 1, speed = 900, spread = 800, size = 46 } = {}) {
    const list = [];
    for (let c = 0; c < copies; c++) list.push(...items.map((e) => makeItem(e, size)));
    list.forEach((it, i) => {
      const a = (i / list.length) * Math.PI * 0.9 + Math.PI * 1.05 + (Math.random() - 0.5) * 0.3;
      const v = (reduce ? speed * 0.4 : speed) + Math.random() * (reduce ? spread * 0.25 : spread);
      parts.push({
        ...it, x, y,
        vx: Math.cos(a) * v, vy: Math.sin(a) * v,
        rot: Math.random() * Math.PI * 2,
        vr: (Math.random() - 0.5) * (it.img ? 3 : 12),
        r: it.size / 2, scale: 1,
      });
    });
    start();
  }

  function start() {
    if (running) return;
    running = true; last = performance.now(); requestAnimationFrame(frame);
  }

  function draw(p, scale) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    ctx.globalAlpha = p.alpha ?? 1;
    const s = p.size * scale;
    if (p.img) {
      if (p.img.complete && p.img.naturalWidth) {
        const h = s, w = h * p.img.naturalWidth / p.img.naturalHeight;
        ctx.drawImage(p.img, -w / 2, -h / 2, w, h);
      }
    } else {
      ctx.font = `${s}px ${EMOJI_FONT}`;
      ctx.fillText(p.ch, 0, s * 0.06);
    }
    ctx.restore();
  }

  function frame(now) {
    const dt = Math.max(0, Math.min((now - last) / 1000, 0.033));
    last = now;
    ctx.clearRect(0, 0, W, H);
    const k = Math.exp(-DAMP * dt);
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];

      if (p.dying != null) {               // animazione di uscita: si stringe e sparisce
        p.dying += dt;
        const t = Math.min(1, p.dying / 0.22);
        p.alpha = 1 - t;
        draw(p, 1 + t * 0.6);
        if (t >= 1) parts.splice(i, 1);
        continue;
      }
      if (p.held) { draw(p, 1.15); continue; }

      p.vx *= k; p.vy *= k;
      const sp = Math.hypot(p.vx, p.vy);
      if (sp < MIN_SPEED) {
        if (sp < 1) { const a = Math.random() * Math.PI * 2; p.vx = Math.cos(a) * MIN_SPEED; p.vy = Math.sin(a) * MIN_SPEED; }
        else { p.vx *= MIN_SPEED / sp; p.vy *= MIN_SPEED / sp; }
      }
      p.vr *= k;
      if (Math.abs(p.vr) < MIN_SPIN) p.vr = Math.sign(p.vr || 1) * MIN_SPIN;

      p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;

      if (p.x < p.r)     { p.x = p.r;     p.vx = Math.abs(p.vx) * BOUNCE; }
      if (p.x > W - p.r) { p.x = W - p.r; p.vx = -Math.abs(p.vx) * BOUNCE; }
      if (p.y < p.r)     { p.y = p.r;     p.vy = Math.abs(p.vy) * BOUNCE; }
      if (p.y > H - p.r) { p.y = H - p.r; p.vy = -Math.abs(p.vy) * BOUNCE; }

      draw(p, 1);
    }
    requestAnimationFrame(frame);
  }

  /* Elemento sotto il punto (x, y), il più in alto per primo. */
  function hit(x, y) {
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      if (p.dying != null) continue;
      if (Math.hypot(p.x - x, p.y - y) <= p.size * 0.7) return p;
    }
    return null;
  }

  function remove(p) { p.dying = 0; p.held = false; }

  /* Rimbalzo via: spinta improvvisa in direzione casuale (per gli errori). */
  function kick(p, v = 700) {
    const a = Math.random() * Math.PI * 2;
    p.vx += Math.cos(a) * v; p.vy += Math.sin(a) * v; p.vr += (Math.random() - 0.5) * 10;
  }

  /* --- afferra e lancia (flick), opzionale --- */
  let held = null, lastFlick = 0;
  const trail = [];
  function enableFlick() {
    addEventListener('pointerdown', (e) => {
      const p = hit(e.clientX, e.clientY);
      if (!p) return;
      e.preventDefault(); e.stopPropagation();
      held = p; p.held = true; p.vx = p.vy = 0; p.vr *= 0.3;
      p.ox = p.x - e.clientX; p.oy = p.y - e.clientY;
      trail.length = 0; trail.push({ x: e.clientX, y: e.clientY, t: e.timeStamp });
    }, true);
    addEventListener('pointermove', (e) => {
      if (!held) return;
      e.preventDefault(); e.stopPropagation();
      held.x = e.clientX + held.ox; held.y = e.clientY + held.oy;
      trail.push({ x: e.clientX, y: e.clientY, t: e.timeStamp });
      while (trail.length > 1 && e.timeStamp - trail[0].t > 90) trail.shift();
    }, true);
    const release = (e) => {
      if (!held) return;
      e.stopPropagation();
      const a = trail[0], b = trail[trail.length - 1];
      const dt = Math.max((b.t - a.t) / 1000, 0.016);
      let vx = (b.x - a.x) / dt, vy = (b.y - a.y) / dt;
      const sp = Math.hypot(vx, vy), MAX = 2600;
      if (sp > MAX) { vx *= MAX / sp; vy *= MAX / sp; }
      held.vx = vx; held.vy = vy;
      held.vr = (Math.random() - 0.5) * Math.min(10, sp / 150);
      held.held = false; held = null;
      lastFlick = performance.now();
    };
    addEventListener('pointerup', release, true);
    addEventListener('pointercancel', release, true);
  }
  const justFlicked = () => performance.now() - lastFlick < 250;

  return { burst, hit, remove, kick, parts, enableFlick, justFlicked };
};

/* ------------------------------------------------------------------
   Suoni sintetici (niente file): pop, errore, successo.
   ------------------------------------------------------------------ */
Buber.sound = (() => {
  let ac = null;
  const ctx = () => (ac ||= new (window.AudioContext || window.webkitAudioContext)());
  function tone({ f = 440, to = f, type = 'sine', dur = 0.15, gain = 0.25, at = 0 }) {
    try {
      const c = ctx(), o = c.createOscillator(), g = c.createGain();
      const t0 = c.currentTime + at;
      o.type = type; o.frequency.setValueAtTime(f, t0); o.frequency.exponentialRampToValueAtTime(Math.max(to, 1), t0 + dur);
      g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(gain, t0 + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g).connect(c.destination); o.start(t0); o.stop(t0 + dur + 0.02);
    } catch (_) {}
  }
  return {
    unlock() { try { ctx().resume(); } catch (_) {} },                    // da chiamare al primo tocco
    pop()   { tone({ f: 600, to: 1100, dur: 0.09, gain: 0.2 }); },
    error() { tone({ f: 180, to: 120, type: 'square', dur: 0.22, gain: 0.12 }); tone({ f: 180, to: 120, type: 'square', dur: 0.22, gain: 0.12, at: 0.26 }); },
    win()   { [523, 659, 784, 1047].forEach((f, i) => tone({ f, dur: 0.18, gain: 0.18, at: i * 0.11 })); },
  };
})();

/* ------------------------------------------------------------------
   Esplosione cartoon trash: flash, palla di fuoco, fumo, scintille,
   scritta comic, schermo che trema e botto. Si autodistrugge.
   ------------------------------------------------------------------ */
Buber.explode = function ({ x, y, size = 1, word = null } = {}) {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const W = innerWidth, H = innerHeight;
  x ??= W / 2; y ??= H / 2;

  const canvas = document.createElement('canvas');
  canvas.className = 'fx-canvas';
  Object.assign(canvas.style, { position: 'fixed', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 1001 });
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  const dpr = Math.min(devicePixelRatio || 1, 2);
  canvas.width = W * dpr; canvas.height = H * dpr; ctx.scale(dpr, dpr);

  const R = 140 * size;
  const fire = [], smoke = [], sparks = [];
  const rnd = (a, b) => a + Math.random() * (b - a);
  for (let i = 0; i < 26; i++) {
    const a = rnd(0, Math.PI * 2), d = rnd(0, R * 0.5);
    fire.push({ x: x + Math.cos(a) * d, y: y + Math.sin(a) * d, r: rnd(R * 0.25, R * 0.6), vx: Math.cos(a) * rnd(60, 220) * size, vy: Math.sin(a) * rnd(60, 220) * size - 60, life: rnd(0.45, 0.8), t: 0, hue: rnd(10, 50) });
  }
  for (let i = 0; i < 18; i++) {
    const a = rnd(0, Math.PI * 2), d = rnd(R * 0.2, R * 0.7);
    smoke.push({ x: x + Math.cos(a) * d, y: y + Math.sin(a) * d, r: rnd(R * 0.3, R * 0.7), vx: Math.cos(a) * rnd(30, 90), vy: -rnd(40, 120), life: rnd(0.9, 1.5), t: 0, g: rnd(70, 130) });
  }
  for (let i = 0; i < 40; i++) {
    const a = rnd(0, Math.PI * 2), v = rnd(400, 1100) * size;
    sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: rnd(0.35, 0.7), t: 0, w: rnd(2, 5) });
  }
  const wordRot = rnd(-0.25, 0.25), wordSize = 64 * Math.sqrt(size);

  // boom: rombo di rumore filtrato in basso, lungo, + sub-bass che scende
  try {
    const ac = new (window.AudioContext || window.webkitAudioContext)();
    const t0 = ac.currentTime, dur = 1.4;
    const buf = ac.createBuffer(1, Math.floor(ac.sampleRate * dur), ac.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) { const k = i / data.length; data[i] = (Math.random() * 2 - 1) * Math.pow(1 - k, 1.6) * (k < 0.03 ? k / 0.03 : 1); }
    const src = ac.createBufferSource(); src.buffer = buf;
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 0.7;
    lp.frequency.setValueAtTime(700, t0); lp.frequency.exponentialRampToValueAtTime(60, t0 + dur);
    const g = ac.createGain(); g.gain.setValueAtTime(1.0 * Math.min(size, 1.2), t0); g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(lp).connect(g).connect(ac.destination); src.start(t0);
    const o = ac.createOscillator(), og = ac.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(95, t0); o.frequency.exponentialRampToValueAtTime(28, t0 + 0.9);
    og.gain.setValueAtTime(0.001, t0); og.gain.exponentialRampToValueAtTime(1.0, t0 + 0.03); og.gain.exponentialRampToValueAtTime(0.001, t0 + 1.0);
    o.connect(og).connect(ac.destination); o.start(t0); o.stop(t0 + 1.05);
  } catch (_) {}

  Buber.vibrate([30, 20, 120]);

  // schermo che trema
  if (!reduce) {
    const el = document.body, t0 = performance.now(), dur = 420 * Math.min(size, 1.3);
    (function shake(now) {
      const k = 1 - (now - t0) / dur;
      if (k <= 0) { el.style.transform = ''; return; }
      const a = 10 * size * k;
      el.style.transform = `translate(${rnd(-a, a)}px, ${rnd(-a, a)}px)`;
      requestAnimationFrame(shake);
    })(t0);
  }

  let last = performance.now(), T = 0;
  function step(dt) {
    T += dt;
    for (const s of smoke) { s.t += dt; if (s.t <= s.life) { s.x += s.vx * dt; s.y += s.vy * dt; s.r += 60 * dt; } }
    for (const f of fire)  { f.t += dt; if (f.t <= f.life) { f.x += f.vx * dt; f.y += f.vy * dt; f.vy -= 120 * dt; } }
    for (const s of sparks){ s.t += dt; if (s.t <= s.life) { s.vy += 900 * dt; s.vx *= 0.98; s.vy *= 0.98; s.px = s.x; s.py = s.y; s.x += s.vx * dt; s.y += s.vy * dt; } }
  }
  function render() {
    ctx.clearRect(0, 0, W, H);

    // flash iniziale
    if (T < 0.12) { ctx.fillStyle = `rgba(255,255,255,${1 - T / 0.12})`; ctx.fillRect(0, 0, W, H); }

    let alive = 0;
    for (const s of smoke) {
      if (s.t > s.life) continue; alive++;
      const k = s.t / s.life;
      ctx.fillStyle = `rgba(${s.g},${s.g},${s.g},${0.55 * (1 - k)})`;
      ctx.beginPath(); ctx.arc(s.x, s.y, Math.max(0, s.r), 0, Math.PI * 2); ctx.fill();
    }
    for (const f of fire) {
      if (f.t > f.life) continue; alive++;
      const k = f.t / f.life;
      const r = Math.max(0, f.r * (0.6 + k * 0.9));
      const grad = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, r);
      grad.addColorStop(0, `hsla(${f.hue + 20},100%,${80 - k * 30}%,${1 - k})`);
      grad.addColorStop(0.5, `hsla(${f.hue},100%,50%,${0.9 * (1 - k)})`);
      grad.addColorStop(1, `hsla(${f.hue - 10},90%,30%,0)`);
      ctx.fillStyle = grad; ctx.beginPath(); ctx.arc(f.x, f.y, r, 0, Math.PI * 2); ctx.fill();
    }
    for (const s of sparks) {
      if (s.t > s.life || s.px == null) continue; alive++;
      const px = s.px, py = s.py;
      ctx.strokeStyle = `rgba(255,${200 - s.t * 200 | 0},60,${1 - s.t / s.life})`; ctx.lineWidth = s.w;
      ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(s.x, s.y); ctx.stroke();
    }

    // scritta comic
    if (word && T > 0.04 && T < 0.9) {
      const k = Math.min(1, (T - 0.04) / 0.12);
      const sc = 0.4 + k * 0.6 * (1 + Math.sin(Math.min(1, (T - 0.04) / 0.25) * Math.PI) * 0.25);
      ctx.save(); ctx.translate(x, y - R * 0.2); ctx.rotate(wordRot); ctx.scale(sc, sc);
      ctx.globalAlpha = T > 0.7 ? 1 - (T - 0.7) / 0.2 : 1;
      ctx.font = `900 ${wordSize}px Impact, "Arial Black", Haettenschweiler, sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round'; ctx.lineWidth = wordSize * 0.18; ctx.strokeStyle = '#1f1d1a'; ctx.strokeText(word, 0, 0);
      ctx.fillStyle = '#ffd43b'; ctx.fillText(word, 0, 0);
      ctx.lineWidth = wordSize * 0.06; ctx.strokeStyle = '#ff6b2c'; ctx.strokeText(word, 0, 0);
      ctx.restore(); alive++;
    }

    return alive;
  }
  function frame(now) {
    const dt = Math.max(0, Math.min((now - last) / 1000, 0.033)); last = now;
    step(dt);
    const alive = render();
    if (alive > 0 || T < 1) requestAnimationFrame(frame); else canvas.remove();
  }
  if (typeof arguments[0]?.freeze === 'number') {      // anteprima statica (debug)
    while (T < arguments[0].freeze) step(1 / 60);
    render(); return;
  }
  requestAnimationFrame(frame);
};

/* ------------------------------------------------------------------
   Sigla di Game of Thrones, sintetizzata (tema principale, 4 battute).
   Ritorna la durata in ms. Niente file audio.
   ------------------------------------------------------------------ */
Buber.sound.got = function () {
  const N = { C4: 261.63, Eb4: 311.13, E4: 329.63, F4: 349.23, G4: 392.0 };
  const E = 0.16;                                   // durata di una croma, in secondi
  const bars = [['G4', 'C4', 'Eb4', 'F4'], ['G4', 'C4', 'Eb4', 'F4'], ['G4', 'C4', 'E4', 'F4'], ['G4', 'C4', 'E4', 'F4']];
  const lens = [3, 3, 1, 1];                        // lunga, lunga, breve, breve (in crome)
  const total = bars.length * 8 * E;
  try {
    const ac = new (window.AudioContext || window.webkitAudioContext)();
    const t0 = ac.currentTime + 0.05;
    const master = ac.createGain(); master.gain.value = 0.9; master.connect(ac.destination);
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1400; lp.Q.value = 0.8; lp.connect(master);
    const note = (f, at, dur, { type = 'sawtooth', gain = 0.22, oct = 1 } = {}) => {
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = type; o.frequency.value = f * oct;
      g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(gain, at + 0.03);
      g.gain.setValueAtTime(gain, at + dur * 0.7); g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
      o.connect(g).connect(lp); o.start(at); o.stop(at + dur + 0.02);
    };
    let t = t0;
    bars.forEach((bar) => {
      // melodia (violoncello): lunga lunga breve breve
      let tb = t;
      bar.forEach((n, i) => { const d = lens[i] * E; note(N[n], tb, d * 0.95); note(N[n], tb, d * 0.95, { type: 'sine', gain: 0.18, oct: 0.5 }); tb += d; });
      // ostinato di crome un'ottava sopra, piano
      for (let i = 0; i < 8; i++) note(N[bar[i % 4]], t + i * E, E * 0.8, { type: 'triangle', gain: 0.06, oct: 2 });
      t += 8 * E;
    });
  } catch (_) {}
  Buber.sound.busyUntil = performance.now() + total * 1000;
  return total * 1000;
};
