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

  /* ── Tabela de custo ────────────────────────────────────────────────
     Em créditos. O custo real em dólar está no README; aqui só importa o
     que a pessoa vê e o que é debitado.                                 */

  var COST = {
    removeBackground: 1,   /* PhotoRoom */
    filterPreview:    1,   /* prévia */
    filterDelivery:   2    /* entrega em 2K */
  };

  /* O crédito sai NO MOMENTO DA CHAMADA e não volta — nem se a pessoa
     cancelar a espera. A única devolução é quando a chamada FALHA: aí a
     IA não rodou, ninguém foi cobrado lá fora, e o saldo é preservado. */
  function spend(amount) {
    state.credits -= amount;
    render();
  }

  function refund(amount) {
    state.credits += amount;
    render();
  }

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
      ready: function () { return ai.phase === 'idle'; },
      blocked: 'Termine a prévia para continuar'
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
  var downloadButton = document.getElementById('bar-download');
  var creditsEl   = document.getElementById('credits-count');
  var canvas      = document.getElementById('canvas');
  var canvasEmpty = document.getElementById('canvas-empty');
  var zoomBar     = document.getElementById('zoom');
  var zoomValue   = document.getElementById('zoom-value');

  /* A superfície de composição, criada UMA vez. Trocar de parada não a
     recria — é isso que faz o canvas nunca mudar de posição. */
  var surface = window.TD_CANVAS.create(canvas, {
    onChange: function (info) {
      if (info) zoomValue.textContent = info.zoomPercent + '%';
    }
  });

  /* O passo do − e do + é multiplicativo, igual ao da roda: clicar quatro
     vezes em + e quatro em − volta ao mesmo lugar. */
  function nudgeZoom(direction) {
    surface.setZoom(surface.getZoom() * (direction > 0 ? 1.2 : 1 / 1.2));
  }

  document.getElementById('zoom-in').addEventListener('click', function () { nudgeZoom(1); });
  document.getElementById('zoom-out').addEventListener('click', function () { nudgeZoom(-1); });
  zoomValue.addEventListener('click', function () { surface.setZoom(1); });

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
    if (state.step === 0) stopBody.appendChild(buildStopOne());
    if (state.step === 1) stopBody.appendChild(buildStopTwo());
    if (state.step === 2) stopBody.appendChild(buildStopThree());
    if (state.step === 3) stopBody.appendChild(buildStopFour());

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
    downloadButton.disabled = !last;
    downloadButton.classList.toggle('td-btn--primary', last);
    downloadButton.classList.toggle('td-btn--ghost', !last);
    advance.hidden = last;   /* na 4 o Baixar do topo é a ação que avança,
                                e dois laranjas na mesma tela seria um a
                                mais do que a regra permite */
  }

  function render() {
    renderTrack();
    renderStop();
    creditsEl.textContent = String(state.credits);

    /* Enquanto a IA trabalha ou a prévia está na tela, a composição não
       é manipulável — e não deve PARECER manipulável. Alças e controle
       de zoom saem: oferecer um gesto que vai ser descartado é pior do
       que não oferecer. */
    var busy = ai && (ai.phase === 'working' || ai.phase === 'preview');
    if (busy) surface.select(false);
    zoomBar.hidden = !state.image || busy;

    /* Um gesto, um significado por vez: o duplo clique enquadra a imagem
       na parada 1 e escreve na parada 3. */
    surface.setDoubleClickFit(state.step === 0);
    if (texts) {
      texts.setEnabled(state.step === 2);
      timerGuide.hidden = !(state.step === 2 && timerOn);
    }
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

  function buildStopOne() {
    var wrap = document.createElement('div');

    var input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/png,image/jpeg,image/webp';
    input.id = 'image-input';
    input.className = 'td-sr';
    input.addEventListener('change', function () {
      if (input.files && input.files[0]) loadImage(input.files[0]);
    });

    var label = document.createElement('label');
    label.className = 'td-btn td-btn--ghost td-btn--block';
    label.htmlFor = 'image-input';
    label.innerHTML = icon('i-upload') + ' ' +
      (state.image ? 'Trocar a imagem' : 'Escolher imagem');

    wrap.appendChild(input);
    wrap.appendChild(label);

    /* Nenhuma ferramenta aparece antes de existir conteúdo no canvas. */
    if (state.image) wrap.appendChild(buildRemoveBackground());

    return wrap;
  }

  function buildRemoveBackground() {
    var box = document.createElement('div');
    box.className = 'td-tool';

    var button = document.createElement('button');
    button.type = 'button';
    button.className = 'td-btn td-btn--ghost td-btn--block';

    var enough = state.credits >= COST.removeBackground;

    if (bgBusy) {
      button.disabled = true;
      button.textContent = 'Removendo o fundo…';
    } else if (!enough) {
      /* SALDO INSUFICIENTE: desabilitado COM O MOTIVO VISÍVEL. */
      button.disabled = true;
      button.textContent = 'Saldo insuficiente · precisa de ' +
        COST.removeBackground + ' ✦';
    } else {
      button.textContent = (state.bgRemoved ? 'Remover fundo de novo' : 'Remover fundo') +
        ' · ' + COST.removeBackground + ' ✦';
      button.addEventListener('click', removeBackground);
    }

    box.appendChild(button);

    /* A regra de custo dita em voz alta, antes de custar: depois de
       recortado, reenquadrar é local e não chama a API de novo. */
    if (state.bgRemoved && !bgBusy) {
      var done = document.createElement('p');
      done.className = 'td-tool__ok';
      done.innerHTML = icon('i-check') +
        ' Fundo removido. Mover, escalar e girar agora é de graça.';
      box.appendChild(done);
    }

    if (bgError) box.appendChild(buildError(bgError));

    return box;
  }

  /* Falha NUNCA é beco sem saída: a composição fica intacta, o saldo é
     devolvido, e há sempre pelo menos uma saída visível. */
  function buildError(error) {
    var box = document.createElement('div');
    box.className = 'td-error';

    var text = document.createElement('p');
    text.className = 'td-error__text';

    var action = null;

    if (error.kind === 'cors') {
      text.textContent = 'O navegador bloqueou a chamada direta à PhotoRoom. ' +
        'Ela não aceita chamada de página, só de servidor. Preencha a URL do ' +
        'proxy nas chaves — o README tem o worker de 20 linhas.';
      action = { label: 'Abrir as chaves', run: function () { window.TD_APP.openSetup({}); } };

    } else if (error.kind === 'quota') {
      text.textContent = 'A cota desta chave da PhotoRoom acabou. Use uma chave ' +
        'de sandbox, que dá 1000 imagens por mês, ou recarregue o plano.';
      action = { label: 'Trocar a chave', run: function () { window.TD_APP.openSetup({}); } };

    } else if (error.kind === 'network') {
      text.textContent = 'Não consegui falar com o proxy. Confira se a URL está ' +
        'certa e se o worker está no ar.';
      action = { label: 'Tentar de novo', run: removeBackground };

    } else {
      text.textContent = error.message || 'A chamada não deu certo.';
      action = { label: 'Tentar de novo', run: removeBackground };
    }

    var kept = document.createElement('p');
    kept.className = 'td-error__kept';
    kept.textContent = 'Seu saldo não foi tocado e a composição está intacta.';

    box.appendChild(text);
    box.appendChild(kept);

    if (action) {
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'td-btn td-btn--ghost td-btn--block';
      button.textContent = action.label;
      button.addEventListener('click', action.run);
      box.appendChild(button);
    }

    return box;
  }

  var bgBusy = false;
  var bgError = null;

  function removeBackground() {
    if (bgBusy || !state.image) return;
    if (state.credits < COST.removeBackground) return;

    bgBusy = true;
    bgError = null;
    /* Debitado NO MOMENTO DA CHAMADA, como a regra manda. */
    spend(COST.removeBackground);

    window.TD_AI.removeBackground(surface.getLayer().src).then(function (result) {
      bgBusy = false;
      state.bgRemoved = true;
      state.image = result;
      /* O recorte entra no lugar do original NO MESMO retângulo. O
         enquadramento que a pessoa fez não se perde. */
      surface.replaceSource(result.src, result.width, result.height);
      render();

    }).catch(function (error) {
      bgBusy = false;
      /* A chamada falhou: a IA não rodou e ninguém foi cobrado lá fora.
         Saldo preservado. */
      refund(COST.removeBackground);

      if (error.kind === 'auth') {
        window.TD_APP.reportAuthFailure('photoroom');
        render();
        return;
      }

      bgError = error;
      render();
    });

    render();
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
        canvasEmpty.hidden = true;
        zoomBar.hidden = false;
        surface.setImage(reader.result, probe.naturalWidth, probe.naturalHeight);
        render();
      };
      probe.src = reader.result;
    };
    reader.readAsDataURL(file);
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


  /* =====================================================================
     PARADA 2 · O FILTRO DE IA
     ---------------------------------------------------------------------
     A sequência é obrigatória e existe porque o crédito sai no instante
     em que a IA roda e não volta:

       1. clicar num card NÃO gera nada e NÃO cobra nada — abre o modal
       2. o modal diz o custo, mostra o saldo e oferece TRÊS saídas
       3. confirmar gera a prévia em 1K e debita 1 ✦ na hora da chamada
       4. a prévia aparece em comparação, com divisória arrastável
       5. aprovar gera a entrega em 2K e debita mais 2 ✦
       6. cancelar interrompe a espera mas NÃO devolve o crédito, e a
          interface avisa isso ANTES, nunca depois

     Não existe caminho aqui em que a pessoa gere sem confirmar.
     ===================================================================== */

  var ai = {
    phase: 'idle',     /* idle · working · preview · failed */
    filter: null,
    stage: null,       /* 'preview' ou 'delivery' */
    result: null,
    error: null,
    abort: null,
    split: 50          /* posição da divisória, em % */
  };

  var confirmModal   = document.getElementById('confirm');
  var confirmTitle   = document.getElementById('confirm-title');
  var confirmEyebrow = document.getElementById('confirm-eyebrow');
  var confirmText    = document.getElementById('confirm-text');
  var confirmLedger  = document.getElementById('confirm-ledger');
  var confirmGo      = document.getElementById('confirm-go');
  var pendingFilter  = null;
  var confirmReturnFocus = null;

  function buildStopTwo() {
    var wrap = document.createElement('div');

    if (ai.phase === 'working') {
      wrap.appendChild(buildWorking());
      return wrap;
    }

    if (ai.phase === 'preview') {
      wrap.appendChild(buildPreviewPanel());
      return wrap;
    }

    var grid = document.createElement('div');
    grid.className = 'td-filters';

    window.TD_AI.FILTERS.forEach(function (filter) {
      var card = document.createElement('button');
      card.type = 'button';
      card.className = 'td-filter';
      if (state.filter && state.filter.id === filter.id) {
        card.classList.add('td-filter--on');
        card.setAttribute('aria-pressed', 'true');
      }

      var art = document.createElement('span');
      art.className = 'td-filter__art';
      /* A amostra é decoração: se o arquivo não estiver em assets/
         samples/, o card continua funcionando e legível. */
      art.style.backgroundImage = 'url("' + filter.sample + '")';

      var name = document.createElement('span');
      name.className = 'td-filter__name';
      name.textContent = filter.name;

      var note = document.createElement('span');
      note.className = 'td-filter__note';
      note.textContent = filter.note;

      card.appendChild(art);
      card.appendChild(name);
      card.appendChild(note);

      /* CLICAR NÃO GERA NADA. Abre a confirmação. */
      card.addEventListener('click', function () { askConfirm(filter, card); });

      grid.appendChild(card);
    });

    wrap.appendChild(grid);

    if (ai.phase === 'failed') wrap.appendChild(buildAiError());

    return wrap;
  }

  /* ── O modal de confirmação ───────────────────────────────────────── */

  function askConfirm(filter, origin) {
    pendingFilter = filter;
    confirmReturnFocus = origin || null;

    var enough = state.credits >= COST.filterPreview;

    confirmEyebrow.textContent = filter.name;
    confirmTitle.textContent = 'Ver a prévia em ' + filter.name + '?';
    confirmText.textContent = 'A prévia mostra a direção de arte para você decidir. ' +
      'Só depois de aprovar é que a imagem final é gerada.';

    confirmLedger.textContent = '';
    ledgerRow('Prévia, agora', COST.filterPreview + ' ✦');
    ledgerRow('Entrega, se você aprovar', COST.filterDelivery + ' ✦');
    ledgerRow('Seu saldo', state.credits + ' ✦', true);

    if (enough) {
      confirmGo.disabled = false;
      confirmGo.textContent = 'Ver prévia · ' + COST.filterPreview + ' ✦';
    } else {
      /* SALDO INSUFICIENTE: desabilitado com o motivo visível. */
      confirmGo.disabled = true;
      confirmGo.textContent = 'Saldo insuficiente · precisa de ' + COST.filterPreview + ' ✦';
    }

    confirmModal.hidden = false;
    confirmGo.focus();
    document.addEventListener('keydown', onConfirmKey);
  }

  function ledgerRow(label, value, strong) {
    var dt = document.createElement('dt');
    dt.textContent = label;
    var dd = document.createElement('dd');
    dd.textContent = value;
    if (strong) dd.className = 'td-ledger__strong';
    confirmLedger.appendChild(dt);
    confirmLedger.appendChild(dd);
  }

  function closeConfirm() {
    confirmModal.hidden = true;
    document.removeEventListener('keydown', onConfirmKey);
    if (confirmReturnFocus && confirmReturnFocus.focus) confirmReturnFocus.focus();
    confirmReturnFocus = null;
    pendingFilter = null;
  }

  function onConfirmKey(event) {
    /* Esc = Descartar. A saída mais barata é sempre a mais fácil. */
    if (event.key === 'Escape') { event.preventDefault(); closeConfirm(); }
  }

  document.getElementById('confirm-discard').addEventListener('click', closeConfirm);
  confirmModal.querySelector('[data-close]').addEventListener('click', closeConfirm);

  document.getElementById('confirm-skip').addEventListener('click', function () {
    closeConfirm();
    next();
  });

  confirmGo.addEventListener('click', function () {
    var filter = pendingFilter;
    closeConfirm();
    runFilter(filter, 'preview');
  });

  /* ── A chamada ─────────────────────────────────────────────────────── */

  function runFilter(filter, stage) {
    if (!filter) return;

    var cost = stage === 'preview' ? COST.filterPreview : COST.filterDelivery;
    if (state.credits < cost) return;

    ai.phase = 'working';
    ai.filter = filter;
    ai.stage = stage;
    ai.error = null;
    ai.abort = new AbortController();

    /* DEBITADO AGORA, no instante da chamada. */
    spend(cost);

    /* A prévia manda uma entrada reduzida: 1K basta para julgar direção
       de arte, e custa menos. A entrega manda a composição inteira. */
    var input = surface.snapshot({ width: stage === 'preview' ? 1024 : 1920 });

    window.TD_AI.applyFilter({
      prompt: filter.prompt,
      image: input,
      size: stage === 'preview' ? '1K' : '2K',
      signal: ai.abort.signal
    }).then(function (result) {
      if (stage === 'preview') {
        ai.phase = 'preview';
        ai.result = result;
        ai.split = 50;
        render();
        paintCompare();
      } else {
        /* A entrega é a nova base: o filtro devolve a composição inteira
           já renderizada em 16:9. */
        ai.phase = 'idle';
        ai.result = null;
        state.filter = filter;
        state.image = result;
        surface.setImage(result.src, result.width, result.height);
        clearCompare();
        render();
      }

    }).catch(function (error) {
      if (error && error.name === 'AbortError') {
        /* Cancelado: o crédito NÃO volta, e a pessoa já sabia disso antes
           de começar. A composição fica exatamente como estava. */
        ai.phase = 'idle';
        ai.result = null;
        clearCompare();
        render();
        return;
      }

      /* A chamada falhou: a IA não entregou nada, então o saldo volta. */
      refund(cost);

      if (error.kind === 'auth') {
        ai.phase = 'idle';
        window.TD_APP.reportAuthFailure('google');
        render();
        return;
      }

      ai.phase = 'failed';
      ai.error = error;
      clearCompare();
      render();
    });

    render();
  }

  function cancelFilter() {
    if (ai.abort) ai.abort.abort();
  }

  /* ── Processando ───────────────────────────────────────────────────────
     Diz o que está sendo preservado, dá tempo estimado, e deixa cancelar
     — com o aviso do crédito à vista, não escondido.                     */

  function buildWorking() {
    var box = document.createElement('div');
    box.className = 'td-working';

    var title = document.createElement('p');
    title.className = 'td-working__title';
    title.textContent = ai.stage === 'preview'
      ? 'Gerando a prévia em ' + ai.filter.name
      : 'Gerando a imagem final em 2K';

    var preserving = document.createElement('p');
    preserving.className = 'td-working__text';
    preserving.textContent = 'Mantendo o sujeito, o enquadramento e o fundo como estão. ' +
      'O filtro muda luz e cor — não inventa cenário.';

    var time = document.createElement('p');
    time.className = 'td-working__time';
    time.textContent = ai.stage === 'preview'
      ? 'Costuma levar de 10 a 30 segundos.'
      : 'A entrega em 2K costuma levar de 20 a 60 segundos.';

    var cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.className = 'td-btn td-btn--ghost td-btn--block';
    cancel.textContent = 'Cancelar a espera';
    cancel.addEventListener('click', cancelFilter);

    var warn = document.createElement('p');
    warn.className = 'td-working__warn';
    warn.textContent = 'Cancelar interrompe a espera, mas o crédito já saiu e não volta.';

    box.appendChild(title);
    box.appendChild(preserving);
    box.appendChild(time);
    box.appendChild(cancel);
    box.appendChild(warn);
    return box;
  }

  /* ── A prévia em comparação ────────────────────────────────────────── */

  function buildPreviewPanel() {
    var box = document.createElement('div');

    var title = document.createElement('p');
    title.className = 'td-working__title';
    title.textContent = 'Prévia em ' + ai.filter.name;

    var text = document.createElement('p');
    text.className = 'td-working__text';
    text.textContent = 'Arraste a divisória no canvas para comparar antes e depois. ' +
      'Aprovar gera a imagem final em 2K.';

    var approve = document.createElement('button');
    approve.type = 'button';
    approve.className = 'td-btn td-btn--primary td-btn--block';

    if (state.credits >= COST.filterDelivery) {
      approve.textContent = 'Aprovar em 2K · ' + COST.filterDelivery + ' ✦';
      approve.addEventListener('click', function () { runFilter(ai.filter, 'delivery'); });
    } else {
      approve.disabled = true;
      approve.textContent = 'Saldo insuficiente · precisa de ' + COST.filterDelivery + ' ✦';
    }

    var discard = document.createElement('button');
    discard.type = 'button';
    discard.className = 'td-btn td-btn--ghost td-btn--block td-stack';
    discard.textContent = 'Descartar a prévia';
    discard.addEventListener('click', function () {
      ai.phase = 'idle';
      ai.result = null;
      clearCompare();
      surface.select(true);
      render();
    });

    box.appendChild(title);
    box.appendChild(text);
    box.appendChild(approve);
    box.appendChild(discard);
    return box;
  }

  /* A comparação mora no canvas, por cima da composição, e some quando a
     prévia é descartada ou aprovada. */
  var compare = null;

  function paintCompare() {
    clearCompare();
    if (!ai.result) return;

    compare = document.createElement('div');
    compare.className = 'td-compare';

    var after = document.createElement('img');
    after.className = 'td-compare__after';
    after.alt = '';
    after.src = ai.result.src;

    var bar = document.createElement('div');
    bar.className = 'td-compare__bar';

    var grip = document.createElement('button');
    grip.type = 'button';
    grip.className = 'td-compare__grip';
    grip.setAttribute('aria-label',
      'Divisória entre antes e depois. Use as setas para mover.');

    var tagBefore = document.createElement('span');
    tagBefore.className = 'td-compare__tag td-compare__tag--before';
    tagBefore.textContent = 'ANTES';

    var tagAfter = document.createElement('span');
    tagAfter.className = 'td-compare__tag td-compare__tag--after';
    tagAfter.textContent = 'DEPOIS · ' + ai.filter.name.toUpperCase();

    bar.appendChild(grip);
    compare.appendChild(after);
    compare.appendChild(tagBefore);
    compare.appendChild(tagAfter);
    compare.appendChild(bar);
    canvas.appendChild(compare);

    function moveTo(percent) {
      ai.split = Math.max(0, Math.min(100, percent));
      compare.style.setProperty('--split', ai.split + '%');
    }
    moveTo(ai.split);

    function fromEvent(event) {
      var rect = canvas.getBoundingClientRect();
      moveTo((event.clientX - rect.left) / rect.width * 100);
    }

    var dragging = false;
    bar.addEventListener('pointerdown', function (event) {
      dragging = true;
      event.stopPropagation();
      try { bar.setPointerCapture(event.pointerId); } catch (e) {}
    });
    bar.addEventListener('pointermove', function (event) {
      if (!dragging) return;
      event.stopPropagation();
      fromEvent(event);
    });
    bar.addEventListener('pointerup', function (event) {
      dragging = false;
      event.stopPropagation();
    });

    /* Arrastar com o mouse é o gesto principal; as setas existem para
       quem navega por teclado não ficar sem a comparação. */
    grip.addEventListener('keydown', function (event) {
      var step = event.shiftKey ? 10 : 2;
      if (event.key === 'ArrowLeft')  { event.preventDefault(); moveTo(ai.split - step); }
      if (event.key === 'ArrowRight') { event.preventDefault(); moveTo(ai.split + step); }
    });
  }

  function clearCompare() {
    if (compare && compare.parentNode) compare.parentNode.removeChild(compare);
    compare = null;
  }

  /* ── Falhou ────────────────────────────────────────────────────────────
     Composição intacta, saldo preservado, DUAS saídas. Nunca beco sem
     saída.                                                                */

  function buildAiError() {
    var box = document.createElement('div');
    box.className = 'td-error';

    var text = document.createElement('p');
    text.className = 'td-error__text';
    text.textContent = ai.error && ai.error.kind === 'quota'
      ? 'A cota da chave do Google AI acabou por agora. Tente mais tarde ou troque a chave.'
      : (ai.error && ai.error.message) || 'A geração não deu certo.';

    var kept = document.createElement('p');
    kept.className = 'td-error__kept';
    kept.textContent = 'Seu saldo foi devolvido e a composição está intacta.';

    var again = document.createElement('button');
    again.type = 'button';
    again.className = 'td-btn td-btn--ghost td-btn--block';
    again.textContent = 'Tentar de novo · ' + COST.filterPreview + ' ✦';
    again.addEventListener('click', function () { runFilter(ai.filter, 'preview'); });

    var skip = document.createElement('button');
    skip.type = 'button';
    skip.className = 'td-btn td-btn--ghost td-btn--block td-stack';
    skip.textContent = 'Seguir sem filtro · 0 ✦';
    skip.addEventListener('click', function () {
      ai.phase = 'idle';
      render();
      next();
    });

    box.appendChild(text);
    box.appendChild(kept);
    box.appendChild(again);
    box.appendChild(skip);
    return box;
  }


  /* =====================================================================
     PARADA 3 · O TEXTO
     ===================================================================== */

  var texts = window.TD_TEXT.create(canvas, { onChange: function () { render(); } });

  /* O guia do timer. A faixa que o YouTube cobre com a duração do vídeo:
     ninguém deve escrever embaixo dela. Ligado por padrão na parada 3,
     e NUNCA desenhado no export — ele é interface. */
  var timerGuide = document.createElement('div');
  timerGuide.className = 'td-timer';
  timerGuide.innerHTML = '<span>16:20</span>';
  timerGuide.hidden = true;
  canvas.appendChild(timerGuide);
  var timerOn = true;

  /* DUPLO CLIQUE EM PONTO VAZIO CRIA UMA CAIXA ALI e já entra em edição.
     Na parada 1 o mesmo gesto enquadra a imagem; por isso cada parada
     liga o seu. Um gesto, um significado por vez. */
  canvas.addEventListener('dblclick', function (event) {
    if (state.step !== 2) return;
    if (event.target.closest && event.target.closest('.td-text')) return;

    var rect = canvas.getBoundingClientRect();
    var k = rect.width / surface.EXPORT_W;
    texts.create((event.clientX - rect.left) / k, (event.clientY - rect.top) / k);
  });

  /* Um clique fora do texto sai do modo de edição. O texto continua
     selecionado, mostrando as alças — sair da edição não é desistir. */
  canvas.addEventListener('pointerdown', function (event) {
    if (state.step !== 2) return;
    if (event.target.closest && event.target.closest('.td-text')) return;
    texts.stopEditing();
  });

  function buildStopThree() {
    var wrap = document.createElement('div');
    var selected = texts.selected();

    if (!selected) {
      /* Sem nada selecionado, o painel ensina o gesto que não tem botão. */
      var hint = document.createElement('p');
      hint.className = 'td-stop__text';
      hint.textContent = texts.count()
        ? 'Clique num texto para editar as opções dele.'
        : 'Dê um duplo clique em qualquer ponto do canvas para escrever.';
      wrap.appendChild(hint);

      var add = document.createElement('button');
      add.type = 'button';
      add.className = 'td-btn td-btn--ghost td-btn--block';
      add.textContent = 'Adicionar um texto';
      add.addEventListener('click', function () {
        texts.create(surface.EXPORT_W * 0.08, surface.EXPORT_H * 0.6);
      });
      wrap.appendChild(add);

      wrap.appendChild(buildTimerToggle());
      return wrap;
    }

    /* ── Cor ──────────────────────────────────────────────────────────
       O amarelo aqui é o destaque: com um trecho selecionado dentro da
       edição, pinta só ele. Sem seleção, pinta a caixa. É o mesmo botão
       porque é o mesmo conceito — não há um "modo destaque". */

    wrap.appendChild(group('Cor', function (row) {
      row.appendChild(swatch('#ffffff', 'Branco', selected.color === '#ffffff'));
      row.appendChild(swatch('#ffd400', 'Amarelo · destaque', selected.color === '#ffd400'));

      var picker = document.createElement('input');
      picker.type = 'color';
      picker.className = 'td-swatch td-swatch--pick';
      picker.value = /^#[0-9a-f]{6}$/i.test(selected.color) ? selected.color : '#ffffff';
      picker.setAttribute('aria-label', 'Escolher outra cor');
      picker.addEventListener('input', function () { texts.paint(picker.value); });
      row.appendChild(picker);
    }));

    var painted = document.createElement('p');
    painted.className = 'td-stop__cost';
    painted.textContent = 'Selecione uma palavra dentro do texto e clique no amarelo ' +
      'para destacar só ela.';
    wrap.appendChild(painted);

    /* ── Alinhamento ─────────────────────────────────────────────────── */

    wrap.appendChild(group('Alinhamento', function (row) {
      [['left', 'Esquerda'], ['center', 'Centro'], ['right', 'Direita']].forEach(function (pair) {
        row.appendChild(choice(pair[1], selected.align === pair[0], function () {
          texts.update({ align: pair[0] });
        }));
      });
    }));

    /* ── Peso ─────────────────────────────────────────────────────────
       Sempre em itálico: o padrão da casa é Barlow Black Italic. */

    wrap.appendChild(group('Peso', function (row) {
      texts.WEIGHTS.forEach(function (weight) {
        row.appendChild(choice(weight.label, selected.weight === weight.value, function () {
          texts.update({ weight: weight.value });
        }));
      });
    }));

    /* ── Sombra ───────────────────────────────────────────────────────── */

    wrap.appendChild(group('Sombra', function (row) {
      row.appendChild(choice('Com sombra', selected.shadow, function () {
        texts.update({ shadow: true });
      }));
      row.appendChild(choice('Sem sombra', !selected.shadow, function () {
        texts.update({ shadow: false });
      }));
    }));

    var remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'td-btn td-btn--ghost td-btn--block td-stack';
    remove.textContent = 'Apagar este texto';
    remove.addEventListener('click', function () { texts.remove(texts.selected()); });
    wrap.appendChild(remove);

    var keys = document.createElement('p');
    keys.className = 'td-stop__cost';
    keys.textContent = 'Delete apaga · Esc desseleciona · setas movem um pixel, ' +
      'dez com Shift.';
    wrap.appendChild(keys);

    wrap.appendChild(buildTimerToggle());
    return wrap;
  }

  function buildTimerToggle() {
    var box = document.createElement('label');
    box.className = 'td-check';

    var input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = timerOn;
    input.addEventListener('change', function () {
      timerOn = input.checked;
      render();
    });

    var text = document.createElement('span');
    text.textContent = 'Mostrar a faixa do timer do YouTube';

    var note = document.createElement('span');
    note.className = 'td-check__note';
    note.textContent = 'Some no export.';

    box.appendChild(input);
    box.appendChild(text);
    box.appendChild(note);
    return box;
  }

  /* ── Peças do painel ───────────────────────────────────────────────── */

  function group(label, fill) {
    var box = document.createElement('div');
    box.className = 'td-group';

    var caption = document.createElement('p');
    caption.className = 'td-group__label';
    caption.textContent = label;

    var row = document.createElement('div');
    row.className = 'td-group__row';
    fill(row);

    box.appendChild(caption);
    box.appendChild(row);
    return box;
  }

  /* AZUL MARCA O CONTROLE ATIVO — nunca laranja, porque escolher peso
     não avança a parada. */
  function choice(label, active, run) {
    var button = document.createElement('button');
    button.type = 'button';
    button.className = 'td-choice' + (active ? ' td-choice--on' : '');
    button.textContent = label;
    if (active) button.setAttribute('aria-pressed', 'true');
    button.addEventListener('click', run);
    return button;
  }

  function swatch(color, label, active) {
    var button = document.createElement('button');
    button.type = 'button';
    button.className = 'td-swatch' + (active ? ' td-swatch--on' : '');
    button.style.background = color;
    button.setAttribute('aria-label', label);
    button.title = label;
    /* O ponteiro não pode roubar a seleção do texto antes do clique
       chegar: sem isto, clicar no amarelo desfaz a seleção da palavra e
       o destaque nunca acontece. */
    button.addEventListener('mousedown', function (event) { event.preventDefault(); });
    button.addEventListener('click', function () { texts.paint(color); });
    return button;
  }


  /* =====================================================================
     PARADA 4 · MOLDURA E EXPORT
     ===================================================================== */

  var FRAMES = [
    { id: 'canaltech', name: 'Canaltech',  file: 'assets/frames/moldura-canaltech.png' },
    { id: 'cteletro',  name: 'CT Eletro',  file: 'assets/frames/moldura-ct-eletro.png' },
    { id: 'cor',       name: 'Minha cor',  color: true },
    { id: 'none',      name: 'Sem moldura' }
  ];

  /* Espessura da borda de "Minha cor", em pixels de export. Fina o
     bastante para emoldurar sem comer a arte. */
  var COLOR_FRAME_WIDTH = 16;

  var frameImages = {};
  var frameColor = '#f87737';

  /* As molduras da marca são PNGs que ainda não estão no repositório.
     Carregar é otimista: se o arquivo não existir, a opção aparece
     desabilitada DIZENDO qual arquivo falta, em vez de quebrar o export
     ou sumir sem explicação. */
  FRAMES.forEach(function (frame) {
    if (!frame.file) return;
    var probe = new Image();
    probe.onload  = function () { frameImages[frame.id] = probe; render(); };
    probe.onerror = function () { frameImages[frame.id] = null;  render(); };
    probe.src = frame.file;
  });

  function buildStopFour() {
    var wrap = document.createElement('div');

    var grid = document.createElement('div');
    grid.className = 'td-frames';

    FRAMES.forEach(function (frame) {
      var card = document.createElement('button');
      card.type = 'button';
      card.className = 'td-frameopt';

      var missing = frame.file && frameImages[frame.id] === null;

      if (state.frame === frame.id) {
        /* AZUL MARCA A OPÇÃO ESCOLHIDA. */
        card.classList.add('td-frameopt--on');
        card.setAttribute('aria-pressed', 'true');
      }

      var art = document.createElement('span');
      art.className = 'td-frameopt__art';
      if (frame.file && frameImages[frame.id]) art.style.backgroundImage = 'url("' + frame.file + '")';
      if (frame.id === 'cor') art.style.boxShadow = 'inset 0 0 0 3px ' + frameColor;
      if (frame.id === 'none') art.classList.add('td-frameopt__art--none');

      var name = document.createElement('span');
      name.className = 'td-frameopt__name';
      name.textContent = frame.name;

      card.appendChild(art);
      card.appendChild(name);

      if (missing) {
        card.disabled = true;
        var gone = document.createElement('span');
        gone.className = 'td-frameopt__missing';
        gone.textContent = 'falta ' + frame.file.split('/').pop();
        card.appendChild(gone);
      } else {
        card.addEventListener('click', function () {
          state.frame = frame.id;
          if (frame.color) colorInput.click();
          paintFrame();
          render();
        });
      }

      grid.appendChild(card);
    });

    wrap.appendChild(grid);

    /* O seletor RGB de "Minha cor". */
    var colorInput = document.createElement('input');
    colorInput.type = 'color';
    colorInput.className = 'td-sr';
    colorInput.value = frameColor;
    colorInput.addEventListener('input', function () {
      frameColor = colorInput.value;
      state.frame = 'cor';
      paintFrame();
      render();
    });
    wrap.appendChild(colorInput);

    var anyMissing = FRAMES.some(function (f) { return f.file && frameImages[f.id] === null; });
    if (anyMissing) {
      var note = document.createElement('p');
      note.className = 'td-stop__cost';
      note.textContent = 'As molduras da marca são PNG 1920 × 1080 com fundo ' +
        'transparente. O README lista os nomes exatos que o código procura.';
      wrap.appendChild(note);
    }

    return wrap;
  }

  /* A moldura na tela é uma prévia por cima do canvas. No export ela é
     desenhada de novo, em 1920 × 1080, pelo renderizador — não é esta
     camada que vira PNG. */
  var framePreview = document.createElement('div');
  framePreview.className = 'td-frameview';
  canvas.appendChild(framePreview);

  function paintFrame() {
    var chosen = state.frame;

    framePreview.style.backgroundImage = '';
    framePreview.style.boxShadow = '';

    if (chosen === 'cor') {
      var k = canvas.clientWidth / surface.EXPORT_W;
      framePreview.style.boxShadow = 'inset 0 0 0 ' + (COLOR_FRAME_WIDTH * k) + 'px ' + frameColor;
    } else if (frameImages[chosen]) {
      framePreview.style.backgroundImage = 'url("' + frameImages[chosen].src + '")';
    }

    framePreview.hidden = !(chosen && chosen !== 'none');
  }

  /* ── O export ────────────────────────────────────────────────────────
     Relê o mesmo estado que a tela mostra. O guia do timer, as alças e o
     controle de zoom não entram porque eles nunca estiveram no estado —
     são interface, e interface não tem coordenada de export.            */

  function renderFinal() {
    return surface.snapshot({
      texts: texts.serialize(),
      frame: state.frame === 'cor' ? null : frameImages[state.frame] || null,
      frameColor: state.frame === 'cor' ? frameColor : null,
      frameWidth: COLOR_FRAME_WIDTH
    });
  }

  function download() {
    var dataUrl = renderFinal();

    /* Baixar NÃO cobra crédito. */
    var link = document.createElement('a');
    link.href = dataUrl;
    link.download = fileName();
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    state.downloaded = true;
    render();
  }

  function fileName() {
    var stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
    return 'thumbdrop-' + stamp + '.png';
  }

  downloadButton.addEventListener('click', function () {
    if (state.step !== STOPS.length - 1) return;
    download();
  });


  paintFrame();
  render();

  window.TD_EDITOR = { state: state, ai: ai, render: render, goTo: goTo, surface: surface,
                       texts: texts, askConfirm: askConfirm, renderFinal: renderFinal,
                       download: download };

})(window, document);
