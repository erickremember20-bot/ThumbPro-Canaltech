/* =====================================================================
   ThumbDrop V3 · config.js
   ---------------------------------------------------------------------
   ESTE ARQUIVO SÓ LÊ. Ele não escreve no localStorage, não guarda chave
   em variável de módulo e não tem uma única chave escrita nele — nem
   como constante, nem como fallback, nem como exemplo comentado.

   Se este arquivo for commitado, e ele é, nada vaza.

   Quem escreve as chaves é a tela de configuração, em app.js, porque
   quem escreve é quem tem o formulário na mão. A separação é de
   propósito: existe um lugar só no projeto que chama setItem com uma
   chave, e ele está à vista.
   ===================================================================== */

(function (window) {
  'use strict';

  /* Os nomes das entradas no localStorage. São nomes de gaveta, não
     valores — não há segredo nenhum aqui. */
  var STORAGE_KEYS = {
    google:   'thumbdrop.google_ai_key',
    photoroom:'thumbdrop.photoroom_key',
    proxy:    'thumbdrop.photoroom_proxy_url'
  };

  /* O que cada chave faz e como a pessoa consegue uma. Isso alimenta a
     tela de configuração — é texto de interface, fica junto da definição
     para não haver dois lugares a atualizar. */
  var FIELDS = [
    {
      id: 'google',
      label: 'Chave do Google AI',
      hint: 'Gera os seis filtros de direção de arte.',
      where: 'aistudio.google.com/apikey',
      required: true,
      placeholder: 'AIza…'
    },
    {
      id: 'photoroom',
      label: 'Chave da PhotoRoom',
      hint: 'Remove o fundo da foto.',
      where: 'app.photoroom.com/api-dashboard',
      required: true,
      placeholder: 'sk_pr_… ou sandbox_sk_pr_…'
    },
    {
      id: 'proxy',
      label: 'URL do proxy da PhotoRoom',
      hint: 'Opcional. Sem ele o navegador bloqueia o recorte por CORS — ' +
            'tudo o mais funciona. Veja o README para o worker de 20 linhas.',
      where: null,
      required: false,
      placeholder: 'https://seu-worker.workers.dev'
    }
  ];

  /* localStorage pode lançar: navegação privada, site data bloqueado,
     iframe sem permissão. Nunca deixe isso derrubar o editor. */
  function readRaw(name) {
    try {
      return window.localStorage.getItem(name) || '';
    } catch (e) {
      return '';
    }
  }

  function get(id) {
    var name = STORAGE_KEYS[id];
    return name ? readRaw(name).trim() : '';
  }

  function has(id) {
    return get(id) !== '';
  }

  /* Quais chaves obrigatórias estão faltando. Lista vazia = pode entrar
     no editor. É isso que decide se a tela de configuração abre. */
  function missing() {
    return FIELDS.filter(function (f) {
      return f.required && !has(f.id);
    }).map(function (f) {
      return f.id;
    });
  }

  function isConfigured() {
    return missing().length === 0;
  }

  /* Verdadeiro quando o navegador não vai conseguir guardar nada — vale
     avisar a pessoa antes dela digitar duas chaves à toa. */
  function storageBlocked() {
    try {
      var probe = '__thumbdrop_probe__';
      window.localStorage.setItem(probe, '1');
      window.localStorage.removeItem(probe);
      return false;
    } catch (e) {
      return true;
    }
  }

  window.TD_CONFIG = {
    STORAGE_KEYS: STORAGE_KEYS,
    FIELDS: FIELDS,
    get: get,
    has: has,
    missing: missing,
    isConfigured: isConfigured,
    storageBlocked: storageBlocked
  };

})(window);
