/* =====================================================================
   ThumbDrop V3 · text.js
   ---------------------------------------------------------------------
   As caixas de texto da parada 3, com a gramática de um editor de
   verdade — a mesma do Figma, do Canva e do Photoshop:

     clique        seleciona, e mostra a caixa com oito alças
     duplo clique  entra em edição, com o conteúdo selecionado
     arraste       move, com réguas magnéticas grudando no alinhamento
     alça de canto ESCALA o texto inteiro, corpo da fonte junto
     alça de lado  muda só a largura da caixa, sem mexer no corpo
     Esc           sai da edição; de novo, desseleciona
     Delete        apaga o texto selecionado

   Duplo clique em ponto vazio do canvas cria uma caixa ali e já entra
   em edição. É o gesto principal e não tem botão.

   O DESTAQUE EM AMARELO É GESTO DE SELEÇÃO, não controle separado:
   selecionar uma palavra dentro da edição e clicar no amarelo pinta só
   ela. É a assinatura visual das thumbs da casa.

   Por que contentEditable e não índices de caractere: o destaque
   precisa sobreviver à edição. Guardado por índice, ele escorrega
   quando alguém insere texto antes dele. Guardado como span no DOM,
   anda junto, porque quem cuida disso passa a ser o navegador.
   ===================================================================== */

