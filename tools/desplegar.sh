#!/usr/bin/env bash
# ============================================================
# Glitch.TEC — sube el juego al hosting por SSH
#   tools/desplegar.sh          sube lo commiteado (git archive) a $CARPETA
#   tools/desplegar.sh sql      imprime el esquema listo para importar en
#                               phpMyAdmin (sin CREATE DATABASE ni USE)
# Lee tools/desplegar.env (copiá desplegar.env.example). Corre desde Git Bash.
# ============================================================
set -euo pipefail
cd "$(dirname "$0")/.."

# En el hosting compartido la base la crea el cPanel con su prefijo: el
# esquema no puede crearla ni hacerle USE.
if [ "${1:-}" = "sql" ]; then
  sed -e '/^CREATE DATABASE/,/;/d' -e '/^USE /d' sql/schema.sql
  exit 0
fi

[ -f tools/desplegar.env ] || { echo "Falta tools/desplegar.env (copiá desplegar.env.example)"; exit 1; }
. tools/desplegar.env
SSH="ssh -i ${SSH_CLAVE/#\~/$HOME} -p $SSH_PUERTO $SSH_DESTINO"

[ -z "$(git status --porcelain -- . ':!.agentes')" ] ||
  echo "Ojo: hay cambios sin commitear; se sube sólo lo commiteado."

# ponytail: no borra en el servidor los archivos que ya no existen en el repo;
# si alguna vez sobra algo, borralo a mano desde el cPanel.
echo "Subiendo $(git rev-parse --short HEAD) a $SSH_DESTINO:$CARPETA ..."
git archive --format=tar HEAD -- . \
    ':!tools' ':!mando_android' ':!capturas' ':!sql' ':!*.md' ':!.gitignore' |
  $SSH "mkdir -p '$CARPETA' && tar -xf - -C '$CARPETA'"

if [ -f api/config.local.php ]; then
  $SSH "cat > '$CARPETA/api/config.local.php' && chmod 600 '$CARPETA/api/config.local.php'" < api/config.local.php
  echo "Subí api/config.local.php (permisos 600)."
else
  echo "No hay api/config.local.php: la API va a intentar conectarse con los datos de XAMPP."
fi
echo "Listo."
