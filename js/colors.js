/* =====================================================================
   colors.js — A "química" das tintas (não depende do Three.js)

   Crianças aprendem as cores primárias como VERMELHO, AMARELO e AZUL
   (modelo RYB). Misturar em RGB daria resultados estranhos
   (vermelho + amarelo + azul viraria cinza-claro, amarelo + azul viraria
   cinza). Por isso usamos um "cubo RYB": definimos a cor que aparece
   em cada canto do cubo (ex.: vermelho + azul = roxo) e interpolamos
   entre os cantos. As quantidades de tinta são normalizadas pela maior
   delas, então só a PROPORÇÃO importa (2 vermelhos + 2 azuis = 1 + 1).
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

  /** Cor resultante de uma quantidade de tintas {r, y, b} (ou null se vazio). */
  function mixAmounts(units) {
    const max = Math.max(units.r, units.y, units.b);
    if (max <= 0) return null;
    return rybToRgb(units.r / max, units.y / max, units.b / max);
  }

  // ---------- utilidades de cor ----------
  const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const shade = (c, k) => [c[0] * k, c[1] * k, c[2] * k];
  const to255 = v => Math.max(0, Math.min(255, Math.round(v * 255)));
  const toCss = (c, alpha) => alpha === undefined
    ? `rgb(${to255(c[0])},${to255(c[1])},${to255(c[2])})`
    : `rgba(${to255(c[0])},${to255(c[1])},${to255(c[2])},${alpha})`;

  // ---------- tintas base e desafios ----------
  const BASE_PAINTS = {
    r: { key: 'r', name: 'vermelho', rgb: CORNER.r },
    y: { key: 'y', name: 'amarelo', rgb: CORNER.y },
    b: { key: 'b', name: 'azul', rgb: CORNER.b },
  };
  const KEYS = ['r', 'y', 'b'];

  // Cada desafio tem uma "receita" (proporção ideal). A cor-alvo é calculada
  // com a mesma função de mistura, então a meta é sempre alcançável.
  const TARGETS = [
    { name: 'ROXO',    recipe: { r: 1, y: 0, b: 1 } },
    { name: 'LARANJA', recipe: { r: 1, y: 1, b: 0 } },
    { name: 'VERDE',   recipe: { r: 0, y: 1, b: 1 } },
    { name: 'MARROM',  recipe: { r: 1, y: 1, b: 1 } },
  ].map(t => Object.assign(t, { rgb: mixAmounts(t.recipe) }));

  // Quão perto (distância RGB) a mistura precisa chegar para vencer.
  const MATCH_TOLERANCE = 0.16;

  /**
   * Compara a mistura do pote com a meta.
   * Retorna { match, distance, hint } — a dica é gentil e diz o que fazer.
   */
  function evaluate(units, target) {
    const rgb = mixAmounts(units);
    if (!rgb) return { match: false, distance: Infinity, hint: { type: 'empty', text: 'O pote está vazio. Pegue uma cor!' } };
    const d = distance(rgb, target.rgb);
    if (d <= MATCH_TOLERANCE) return { match: true, distance: d, hint: null };

    const targetName = target.name.toLowerCase();
    // 1) Alguma cor que NÃO faz parte da receita?
    const extra = KEYS.find(k => target.recipe[k] === 0 && units[k] > 0);
    if (extra) {
      return {
        match: false, distance: d,
        hint: { type: 'wrong', key: extra, text: `Ops! O ${BASE_PAINTS[extra].name} não faz parte do ${targetName}. Toque em ↺ para limpar o pote.` },
      };
    }
    // 2) Qual cor da receita está mais em falta?
    const total = units.r + units.y + units.b;
    const tTotal = target.recipe.r + target.recipe.y + target.recipe.b;
    let best = null, bestGap = 0;
    for (const k of KEYS) {
      const gap = target.recipe[k] / tTotal - units[k] / total;
      if (gap > bestGap) { bestGap = gap; best = k; }
    }
    const name = best ? BASE_PAINTS[best].name : 'tinta';
    return {
      match: false, distance: d,
      hint: { type: 'more', key: best, text: `Quase! Coloque mais ${name} e misture de novo.` },
    };
  }

  global.MixLogic = {
    BASE_PAINTS, KEYS, TARGETS, MATCH_TOLERANCE,
    rybToRgb, mixAmounts, evaluate, distance, lerp, shade, toCss,
  };
})(window);
