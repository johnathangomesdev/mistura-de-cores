# Mistura de Cores — demo jogável (Three.js)

Jogo infantil: pegue tinta com o pincel, leve ao pote e gire para misturar até chegar na cor-alvo.
**Progressão de tintas na paleta** (25 desafios):

| Fase | Tintas | Desafios |
|---|---|---|
| 1 | vermelho, amarelo, azul | Roxo, Laranja, Verde, Marrom, Lima, Turquesa, Magenta |
| 2 | + branco | Rosa, Celeste, Lilás, Pêssego, Creme, Coral |
| 3 | + preto | Cinza, Marinho, Musgo, Vinho, Prata, Anil |
| 4 | + verde | Menta, Tijolo, Mostarda, Ameixa, Ardósia, Bege |

Branco clareia, preto escurece e o verde vale meio amarelo + meio azul. As receitas e fases estão em
`TARGETS` e `STAGE_PAINTS`, em `js/colors.js`.

## Como executar

**Mais simples:** dê dois cliques em `index.html`. O jogo usa scripts comuns (sem módulos ES) e
uma cópia local do Three.js (`js/vendor/three.min.js`), então funciona direto do arquivo, até offline.
Sem internet, só a fonte arredondada muda para a fonte padrão.

**Para testar no celular** (mesma rede Wi-Fi), sirva a pasta com um servidor local:

```
cd MisturaDeCores
python -m http.server 8000
```

Depois abra `http://IP-DO-COMPUTADOR:8000` no celular (descubra o IP com `ipconfig`).
Alternativa com Node: `npx serve .`

## Como jogar

- Arraste o dedo (ou o mouse com o botão pressionado): o pincel segue o toque.
- Encoste a ponta numa poça: o pincel fica com aquela cor.
- Leve até o pote: a tinta cai no pote e o pincel fica limpo.
- Gire o pincel dentro do pote: a barra "Progresso da mistura" enche.
- Com a mistura completa, o jogo compara com a meta: acertou → confete e próximo desafio;
  errou → uma dica (ex.: "Coloque mais azul"). Use ↺ para esvaziar o pote e ⏸ para pausar.

## Botões do HUD

| Botão | O que faz |
|---|---|
| ⚙️ Configurações | Pausa e abre: idioma, volume da música e da voz (botão de mudo + controle deslizante; 0 = desligado), mistura automática e "Como jogar" |
| ↺ Limpar | Esvazia o pote |
| ⏩ Pular Cor | (embaixo, à direita) Pula o desafio atual. Gasta 1 pulo |
| 💡 Dica | (embaixo, à esquerda) Mostra e fala a receita da cor (ex.: "misture 2× amarelo + azul") e faz as tintas certas pularem. Gasta 1 dica por cor (repetir na mesma cor é grátis) |

Dicas e pulos têm um contador no canto do botão. Começam com `START_HINTS` / `START_SKIPS` (3) em `game.js`,
ficam salvos no aparelho e, ao zerar, o botão fica cinza. Para dar mais (ex.: depois de um anúncio ou compra):
`MixGame.addHints(n)` / `MixGame.addSkips(n)`.
| 🖼️ Temas (esquerda) | **Cenário**: Clássico, Oceano, Floresta, Doce e Noite (cores do HUD, fundo e mesa). **Pincel**: Clássico, Morango, Oceano, Madeira, Dourado e Neon. O Clássico é grátis; os outros custam diamantes |
| 🏪 Loja (direita) | Diamantes, pacotes de dicas/pulos e "Assistir" anúncio para ganhar +1 dica ou +1 pulo |
| 🚫 Retirar Ads (direita) | Por enquanto só mostra "Em breve". Quando a compra existir, chame `MixGame.setNoAds(true)` e o botão some |

### Diamantes e loja

- Saldo inicial `START_GEMS` (20). Preços em `PRICES` (tema 40, pincel 25) e `STORE_ITEMS` (3 dicas 15, 3 pulos 20,
  10 dicas 40, 10 pulos 55), em `game.js`. Tudo salvo no aparelho (`mistura.settings`). Sem saldo, a compra abre a loja.
