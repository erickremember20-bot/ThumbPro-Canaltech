# ThumbDrop V3 — editor de thumbnails

Editor guiado de thumbnails 16:9 para Canaltech e CT Eletro. Quatro paradas:
imagem → filtro de IA → texto → moldura e export. Saída em PNG 1920×1080.

HTML, CSS e JavaScript vanilla. **Sem build, sem framework, sem npm, sem servidor.**
Abre com duplo clique em `index.html`.

---

## Estado da implementação

| Etapa | O que passa a funcionar | Status |
|---|---|---|
| 0 | Estrutura do repositório e manifesto de assets | ✅ feito |
| 1 | `tokens.css` a partir das 5 coleções de variáveis do Figma | ✅ feito |
| 2 | Tela de configuração das chaves e `config.js` | ✅ feito |
| 3 | Shell do editor: barra superior, palco, painel/dock, trilha | ✅ feito |
| 4 | Canvas da parada 1: arraste, zoom ancorado no ponteiro, alças | ⬜ |
| 5 | Integração PhotoRoom (remoção de fundo) | ⬜ |
| 6 | Parada 2: modal de confirmação, Gemini, três estados de IA | ⬜ |
| 7 | Canvas de texto da parada 3 | ⬜ |
| 8 | Parada 4: molduras e export 1920×1080 | ⬜ |
| 9 | Recibo, contagem de créditos, saldo insuficiente | ⬜ |
| 10 | Passada de acessibilidade | ⬜ |

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

### Sobre o Focus/Ring

O handoff avisa que o token `Focus/Ring` existe mas nunca foi aplicado
componente a componente, e chama isso de "dívida conhecida". O valor está
documentado no arquivo: **`#5CB2FF`**. Está em `tokens.css`, e a etapa 10 aplica
o anel de 2px em todo controle interativo — a V2 não tinha nenhum estado de
foco.

---

## Assets que precisam ser subidos

**Leia isto com atenção: o código procura estes nomes exatos.** Nome diferente,
nada funciona. As pastas já existem no repositório, cada uma com um `.gitkeep`.

Nenhum destes arquivos pôde ser baixado do Figma automaticamente — veja
[Por que os assets não vieram do Figma](#por-que-os-assets-não-vieram-do-figma).

### `assets/fonts/` — 10 arquivos `.woff2`

Auto-hospedadas com `@font-face`, **não** via CDN do Google.
Barlow é a fonte da interface; Barlow Black Italic e Anton são as fontes de
título dentro da thumbnail.

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

Os quatro itálicos cobrem exatamente os pesos que a seção 8 do briefing pede:
Regular, Bold, Extra Bold e Black, sempre em itálico.

### `assets/frames/` — 2 arquivos `.png`

| Arquivo | Dimensão | Formato |
|---|---|---|
| `moldura-canaltech.png` | exatamente 1920×1080 | PNG com canal alfa (transparente onde a foto aparece) |
| `moldura-ct-eletro.png` | exatamente 1920×1080 | PNG com canal alfa |

A moldura é desenhada por cima da composição no export, em escala 1:1.
Se não for 1920×1080 exato, ela vai esticar e desalinhar.

### `assets/samples/` — 6 arquivos `.png`

As miniaturas dos cards de filtro na parada 2. Uma por filtro, mesma foto de
base nas seis, para a pessoa comparar o efeito e não a foto.

| Arquivo | Filtro |
|---|---|
| `dramatico.png` | Dramático |
| `vivido.png` | Vívido |
| `cinema.png` | Cinema |
| `retro.png` | Retrô |
| `epico.png` | Épico |
| `quente.png` | Quente |

Proporção 16:9, recomendado 480×270 (ou 960×540 para telas 2x). PNG ou JPG —
se preferir JPG, avise que eu troco a extensão no código.

### `assets/icons/` — SVG

Estes quatro estão nomeados no Figma e têm descrição ("24px, stroke"):

| Arquivo | Ícone |
|---|---|
| `close.svg` | fechar |
| `save.svg` | salvar |
| `download.svg` | baixar |
| `upload.svg` | subir imagem |

O handoff do Figma diz que existem **26 ícones**, mas os outros 22 são vetores
soltos dentro dos componentes, sem nome próprio — não dá para listar antes de
montar cada tela. Conforme eu construir as paradas, acrescento os nomes que
faltam a esta tabela.

Todos em SVG, 24×24, traço (não preenchimento), `stroke="currentColor"` para
herdarem a cor do token onde forem usados.

> **Não fica travado por causa dos ícones.** Enquanto os SVGs reais não chegam,
> eu desenho stand-ins inline de 24px em traço, marcados no código. Trocar um
> stand-in pelo arquivo real depois é substituir um arquivo, não mexer em lógica.

---

### Por que os assets não vieram do Figma

O briefing pedia que eu exportasse do Figma via MCP tudo que já tem export
configurado. Consegui **ler** o arquivo inteiro — as 5 coleções de variáveis
com os valores reais, os 9 estilos de texto, as telas e os dois frames de
handoff. É disso que sai o `tokens.css`, e é a parte que importa.

O que não deu:

1. **O ambiente onde este código roda bloqueia downloads de `figma.com`.**
   A política de rede da sessão nega a conexão com o servidor de assets. Não é
   permissão do Figma nem export mal configurado no arquivo: é o sandbox.
   Vale para ícones, molduras e amostras, sem exceção.
2. **As 6 amostras de filtro não existem como imagem no Figma.** Os cards
   `Filtro/Amostra` são formas desenhadas, não fotos — o Figma devolveu a lista
   de imagens vazia para eles. Mesmo sem o bloqueio de rede, não haveria o que
   baixar. Precisam ser geradas por fora.
3. **As molduras existem como imagem** dentro do nó `Canvas final com moldura`.
   Estão lá, são reais, e caem no bloqueio do item 1. Se você conseguir
   exportá-las direto do Figma em 1920×1080, é o caminho mais curto.

---

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
