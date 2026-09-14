# ThumbDrop V3 — editor de thumbnails

Editor guiado de thumbnails 16:9 para Canaltech e CT Eletro. Quatro paradas:
imagem → filtro de IA → texto → moldura e export. Saída em PNG 1920×1080.

HTML, CSS e JavaScript vanilla. **Sem build, sem framework, sem npm, sem servidor.**

Duas formas de abrir, as duas com duplo clique e nenhuma precisando de nada:

- **`thumbdrop.html`** — tudo num arquivo só. É a entrega.
- **`index.html`** — os oito arquivos separados. É onde se mexe no código.

`./build.sh` gera o primeiro a partir do segundo. É `sh` puro, sem npm e sem
bundler: não é uma etapa de build do projeto, é só a maneira de empacotar.
Os dois passam pelo mesmo teste de aceite.

A pasta `assets/` precisa ficar ao lado do HTML que você abrir.

---

## Estado da implementação

| Etapa | O que passa a funcionar | Status |
|---|---|---|
| 0 | Estrutura do repositório e manifesto de assets | ✅ feito |
| 1 | `tokens.css` a partir das 5 coleções de variáveis do Figma | ✅ feito |
| 2 | Tela de configuração das chaves e `config.js` | ✅ feito |
| 3 | Shell do editor: barra superior, palco, painel/dock, trilha | ✅ feito |
| 4 | Canvas da parada 1: arraste, zoom ancorado no ponteiro, alças | ✅ feito |
| 5 | Integração PhotoRoom (remoção de fundo) | ✅ feito |
| 6 | Parada 2: modal de confirmação, Gemini, três estados de IA | ✅ feito |
| 7 | Canvas de texto da parada 3 | ✅ feito |
| 8 | Parada 4: molduras e export 1920×1080 | ✅ feito |
| 9 | Recibo, contagem de créditos, saldo insuficiente | ✅ feito |
| 10 | Passada de acessibilidade | ✅ feito |

### Critério de aceite

Os doze itens da seção 14 do briefing, verificados em Chromium sobre `file://`,
nos dois empacotamentos:

```
 ✓  1  Abre pedindo as duas chaves e explica onde ficam salvas
 ✓  2  Arrasto e dou zoom com scroll sem estranhar
 ✓  3  Removo o fundo e é cobrado uma vez só, mesmo reenquadrando
 ✓  4  Clico num filtro e ele pergunta antes de gastar
 ✓  5  Vejo a prévia em comparação com divisória arrastável
 ✓  6  Aprovo e recebo a imagem em 2K
 ✓  7  Duplo clique, escrevo, clico fora, arrasto e apago com Delete
 ✓  8  Destaco uma palavra em amarelo
 ✓  9  Escolho moldura, vejo o recibo e baixo um PNG 1920×1080 limpo
 ✓ 10  Navego pelo teclado enxergando onde estou
 ✓ 11  Abro em 390px e continua utilizável
 ✓ 12  Nenhuma chave aparece no código-fonte
```

O recibo do percurso completo fecha em **4 ✦ · R$ 0,91**, que é o número que o
briefing prometia.

---

## Decisões tomadas

Duas perguntas em aberto foram delegadas para mim. Ficam registradas aqui com o
raciocínio, para poderem ser revertidas com conhecimento de causa.

### O guia do timer "16:20" — resolvido pelo Figma, não por chute

`16:20` nunca foi uma proporção. O Figma tem um nó chamado `timer-guide` e o
filho dele é um texto literal `16:20` — é a **duração falsa** que o mock mostra
dentro da tarja. A geometria está desenhada:

```
timer-guide   x=868  y=494   128×56     dentro de um canvas de 1024×576
```

Convertido para porcentagem, que é o que faz o guia escalar sozinho até os
1920×1080 do export:

| | % do canvas | em 1920×1080 |
|---|---|---|
| largura | 12,5 % | 240 px |
| altura | 9,7222 % | 105 px |
| margem direita | 2,7344 % | 52,5 px |
| margem inferior | 4,5139 % | 48,75 px |

Está em `tokens.css` como `--timer-guide-*`. O guia aparece na parada 3, ligado
por padrão, e **some no export**.

