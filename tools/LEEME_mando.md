# El mando de Glitch.TEC

El mando es **solo la app Android** (`mando_android/`). La página no tiene ningún
control propio: ni mouse, ni gamepad, ni teclado. Es un stick y dos botones.

```
celular (app) --JSON/WebSocket--> relay Node (:3000) --> juego en el navegador
```

## Levantar todo

```powershell
powershell -ExecutionPolicy Bypass -File tools\mando_dev.ps1
```

Arranca el relay, el emulador Android (`-Avd dbz34`), instala el APK y abre la app.
Si algo ya está corriendo, lo deja como está. Opciones: `-Compilar` (recompila el
APK; pide un JDK 21 en `~\.jdks`), `-SinEmulador` (solo el relay, para usar un celular real).

Después, en la app: **IP** `10.0.2.2` en el emulador (o la IPv4 de la PC, `ipconfig`, en un
celular real en la misma red), **puerto** `3000`, y entrar a **Analogico**. Abrir el juego
con un servidor estático (`python -m http.server 8123` en la raíz) en `http://localhost:8123`.
Si el relay está en otra máquina: `index.html?mando=IP:PUERTO`.

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
- **Taller:** reputación = integridad (`GT.damage` / `GT.heal`); minutos de la orden: `GT.tech.addMinutes(n)`.
- **Puntaje:** `GT.correct(base, motivo)` / `GT.wrong(penalidad, motivo)` / `GT.addScore`.

## Problemas comunes

- **"SIN MANDO"** en el juego: el relay no está corriendo o la app no se conectó.
- **El puntero no se mueve en las pruebas:** el navegador pausa la animación si la pestaña está oculta.
- **No instala el APK:** si hay otra versión firmada con otra clave, `adb uninstall com.example.rectangulo_node`.
- **El celular real no conecta:** firewall de Windows (puerto 3000) o Wi-Fi que aísla a los clientes.
