/* =====================================================================
   ThumbDrop V3 · ai.js
   ---------------------------------------------------------------------
   As duas chamadas que custam dinheiro: PhotoRoom (recorte) e Gemini
   (filtros). Este arquivo não conhece nenhuma chave — ele pede a chave
   ao config.js no momento da chamada e não a guarda.

   Toda função aqui devolve uma promessa que ou resolve com o resultado,
   ou rejeita com um erro que tem `kind`. O `kind` é o que permite à
   interface dizer o que aconteceu de verdade em vez de "deu erro":

     'auth'      a chave foi recusada — 401 ou 403
     'quota'     a cota acabou — 402
     'cors'      o navegador bloqueou a chamada direta
     'network'   não houve resposta
     'service'   o serviço respondeu com erro
     'empty'     respondeu, mas sem imagem
   ===================================================================== */

(function (window, document) {
  'use strict';

  var PHOTOROOM_ENDPOINT = 'https://sdk.photoroom.com/v1/segment';

  function fail(kind, message) {
    var error = new Error(message);
    error.kind = kind;
    return error;
  }

  /* ── Conversões ─────────────────────────────────────────────────────── */

  function dataUrlToBlob(dataUrl) {
    return fetch(dataUrl).then(function (response) { return response.blob(); });
  }

  function blobToDataUrl(blob) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () { resolve(reader.result); };
      reader.onerror = function () { reject(fail('service', 'Não consegui ler a imagem devolvida.')); };
      reader.readAsDataURL(blob);
    });
  }

  function measure(dataUrl) {
    return new Promise(function (resolve, reject) {
      var probe = new Image();
      probe.onload = function () {
        resolve({ src: dataUrl, width: probe.naturalWidth, height: probe.naturalHeight });
      };
      probe.onerror = function () { reject(fail('service', 'A imagem devolvida não abriu.')); };
      probe.src = dataUrl;
    });
  }

  /* ── PhotoRoom · remoção de fundo ─────────────────────────────────────
     1 ✦ · US$ 0,020 por chamada.

     Sobre o CORS: a PhotoRoom não devolve cabeçalho de origem cruzada
     para chamada de navegador. Com a URL do proxy preenchida, a chamada
     vai por ele e a chave nem sai daqui — quem a injeta é o worker.
     Sem proxy, tentamos direto e o navegador provavelmente bloqueia. O
     erro 'cors' existe para a interface poder explicar isso em vez de
     deixar a pessoa achando que a chave está errada.                     */

  function removeBackground(dataUrl, signal) {
    var proxy = window.TD_CONFIG.get('proxy');
    var apiKey = window.TD_CONFIG.get('photoroom');

    if (!proxy && !apiKey) {
      return Promise.reject(fail('auth', 'Falta a chave da PhotoRoom.'));
    }

    return dataUrlToBlob(dataUrl).then(function (blob) {
      var body = new FormData();
      body.append('image_file', blob, 'thumbdrop.png');
      body.append('format', 'png');

      var request = { method: 'POST', body: body, signal: signal };

      /* Com proxy, a chave fica no worker e não viaja no cabeçalho. */
      if (!proxy) request.headers = { 'x-api-key': apiKey };

      return fetch(proxy || PHOTOROOM_ENDPOINT, request).catch(function (error) {
        if (error && error.name === 'AbortError') throw error;
        /* fetch só rejeita antes de haver resposta: CORS, DNS, offline.
           Sem proxy, CORS é de longe a causa mais provável — e é a que
           tem conserto conhecido. */
        throw fail(proxy ? 'network' : 'cors',
          proxy ? 'Não consegui falar com o proxy.'
                : 'O navegador bloqueou a chamada direta à PhotoRoom.');
      });
    }).then(function (response) {
      if (response.status === 401 || response.status === 403) {
        throw fail('auth', 'A PhotoRoom recusou a chave.');
      }
      if (response.status === 402) {
        throw fail('quota', 'A cota da chave da PhotoRoom acabou.');
      }
      if (!response.ok) {
        throw fail('service', 'A PhotoRoom respondeu HTTP ' + response.status + '.');
      }
      return response.blob();
    }).then(function (blob) {
      if (!blob || blob.size === 0) throw fail('empty', 'A PhotoRoom devolveu uma imagem vazia.');
      return blobToDataUrl(blob);
    }).then(measure);
  }

  window.TD_AI = {
    removeBackground: removeBackground
  };

})(window, document);