### A prévia do filtro: "0.5K" não existe na API

O `imageConfig.imageSize` do Gemini aceita `1K`, `2K` e `4K`. Não há `0.5K`.
A V2 era travada em 2K e não tinha caminho de prévia nenhum.

**Decisão: a prévia manda a imagem de entrada reduzida e pede `1K` na saída.
A tabela de créditos não muda — prévia continua 1 ✦, entrega continua 2 ✦.**

Por quê:

- **A prévia existe para julgar direção de arte, não nitidez.** A pessoa está
  decidindo se o Dramático ficou melhor que o Cinema. Isso se decide no
  enquadramento, na luz e na cor — tudo legível em 1K, ainda mais num preview
  de ~700 px de largura em modo comparação. Entregar 2K na prévia seria pagar
  o dobro por uma informação que não muda a decisão.
- **A tabela de preços foi testada com usuário.** "Uma thumb fecha em 4 ✦,
  cerca de R$ 0,91" é a frase que a pessoa já viu e entendeu. Mexer nela para
  refletir um detalhe de API é trocar clareza por precisão contábil, no lugar
  errado. O que muda é a margem por prévia, e isso é problema de planilha, não
  de interface.
- **Erra para o lado seguro.** Se 1K se mostrar insuficiente para julgar algum
  filtro, subir a prévia para 2K é trocar uma string — e o preço que a pessoa
  vê continua de pé.

Efeito prático: a prévia sai mais rápida e mais barata que na V2, e a interface
não promete resolução nenhuma — ela diz "prévia", que é o que a pessoa precisa
saber.

### O saldo é um teto que a pessoa dá a si mesma

O briefing pede um estado de "saldo insuficiente" com o caminho de recarga
visível. Mas recarregar *o quê*, se as chaves de API são da própria pessoa?
Não há loja: ninguém compra crédito de ninguém aqui.

**Decisão: o ✦ é um teto de gasto, não uma moeda.** Um crédito é o custo real
de uma chamada de API arredondado para um número que cabe num botão — cerca de
R$ 0,23. O saldo existe para a conta da API não surpreender no fim do mês, e
quem o ajusta é a própria pessoa, pelo pill de créditos na barra superior.

Isso mantém a regra do briefing de pé — saldo insuficiente desabilita a ação
com o motivo visível **e** oferece o caminho de volta — sem inventar uma
cobrança que não existe. Se algum dia houver um worker com limite por usuário,
como descrito acima, o teto passa a vir do servidor e esta tela some.


### Sobre o Focus/Ring

O handoff avisa que o token `Focus/Ring` existe mas nunca foi aplicado
componente a componente, e chama isso de "dívida conhecida". O valor está
documentado no arquivo: **`#5CB2FF`**. Está em `tokens.css`, e a etapa 10 aplica
o anel de 2px em todo controle interativo — a V2 não tinha nenhum estado de
foco.

---

## Assets

Todos chegaram, menos as fontes. **O código procura estes nomes exatos** — nome
diferente e o arquivo não é encontrado.

### `assets/frames/` ✅

| Arquivo | Estado |
|---|---|
| `moldura-canaltech.png` | 1920 × 1080, RGBA, 97% vazada |
| `moldura-ct-eletro.png` | 1920 × 1080, RGBA, 97% vazada |

