# Glitch.TEC — Resumen para estudiar y defender el proyecto

> Materia PISWD · Prof. Callamullo Diego · Back-End: Alvarez Santiago · Front-End: Cora Alex · Liderazgo: Gomez Nayla · Diseño: Ortiz Morena

## 1. Qué es (la frase de defensa)

**Glitch.TEC** es un videojuego educativo de informática que corre en el navegador, con dos modos:

| Modo | Idea | Qué enseña |
|---|---|---|
| **PC Corrompida** (software) | Un escritorio retro "WinTEC 95" infectado por un malware. Terminal real, archivos, procesos, correo, ransomware, hacker que molesta. 5 niveles + tutorial. | Malware, phishing, doble extensión, binario/XOR, firma digital, backup, puntos de restauración, particiones |
| **Servicio Técnico** (hardware) | Sos el técnico de un taller en un banco 3D: diagnosticás, reparás, explicás la falla. 8 órdenes principales + más (hasta ~39) | Fuente, RAM/POST, térmica, disco SMART, humedad, redes (RJ45, switch), pila CMOS |

Se controla con una **app Android** (stick + 2 botones) que habla con el juego por WebSocket.
Tiene **cuentas de usuario, ranking global y partidas guardadas** en MySQL, y funciona también **offline** (localStorage).

---

## 2. Stack tecnológico

| Capa | Tecnología | Para qué |
|---|---|---|
| Interfaz | **HTML5 + CSS3 + JavaScript (ES5 "vanilla")** | Todo el juego, sin frameworks ni librerías de UI |
| Motor gráfico | **p5.js** (`js/vendor/p5.min.js`) | Efecto CRT, medidores CPU/RAM, jefe final (2D) y **banco 3D en WEBGL** |
| Servidor | **PHP** (PDO) | API REST que devuelve JSON |
| Base de datos | **MySQL / MariaDB** | Usuarios, partidas, eventos, minijuegos |
| Servidor local | **XAMPP** (Apache + PHP + MySQL) | Desarrollo y demo |
| Relay del mando | **Node.js + `ws`** (`tools/mando_server/server.js`) | Reenvía mensajes del celular al juego por WebSocket |
| App del mando | **Android, Kotlin** (Gradle) | Stick analógico + botones. Libs: AndroidX, Material3, **OkHttp 5.1** (WebSocket), **ML Kit code scanner** (escanear QR) |
| QR | `js/vendor/qrcode.js` | El juego dibuja el QR para conectar el celular |
| Modelos 3D | **.OBJ/.MTL** (Blender) | Piezas del taller, exportadas desde `bench3d.js` con `tools/exportar_modelos.js` |
| Control de versiones | **Git + GitHub** | Ramas, releases (APK del mando v1.1) |

**Dato clave para defender:** *no hay librerías externas de UI*. Solo p5.js, qrcode.js y `ws` (Node). El aspecto retro está hecho a mano con CSS.

---

## 3. Arquitectura (cómo se conecta todo)

```
 Celular (app Kotlin) --WebSocket JSON--> Relay Node :3000 --> Navegador (juego)
                                                                  |
                                       index.html + css/ + js/  ——fetch——> api/*.php ——PDO——> MySQL
                                            (p5.js)                  (si no hay PHP: localStorage)
```

### Patrones de diseño importantes (¡los preguntan!)

