#!/usr/bin/env bash
# ============================================================
# Glitch.TEC — pasa la API del VPS a la base de Supabase.
# Correr en el VPS, dentro de /opt/glitchtec:   bash usar_supabase.sh
# Pide la contraseña de la base sin mostrarla, prueba la conexión y recién
# ahí reemplaza sitio/api/config.local.php. Si no conecta, no toca nada.
# Volver a MariaDB:  cp config.local.mariadb.php sitio/api/config.local.php
# ============================================================
set -euo pipefail
cd "$(dirname "$0")"

HOST=aws-0-us-east-1.pooler.supabase.com      # Session pooler: IPv4, puerto 5432
USUARIO=postgres.klltsnmcdjwnibylespr
CONF=sitio/api/config.local.php

read -r -s -p "Contraseña de la base de Supabase: " CLAVE; echo
[ -n "$CLAVE" ] || { echo "Contraseña vacía: no cambié nada."; exit 1; }

# var_export la deja como literal de PHP aunque tenga comillas o barras
LITERAL=$(printf '%s' "$CLAVE" | docker exec -i glitchtec php -r 'echo var_export(stream_get_contents(STDIN), true);')

NUEVO=$(mktemp)
cat > "$NUEVO" <<PHP
<?php
// Generado por tools/vps/usar_supabase.sh: base en Supabase (no está en git)
declare(strict_types=1);
const DB_DRIVER   = 'pgsql';
const DB_HOST     = '$HOST';
const DB_PORT     = 5432;
const DB_NAME     = 'postgres';
const DB_USER     = '$USUARIO';
const DB_PASS     = $LITERAL;
const CORS_ORIGIN = 'https://glitchtec.dpdns.org';
PHP

# Prueba con la configuración nueva antes de ponerla en uso
docker cp "$NUEVO" glitchtec:/tmp/prueba_conf.php >/dev/null
if ! docker exec glitchtec php -r 'require "/tmp/prueba_conf.php"; new PDO("pgsql:host=".DB_HOST.";port=".DB_PORT.";dbname=".DB_NAME.";sslmode=require", DB_USER, DB_PASS); echo "conexión OK\n";'; then
  docker exec glitchtec rm -f /tmp/prueba_conf.php
  rm -f "$NUEVO"
  echo "No conectó con Supabase: revisá la contraseña. La API sigue con la base anterior."
  exit 1
fi

docker exec glitchtec rm -f /tmp/prueba_conf.php
[ -f config.local.mariadb.php ] || cp "$CONF" config.local.mariadb.php
chmod 600 config.local.mariadb.php
cp "$NUEVO" "$CONF"; rm -f "$NUEVO"
chown root:33 "$CONF"; chmod 640 "$CONF"
echo "Listo: la API ahora usa Supabase."
