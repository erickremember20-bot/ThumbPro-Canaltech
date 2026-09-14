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


/* =====================================================================
   ThumbDrop V3 · o shell do editor (etapa 3)
   ---------------------------------------------------------------------
   A trilha de quatro paradas. O canvas NUNCA muda de posição nem de
   tamanho entre elas — só o conteúdo do painel troca. Por isso o canvas
   é um elemento só, montado uma vez, que nenhuma troca de parada
   remonta.
   ===================================================================== */

(function (window, document) {
  'use strict';

  /* ── Estado ────────────────────────────────────────────────────────
     Uma fonte de verdade. Tudo que a interface mostra é derivado daqui. */

  var state = {
    step: 0,            /* índice da parada atual, 0 a 3 */
    reached: 0,         /* a parada mais distante já alcançada */
    credits: 100,
    image: null,        /* { src, width, height } */
    bgRemoved: false,
    filter: null,       /* o filtro aprovado, se houver */
    texts: [],
    frame: 'none'
  };

  /* ── As quatro paradas ─────────────────────────────────────────────
     `ready` é a regra que destrava o avanço, e `blocked` é o que o botão
     diz enquanto ela não está satisfeita. Botão desabilitado sem motivo
     visível é a pessoa olhando para uma parede.                         */

  var STOPS = [
    {
      name: 'Imagem',
      note: 'sua foto no canvas',
      noteDone: 'imagem no lugar',
      title: 'Comece pela imagem',
      text: 'Sem imagem não há thumb. Nenhuma ferramenta aparece antes de ' +
            'existir conteúdo no canvas.',
      cost: 'Uma cobrança por confirmação, não por tentativa: reenquadrar o ' +
            'recorte é local e não gasta crédito.',
      advance: 'Continuar',
      blocked: 'Suba uma imagem para continuar',
      ready: function () { return !!state.image; }
    },
    {
      name: 'Filtro de IA',
      note: 'escolha a direção',
      noteDone: 'direção aplicada',
      title: 'Escolha a direção de arte',
      text: 'Clicar num filtro não gera nada e não cobra nada — abre a ' +
            'confirmação. O crédito só sai quando você aprovar.',
      cost: 'Prévia 1 ✦ · entrega 2 ✦. O crédito sai no instante da chamada e ' +
            'não volta, nem se você cancelar a espera.',
      advance: 'Seguir sem filtro · 0 ✦',
      ready: function () { return true; }     /* filtro é opcional */
    },
    {
      name: 'Texto',
      note: 'título e destaque',
      noteDone: 'título escrito',
      title: 'Escreva o título',
      text: 'Dê um duplo clique em qualquer ponto do canvas para criar uma ' +
            'caixa de texto. Selecione uma palavra e pinte de amarelo para o ' +
            'destaque da casa.',
      cost: 'A faixa que o YouTube cobre com a duração aparece como guia. ' +
            'Ninguém deve escrever embaixo dela — e ela some no export.',
      advance: 'Continuar',
      ready: function () { return true; }     /* thumb sem título é válida */
    },
    {
      name: 'Moldura e export',
      note: 'moldura e download',
      noteDone: 'baixada',
      title: 'Moldura e export',
      text: 'Escolha a moldura e baixe. O PNG sai em 1920 × 1080, sem o guia ' +
            'do timer, sem alças e sem nada de interface.',
      cost: 'Baixar não cobra crédito.',
      advance: 'Baixar PNG 1920 × 1080',
      ready: function () { return true; }
    }
  ];

  var track       = document.getElementById('track');
  var counter     = document.getElementById('step-counter');
  var stopBody    = document.getElementById('stop-body');
  var advance     = document.getElementById('advance');
  var download    = document.getElementById('bar-download');
  var creditsEl   = document.getElementById('credits-count');
  var canvas      = document.getElementById('canvas');
  var canvasEmpty = document.getElementById('canvas-empty');

  /* ── Render ────────────────────────────────────────────────────────── */

  function icon(id) {
    return '<svg class="td-icon" aria-hidden="true"><use href="#' + id + '"></use></svg>';
  }

  function renderTrack() {
    track.textContent = '';

    STOPS.forEach(function (stop, index) {
      var status = index < state.step ? 'done'
                 : index === state.step ? 'current'
                 : 'next';

      var li = document.createElement('li');

      /* Uma parada já visitada volta a ser clicável. Ninguém perde
         trabalho feito ao navegar para trás — o estado é o mesmo. */
      var visitable = index <= state.reached;

      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'td-step td-step--' + status;
      button.disabled = !visitable;
      if (status === 'current') button.setAttribute('aria-current', 'step');

      var marker = document.createElement('span');
      marker.className = 'td-step__marker';
      marker.setAttribute('aria-hidden', 'true');
      if (status === 'done') marker.innerHTML = icon('i-check');
      else marker.textContent = String(index + 1);

      var labels = document.createElement('span');
      labels.className = 'td-step__labels';

      var name = document.createElement('span');
      name.className = 'td-step__name';
      name.textContent = stop.name;

      var note = document.createElement('span');
      note.className = 'td-step__note';
      note.textContent = status === 'done' ? stop.noteDone : stop.note;

      labels.appendChild(name);
      labels.appendChild(note);
      button.appendChild(marker);
      button.appendChild(labels);

      button.addEventListener('click', function () { goTo(index); });

      li.appendChild(button);
      track.appendChild(li);
    });
  }

  function renderStop() {
    var stop = STOPS[state.step];

    counter.textContent = 'Passo ' + (state.step + 1) + ' de ' + STOPS.length;

    stopBody.textContent = '';

    var title = document.createElement('h2');
    title.className = 'td-stop__title';
    title.textContent = stop.title;

    var text = document.createElement('p');
    text.className = 'td-stop__text';
    text.textContent = stop.text;

    stopBody.appendChild(title);
    stopBody.appendChild(text);

    /* Os controles de cada parada entram aqui nas etapas 4 a 8. Por ora
       a parada 1 tem o que ela precisa para existir: uma imagem. */
    if (state.step === 0) stopBody.appendChild(buildUpload());

    if (stop.cost) {
      var cost = document.createElement('p');
      cost.className = 'td-stop__cost';
      cost.textContent = stop.cost;
      stopBody.appendChild(cost);
    }

    var ready = stop.ready();
    advance.disabled = !ready;
    advance.textContent = ready ? stop.advance : (stop.blocked || stop.advance);

    /* UM LARANJA POR TELA, e ele fica na ação que avança NAQUELA parada.
       Nas paradas 1 a 3 o Baixar do topo é neutro; ele só acende na 4. */
    var last = state.step === STOPS.length - 1;
    download.disabled = !last;
    download.classList.toggle('td-btn--primary', last);
    download.classList.toggle('td-btn--ghost', !last);
    advance.hidden = last;   /* na 4 o Baixar do topo é a ação que avança,
                                e dois laranjas na mesma tela seria um a
                                mais do que a regra permite */
  }

  function render() {
    renderTrack();
    renderStop();
    creditsEl.textContent = String(state.credits);
  }

  /* ── Navegação ─────────────────────────────────────────────────────── */

  function goTo(index) {
    if (index < 0 || index >= STOPS.length) return;
    if (index > state.reached) return;
    state.step = index;
    render();
  }

  function next() {
    if (!STOPS[state.step].ready()) return;
    var target = Math.min(state.step + 1, STOPS.length - 1);
    state.reached = Math.max(state.reached, target);
    goTo(target);
  }

  advance.addEventListener('click', next);

  /* ── A imagem ──────────────────────────────────────────────────────
     Só o carregamento e o enquadre inicial. Arraste, zoom ancorado no
     ponteiro e alças são a etapa 4 — a fundação de verdade.             */

  function buildUpload() {
    var wrap = document.createElement('div');

    var input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/png,image/jpeg,image/webp';
    input.id = 'image-input';
    input.className = 'td-sr';

    var label = document.createElement('label');
    label.className = 'td-btn td-btn--ghost td-btn--block';
    label.htmlFor = 'image-input';
    label.innerHTML = icon('i-upload') + ' Escolher imagem';

    input.addEventListener('change', function () {
      if (input.files && input.files[0]) loadImage(input.files[0]);
    });

    wrap.appendChild(input);
    wrap.appendChild(label);
    return wrap;
  }

  function loadImage(file) {
    var reader = new FileReader();
    reader.onload = function () {
      var probe = new Image();
      probe.onload = function () {
        state.image = {
          src: reader.result,
          width: probe.naturalWidth,
          height: probe.naturalHeight
        };
        paintImage();
        render();
      };
      probe.src = reader.result;
    };
    reader.readAsDataURL(file);
  }

  function paintImage() {
    if (!state.image) return;
    canvasEmpty.hidden = true;

    var img = canvas.querySelector('.td-canvas__image');
    if (!img) {
      img = document.createElement('img');
      img.className = 'td-canvas__image';
      img.alt = '';
      canvas.insertBefore(img, canvas.firstChild);
    }
    img.src = state.image.src;
  }

  /* O dropzone é o canvas inteiro — o estado vazio É a área de arraste. */
  canvas.addEventListener('dragover', function (event) {
    event.preventDefault();
    canvas.classList.add('td-canvas--over');
  });
  canvas.addEventListener('dragleave', function () {
    canvas.classList.remove('td-canvas--over');
  });
  canvas.addEventListener('drop', function (event) {
    event.preventDefault();
    canvas.classList.remove('td-canvas--over');
    var file = event.dataTransfer && event.dataTransfer.files[0];
    if (file && /^image\//.test(file.type)) loadImage(file);
  });
  canvas.addEventListener('click', function () {
    if (!state.image) {
      var input = document.getElementById('image-input');
      if (input) input.click();
    }
  });

  render();

  window.TD_EDITOR = { state: state, render: render, goTo: goTo };

})(window, document);
