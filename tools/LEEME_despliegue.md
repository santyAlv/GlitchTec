# Publicar Glitch.TEC en HostGator con un dominio gratis

El juego queda en `https://glitchtec.dpdns.org`: el dominio es gratis
(DigitalPlat FreeDomain) y el hosting es el plan de HostGator con cPanel.
Necesita PHP 8 y MySQL para las cuentas y el ranking; el resto es estático.

Lo que pide cuentas o contraseñas (pasos 1 a 4) lo hacés vos desde el
navegador. Lo demás lo hace `tools/desplegar.sh`.

## 1. Pedir el dominio en DigitalPlat

1. Entrá a <https://dash.domain.digitalplat.org/> y creá la cuenta con datos
   reales (nombre, mail, teléfono y dirección). Es un dominio por cuenta.
2. Registrá `glitchtec.dpdns.org`.
3. En **Nameservers** cargá los dos de tu cuenta de HostGator, tal cual
   aparecen en el mail de bienvenida o en el cPanel (*Información general*).
   Son nombres de servidor, no direcciones IP. DigitalPlat no tiene editor de
   registros DNS: desde acá en adelante el DNS lo maneja HostGator.

## 2. Agregar el dominio en el cPanel

*Dominios → Crear un dominio nuevo*: `glitchtec.dpdns.org`, con la carpeta
que propone (`glitchtec.dpdns.org`). Esa carpeta es la que va en `CARPETA`.

## 3. Crear la base de datos

1. *Bases de datos MySQL*: creá la base `glitchtec` y un usuario con una
   clave nueva. Asignale el usuario a la base con **todos los privilegios**.
   El cPanel les agrega tu usuario adelante (`usuariocpanel_glitchtec`).
2. Generá el SQL para importar (sin `CREATE DATABASE` ni `USE`, que en un
   hosting compartido fallan):

   ```bash
   tools/desplegar.sh sql > glitchtec.sql
   ```

3. *phpMyAdmin*: elegí la base y, en **Importar**, subí `glitchtec.sql`.

## 4. Autorizar la clave SSH

La clave del despliegue está en `~/.ssh/glitchtec_hostgator` (la privada no
sale de tu PC). En *Seguridad → Acceso SSH → Administrar claves SSH →
Importar clave*, pegá el contenido de `~/.ssh/glitchtec_hostgator.pub` y
después tocá **Autorizar**. Si el plan no tiene SSH habilitado, se pide por
chat al soporte de HostGator.

## 5. Completar los dos archivos locales

Ninguno de los dos va a git:

- `api/config.local.php`: copiá `api/config.local.example.php` y poné la base,
  el usuario y la clave del paso 3.
- `tools/desplegar.env`: copiá `tools/desplegar.env.example` y poné tu usuario
  de cPanel, el servidor y la carpeta del paso 2.

## 6. Subir

```bash
tools/desplegar.sh
```

Sube lo que está commiteado (sin `tools`, `mando_android`, `capturas`, `sql`
ni los `.md`) y `api/config.local.php` con permisos 600. Para actualizar el
sitio, commiteá y volvé a correrlo.

## 7. HTTPS y verificación

1. Los nameservers tardan de minutos a horas en propagarse:

   ```bash
   nslookup -type=NS glitchtec.dpdns.org
   ```

   tiene que responder los dos nameservers de HostGator.
2. *SSL/TLS Status → Run AutoSSL* para emitir el certificado.
3. Con el certificado emitido, descomentá las tres líneas de HTTPS en
   `.htaccess`, commiteá y volvé a subir.
4. `https://glitchtec.dpdns.org/api/ping.php` tiene que responder
   `"ok":true,"db":true`. Si `db` da `false`, revisá `api/config.local.php`.

## Alternativa: el VPS con Docker y Traefik

Así está publicado hoy, en el VPS de HostGator (`69.6.206.117`, SSH en el
puerto 22022) donde ya corren n8n y otros sitios detrás de Traefik.

- `/opt/glitchtec` tiene `tools/vps/Dockerfile` (PHP 8.3 + Apache con
  `pdo_mysql`), `tools/vps/docker-compose.yml` y `sql/schema.sql`. El compose
  levanta el juego y un MariaDB propio. Traefik lo publica con HTTPS de Let's
  Encrypt en cuanto el dominio apunta al VPS.
- `/opt/glitchtec/.env` (600) tiene las claves de la base, generadas en el
  servidor con `openssl rand`. `sitio/api/config.local.php` se generó a partir
  de ese archivo; no hay copia local.
- `tools/desplegar.env` apunta a `root@69.6.206.117`, puerto 22022, con
  `CARPETA=/opt/glitchtec/sitio`. Para actualizar el juego basta con correr
  `tools/desplegar.sh`: Apache sirve la carpeta directo, sin reiniciar nada.
- DNS: `glitchtec.dpdns.org` necesita un registro A a `69.6.206.117` en un DNS
  externo (por ejemplo Cloudflare, con la nube en gris para que Traefik pueda
  emitir el certificado), y esos nameservers cargados en DigitalPlat.

## Qué no funciona en el hosting

El relay del mando (`tools/mando_server`) es Node con WebSocket y un hosting
compartido no lo corre: el juego anda igual y el panel del QR avisa que el
relay no está encendido.
