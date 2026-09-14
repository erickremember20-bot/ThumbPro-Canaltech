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
  cat js/config.js js/canvas.js js/text.js js/ai.js js/app.js
  echo '</script>'
  echo '</body>'
  echo '</html>'
} > "$OUT"

printf 'thumbdrop.html · %s KB\n' "$(( $(wc -c < "$OUT") / 1024 ))"
