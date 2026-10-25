# El mando de Glitch.TEC

El mando es **solo la app Android** (`mando_android/`). La página no tiene ningún
control propio: ni mouse, ni gamepad, ni teclado. Es un stick y dos botones.

```
celular (app) --JSON/WebSocket--> relay Node (:3000) --> juego en el navegador
```

## Instalar la app

El APK ya compilado está en GitHub: [App del mando v1.0](https://github.com/santyAlv/GlitchTec/releases/tag/mando-v1.0)
(`glitchtec-mando.apk`, Android 7.0 o superior). En un celular, descargarlo y permitir apps de
origen desconocido; en un emulador, `adb install glitchtec-mando.apk`. No hace falta compilar nada:
`tools\mando_dev.ps1` lo compila solo si falta, o con `-Compilar`.

## Levantar todo

```powershell
powershell -ExecutionPolicy Bypass -File tools\mando_dev.ps1
```

Arranca el relay, el emulador Android (`-Avd dbz34`), instala el APK y abre la app.
Si algo ya está corriendo, lo deja como está. Opciones: `-Compilar` (recompila el
APK; pide un JDK 21 en `~\.jdks`), `-SinEmulador` (solo el relay, para usar un celular real),
`-Red` (el relay escucha en toda la red local).

El relay escucha **solo en esta PC** (`127.0.0.1`) porque no tiene autenticación: cualquiera
en la red podría mandarle movimientos al juego. El emulador llega igual por `10.0.2.2`. Con un
**celular real** hay que usar `-Red` (o `HOST=0.0.0.0 npm start` en `tools/mando_server`).

Después, en la app: **IP** `10.0.2.2` en el emulador (viene por defecto; en un celular real, la
IPv4 de la PC, `ipconfig`), **puerto** `3000`, y entrar a **Analogico**. Abrir el juego con un
servidor estático (`python -m http.server 8123` en la raíz) en `http://localhost:8123`, o con
PHP (ver "Backend"). Si el relay está en otra máquina: `index.html?mando=IP:PUERTO`.

## Mensajes (app → relay → juego)

| Mensaje | Significado |
|---|---|
| `{"x":0.5,"y":-0.3}` | stick, de -1 a 1; **y arriba = +** (el juego lo invierte) |
| `{"button":"left","down":true}` | botón izquierdo apretado (`false` = soltado) |
| `{"button":"right","down":true}` | botón derecho |

También se acepta `{"action":"LEFT_DOWN"}` / `LEFT_UP` / `RIGHT_DOWN` / `RIGHT_UP`.
Si el APK cambia de formato, solo se toca `apply()` en `js/input.js`.

## Qué usa cada sector del juego

- **Eventos del mando** (`js/input.js`), por el bus: `GT.on('pad:left' | 'pad:right', e => e.down)`,
  `GT.on('pad:stick', e => e.x, e.y)`, `GT.on('pad:status', e => e.connected)`.
  Para leer el estado en un loop: `GT.input.axes()` (y abajo = +), `GT.input.isDown('left')`.
- **Menús radiales:** `GT.input.sector(dx, dy, n)` → sector 0..n-1 (0 = arriba, horario) o -1 en reposo.
- **Cursor virtual** (`js/cursor.js`): el stick mueve un puntero y los botones hacen
  `mousedown/click` y `contextmenu` reales sobre lo que tenga debajo, así todo el escritorio
  responde al mando. Un minijuego que usa el stick para otra cosa lo cede con `GT.cursor.hold(true)`.
- **Minijuegos** (`js/minigame.js`): `GT.minigame.register(id, {start, tick, stop, holdCursor})`,
  `start(id)`, `finish(resumen)` (guarda el evento `<id>_round` en la base), `stop()`.
  Ejemplo completo: `js/firewall.js`.
- **RAM virtual:** `GT.drainRam(n)` / `GT.freeRam(n)`, estado en `GT.state.ram` (0-100), eventos
  `ram` y `ramfull`.
- **Taller (minijuegos de hardware):** reputación = integridad (`GT.damage` / `GT.heal`). Minutos de la
  orden: `GT.tech.addMinutes(n)`. `GT.tech.faults()` → `[{id, found, fixed}]` de la orden en curso, y
  `GT.tech.applyRepair(falla, ok, {minutes, rep, part})` aplica el resultado: si `ok`, la falla queda
  reparada con el mismo premio que desde el taller; si no, corta la racha y baja `rep` de reputación.
- **Terminal:** `GT.terminal.commands()` → `[{name, desc}]` para armar el menú radial, y
  `GT.terminal.run('scan archivo.exe')` ejecuta un comando como si se escribiera.
- **Puntaje:** `GT.correct(base, motivo)` / `GT.wrong(penalidad, motivo)` / `GT.addScore`.

## Backend (PHP + MySQL)

- **Rondas de minijuego:** `GT.minigame.finish({accuracy: 0-100, ...lo propio})`. El marco agrega solo
  `points` y `secs`, y `api/ronda.php` lo guarda en la tabla `minijuegos` (más un evento `<id>_round`).
  Un minijuego nuevo no toca el PHP: el `id` solo tiene que ser `[a-z][a-z0-9_]{1,29}`.
- **Eventos sueltos:** `GT.api.logEvent(tipo, detalle)`. Exigen el token de la partida y el detalle pesa
  como máximo 4 KB. En una partida ya cerrada se rechazan; máximo 200 rondas por partida.
- **Ranking por minijuego:** `GT.api.getMinigameRanking('firewall', 10)` → `api/ranking.php?minijuego=firewall`
  (las mejores rondas de todos los jugadores). `api/mis_partidas.php` trae además `minijuegos`: rondas,
  mejor puntaje y precisión media del jugador, por tipo.
- **Partidas sospechosas:** si el cliente declara más segundos jugados de los que el servidor vio, la
  partida se cierra pero no entra al ranking (`partidas.sospechosa = 1`).
- **Base de datos:** una base nueva con `sql/schema.sql` ya trae todo; una existente necesita
  `sql/migracion_minijuegos.sql` (una sola vez).
- **Probar la API de punta a punta:** con PHP y MySQL corriendo, `node tools/probar_api.js
  [http://localhost/GlitchTec/api]`. Crea partidas `test_*`, así que conviene una base de desarrollo.

## Problemas comunes

- **"SIN MANDO"** en el juego: el relay no está corriendo o la app no se conectó.
- **El puntero no se mueve en las pruebas:** el navegador pausa la animación si la pestaña está oculta.
- **No instala el APK:** si hay otra versión firmada con otra clave, `adb uninstall com.example.rectangulo_node`.
- **El celular real no conecta:** firewall de Windows (puerto 3000) o Wi-Fi que aísla a los clientes.