1. **Namespace global único `window.GlitchTec` (alias `GT`)**. Cada archivo `.js` es una **IIFE** `(function(window){ ... })(window)` para no ensuciar el ámbito global. Es un "módulo del pobre" sin `import/export`.
2. **Bus de eventos**: `GT.on('evento', fn)` / `GT.emit('evento', datos)` (en `js/state.js`). Los módulos se comunican sin conocerse (ej.: el ransomware emite `ransom`, el HUD escucha; `fs`, `disk`, `auth`, `pad:left`...).
3. **Estado centralizado** en `GT.state` (integridad, puntaje, nivel, infección, `fsRoot`, `disk`...).
4. **Balance en un solo lugar**: `GT.CONFIG` en `js/state.js` (tiempos del ransomware, rachas, cuota de disco, pistas por nivel...). Para hacer el juego más fácil/difícil se toca ahí.
5. **Niveles y órdenes como datos, no código**: `js/levels.js` (objetos con `name`, `objectives`, `intro`, `outro`, `hint`) y `js/tech.js` / `tech_ordenes.js` (arrays `CASES`, pasos en `STEPS`). Agregar contenido = agregar un objeto.
6. **Fallback online/offline**: `js/api.js` decide si usa PHP+MySQL o `localStorage`; el juego no se entera.
7. **Orden de carga de scripts importa**: está en `index.html` (líneas ~655-690): p5 → state → assets → audio → engine → ui → filesystem → terminal → … → api → auth → ranking → **game.js al final** (orquestador).

---

## 4. Estructura de carpetas (qué hay en cada lugar)

| Ruta | Contenido |
|---|---|
| `index.html` | Un solo HTML con todas las "pantallas" (título, modos, escritorio, taller, auth, ranking…) |
| `css/` | `base.css` (paleta, biseles), `screens`, `desktop`, `windows`, `effects` (CRT), `hacker`, `tech`, `assets`, `y2k`, `detalle`, `cuenta`, `chat`, `cazapopups`, `radial`, `soldadura` |
| `js/` | ~35 módulos (ver tabla abajo) |
| `api/` | Endpoints PHP |
| `sql/` | `schema.sql`, `migracion_usuarios.sql`, `migracion_minijuegos.sql` |
| `mando_android/` | Proyecto Android Studio (Kotlin): `Inicio.kt`, `Analogico.kt`, `Configuracion.kt` |
| `tools/` | Relay Node, script `mando_dev.ps1`, exportador de modelos 3D, `probar_api.js`, guías `LEEME_*.md` |
| `EntidadesGraficas/` | Arte: iconos PNG, identidad visual (logo, paleta, fondo), botones del mando, **modelos 3D .obj** |
| `capturas/` | 34 screenshots de todas las vistas |

### Mapa de módulos JS

| Módulo | Responsabilidad |
|---|---|
| `state.js` | Estado global, `GT.CONFIG`, bus de eventos, puntaje, daño, RAM |
| `game.js` | Orquestador: loop, selección de modo, inicio/fin de partida |
| `levels.js` | Niveles 0–5 y objetivos |
| `terminal.js` | CLI: `help dir cd type scan unlock kill purge del copy move ren md rd espacio backup diag restore part decrypt bot` |
| `filesystem.js` | Árbol de archivos con **cuota de disco** (C: 2 GB), `GT.fs.*` devuelve `{ok}` o `{error}` sin excepciones |
| `explorer.js` / `processes.js` / `mail.js` | Explorador, Administrador de tareas (procesos firmados/sin firma), TEC-Mail (phishing) |
| `sysutils.js` | Backup, puntos de restauración, particiones, `diag` |
| `ransom.js` | Nivel 4: cifrado XOR, reloj, descifrado |
| `hacker.js` | GL1TCH-M4N: se mueve, bloquea teclas, invierte colores |
| `popups.js`, `boss.js` | Pop-ups del malware; jefe final (purga) con barra de vida |
| `bench3d.js` | **Sketch p5 WEBGL**: banco 3D del taller (cámara, piezas, herramientas) |
| `tech.js`, `tech_ordenes.js`, `tienda.js`, `detalle.js` | Modo taller: órdenes, pasos, repuestos con plata, ficha técnica |
| `chatbot.js` | TEC-Bot: ~33 temas, buscador con normalización, pistas con cupo |
| `firewall.js`, `cazapopups.js`, `soldadura.js` | **Minijuegos** con el mando |
| `input.js`, `cursor.js`, `radial.js`, `mandoqr.js` | Mando: WebSocket, cursor virtual, menú radial, QR |
| `api.js`, `auth.js`, `ranking.js` | Cliente servidor, cuentas, ranking |
| `assets.js`, `audio.js`, `engine.js`, `ui.js` | Catálogo de arte, sonido, sketches p5 (CRT, CPU/RAM, núcleo), UI |

