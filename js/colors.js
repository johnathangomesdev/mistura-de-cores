/* =====================================================================
   colors.js — A "química" das tintas (não depende do Three.js)

   Crianças aprendem as cores primárias como VERMELHO, AMARELO e AZUL
   (modelo RYB). Misturar em RGB daria resultados estranhos
   (vermelho + amarelo + azul viraria cinza-claro, amarelo + azul viraria
   cinza). Por isso usamos um "cubo RYB": definimos a cor que aparece
   em cada canto do cubo (ex.: vermelho + azul = roxo) e interpolamos
   entre os cantos. As quantidades de tinta são normalizadas pela maior
   delas, então só a PROPORÇÃO importa (2 vermelhos + 2 azuis = 1 + 1).

   Depois entram as tintas extras:
   - BRANCO clareia   (vermelho + branco = rosa)
   - PRETO escurece   (branco + preto = cinza)
   - VERDE é um "atalho": vale meio amarelo + meio azul.

   PROGRESSÃO: a paleta começa com 3 tintas e ganha uma nova a cada fase
   (3 -> 4 -> 5 -> 6). Veja STAGE_PAINTS e o campo "stage" dos desafios.
   ===================================================================== */
(function (global) {
  'use strict';

  // Cor (RGB 0..1) de cada canto do cubo RYB
  const CORNER = {
    w:   [1.00, 1.00, 1.00], // nenhuma tinta
    r:   [0.93, 0.13, 0.15], // vermelho
    y:   [1.00, 0.85, 0.10], // amarelo
    b:   [0.13, 0.40, 0.90], // azul
    ry:  [1.00, 0.55, 0.08], // vermelho + amarelo = laranja
    rb:  [0.55, 0.17, 0.78], // vermelho + azul = roxo
    yb:  [0.18, 0.70, 0.27], // amarelo + azul = verde
    ryb: [0.47, 0.29, 0.14], // as três = marrom
  };

  /** Interpolação trilinear dentro do cubo RYB (r, y, b entre 0 e 1). */
  function rybToRgb(r, y, b) {
    const out = [0, 0, 0];
    for (let i = 0; i < 3; i++) {
      out[i] =
        CORNER.w[i]   * (1 - r) * (1 - y) * (1 - b) +
        CORNER.r[i]   * r       * (1 - y) * (1 - b) +
        CORNER.y[i]   * (1 - r) * y       * (1 - b) +
        CORNER.b[i]   * (1 - r) * (1 - y) * b       +
        CORNER.ry[i]  * r       * y       * (1 - b) +
        CORNER.rb[i]  * r       * (1 - y) * b       +
        CORNER.yb[i]  * (1 - r) * y       * b       +
        CORNER.ryb[i] * r       * y       * b;
    }
    return out;
  }

  // ---------- utilidades de cor ----------
  const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const shade = (c, k) => [c[0] * k, c[1] * k, c[2] * k];
  const to255 = v => Math.max(0, Math.min(255, Math.round(v * 255)));
  const toCss = (c, alpha) => alpha === undefined
    ? `rgb(${to255(c[0])},${to255(c[1])},${to255(c[2])})`
    : `rgba(${to255(c[0])},${to255(c[1])},${to255(c[2])},${alpha})`;

  const WHITE_RGB = [0.97, 0.97, 0.95];
  const BLACK_RGB = [0.1, 0.09, 0.11];
  const WHITE_STRENGTH = 0.9; // quanto o branco clareia (fração de branco × força)
  const BLACK_STRENGTH = 1.0; // quanto o preto escurece (fração de preto × força)

  // ---------- tintas base ----------
  const BASE_PAINTS = {
    r: { key: 'r', name: 'vermelho', rgb: CORNER.r },
    y: { key: 'y', name: 'amarelo',  rgb: CORNER.y },
    b: { key: 'b', name: 'azul',     rgb: CORNER.b },
    w: { key: 'w', name: 'branco',   rgb: WHITE_RGB },
    k: { key: 'k', name: 'preto',    rgb: BLACK_RGB },
    g: { key: 'g', name: 'verde',    rgb: CORNER.yb },
  };
  const KEYS = ['r', 'y', 'b', 'w', 'k', 'g'];
  const PIGMENTS = ['r', 'y', 'b', 'w', 'k']; // o verde vira amarelo + azul

  /** Quantidades vazias de todas as tintas. */
  const emptyUnits = () => ({ r: 0, y: 0, b: 0, w: 0, k: 0, g: 0 });

  /** Converte as tintas do pote em pigmentos (verde = ½ amarelo + ½ azul). */
  function toPigments(u) {
    const g = u.g || 0;
    return { r: u.r || 0, y: (u.y || 0) + g / 2, b: (u.b || 0) + g / 2, w: u.w || 0, k: u.k || 0 };
  }

  /**
   * Cor resultante das tintas no pote (ou null se vazio).
   * 1) mistura vermelho/amarelo/azul no cubo RYB;
   * 2) o branco clareia e 3) o preto escurece, conforme a fração de cada um.
   */
  function mixAmounts(units) {
    const p = toPigments(units);
    const total = p.r + p.y + p.b + p.w + p.k;
    if (total <= 0) return null;
    const max = Math.max(p.r, p.y, p.b);
    let color;
    if (max > 0) {
      color = rybToRgb(p.r / max, p.y / max, p.b / max);
      color = lerp(color, [1, 1, 1], (p.w / total) * WHITE_STRENGTH);
    } else if (p.w > 0) {
      color = WHITE_RGB.slice();
    } else {
      return BLACK_RGB.slice(); // só preto
    }
    return lerp(color, BLACK_RGB, Math.min(1, (p.k / total) * BLACK_STRENGTH));
  }

  // ---------- progressão: tintas disponíveis em cada fase ----------
  const STAGE_PAINTS = [
    ['r', 'y', 'b'],                     // fase 1: 3 cores
    ['r', 'y', 'b', 'w'],                // fase 2: + branco
    ['r', 'y', 'b', 'w', 'k'],           // fase 3: + preto
    ['r', 'y', 'b', 'w', 'k', 'g'],      // fase 4: + verde
  ];

  // Cada desafio tem uma "receita" (proporção ideal, em porções de tinta)
  // e a fase em que aparece. A cor-alvo é calculada com a mesma função de
  // mistura, então a meta é sempre alcançável com as tintas da fase.
  const TARGETS = [
    // Fase 1 — vermelho, amarelo, azul
    { stage: 0, id: 'purple', name: 'ROXO',         recipe: { r: 1, b: 1 } },
    { stage: 0, id: 'orange', name: 'LARANJA',      recipe: { r: 1, y: 1 } },
    { stage: 0, id: 'green', name: 'VERDE',        recipe: { y: 1, b: 1 } },
    { stage: 0, id: 'brown', name: 'MARROM',       recipe: { r: 1, y: 1, b: 1 } },
    { stage: 0, id: 'lime', name: 'VERDE-LIMÃO',  recipe: { y: 2, b: 1 } },
    { stage: 0, id: 'turquoise', name: 'TURQUESA',     recipe: { y: 1, b: 2 } },
    { stage: 0, id: 'magenta', name: 'MAGENTA',      recipe: { r: 2, b: 1 } },
    // Fase 2 — + branco
    { stage: 1, id: 'pink', name: 'ROSA',         recipe: { r: 1, w: 1 } },
    { stage: 1, id: 'lightBlue', name: 'AZUL-CLARO',   recipe: { b: 1, w: 1 } },
    { stage: 1, id: 'lilac', name: 'LILÁS',        recipe: { r: 1, b: 1, w: 1 } },
    { stage: 1, id: 'peach', name: 'PÊSSEGO',      recipe: { r: 1, y: 1, w: 1 } },
    { stage: 1, id: 'cream', name: 'CREME',        recipe: { y: 1, w: 2 } },
    { stage: 1, id: 'coral', name: 'CORAL',        recipe: { r: 2, y: 1, w: 1 } },
    // Fase 3 — + preto
    { stage: 2, id: 'gray', name: 'CINZA',        recipe: { w: 1, k: 1 } },
    { stage: 2, id: 'darkBlue', name: 'AZUL-ESCURO',  recipe: { b: 2, k: 1 } },
    { stage: 2, id: 'darkGreen', name: 'VERDE-ESCURO', recipe: { y: 1, b: 1, k: 1 } },
    { stage: 2, id: 'wine', name: 'VINHO',        recipe: { r: 3, b: 1, k: 1 } },
    { stage: 2, id: 'lightGray', name: 'CINZA-CLARO',  recipe: { w: 2, k: 1 } },
    { stage: 2, id: 'indigo', name: 'ANIL',         recipe: { r: 1, b: 2 } },
    // Fase 4 — + verde
    { stage: 3, id: 'aqua', name: 'VERDE-ÁGUA',   recipe: { g: 1, w: 1 } },
    { stage: 3, id: 'brick', name: 'TIJOLO',       recipe: { r: 2, y: 1, b: 1 } },
    { stage: 3, id: 'mustard', name: 'MOSTARDA',     recipe: { r: 1, y: 2, b: 1 } },
    { stage: 3, id: 'plum', name: 'AMEIXA',       recipe: { r: 2, y: 1, b: 2 } },
    { stage: 3, id: 'denim', name: 'AZUL-JEANS',   recipe: { r: 1, y: 1, b: 3 } },
    { stage: 3, id: 'beige', name: 'BEGE',         recipe: { r: 1, y: 2, b: 1, w: 2 } },
  ].map(t => {
    t.recipe = Object.assign(emptyUnits(), t.recipe);
    t.rgb = mixAmounts(t.recipe);
    return t;
  });

  /** Tintas que aparecem na paleta no desafio de índice "level". */
  const paintsForLevel = level => STAGE_PAINTS[TARGETS[Math.min(level, TARGETS.length - 1)].stage];

  // Quão perto (distância RGB) a mistura precisa chegar para vencer.
  const MATCH_TOLERANCE = 0.16;

  /**
   * Compara a mistura do pote com a meta.
   * Retorna { match, distance, hint } — a dica diz o que fazer:
   * { type: 'empty' | 'wrong' | 'more', key } (o texto vem do i18n.js).
   * As dicas comparam PIGMENTOS (o verde conta como amarelo + azul).
   */
  function evaluate(units, target) {
    const rgb = mixAmounts(units);
    if (!rgb) return { match: false, distance: Infinity, hint: { type: 'empty' } };
    const d = distance(rgb, target.rgb);
    if (d <= MATCH_TOLERANCE) return { match: true, distance: d, hint: null };

    const have = toPigments(units);
    const want = toPigments(target.recipe);

    // 1) Algum pigmento que NÃO faz parte da receita?
    const extra = PIGMENTS.find(k => want[k] === 0 && have[k] > 0);
    if (extra) {
      // Diz o nome da tinta que a criança realmente usou (pode ter sido o verde)
      const used = units[extra] > 0 ? extra : 'g';
      return { match: false, distance: d, hint: { type: 'wrong', key: used } };
    }
    // 2) Qual pigmento da receita está mais em falta?
    const total = PIGMENTS.reduce((s, k) => s + have[k], 0);
    const tTotal = PIGMENTS.reduce((s, k) => s + want[k], 0);
    let best = null, bestGap = 0;
    for (const k of PIGMENTS) {
      const gap = want[k] / tTotal - have[k] / total;
      if (gap > bestGap) { bestGap = gap; best = k; }
    }
    return { match: false, distance: d, hint: { type: 'more', key: best || 'r' } };
  }

  global.MixLogic = {
    BASE_PAINTS, KEYS, TARGETS, STAGE_PAINTS, MATCH_TOLERANCE,
    rybToRgb, mixAmounts, evaluate, emptyUnits, paintsForLevel, distance, lerp, shade, toCss,
  };
})(window);
