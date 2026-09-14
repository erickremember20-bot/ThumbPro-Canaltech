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


  /* ── Os seis filtros ──────────────────────────────────────────────────
     OS PROMPTS SÃO CÓPIA LITERAL DA V2. Não foram reescritos, resumidos
     nem "melhorados" — foram extraídos do arquivo anexo por script, para
     não haver erro de transcrição.

     Todos seguem o mesmo esqueleto: regra de preservação, relighting,
     pele e expressão, color grading, limpeza da marca d'água que o
     removedor de fundo deixa, e saída.

     A REGRA DE PRESERVAÇÃO É O QUE PROTEGE A PAUTA JORNALÍSTICA. Um
     filtro que inventa cenário quebra a notícia. Se algum dia alguém for
     mexer aqui, é essa parte que não pode relaxar.

     "Cinema" usa o prompt que a V2 chamava de "cinematografico".        */

  var FILTERS = [
    {
      id: "dramatico",
      name: "Dramático",
      note: "contraste alto, sombra pesada",
      sample: 'assets/samples/dramatico.png',
      prompt: "Use the provided image as a base composition and layout reference. Create a highly intense, high-contrast, and dramatic YouTube thumbnail base image based on this draft. Maintain the original subject, framing, and general composition, but significantly enhance the visual quality to match a high-stakes thriller movie look. IMPORTANT: Do not alter the environment or background structure. Keep the original background composition, but enhance atmosphere, depth, and grading. --- WATERMARK REMOVAL: Automatically detect, paint over, and completely remove any overlaid logos, text watermarks, or branding marks (such as the PhotoRoom watermark) present in the input composition. The final output must be 100% pristine and clean. --- RELIGHTING (Chiaroscuro & High Tension Style): Relight the subject with heavy, dramatic directional lighting: intense key light cutting across the scene; sharp, blinding specular highlights; deep, heavy cinematic shadows; powerful, crisp rim light separating the subject cleanly from the dark background. Add realistic dramatic highlight bloom on intense light sources. --- SKIN & SUBJECT RENDERING: Hyper-detailed, realistic skin texture with dramatic shadow casting. Enhance facial features to look focused, intense, and deeply emotional without morphing the face. --- ATMOSPHERE: Moody, heavy, and tense atmosphere. Thick depth with crisp light rays slicing through shadows. High-end dramatic studio look. --- COLOR GRADING: High-contrast modern thriller look. Deep, rich, ink-like blacks and stylized dark shadows contrasted with piercing white or intense amber highlights. Heavy visual tension grading. --- BACKGROUND: Do not change the structure or layout. Only enhance the intense lighting contrast between deep dark spots and bright reflections. --- COMPOSITION & STYLE: Razor-sharp subject separation with maximum visual pop. Optimized for YouTube thumbnail layout (16:9). OUTPUT: Sharp, detailed, high resolution, professional thumbnail background free of any watermarks."
    },
    {
      id: "vivido",
      name: "Vívido",
      note: "cor saturada, brilho limpo",
      sample: 'assets/samples/vivido.png',
      prompt: "Use the provided image as a base composition and layout reference. Create a highly vibrant, hyper-energetic, and vivid YouTube thumbnail base image based on this draft. Maintain the original subject, framing, and general composition, but significantly enhance the visual quality to match a premium high-energy commercial look. IMPORTANT: Do not alter the environment or background structure. Keep the original background composition, but enhance atmosphere, depth, and grading. --- WATERMARK REMOVAL: Automatically detect, paint over, and completely remove any overlaid logos, text watermarks, or branding marks (such as the PhotoRoom watermark) present in the input composition. The final output must be 100% pristine and clean. --- RELIGHTING (High-Energy Studio Style): Relight the subject with punchy, brilliant commercial lighting: bright, clean key light that makes colors explode; vivid, crisp highlights on skin and clothing textures; dynamic colorful rim light that makes the subject leap forward from the background. Add beautiful highlight bloom and intense color radiance. --- SKIN & SUBJECT RENDERING: Realistic, flawless yet detailed skin texture with healthy, vibrant tones. Enhance facial expression to feel impactful, enthusiastic, and highly energetic. --- ATMOSPHERE: Crystal clear, luminous atmosphere with supreme digital clarity. Vibrant, energetic glow that emphasizes raw color power without adding noise. --- COLOR GRADING: Modern ultra-vivid look with rich, heavily saturated, deep colors. Clean, high-saturation contrast that preserves color details. Optimized specifically for maximum impact on tiny mobile screens. --- BACKGROUND: Do not change the structure or layout. Only enhance color depth, rich saturation, and pop-art contrast. OUTPUT: Sharp, detailed, high resolution, professional thumbnail background free of any watermarks."
    },
    {
      id: "cinema",
      name: "Cinema",
      note: "teal e laranja, ar de filme",
      sample: 'assets/samples/cinema.png',
      prompt: "Use the provided image as a base composition and layout reference. Create a premium, filmic, and cinematic YouTube thumbnail base image based on this draft. Maintain the original subject, framing, and general composition, but significantly enhance the visual quality to match a high-budget movie look. IMPORTANT: Do not alter the environment or background structure. Keep the original background composition, but enhance atmosphere, depth, and grading. --- WATERMARK REMOVAL: Automatically detect, paint over, and completely remove any overlaid logos, text watermarks, or branding marks (such as the PhotoRoom watermark) present in the input composition. The final output must be 100% pristine and clean. --- RELIGHTING (Hollywood Feature Film Style): Relight the subject with masterful cinematic anamorphic lighting: soft yet directional cinematic key light; beautifully balanced highlights on skin; soft anamorphic rim light separating the subject elegantly from the background; high-end cinema commercial and feature film influence. Add realistic anamorphic lens flare and highlight bloom on bright areas. --- SKIN & SUBJECT RENDERING: Realistic, lifelike skin texture matching professional cinema cameras (Arri/Red style). Enhance facial expression to feel nuanced, emotional, and deeply engaging. --- ATMOSPHERE: Clear, pristine cinematic atmosphere with great depth. Elegant, warm cinematic glow across light sources and highlights. --- COLOR GRADING: Hollywood premium color grading (Teal and Orange or Editorial film look). Cool, stylized shadows balanced with perfect natural skin tones. Cinematic tone mapping with rich midtones and deep, film-like blacks. --- BACKGROUND: Do not change the structure or layout. Only enhance depth of field (subtle bokeh) and cinematic lighting contrast. --- COMPOSITION & STYLE: Clean and balanced with premium subject separation. Optimized for YouTube thumbnail layout (16:9) with an ultra-realistic, high-end editorial look. Inspired by viral, high-CTR thumbnails. OUTPUT: Sharp, detailed, high resolution, professional thumbnail background free of any watermarks."
    },
    {
      id: "retro",
      name: "Retrô",
      note: "grão, pátina, arquivo antigo",
      sample: 'assets/samples/retro.png',
      prompt: "Use the provided image as a base composition and layout reference. Create an ultra-aged, highly weathered, and heavily desaturated vintage analog film style YouTube thumbnail base image based on this draft. Preserve the original subject, framing, and general composition with absolute fidelity. IMPORTANT: The output must be full-frame, without any borders, frames, or matte overlays. Do not add any framing elements. --- WATERMARK REMOVAL: Automatically detect, paint over, and completely remove any overlaid logos, text watermarks, or branding marks (such as the PhotoRoom watermark) present in the input composition. The final output must be 100% pristine and clean. --- COLOR GRADING & CAST (Ultra-Desaturated & Ancient): Extremely muted, drastically desaturated color palette where original colors are faded to their absolute limit. A heavy, dominant, rich antique amber-brown sepia patina cast must deeply coat the entire image, giving it a powerful historical archive appearance. Deep, rich, inky matte shadows with high tonal contrast. --- CRUCIAL FACE SHARPNESS (FIX FOR FACIAL DETAIL): ABSOLUTE REQUIREMENT: The main subject's face, eyes, and defining features must remain in pin-sharp, crystal-clear focus. Do not blur, distort, smooth out, or degrade the clarity of the human face. The heavy film grain and vintage patina must act as a transparent texture overlay, never compromising the sharp, high-definition details and crisp realism of the subject's expression and face. --- TEXTURE & NOISE: A dense, heavy layer of visible organic film grain and analog silver-halide noise scattered across the entire frame. Include micro-dust particles and tiny, authentic old film scratches to reinforce the archived cinematic print texture. --- RELIGHTING: Soft, moody, natural ambient light, slightly underexposed to enhance the aged, archival feel and the dramatic depth of the shadows. Soft, realistic halation bloom on highlight edges. OUTPUT: Sharp underlying facial details with a heavy, detailed, high-resolution overlay of weathered, aged film print texture free of any watermarks."
    },
    {
      id: "epico",
      name: "Épico",
      note: "refletor de arena, ouro",
      sample: 'assets/samples/epico.png',
      prompt: "Use the provided image as a base composition and layout reference. Create a highly epic, heroic, and intense YouTube thumbnail base image based on this draft. Maintain the original subject, framing, and general composition, but significantly enhance the visual quality to match a high-stakes championship or sports movie look. IMPORTANT: Do not alter the environment or background structure. Keep the original background composition, but enhance atmosphere, depth, and grading. --- WATERMARK REMOVAL: Automatically detect, paint over, and completely remove any overlaid logos, text watermarks, or branding marks (such as the PhotoRoom watermark) present in the input composition. The final output must be 100% pristine and clean. --- RELIGHTING (Stadium & Arena Floodlight Style): Relight the subject with powerful, dramatic overhead sports lighting: intense key light cutting from above; sharp, blinding specular highlights on skin and clothing; deep, rich athletic shadows; piercing golden or bright white rim light separating the subject with aggressive contrast from the background. Add realistic highlight bloom on intense light sources. --- SKIN & SUBJECT RENDERING: Hyper-detailed, realistic skin texture with a sharp, high-sweat or reflective sheen look. Enhance facial features to look fiercely focused, triumphant, or competitive without morphing the face. --- ATMOSPHERE: High-energy, dust-flecked arena atmosphere. Thick, volumetric depth with dramatic light beams slicing through a dark background. --- COLOR GRADING: High-contrast athletic commercial look. Deep, rich charcoal grays and blacks contrasted with blinding golds, warm ambers, or sharp whites. Heavy visual impact grading optimized for competition. OUTPUT: Sharp, detailed, high resolution, professional thumbnail background free of any watermarks."
    },
    {
      id: "quente",
      name: "Quente",
      note: "hora dourada, âmbar",
      sample: 'assets/samples/quente.png',
      prompt: "Use the provided image as a base composition and layout reference. Create a warm, nostalgic, and deeply inviting YouTube thumbnail base image based on this draft. Maintain the original subject, framing, and general composition, but significantly enhance the visual quality to match a premium golden-hour cinematic vlog look. IMPORTANT: Do not alter the environment or background structure. Keep the original background composition, but enhance atmosphere, depth, and grading to feel warm. --- WATERMARK REMOVAL: Automatically detect, paint over, and completely remove any overlaid logos, text watermarks, or branding marks (such as the PhotoRoom watermark) present in the input composition. The final output must be 100% pristine and clean. --- RELIGHTING (Golden Hour & Sunset Style): Relight the subject with beautiful, directional sun-kissed lighting: rich amber key light striking at an angle; warm, soft specular highlights; deep chocolatey, smooth shadows; intense golden rim light wrapping around the edges of the subject. Add soft, organic lens flares and volumetric sunbeams. --- SKIN & SUBJECT RENDERING: Lifelike, warm skin texture glowing under golden light. Enhance expressions to look authentic, welcoming, emotional, or deeply engaging. --- ATMOSPHERE: Cozy, rich, and atmospheric warm haze. Beautiful volumetric depth with floating light particles illuminated by sunset glow. --- COLOR GRADING: Nostalgic, rich warm-toned color grading. Deep cinematic browns and soft dark tones balanced perfectly with rich oranges, golds, and soft amber highlights. OUTPUT: Sharp, detailed, high resolution, professional thumbnail background free of any watermarks."
    }
  ];

  /* ── Gemini · os filtros ──────────────────────────────────────────────
     Prévia em 1K (1 ✦) e entrega em 2K (2 ✦).

     A API aceita imageSize 1K, 2K e 4K — não existe "0.5K". A prévia
     serve para julgar direção de arte, não nitidez, e isso se decide em
     enquadramento, luz e cor, tudo legível em 1K. Ver o README.         */

  var GEMINI_MODEL = 'gemini-3-pro-image-preview';
  var GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/';

  function inlineData(dataUrl) {
    var match = /^data:([^;]+);base64,(.*)$/.exec(dataUrl || '');
    return match ? { inlineData: { mimeType: match[1], data: match[2] } } : null;
  }

  function applyFilter(options) {
    var apiKey = window.TD_CONFIG.get('google');
    if (!apiKey) return Promise.reject(fail('auth', 'Falta a chave do Google AI.'));

    var parts = [{ text: options.prompt }];
    var inline = inlineData(options.image);
    if (inline) parts.push(inline);

    var url = GEMINI_ENDPOINT + GEMINI_MODEL + ':generateContent?key=' +
              encodeURIComponent(apiKey);

    /* A V2 já tinha aprendido isto: nem toda conta aceita imageConfig, e
       o erro vem como "Unknown name". Descer para uma configuração mais
       simples é só formato — o modelo e o prompt não mudam. */
    var attempts = [
      { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: '16:9', imageSize: options.size } },
      { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: '16:9' } },
      { responseModalities: ['IMAGE'] }
    ];

    function attempt(index) {
      if (index >= attempts.length) {
        return Promise.reject(fail('empty', 'A IA respondeu sem imagem.'));
      }

      return fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: parts }],
          generationConfig: attempts[index]
        }),
        signal: options.signal
      }).catch(function (error) {
        if (error && error.name === 'AbortError') throw error;
        throw fail('network', 'Não consegui falar com o Google AI.');

      }).then(function (response) {
        if (response.status === 401 || response.status === 403) {
          throw fail('auth', 'O Google AI recusou a chave.');
        }
        if (response.status === 429) {
          throw fail('quota', 'A cota da chave do Google AI acabou por agora.');
        }
        return response.json().catch(function () {
          throw fail('service', 'A resposta do Google AI não era JSON.');
        });

      }).then(function (body) {
        if (body.error) {
          var message = body.error.message || 'erro';
          /* Só o formato é negociável; cota, chave e modelo não. */
          if (/imageSize|imageConfig|aspectRatio|Unknown name|Invalid JSON/i.test(message)) {
            return attempt(index + 1);
          }
          if (/API key|permission|PERMISSION_DENIED|UNAUTHENTICATED/i.test(message)) {
            throw fail('auth', 'O Google AI recusou a chave.');
          }
          if (/quota|RESOURCE_EXHAUSTED/i.test(message)) {
            throw fail('quota', 'A cota da chave do Google AI acabou por agora.');
          }
          throw fail('service', message);
        }

        var candidate = body.candidates && body.candidates[0];
        var pieces = (candidate && candidate.content && candidate.content.parts) || [];
        var picture = pieces.filter(function (piece) { return piece.inlineData; })[0];

        if (picture) {
          return measure('data:' + (picture.inlineData.mimeType || 'image/png') +
                         ';base64,' + picture.inlineData.data);
        }

        var words = pieces.filter(function (piece) { return piece.text; })[0];
        if (words) {
          /* Acontece quando o pedido esbarra numa política: a IA explica
             por escrito em vez de desenhar. Repassar o texto dela é mais
             útil do que dizer "falhou". */
          throw fail('empty', 'A IA respondeu em texto: ' + words.text.slice(0, 160));
        }
        return attempt(index + 1);
      });
    }

    return attempt(0);
  }

  window.TD_AI = {
    FILTERS: FILTERS,
    removeBackground: removeBackground,
    applyFilter: applyFilter
  };

})(window, document);
