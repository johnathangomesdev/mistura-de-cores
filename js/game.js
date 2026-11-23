/* =====================================================================
   game.js — Regras do jogo, controle por toque/mouse, animações e HUD

   CICLO DE JOGO
   1. O jogador arrasta o dedo (ou o mouse com o botão pressionado):
      a ponta do pincel segue o ponto da tela projetado sobre a paleta.
   2. Ponta encosta numa poça  -> pincel fica "carregado" com aquela cor.
   3. Pincel carregado entra no pote -> 1 porção de tinta cai no pote
      (gotas + ondinha) e o pincel volta a ficar limpo.
   4. Com 2+ porções no pote, a tinta fica "listrada" (não misturada).
      Movimentos circulares dentro do pote aumentam o progresso da
      mistura; as listras giram, se esticam e somem aos poucos.
   5. Ao chegar a 100%, a cor do pote é comparada com a cor-alvo:
      parecida -> vitória (confete) e próximo desafio;
      diferente -> dica amigável, e o jogador continua tentando.
   ===================================================================== */
(function () {
  'use strict';

  const M = window.MixLogic;
  const W = window.World;
  const L = W.LAYOUT;

  // ---------------- Ajustes de jogabilidade ----------------
  const TURNS_TO_MIX = 2.5;               // voltas no pote para misturar 100%
  const CONTACT_Y = W.PALETTE_TOP + 0.22; // altura em que a ponta "encosta" nas tintas
  const LIFT_HEIGHT = 0.75;               // pincel levantado (sem tocar)
  const PICK_RADIUS = 1.0;                // raio para pegar tinta de uma poça
  const MIN_STIR_RADIUS = 0.3;            // perto do centro não conta como giro
  const TOUCH_OFFSET_PX = 0;              // deslocamento da ponta em relação ao dedo (0 = exatamente onde o dedo toca)
  const WIN_DELAY = 3.0;                  // segundos de festa antes do próximo desafio
  const MAX_STREAKS = 24;

  // ---------------- DOM ----------------
  const $ = id => document.getElementById(id);
  const canvas = $('game');
  const ui = {
    hudTop: $('hud-top'), hudBottom: $('hud-bottom'),
    name: $('target-name'), swatch: $('target-swatch'), count: $('challenge-count'),
    instruction: $('instruction'), fill: $('progress-fill'), miniMix: $('mini-mix'),
    toast: $('toast'), banner: $('win-banner'),
    pauseOv: $('pause-overlay'), endOv: $('end-overlay'), endSwatches: $('end-swatches'),
    btnPause: $('btn-pause'), btnRestart: $('btn-restart'), btnResume: $('btn-resume'), btnReplay: $('btn-replay'),
  };

  // ---------------- Three.js ----------------
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf1d2a6);
  scene.fog = new THREE.Fog(0xf1d2a6, 26, 50);

  const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 120);
  const world = W.build(scene);
  const pot = world.pot;
  const brush = world.brush;

  // ---------------- Estado do jogo ----------------
  const state = {
    level: 0,
    units: { r: 0, y: 0, b: 0, w: 0 }, // porções de cada tinta no pote
    drops: 0,                    // quantas porções caíram no pote
    mixed: 1,                    // 0 = listrado, 1 = totalmente misturado
    startRGB: null,              // cor do pote antes da última porção
    finalRGB: null,              // cor que o pote terá quando bem misturado
    lastBase: [1, 1, 1],
    streaks: [],                 // listras de tinta ainda não misturadas
    swirl: 0, spin: 0,           // rotação da tinta no pote (ângulo e velocidade)
    lastAngle: null, dirSign: 0,
    brushLoad: null,             // 'r' | 'y' | 'b' | null
    coat: 0,                     // 0..1 animação da tinta na ponta
    evaluated: true,
    celebrating: false, winTimer: 0,
    paused: false, ended: false,
    fill: 0, time: 0,
  };

  const smooth01 = t => t * t * (3 - 2 * t);
  const damp = (a, b, lambda, dt) => a + (b - a) * (1 - Math.exp(-lambda * dt));
  const wrapAngle = a => Math.atan2(Math.sin(a), Math.cos(a));

  // =================================================================
  // Sons simples gerados com WebAudio (sem arquivos)
  // =================================================================
  const Sfx = {
    ctx: null,
    unlock() {
      if (!this.ctx) {
        try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { this.ctx = null; }
      }
      if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
    },
    tone(freq, dur, type = 'sine', vol = 0.12, slideTo = null, delay = 0) {
      if (!this.ctx) return;
      const t0 = this.ctx.currentTime + delay;
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, t0);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(vol, t0 + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g).connect(this.ctx.destination);
      o.start(t0);
      o.stop(t0 + dur + 0.02);
    },
    pick() { this.tone(520, 0.14, 'triangle', 0.12, 820); },
    plop() { this.tone(380, 0.2, 'sine', 0.22, 110); this.tone(900, 0.08, 'sine', 0.05, 500, 0.05); },
    hmm() { this.tone(330, 0.18, 'triangle', 0.1, 280); this.tone(280, 0.22, 'triangle', 0.1, 240, 0.18); },
    win() { [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.3, 'triangle', 0.13, null, i * 0.1)); },
    pop() { this.tone(700, 0.1, 'sine', 0.08, 1200); },
  };

  // =================================================================
  // Voz: fala o nome da cor quando a criança acerta.
  // Usa a síntese de voz do próprio navegador (Web Speech API) em pt-BR,
  // com tom bem agudo para soar como uma criança. Sem arquivos de áudio.
  // =================================================================
  const Voice = {
    voice: null,
    unlocked: false,
    supported: 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window,
    pickVoice() {
      if (!this.supported) return;
      const voices = window.speechSynthesis.getVoices();
      const pt = voices.filter(v => /^pt[-_]?BR/i.test(v.lang));
      const anyPt = pt.length ? pt : voices.filter(v => /^pt/i.test(v.lang));
      // Vozes femininas ficam mais parecidas com criança quando o tom sobe
      const female = /francisca|maria|luciana|thalita|vit[oó]ria|camila|helo[ií]sa|leila|female|feminina|google portugu/i;
      this.voice = anyPt.find(v => female.test(v.name)) || anyPt[0] || null;
    },
    /** Navegadores de celular só liberam a fala depois de um toque. */
    unlock() {
      if (!this.supported || this.unlocked) return;
      this.unlocked = true;
      this.pickVoice();
      const u = new SpeechSynthesisUtterance(' ');
      u.volume = 0;
      window.speechSynthesis.speak(u);
    },
    say(text, delay = 0) {
      if (!this.supported) return;
      setTimeout(() => {
        if (state.paused) return;
        if (!this.voice) this.pickVoice();
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.lang = 'pt-BR';
        if (this.voice) u.voice = this.voice;
        u.pitch = 1.9;  // bem agudo = voz de criança
        u.rate = 1.05;
        u.volume = 1;
        window.speechSynthesis.speak(u);
      }, delay * 1000);
    },
    stop() { if (this.supported) window.speechSynthesis.cancel(); },
  };
  if (Voice.supported) {
    Voice.pickVoice();
    window.speechSynthesis.onvoiceschanged = () => Voice.pickVoice();
  }

  /** Nome da cor para falar ("AZUL-CLARO" -> "azul claro"). */
  const spokenName = name => name.toLowerCase().replace(/-/g, ' ');

  // =================================================================
  // Câmera: enquadra a paleta no espaço livre entre os HUDs
  // =================================================================
  const CAM_ELEV = THREE.MathUtils.degToRad(58);
  const CAM_DIR = new THREE.Vector3(0, Math.sin(CAM_ELEV), Math.cos(CAM_ELEV));
  const CAM_TARGET = new THREE.Vector3(0, 0, 0.55);
  const fitPoints = W.getFitPoints();
  const tmpV = new THREE.Vector3();

  function placeCamera(dist) {
    camera.position.copy(CAM_TARGET).addScaledVector(CAM_DIR, dist);
    camera.lookAt(CAM_TARGET);
    camera.updateMatrixWorld();
  }
  function projectedBounds() {
    const b = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity };
    for (const p of fitPoints) {
      tmpV.copy(p).project(camera);
      b.minX = Math.min(b.minX, tmpV.x); b.maxX = Math.max(b.maxX, tmpV.x);
      b.minY = Math.min(b.minY, tmpV.y); b.maxY = Math.max(b.maxY, tmpV.y);
    }
    return b;
  }

  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.clearViewOffset();
    camera.updateProjectionMatrix();

    // Área livre (em coordenadas NDC -1..1) entre o HUD de cima e o de baixo
    const topPx = ui.hudTop.getBoundingClientRect().bottom + 4;
    const botPx = h - ui.hudBottom.getBoundingClientRect().top + 4;
    const topLim = 1 - (2 * topPx) / h;
    const botLim = -1 + (2 * botPx) / h;
    const availY = Math.max(0.6, topLim - botLim);
    const availX = 1.9;

    // Busca binária pela menor distância em que tudo cabe
    let lo = 5, hi = 90;
    for (let i = 0; i < 28; i++) {
      const mid = (lo + hi) / 2;
      placeCamera(mid);
      const b = projectedBounds();
      if (b.maxX - b.minX <= availX && b.maxY - b.minY <= availY) hi = mid; else lo = mid;
    }
    placeCamera(hi);
    const b = projectedBounds();
    // Desloca a imagem para centralizar a paleta na área livre
    const shiftY = (topLim + botLim) / 2 - (b.maxY + b.minY) / 2;
    camera.setViewOffset(w, h, 0, (shiftY * h) / 2, w, h);
    camera.updateProjectionMatrix();
  }

  // =================================================================
  // Entrada: toque e mouse controlam só o pincel (sem joystick/botões)
  // =================================================================
  const pointer = { sx: 0, sy: 0, down: false, active: false, id: null };

  function readPointer(e) {
    pointer.sx = e.clientX;
    pointer.sy = e.clientY - (e.pointerType === 'touch' || e.pointerType === 'pen' ? TOUCH_OFFSET_PX : 0);
  }
  canvas.addEventListener('pointerdown', e => {
    if (state.paused || state.ended) return;
    Sfx.unlock();
    Voice.unlock();
    pointer.down = true;
    pointer.active = true;
    pointer.id = e.pointerId;
    readPointer(e);
    try { canvas.setPointerCapture(e.pointerId); } catch (_) { /* ok */ }
    e.preventDefault();
  });
  canvas.addEventListener('pointermove', e => {
    if (pointer.down && e.pointerId !== pointer.id) return; // ignora um segundo dedo
    readPointer(e);
    if (e.pointerType === 'mouse') pointer.active = true; // no PC o pincel segue o mouse (levantado)
  });
  const release = e => {
    if (e.pointerId !== pointer.id) return;
    pointer.down = false;
    pointer.id = null;
  };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);
  canvas.addEventListener('contextmenu', e => e.preventDefault());

  // Converte a posição na tela para um ponto sobre a paleta (plano y = CONTACT_Y)
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const contactPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -CONTACT_Y);
  function screenToTable(sx, sy, out) {
    const r = canvas.getBoundingClientRect();
    ndc.set(((sx - r.left) / r.width) * 2 - 1, -((sy - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    return raycaster.ray.intersectPlane(contactPlane, out);
  }

  // =================================================================
  // Pincel
  // =================================================================
  const tip = new THREE.Vector3(L.park.x, CONTACT_Y + LIFT_HEIGHT, L.park.z);
  const tipTarget = new THREE.Vector3(L.park.x, CONTACT_Y, L.park.z);
  const tipPrev = new THREE.Vector3().copy(tip);
  const tipVel = new THREE.Vector3();
  const BASE_DIR = new THREE.Vector3(0.5, 1, -0.15).normalize(); // cabo inclinado para cima/direita
  const UP = new THREE.Vector3(0, 1, 0);
  const leanDir = new THREE.Vector3();
  const leanQuat = new THREE.Quaternion();
  let lift = LIFT_HEIGHT;
  const hit = new THREE.Vector3();

  function updateBrush(dt) {
    if (pointer.active && screenToTable(pointer.sx, pointer.sy, hit)) {
      tipTarget.set(THREE.MathUtils.clamp(hit.x, -6, 6), CONTACT_Y, THREE.MathUtils.clamp(hit.z, -5.5, 6.5));
    }
    // Abaixa enquanto o dedo/botão está pressionado
    lift = damp(lift, pointer.down ? 0 : LIFT_HEIGHT, 18, dt);

    tipPrev.copy(tip);
    const k = 1 - Math.exp(-24 * dt); // segue o dedo com uma leve suavização
    tip.x += (tipTarget.x - tip.x) * k;
    tip.z += (tipTarget.z - tip.z) * k;
    tip.y = CONTACT_Y + lift;
    brush.root.position.copy(tip);

    // O cabo "balança" na direção oposta ao movimento (sensação de arrasto)
    if (dt > 0) tipVel.lerp(tmpV.copy(tip).sub(tipPrev).divideScalar(dt), 0.25);
    leanDir.set(BASE_DIR.x - tipVel.x * 0.035, BASE_DIR.y, BASE_DIR.z - tipVel.z * 0.035).normalize();
    leanQuat.setFromUnitVectors(UP, leanDir);
    brush.tilt.quaternion.slerp(leanQuat, 1 - Math.exp(-12 * dt));

    // Tinta na ponta: cresce ao carregar, some ao soltar no pote
    state.coat = damp(state.coat, state.brushLoad ? 1 : 0, 14, dt);
    brush.coating.visible = state.coat > 0.02;
    brush.coating.scale.setScalar(Math.max(0.001, state.coat));
  }

  // =================================================================
  // Interações: pegar tinta, despejar no pote, girar para misturar
  // =================================================================
  function totalUnits() { return state.units.r + state.units.y + state.units.b + state.units.w; }

  function updateInteraction(dt) {
    const touching = pointer.down && lift < 0.22 && !state.celebrating;
    let stirring = false;

    if (touching) {
      // 1) Encostou numa poça? Carrega o pincel com aquela cor.
      for (const p of world.puddles) {
        const dx = tip.x - p.position.x, dz = tip.z - p.position.z;
        if (dx * dx + dz * dz < PICK_RADIUS * PICK_RADIUS && state.brushLoad !== p.userData.key) {
          loadBrush(p);
        }
      }

      // 2) Dentro do pote?
      const dx = tip.x - L.pot.x, dz = tip.z - L.pot.z;
      const r = Math.hypot(dx, dz);
      if (r < L.pot.inner) {
        if (state.brushLoad) transferPaint(dx, dz, r);
        if (totalUnits() > 0) { stir(dx, dz, r, dt); stirring = true; }
      }
    }
    if (!stirring) {
      state.lastAngle = null;
      state.spin *= Math.exp(-2.2 * dt); // a tinta continua girando um pouquinho
    }
    state.swirl += state.spin * dt;

    // As listras se esticam conforme a tinta gira
    for (const s of state.streaks) {
      s.grow = Math.min(1, s.grow + dt * 3);
      s.stretch += Math.abs(state.spin * dt);
    }

    // Mistura completa? Hora de comparar com a meta.
    if (!state.evaluated && state.mixed >= 1) evaluateMix();
  }

  function loadBrush(puddle) {
    const key = puddle.userData.key;
    state.brushLoad = key;
    const rgb = M.BASE_PAINTS[key].rgb;
    brush.coatMat.color.setRGB(rgb[0], rgb[1], rgb[2]);
    state.coat = Math.min(state.coat, 0.3); // "re-pinta" a ponta com a nova cor
    puddle.userData.wobbleT = 0;
    Sfx.pick();
  }

  /** Solta uma porção da tinta do pincel no pote. */
  function transferPaint(dx, dz, r) {
    const key = state.brushLoad;
    const rgb = M.BASE_PAINTS[key].rgb;
    state.brushLoad = null; // ponta limpa de novo

    const prevBase = currentBaseColor();
    const wasEmpty = totalUnits() === 0;
    state.units[key] += 1;
    state.drops += 1;
    state.finalRGB = M.mixAmounts(state.units);

    if (wasEmpty) {
      // Primeira porção: o pote só tem uma cor, nada para misturar ainda
      state.startRGB = rgb.slice();
      state.mixed = 1;
      state.evaluated = true;
      state.streaks.length = 0;
    } else {
      // Nova cor por cima: começa "listrada" e precisa ser misturada
      state.startRGB = prevBase;
      state.mixed = 0;
      state.evaluated = false;
      state.dirSign = 0;
      const ang = Math.atan2(dz, dx);
      const rad = THREE.MathUtils.clamp(r / L.pot.inner, 0.22, 0.82);
      state.streaks.push({ rgb, ang, rad, len: 1.0, width: 0.17, stretch: 0, grow: 0 });
      state.streaks.push({ rgb, ang: ang + 0.5, rad: Math.max(0.15, rad - 0.2), len: 0.7, width: 0.1, stretch: 0, grow: 0 });
      state.streaks.push({ rgb, ang: ang - 0.6, rad: Math.min(0.9, rad + 0.16), len: 0.6, width: 0.08, stretch: 0, grow: 0 });
      while (state.streaks.length > MAX_STREAKS) state.streaks.shift();
    }

    world.fx.spawnDrops(tip, rgb, surfaceWorldY() + 0.02);
    Sfx.plop();
    if (wasEmpty) showToast(`Agora pegue outra cor!`, 'good', 2.2);
  }

  /** Detecta o movimento circular: soma a variação de ângulo em volta do centro. */
  function stir(dx, dz, r, dt) {
    const a = Math.atan2(dz, dx);
    if (state.lastAngle !== null && r > MIN_STIR_RADIUS) {
      const d = wrapAngle(a - state.lastAngle);
      if (Math.abs(d) < 1.5) { // ignora saltos bruscos
        const target = THREE.MathUtils.clamp(d / Math.max(dt, 1e-3), -14, 14);
        state.spin += (target - state.spin) * 0.3;
        if (state.mixed < 1 && Math.abs(d) > 0.002) {
          // Girar sempre no mesmo sentido mistura mais rápido que vai-e-volta
          const sign = Math.sign(d);
          const steady = state.dirSign === 0 || sign === state.dirSign ? 1 : 0.4;
          state.dirSign = sign;
          state.mixed = Math.min(1, state.mixed + (Math.abs(d) * steady) / (Math.PI * 2 * TURNS_TO_MIX));
        }
      }
    }
    state.lastAngle = r > MIN_STIR_RADIUS ? a : null;
  }

  function evaluateMix() {
    state.evaluated = true;
    state.streaks.length = 0;
    const target = M.TARGETS[state.level];
    const res = M.evaluate(state.units, target);
    state.lastHint = res.hint ? res.hint.type : null;
    if (res.match) {
      win();
    } else {
      showToast(res.hint.text, 'warn', 4.2);
      mascotAnim('shake');
      Sfx.hmm();
      if (res.hint.type === 'wrong') {
        ui.btnRestart.classList.remove('attention');
        void ui.btnRestart.offsetWidth; // reinicia a animação CSS
        ui.btnRestart.classList.add('attention');
      }
    }
  }

  // =================================================================
  // Vitória e progressão de desafios
  // =================================================================
  function win() {
    state.celebrating = true;
    state.winTimer = WIN_DELAY;
    const center = new THREE.Vector3(L.pot.x, surfaceWorldY(), L.pot.z);
    world.fx.burst(center);
    mascotAnim('jump');
    Sfx.win();
    // A criança "fala" a cor que acabou de fazer
    const cheers = ['Muito bem!', 'Que lindo!', 'Consegui!', 'Que legal!'];
    Voice.say(`${spokenName(M.TARGETS[state.level].name)}! ${cheers[state.level % cheers.length]}`, 0.35);
    ui.banner.textContent = ['Muito bem!', 'Incrível!', 'Perfeito!', 'Uau!'][state.level % 4];
    ui.banner.classList.remove('show');
    void ui.banner.offsetWidth;
    ui.banner.classList.add('show');
    showToast(`Você fez ${M.TARGETS[state.level].name.toLowerCase()}!`, 'good', 2.6);
  }

  function nextLevel() {
    state.celebrating = false;
    state.level += 1;
    if (state.level >= M.TARGETS.length) { showEnd(); return; }
    startLevel(true);
  }

  /** Prepara a rodada: pote vazio, pincel limpo, HUD com a nova meta. */
  function startLevel(announce) {
    clearPot();
    const t = M.TARGETS[state.level];
    ui.name.textContent = t.name;
    ui.name.classList.toggle('long', t.name.length > 7); // nomes compridos usam fonte menor
    ui.name.style.color = M.toCss(M.shade(t.rgb, 0.82));
    ui.swatch.style.background = M.toCss(t.rgb);
    ui.count.textContent = `${state.level + 1}/${M.TARGETS.length}`;
    // "Arruma" a paleta: as poças dão um pulinho
    world.puddles.forEach((p, i) => { p.userData.wobbleT = -i * 0.12; });
    if (announce) { showToast(`Novo desafio: ${t.name}!`, 'good', 2.2); Sfx.pop(); }
  }

  /** Esvazia o pote e limpa o pincel (botão ↺ também usa isto). */
  function clearPot() {
    state.lastBase = currentBaseColor();
    state.units = { r: 0, y: 0, b: 0, w: 0 };
    state.drops = 0;
    state.mixed = 1;
    state.startRGB = state.finalRGB = null;
    state.streaks.length = 0;
    state.evaluated = true;
    state.brushLoad = null;
    state.lastAngle = null;
    state.lastHint = null;
  }

  function restartRound() {
    if (state.celebrating || state.ended) return;
    clearPot();
    ui.btnRestart.classList.remove('attention');
    showToast('Pote limpinho! Vamos de novo.', 'good', 2);
    Sfx.pop();
  }

  function showEnd() {
    state.ended = true;
    ui.endSwatches.innerHTML = M.TARGETS.map(t =>
      `<div><b style="background:${M.toCss(t.rgb)}"></b>${t.name}</div>`).join('');
    ui.endOv.classList.add('show');
    Voice.say('Parabéns! Você fez todas as cores!', 0.2);
  }

  function startGame() {
    state.level = 0;
    state.ended = false;
    state.celebrating = false;
    ui.endOv.classList.remove('show');
    startLevel(false);
  }

  // =================================================================
  // Superfície da tinta no pote (desenhada em canvas a cada quadro)
  // =================================================================
  function currentBaseColor() {
    if (state.drops === 0) return state.lastBase;
    if (state.drops === 1 || state.mixed >= 1 || !state.startRGB) return state.finalRGB;
    return M.lerp(state.startRGB, state.finalRGB, smooth01(state.mixed));
  }

  function surfaceLocalH() { return 0.15 + state.fill; }
  function surfaceWorldY() { return pot.group.position.y + surfaceLocalH() * L.pot.scale; }

  const pctx = pot.canvas.getContext('2d');
  const PS = pot.canvas.width;

  function drawPotSurface() {
    const c = PS / 2;
    const base = currentBaseColor();
    pctx.globalAlpha = 1;
    pctx.fillStyle = M.toCss(base);
    pctx.fillRect(0, 0, PS, PS);

    pctx.save();
    pctx.translate(c, c);
    pctx.lineCap = 'round';

    // Listras ainda não misturadas: giram com a tinta (mais rápido no centro,
    // criando o efeito de espiral), se esticam e desbotam com o progresso.
    const unmixed = state.drops >= 2 ? 1 - state.mixed : 0;
    if (unmixed > 0.002) {
      for (const s of state.streaks) {
        const rot = s.ang + state.swirl * (1.3 - 0.65 * s.rad);
        const len = s.len + s.stretch * 0.45;
        const w = s.width * PS * (1 - 0.6 * Math.min(1, s.stretch / 9)) * s.grow;
        pctx.globalAlpha = Math.min(1, unmixed * 1.3);
        pctx.strokeStyle = M.toCss(s.rgb);
        pctx.lineWidth = Math.max(2, w);
        pctx.beginPath();
        pctx.arc(0, 0, s.rad * c * 0.95, rot - len / 2, rot + len / 2);
        pctx.stroke();
      }
    }

    // Reflexos claros em espiral (dão a sensação de tinta brilhante girando)
    pctx.globalAlpha = 0.2;
    pctx.strokeStyle = '#ffffff';
    pctx.lineWidth = PS * 0.022;
    for (let k = 0; k < 3; k++) {
      pctx.beginPath();
      for (let i = 0; i <= 20; i++) {
        const t = i / 20;
        const ang = state.swirl * 0.9 + k * 2.094 + t * 2.4;
        const rr = c * (0.18 + 0.66 * t);
        const x = Math.cos(ang) * rr, y = Math.sin(ang) * rr;
        if (i === 0) pctx.moveTo(x, y); else pctx.lineTo(x, y);
      }
      pctx.stroke();
    }
    pctx.restore();

    // Sombra na borda (profundidade)
    pctx.globalAlpha = 1;
    const g = pctx.createRadialGradient(c, c, c * 0.6, c, c, c);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.28)');
    pctx.fillStyle = g;
    pctx.fillRect(0, 0, PS, PS);

    pot.texture.needsUpdate = true;
  }

  function updatePot(dt) {
    // O nível de tinta sobe com cada porção
    const total = totalUnits();
    const want = total > 0 ? Math.min(0.06 + total * 0.04, 0.27) : 0;
    state.fill = damp(state.fill, want, 6, dt);
    const visible = state.fill > 0.008;
    pot.surface.visible = visible;
    if (visible) {
      const h = surfaceLocalH();
      const r = W.potInnerRadius(h);
      pot.surface.position.y = h;
      pot.surface.scale.set(r, 1, r);
      drawPotSurface();
    }

    // Setas "gire!" aparecem enquanto há tinta para misturar
    const needStir = state.drops >= 2 && state.mixed < 1 && !state.celebrating;
    const wantOpacity = needStir ? 0.55 + 0.3 * Math.sin(state.time * 5) : 0;
    pot.arrows.material.opacity = damp(pot.arrows.material.opacity, wantOpacity, 8, dt);
    pot.arrows.visible = pot.arrows.material.opacity > 0.01;
    pot.arrows.rotation.y -= dt * 0.9; // gira no sentido das setas
  }

  // =================================================================
  // Poças e mascote
  // =================================================================
  function updatePuddles(dt) {
    for (const p of world.puddles) {
      const u = p.userData;
      u.wobbleT += dt;
      const t = Math.max(0, u.wobbleT);
      const w = Math.sin(t * 22) * 0.16 * Math.exp(-t * 5);
      u.inner.scale.set(1 + w * 0.5, 1 - w, 1 + w * 0.5);
    }
  }

  const mascot = { mode: 'idle', t: 0 };
  const mascotColor = new THREE.Color();
  function mascotAnim(mode) { mascot.mode = mode; mascot.t = 0; }

  function updateMascot(dt) {
    const m = world.mascot;
    mascot.t += dt;
    const rgb = M.TARGETS[Math.min(state.level, M.TARGETS.length - 1)].rgb;
    mascotColor.setRGB(rgb[0], rgb[1], rgb[2]);
    m.mat.color.lerp(mascotColor, 1 - Math.exp(-4 * dt));

    // Olha para a câmera
    m.root.lookAt(camera.position.x, m.root.position.y + (camera.position.y - m.root.position.y) * 0.35, camera.position.z);

    const b = m.body;
    b.position.y = 0;
    b.rotation.set(0, 0, 0);
    b.scale.set(1, 1, 1);
    const idle = Math.sin(state.time * 3);
    if (mascot.mode === 'jump' && mascot.t < 1.4) {
      const t = mascot.t;
      const jumps = Math.abs(Math.sin(t * Math.PI * 2.1));
      b.position.y = jumps * 0.7;
      b.rotation.y = t < 0.7 ? smooth01(t / 0.7) * Math.PI * 2 : 0;
      const sq = 1 - (1 - jumps) * 0.15;
      b.scale.set(2 - sq, sq, 2 - sq);
    } else if (mascot.mode === 'shake' && mascot.t < 0.9) {
      b.rotation.z = Math.sin(mascot.t * 28) * 0.18 * (1 - mascot.t / 0.9);
    } else {
      mascot.mode = 'idle';
      b.position.y = Math.max(0, idle) * 0.08;
      b.scale.set(1 + idle * 0.03, 1 - idle * 0.03, 1 + idle * 0.03);
      b.rotation.z = Math.sin(state.time * 1.3) * 0.05;
    }
  }

  // =================================================================
  // HUD
  // =================================================================
  let lastInstruction = '';
  function setInstruction(text) {
    if (text === lastInstruction) return;
    lastInstruction = text;
    ui.instruction.textContent = text;
    ui.instruction.classList.remove('bump');
    void ui.instruction.offsetWidth;
    ui.instruction.classList.add('bump');
  }

  let toastTimer = null;
  function showToast(text, kind = '', seconds = 3) {
    ui.toast.textContent = text;
    ui.toast.className = `show ${kind}`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { ui.toast.className = kind; }, seconds * 1000);
  }

  function updateHud() {
    // Instrução curta que muda conforme o que a criança deve fazer agora
    let text;
    if (state.celebrating) text = 'Uau! Cor perfeita!';
    else if (state.brushLoad) text = `Leve o ${M.BASE_PAINTS[state.brushLoad].name} até o pote!`;
    else if (state.drops >= 2 && state.mixed < 1) text = 'Gire o pincel no pote para misturar!';
    else if (state.drops === 1) text = 'Agora pegue outra cor!';
    else if (state.drops === 0) text = 'Pegue uma cor, leve ao pote e gire para misturar';
    else if (state.lastHint === 'wrong') text = 'Toque em ↺ para limpar o pote';
    else text = 'Adicione mais tinta e misture de novo!';
    setInstruction(text);

    const progress = state.drops >= 2 ? state.mixed : 0;
    ui.fill.style.width = `${(progress * 100).toFixed(1)}%`;
    const base = state.drops > 0 ? currentBaseColor() : [0.55, 0.25, 0.85];
    ui.fill.style.background = M.toCss(base);
    ui.miniMix.style.background = state.drops > 0 ? M.toCss(base) : '#ffffff';
  }

  // Botões
  function setPaused(p) {
    if (state.ended) return;
    state.paused = p;
    pointer.down = false;
    if (p) Voice.stop();
    ui.pauseOv.classList.toggle('show', p);
  }
  ui.btnPause.addEventListener('click', () => setPaused(true));
  ui.btnResume.addEventListener('click', () => setPaused(false));
  ui.btnRestart.addEventListener('click', restartRound);
  ui.btnReplay.addEventListener('click', startGame);
  document.addEventListener('visibilitychange', () => { if (document.hidden && !state.ended) setPaused(true); });

  // =================================================================
  // Laço principal
  // =================================================================
  const clock = new THREE.Clock();
  function frame() {
    requestAnimationFrame(frame);
    update(Math.min(clock.getDelta(), 0.05));
    renderer.render(scene, camera);
  }

  function update(dt) {
    if (!state.paused) {
      state.time += dt;
      updateBrush(dt);
      updateInteraction(dt);
      updatePot(dt);
      updatePuddles(dt);
      updateMascot(dt);
      world.fx.update(dt, camera);
      updateHud();
      if (state.celebrating) {
        state.winTimer -= dt;
        if (state.winTimer <= 0) nextLevel();
      }
    }
  }

  // Acesso para depuração pelo console do navegador (ex.: MixGame.state)
  window.MixGame = {
    state, camera, world, update,
    render: () => renderer.render(scene, camera),
    goToLevel: i => { state.level = i; state.celebrating = false; startLevel(false); },
  };

  window.addEventListener('resize', resize);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(resize);
  startGame();
  resize();
  frame();
})();