---

## 5. Backend: PHP + MySQL

### Base de datos (`sql/schema.sql`)
- **`usuarios`**: `username` y `email` UNIQUE, `password_hash`, `intentos_fallidos`, `bloqueado_hasta`.
- **`partidas`**: puntaje, `modo` (`virus`/`tecnico`), `won`, `user_id`, token, stats (errores, pistas…).
- **`eventos`**: log de gameplay.
- **`minijuegos`**: por ronda (`tipo`, `puntos`, `segundos`, `precision_pct`, `detail_json`), FK a `partidas` con `ON DELETE CASCADE`.

### Endpoints (`api/`)
`ping` (healthcheck) · `registro` · `login` · `logout` · `sesion` · `mis_partidas` · `partida_start` · `partida_end` · `evento` · `ranking` · `ronda` (minijuegos). `auth.php` es la biblioteca (validación, hash, sesión) y `config.php` la conexión.

### Seguridad (punto fuerte para la defensa)
- **Contraseñas**: `password_hash` (bcrypt con sal propia). Nunca se guardan en claro.
- **SQL injection**: PDO con `EMULATE_PREPARES => false` → sentencias preparadas **reales**.
- **Sesión**: cookie `HttpOnly` + `SameSite=Strict`, ID regenerado al loguear.
- **Fuerza bruta**: bloqueo de 5 min tras 5 intentos fallidos; mismo error exista o no la cuenta (evita enumerar usuarios).
- **Validación doble**: en JS (rápida) y en PHP (la que vale).
- **Anti-trampa**: cada partida recibe un **token secreto**; sin él no se cierra y una partida cerrada no se reescribe. Los números se recortan a rangos válidos. El usuario se toma de la **sesión**, nunca de lo que manda el navegador.
- Punto débil honesto: CORS `*` y relay sin autenticación (ambos documentados, aceptable para un TP local).

---

## 6. Frontend: la dirección de arte "WinTEC 95"

- **Paleta con variables CSS** en `css/base.css`: `--face` (gris de ventanas), `--title-1/2` (barra azul), `--desk` (escritorio), y fósforo CRT `--green --amber --red --cyan`.
- **Biseles** con `box-shadow` (`--bevel-out/in`) en vez de bordes redondeados.
- **Filtro CRT** en `css/effects.css`: scanlines, máscara RGB, viñeta, parpadeo. Más un sketch p5 con estática y tearing ligado a la infección.
- **Sistema de assets**: todo gráfico va dentro de un contenedor `.asset` de tamaño fijo con 3 estados: `is-final` (PNG de diseño), `is-draft` (SVG provisional), `is-pending` (marcador). Así el arte se enchufa sin mover la maqueta.

---

## 7. Cómo editar cada cosa (guía práctica)

