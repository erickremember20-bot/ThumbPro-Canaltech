#!/bin/sh
# ---------------------------------------------------------------------
# Junta os oito arquivos num thumbdrop.html único, que abre com duplo
# clique e não precisa de nada.
#
# ISTO NÃO É UMA ETAPA DE BUILD DO PROJETO. É sh puro, sem npm, sem
# bundler, sem dependência. Os arquivos separados continuam funcionando
# sozinhos em index.html — rodar isto é só para ter a versão de um
# arquivo só para mandar por e-mail ou guardar.
# ---------------------------------------------------------------------
set -e
cd "$(dirname "$0")"

# ---------------------------------------------------------------------
# PASSO 1 · embutir as molduras
#
# Desenhar um PNG carregado de assets/ dentro do canvas CONTAMINA o
# canvas quando a página roda em file://, e toDataURL passa a lançar
# SecurityError — ou seja, o export quebraria justamente quando a pessoa
# escolhe a moldura da marca. E em file:// não há como ler os bytes de um
# arquivo local por fetch nem por XHR: o navegador bloqueia os dois.
#
# Então as molduras entram no código como data URI. assets/frames/
# continua sendo a fonte da verdade; js/frames.js é gerado dela.
#
# TROCOU UMA MOLDURA? RODE ESTE SCRIPT DE NOVO.
# ---------------------------------------------------------------------

{
  echo '/* GERADO POR build.sh A PARTIR DE assets/frames/ — não edite à mão.'
  echo '   As molduras vivem aqui como data URI porque um PNG carregado de'
  echo '   assets/ contamina o canvas em file:// e quebraria o export. */'
  echo 'window.TD_FRAMES = {'
  for id in canaltech ct-eletro; do
    file="assets/frames/moldura-$id.png"
    if [ -f "$file" ]; then
      printf "  '%s': 'data:image/png;base64,%s',\n" \
        "$(echo "$id" | tr -d '-')" "$(base64 -w0 < "$file")"
    fi
  done
  echo '};'
} > js/frames.js

printf 'js/frames.js · %s KB\n' "$(( $(wc -c < js/frames.js) / 1024 ))"

# ---------------------------------------------------------------------
# PASSO 2 · juntar tudo num arquivo
# ---------------------------------------------------------------------

OUT=thumbdrop.html

{
  # tudo do index até o primeiro <link>, sem os <link>
  sed -n '1,/<link rel="stylesheet"/p' index.html | sed '/<link rel="stylesheet"/d'

  echo '<style>'
  # O CSS separado mora em css/, então aponta para ../assets/. Inline na
  # raiz, esse caminho sairia do repositório — vira assets/.
  cat css/tokens.css css/app.css | sed 's|\.\./assets/|assets/|g'
  echo '</style>'

  # o corpo, sem as tags de <link> e <script>
  sed -n '/<link rel="stylesheet" href="css\/app.css">/,$p' index.html \
    | sed '/<link rel="stylesheet"/d' \
    | sed '/<script src="js\//d' \
    | sed '/<\/body>/d' | sed '/<\/html>/d'

  echo '<script>'
  cat js/frames.js js/config.js js/canvas.js js/text.js js/ai.js js/app.js
  echo '</script>'
  echo '</body>'
  echo '</html>'
} > "$OUT"

printf 'thumbdrop.html · %s KB\n' "$(( $(wc -c < "$OUT") / 1024 ))"