> **Trocou uma moldura? Rode `./build.sh`.** As molduras vivem no código como
> data URI, geradas destes PNGs — veja
> [Por que as molduras são data URI](#por-que-as-molduras-são-data-uri).
> Sem rodar o script, o arquivo novo fica em `assets/` e o editor continua
> usando o antigo.

### `assets/samples/` ✅

`dramatico.png` · `vivido.png` · `cinema.png` · `retro.png` · `epico.png` ·
`quente.png` — 300 × 179 cada.

Um detalhe menor: 300 × 179 dá 1,676 e não os 1,778 de 16:9, então o card corta
cerca de 5% em cima e embaixo. Não atrapalha a comparação entre os filtros, que
é a função do card. Se quiser o enquadramento exato, 320 × 180 resolve.

### `assets/fonts/` ⬜ — o que ainda falta

Dez arquivos `.woff2`, auto-hospedados com `@font-face`, **não** por CDN do
Google. Sem eles a interface cai na pilha de fontes do sistema: funciona e é
legível, mas não é o desenho — o Barlow muda bastante o peso dos títulos, e o
título dentro da thumb sai com itálico sintetizado em vez do Black Italic real.

| Arquivo | Família | Peso | Estilo | Usado em |
|---|---|---|---|---|
| `barlow-400.woff2` | Barlow | 400 | normal | corpo de texto da interface |
| `barlow-500.woff2` | Barlow | 500 | normal | rótulos e textos secundários |
| `barlow-700.woff2` | Barlow | 700 | normal | títulos e botões da interface |
| `barlow-800.woff2` | Barlow | 800 | normal | títulos grandes da interface |
| `barlow-900.woff2` | Barlow | 900 | normal | destaques |
| `barlow-400-italic.woff2` | Barlow | 400 | itálico | título da thumb, peso Regular |
| `barlow-700-italic.woff2` | Barlow | 700 | itálico | título da thumb, peso Bold |
| `barlow-800-italic.woff2` | Barlow | 800 | itálico | título da thumb, peso Extra Bold |
| `barlow-900-italic.woff2` | Barlow | 900 | itálico | **título da thumb, padrão (Black Italic)** |
| `anton-400.woff2` | Anton | 400 | normal | título da thumb, alternativa |

Em `fonts.google.com/specimen/Barlow` e `/specimen/Anton`. Se vierem em `.ttf`,
pode subir assim mesmo que eu converto.

### `assets/icons/` ⬜ — opcional

Os ícones são stand-ins desenhados à mão, 24 px em traço. Funcionam. Se quiser
os do Figma, são `close.svg`, `save.svg`, `download.svg` e `upload.svg`, em
24 × 24 com `stroke="currentColor"`.

---

### Por que as molduras são data URI

Desenhar no canvas um PNG carregado de `assets/` **contamina o canvas** quando a
página roda em `file://`, e `toDataURL()` passa a lançar `SecurityError`. Na
prática: o export quebraria exatamente quando a pessoa escolhesse a moldura da
marca — o caso mais comum. E em `file://` não há como ler os bytes de um arquivo
local por `fetch` nem por `XHR`: o navegador bloqueia os dois.

Por isso `build.sh` gera `js/frames.js` com as duas molduras em base64. O PNG em
`assets/frames/` continua sendo a fonte da verdade, e serve de reserva quando a
página é servida por `http`, onde a contaminação não acontece.

Custo: 70 KB no arquivo final. É o preço de o export funcionar com duplo clique.

## Chaves de API

**Nenhuma chave entra no código.** Nem como constante, nem como fallback, nem
como exemplo comentado. Se você encontrar uma chave em qualquer arquivo deste
repositório, é um bug — abra uma issue.

Na primeira abertura o editor detecta que não há chaves e abre a tela de
configuração pedindo:

| Campo | Para quê | Obrigatório |
|---|---|---|
| `GOOGLE_AI_KEY` | Gemini — os seis filtros de direção de arte | sim |
| `PHOTOROOM_KEY` | PhotoRoom — remoção de fundo | sim |
| `PHOTOROOM_PROXY_URL` | URL do worker que contorna o CORS da PhotoRoom | não, mas veja abaixo |

As chaves ficam em `localStorage`. A própria tela diz isso, com todas as
letras: *as chaves ficam salvas neste navegador e são visíveis para quem tiver
acesso a ele; use só em máquina sua.* Há item de menu para trocar ou apagar as
chaves a qualquer momento, e uma resposta 401 ou 403 devolve a pessoa para essa
tela dizendo **qual** das duas chaves está inválida.

`js/config.js` apenas **lê** o `localStorage`. Se ele for commitado, nada vaza.

### O CORS da PhotoRoom

O Gemini aceita chamada direta do navegador, inclusive de uma página aberta em
`file://` — verificado: a API responde `access-control-allow-origin: null`, que
é exatamente a origem de um arquivo local. Nada a fazer.

A PhotoRoom **não**. `sdk.photoroom.com/v1/segment` não devolve cabeçalho CORS
para chamada de navegador, e a V2 já tinha batido nessa parede: o código dela
carrega um `PHOTOROOM_PROXY_URL` e uma mensagem de erro mandando usar um proxy.

Por isso o terceiro campo. Sem ele, tudo funciona menos o botão "Remover fundo",
que falha explicando o motivo e como resolver — não falha em silêncio. Com a URL
preenchida, o recorte passa a funcionar sem trocar uma linha de código.

O worker é curto:

```js
// Cloudflare Worker — proxy da PhotoRoom
export default {
  async fetch(request, env) {
    const cors = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (request.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: cors });

    const upstream = await fetch('https://sdk.photoroom.com/v1/segment', {
      method: 'POST',
      headers: { 'x-api-key': env.PHOTOROOM_KEY },  // segredo do worker, nunca do cliente
      body: request.body,
    });
    return new Response(upstream.body, { status: upstream.status, headers: { ...cors, 'Content-Type': upstream.headers.get('Content-Type') || 'image/png' } });
  },
};
```

Com `PHOTOROOM_KEY` guardada como secret do worker (`wrangler secret put`), a
chave da PhotoRoom deixa de precisar do `localStorage`.

### O caminho de produção que não estamos fazendo agora

O worker acima resolve CORS, não resolve abuso. Quem descobrir a URL usa a sua
cota. Em produção, o desenho é outro:

1. **Um worker fino na frente das duas APIs**, Gemini e PhotoRoom. As chaves
   ficam como secrets do lado do servidor e nunca chegam ao navegador.
2. **Identidade por usuário** — sessão assinada, não uma URL que qualquer um
   cola no navegador.
3. **Limite por usuário**, aplicado no servidor: teto de créditos por dia e por
   mês, com o saldo real vivendo no servidor. O contador de créditos do cliente
   passa a ser espelho, não fonte da verdade.
4. **O worker devolve só o resultado** — a imagem gerada — e registra custo,
   modelo e latência para fechar a conta no fim do mês.

Nesse mundo, `config.js` e a tela de chaves somem. O editor não conhece chave
nenhuma; só sabe conversar com o worker.

---

## Estrutura

```
/
├── index.html
├── css/
│   ├── tokens.css          ← gerado a partir das variáveis do Figma
│   └── app.css
├── js/
│   ├── config.js           ← só lê chaves do localStorage, nunca as guarda em código
│   ├── canvas.js           ← composição, arraste, zoom, alças
│   ├── text.js             ← caixas de texto, seleção, trechos em destaque
│   ├── ai.js               ← Gemini (filtros) e PhotoRoom (recorte)
│   └── app.js              ← estado, trilha das quatro paradas, créditos
├── assets/
│   ├── fonts/              ← 10 .woff2
│   ├── frames/             ← 2 .png 1920×1080
│   ├── icons/              ← SVGs 24px
│   └── samples/            ← 6 .png 16:9
├── README.md
└── .gitignore
```

Durante o desenvolvimento os arquivos ficam separados. No final eles viram um
`index.html` único, que abre com duplo clique.

---

## Créditos e custo

| Ação | Créditos | Custo real |
|---|---|---|
| Remoção de fundo (PhotoRoom) | 1 ✦ | US$ 0,020 |
| Prévia do filtro, 0.5K | 1 ✦ | US$ 0,045 |
| Entrega do filtro, 2K | 2 ✦ | US$ 0,101 |

Uma thumb com uma tentativa de filtro fecha em **4 ✦**, cerca de **R$ 0,91**
a R$ 5,50 por dólar. Baixar não cobra crédito.

Regras que o código respeita:

- Clicar num filtro **não gera nada e não cobra nada** — abre a confirmação.
- O crédito sai no instante da chamada e **não volta**. Cancelar durante o
  processamento interrompe a espera mas não devolve o crédito. A interface
  avisa isso antes, nunca depois.
- O recorte é uma chamada de API; o reenquadre é local. Depois de recortado,
  mover, escalar e girar o PNG não dispara chamada nova.