| Quiero… | Archivo | Cómo |
|---|---|---|
| Cambiar **colores / estilo** | `css/base.css` (`:root`) | Tocar las variables `--face`, `--desk`, `--green`… |
| Cambiar el **filtro CRT** | `css/effects.css` | Intensidad de scanlines, viñeta, parpadeo |
| Agregar/cambiar un **icono** | `js/assets.js` | Una línea: `'app.mail': 'mail.png'`, con el PNG en `EntidadesGraficas/Diseño/iconos/`. Ver faltantes: consola `GlitchTec.assets.revisar()` |
| Ajustar **dificultad/balance** | `js/state.js` → `GT.CONFIG` | Tiempos, daños, cuotas, rachas, pistas |
| Editar un **nivel** del modo software | `js/levels.js` → `DEFS` | Cambiar `objectives`, `intro`, `outro`, `hint` |
| Agregar un **comando de Terminal** | `js/terminal.js` | `COMMANDS.nombre = { desc: '…', run: function(args){…} }` |
| Agregar una **orden de trabajo** del taller | `js/tech_ordenes.js` (o `tech.js`) | Nuevo objeto en `CASES`; reusar pasos de `STEPS` o definir nuevos |
| Agregar un **tema a TEC-Bot** | `js/chatbot.js` → `TOPICS` | Un objeto nuevo en el array |
| Agregar un **repuesto/precio** | `js/tienda.js` | Catálogo de la tienda |
| Cambiar el **hacker** (frecuencia, castigo) | `js/hacker.js` → `GT.hacker.CFG` | Parámetros |
| Cambiar el **ransomware** | `GT.CONFIG` (`RANSOM_*`) y `js/ransom.js` | Tiempos y castigos |
| Cambiar una **pieza 3D** | `EntidadesGraficas/diseños3d/piezas/<nombre>.obj` | Editar en Blender: metros, **Y arriba**, mismo origen y nombre; recargar. Regenerar todo: `node tools/exportar_modelos.js` |
| Cambiar un **elemento del banco 3D** por código | `js/bench3d.js` (`PARTS`) | Zonas y piezas |
| Editar **pantallas** (login, ranking…) | `index.html` + `css/screens.css`, `css/cuenta.css` | Conservar los `id`, `data-*` y `name` (el JS se agarra de ahí) |
| Cambiar **conexión a la BD** | `api/config.php` | `DB_HOST`, `DB_USER`, `DB_PASS`, `DB_NAME` |
| Cambiar el **esquema** | `sql/schema.sql` + una migración nueva | No reimportar `schema.sql` sobre datos existentes |
| Cambiar **puerto/host del relay** | `tools/mando_server/server.js` | `PORT=xxxx npm start`, `HOST=127.0.0.1` para solo local |
| Cambiar el **formato de mensajes del mando** | `apply()` en `js/input.js` | Es el único punto de acople |
| Cambiar la **app Android** | `mando_android/` (Android Studio) | `Inicio.kt` (conexión/QR), `Analogico.kt` (stick); recompilar con `tools\mando_dev.ps1 -Compilar` (pide JDK 21) |
| Agregar un **minijuego** | Nuevo `js/xxx.js` + `<script>` en `index.html` + `api/ronda.php` | Usan el cursor/botones del mando y `GT.correct` para puntos |

### Trucos de consola del navegador (útiles en la demo)
```js
GlitchTec.tech.jump(8)        // saltar a la orden 8 del taller
GlitchTec.hacker.forceLock()  // el hacker bloquea teclas
GlitchTec.hacker.forceColors()
GlitchTec.assets.revisar()    // marca el arte faltante
GlitchTec.bot.ask('qué es el phishing')
```

---

## 8. Cómo levantarlo (para la demo)

1. Instalar **XAMPP**, copiar el proyecto a `C:\xampp\htdocs\glitch-tec\`.
2. phpMyAdmin → importar `sql/schema.sql` (BD `glitchtec`).
3. Ajustar `api/config.php` si MySQL tiene clave.
4. Abrir `http://localhost/glitch-tec/` y verificar `http://localhost/glitch-tec/api/ping.php` → `{"ok":true,"db":true,"cuentas":true}`.
5. Mando: `cd tools/mando_server && npm install && npm start` (puerto 3000), o `tools\mando_dev.ps1`. Instalar el APK (release `mando-v1.1` en GitHub), escanear el QR que muestra el juego.
6. Sin servidor: abrir `index.html` directo → modo **offline** (ranking en localStorage, sin cuentas, sin modelos 3D .obj: usa cajas).

---

