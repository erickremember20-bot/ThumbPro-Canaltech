/* =====================================================================
   ThumbDrop V3 · text.js
   ---------------------------------------------------------------------
   As caixas de texto da parada 3.

   O gesto principal não tem botão: DUPLO CLIQUE em qualquer ponto vazio
   do canvas cria uma caixa ali e já entra em edição, com o cursor
   piscando. Existe um botão de "adicionar texto" no painel, mas ele é a
   porta de serviço — para quem não descobriu o gesto, e para quem navega
   por teclado.

   O DESTAQUE EM AMARELO É GESTO DE SELEÇÃO, não controle separado:
   selecionar uma palavra dentro da edição e clicar no amarelo pinta só
   ela. É a assinatura visual das thumbs da casa.

   Por que contentEditable e não índices de caractere: o destaque precisa
   sobreviver à edição. Se a pessoa pinta a terceira palavra e depois
   insere uma palavra antes dela, um destaque guardado por índice
   escorrega para o lugar errado. Guardado como span no DOM, ele anda
   junto com o texto, porque é o próprio navegador que cuida disso.
   ===================================================================== */

(function (window, document) {
  'use strict';

  var EXPORT_W = 1920;
  var EXPORT_H = 1080;

  /* Padrão do título: Barlow Black Italic. */
  var DEFAULT = {
    size: 108,          /* px de export */
    width: 1150,
    weight: 900,
    align: 'left',
    color: '#ffffff',
    shadow: true
  };

  var WEIGHTS = [
    { value: 400, label: 'Regular' },
    { value: 700, label: 'Bold' },
    { value: 800, label: 'Extra Bold' },
    { value: 900, label: 'Black' }
  ];

  function clamp(value, low, high) {
    return Math.min(high, Math.max(low, value));
  }

  function createTexts(root, options) {
    options = options || {};
    var onChange = options.onChange || function () {};

    var boxes = [];
    var selected = null;
    var editing = null;
    var enabled = false;

    var container = document.createElement('div');
    container.className = 'td-texts';
    root.appendChild(container);

    function factor() { return root.clientWidth / EXPORT_W; }

    /* ── Criar ─────────────────────────────────────────────────────── */

    function create(exportX, exportY, options) {
      options = options || {};

      var model = {
        id: 't' + Date.now() + Math.random().toString(36).slice(2, 6),
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
      /* Alcançável por Tab: sem isto, quem navega por teclado consegue
         criar um texto pelo painel e nunca mais voltar a ele. */
      element.tabIndex = 0;
      element.setAttribute('role', 'textbox');
      element.setAttribute('aria-label', 'Caixa de texto da thumb. ' +
        'Enter edita, Delete apaga, setas movem.');
      element.textContent = options.content || '';

      model.element = element;
      container.appendChild(element);
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
      var style = model.element.style;

      style.transform = 'translate(' + (model.x * k) + 'px,' + (model.y * k) + 'px)';
      style.width = (model.width * k) + 'px';
      style.fontSize = (model.size * k) + 'px';
      style.fontWeight = model.weight;
      style.textAlign = model.align;
      style.color = model.color;
      /* A sombra escala junto com o texto, senão ela some no mobile e
         vira borrão no desktop. */
      style.textShadow = model.shadow
        ? '0 ' + (model.size * k * 0.06) + 'px ' + (model.size * k * 0.14) + 'px rgba(0,0,0,.75)'
        : 'none';
    }

    function layoutAll() {
      boxes.forEach(layout);
    }

    /* ── Selecionar e editar ───────────────────────────────────────── */

    function select(model) {
      model = model || null;
      /* Idempotente de propósito: render() chama setEnabled() a cada
         desenho, e setEnabled desseleciona. Sem esta saída, o par
         select → onChange → render → setEnabled → select se chamava até
         estourar a pilha. Operação que não muda nada não avisa ninguém. */
      if (model === selected && !editing) return;

      /* Clicar num texto seleciona ele e DESSELECIONA os outros. */
      if (selected && selected !== model) blur(selected);
      selected = model;

      boxes.forEach(function (box) {
        box.element.classList.toggle('td-text--on', box === selected);
      });

      onChange();
    }

    function edit(model) {
      if (!model) return;
      editing = model;
      model.element.contentEditable = 'true';
      model.element.classList.add('td-text--editing');
      model.element.focus();

      /* Numa caixa que já tem conteúdo, o duplo clique entra em edição
         COM O CONTEÚDO SELECIONADO — quem entra ali quase sempre quer
         trocar o que está escrito, não emendar. */
      if (model.element.textContent.length) {
        var range = document.createRange();
        range.selectNodeContents(model.element);
        var selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
      }

      onChange();
    }

    function blur(model) {
      if (!model || model.element.contentEditable !== 'true') return;
      model.element.contentEditable = 'false';
      model.element.classList.remove('td-text--editing');
      if (editing === model) editing = null;

      /* CAIXA VAZIA SE APAGA SOZINHA. Ninguém quer caixa fantasma. */
      if (!model.element.textContent.trim()) remove(model);

      onChange();
    }

    function stopEditing() {
      if (editing) blur(editing);
    }

    function deselectQuiet() {
      if (editing) blur(editing);
      if (!selected) return;
      selected.element.classList.remove('td-text--on');
      selected = null;
    }

    function remove(model) {
      if (!model) return;
      if (model.element.parentNode) model.element.parentNode.removeChild(model.element);
      boxes = boxes.filter(function (box) { return box !== model; });
      if (selected === model) selected = null;
      if (editing === model) editing = null;
      onChange();
    }

    function deselect() {
      stopEditing();
      select(null);
    }

    /* ── O destaque em amarelo ───────────────────────────────────────────
       Gesto de seleção: com um trecho selecionado dentro da edição,
       pinta só aquele trecho. Sem seleção, pinta a caixa inteira.        */

    function paint(color) {
      if (!selected) return;

      var selection = window.getSelection();
      var inside = editing && selection.rangeCount &&
                   selected.element.contains(selection.anchorNode) &&
                   !selection.isCollapsed;

      if (!inside) {
        /* Sem trecho selecionado: a cor é da caixa. Os destaques que já
           existem dentro dela continuam valendo — é isso que faz um
           título branco com uma palavra amarela continuar possível. */
        selected.color = color;
        layout(selected);
        onChange();
        return;
      }

      var range = selection.getRangeAt(0);
      var run = document.createElement('span');
      run.className = 'td-run';
      run.style.color = color;
      run.appendChild(range.extractContents());

      /* Um trecho pintado por cima de outro não deve empilhar spans: o
         de fora manda, os de dentro somem. */
      Array.prototype.slice.call(run.querySelectorAll('span')).forEach(unwrap);

      range.insertNode(run);

      /* A seleção continua onde estava, para a pessoa poder repintar sem
         ter que selecionar de novo. */
      var after = document.createRange();
      after.selectNodeContents(run);
      selection.removeAllRanges();
      selection.addRange(after);

      onChange();
    }

    function unwrap(span) {
      var parent = span.parentNode;
      while (span.firstChild) parent.insertBefore(span.firstChild, span);
      parent.removeChild(span);
    }

    /* ── Gestos ──────────────────────────────────────────────────────── */

    var dragging = null;
    var resizing = null;

    function toExport(clientX, clientY) {
      var rect = root.getBoundingClientRect();
      var k = factor();
      return { x: (clientX - rect.left) / k, y: (clientY - rect.top) / k };
    }

    function boxFrom(target) {
      var element = target && target.closest && target.closest('.td-text');
      if (!element) return null;
      return boxes.filter(function (box) { return box.element === element; })[0] || null;
    }

    container.addEventListener('pointerdown', function (event) {
      if (!enabled) return;

      var handle = event.target.dataset && event.target.dataset.textCorner;
      if (handle && selected) {
        event.stopPropagation();
        resizing = {
          corner: handle,
          start: toExport(event.clientX, event.clientY),
          startModel: { x: selected.x, y: selected.y, width: selected.width, size: selected.size }
        };
        try { event.target.setPointerCapture(event.pointerId); } catch (e) {}
        return;
      }

      var box = boxFrom(event.target);
      if (!box) return;

      event.stopPropagation();
      select(box);

      /* Em modo de edição o ponteiro é do cursor de texto, não do
         arraste — senão não dá para selecionar uma palavra. */
      if (editing === box) return;

      var point = toExport(event.clientX, event.clientY);
      dragging = { model: box, grabX: point.x - box.x, grabY: point.y - box.y };
      box.element.classList.add('td-text--moving');
      try { box.element.setPointerCapture(event.pointerId); } catch (e) {}
    });

    container.addEventListener('pointermove', function (event) {
      if (resizing && selected) {
        var point = toExport(event.clientX, event.clientY);
        var start = resizing.startModel;
        var movedX = point.x - resizing.start.x;

        /* A alça escala a caixa inteira, mantendo a proporção entre
           largura e corpo da fonte. Texto esticado num eixo só deforma a
           letra, e isso nunca é o que a pessoa queria — por isso não há
           Shift aqui. */
        var west = resizing.corner === 'nw' || resizing.corner === 'sw';
        var width = clamp(west ? start.width - movedX : start.width + movedX, 120, EXPORT_W * 1.5);
        var ratio = width / start.width;

        selected.width = width;
        selected.size = clamp(start.size * ratio, 16, 400);
        if (west) selected.x = start.x + (start.width - width);

        layout(selected);
        onChange();
        return;
      }

      if (!dragging) return;
      var spot = toExport(event.clientX, event.clientY);
      dragging.model.x = clamp(spot.x - dragging.grabX, -dragging.model.width * 0.5, EXPORT_W - 40);
      dragging.model.y = clamp(spot.y - dragging.grabY, -dragging.model.size, EXPORT_H - 20);
      layout(dragging.model);
      onChange();
    });

    function endGesture() {
      if (dragging) dragging.model.element.classList.remove('td-text--moving');
      dragging = null;
      resizing = null;
    }

    container.addEventListener('pointerup', endGesture);
    container.addEventListener('pointercancel', endGesture);

    /* Foco por teclado seleciona, Enter entra em edição — o par do
       clique e do duplo clique, para quem não usa ponteiro. */
    container.addEventListener('focusin', function (event) {
      if (!enabled) return;
      var box = boxFrom(event.target);
      if (box && box !== selected) select(box);
    });

    container.addEventListener('keydown', function (event) {
      if (!enabled || editing) return;
      if (event.key !== 'Enter') return;
      var box = boxFrom(event.target);
      if (!box) return;
      event.preventDefault();
      edit(box);
    });

    /* Duplo clique num texto existente entra em edição daquele texto. */
    container.addEventListener('dblclick', function (event) {
      if (!enabled) return;
      var box = boxFrom(event.target);
      if (!box) return;
      event.stopPropagation();
      select(box);
      edit(box);
    });

    /* ── Teclado ─────────────────────────────────────────────────────── */

    document.addEventListener('keydown', function (event) {
      if (!enabled || !selected) return;

      /* Dentro da edição, Delete e Backspace são do texto. */
      if (editing) {
        if (event.key === 'Escape') {
          event.preventDefault();
          stopEditing();
        }
        return;
      }

      var active = document.activeElement;
      if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) return;

      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault();
        remove(selected);
        return;
      }

      if (event.key === 'Escape') {
        event.preventDefault();
        deselect();
        return;
      }

      /* Setas movem o texto: 1px de export por toque, 10 com Shift. */
      var step = event.shiftKey ? 10 : 1;
      if (event.key === 'ArrowLeft')  { event.preventDefault(); selected.x -= step; }
      else if (event.key === 'ArrowRight') { event.preventDefault(); selected.x += step; }
      else if (event.key === 'ArrowUp')    { event.preventDefault(); selected.y -= step; }
      else if (event.key === 'ArrowDown')  { event.preventDefault(); selected.y += step; }
      else return;

      layout(selected);
      onChange();
    });

    /* ── Serializar, para o export ───────────────────────────────────────
       Cada caixa vira uma lista de trechos com a cor de cada um. É o que
       o renderizador do canvas consome — o mesmo, para o que sai no PNG
       ser o que está na tela.                                            */

    function segmentsOf(model) {
      var segments = [];

      (function walk(node, inherited) {
        Array.prototype.slice.call(node.childNodes).forEach(function (child) {
          if (child.nodeType === 3) {
            if (child.nodeValue) segments.push({ text: child.nodeValue, color: inherited });
          } else if (child.nodeName === 'BR') {
            segments.push({ text: '\n', color: inherited });
          } else {
            var color = (child.style && child.style.color) || inherited;
            walk(child, color);
          }
        });
      })(model.element, model.color);

      return segments;
    }

    function serialize() {
      return boxes.map(function (model) {
        return {
          x: model.x, y: model.y,
          width: model.width, size: model.size,
          weight: model.weight, align: model.align,
          color: model.color, shadow: model.shadow,
          segments: segmentsOf(model)
        };
      });
    }

    /* ── Estado ──────────────────────────────────────────────────────── */

    function setEnabled(next) {
      if (enabled === next) return;
      enabled = next;
      container.hidden = !next && boxes.length === 0;
      container.classList.toggle('td-texts--live', next);
      if (!next) deselectQuiet();
    }

    window.addEventListener('resize', layoutAll);

    return {
      create: create,
      remove: remove,
      select: select,
      edit: edit,
      deselect: deselect,
      stopEditing: stopEditing,
      paint: paint,
      serialize: serialize,
      setEnabled: setEnabled,
      layoutAll: layoutAll,
      count: function () { return boxes.length; },
      selected: function () { return selected; },
      isEditing: function () { return !!editing; },
      update: function (changes) {
        if (!selected) return;
        Object.keys(changes).forEach(function (key) { selected[key] = changes[key]; });
        layout(selected);
        onChange();
      },
      WEIGHTS: WEIGHTS,
      DEFAULT: DEFAULT
    };
  }

  window.TD_TEXT = { create: createTexts };

})(window, document);
