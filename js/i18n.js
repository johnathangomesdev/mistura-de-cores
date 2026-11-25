/* =====================================================================
   i18n.js — Textos do jogo em vários idiomas

   PARA ADICIONAR UM IDIOMA: copie o bloco "en" de STRINGS, traduza,
   e acrescente a tradução de cada cor em COLORS e PAINTS.
   Textos com {nome} recebem valores (ex.: {color}, {paint}, {list}).
   No HTML, use data-i18n="chave" (texto), data-i18n-html="chave"
   (aceita <br>) e data-i18n-aria="chave" (aria-label).
   ===================================================================== */
(function (global) {
  'use strict';

  const LANGS = {
    pt: { label: 'Português', voice: 'pt-BR' },
    en: { label: 'English',   voice: 'en-US' },
    es: { label: 'Español',   voice: 'es-ES' },
  };

  const STRINGS = {
    pt: {
      title: 'Mistura de Cores', loading: 'Carregando…',
      challenge: 'DESAFIO', mixProgress: 'PROGRESSO DA MISTURA',
      aPause: 'Pausar e configurações', aRestart: 'Recomeçar a rodada', aSkip: 'Pular desafio',
      aHelp: 'Ajuda', aTheme: 'Trocar tema', aNoAds: 'Remover anúncios', aHint: 'Dica',
      lblSettings: 'Configurações', lblRestart: 'Limpar', lblSkip: 'Pular Cor', lblHint: 'Dica',
      lblTheme: 'Temas', lblNoAds: 'Retirar Ads',
      hintRecipe: 'Dica: misture {recipe}', sayHint: 'Misture {recipe}!',
      help7: 'Toque na lâmpada para ganhar uma dica.',
      paused: 'Pausado', resume: 'Continuar', settings: 'Configurações', language: 'Idioma',
      music: 'Música', voice: 'Voz', autoMix: 'Mistura automática', on: 'LIGADA', off: 'DESLIGADA',
      autoMixHelp: 'Desligada: mexa o pincel de qualquer jeito dentro do pote.<br>Ligada: basta encostar o pincel no pote.',
      congrats: 'Parabéns!', allColors: 'Você fez todas as cores!', playAgain: 'Jogar de novo',
      helpTitle: 'Como jogar',
      help1: 'Toque numa tinta para molhar o pincel.',
      help2: 'Leve o pincel até o pote.',
      help3: 'Pegue outra cor e coloque no pote.',
      help4: 'Mexa o pincel no pote até a barra encher.',
      help5: 'Errou? Toque em ↺ para limpar o pote.',
      help6: 'Toque nas setas amarelas para pular uma cor.',
      gotIt: 'Entendi!', close: 'Fechar',
      themeTitle: 'Escolha o tema',
      themes: { classic: 'Clássico', ocean: 'Oceano', forest: 'Floresta', candy: 'Doce', night: 'Noite' },
      adsTitle: 'Sem anúncios', adsText: 'Remova os anúncios e jogue sem interrupções.', adsSoon: 'Em breve',
      skipped: 'Desafio pulado!',
      instCelebrate: 'Uau! Cor perfeita!', instCarry: 'Leve o {paint} até o pote!',
      instMixing: 'Misturando a tinta...', instTapPot: 'Toque no pote para misturar!',
      instStir: 'Mexa o pincel no pote para misturar!', instAnother: 'Agora pegue outra cor!',
      instStart: 'Pegue uma cor, leve ao pote e gire para misturar',
      instClean: 'Toque em ↺ para limpar o pote', instMore: 'Adicione mais tinta e misture de novo!',
      lockWarn: 'Misturando! Tire o dedo da tela para pegar outra cor.',
      youMade: 'Você fez {color}!',
      newPaint: 'Nova cor na paleta: {list}! Desafio: {color}', newPaints: 'Novas cores na paleta: {list}! Desafio: {color}',
      sayNewPaint: 'Nova cor! {list}!', sayNewPaints: 'Novas cores! {list}!', and: 'e',
      newChallenge: 'Novo desafio: {color}!', cleanPot: 'Pote limpinho! Vamos de novo.',
      hintEmpty: 'O pote está vazio. Pegue uma cor!',
      hintWrong: 'Ops! O {paint} não faz parte do {color}. Toque em ↺ para limpar o pote.',
      hintMore: 'Quase! Coloque mais {paint} e misture de novo.',
      cheers: ['Muito bem!', 'Que lindo!', 'Consegui!', 'Que legal!'],
      banners: ['Muito bem!', 'Incrível!', 'Perfeito!', 'Uau!'],
      sayEnd: 'Parabéns! Você fez todas as cores!',
    },
    en: {
      title: 'Color Mixing', loading: 'Loading…',
      challenge: 'CHALLENGE', mixProgress: 'MIXING PROGRESS',
      aPause: 'Pause and settings', aRestart: 'Restart round', aSkip: 'Skip challenge',
      aHelp: 'Help', aTheme: 'Change theme', aNoAds: 'Remove ads', aHint: 'Hint',
      lblSettings: 'Settings', lblRestart: 'Clear', lblSkip: 'Skip Color', lblHint: 'Hint',
      lblTheme: 'Themes', lblNoAds: 'Remove Ads',
      hintRecipe: 'Hint: mix {recipe}', sayHint: 'Mix {recipe}!',
      help7: 'Tap the light bulb to get a hint.',
      paused: 'Paused', resume: 'Resume', settings: 'Settings', language: 'Language',
      music: 'Music', voice: 'Voice', autoMix: 'Auto mix', on: 'ON', off: 'OFF',
      autoMixHelp: 'Off: move the brush any way you like inside the pot.<br>On: just touch the pot with the brush.',
      congrats: 'Congratulations!', allColors: 'You made all the colors!', playAgain: 'Play again',
      helpTitle: 'How to play',
      help1: 'Touch a paint to dip the brush.',
      help2: 'Bring the brush to the pot.',
      help3: 'Pick another color and drop it in the pot.',
      help4: 'Stir the brush in the pot until the bar is full.',
      help5: 'Made a mistake? Tap ↺ to clean the pot.',
      help6: 'Tap the yellow arrows to skip a color.',
      gotIt: 'Got it!', close: 'Close',
      themeTitle: 'Pick a theme',
      themes: { classic: 'Classic', ocean: 'Ocean', forest: 'Forest', candy: 'Candy', night: 'Night' },
      adsTitle: 'No ads', adsText: 'Remove the ads and play without interruptions.', adsSoon: 'Coming soon',
      skipped: 'Challenge skipped!',
      instCelebrate: 'Wow! Perfect color!', instCarry: 'Bring the {paint} to the pot!',
      instMixing: 'Mixing the paint...', instTapPot: 'Tap the pot to mix!',
      instStir: 'Stir the brush in the pot to mix!', instAnother: 'Now pick another color!',
      instStart: 'Pick a color, bring it to the pot and stir to mix',
      instClean: 'Tap ↺ to clean the pot', instMore: 'Add more paint and mix again!',
      lockWarn: 'Mixing! Lift your finger to pick another color.',
      youMade: 'You made {color}!',
      newPaint: 'New color on the palette: {list}! Challenge: {color}', newPaints: 'New colors on the palette: {list}! Challenge: {color}',
      sayNewPaint: 'New color! {list}!', sayNewPaints: 'New colors! {list}!', and: 'and',
      newChallenge: 'New challenge: {color}!', cleanPot: 'Squeaky clean pot! Let\'s try again.',
      hintEmpty: 'The pot is empty. Pick a color!',
      hintWrong: 'Oops! There is no {paint} in {color}. Tap ↺ to clean the pot.',
      hintMore: 'Almost! Add more {paint} and mix again.',
      cheers: ['Well done!', 'So pretty!', 'I did it!', 'How cool!'],
      banners: ['Well done!', 'Amazing!', 'Perfect!', 'Wow!'],
      sayEnd: 'Congratulations! You made all the colors!',
    },
    es: {
      title: 'Mezcla de Colores', loading: 'Cargando…',
      challenge: 'RETO', mixProgress: 'PROGRESO DE LA MEZCLA',
      aPause: 'Pausa y ajustes', aRestart: 'Reiniciar la ronda', aSkip: 'Saltar reto',
      aHelp: 'Ayuda', aTheme: 'Cambiar tema', aNoAds: 'Quitar anuncios', aHint: 'Pista',
      lblSettings: 'Ajustes', lblRestart: 'Limpiar', lblSkip: 'Saltar Color', lblHint: 'Pista',
      lblTheme: 'Temas', lblNoAds: 'Quitar Ads',
      hintRecipe: 'Pista: mezcla {recipe}', sayHint: '¡Mezcla {recipe}!',
      help7: 'Toca la bombilla para recibir una pista.',
      paused: 'En pausa', resume: 'Continuar', settings: 'Ajustes', language: 'Idioma',
      music: 'Música', voice: 'Voz', autoMix: 'Mezcla automática', on: 'ACTIVADA', off: 'DESACTIVADA',
      autoMixHelp: 'Desactivada: mueve el pincel como quieras dentro del bote.<br>Activada: basta con tocar el bote con el pincel.',
      congrats: '¡Felicidades!', allColors: '¡Hiciste todos los colores!', playAgain: 'Jugar de nuevo',
      helpTitle: 'Cómo jugar',
      help1: 'Toca una pintura para mojar el pincel.',
      help2: 'Lleva el pincel al bote.',
      help3: 'Toma otro color y ponlo en el bote.',
      help4: 'Mueve el pincel en el bote hasta llenar la barra.',
      help5: '¿Te equivocaste? Toca ↺ para limpiar el bote.',
      help6: 'Toca las flechas amarillas para saltar un color.',
      gotIt: '¡Entendido!', close: 'Cerrar',
      themeTitle: 'Elige el tema',
      themes: { classic: 'Clásico', ocean: 'Océano', forest: 'Bosque', candy: 'Dulce', night: 'Noche' },
      adsTitle: 'Sin anuncios', adsText: 'Quita los anuncios y juega sin interrupciones.', adsSoon: 'Próximamente',
      skipped: '¡Reto saltado!',
      instCelebrate: '¡Guau! ¡Color perfecto!', instCarry: '¡Lleva el {paint} al bote!',
      instMixing: 'Mezclando la pintura...', instTapPot: '¡Toca el bote para mezclar!',
      instStir: '¡Mueve el pincel en el bote para mezclar!', instAnother: '¡Ahora toma otro color!',
      instStart: 'Toma un color, llévalo al bote y gira para mezclar',
      instClean: 'Toca ↺ para limpiar el bote', instMore: '¡Añade más pintura y mezcla de nuevo!',
      lockWarn: '¡Mezclando! Levanta el dedo para tomar otro color.',
      youMade: '¡Hiciste {color}!',
      newPaint: '¡Nuevo color en la paleta: {list}! Reto: {color}', newPaints: '¡Nuevos colores en la paleta: {list}! Reto: {color}',
      sayNewPaint: '¡Nuevo color! ¡{list}!', sayNewPaints: '¡Nuevos colores! ¡{list}!', and: 'y',
      newChallenge: '¡Nuevo reto: {color}!', cleanPot: '¡Bote limpio! Vamos otra vez.',
      hintEmpty: 'El bote está vacío. ¡Toma un color!',
      hintWrong: '¡Uy! El {paint} no forma parte del {color}. Toca ↺ para limpiar el bote.',
      hintMore: '¡Casi! Pon más {paint} y mezcla de nuevo.',
      cheers: ['¡Muy bien!', '¡Qué bonito!', '¡Lo logré!', '¡Qué genial!'],
      banners: ['¡Muy bien!', '¡Increíble!', '¡Perfecto!', '¡Guau!'],
      sayEnd: '¡Felicidades! ¡Hiciste todos los colores!',
    },
  };

  // Nomes das cores-alvo (id do desafio em colors.js -> [pt, en, es])
  const COLORS = {
    purple: ['ROXO', 'PURPLE', 'MORADO'],          orange: ['LARANJA', 'ORANGE', 'NARANJA'],
    green: ['VERDE', 'GREEN', 'VERDE'],            brown: ['MARROM', 'BROWN', 'MARRÓN'],
    lime: ['VERDE-LIMÃO', 'LIME', 'VERDE LIMA'],   turquoise: ['TURQUESA', 'TURQUOISE', 'TURQUESA'],
    magenta: ['MAGENTA', 'MAGENTA', 'MAGENTA'],    pink: ['ROSA', 'PINK', 'ROSA'],
    lightBlue: ['AZUL-CLARO', 'LIGHT BLUE', 'AZUL CLARO'], lilac: ['LILÁS', 'LILAC', 'LILA'],
    peach: ['PÊSSEGO', 'PEACH', 'MELOCOTÓN'],      cream: ['CREME', 'CREAM', 'CREMA'],
    coral: ['CORAL', 'CORAL', 'CORAL'],            gray: ['CINZA', 'GRAY', 'GRIS'],
    darkBlue: ['AZUL-ESCURO', 'DARK BLUE', 'AZUL OSCURO'], darkGreen: ['VERDE-ESCURO', 'DARK GREEN', 'VERDE OSCURO'],
    wine: ['VINHO', 'BURGUNDY', 'BURDEOS'],        lightGray: ['CINZA-CLARO', 'LIGHT GRAY', 'GRIS CLARO'],
    indigo: ['ANIL', 'INDIGO', 'AÑIL'],            aqua: ['VERDE-ÁGUA', 'AQUA', 'VERDE AGUA'],
    brick: ['TIJOLO', 'BRICK', 'LADRILLO'],        mustard: ['MOSTARDA', 'MUSTARD', 'MOSTAZA'],
    plum: ['AMEIXA', 'PLUM', 'CIRUELA'],           denim: ['AZUL-JEANS', 'DENIM', 'AZUL VAQUERO'],
    beige: ['BEGE', 'BEIGE', 'BEIGE'],
  };
  // Tintas da paleta (minúsculas, usadas no meio das frases)
  const PAINTS = {
    r: ['vermelho', 'red', 'rojo'], y: ['amarelo', 'yellow', 'amarillo'], b: ['azul', 'blue', 'azul'],
    w: ['branco', 'white', 'blanco'], k: ['preto', 'black', 'negro'], g: ['verde', 'green', 'verde'],
  };
  const IDX = { pt: 0, en: 1, es: 2 };

  function detect() {
    try {
      const saved = localStorage.getItem('mistura.lang');
      if (saved && STRINGS[saved]) return saved;
    } catch (_) { /* ok */ }
    const nav = (navigator.language || 'pt').slice(0, 2).toLowerCase();
    return STRINGS[nav] ? nav : 'pt';
  }

  const I18N = {
    LANGS,
    lang: detect(),
    listeners: [],
    /** Texto traduzido; {nome} é trocado pelos valores de "params". */
    t(key, params) {
      const s = STRINGS[this.lang][key] !== undefined ? STRINGS[this.lang][key] : STRINGS.pt[key];
      if (typeof s !== 'string' || !params) return s;
      return s.replace(/\{(\w+)\}/g, (_, k) => (params[k] !== undefined ? params[k] : ''));
    },
    color(id) { const c = COLORS[id]; return c ? (c[IDX[this.lang]] || c[0]) : id; },
    paint(key) { const p = PAINTS[key]; return p ? (p[IDX[this.lang]] || p[0]) : key; },
    lower(s) { return s.toLocaleLowerCase(LANGS[this.lang].voice); },
    /** "a, b e c" no idioma atual. */
    list(items) {
      return items.length > 1 ? `${items.slice(0, -1).join(', ')} ${this.t('and')} ${items[items.length - 1]}` : items[0];
    },
    voiceLang() { return LANGS[this.lang].voice; },
    set(lang) {
      if (!STRINGS[lang] || lang === this.lang) return;
      this.lang = lang;
      try { localStorage.setItem('mistura.lang', lang); } catch (_) { /* ok */ }
      this.apply();
      this.listeners.forEach(fn => fn(lang));
    },
    onChange(fn) { this.listeners.push(fn); },
    /** Traduz os elementos estáticos do HTML. */
    apply(root = document) {
      document.documentElement.lang = this.voiceLang();
      document.title = this.t('title');
      root.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = this.t(el.dataset.i18n); });
      root.querySelectorAll('[data-i18n-html]').forEach(el => { el.innerHTML = this.t(el.dataset.i18nHtml); });
      root.querySelectorAll('[data-i18n-aria]').forEach(el => {
        el.setAttribute('aria-label', this.t(el.dataset.i18nAria));
        el.title = this.t(el.dataset.i18nAria);
      });
    },
  };

  global.I18N = I18N;
})(window);
