#!/bin/sh
# ---------------------------------------------------------------------
# Gera thumbdrop.html: UM arquivo que abre com duplo clique e funciona
# sozinho, sem pasta ao lado.
#
# ISTO NÃO É UMA ETAPA DE BUILD DO PROJETO. index.html e os arquivos
# separados funcionam sem rodar nada. Isto é só o empacotador.
#
# TROCOU QUALQUER COISA EM assets/? RODE ESTE SCRIPT.
# ---------------------------------------------------------------------
set -e
cd "$(dirname "$0")"

# ---------------------------------------------------------------------
# PASSO 1 · as molduras viram data URI em js/frames.js
#
# Desenhar no canvas um PNG carregado de assets/ CONTAMINA o canvas
# quando a página roda em file://, e toDataURL passa a lançar
# SecurityError — o export quebraria justamente quando a pessoa escolhe a
# moldura da marca. E em file:// não há como ler os bytes de um arquivo
# local por fetch nem por XHR: o navegador bloqueia os dois.
#
# Por isso as molduras entram no CÓDIGO, e não só no arquivo único:
# index.html também depende disto.
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

printf 'js/frames.js   %s KB\n' "$(( $(wc -c < js/frames.js) / 1024 ))"

# ---------------------------------------------------------------------
# PASSO 2 · juntar tudo, e embutir fontes e amostras
#
# As fontes e as amostras não passam pelo canvas, então não contaminam
# nada — elas poderiam continuar sendo carregadas de assets/. Entram
# embutidas por outro motivo: para o arquivo final ser UM arquivo de
# verdade, que funciona na pasta de Downloads sem nada ao lado.
# ---------------------------------------------------------------------

OUT=thumbdrop.html

{
  sed -n '1,/<link rel="stylesheet"/p' index.html | sed '/<link rel="stylesheet"/d'

  echo '<style>'
  cat css/tokens.css css/app.css | sed 's|\.\./assets/|assets/|g'
  echo '</style>'

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

# Troca cada caminho de assets/ pelo conteúdo do arquivo, em base64.
python3 - "$OUT" <<'PYEOF'
import base64, re, sys, os

path = sys.argv[1]
html = open(path, encoding='utf8').read()
tipos = {'.woff2': 'font/woff2', '.png': 'image/png', '.jpg': 'image/jpeg'}
faltando, embutidos, bytes_ = [], 0, 0

def trocar(m):
    global embutidos, bytes_
    arquivo = m.group(1)
    if not os.path.isfile(arquivo):
        faltando.append(arquivo)
        return m.group(0)
    mime = tipos.get(os.path.splitext(arquivo)[1], 'application/octet-stream')
    dados = open(arquivo, 'rb').read()
    embutidos += 1
    bytes_ += len(dados)
    return m.group(0).replace(arquivo, 'data:%s;base64,%s' % (mime, base64.b64encode(dados).decode()))

# assets/frames/ fica de fora: as molduras já entraram por js/frames.js, e
# o caminho que sobra no código é só a reserva para quando a página é
# servida por http. Embutir de novo duplicaria 70 KB à toa.
html = re.sub(r"(assets/(?!frames/)[A-Za-z0-9_\-./]+\.(?:woff2|png|jpg))", trocar, html)
open(path, 'w', encoding='utf8').write(html)

print('embutidos      %d arquivos, %d KB de origem' % (embutidos, bytes_ // 1024))
if faltando:
    print('NÃO ENCONTRADOS: ' + ', '.join(sorted(set(faltando))))
PYEOF

# Nenhum PONTO DE CARGA pode apontar para assets/: se apontar, o arquivo
# não é autossuficiente e vai falhar em silêncio na máquina de outra
# pessoa. Menções em comentário não contam, e o caminho de reserva das
# molduras também não — ele nunca é buscado quando o data URI existe.
if grep -Eq "url\(['\"]?assets/|src=['\"]assets/" "$OUT"; then
  echo "AVISO: $OUT ainda carrega algo de assets/"
  grep -Eo "url\(['\"]?assets/[A-Za-z0-9_./-]*|src=['\"]assets/[A-Za-z0-9_./-]*" "$OUT" | sort -u | sed 's/^/  /'
  exit 1
fi

printf '%s   %s KB · autossuficiente\n' "$OUT" "$(( $(wc -c < "$OUT") / 1024 ))"