(function (window, document) {
  'use strict';

  var EXPORT_W = 1920;
  var EXPORT_H = 1080;

  var DEFAULT = { size: 96, width: 900, weight: 900, align: 'left',
                  color: '#ffffff', shadow: true };

  var MIN_SIZE = 16;
  var MAX_SIZE = 400;

  /* Peso: Regular, Bold, Extra Bold e Black, sempre em itálico — o
     padrão de título da casa, como o Controle/Seletor do Figma. */
  var WEIGHTS = [
    { value: 400, label: 'Regular Italic' },
    { value: 700, label: 'Bold Italic' },
    { value: 800, label: 'Extra Bold Italic' },
    { value: 900, label: 'Black Italic' }
  ];

  /* Quatro cantos escalam tudo; quatro lados mudam só a largura. */
  var CORNERS = ['nw', 'ne', 'se', 'sw'];
  var SIDES = ['n', 'e', 's', 'w'];

  function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }

  function createTexts(root, options) {
    options = options || {};
    var onChange = options.onChange || function () {};
    var otherBoxes = options.otherBoxes || function () { return []; };

    var boxes = [];
    var selected = null;
    var editing = null;
    var enabled = false;

    var snap = window.TD_SNAP.create(root);

    var container = document.createElement('div');
    container.className = 'td-texts';
    root.appendChild(container);

    /* A moldura de seleção é UMA, reaproveitada — ela segue o texto
       selecionado. Uma moldura por caixa multiplicaria nós à toa. */
    var frame = document.createElement('div');
    frame.className = 'td-textframe';
    frame.hidden = true;

    CORNERS.concat(SIDES).forEach(function (spot) {
      var handle = document.createElement('button');
      handle.type = 'button';
      handle.className = 'td-thandle td-thandle--' + spot +
        (CORNERS.indexOf(spot) >= 0 ? ' td-thandle--corner' : ' td-thandle--side');
      handle.dataset.spot = spot;
      handle.setAttribute('aria-label', CORNERS.indexOf(spot) >= 0
        ? 'Redimensionar o texto' : 'Mudar a largura da caixa');
      frame.appendChild(handle);
    });
    /* A MOLDURA FICA ATRÁS DOS TEXTOS. Por cima, a área de pegada das
       alças cobre o conteúdo e rouba o clique da própria palavra — foi o
       que aconteceu com a alça de baixo num texto de uma linha. Atrás, o
       texto sempre ganha o clique no miolo, e as alças continuam
       pegáveis porque moram na borda, quase todas para fora. */
    container.appendChild(frame);

    function factor() { return root.clientWidth / EXPORT_W; }

    function toExport(clientX, clientY) {
      var rect = root.getBoundingClientRect();
      var k = factor();
      return { x: (clientX - rect.left) / k, y: (clientY - rect.top) / k };
    }

    /* ── Criar ─────────────────────────────────────────────────────── */

    function create(exportX, exportY, options) {
      options = options || {};

      var model = {
        id: 't' + Date.now() + Math.random().toString(36).slice(2, 5),
        x: clamp(exportX, 0, EXPORT_W - 200),
        y: clamp(exportY, 0, EXPORT_H - 80),
        width: DEFAULT.width,
        size: DEFAULT.size,
        weight: DEFAULT.weight,
        align: DEFAULT.align,
        color: DEFAULT.color,
        shadow: DEFAULT.shadow
      };

      var element = document.createElement('div');
      element.className = 'td-text';
      element.dataset.id = model.id;
      element.spellcheck = false;
      element.tabIndex = 0;
      element.setAttribute('role', 'textbox');
      element.setAttribute('aria-label',
        'Texto da thumb. Enter edita, Delete apaga, setas movem.');
      element.textContent = options.content || '';

      model.element = element;
      container.appendChild(element);   /* depois da moldura: fica por cima */
      boxes.push(model);

      layout(model);
      select(model);
      if (options.edit !== false) edit(model);

      onChange();
      return model;
    }

    /* ── Desenhar ──────────────────────────────────────────────────── */

    function layout(model) {
      var k = factor();
      var s = model.element.style;
      s.transform = 'translate(' + (model.x * k) + 'px,' + (model.y * k) + 'px)';
      s.width = (model.width * k) + 'px';
      s.fontSize = (model.size * k) + 'px';
      s.fontWeight = model.weight;
      s.textAlign = model.align;
      s.color = model.color;
      /* A sombra escala junto com o texto, senão some no mobile e vira
         borrão no desktop. */
      s.textShadow = model.shadow
        ? '0 ' + (model.size * k * 0.06) + 'px ' + (model.size * k * 0.14) + 'px rgba(0,0,0,.75)'
        : 'none';

      if (model === selected) placeFrame(model);
    }

    function placeFrame(model) {
      var k = factor();
      var rect = model.element.getBoundingClientRect();
      var host = root.getBoundingClientRect();
      frame.hidden = false;
      frame.style.transform = 'translate(' + (model.x * k) + 'px,' + (model.y * k) + 'px)';
      frame.style.width = (model.width * k) + 'px';
      frame.style.height = (rect.height) + 'px';
      frame.classList.toggle('td-textframe--editing', editing === model);
    }

    function layoutAll() { boxes.forEach(layout); }

    function boxOf(model) {
      var k = factor();
      return {
        x: model.x, y: model.y,
        width: model.width,
        height: model.element.getBoundingClientRect().height / k
      };
    }

    /* Os retângulos dos textos, para as imagens poderem grudar neles. */
    function textBoxes(exceptId) {
      return boxes
        .filter(function (b) { return b.id !== exceptId; })
        .map(boxOf);
    }

    /* ── Selecionar e editar ───────────────────────────────────────── */

    function select(model) {
      model = model || null;
      /* Idempotente: render() chama setEnabled a cada desenho, e
         setEnabled desseleciona. Sem esta saída, select → onChange →
         render → setEnabled → select se chamava até estourar a pilha. */
      if (model === selected && !editing) return;

      if (selected && selected !== model) blur(selected);
      selected = model;

      boxes.forEach(function (b) {
        b.element.classList.toggle('td-text--on', b === selected);
      });

      if (selected) placeFrame(selected);
      else frame.hidden = true;

      onChange();
    }

    function edit(model) {
      if (!model) return;
      editing = model;
      model.element.contentEditable = 'true';
      model.element.classList.add('td-text--editing');
      model.element.focus();

      /* Numa caixa com conteúdo, o duplo clique entra em edição COM O
         CONTEÚDO SELECIONADO — quem entra ali quase sempre quer trocar
         o que está escrito, não emendar. */
      if (model.element.textContent.length) {
        var range = document.createRange();
        range.selectNodeContents(model.element);
        var sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
      }

      placeFrame(model);
      onChange();
    }

    function blur(model) {
      if (!model || model.element.contentEditable !== 'true') return;
      model.element.contentEditable = 'false';
      model.element.classList.remove('td-text--editing');

      /* Sai da edição, some o realce azul de seleção do navegador. Sem
         isto a palavra recém-pintada fica com a tarja azul por cima e
         parece que alguma coisa travou. */
      var live = window.getSelection();
      if (live && live.rangeCount && model.element.contains(live.anchorNode)) {
        live.removeAllRanges();
      }
      if (editing === model) editing = null;

      /* CAIXA VAZIA SE APAGA SOZINHA. Ninguém quer caixa fantasma. */
      if (!model.element.textContent.trim()) remove(model);
      else placeFrame(model);

      onChange();
    }

    function stopEditing() { if (editing) blur(editing); }

    function deselectQuiet() {
      if (editing) blur(editing);
      if (!selected) return;
      selected.element.classList.remove('td-text--on');
      selected = null;
      frame.hidden = true;
    }

    function remove(model) {
      if (!model) return;
      if (model.element.parentNode) model.element.parentNode.removeChild(model.element);
      boxes = boxes.filter(function (b) { return b !== model; });
      if (selected === model) { selected = null; frame.hidden = true; }
      if (editing === model) editing = null;
      onChange();
    }

    function deselect() { stopEditing(); select(null); }

    /* ── O destaque em amarelo ───────────────────────────────────────
       Com um trecho selecionado dentro da edição, pinta só ele. Sem
       seleção, pinta a caixa inteira.                                 */

    function paint(color) {
      if (!selected) return;

      var sel = window.getSelection();
      var inside = editing && sel.rangeCount &&
                   selected.element.contains(sel.anchorNode) && !sel.isCollapsed;

      if (!inside) {
        selected.color = color;
        layout(selected);
        onChange();
        return;
      }

      var range = sel.getRangeAt(0);
      var run = document.createElement('span');
      run.className = 'td-run';
      run.style.color = color;
      run.appendChild(range.extractContents());

      /* Um trecho pintado por cima de outro não empilha spans: o de
         fora manda, os de dentro somem. */
      Array.prototype.slice.call(run.querySelectorAll('span')).forEach(unwrap);
      range.insertNode(run);

      var after = document.createRange();
      after.selectNodeContents(run);
      sel.removeAllRanges();
      sel.addRange(after);

      onChange();
    }

    function unwrap(span) {
      var parent = span.parentNode;
      while (span.firstChild) parent.insertBefore(span.firstChild, span);
      parent.removeChild(span);
    }

    /* ── Gestos ──────────────────────────────────────────────────────── */

    var dragging = null;
    var sizing = null;

    function boxFrom(target) {
      var element = target && target.closest && target.closest('.td-text');
      if (!element) return null;
      return boxes.filter(function (b) { return b.element === element; })[0] || null;
    }

    container.addEventListener('pointerdown', function (event) {
      if (!enabled) return;

      var spot = event.target.dataset && event.target.dataset.spot;
      if (spot && selected) {
        event.stopPropagation();
        event.preventDefault();
        sizing = {
          spot: spot,
          start: toExport(event.clientX, event.clientY),
          model: { x: selected.x, y: selected.y, width: selected.width, size: selected.size }
        };
        try { event.target.setPointerCapture(event.pointerId); } catch (e) {}
        return;
      }

      var box = boxFrom(event.target);
      if (!box) return;

      event.stopPropagation();
      select(box);

      /* Em edição o ponteiro é do cursor de texto, não do arraste —
         senão não dá para selecionar uma palavra. */
      if (editing === box) return;

      var point = toExport(event.clientX, event.clientY);
      dragging = { model: box, grabX: point.x - box.x, grabY: point.y - box.y };
      box.element.classList.add('td-text--moving');
      try { box.element.setPointerCapture(event.pointerId); } catch (e) {}
    });

    container.addEventListener('pointermove', function (event) {
      if (sizing && selected) { resize(event); return; }
      if (!dragging) return;

      var point = toExport(event.clientX, event.clientY);
      var model = dragging.model;
      model.x = point.x - dragging.grabX;
      model.y = point.y - dragging.grabY;

      /* AS RÉGUAS MAGNÉTICAS. O alvo é qualquer outro texto, qualquer
         imagem, e o próprio quadro. */
      var result = snap.solve(boxOf(model), textBoxes(model.id).concat(otherBoxes()));
      model.x += result.dx;
      model.y += result.dy;
      snap.draw(result.lines);

      layout(model);
      onChange();
    });

    function endGesture() {
      if (dragging) dragging.model.element.classList.remove('td-text--moving');
      dragging = null;
      sizing = null;
      snap.clear();
    }

    container.addEventListener('pointerup', endGesture);
    container.addEventListener('pointercancel', endGesture);

    /* CANTO escala o texto inteiro; LADO muda só a largura da caixa.
       Essa separação é o que torna o gesto previsível: quem quer texto
       maior puxa o canto, quem quer a linha quebrando noutro lugar puxa
       o lado. */
    function resize(event) {
      var start = sizing.model;
      var point = toExport(event.clientX, event.clientY);
      var movedX = point.x - sizing.start.x;
      var movedY = point.y - sizing.start.y;
      var spot = sizing.spot;

      var west = spot === 'nw' || spot === 'sw' || spot === 'w';
      var north = spot === 'nw' || spot === 'ne' || spot === 'n';

      if (spot === 'e' || spot === 'w') {
        var width = clamp(west ? start.width - movedX : start.width + movedX, 120, EXPORT_W * 1.5);
        selected.width = width;
        if (west) selected.x = start.x + (start.width - width);

      } else if (spot === 'n' || spot === 's') {
        /* Puxar topo ou base de uma caixa de texto muda o corpo da
           fonte: é o que a pessoa espera ao esticar o texto no eixo
           vertical, e evita a deformação de esticar a letra. */
        var byHeight = clamp(start.size + (north ? -movedY : movedY) * 0.6, MIN_SIZE, MAX_SIZE);
        selected.size = byHeight;

      } else {
        var w2 = clamp(west ? start.width - movedX : start.width + movedX, 120, EXPORT_W * 1.5);
        var ratio = w2 / start.width;
        selected.width = w2;
        selected.size = clamp(start.size * ratio, MIN_SIZE, MAX_SIZE);
        if (west) selected.x = start.x + (start.width - w2);
        if (north) selected.y = start.y + (start.size - selected.size) * 0.5;
      }

      layout(selected);
      onChange();
    }

    /* Foco por teclado seleciona, Enter edita — o par do clique e do
       duplo clique, para quem não usa ponteiro. */
    container.addEventListener('focusin', function (event) {
      if (!enabled) return;
      var box = boxFrom(event.target);
      if (box && box !== selected) select(box);
    });

    container.addEventListener('dblclick', function (event) {
      if (!enabled) return;
      var box = boxFrom(event.target);
      if (!box) return;
      event.stopPropagation();
      select(box);
      edit(box);
    });

    document.addEventListener('keydown', function (event) {
      if (!enabled || !selected) return;

      if (editing) {
        if (event.key === 'Escape') { event.preventDefault(); stopEditing(); }
        return;
      }

      var live = document.activeElement;
      if (live && (live.tagName === 'INPUT' || live.tagName === 'TEXTAREA' ||
                   live.tagName === 'SELECT')) return;

      if (event.key === 'Enter') { event.preventDefault(); edit(selected); return; }
      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault(); remove(selected); return;
      }
      if (event.key === 'Escape') { event.preventDefault(); deselect(); return; }

      var step = event.shiftKey ? 10 : 1;
      if (event.key === 'ArrowLeft') { event.preventDefault(); selected.x -= step; }
      else if (event.key === 'ArrowRight') { event.preventDefault(); selected.x += step; }
      else if (event.key === 'ArrowUp') { event.preventDefault(); selected.y -= step; }
      else if (event.key === 'ArrowDown') { event.preventDefault(); selected.y += step; }
      else return;

      layout(selected);
      onChange();
    });

    /* ── Serializar, para o export ──────────────────────────────────── */

    function segmentsOf(model) {
      var segments = [];
      (function walk(node, inherited) {
        Array.prototype.slice.call(node.childNodes).forEach(function (child) {
          if (child.nodeType === 3) {
            if (child.nodeValue) segments.push({ text: child.nodeValue, color: inherited });
          } else if (child.nodeName === 'BR') {
            segments.push({ text: '\n', color: inherited });
          } else {
            walk(child, (child.style && child.style.color) || inherited);
          }
        });
      })(model.element, model.color);
      return segments;
    }

    function serialize() {
      return boxes.map(function (m) {
        return { x: m.x, y: m.y, width: m.width, size: m.size, weight: m.weight,
                 align: m.align, color: m.color, shadow: m.shadow,
                 segments: segmentsOf(m) };
      });
    }

    function setEnabled(next) {
      if (enabled === next) return;
      enabled = next;
      container.classList.toggle('td-texts--live', next);
      if (!next) deselectQuiet();
    }

    window.addEventListener('resize', layoutAll);

    return {
      create: create, remove: remove, select: select, edit: edit,
      deselect: deselect, stopEditing: stopEditing, paint: paint,
      serialize: serialize, setEnabled: setEnabled, layoutAll: layoutAll,
      boxes: textBoxes,
      count: function () { return boxes.length; },
      selected: function () { return selected; },
      isEditing: function () { return !!editing; },
      /* O texto puro da caixa selecionada, para o campo do painel. */
      plain: function () { return selected ? selected.element.textContent : ''; },
      setPlain: function (value) {
        if (!selected) return;
        selected.element.textContent = value;
        layout(selected);
        onChange();
      },
      update: function (changes) {
        if (!selected) return;
        Object.keys(changes).forEach(function (k) { selected[k] = changes[k]; });
        layout(selected);
        onChange();
      },
      nudgeSize: function (delta) {
        if (!selected) return;
        selected.size = clamp(selected.size + delta, MIN_SIZE, MAX_SIZE);
        layout(selected);
        onChange();
      },
      WEIGHTS: WEIGHTS, MIN_SIZE: MIN_SIZE, MAX_SIZE: MAX_SIZE
    };
  }

  window.TD_TEXT = { create: createTexts };

})(window, document);