## 9. Mecánicas clave (cómo funcionan por dentro)

- **Puntaje**: base × velocidad (hasta ×2 si respondés antes de 30 s) × racha (cada 3 aciertos +0.5, máx ×3). Premios: 3 aciertos = escudo 20 s; 5 = +15 s.
- **Integridad (vidas)**: pop-ups la drenan; llega a 0 = pantalla azul. **Infección** sube con el avance del malware.
- **Ransomware (nivel 4)**: archivos pasan a `.locked`, su contenido es el real **XOR** una clave. Al matar el proceso queda `volcado.dmp` con dos bytes → se calcula la clave (decimal/hex/binario) → `decrypt <clave>`. Un archivo queda roto y solo vuelve con `backup restore`.
- **Backup vs. restauración**: backup guarda *tus archivos*; punto de restauración guarda *la configuración del sistema*. El malware revierte lo que hagas fuera de orden (persistencia).
- **Sistema de archivos**: árbol en memoria; `GT.fs.*` devuelve `{ok:true}` o `{error:'codigo'}` (nunca excepciones); avisa cambios por el bus.
- **Taller**: ciclo **inspeccionar → actuar → probar → cerrar**. Inspeccionar gasta minutos; cambiar una pieza sana cuesta plata y reputación; hay que comprar repuestos en la tienda y diagnosticar antes de gastar. La orden 8 enseña redes **de abajo hacia arriba** (físico → configuración).
- **Mando**: stick = cursor virtual; izq = clic; der mantenido = menú radial (elige inclinando el stick). Mensajes JSON: `{"x":0.5,"y":-0.3}` y `{"button":"left","down":true}`.
- **TEC-Bot**: normaliza la pregunta (sin acentos/plurales/relleno), puntúa cada tema, si ninguno llega al mínimo dice que no sabe. Las pistas no cuestan puntos pero tienen cupo (2 por nivel).

---

## 10. Preguntas probables en la defensa (y respuestas cortas)

**¿Por qué JavaScript sin frameworks?** Para entender y controlar todo; el proyecto es educativo, el estilo retro se logra mejor a mano, y no hay dependencias que instalar (abre con doble clic).

**¿Por qué p5.js?** Facilita dibujar, animar y hacer 3D (WEBGL) en canvas; se usa en instance mode para tres sketches (CRT, medidores, núcleo) y el banco 3D.

**¿Por qué PHP + MySQL?** Es el stack de la materia, XAMPP lo trae todo; PDO con preparadas evita inyección SQL.

**¿Cómo evitan que un jugador falsee su puntaje?** Token secreto por partida, partida cerrada no reescribible, valores recortados a rangos, usuario tomado de la sesión (no del cliente).

**¿Cómo guardan contraseñas?** `password_hash` (bcrypt, sal propia). Nunca en texto plano ni reversible.

**¿Qué pasa si el servidor está caído?** `api.js` detecta que no hay backend y cae a `localStorage` (modo offline).

**¿Cómo se comunica el celular con el juego?** App Kotlin → WebSocket (OkHttp) → relay Node (`ws`) → navegador. El QR (generado por el juego) lleva IP:puerto del relay.

**¿Cómo agregan contenido sin romper nada?** Niveles y órdenes son **datos** (objetos en arrays): se agrega una entrada y el motor la usa.

**¿Por qué una IIFE por archivo?** Evita variables globales que choquen; solo se expone lo que se cuelga de `window.GlitchTec`.

**¿Qué mejorarían?** Pantallas provisionales (login, nota de rescate), dibujar cable/switch en el 3D, más arte, audio dinámico, autenticación del relay y CORS restringido.

---

## 11. Estado del proyecto

Alfa funcional. Pendiente: diseño final de pantallas maqueta, arte de piezas nuevas (`hw.nic`, `hw.rj45`, `hw.switch`, etc.), más narrativa, balance fino de CPU, audio por nivel de infección.
