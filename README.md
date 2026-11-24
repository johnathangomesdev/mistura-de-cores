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

## Arquivos

| Arquivo | O que faz |
|---|---|
| `index.html` | Página, HUD (meta, contador, instrução, barra) e telas de pausa/fim |
| `css/style.css` | Visual da interface, adaptada para celular em pé |
| `js/colors.js` | Mistura de cores no modelo RYB, desafios e comparação com a meta |
| `js/scene.js` | Cenário 3D só com geometrias Three.js: mesa, paleta, tintas, pote, pincel, mascote, efeitos |
| `js/game.js` | Toque/mouse, regras (pegar, despejar, girar), detecção de giro, vitória, HUD e laço principal |
| `js/vendor/three.min.js` | Three.js r128 |

Ajustes fáceis: `TURNS_TO_MIX` (voltas para misturar) em `game.js`, `MATCH_TOLERANCE` e a lista
`TARGETS` (novas cores com suas receitas) em `colors.js`.