- Acabaram as dicas/pulos → tocar no botão abre a loja.
- **Pacotes de diamantes com dinheiro (`GEM_PACKS`) ainda não estão integrados** (Google Play Billing / App Store /
  Stripe). Ao confirmar um pagamento, chame `MixGame.grantGems(n)`.
- **Anúncio com recompensa é uma SIMULAÇÃO** (tela de 5 s). Para usar um de verdade (AdMob, AdSense H5 rewarded...),
  defina antes do `game.js`: `window.MixAds = { showRewarded: () => Promise<boolean> }` (true = assistiu até o fim).
- Atenção: como fica tudo no `localStorage`, dá para editar o saldo pelo navegador. Para dinheiro de verdade, o saldo
  precisa ficar num servidor.

As figuras dos botões ficam em `img/ui/` (recortadas da folha de ícones). O nome de cada botão é desenhado
por código, traduzido, numa plaquinha creme que só aparece em telas grandes. `play.png` é usado em
Continuar/Jogar de novo; `ranking.png` e `palette.png` estão guardados (ainda sem botão).

**Som e voz:** os navegadores não deixam nenhum som tocar antes do primeiro toque do usuário (e, no celular,
encostar o dedo ainda não conta, só soltar). Por isso a tela de carregamento termina com o botão
**"Toque para jogar"**: esse toque liga a música e a voz, que fala a primeira cor. O destravamento também é
tentado em `pointerup`/`touchend`/`click`/tecla (`unlockAudio` em `game.js`).

As escolhas ficam salvas no aparelho (`localStorage`: `mistura.settings`, `mistura.lang`).
A música é um loop gerado por código (WebAudio), sem arquivos.

## Ícone do app

A logo (gotinhas + pote + paleta) está em `img/icons/`: `favicon.ico` e `favicon-48.png` (aba do navegador),
`apple-touch-icon.png` (iPhone, fundo creme), `icon-192/512.png` e `icon-maskable-512.png` (Android/PWA,
via `manifest.webmanifest`). No celular, "Adicionar à tela inicial" instala o jogo com esse ícone, em tela cheia.

## Idiomas

Português, English, Español, Deutsch, Français, 中文 (chinês simplificado) e 日本語 (japonês, em kana para
crianças), em `js/i18n.js`. O idioma inicial segue o do aparelho.

- Para adicionar um idioma: acrescente em `LANGS` e `ORDER`, copie o bloco `en` de `STRINGS` e traduza, e
  acrescente uma coluna em `COLORS` e `PAINTS` (as cores-alvo são identificadas pelo `id` em `TARGETS`).
  Texto que faltar cai no inglês.
- Chinês e japonês carregam uma fonte arredondada do Google Fonts só quando escolhidos (`LANGS.x.font`:
  ZCOOL KuaiLe / M PLUS Rounded 1c); a regra de fonte por idioma está no fim do `style.css`.
- Listas ("vermelho, amarelo e azul") usam `Intl.ListFormat`, no formato de cada idioma.
- A voz que fala a cor usa a voz do aparelho no idioma escolhido. No HTML, textos fixos usam `data-i18n="chave"`.
- As traduções de de/fr/zh/ja foram feitas sem revisão de nativo: vale revisar antes de publicar.

## Arquivos

| Arquivo | O que faz |
|---|---|
| `index.html` | Página, HUD (meta, contador, instrução, barra) e telas de pausa/fim |
| `css/style.css` | Visual da interface, adaptada para celular em pé |
| `js/i18n.js` | Textos em vários idiomas e nomes das cores |
| `js/colors.js` | Mistura de cores no modelo RYB, desafios e comparação com a meta |
| `js/scene.js` | Cenário 3D só com geometrias Three.js: mesa, paleta, tintas, pote, pincel, mascote, efeitos |
| `js/game.js` | Toque/mouse, regras (pegar, despejar, girar), detecção de giro, vitória, HUD e laço principal |
| `js/vendor/three.min.js` | Three.js r128 |

Ajustes fáceis: `TURNS_TO_MIX` (voltas para misturar) em `game.js`, `MATCH_TOLERANCE` e a lista
`TARGETS` (novas cores com suas receitas) em `colors.js`.
