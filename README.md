# Mistura de Cores — demo jogável (Three.js)

Jogo infantil: pegue tinta com o pincel, leve ao pote e gire para misturar até chegar na cor-alvo.
**Progressão de tintas na paleta** (25 desafios):

| Fase | Tintas | Desafios |
|---|---|---|
| 1 | vermelho, amarelo, azul | Roxo, Laranja, Verde, Marrom, Verde-limão, Turquesa, Magenta |
| 2 | + branco | Rosa, Azul-claro, Lilás, Pêssego, Creme, Coral |
| 3 | + preto | Cinza, Azul-escuro, Verde-escuro, Vinho, Cinza-claro, Anil |
| 4 | + verde | Verde-água, Tijolo, Mostarda, Ameixa, Azul-jeans, Bege |

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
| ⚙️ Configurações | Pausa e abre: idioma, música, voz, mistura automática e "Como jogar" |
| ↺ Limpar | Esvazia o pote |
| ⏩ Pular Cor | Pula o desafio atual |
| 💡 Dica | Mostra e fala a receita da cor (ex.: "misture 2× amarelo + azul") e faz as tintas certas pularem |
| 🖼️ Temas | Clássico, Oceano, Floresta, Doce e Noite (cores do HUD, fundo e mesa) |
| 🚫 Retirar Ads | Por enquanto só mostra "Em breve" (o jogo ainda não tem anúncios nem loja). Quando a compra existir, chame `MixGame.setNoAds(true)` e o botão some |

As figuras dos botões ficam em `img/ui/` (recortadas da folha de botões, sem a plaquinha de texto). O nome
de cada botão é desenhado por código, traduzido, numa plaquinha creme que só aparece em telas grandes.
`play.png` é usado em Continuar/Jogar de novo; `ranking.png` está guardado para quando houver ranking.

As escolhas ficam salvas no aparelho (`localStorage`: `mistura.settings`, `mistura.lang`).
A música é um loop gerado por código (WebAudio), sem arquivos.

## Idiomas

Português, English e Español, em `js/i18n.js`. O idioma inicial segue o do aparelho.
Para adicionar um idioma: copie o bloco `en` de `STRINGS`, traduza e acrescente a tradução de cada cor
em `COLORS` e `PAINTS` (as cores-alvo são identificadas pelo `id` em `TARGETS`). A voz que fala a cor usa
a voz do navegador no idioma escolhido. No HTML, textos fixos usam `data-i18n="chave"`.

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
