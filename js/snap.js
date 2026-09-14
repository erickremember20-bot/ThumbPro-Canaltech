/* =====================================================================
   ThumbDrop V3 · snap.js
   ---------------------------------------------------------------------
   As réguas magnéticas — o comportamento do Figma, do Photoshop e do
   Canva: quando o que você arrasta encosta no alinhamento de outra
   coisa, ele gruda e uma linha aparece mostrando por quê.

   Um motor só, usado pelas imagens e pelos textos, porque um texto tem
   que poder grudar na borda de uma imagem e vice-versa. Se fossem dois
   motores, eles discordariam.

   Tudo em pixels de export.
   ===================================================================== */

(function (window, document) {
  'use strict';

  var EXPORT_W = 1920;
  var EXPORT_H = 1080;

  /* Distância, em pixels de export, dentro da qual o arraste gruda. É
     convertida da tela: 8px de tela em qualquer zoom, para a sensação
     ser a mesma no desktop e no celular. */
  var GRAB_SCREEN_PX = 8;

  function createSnap(root) {
    var layer = document.createElement('div');
    layer.className = 'td-guides';
    root.appendChild(layer);

    function factor() { return root.clientWidth / EXPORT_W; }
    function threshold() { return GRAB_SCREEN_PX / factor(); }

    /* Os alvos são sempre os MESMOS seis de um retângulo: três no eixo X
       (esquerda, centro, direita) e três no Y (topo, meio, base). É o que
       as ferramentas de verdade fazem, e é o que a pessoa espera. */
    function edgesOf(box) {
      return {
        x: [box.x, box.x + box.width / 2, box.x + box.width],
        y: [box.y, box.y + box.height / 2, box.y + box.height]
      };
    }

    /* O próprio canvas é alvo: centro e bordas. Alinhar ao centro do
       quadro é o alinhamento mais pedido de todos. */
    function canvasTargets() {
      return {
        x: [0, EXPORT_W / 2, EXPORT_W],
        y: [0, EXPORT_H / 2, EXPORT_H]
      };
    }

    /* Recebe o retângulo que está sendo arrastado e os retângulos
       vizinhos. Devolve o deslocamento que faz ele grudar, e as linhas a
       desenhar. */
    function solve(moving, others) {
      var limit = threshold();
      var mine = edgesOf(moving);

      var best = { x: null, y: null };
      var lines = [];

      function consider(axis, myValue, targetValue, from, to) {
        var distance = Math.abs(myValue - targetValue);
        if (distance > limit) return;
        var current = best[axis];
        if (current && current.distance <= distance) return;
        best[axis] = {
          distance: distance,
          delta: targetValue - myValue,
          at: targetValue,
          from: from,
          to: to
        };
      }

      var targets = [canvasTargets()].concat(others.map(edgesOf));

      targets.forEach(function (target, index) {
        var box = index === 0 ? null : others[index - 1];

        target.x.forEach(function (value) {
          mine.x.forEach(function (value2) {
            consider('x', value2, value,
              box ? Math.min(box.y, moving.y) : 0,
              box ? Math.max(box.y + box.height, moving.y + moving.height) : EXPORT_H);
          });
        });

        target.y.forEach(function (value) {
          mine.y.forEach(function (value2) {
            consider('y', value2, value,
              box ? Math.min(box.x, moving.x) : 0,
              box ? Math.max(box.x + box.width, moving.x + moving.width) : EXPORT_W);
          });
        });
      });

      if (best.x) lines.push({ axis: 'x', at: best.x.at, from: best.x.from, to: best.x.to });
      if (best.y) lines.push({ axis: 'y', at: best.y.at, from: best.y.from, to: best.y.to });

      return {
        dx: best.x ? best.x.delta : 0,
        dy: best.y ? best.y.delta : 0,
        lines: lines
      };
    }

    /* As linhas só existem durante o gesto. Guia que fica na tela depois
       de soltar vira sujeira. */
    function draw(lines) {
      layer.textContent = '';
      var k = factor();

      lines.forEach(function (line) {
        var element = document.createElement('div');
        element.className = 'td-guide td-guide--' + line.axis;

        if (line.axis === 'x') {
          element.style.left = (line.at * k) + 'px';
          element.style.top = (Math.min(line.from, line.to) * k) + 'px';
          element.style.height = (Math.abs(line.to - line.from) * k) + 'px';
        } else {
          element.style.top = (line.at * k) + 'px';
          element.style.left = (Math.min(line.from, line.to) * k) + 'px';
          element.style.width = (Math.abs(line.to - line.from) * k) + 'px';
        }

        layer.appendChild(element);
      });
    }

    function clear() { layer.textContent = ''; }

    return { solve: solve, draw: draw, clear: clear, threshold: threshold };
  }

  window.TD_SNAP = { create: createSnap, EXPORT_W: EXPORT_W, EXPORT_H: EXPORT_H };

})(window, document);
