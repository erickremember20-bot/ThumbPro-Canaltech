/* =====================================================================
   ThumbDrop V3 · canvas.js
   ---------------------------------------------------------------------
   A superfície de composição. Posicionamento absoluto, nunca flex: os
   elementos aqui têm coordenadas, não ordem.

   O SISTEMA DE COORDENADAS
   Tudo é guardado em pixels de EXPORT — o espaço de 1920 × 1080 em que a
   thumb final é gerada — e só na hora de desenhar é convertido para o
   tamanho que o canvas tem na tela. Duas consequências boas: o layout
   não muda quando a janela muda de tamanho, e o export é uma releitura
   do mesmo estado, não uma segunda implementação que pode divergir.

   ZOOM 100% = a imagem no tamanho natural dela dentro dos 1920 × 1080.
   Não é o mesmo que "caber no canvas" — por isso o duplo clique
   (enquadrar) e o clique no número (voltar a 100%) são gestos
   diferentes, com resultados diferentes.
   ===================================================================== */

(function (window, document) {
  'use strict';

  var EXPORT_W = 1920;
  var EXPORT_H = 1080;

  var MIN_ZOOM = 0.10;
  var MAX_ZOOM = 4.00;

  /* Quanto da imagem precisa continuar dentro do canvas. Um quarto do
     menor lado: o suficiente para a pessoa sempre ter onde pegar de
     volta, sem prender o enquadramento. */
  var MIN_VISIBLE = 0.25;

  function clamp(value, low, high) {
    return Math.min(high, Math.max(low, value));
  }

  function createCanvas(root, options) {
    options = options || {};
    var onChange = options.onChange || function () {};

    /* ── Estado da camada ───────────────────────────────────────────
       x, y = canto superior esquerdo em pixels de export.
       sx, sy = escala. Iguais, exceto quando alguém segura Shift numa
       alça e libera a proporção de propósito.                          */

    var layer = null;
    var selected = false;

    var image = document.createElement('img');
    image.className = 'td-layer';
    image.alt = '';
    image.draggable = false;

    var handles = document.createElement('div');
    handles.className = 'td-handles';
    handles.hidden = true;

    var CORNERS = ['nw', 'ne', 'se', 'sw'];
    CORNERS.forEach(function (corner) {
      var handle = document.createElement('button');
      handle.type = 'button';
      handle.className = 'td-handle td-handle--' + corner;
      handle.dataset.corner = corner;
      handle.setAttribute('aria-label', 'Redimensionar pelo canto');
      handles.appendChild(handle);
    });

    /* ── Conversão tela ↔ export ────────────────────────────────────── */

    function factor() {
      /* Quantos pixels de tela vale um pixel de export. */
      return root.clientWidth / EXPORT_W;
    }

    function toExport(clientX, clientY) {
      var rect = root.getBoundingClientRect();
      var k = factor();
      return {
        x: (clientX - rect.left) / k,
        y: (clientY - rect.top) / k
      };
    }

    /* ── Desenho ────────────────────────────────────────────────────── */

    function draw() {
      if (!layer) return;
      var k = factor();

      image.style.width  = (layer.natW * layer.sx * k) + 'px';
      image.style.height = (layer.natH * layer.sy * k) + 'px';
      image.style.transform = 'translate(' + (layer.x * k) + 'px,' + (layer.y * k) + 'px)';

      drawHandles(k);

      onChange(publicState());
    }


    /* AS ALÇAS MORAM NA PARTE VISÍVEL DA CAMADA, não nos cantos dela.

       Com a imagem preenchendo o canvas — que é o enquadre de partida —
       os cantos reais ficam fora da área visível, e no zoom de 400% ficam
       longe dela. Alça que não dá para alcançar não é alça. Então o
       retângulo das alças é a interseção entre a camada e o canvas,
       recuado o suficiente para nenhuma delas ser cortada pela borda.

       Quem redimensiona continua puxando o canto REAL da camada: o
       gesto é medido por deslocamento do ponteiro, não pela posição da
       alça. Ver resize(). */
    var HANDLE_INSET = 9;

    function drawHandles(k) {
      if (!selected) { handles.hidden = true; return; }

      var cw = root.clientWidth;
      var ch = root.clientHeight;

      var left = layer.x * k;
      var top  = layer.y * k;
      var right  = left + layer.natW * layer.sx * k;
      var bottom = top  + layer.natH * layer.sy * k;

      var x0 = clamp(left,   HANDLE_INSET, cw - HANDLE_INSET);
      var x1 = clamp(right,  HANDLE_INSET, cw - HANDLE_INSET);
      var y0 = clamp(top,    HANDLE_INSET, ch - HANDLE_INSET);
      var y1 = clamp(bottom, HANDLE_INSET, ch - HANDLE_INSET);

      /* Camada arrastada quase toda para fora: não há retângulo onde
         pousar alça, e mostrar quatro pontos empilhados seria pior que
         não mostrar nada. */
      if (x1 - x0 < 16 || y1 - y0 < 16) { handles.hidden = true; return; }

      handles.hidden = false;
      handles.style.width  = (x1 - x0) + 'px';
      handles.style.height = (y1 - y0) + 'px';
      handles.style.transform = 'translate(' + x0 + 'px,' + y0 + 'px)';
    }

    function publicState() {
      if (!layer) return null;
      return {
        zoom: layer.sx,
        zoomPercent: Math.round(layer.sx * 100),
        uniform: Math.abs(layer.sx - layer.sy) < 0.0001
      };
    }

    /* ── Limites ────────────────────────────────────────────────────────
       A imagem não pode sumir da área visível. A regra é de SOBREPOSIÇÃO,
       não de posição: o que importa é quanto da imagem ainda cruza o
       canvas, em cada eixo.                                              */

    function clampPosition(x, y) {
      var w = layer.natW * layer.sx;
      var h = layer.natH * layer.sy;

      var needX = Math.min(w, EXPORT_W) * MIN_VISIBLE;
      var needY = Math.min(h, EXPORT_H) * MIN_VISIBLE;

      return {
        x: clamp(x, needX - w, EXPORT_W - needX),
        y: clamp(y, needY - h, EXPORT_H - needY)
      };
    }

    /* Quem arrasta pode passar do limite enquanto segura; ao soltar, a
       imagem volta para dentro suavemente. Puxar e ver voltar ensina o
       limite melhor do que uma parede dura durante o gesto. */
    function settle() {
      if (!layer) return;
      var fixed = clampPosition(layer.x, layer.y);
      if (fixed.x === layer.x && fixed.y === layer.y) return;

      image.classList.add('td-layer--settling');
      handles.classList.add('td-layer--settling');
      layer.x = fixed.x;
      layer.y = fixed.y;
      draw();

      window.setTimeout(function () {
        image.classList.remove('td-layer--settling');
        handles.classList.remove('td-layer--settling');
      }, 220);
    }

    /* ── Zoom ───────────────────────────────────────────────────────────
       ANCORADO NO PONTEIRO: o pixel da imagem que está sob o cursor
       continua sob o cursor depois do zoom. É isso que faz o gesto
       parecer natural — zoom ancorado no centro parece quebrado.         */

    function zoomAt(nextScale, anchorX, anchorY) {
      if (!layer) return;

      var target = clamp(nextScale, MIN_ZOOM, MAX_ZOOM);
      if (target === layer.sx && target === layer.sy) return;

      /* Onde o ponto ancorado cai DENTRO da imagem, de 0 a 1. */
      var u = (anchorX - layer.x) / (layer.natW * layer.sx);
      var v = (anchorY - layer.y) / (layer.natH * layer.sy);

      layer.sx = target;
      layer.sy = target;

      /* Recoloca a imagem para que aquele mesmo ponto caia sob a âncora. */
      layer.x = anchorX - u * layer.natW * layer.sx;
      layer.y = anchorY - v * layer.natH * layer.sy;

      draw();
    }

    function setZoom(next) {
      if (!layer) return;
      /* Sem ponteiro, a âncora é o centro do canvas — que é o que a
         pessoa está olhando quando usa o controle de − e +. */
      zoomAt(next, EXPORT_W / 2, EXPORT_H / 2);
      settle();
    }

    /* Enquadrar: a imagem inteira cabe no canvas, centralizada. */
    function fit() {
      if (!layer) return;
      var scale = Math.min(EXPORT_W / layer.natW, EXPORT_H / layer.natH);
      layer.sx = layer.sy = clamp(scale, MIN_ZOOM, MAX_ZOOM);
      center();
      draw();
    }

    /* Preencher: a imagem cobre o canvas inteiro. É o enquadre de
       partida, porque thumb com tarja preta nas laterais não é thumb. */
    function fill() {
      if (!layer) return;
      var scale = Math.max(EXPORT_W / layer.natW, EXPORT_H / layer.natH);
      layer.sx = layer.sy = clamp(scale, MIN_ZOOM, MAX_ZOOM);
      center();
      draw();
    }

    function center() {
      layer.x = (EXPORT_W - layer.natW * layer.sx) / 2;
      layer.y = (EXPORT_H - layer.natH * layer.sy) / 2;
    }

    /* ── Gestos de ponteiro ─────────────────────────────────────────────
       Um só caminho para mouse, caneta e dedo. Dois ponteiros viram
       pinça: zoom e pan juntos, ancorados no ponto médio entre os dedos. */

    var pointers = new Map();
    var dragging = null;      /* arraste da imagem */
    var resizing = null;      /* arraste de alça */
    var pinching = null;

    function pointerList() {
      return Array.from(pointers.values());
    }

    function distance(a, b) {
      return Math.hypot(a.x - b.x, a.y - b.y);
    }

    function midpoint(a, b) {
      return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    }

    function onPointerDown(event) {
      if (!layer) return;

      var corner = event.target.dataset && event.target.dataset.corner;

      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      try { event.target.setPointerCapture(event.pointerId); } catch (e) {}

      var list = pointerList();

      if (list.length === 2) {
        /* Dois dedos: a pinça assume e cancela qualquer arraste em curso. */
        dragging = null;
        resizing = null;
        var a = list[0], b = list[1];
        var mid = toExport(midpoint(a, b).x, midpoint(a, b).y);
        pinching = {
          startDistance: distance(a, b) || 1,
          startScale: layer.sx,
          anchor: mid
        };
        return;
      }

      if (corner) {
        var point = toExport(event.clientX, event.clientY);
        resizing = {
          corner: corner,
          start: point,
          startLayer: { x: layer.x, y: layer.y, sx: layer.sx, sy: layer.sy }
        };
        select(true);
        return;
      }

      select(true);
      var origin = toExport(event.clientX, event.clientY);
      dragging = {
        grabX: origin.x - layer.x,
        grabY: origin.y - layer.y
      };
      root.classList.add('td-canvas--grabbing');
    }

    function onPointerMove(event) {
      if (!layer) return;
      if (!pointers.has(event.pointerId)) return;
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

      if (pinching) {
        var list = pointerList();
        if (list.length < 2) return;
        var spread = distance(list[0], list[1]) || 1;
        var mid = midpoint(list[0], list[1]);
        var anchor = toExport(mid.x, mid.y);
        zoomAt(pinching.startScale * (spread / pinching.startDistance), anchor.x, anchor.y);
        return;
      }

      if (resizing) {
        resize(event);
        return;
      }

      if (dragging) {
        var point = toExport(event.clientX, event.clientY);
        layer.x = point.x - dragging.grabX;
        layer.y = point.y - dragging.grabY;
        draw();
      }
    }

    function onPointerUp(event) {
      pointers.delete(event.pointerId);

      if (pointers.size < 2) pinching = null;

      if (pointers.size === 0) {
        if (dragging || resizing) settle();
        dragging = null;
        resizing = null;
        root.classList.remove('td-canvas--grabbing');
      }
    }

    /* ── Alças ──────────────────────────────────────────────────────────
       Mantêm proporção; Shift libera. O canto OPOSTO ao que está sendo
       arrastado fica parado — é o que faz a alça parecer que puxa a
       imagem, e não que a empurra.                                       */

    function resize(event) {
      var start = resizing.startLayer;
      var point = toExport(event.clientX, event.clientY);

      var west  = resizing.corner === 'nw' || resizing.corner === 'sw';
      var north = resizing.corner === 'nw' || resizing.corner === 'ne';

      var startW = layer.natW * start.sx;
      var startH = layer.natH * start.sy;

      /* O canto que está sendo puxado e o que fica parado — os dois da
         camada, não da alça. A alça pode estar recuada para dentro do
         canvas; o que ela move é sempre o canto de verdade. */
      var cornerX = west  ? start.x : start.x + startW;
      var cornerY = north ? start.y : start.y + startH;
      var anchorX = west  ? start.x + startW : start.x;
      var anchorY = north ? start.y + startH : start.y;

      /* Medido por DESLOCAMENTO desde o início do gesto. É isso que
         desacopla o redimensionamento da posição da alça. */
      var movedX = point.x - resizing.start.x;
      var movedY = point.y - resizing.start.y;

      var width  = Math.abs((cornerX + movedX) - anchorX);
      var height = Math.abs((cornerY + movedY) - anchorY);

      var sx = width  / layer.natW;
      var sy = height / layer.natH;

      if (!event.shiftKey) {
        /* Proporção mantida: o eixo que mais mudou manda nos dois. */
        var uniform = Math.max(sx, sy);
        sx = uniform;
        sy = uniform;
      }

      layer.sx = clamp(sx, MIN_ZOOM, MAX_ZOOM);
      layer.sy = clamp(sy, MIN_ZOOM, MAX_ZOOM);

      layer.x = west  ? anchorX - layer.natW * layer.sx : anchorX;
      layer.y = north ? anchorY - layer.natH * layer.sy : anchorY;

      draw();
    }

    /* ── Roda do mouse ──────────────────────────────────────────────── */

    function onWheel(event) {
      if (!layer) return;
      event.preventDefault();

      var anchor = toExport(event.clientX, event.clientY);
      /* Passo multiplicativo: subir e descer a mesma quantidade de
         cliques volta exatamente ao zoom de onde saiu. */
      var step = Math.exp(-event.deltaY * 0.0015);
      zoomAt(layer.sx * step, anchor.x, anchor.y);
    }

    /* ── Duplo clique: enquadra a imagem inteira ────────────────────── */

    var fitOnDoubleClick = true;

    function onDoubleClick(event) {
      if (!layer || !fitOnDoubleClick) return;
      event.preventDefault();
      fit();
      settle();
    }

    function select(next) {
      selected = next;
      root.classList.toggle('td-canvas--selected', next);
      draw();
    }

    /* ── API ────────────────────────────────────────────────────────── */

    function setImage(src, naturalWidth, naturalHeight) {
      layer = {
        src: src,
        natW: naturalWidth,
        natH: naturalHeight,
        sx: 1,
        sy: 1,
        x: 0,
        y: 0
      };
      image.src = src;
      if (!image.parentNode) {
        root.insertBefore(image, root.firstChild);
        root.appendChild(handles);
      }
      fill();
      select(true);
    }

    function getLayer() {
      return layer && {
        src: layer.src, natW: layer.natW, natH: layer.natH,
        x: layer.x, y: layer.y, sx: layer.sx, sy: layer.sy
      };
    }

    /* Trocar a fonte da imagem SEM mexer no enquadramento. É isto que
       torna verdade a regra de custo: o recorte é uma chamada de API, o
       reenquadre é local. Depois de recortado, o PNG entra no lugar do
       original na mesma posição e escala — nenhuma chamada nova. */
    function replaceSource(src, naturalWidth, naturalHeight) {
      if (!layer) return;
      /* A escala é reancorada para que o recorte ocupe o mesmo retângulo
         que o original ocupava, mesmo que venha com outro número de
         pixels. */
      var displayW = layer.natW * layer.sx;
      var displayH = layer.natH * layer.sy;

      layer.src = src;
      layer.natW = naturalWidth;
      layer.natH = naturalHeight;
      layer.sx = displayW / naturalWidth;
      layer.sy = displayH / naturalHeight;

      image.src = src;
      draw();
    }


    /* ── Desenho do texto ───────────────────────────────────────────────
       Reimplementa a quebra de linha do navegador no canvas 2D, porque
       canvas não quebra sozinho. Cada palavra carrega a cor do trecho de
       onde veio — é assim que uma palavra amarela no meio de um título
       branco chega inteira ao PNG.                                       */

    function drawTexts(ctx, texts, scale) {
      /* A família vem do token, e não de um nome repetido aqui: o export
         e a tela não podem discordar sobre em que fonte o título está. */
      var family = getComputedStyle(document.documentElement)
        .getPropertyValue('--font-thumb-title').trim() || 'Barlow, sans-serif';

      texts.forEach(function (model) {
        var size = model.size * scale;
        var width = model.width * scale;
        var lineHeight = size * 1.1;

        ctx.save();
        ctx.font = 'italic ' + model.weight + ' ' + size + 'px ' + family;
        ctx.textBaseline = 'top';

        /* Palavras, cada uma com a cor do trecho de origem. */
        var words = [];
        model.segments.forEach(function (segment) {
          segment.text.split(/(\s+|\n)/).forEach(function (piece) {
            if (piece !== '') words.push({ text: piece, color: segment.color });
          });
        });

        /* Quebra gulosa, do jeito que o navegador faz. */
        var lines = [];
        var line = [];
        var used = 0;

        words.forEach(function (word) {
          if (word.text === '\n') { lines.push(line); line = []; used = 0; return; }
          var advance = ctx.measureText(word.text).width;
          if (used + advance > width && line.length && word.text.trim()) {
            lines.push(line); line = []; used = 0;
          }
          line.push(word);
          used += advance;
        });
        if (line.length) lines.push(line);

        if (model.shadow) {
          ctx.shadowColor = 'rgba(0,0,0,.75)';
          ctx.shadowBlur = size * 0.14;
          ctx.shadowOffsetY = size * 0.06;
        }

        var y = model.y * scale;
        lines.forEach(function (pieces) {
          var lineWidth = pieces.reduce(function (total, word) {
            return total + ctx.measureText(word.text).width;
          }, 0);

          var x = model.x * scale;
          if (model.align === 'center') x += (width - lineWidth) / 2;
          else if (model.align === 'right') x += width - lineWidth;

          pieces.forEach(function (word) {
            ctx.fillStyle = word.color || model.color;
            ctx.fillText(word.text, x, y);
            x += ctx.measureText(word.text).width;
          });

          y += lineHeight;
        });

        ctx.restore();
      });
    }

    /* ── Snapshot ───────────────────────────────────────────────────────
       Redesenha o estado num canvas de verdade e devolve um PNG. É o
       MESMO renderizador que o export da etapa 8 vai usar — por isso ele
       nasce aqui, mandando para a IA exatamente o que a pessoa vê, e não
       uma segunda interpretação do estado que pode divergir.

       `width` permite pedir uma versão menor: a prévia do filtro manda
       uma entrada reduzida, porque o que ela precisa julgar é direção de
       arte, não nitidez.                                                 */

    function snapshot(options) {
      options = options || {};
      var width = options.width || EXPORT_W;
      var height = Math.round(width * EXPORT_H / EXPORT_W);
      var scale = width / EXPORT_W;

      var sheet = document.createElement('canvas');
      sheet.width = width;
      sheet.height = height;

      var ctx = sheet.getContext('2d');
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, width, height);

      if (layer && image.complete && image.naturalWidth) {
        ctx.drawImage(
          image,
          layer.x * scale,
          layer.y * scale,
          layer.natW * layer.sx * scale,
          layer.natH * layer.sy * scale
        );
      }

      /* O texto é desenhado pelo MESMO renderizador, a partir dos mesmos
         trechos que a tela mostra. O guia do timer e as alças não entram
         aqui — eles são interface, e interface não vai para o PNG. */
      if (options.texts) drawTexts(ctx, options.texts, scale);

      /* A moldura é a última camada: ela emoldura tudo, inclusive o
         texto. */
      if (options.frame) {
        ctx.drawImage(options.frame, 0, 0, width, height);
      } else if (options.frameColor) {
        var band = (options.frameWidth || 16) * scale;
        ctx.save();
        ctx.strokeStyle = options.frameColor;
        ctx.lineWidth = band;
        /* Desenhada meia banda para dentro, para a borda ficar inteira
           dentro dos 1920 x 1080 em vez de metade fora. */
        ctx.strokeRect(band / 2, band / 2, width - band, height - band);
        ctx.restore();
      }

      return sheet.toDataURL('image/png');
    }

    root.addEventListener('pointerdown', onPointerDown);
    root.addEventListener('pointermove', onPointerMove);
    root.addEventListener('pointerup', onPointerUp);
    root.addEventListener('pointercancel', onPointerUp);
    root.addEventListener('wheel', onWheel, { passive: false });
    root.addEventListener('dblclick', onDoubleClick);
    window.addEventListener('resize', draw);

    return {
      setImage: setImage,
      snapshot: snapshot,
      setDoubleClickFit: function (next) { fitOnDoubleClick = next; },
      replaceSource: replaceSource,
      getLayer: getLayer,
      hasImage: function () { return !!layer; },
      fit: fit,
      fill: fill,
      setZoom: setZoom,
      getZoom: function () { return layer ? layer.sx : 1; },
      select: select,
      MIN_ZOOM: MIN_ZOOM,
      MAX_ZOOM: MAX_ZOOM,
      EXPORT_W: EXPORT_W,
      EXPORT_H: EXPORT_H
    };
  }

  window.TD_CANVAS = { create: createCanvas };

})(window, document);
