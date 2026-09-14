/* =====================================================================
   ThumbDrop V3 · app.js
   ---------------------------------------------------------------------
   Estado, trilha das quatro paradas e créditos (etapa 3 em diante).
   Por ora: a tela de configuração das chaves.

   ESTE É O ÚNICO ARQUIVO DO PROJETO QUE ESCREVE UMA CHAVE NO
   localStorage, e a escrita está numa função só, logo abaixo. Nenhuma
   chave aparece escrita em lugar nenhum — elas só existem no que a
   pessoa digitou.
   ===================================================================== */

(function (window, document) {
  'use strict';

  var CFG = window.TD_CONFIG;

  var setup       = document.getElementById('setup');
  var form        = document.getElementById('setup-form');
  var saveButton  = document.getElementById('setup-save');
  var clearButton = document.getElementById('setup-clear');
  var statusLine  = document.getElementById('setup-status');
  var eyebrow     = document.getElementById('setup-eyebrow');
  var title       = document.getElementById('setup-title');
  var lede        = document.getElementById('setup-lede');
  var app         = document.getElementById('app');
  var openSetup   = document.getElementById('open-setup');

  /* Para onde o foco volta quando a tela fecha. Sem isso, quem navega por
     teclado cai no começo do documento e se perde. */
  var focusOnClose = null;

  /* ── A única escrita de chave do projeto ───────────────────────────── */

  function persist(id, value) {
    var name = CFG.STORAGE_KEYS[id];
    if (!name) return false;
    try {
      if (value) window.localStorage.setItem(name, value);
      else window.localStorage.removeItem(name);
      return true;
    } catch (e) {
      return false;
    }
  }

  function clearAll() {
    Object.keys(CFG.STORAGE_KEYS).forEach(function (id) { persist(id, ''); });
  }

  /* ── Montagem dos campos ───────────────────────────────────────────── */

  function buildFields() {
    form.textContent = '';

    CFG.FIELDS.forEach(function (field) {
      var wrap = document.createElement('div');
      wrap.className = 'td-field';
      wrap.dataset.field = field.id;

      var inputId = 'setup-' + field.id;
      var hintId  = inputId + '-hint';
      var errId   = inputId + '-error';

      var label = document.createElement('label');
      label.className = 'td-field__label';
      label.htmlFor = inputId;
      label.textContent = field.label;
      if (!field.required) {
        var opt = document.createElement('span');
        opt.className = 'td-field__optional';
        opt.textContent = 'opcional';
        label.appendChild(opt);
      }

      var hint = document.createElement('p');
      hint.className = 'td-field__hint';
      hint.id = hintId;
      hint.textContent = field.where
        ? field.hint + ' Você pega a sua em ' + field.where + '.'
        : field.hint;

      var input = document.createElement('input');
      input.id = inputId;
      input.name = field.id;
      input.type = 'text';
      input.placeholder = field.placeholder;
      input.autocomplete = 'off';
      input.spellcheck = false;
      input.setAttribute('aria-describedby', hintId);
      input.value = CFG.get(field.id);

      var error = document.createElement('p');
      error.className = 'td-field__error';
      error.id = errId;

      /* Digitar limpa o estado de erro: o vermelho descreve a chave que o
         servidor recusou, não a que está sendo escrita agora. */
      input.addEventListener('input', function () {
        wrap.classList.remove('td-field--invalid');
        error.textContent = '';
        input.removeAttribute('aria-invalid');
        refreshSaveButton();
      });

      wrap.appendChild(label);
      wrap.appendChild(hint);
      wrap.appendChild(input);
      wrap.appendChild(error);
      form.appendChild(wrap);
    });
  }

  function inputFor(id) {
    return document.getElementById('setup-' + id);
  }

  function currentValue(id) {
    var input = inputFor(id);
    return input ? input.value.trim() : '';
  }

  /* Minúscula só na primeira letra. label.toLowerCase() inteiro comeria o
     nome da marca e escrevia "chave da photoroom", que parece descuido. */
  function descapitalize(text) {
    return text.charAt(0).toLowerCase() + text.slice(1);
  }

  /* Saldo insuficiente de informação é a mesma ideia do saldo insuficiente
     de crédito: o botão fica desabilitado COM O MOTIVO VISÍVEL, nunca
     desabilitado e mudo. */
  function refreshSaveButton() {
    var faltando = CFG.FIELDS.filter(function (f) {
      return f.required && !currentValue(f.id);
    });

    saveButton.disabled = faltando.length > 0;
    saveButton.textContent = faltando.length === 0
      ? 'Salvar e abrir o editor'
      : (faltando.length === 1
          ? 'Falta a ' + descapitalize(faltando[0].label)
          : 'Faltam as duas chaves');
  }

  /* ── Abrir e fechar ────────────────────────────────────────────────── */

  function open(options) {
    options = options || {};
    focusOnClose = options.returnFocusTo || null;

    buildFields();
    refreshSaveButton();

    clearButton.hidden = !CFG.isConfigured();

    if (options.invalid) {
      markInvalid(options.invalid, options.reason);
    } else {
      eyebrow.textContent = CFG.isConfigured() ? 'Suas chaves' : 'Antes de começar';
      title.textContent = CFG.isConfigured()
        ? 'Trocar ou apagar as chaves'
        : 'Duas chaves e você está dentro';
      lede.textContent = 'O ThumbDrop conversa direto com o Google AI e com a ' +
        'PhotoRoom, do seu navegador. Não há servidor no meio, então as chaves ' +
        'precisam ser suas.';
    }

    if (CFG.storageBlocked()) {
      lede.textContent = 'Este navegador está bloqueando o armazenamento local ' +
        '(navegação privada ou dados de site bloqueados). Dá para usar o editor, ' +
        'mas as chaves não vão sobreviver ao fechar da aba.';
    }

    setup.hidden = false;
    app.hidden = true;

    var first = CFG.FIELDS.filter(function (f) { return !CFG.has(f.id); })[0]
             || CFG.FIELDS[0];
    var target = inputFor((options.invalid || first.id));
    if (target) target.focus();

    document.addEventListener('keydown', onKeydown);
  }

  function close() {
    setup.hidden = true;
    app.hidden = false;
    document.removeEventListener('keydown', onKeydown);
    if (focusOnClose && focusOnClose.focus) focusOnClose.focus();
    focusOnClose = null;
  }

  /* Esc só fecha se já houver chaves — senão não há para onde voltar, e
     fechar seria dar à pessoa um editor que não funciona. */
  function onKeydown(event) {
    if (event.key === 'Escape' && CFG.isConfigured()) {
      event.preventDefault();
      close();
    }
  }

  /* ── 401 e 403 ─────────────────────────────────────────────────────────
     Quando uma chamada é recusada, a pessoa volta para cá sabendo QUAL das
     duas chaves está inválida — não "deu erro". A outra continua no lugar. */

  function markInvalid(id, reason) {
    var field = CFG.FIELDS.filter(function (f) { return f.id === id; })[0];
    if (!field) return;

    var wrap = form.querySelector('[data-field="' + id + '"]');
    var input = inputFor(id);
    if (!wrap || !input) return;

    wrap.classList.add('td-field--invalid');
    input.setAttribute('aria-invalid', 'true');
    wrap.querySelector('.td-field__error').textContent =
      reason || 'O serviço recusou esta chave. Confira se ela foi copiada inteira ' +
                'e se ainda está ativa.';

    eyebrow.textContent = 'Chave recusada';
    title.textContent = field.label + ' não foi aceita';
    lede.textContent = 'A outra chave continua salva. Corrija só esta e volte ' +
      'para onde você estava — seu trabalho no canvas não se perdeu.';

    statusLine.textContent = field.label + ' foi recusada pelo serviço.';
  }

  /* Chamado por ai.js quando um fetch volta 401 ou 403. */
  function reportAuthFailure(id, reason) {
    open({ invalid: id, reason: reason });
  }

  /* ── Eventos ───────────────────────────────────────────────────────── */

  form.addEventListener('submit', function (event) {
    event.preventDefault();

    var ok = true;
    CFG.FIELDS.forEach(function (field) {
      if (!persist(field.id, currentValue(field.id))) ok = false;
    });

    if (!ok) {
      statusLine.textContent = 'Não consegui salvar neste navegador.';
      lede.textContent = 'Este navegador bloqueou o armazenamento local. As ' +
        'chaves valem só para esta aba: se você fechar, precisa colar de novo.';
      /* Sem armazenamento a pessoa ainda pode trabalhar nesta sessão. Fechar
         é melhor do que prendê-la numa tela que ela não consegue satisfazer. */
    }

    if (CFG.isConfigured() || !ok) close();
  });

  clearButton.addEventListener('click', function () {
    clearAll();
    buildFields();
    refreshSaveButton();
    clearButton.hidden = true;
    statusLine.textContent = 'Chaves apagadas deste navegador.';
    eyebrow.textContent = 'Antes de começar';
    title.textContent = 'Duas chaves e você está dentro';
    var first = inputFor(CFG.FIELDS[0].id);
    if (first) first.focus();
  });

  openSetup.addEventListener('click', function (event) {
    open({ returnFocusTo: event.currentTarget });
  });

  /* ── Partida ───────────────────────────────────────────────────────── */

  if (CFG.isConfigured()) {
    app.hidden = false;
  } else {
    open();
  }

  window.TD_APP = {
    openSetup: open,
    reportAuthFailure: reportAuthFailure
  };

})(window, document);
