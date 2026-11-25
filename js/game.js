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
  const MIX_DISTANCE = 11;                // quanto o pincel precisa "andar" no pote para misturar 100%
                                          // (≈ 2 voltas, ou o mesmo tanto de rabiscos)
  const CONTACT_Y = W.PALETTE_TOP + 0.22; // altura em que a ponta "encosta" nas tintas
  const LIFT_HEIGHT = 0.75;               // pincel levantado (sem tocar)
  const PICK_RADIUS = 1.0;                // raio para pegar tinta de uma poça
  const MIN_STIR_RADIUS = 0.3;            // perto do centro não conta como giro
  const TOUCH_OFFSET_PX = 0;              // deslocamento da ponta em relação ao dedo (0 = exatamente onde o dedo toca)
  const WIN_DELAY = 3.0;                  // segundos de festa antes do próximo desafio
  const MAX_STREAKS = 24;
  const AUTO_MIX_SECONDS = 2.2;           // modo fácil: tempo da mistura automática
  const AUTO_SPIN = 7;                    // velocidade do giro automático (rad/s)

  // Configurações salvas no aparelho (menu de pausa / botões do HUD):
  // easyMix = mistura automática (basta encostar o pincel no pote),
  // music / voice = liga-desliga, theme = tema visual, noAds = comprou "sem anúncios".
  // O idioma fica no i18n.js ('mistura.lang').
  const T = (k, p) => I18N.t(k, p);
  // hints / skips = quantas dicas e pulos ainda restam (começam com START_HINTS / START_SKIPS).
  const START_HINTS = 3;
  const START_SKIPS = 3;
  // musicVol / voiceVol = volume de 0 a 1 (0 = desligado).
  // gems = diamantes; ownedThemes / ownedBrushes = temas e pincéis comprados; brush = pincel em uso.
  const START_GEMS = 20;
  const settings = {
    easyMix: false, musicVol: 0.6, voiceVol: 1, theme: 'classic', noAds: false,
    hints: START_HINTS, skips: START_SKIPS,
    gems: START_GEMS, ownedThemes: ['classic'], ownedBrushes: ['classic'], brush: 'classic',
  };
  try {
    const saved = localStorage.getItem('mistura.autoMix');
    if (saved !== null) settings.easyMix = saved === '1';
    const s = JSON.parse(localStorage.getItem('mistura.settings') || '{}');
    // versão antiga guardava só liga/desliga
    if (s.music === false && s.musicVol === undefined) s.musicVol = 0;
    if (s.voice === false && s.voiceVol === undefined) s.voiceVol = 0;
    delete s.music; delete s.voice;
    // temas eram grátis antes da loja: quem já usava um tema fica com ele
    if (s.theme && !s.ownedThemes) s.ownedThemes = ['classic', s.theme];
    Object.assign(settings, s);
    if (!settings.ownedThemes.includes('classic')) settings.ownedThemes.unshift('classic');
    if (!settings.ownedBrushes.includes('classic')) settings.ownedBrushes.unshift('classic');
  } catch (_) { /* sem armazenamento: usa o padrão */ }
  function saveSettings() {
    try {
      localStorage.setItem('mistura.autoMix', settings.easyMix ? '1' : '0');
      localStorage.setItem('mistura.settings', JSON.stringify(settings));
    } catch (_) { /* ok */ }
  }

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
    btnSkip: $('btn-skip'), btnHelp: $('btn-help'), btnHint: $('btn-hint'),
    hintCount: $('hint-count'), skipCount: $('skip-count'), btnTheme: $('btn-theme'), btnNoAds: $('btn-noads'),
    helpOv: $('help-overlay'), themeOv: $('theme-overlay'), adsOv: $('ads-overlay'),
    btnEasy: $('btn-easy'),
    langPicker: $('lang-picker'), themePicker: $('theme-picker'), brushPicker: $('brush-picker'),
    btnStore: $('btn-store'), storeOv: $('store-overlay'), storeItems: $('store-items'), storeGems: $('store-gems'),
    confirmOv: $('confirm-overlay'), confirmText: $('confirm-text'), confirmYes: $('confirm-yes'),
    confirmNo: $('confirm-no'), confirmPreview: $('confirm-preview'),
    adOv: $('ad-overlay'), adSeconds: $('ad-seconds'),
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
    units: M.emptyUnits(),       // porções de cada tinta no pote
    paints: [],                  // tintas disponíveis na paleta nesta fase
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
  // Música de fundo: loop calmo de 4 compassos (C - G - Am - F) gerado
  // com WebAudio (baixo + arpejo + melodia). Sem arquivos de áudio.
  // =================================================================
  const Music = {
    STEP: 60 / 100 / 2,                       // colcheia a 100 bpm
    BASS: [48, 43, 45, 41],                   // C3, G2, A2, F2 (um por compasso)
    ARP: [[60, 64, 67], [59, 62, 67], [57, 60, 64], [57, 60, 65]],
    MELODY: [76, 0, 79, 0, 81, 0, 79, 0,  74, 0, 0, 71, 74, 0, 79, 0,
             72, 0, 76, 0, 81, 0, 79, 76,  77, 0, 76, 0, 72, 0, 0, 0],
    out: null, timer: null, step: 0, next: 0,
    hz: m => 440 * Math.pow(2, (m - 69) / 12),
    note(freq, t, dur, type, vol) {
      const ctx = Sfx.ctx;
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(this.out);
      o.start(t);
      o.stop(t + dur + 0.05);
    },
    playStep(i, t) {
      const bar = Math.floor(i / 8) % 4, s = i % 8;
      if (s === 0 || s === 4) this.note(this.hz(this.BASS[bar]), t, this.STEP * 3.6, 'sine', 0.11);
      const arp = this.ARP[bar];
      this.note(this.hz(arp[[0, 1, 2, 1][s % 4]] + 12), t, this.STEP * 1.6, 'sine', 0.022);
      const m = this.MELODY[i % 32];
      if (m) this.note(this.hz(m), t, this.STEP * 2.6, 'triangle', 0.05);
    },
    /** Ganho a partir do volume 0..1 (curva quadrada: o controle parece mais "linear" ao ouvido). */
    gainFor(v) { return Math.max(0.0001, v * v * 2.8); },
    /** Muda o volume ao vivo (0 desliga; acima de 0 liga se estava parada). */
    setVolume(v) {
      if (v <= 0) { this.stop(); return; }
      if (!this.timer) { this.start(); return; }
      this.out.gain.setTargetAtTime(this.gainFor(v), Sfx.ctx.currentTime, 0.08);
    },
    /** Liga (se o volume for > 0 e o áudio já liberado por um toque). */
    start() {
      const ctx = Sfx.ctx;
      if (!ctx || settings.musicVol <= 0 || this.timer) return;
      this.out = ctx.createGain();
      this.out.gain.setValueAtTime(0.0001, ctx.currentTime);
      this.out.gain.exponentialRampToValueAtTime(this.gainFor(settings.musicVol), ctx.currentTime + 1.5);
      this.out.connect(ctx.destination);
      this.next = ctx.currentTime + 0.1;
      this.timer = setInterval(() => {
        while (this.next < ctx.currentTime + 0.25) { this.playStep(this.step++, this.next); this.next += this.STEP; }
      }, 60);
    },
    stop() {
      if (!this.timer || !Sfx.ctx) return;
      clearInterval(this.timer);
      this.timer = null;
      const out = this.out, ctx = Sfx.ctx;
      out.gain.cancelScheduledValues(ctx.currentTime);
      out.gain.setValueAtTime(Math.max(0.0001, out.gain.value), ctx.currentTime);
      out.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.4);
      setTimeout(() => out.disconnect(), 600);
    },
  };

  // =================================================================
  // Voz: fala o nome da cor quando a criança acerta.
  // Usa a síntese de voz do próprio navegador (Web Speech API) no idioma
  // escolhido, com tom bem agudo para soar como uma criança. Sem arquivos.
  //
  // Cuidados (cada um corrigia um "às vezes não fala"):
  // - prefere vozes LOCAIS (localService): as vozes online (ex.: "Google ...")
  //   falham sem internet, demoram e às vezes ficam mudas;
  // - guarda a fala em this.live: o Chrome pode descartar o objeto no meio
  //   e a fala some;
  // - depois de cancel() espera um instante antes de speak() (bug do Chrome
  //   que engole a fala seguinte) e chama resume() (fica "pausado" depois
  //   de trocar de aba/app);
  // - se a fala não começar em 1,5 s ou der erro, tenta de novo uma vez com
  //   a voz padrão do idioma, e marca a voz que falhou para não usá-la mais.
  // =================================================================
  const Voice = {
    voice: null,
    bad: new Set(),            // nomes de vozes que falharam
    live: null,                // fala atual (referência forte)
    timer: null, watchdog: null,
    unlocked: false,
    supported: 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window,
    get ss() { return window.speechSynthesis; },
    pickVoice() {
      if (!this.supported) return;
      const lang = I18N.voiceLang();               // ex.: 'pt-BR'
      const base = lang.slice(0, 2).toLowerCase();
      const norm = l => (l || '').replace('_', '-').toLowerCase();
      const voices = this.ss.getVoices().filter(v => !this.bad.has(v.name));
      const exact = voices.filter(v => norm(v.lang) === lang.toLowerCase());
      const pool = exact.length ? exact : voices.filter(v => norm(v.lang).slice(0, 2) === base);
      // Vozes femininas ficam mais parecidas com criança quando o tom sobe
      const female = /francisca|maria|luciana|thalita|vit[oó]ria|camila|helo[ií]sa|leila|samantha|zira|aria|jenny|karen|helena|sabina|laura|elvira|m[oó]nica|paulina|female|feminin/i;
      const local = pool.filter(v => v.localService);
      this.voice = local.find(v => female.test(v.name)) || local[0] ||
                   pool.find(v => female.test(v.name)) || pool[0] || null;
    },
    volume() { return settings.voiceVol; },
    /**
     * Navegadores só liberam a fala dentro de um toque "de verdade"
     * (click/touchend/pointerup/tecla). Fala um texto mudo nesse momento;
     * só marca como liberado se essa fala começar (senão tenta no próximo toque).
     */
    unlock() {
      if (!this.supported || this.unlocked || this.unlocking) return;
      this.unlocking = true;
      this.pickVoice();
      const u = new SpeechSynthesisUtterance('.');
      u.volume = 0;
      u.lang = I18N.voiceLang();
      const ok = () => { this.unlocked = true; this.unlocking = false; };
      u.onstart = ok;
      u.onend = ok;
      // interrompida por outra fala = foi aceita; "not-allowed" = ainda bloqueada
      u.onerror = e => { if (e.error === 'interrupted' || e.error === 'canceled') ok(); else this.unlocking = false; };
      setTimeout(() => { this.unlocking = false; }, 1500);
      this.ss.resume();
      this.ss.speak(u);
    },
    /** force = fala mesmo com o jogo pausado (prévia do volume nas configurações). */
    say(text, delay = 0, force = false) {
      if (!this.supported || this.volume() <= 0) return;
      clearTimeout(this.timer);
      this.timer = setTimeout(() => this.speakNow(text, false, force), delay * 1000);
    },
    speakNow(text, retry, force) {
      if ((state.paused && !force) || this.volume() <= 0) return;
      const ss = this.ss;
      clearTimeout(this.watchdog);
      if (ss.speaking || ss.pending) ss.cancel();
      if (!this.voice && !retry) this.pickVoice();
      setTimeout(() => {
        ss.resume();
        const u = new SpeechSynthesisUtterance(text);
        const voice = retry ? null : this.voice; // na 2ª tentativa: voz padrão do idioma
        u.lang = I18N.voiceLang();
        if (voice) u.voice = voice;
        u.pitch = voice && !voice.localService ? 1.5 : 1.9; // bem agudo = voz de criança
        u.rate = 1.05;
        u.volume = Math.min(1, this.volume());
        let started = false;
        const fail = () => {
          if (retry || started) return;
          if (voice) { this.bad.add(voice.name); this.pickVoice(); }
          this.speakNow(text, true, force);
        };
        u.onstart = () => { started = true; };
        u.onend = () => { if (this.live === u) this.live = null; };
        u.onerror = e => { if (e.error !== 'interrupted' && e.error !== 'canceled') fail(); };
        this.live = u;
        ss.speak(u);
        this.watchdog = setTimeout(() => {
          if (!started && !ss.speaking && this.live === u) { ss.cancel(); fail(); }
        }, 1500);
      }, 80);
    },
    stop() {
      if (!this.supported) return;
      clearTimeout(this.timer);
      clearTimeout(this.watchdog);
      this.live = null;
      this.ss.cancel();
    },
  };
  if (Voice.supported) {
    Voice.pickVoice();
    window.speechSynthesis.onvoiceschanged = () => Voice.pickVoice(); // a lista chega aos poucos
  }

  /** Nome da cor-alvo no idioma atual ("AZUL-CLARO"). */
  const colorName = t => I18N.color(t.id);
  /** Nome da cor para falar ("AZUL-CLARO" -> "azul claro"). */
  const spokenName = name => I18N.lower(name).replace(/-/g, ' ');
  /** Texto da dica quando a mistura não bateu com a meta. */
  function hintText(hint, target) {
    if (hint.type === 'empty') return T('hintEmpty');
    const p = { paint: I18N.paint(hint.key), color: I18N.lower(colorName(target)) };
    return T(hint.type === 'wrong' ? 'hintWrong' : 'hintMore', p);
  }

  // Navegadores só liberam som/voz dentro de um toque "de verdade". No celular,
  // encostar o dedo (pointerdown) ainda NÃO conta: só soltar (pointerup/touchend/click).
  // Por isso tentamos em todos esses eventos; a música começa quando o áudio
  // realmente destrava. O primeiro toque costuma ser o botão "Toque para jogar".
  function unlockAudio() {
    Sfx.unlock();
    Voice.unlock();
    const ctx = Sfx.ctx;
    if (!ctx) return;
    if (ctx.state === 'running') Music.start();
    else ctx.resume().then(() => Music.start()).catch(() => { /* tenta no próximo toque */ });
  }
  ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown'].forEach(ev =>
    document.addEventListener(ev, unlockAudio, true));

  // Botão "Toque para jogar" do splash: libera o som e a criança ouve a primeira cor
  const splashPlay = document.getElementById('splash-play');
  if (splashPlay) splashPlay.addEventListener('click', () => {
    const t = M.TARGETS[state.level];
    Voice.say(T('sayStart', { color: spokenName(colorName(t)) }), 0.5);
  });

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
    unlockPuddles();
  };
  /** Soltou o dedo: parou de misturar, pode pegar tinta de novo. */
  function unlockPuddles() {
    state.stirLock = false;
    state.lockWarned = false;
  }
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
  function totalUnits() { return M.KEYS.reduce((s, k) => s + state.units[k], 0); }

  function updateInteraction(dt) {
    const touching = pointer.down && lift < 0.22 && !state.celebrating;
    let stirring = false;

    if (touching) {
      // 1) Encostou numa poça? Carrega o pincel com aquela cor.
      for (const p of world.puddles) {
        if (!p.userData.active || p.userData.appear < 0.6) continue; // só as tintas desta fase
        const dx = tip.x - p.position.x, dz = tip.z - p.position.z;
        if (dx * dx + dz * dz < PICK_RADIUS * PICK_RADIUS && state.brushLoad !== p.userData.key) {
          // TRAVA DE SEGURANÇA: depois que a criança começou a misturar,
          // passar sem querer por uma poça NÃO pega tinta. Só depois de
          // levantar o dedo (e a mistura automática terminar) é que libera.
          if (state.stirLock || state.autoMixing) {
            if (!state.lockWarned) {
              state.lockWarned = true;
              showToast(T('lockWarn'), 'warn', 2.4);
            }
            continue;
          }
          loadBrush(p);
        }
      }

      // 2) Dentro do pote?
      const dx = tip.x - L.pot.x, dz = tip.z - L.pot.z;
      const r = Math.hypot(dx, dz);
      if (r < L.pot.inner) {
        if (state.brushLoad) transferPaint(dx, dz, r);
        if (totalUnits() > 0) {
          stir(dx, dz, r, dt);
          stirring = true;
          // Começou a misturar (já há 2+ porções): trava as poças até soltar o dedo
          if (state.drops >= 2) state.stirLock = true;
        }
        // Modo fácil: encostou no pote com tinta por misturar -> mistura sozinha
        if (settings.easyMix && state.drops >= 2 && state.mixed < 1) state.autoMixing = true;
      }
    }

    // Mistura automática: avança sozinha, mesmo se a criança tirar o dedo
    if (state.autoMixing) {
      if (state.mixed < 1 && !state.celebrating) {
        state.mixed = Math.min(1, state.mixed + dt / AUTO_MIX_SECONDS);
      } else {
        state.autoMixing = false;
      }
    }

    if (!stirring) {
      state.lastAngle = null;
      state.lastStir = null;
      if (state.autoMixing) state.spin = damp(state.spin, AUTO_SPIN, 3, dt); // gira sozinha
      else state.spin *= Math.exp(-2.2 * dt); // a tinta continua girando um pouquinho
    } else if (state.autoMixing && Math.abs(state.spin) < AUTO_SPIN * 0.5) {
      state.spin = damp(state.spin, AUTO_SPIN, 3, dt); // dedo parado no pote: gira mesmo assim
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
    state.autoMixing = false;

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
    if (wasEmpty) showToast(T('instAnother'), 'good', 2.2);
  }

  /**
   * Mexer a tinta: QUALQUER movimento dentro do pote conta (círculos,
   * rabiscos, vai-e-volta). O progresso é a distância percorrida pela
   * ponta do pincel dentro do pote, dividida por MIX_DISTANCE.
   * O ângulo em volta do centro só serve para decidir para que lado a
   * tinta gira na animação.
   */
  function stir(dx, dz, r, dt) {
    // 1) Quanto a ponta andou desde o último quadro (ignora saltos bruscos)
    let move = 0;
    if (state.lastStir) {
      move = Math.hypot(dx - state.lastStir.x, dz - state.lastStir.z);
      if (move > 1.0) move = 0;
    }
    if (state.mixed < 1) state.mixed = Math.min(1, state.mixed + move / MIX_DISTANCE);

    // 2) Sentido do giro da tinta (segue o pincel quando ele circula)
    const a = Math.atan2(dz, dx);
    let dAng = 0;
    if (state.lastAngle !== null && r > MIN_STIR_RADIUS) {
      dAng = wrapAngle(a - state.lastAngle);
      if (Math.abs(dAng) > 1.5) dAng = 0;
    }
    if (Math.abs(dAng) > 0.002) state.dirSign = Math.sign(dAng);

    // 3) Velocidade do giro: proporcional ao quanto a criança mexe
    const speed = Math.max(Math.abs(dAng), move * 0.9) / Math.max(dt, 1e-3);
    const target = THREE.MathUtils.clamp((state.dirSign || 1) * speed, -14, 14);
    state.spin += (target - state.spin) * 0.3;

    state.lastAngle = r > MIN_STIR_RADIUS ? a : null;
    state.lastStir = { x: dx, z: dz };
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
      showToast(hintText(res.hint, target), 'warn', 4.2);
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
    const cheers = T('cheers'), banners = T('banners');
    const name = colorName(M.TARGETS[state.level]);
    Voice.say(`${spokenName(name)}! ${cheers[state.level % cheers.length]}`, 0.35);
    ui.banner.textContent = banners[state.level % banners.length];
    ui.banner.classList.remove('show');
    void ui.banner.offsetWidth;
    ui.banner.classList.add('show');
    showToast(T('youMade', { color: I18N.lower(name) }), 'good', 2.6);
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
    const tName = colorName(t);
    refreshTargetName();
    ui.name.style.color = M.toCss(M.shade(t.rgb, 0.82));
    ui.swatch.style.background = M.toCss(t.rgb);
    ui.count.textContent = `${state.level + 1}/${M.TARGETS.length}`;
    // "Arruma" a paleta: as poças dão um pulinho
    world.puddles.forEach((p, i) => { p.userData.wobbleT = -i * 0.12; });

    // Progressão: a paleta mostra só as tintas desta fase (3, 4, 5 ou 6)
    const paints = M.paintsForLevel(state.level);
    const newPaints = paints.filter(k => !state.paints.includes(k));
    const firstSetup = state.paints.length === 0;
    state.paints = paints.slice();
    setupPuddles(paints);

    if (!firstSetup && newPaints.length) {
      // Fase nova: apresenta a tinta que chegou
      const many = newPaints.length > 1;
      const list = I18N.list(newPaints.map(k => I18N.paint(k)));
      showToast(T(many ? 'newPaints' : 'newPaint', { list: list.toLocaleUpperCase(), color: tName }), 'good', 3.4);
      Voice.say(T(many ? 'sayNewPaints' : 'sayNewPaint', { list }), 0.3);
      Sfx.pop();
    } else if (announce) {
      showToast(T('newChallenge', { color: tName }), 'good', 2.2);
      Sfx.pop();
    }
  }

  /** Mostra/esconde as poças e as distribui em círculo em volta do pote. */
  function setupPuddles(keys) {
    const slots = W.puddleSlots(keys);
    for (const p of world.puddles) {
      const u = p.userData;
      u.active = keys.includes(u.key);
      if (u.active) {
        if (u.appear < 0.01) p.position.set(slots[u.key].x, W.PALETTE_TOP, slots[u.key].z); // nasce no lugar
        u.slot = slots[u.key];
      }
    }
    if (state.brushLoad && !keys.includes(state.brushLoad)) state.brushLoad = null;
  }

  /** Esvazia o pote e limpa o pincel (botão ↺ também usa isto). */
  function clearPot() {
    state.lastBase = currentBaseColor();
    state.units = M.emptyUnits();
    state.drops = 0;
    state.mixed = 1;
    state.startRGB = state.finalRGB = null;
    state.streaks.length = 0;
    state.evaluated = true;
    state.brushLoad = null;
    state.lastAngle = null;
    state.lastHint = null;
    state.autoMixing = false;
  }

  function restartRound() {
    if (state.celebrating || state.ended) return;
    clearPot();
    ui.btnRestart.classList.remove('attention');
    showToast(T('cleanPot'), 'good', 2);
    Sfx.pop();
  }

  /** Botão ⏭: pula o desafio atual e vai para o próximo. */
  function skipChallenge() {
    if (state.celebrating || state.ended || state.paused) return;
    if (settings.skips <= 0) { showToast(T('noSkips'), 'warn', 2.2); Sfx.hmm(); openStore(); return; }
    settings.skips -= 1;
    saveSettings();
    refreshCounters(ui.btnSkip);
    ui.btnRestart.classList.remove('attention');
    state.level += 1;
    if (state.level >= M.TARGETS.length) { clearPot(); showEnd(); return; }
    startLevel(false);
    showToast(T('skipped'), 'good', 1.8);
    Sfx.pop();
  }

  /**
   * Botão 💡 Dica: mostra (e fala) a receita da cor e faz as tintas certas pularem.
   * Gasta 1 dica por desafio: pedir de novo na mesma cor é grátis.
   */
  let hintPaidLevel = -1;
  function showHint() {
    if (state.celebrating || state.ended || state.paused) return;
    if (hintPaidLevel !== state.level) {
      if (settings.hints <= 0) { showToast(T('noHints'), 'warn', 2.2); Sfx.hmm(); openStore(); return; }
      settings.hints -= 1;
      hintPaidLevel = state.level;
      saveSettings();
      refreshCounters(ui.btnHint);
    }
    const t = M.TARGETS[state.level];
    const keys = M.KEYS.filter(k => t.recipe[k] > 0);
    const part = k => (t.recipe[k] > 1 ? `${t.recipe[k]}× ` : '') + I18N.paint(k); // "2× amarelo"
    showToast(T('hintRecipe', { recipe: keys.map(part).join(' + ') }), 'good', 4.5);
    Voice.say(T('sayHint', { recipe: I18N.list(keys.map(k => I18N.paint(k))) }), 0.1);
    world.puddles.forEach(p => { if (keys.includes(p.userData.key)) p.userData.wobbleT = 0; });
    Sfx.pop();
  }

  /** Atualiza os contadores de dicas/pulos (e deixa o botão cinza quando zera). */
  function refreshCounters(bumped) {
    [[ui.btnHint, ui.hintCount, settings.hints], [ui.btnSkip, ui.skipCount, settings.skips]].forEach(([btn, el, n]) => {
      el.textContent = n;
      btn.classList.toggle('empty', n <= 0);
    });
    if (bumped) {
      bumped.classList.remove('bump-count');
      void bumped.offsetWidth;
      bumped.classList.add('bump-count');
    }
  }
  /** Dá mais dicas/pulos (ex.: depois de um anúncio ou compra). */
  function addHints(n) { settings.hints = Math.max(0, settings.hints + n); saveSettings(); refreshCounters(ui.btnHint); }
  function addSkips(n) { settings.skips = Math.max(0, settings.skips + n); saveSettings(); refreshCounters(ui.btnSkip); }

  /** Nome da cor-alvo no cartaz (nomes compridos usam fonte menor). */
  function refreshTargetName() {
    const name = colorName(M.TARGETS[Math.min(state.level, M.TARGETS.length - 1)]);
    ui.name.textContent = name;
    ui.name.classList.toggle('long', name.length > 7);
  }

  function renderEndSwatches() {
    ui.endSwatches.innerHTML = M.TARGETS.map(t =>
      `<div><b style="background:${M.toCss(t.rgb)}"></b>${colorName(t)}</div>`).join('');
  }

  function showEnd() {
    state.ended = true;
    renderEndSwatches();
    ui.endOv.classList.add('show');
    Voice.say(T('sayEnd'), 0.2);
  }

  function startGame() {
    state.level = 0;
    state.paints = [];
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
      // Aparece/some com um "pop" e desliza até o lugar novo no círculo
      u.appear = damp(u.appear, u.active ? 1 : 0, 7, dt);
      const s = u.appear < 0.995 ? u.appear * (1 + 0.25 * Math.sin(u.appear * Math.PI)) : 1;
      p.scale.setScalar(Math.max(0.001, s));
      p.visible = u.appear > 0.01;
      p.position.x = damp(p.position.x, u.slot.x, 5, dt);
      p.position.z = damp(p.position.z, u.slot.z, 5, dt);
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
    if (state.celebrating) text = T('instCelebrate');
    else if (state.brushLoad) text = T('instCarry', { paint: I18N.paint(state.brushLoad) });
    else if (state.drops >= 2 && state.mixed < 1) {
      if (state.autoMixing) text = T('instMixing');
      else text = settings.easyMix ? T('instTapPot') : T('instStir');
    }
    else if (state.drops === 1) text = T('instAnother');
    else if (state.drops === 0) text = T('instStart');
    else if (state.lastHint === 'wrong') text = T('instClean');
    else text = T('instMore');
    setInstruction(text);

    const progress = state.drops >= 2 ? state.mixed : 0;
    ui.fill.style.width = `${(progress * 100).toFixed(1)}%`;
    const base = state.drops > 0 ? currentBaseColor() : [0.55, 0.25, 0.85];
    ui.fill.style.background = M.toCss(base);
    ui.miniMix.style.background = state.drops > 0 ? M.toCss(base) : '#ffffff';
  }

  // =================================================================
  // Telas por cima do jogo (pausa, ajuda, tema, anúncios)
  // Enquanto qualquer uma está aberta o jogo fica pausado.
  // =================================================================
  const OVERLAYS = [ui.pauseOv, ui.helpOv, ui.themeOv, ui.adsOv, ui.storeOv];
  function openOverlay(ov) {
    if (state.ended) return;
    OVERLAYS.forEach(o => o.classList.toggle('show', o === ov));
    state.paused = true;
    pointer.down = false;
    unlockPuddles();
    Voice.stop();
  }
  function closeOverlays() {
    OVERLAYS.forEach(o => o.classList.remove('show'));
    state.paused = false;
  }
  function setPaused(p) {
    if (state.ended) return;
    if (p) openOverlay(ui.pauseOv); else closeOverlays();
  }
  // Botões "Fechar"/"Entendi" e toque fora do painel fecham as telas de ajuda/tema/anúncios
  document.querySelectorAll('.overlay.closable').forEach(ov => {
    ov.addEventListener('click', e => { if (e.target === ov || e.target.hasAttribute('data-close')) closeOverlays(); });
  });

  // ---------- Configurações: volume da música e da voz ----------
  // Cada linha: botão de mudo (lembra o último volume) + controle deslizante + valor.
  const VOL = {
    music: { key: 'musicVol', last: settings.musicVol || 0.6, apply: v => Music.setVolume(v) },
    voice: { key: 'voiceVol', last: settings.voiceVol || 1, apply: v => { if (v <= 0) Voice.stop(); } },
  };
  function refreshVolumes() {
    document.querySelectorAll('.vol-row').forEach(row => {
      const v = settings[VOL[row.dataset.vol].key];
      row.querySelector('input').value = Math.round(v * 100);
      row.querySelector('.vol-val').textContent = v > 0 ? `${Math.round(v * 100)}%` : T('off');
      row.classList.toggle('muted', v <= 0);
    });
  }
  function setVolume(which, v, preview) {
    const c = VOL[which];
    settings[c.key] = v;
    if (v > 0) c.last = v;
    c.apply(v);
    saveSettings();
    refreshVolumes();
    // Voz: fala o nome da cor atual para ouvir como ficou
    if (which === 'voice' && preview && v > 0) Voice.say(spokenName(colorName(M.TARGETS[Math.min(state.level, M.TARGETS.length - 1)])), 0, true);
  }
  document.querySelectorAll('.vol-row').forEach(row => {
    const which = row.dataset.vol, input = row.querySelector('input');
    input.addEventListener('input', () => setVolume(which, input.value / 100, false));
    input.addEventListener('change', () => setVolume(which, input.value / 100, true));
    row.querySelector('.mute').addEventListener('click', () => {
      const cur = settings[VOL[which].key];
      setVolume(which, cur > 0 ? 0 : VOL[which].last, true);
    });
  });
  function refreshToggles() {
    refreshVolumes();
    [[ui.btnEasy, settings.easyMix]].forEach(([b, on]) => {
      b.textContent = `${T(b.dataset.key)}: ${on ? T('on') : T('off')}`;
      b.classList.toggle('on', on);
    });
  }
  ui.btnEasy.addEventListener('click', () => {
    settings.easyMix = !settings.easyMix;
    if (!settings.easyMix) state.autoMixing = false;
    saveSettings(); refreshToggles();
  });

  // ---------- Idioma ----------
  function renderLangPicker() {
    ui.langPicker.innerHTML = Object.keys(I18N.LANGS).map(k =>
      `<button data-lang="${k}" class="${k === I18N.lang ? 'on' : ''}">${I18N.LANGS[k].label}</button>`).join('');
  }
  ui.langPicker.addEventListener('click', e => {
    const b = e.target.closest('button[data-lang]');
    if (b) I18N.set(b.dataset.lang);
  });
  I18N.onChange(() => {
    renderLangPicker();
    renderThemePicker();
    renderStore();
    refreshToggles();
    refreshTargetName();
    renderEndSwatches();
    lastInstruction = '';
    Voice.voice = null;
    Voice.pickVoice();
    resize(); // textos de tamanhos diferentes mudam a altura do HUD
  });

  // ---------- Temas: cores do HUD + fundo + mesa ----------
  // ui: [principal, escura, mais escura, clara]; bg = fundo/neblina; table = [madeira, veios]
  const THEMES = {
    classic: { ui: ['#8b3fd9', '#5a1a99', '#3f0f72', '#a259ec'], bg: 0xf1d2a6, table: ['#c98d55', '#7a4a22'] },
    ocean:   { ui: ['#1e88e5', '#0d5aa7', '#083f78', '#4fa8f0'], bg: 0xcfe9f7, table: ['#8cc3dc', '#3d7a9c'] },
    forest:  { ui: ['#2e9e4f', '#1d7136', '#124d24', '#57c174'], bg: 0xdcefc4, table: ['#a3c27a', '#567a32'] },
    candy:   { ui: ['#e0428a', '#a82163', '#7a1446', '#f06ea8'], bg: 0xfde0ea, table: ['#f2b8c8', '#c76a8a'] },
    night:   { ui: ['#7c4dff', '#5530c9', '#3a1f92', '#9e7bff'], bg: 0x2b2445, table: ['#5a4b7e', '#2f2550'] },
  };
  function applyTheme(id) {
    if (!THEMES[id] || !settings.ownedThemes.includes(id)) id = 'classic';
    const th = THEMES[id];
    settings.theme = id;
    const st = document.documentElement.style;
    ['--purple', '--purple-d', '--purple-dd', '--purple-l'].forEach((v, i) => st.setProperty(v, th.ui[i]));
    document.querySelector('meta[name="theme-color"]').setAttribute('content', th.ui[0]);
    document.body.style.background = `#${th.bg.toString(16).padStart(6, '0')}`;
    scene.background.setHex(th.bg);
    scene.fog.color.setHex(th.bg);
    W.setTableColors(world.table, th.table[0], th.table[1]);
  }
  const hex = n => `#${n.toString(16).padStart(6, '0')}`;
  const gemTag = n => `<span class="price"><i class="gem"></i>${n}</span>`;
  function themeSwatch(id) {
    const th = THEMES[id];
    return `<span class="sw" style="background:linear-gradient(135deg, ${hex(th.bg)} 0 45%, ${th.table[0]} 45%)">` +
      `<b style="background:${th.ui[0]}"></b></span>`;
  }
  function brushSwatch(id) {
    const s = W.BRUSH_SKINS[id];
    return `<span class="sw brush-sw${s.glow ? ' glow' : ''}${s.shiny ? ' shiny' : ''}">` +
      `<i class="bh" style="background:${hex(s.handle)}"></i><i class="bc" style="background:${hex(s.cap)}"></i>` +
      `<i class="bm" style="background:${hex(s.metal)}"></i><i class="bb" style="background:${hex(s.bristle)}"></i></span>`;
  }
  /** Card do seletor: selecionado (borda), comprado ou com preço em diamantes. */
  function pickCard(kind, id, name, swatch, owned, selected, price) {
    return `<button data-${kind}="${id}" class="${selected ? 'on' : ''}${owned ? '' : ' locked'}">${swatch}` +
      `<span class="nm">${name}</span>${owned ? '' : gemTag(price)}</button>`;
  }
  function renderThemePicker() {
    const names = T('themes');
    ui.themePicker.innerHTML = Object.keys(THEMES).map(id => pickCard('theme', id, names[id], themeSwatch(id),
      settings.ownedThemes.includes(id), id === settings.theme, PRICES.theme)).join('');
    const bn = T('brushes');
    ui.brushPicker.innerHTML = Object.keys(W.BRUSH_SKINS).map(id => pickCard('brush', id, bn[id], brushSwatch(id),
      settings.ownedBrushes.includes(id), id === settings.brush, PRICES.brush)).join('');
    refreshGems();
  }
  async function pickTheme(id) {
    if (!settings.ownedThemes.includes(id)) {
      const ok = await buyWithGems(PRICES.theme, T('confirmTheme', { name: T('themes')[id] }), themeSwatch(id));
      if (!ok) return;
      settings.ownedThemes.push(id);
    }
    applyTheme(id);
    saveSettings();
    renderThemePicker();
    Sfx.pop();
  }
  async function pickBrush(id) {
    if (!settings.ownedBrushes.includes(id)) {
      const ok = await buyWithGems(PRICES.brush, T('confirmBrush', { name: T('brushes')[id] }), brushSwatch(id));
      if (!ok) return;
      settings.ownedBrushes.push(id);
    }
    applyBrush(id);
    saveSettings();
    renderThemePicker();
    Sfx.pop();
  }
  function applyBrush(id) {
    if (!W.BRUSH_SKINS[id] || !settings.ownedBrushes.includes(id)) id = 'classic';
    settings.brush = id;
    W.setBrushSkin(brush, id);
  }
  ui.themePicker.addEventListener('click', e => {
    const b = e.target.closest('button[data-theme]');
    if (b) pickTheme(b.dataset.theme);
  });
  ui.brushPicker.addEventListener('click', e => {
    const b = e.target.closest('button[data-brush]');
    if (b) pickBrush(b.dataset.brush);
  });

  // =================================================================
  // Diamantes e loja
  // Diamantes compram temas, pincéis, dicas e pulos. Dicas e pulos também
  // saem de graça assistindo um anúncio.
  // =================================================================
  const PRICES = { theme: 40, brush: 25 };
  // Pacotes de dicas/pulos (preço em diamantes)
  const STORE_ITEMS = [
    { id: 'hints3',  hints: 3,  gems: 15 },
    { id: 'skips3',  skips: 3,  gems: 20 },
    { id: 'hints10', hints: 10, gems: 40 },
    { id: 'skips10', skips: 10, gems: 55 },
  ];
  // Pacotes de diamantes (dinheiro de verdade). O preço final vem da loja do
  // aparelho (Google Play / App Store) quando a compra for integrada.
  const GEM_PACKS = [
    { id: 'gems100',  gems: 100,  price: { pt: 'R$ 4,90',  en: 'US$ 0.99', es: 'US$ 0.99' } },
    { id: 'gems550',  gems: 550,  price: { pt: 'R$ 19,90', en: 'US$ 4.99', es: 'US$ 4.99' }, best: true },
    { id: 'gems1200', gems: 1200, price: { pt: 'R$ 39,90', en: 'US$ 9.99', es: 'US$ 9.99' } },
  ];

  function refreshGems() {
    document.querySelectorAll('.gem-count').forEach(el => { el.textContent = settings.gems; });
  }
  function grantGems(n) { settings.gems += n; saveSettings(); refreshGems(); }
  /** Pede confirmação e desconta. Sem saldo: avisa e abre a loja. */
  async function buyWithGems(price, question, preview) {
    if (settings.gems < price) {
      showToast(T('noGems'), 'warn', 2.4);
      Sfx.hmm();
      openStore();
      return false;
    }
    const ok = await confirmBox(question, T('buyFor', { price: `<i class="gem"></i> ${price}` }), preview);
    if (!ok) return false;
    settings.gems -= price;
    saveSettings();
    refreshGems();
    showToast(T('bought'), 'good', 1.8);
    return true;
  }

  // ---------- Confirmação (fica por cima das outras telas) ----------
  let confirmResolve = null;
  function confirmBox(text, yesHtml, previewHtml = '') {
    ui.confirmText.textContent = text;
    ui.confirmYes.innerHTML = yesHtml;
    ui.confirmPreview.innerHTML = previewHtml;
    ui.confirmOv.classList.add('show');
    return new Promise(res => { confirmResolve = res; });
  }
  function closeConfirm(v) {
    ui.confirmOv.classList.remove('show');
    if (confirmResolve) { confirmResolve(v); confirmResolve = null; }
  }
  ui.confirmYes.addEventListener('click', () => closeConfirm(true));
  ui.confirmNo.addEventListener('click', () => closeConfirm(false));

  // ---------- Anúncio com recompensa ----------
  // SIMULAÇÃO: mostra uma tela de 5 s e dá a recompensa. Para usar um anúncio
  // de verdade (AdMob, AdSense H5 "rewarded", etc.), defina antes do game.js:
  //   window.MixAds = { showRewarded: () => Promise<boolean> }  // true = assistiu até o fim
  const AD_SECONDS = 5;
  function simulatedRewardedAd() {
    return new Promise(res => {
      let left = AD_SECONDS;
      ui.adSeconds.textContent = left;
      ui.adOv.classList.add('show');
      const t = setInterval(() => {
        left -= 1;
        ui.adSeconds.textContent = Math.max(0, left);
        if (left <= 0) { clearInterval(t); ui.adOv.classList.remove('show'); res(true); }
      }, 1000);
    });
  }
  const Ads = window.MixAds && window.MixAds.showRewarded ? window.MixAds : { showRewarded: simulatedRewardedAd };
  let watchingAd = false;
  async function watchAdFor(what) {
    if (watchingAd) return;
    watchingAd = true;
    Music.stop();
    Voice.stop();
    let ok = false;
    try { ok = await Ads.showRewarded(); } catch (_) { ok = false; }
    watchingAd = false;
    Music.start();
    if (!ok) { showToast(T('adFail'), 'warn', 2.4); return; }
    if (what === 'hint') addHints(1); else addSkips(1);
    renderStore();
    showToast(T('gotReward', { what: T(what === 'hint' ? 'oneHint' : 'oneSkip') }), 'good', 2.2);
    Sfx.win();
  }

  // ---------- Tela da loja ----------
  function itemName(it) {
    return it.hints ? T('itemHints', { n: it.hints }) : T('itemSkips', { n: it.skips });
  }
  function renderStore() {
    ui.storeItems.innerHTML = STORE_ITEMS.map(it =>
      `<div class="store-item"><img src="img/ui/${it.hints ? 'hint' : 'skip'}.png" alt=""><span>${itemName(it)}</span>` +
      `<button class="buy-btn" data-item="${it.id}"><i class="gem"></i>${it.gems}</button></div>`).join('');
    ui.storeGems.innerHTML = GEM_PACKS.map(p =>
      `<div class="store-item${p.best ? ' best' : ''}"><span class="gem-pack"><i class="gem"></i><i class="gem"></i></span>` +
      `<span>${T('gemsPack', { n: p.gems })}</span>` +
      `<button class="buy-btn money" data-pack="${p.id}">${p.price[I18N.lang] || p.price.en}</button></div>`).join('');
    refreshGems();
  }
  function openStore() { renderStore(); openOverlay(ui.storeOv); }
  ui.storeOv.addEventListener('click', async e => {
    const ad = e.target.closest('[data-ad]');
    if (ad) { watchAdFor(ad.dataset.ad); return; }
    const item = e.target.closest('[data-item]');
    if (item) {
      const it = STORE_ITEMS.find(x => x.id === item.dataset.item);
      const preview = `<img class="cf-img" src="img/ui/${it.hints ? 'hint' : 'skip'}.png" alt="">`;
      if (await buyWithGems(it.gems, T('confirmItem', { name: itemName(it) }), preview)) {
        if (it.hints) addHints(it.hints); else addSkips(it.skips);
        Sfx.win();
      }
      return;
    }
    const pack = e.target.closest('[data-pack]');
    if (pack) {
      // Compra com dinheiro de verdade: ainda não integrada (Google Play Billing / App Store).
      // Quando integrar: ao confirmar o pagamento, chame MixGame.grantGems(pacote.gems).
      showToast(T('soonPurchase'), 'warn', 2.6);
    }
  });

  // ---------- Sem anúncios ----------
  // Compra com dinheiro (ainda não integrada). Ao confirmar o pagamento,
  // chame MixGame.setNoAds(true): o botão some.
  function setNoAds(v) {
    settings.noAds = !!v;
    ui.btnNoAds.hidden = settings.noAds;
    saveSettings();
  }

  // ---------- Botões do HUD ----------
  ui.btnPause.addEventListener('click', () => setPaused(true));
  ui.btnResume.addEventListener('click', () => setPaused(false));
  ui.btnRestart.addEventListener('click', restartRound);
  ui.btnSkip.addEventListener('click', skipChallenge);
  ui.btnHelp.addEventListener('click', () => openOverlay(ui.helpOv)); // fica nas configurações
  ui.btnHint.addEventListener('click', showHint);
  ui.btnTheme.addEventListener('click', () => { renderThemePicker(); openOverlay(ui.themeOv); });
  ui.btnNoAds.addEventListener('click', () => openOverlay(ui.adsOv));
  ui.btnStore.addEventListener('click', openStore);
  ui.btnReplay.addEventListener('click', startGame);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) return;
    Music.stop(); // volta no próximo toque
    if (!state.ended && !state.paused) setPaused(true);
  });

  I18N.apply();
  renderLangPicker();
  refreshToggles();
  applyTheme(settings.theme);
  applyBrush(settings.brush);
  ui.btnNoAds.hidden = settings.noAds;
  refreshCounters();
  refreshGems();

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
    setNoAds, applyTheme, applyBrush, settings, addHints, addSkips, grantGems, openStore,
  };

  window.addEventListener('resize', resize);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(resize);
  startGame();
  resize();
  frame();
})();
