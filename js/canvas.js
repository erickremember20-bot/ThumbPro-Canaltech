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

   CAMADAS E TRAVAMENTO PROGRESSIVO
   Cada imagem nova entra por cima e TRAVA as de baixo. Só a camada do
   topo se mexe. É a regra de uma colagem: você monta o fundo, fecha o
   fundo, monta o recorte por cima. Quem quiser mexer numa camada
   travada volta para ela pela lista de camadas do painel.
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

  var seq = 0;

  function clamp(value, low, high) {
    return Math.min(high, Math.max(low, value));
  }

  function createCanvas(root, options) {
    options = options || {};
    var onChange = options.onChange || function () {};

    var layers = [];
    var activeId = null;
    var frozen = false;      /* fora da parada 1, nada se mexe */

    var snap = window.TD_SNAP.create(root);

    var handles = document.createElement('div');
    handles.className = 'td-handles';
    handles.hidden = true;

    ['nw', 'ne', 'se', 'sw'].forEach(function (corner) {
      var handle = document.createElement('button');
      handle.type = 'button';
      handle.className = 'td-handle td-handle--' + corner;
      handle.dataset.corner = corner;
      handle.setAttribute('aria-label', 'Redimensionar a imagem pelo canto ' + corner);
      handles.appendChild(handle);
    });
    root.appendChild(handles);

    /* ── Camadas ────────────────────────────────────────────────────── */

    function active() {
      if (frozen) return null;
      return layers.filter(function (l) { return l.id === activeId && !l.locked; })[0] || null;
    }

    function byId(id) {
      return layers.filter(function (l) { return l.id === id; })[0] || null;
    }

    function addImage(src, naturalWidth, naturalHeight) {
      /* A NOVA TRAVA AS DE BAIXO. */
      layers.forEach(function (l) { l.locked = true; });

      var layer = {
        id: 'L' + (++seq),
        src: src,
        natW: naturalWidth,
        natH: naturalHeight,
        sx: 1, sy: 1, x: 0, y: 0,
        locked: false
      };

      var element = document.createElement('img');
      element.className = 'td-layer';
      element.alt = '';
      element.draggable = false;
      element.src = src;
      layer.element = element;

      /* Entra por cima, mas abaixo das alças e dos guias. */
      root.insertBefore(element, handles);
      layers.push(layer);
      activeId = layer.id;

      fill(layer);
      draw();
      return layer;
    }

    /* Volta a editar uma camada travada. Destravar uma camada trava
       todas as outras: continua valendo que só uma se mexe por vez. */
    function editLayer(id) {
      var layer = byId(id);
      if (!layer) return;
      layers.forEach(function (l) { l.locked = l !== layer; });
      activeId = layer.id;
      frozen = false;
      draw();
    }

    function removeLayer(id) {
      var layer = byId(id);
      if (!layer) return;
      if (layer.element.parentNode) layer.element.parentNode.removeChild(layer.element);
      layers = layers.filter(function (l) { return l !== layer; });
      if (activeId === id) {
        var last = layers[layers.length - 1];
        activeId = last ? last.id : null;
        if (last) last.locked = false;
      }
      draw();
    }

    /* Sair da parada 1 congela a composição inteira: da parada 2 em
       diante as imagens não se mexem mais. */
    function freeze(next) {
      frozen = next;
      if (next) layers.forEach(function (l) { l.locked = true; });
      draw();
    }

    /* ── Conversão tela ↔ export ────────────────────────────────────── */

    function factor() { return root.clientWidth / EXPORT_W; }

    function toExport(clientX, clientY) {
      var rect = root.getBoundingClientRect();
      var k = factor();
      return { x: (clientX - rect.left) / k, y: (clientY - rect.top) / k };
    }

    function boxOf(layer) {
      return {
        x: layer.x, y: layer.y,
        width: layer.natW * layer.sx,
        height: layer.natH * layer.sy
      };
    }

    /* Os retângulos que servem de alvo para as réguas — usados aqui e
       também pelos textos, para um texto poder grudar numa imagem. */
    function boxes(exceptId) {
      return layers
        .filter(function (l) { return l.id !== exceptId; })
        .map(boxOf);
    }

    /* ── Desenho ────────────────────────────────────────────────────── */

    function draw() {
      var k = factor();

      layers.forEach(function (layer) {
        var style = layer.element.style;
        style.width = (layer.natW * layer.sx * k) + 'px';
        style.height = (layer.natH * layer.sy * k) + 'px';
        style.transform = 'translate(' + (layer.x * k) + 'px,' + (layer.y * k) + 'px)';
        layer.element.classList.toggle('td-layer--locked', layer.locked || frozen);
      });

      drawHandles(k);
      onChange(publicState());
    }

    function publicState() {
      var current = active();
      return {
        zoom: current ? current.sx : 1,
        zoomPercent: current ? Math.round(current.sx * 100) : 100,
        layers: layers.map(function (l, i) {
          return { id: l.id, src: l.src, locked: l.locked || frozen, index: i };
        }),
        activeId: current ? current.id : null,
        frozen: frozen
      };
    }

    /* AS ALÇAS MORAM NA PARTE VISÍVEL DA CAMADA, não nos cantos dela.
       Com a imagem preenchendo o canvas — o enquadre de partida — os
       cantos reais ficam fora da área visível, e no zoom de 400% ficam
       longe dela. Alça que não dá para alcançar não é alça. */
    var HANDLE_INSET = 9;

    function drawHandles(k) {
      var layer = active();
      if (!layer) { handles.hidden = true; return; }

      var cw = root.clientWidth;
      var ch = root.clientHeight;

      var left = layer.x * k;
      var top = layer.y * k;
      var right = left + layer.natW * layer.sx * k;
      var bottom = top + layer.natH * layer.sy * k;

      var x0 = clamp(left, HANDLE_INSET, cw - HANDLE_INSET);
      var x1 = clamp(right, HANDLE_INSET, cw - HANDLE_INSET);
      var y0 = clamp(top, HANDLE_INSET, ch - HANDLE_INSET);
      var y1 = clamp(bottom, HANDLE_INSET, ch - HANDLE_INSET);

      if (x1 - x0 < 16 || y1 - y0 < 16) { handles.hidden = true; return; }

      handles.hidden = false;
      handles.style.width = (x1 - x0) + 'px';
      handles.style.height = (y1 - y0) + 'px';
      handles.style.transform = 'translate(' + x0 + 'px,' + y0 + 'px)';
    }

    /* ── Limites ─────────────────────────────────────────────────────
       A imagem não pode sumir da área visível. A regra é de
       SOBREPOSIÇÃO, não de posição: o que importa é quanto da imagem
       ainda cruza o canvas, em cada eixo.                              */

    function clampPosition(layer, x, y) {
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
      var layer = active();
      if (!layer) return;
      var fixed = clampPosition(layer, layer.x, layer.y);
      if (fixed.x === layer.x && fixed.y === layer.y) return;

      layer.element.classList.add('td-layer--settling');
      handles.classList.add('td-layer--settling');
      layer.x = fixed.x;
      layer.y = fixed.y;
      draw();

      window.setTimeout(function () {
        layer.element.classList.remove('td-layer--settling');
        handles.classList.remove('td-layer--settling');
      }, 220);
    }

    /* ── Zoom ────────────────────────────────────────────────────────
       ANCORADO NO PONTEIRO: o pixel da imagem que está sob o cursor
       continua sob o cursor depois do zoom. É isso que faz o gesto
       parecer natural — zoom ancorado no centro parece quebrado.       */

    function zoomAt(nextScale, anchorX, anchorY) {
      var layer = active();
      if (!layer) return;

      var target = clamp(nextScale, MIN_ZOOM, MAX_ZOOM);
      if (target === layer.sx && target === layer.sy) return;

      var u = (anchorX - layer.x) / (layer.natW * layer.sx);
      var v = (anchorY - layer.y) / (layer.natH * layer.sy);

      layer.sx = target;
      layer.sy = target;
      layer.x = anchorX - u * layer.natW * layer.sx;
      layer.y = anchorY - v * layer.natH * layer.sy;

      draw();
    }

    function setZoom(next) {
      if (!active()) return;
      zoomAt(next, EXPORT_W / 2, EXPORT_H / 2);
      settle();
    }

    function fit(layer) {
      layer = layer || active();
      if (!layer) return;
      var scale = Math.min(EXPORT_W / layer.natW, EXPORT_H / layer.natH);
      layer.sx = layer.sy = clamp(scale, MIN_ZOOM, MAX_ZOOM);
      center(layer);
      draw();
    }

    /* Preencher é o enquadre de partida: thumb com tarja preta nas
       laterais não é thumb. */
    function fill(layer) {
      layer = layer || active();
      if (!layer) return;
      var scale = Math.max(EXPORT_W / layer.natW, EXPORT_H / layer.natH);
      layer.sx = layer.sy = clamp(scale, MIN_ZOOM, MAX_ZOOM);
      center(layer);
      draw();
    }

    function center(layer) {
      layer.x = (EXPORT_W - layer.natW * layer.sx) / 2;
      layer.y = (EXPORT_H - layer.natH * layer.sy) / 2;
    }

    /* ── Gestos de ponteiro ──────────────────────────────────────────
       Um só caminho para mouse, caneta e dedo. Dois ponteiros viram
       pinça: zoom e pan juntos, ancorados no ponto médio entre os
       dedos.                                                          */

    var pointers = new Map();
    var dragging = null;
    var resizing = null;
    var pinching = null;

    function pointerList() { return Array.from(pointers.values()); }
    function distance(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
    function midpoint(a, b) { return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; }

    function onPointerDown(event) {
      var layer = active();
      if (!layer) return;

      var corner = event.target.dataset && event.target.dataset.corner;

      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      try { event.target.setPointerCapture(event.pointerId); } catch (e) {}

      var list = pointerList();

      if (list.length === 2) {
        dragging = null;
        resizing = null;
        var mid = toExport(midpoint(list[0], list[1]).x, midpoint(list[0], list[1]).y);
        pinching = {
          startDistance: distance(list[0], list[1]) || 1,
          startScale: layer.sx,
          anchor: mid
        };
        return;
      }

      if (corner) {
        resizing = {
          corner: corner,
          start: toExport(event.clientX, event.clientY),
          startLayer: { x: layer.x, y: layer.y, sx: layer.sx, sy: layer.sy }
        };
        return;
      }

      var origin = toExport(event.clientX, event.clientY);
      dragging = { grabX: origin.x - layer.x, grabY: origin.y - layer.y };
      root.classList.add('td-canvas--grabbing');
    }

    function onPointerMove(event) {
      var layer = active();
      if (!layer || !pointers.has(event.pointerId)) return;
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

      if (resizing) { resize(event, layer); return; }

      if (dragging) {
        var point = toExport(event.clientX, event.clientY);
        layer.x = point.x - dragging.grabX;
        layer.y = point.y - dragging.grabY;

        /* As réguas magnéticas entram aqui: o alvo pode ser outra
           camada, um texto, ou o próprio quadro. */
        var result = snap.solve(boxOf(layer),
          boxes(layer.id).concat(options.otherBoxes ? options.otherBoxes() : []));
        layer.x += result.dx;
        layer.y += result.dy;
        snap.draw(result.lines);

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
        snap.clear();
        root.classList.remove('td-canvas--grabbing');
      }
    }

    /* ── Alças ───────────────────────────────────────────────────────
       Mantêm proporção; Shift libera. O canto OPOSTO fica parado, e o
       gesto é medido por DESLOCAMENTO do ponteiro — é isso que
       desacopla o redimensionamento da posição da alça, que fica
       recuada para dentro do canvas.                                  */

    function resize(event, layer) {
      var start = resizing.startLayer;
      var point = toExport(event.clientX, event.clientY);

      var west = resizing.corner === 'nw' || resizing.corner === 'sw';
      var north = resizing.corner === 'nw' || resizing.corner === 'ne';

      var startW = layer.natW * start.sx;
      var startH = layer.natH * start.sy;

      var cornerX = west ? start.x : start.x + startW;
      var cornerY = north ? start.y : start.y + startH;
      var anchorX = west ? start.x + startW : start.x;
      var anchorY = north ? start.y + startH : start.y;

      var movedX = point.x - resizing.start.x;
      var movedY = point.y - resizing.start.y;

      var width = Math.abs((cornerX + movedX) - anchorX);
      var height = Math.abs((cornerY + movedY) - anchorY);

      var sx = width / layer.natW;
      var sy = height / layer.natH;

      if (!event.shiftKey) {
        var uniform = Math.max(sx, sy);
        sx = uniform;
        sy = uniform;
      }

      layer.sx = clamp(sx, MIN_ZOOM, MAX_ZOOM);
      layer.sy = clamp(sy, MIN_ZOOM, MAX_ZOOM);
      layer.x = west ? anchorX - layer.natW * layer.sx : anchorX;
      layer.y = north ? anchorY - layer.natH * layer.sy : anchorY;

      draw();
    }

    function onWheel(event) {
      var layer = active();
      if (!layer) return;
      event.preventDefault();
      var anchor = toExport(event.clientX, event.clientY);
      var step = Math.exp(-event.deltaY * 0.0015);
      zoomAt(layer.sx * step, anchor.x, anchor.y);
    }

    var fitOnDoubleClick = true;

    function onDoubleClick(event) {
      if (!active() || !fitOnDoubleClick) return;
      event.preventDefault();
      fit();
      settle();
    }

    /* ── Desenho do texto no export ──────────────────────────────────
       Reimplementa a quebra de linha do navegador no canvas 2D, porque
       canvas não quebra sozinho. Cada palavra carrega a cor do trecho
       de onde veio — é assim que uma palavra amarela no meio de um
       título branco chega inteira ao PNG.                             */

    function drawTexts(ctx, texts, scale) {
      var family = getComputedStyle(document.documentElement)
        .getPropertyValue('--font-thumb-title').trim() || 'Barlow, sans-serif';

      texts.forEach(function (model) {
        var size = model.size * scale;
        var width = model.width * scale;
        var lineHeight = size * 1.1;

        ctx.save();
        ctx.font = 'italic ' + model.weight + ' ' + size + 'px ' + family;
        ctx.textBaseline = 'top';

        var words = [];
        model.segments.forEach(function (segment) {
          segment.text.split(/(\s+|\n)/).forEach(function (piece) {
            if (piece !== '') words.push({ text: piece, color: segment.color });
          });
        });

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

    /* ── Snapshot ────────────────────────────────────────────────────
       Redesenha o estado num canvas de verdade e devolve um PNG. É o
       MESMO renderizador que o export usa — por isso ele manda para a
       IA exatamente o que a pessoa vê, e não uma segunda interpretação
       do estado que pode divergir.                                    */

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

      /* As camadas, de baixo para cima — a mesma ordem da tela. */
      layers.forEach(function (layer) {
        if (!layer.element.complete || !layer.element.naturalWidth) return;
        ctx.drawImage(
          layer.element,
          layer.x * scale, layer.y * scale,
          layer.natW * layer.sx * scale, layer.natH * layer.sy * scale
        );
      });

      /* O guia do timer e as alças não entram: são interface, e
         interface não tem coordenada de export. */
      if (options.texts) drawTexts(ctx, options.texts, scale);

      if (options.frame) {
        ctx.drawImage(options.frame, 0, 0, width, height);
      } else if (options.frameColor) {
        var band = (options.frameWidth || 16) * scale;
        ctx.save();
        ctx.strokeStyle = options.frameColor;
        ctx.lineWidth = band;
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
      addImage: addImage,
      editLayer: editLayer,
      removeLayer: removeLayer,
      freeze: freeze,
      snapshot: snapshot,
      boxes: boxes,
      setDoubleClickFit: function (next) { fitOnDoubleClick = next; },
      getLayer: function () {
        var l = active() || layers[layers.length - 1];
        return l && { src: l.src, natW: l.natW, natH: l.natH,
                      x: l.x, y: l.y, sx: l.sx, sy: l.sy };
      },
      count: function () { return layers.length; },
      hasImage: function () { return layers.length > 0; },
      fit: fit,
      fill: fill,
      setZoom: setZoom,
      getZoom: function () { var l = active(); return l ? l.sx : 1; },
      state: publicState,
      draw: draw,

      /* Trocar a fonte da camada ativa SEM mexer no enquadramento. É o
         que torna verdade a regra de que o recorte é uma chamada de API
         e o reenquadre é local. */
      replaceSource: function (src, naturalWidth, naturalHeight) {
        var layer = active() || layers[layers.length - 1];
        if (!layer) return;
        var displayW = layer.natW * layer.sx;
        var displayH = layer.natH * layer.sy;
        layer.src = src;
        layer.natW = naturalWidth;
        layer.natH = naturalHeight;
        layer.sx = displayW / naturalWidth;
        layer.sy = displayH / naturalHeight;
        layer.element.src = src;
        draw();
      },

      /* A entrega do filtro substitui a composição inteira por uma
         imagem só: o filtro devolve o quadro já renderizado. */
      replaceAll: function (src, naturalWidth, naturalHeight) {
        layers.forEach(function (l) {
          if (l.element.parentNode) l.element.parentNode.removeChild(l.element);
        });
        layers = [];
        activeId = null;
        var wasFrozen = frozen;
        frozen = false;
        addImage(src, naturalWidth, naturalHeight);
        frozen = wasFrozen;
        if (wasFrozen) layers.forEach(function (l) { l.locked = true; });
        draw();
      },

      MIN_ZOOM: MIN_ZOOM,
      MAX_ZOOM: MAX_ZOOM,
      EXPORT_W: EXPORT_W,
      EXPORT_H: EXPORT_H
    };
  }

  window.TD_CANVAS = { create: createCanvas };

})(window, document);
