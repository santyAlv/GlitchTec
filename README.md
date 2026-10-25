# Glitch.TEC — PC Corrompida

Prototipo funcional de un **videojuego educativo** sobre informática, con **dos modos de juego**:

| Modo | De qué va |
|---|---|
| **PC Corrompida** (software) | Un escritorio WinTEC 95 infectado por un malware consciente. Terminal real, sistema de archivos con cuota de disco, administrador de tareas, correo, un **ransomware** con cuenta regresiva y purga final. Un **hacker** se pasea por la pantalla, te bloquea teclas y te corrompe los colores. |
| **Servicio Técnico** (hardware) | Sos el técnico del taller: entran equipos rotos y hay que **diagnosticar** por qué fallan, repararlos y explicar la falla. La última orden es un **laboratorio de redes**. |

**Materia:** PISWD · **Profesor:** Callamullo Diego

| Rol | Integrante |
|---|---|
| Back-End | Alvarez Santiago |
| Front-End | Cora Alex |
| Liderazgo | Gomez Nayla |
| Diseño Gráfico | Ortiz Morena |

---

## Stack

| Capa | Tecnología |
|---|---|
| Motor del videojuego | **Processing (p5.js)** |
| Interfaz web | **HTML, CSS, JavaScript** |
| Lógica del servidor | **PHP** |
| Base de datos | **MySQL / MariaDB** |
| Control de versiones | **Git + GitHub** |

---

## Dirección de arte — "WinTEC 95"

Todo el juego pasa dentro de una computadora vieja, así que la interfaz **es**
el escenario: se ve como un sistema operativo de fines de los 90 corriendo en un
monitor CRT. Está armado enteramente con las tecnologías del stack (HTML, CSS y
JavaScript): no hay imágenes, ni fuentes externas, ni librerías de UI.

| Pieza | Cómo se resuelve |
|---|---|
| **Paleta** | Gris de sistema (`--face`), azul de barra de título, verde azulado de escritorio y el fósforo del monitor (verde, ámbar, rojo, cian) para terminal, boot y HUD. |
| **Relieve** | Tres variables de `box-shadow` (`--bevel-out`, `--bevel-in`, `--bevel-thin-in`) reemplazan a los bordes redondeados: lo que se aprieta sobresale, lo que muestra contenido está hundido. |
| **Tipografía** | Sans de sistema sin suavizado (`-webkit-font-smoothing: none`) para la interfaz y monoespaciada para todo lo que "sale de la máquina". |
| **Iconos** | Cada icono es un *slot*: entra el arte final del equipo de diseño (PNG) y, si todavía no está, el SVG de 16×16 dibujado sobre rejilla entera con `shape-rendering="crispEdges"`. Ver **Recursos gráficos**. |
| **Tramas** | El "dither" de un pixel de los fondos noventosos, hecho con dos degradés a 45° superpuestos. |
| **Filtro CRT** | Líneas de barrido, máscara de fósforo RGB, viñeta, curvatura simulada y parpadeo del tubo, todo en `css/effects.css`. |

La corrupción del malware está construida sobre ese mismo sistema: cuando la
infección sube, se desincroniza la imagen, se parten los canales de color y hasta
las barras de título cambian de tono. Los pop-ups y el panel del hacker usan el
marco del sistema con otro color: parecen del sistema, pero no lo son.

---

## Recursos gráficos (cómo enchufar el arte)

La interfaz se maquetó sin imágenes, y meter PNG en una maqueta hecha para texto
es la forma más fácil de desarmarla: el renglón crece cuando la imagen carga, el
icono empuja al de al lado, la tipografía se corre. Por eso **ningún elemento
gráfico se escribe suelto**: todos van adentro de un contenedor de medida
reservada (`.asset`), que ocupa exactamente el mismo lugar tenga adentro lo que
tenga.

| Estado | Qué hay adentro | Cómo se ve |
|---|---|---|
| `is-final` | El PNG del equipo de diseño | El arte |
| `is-draft` | El SVG provisional de la maqueta | El dibujo de siempre |
| `is-pending` | Nada todavía | Un marcador gris tramado con las dos primeras letras de la pieza |

Los tres miden igual, así que el arte se puede ir enchufando **de a una pieza**
sin tocar la maqueta y sin que se mueva un pixel. Si un archivo falta o se
renombra, el contenedor vuelve solo al marcador en vez de dejar el icono roto
del navegador.

**Para agregar arte** alcanza con una línea en el catálogo de `js/assets.js`:

```js
'fs.documento': 'documento.png',    // archivo dentro de EntidadesGraficas/Diseño/iconos/
'sys.logo':     { src: '...', fit: 'cover' },   // si viene con margen de más
```

**Dónde van los gráficos** (las áreas del DOM preparadas):

| Lugar | Slot | Medida |
|---|---|---|
| Iconos del escritorio | `app.*` | 32 px (24 en celular) |
| Barra de tareas | `app.*` | 16 px |
| Barra de título de ventana | `app.*` | 16 px |
| Menú Inicio | `app.*` | 22 px |
| Explorador de archivos | `fs.*` | 32 px |
| Administrador de tareas | `proceso.firmado` / `proceso.sin-firma` | 16 px |
| Pop-ups del malware | `aviso.alerta` / `aviso.malware` | 48 px |
| Diálogos del sistema | `sys.usuario` / `aviso.malware` | 32 px |
| Créditos | `sys.logo` | banner 300×130 |
| Ventana de componentes (pendiente) | `hw.*` | — |

Desde la consola del navegador, `GlitchTec.assets.revisar()` marca en pantalla lo
que todavía no es arte final —magenta lo que no tiene nada, ámbar lo provisional—
y devuelve la lista de piezas que faltan dibujar.

---

## Qué demuestra este prototipo

1. **Inicio del juego** — menú + **selección de modo** + secuencia de boot.
2. **Instrucciones** — manual de supervivencia in-game.
3. **Mecánica principal** — Terminal CLI (`dir`, `cd`, `type`, `scan`, `unlock`, `kill`, `purge`)
   y, en el otro modo, el **ciclo de diagnóstico** inspeccionar → actuar → probar → cerrar.
4. **Interacción del usuario** — ventanas arrastrables, iconos, pop-ups, clics y teclado.
5. **Sistema de respuestas / decisiones** — clasificar correos, matar procesos, preguntas del
   hacker, quiz final y diagnóstico de cada orden de trabajo.
6. **Antagonista con presencia** — el hacker se mueve por la pantalla, amenaza, **bloquea teclas**
   y **corrompe los colores**.
7. **Puntuación / vidas / tiempo / niveles** — integridad (o reputación), infección, puntaje
   por velocidad con **rachas y multiplicadores**, reloj, 5 niveles en PC Corrompida y
   8 órdenes en el taller. En la purga final, **barra de vida del jugador contra la del malware**.
8. **Victoria / derrota** — sistema restaurado / equipos entregados, o BSOD / taller cerrado.
9. **Ranking** — tabla de posiciones global (MySQL) o local (esta PC), filtrable por modo.
10. **Cuentas de usuario** — registro e inicio de sesión; las partidas quedan asociadas a la
    cuenta y se puede ver el historial. Sin cuenta se juega igual, como invitado.
11. **Sistema de archivos con cuota** — crear, copiar, mover, renombrar y borrar desde la
    Terminal o el Explorador, con un disco que se llena.
12. **Mantenimiento del sistema operativo** — backup, puntos de restauración, particiones y
    diagnóstico de congelamientos, como requisito de los niveles.
13. **Asistente TEC-Bot** — responde dudas de hardware y software y da pistas sin costo, con cupo.

---

## Cómo jugar (rápido)

1. Abrí `index.html` en el navegador **o** serví el proyecto con XAMPP (recomendado).
2. **ELEGIR MODO DE JUEGO**.

### Modo 1 — PC Corrompida

Son cinco niveles:

| # | Nivel | Qué hay que hacer | Qué enseña |
|---|-------|-------------------|------------|
| 1 | Reconocimiento | `help` → leer `C:\Documentos\leeme.txt` → `scan` del archivo con doble extensión → desbloquear la cuarentena (binario `101101` → decimal `45`) → **`backup create \Documentos`** | Doble extensión, logs, binario a decimal y respaldar antes de pelear |
| 2 | Contención | Matar los procesos **sin firma digital**. Cuando queda uno, **cuelga el sistema**: `diag` dice cuál lo bloquea. Después, borrar la basura que dejaron en `C:\Sistema\Temp` | Firma digital, CPU, PC tildada y espacio en disco |
| 3 | Phishing | Clasificar los correos de TEC-Mail | Dominio real del remitente, enlaces y urgencia |
| 4 | Secuestro | Un **ransomware** cifra tus archivos y hay un reloj: no pagar, matar el proceso con `ps` y `kill`, calcular la clave (un **XOR**) y `decrypt <clave>` en cada carpeta. Lo que quedó roto vuelve con `backup restore` | Contener, recuperar y para qué servía el backup |
| 5 | Purga | Antes de `purge`: **`restore`** a un punto anterior a la infección y **`part`** para borrar la partición oculta. Después, las preguntas finales | Persistencia, puntos de restauración y particiones |

Mientras tanto, **el hacker molesta**: si te bloquea teclas, respondé su pregunta de software
para recuperarlas. Si le hacés click, se escapa y retrasa su próximo ataque.

Si te trabás, el icono **TEC-Bot** del escritorio (o `bot <pregunta>` en la Terminal) explica
conceptos y da dos pistas gratis por nivel.

### Modo 2 — Servicio Técnico

Es un **escritorio en 3D** hecho con p5.js en WEBGL (`js/bench3d.js`): el equipo del
cliente, el monitor de prueba y las herramientas sobre la mesa. La cámara no camina,
sólo se acerca a lo que estás trabajando (banco · gabinete · interior · monitor).

1. Leé la **orden de trabajo**: lo que dice el cliente.
2. **Encendé el equipo**. El monitor muestra lo que mostraría de verdad —POST, pitidos,
   código de error, arranque, apagón o *sin señal*— y de ahí se lee el síntoma.
3. **Agarrá la herramienta** que haga falta: destornillador para la tapa y los tornillos,
   aire comprimido para el polvo, pasta térmica, tester y disco de respaldo. Para la orden
   de redes hay dos más: la crimpeadora y el probador de cables.
4. **Sacá la tapa** y **girá el gabinete** (arrastrándolo) para llegar a los conectores
   de atrás: ficha de corriente, interruptor de la fuente y los dos puertos de video.
5. **Tocá la pieza** que querés trabajar y se abre lo que podés hacerle.
6. **Inspeccioná** (gratis, pero consume minutos de taller) hasta encontrar la falla.
7. **Actuá** sobre lo que encontraste. Ojo: cambiar una pieza sana cuesta plata y reputación.
8. **Probá de nuevo**: si sigue fallando, la pantalla cambia y hay que seguir buscando.
9. **Cerrá la orden**: señalás sobre el equipo la pieza que falló y asentás la causa en la ficha.

Las piezas se ven: la tapa queda apoyada en la mesa, la RAM sale del zócalo, el polvo
tapa el disipador hasta que lo soplás, el sulfato deja su verdín sobre las pistas y el cable
de video se ve pasar de un puerto al otro. Cada orden trae el equipo como lo dejó el cliente:
con polvo, con sulfato o con humedad adentro.

### Las ocho órdenes de trabajo

| # | Orden | Qué enseña |
|---|-------|------------|
| 1 | No enciende | Alimentación: revisar de afuera hacia adentro y de lo barato a lo caro |
| 2 | Enciende pero no da imagen | El POST y su código de pitidos; RAM mal asentada |
| 3 | Se apaga sola | Protección térmica: polvo en el disipador **y** pasta térmica vencida |
| 4 | Lentísima y se cuelga | Disco moribundo (SMART): **respaldo antes de tocar nada** |
| 5 | Estuvo guardada en un depósito húmedo | Humedad y **sulfatación**: secar primero, limpiar el verdín con alcohol isopropílico, no cambiar la pieza |
| 6 | Hace ruido y se apaga | La ventilación como **circuito**: filtros tapados y ventilador trabado |
| 7 | Se apaga cuando la exigen | **Pasta térmica seca** en un equipo limpio: mantenimiento preventivo cada 2 o 3 años |
| 8 | El laboratorio se quedó sin red | **Redes de abajo hacia arriba**: primero lo físico (placa, cable, ficha, puerto, luz de enlace) y recién después la configuración |

Las órdenes 5, 6 y 7 son mantenimiento preventivo y correctivo: polvo, humedad y pasta
térmica, que es por donde entra la mayoría de las fallas reales de un equipo de escritorio.

### Orden 8 — Laboratorio de redes

Entran la PC del docente, el switch y el cable de un laboratorio escolar, con **cuatro fallas
juntas**. Cada una tapa a la siguiente, así que el monitor va mostrando un síntoma distinto a
medida que se resuelven:

| Falla | Cómo se detecta | Cómo se repara | Tiempo · costo |
|---|---|---|---|
| Placa de red quemada por una descarga | El sistema no lista ningún adaptador; marca negra en el conector | Cambiar la placa de red | 10 min · $18.000 |
| Ficha RJ45 mal crimpada | A simple vista, o con el probador de cables (saltea los hilos 3 y 6) | Armar un conector nuevo en T568B, o cambiar el patch cord | 8 min · $300 / 2 min · $2.500 |
| Puerto del switch quemado | La luz del puerto no prende ni con un cable que anda | Pasar el cable a un puerto libre y anular el quemado | 2 min · gratis |
| Switch recalentando | 78 °C en la carcasa; rejillas tapadas en un armario cerrado | Limpiar la ventilación | 10 min · gratis |

Cambiar el switch entero ($65.000) o su ventilador sano ($6.000) cuentan como repuesto
innecesario, y revisar la configuración IP no encuentra nada: el problema no es de software.

Para probar o maquetar una orden sin jugar las anteriores, con el taller abierto y desde la
consola del navegador: `GlitchTec.tech.jump(8)`.

### Puntaje, rachas y combate final

- Cada acierto vale su puntaje base **x velocidad x racha**. Contestar enseguida paga hasta el
  doble; a los 30 s ya no suma extra.
- Cada 3 aciertos seguidos el multiplicador sube (x1.5, x2... hasta x3). Un error lo vuelve a x1.
- Premios de racha: a los 3 aciertos **escudo** (el daño entra a la mitad por 20 s) y a los 5
  **tiempo extra** (+15 s).
- En la purga, cada acierto le saca vida al malware (más con racha) y cada error se la devuelve.
  Gana el primero que deja al otro en 0.

Los números están en `GT.CONFIG` (`js/state.js`).

---

## Sistema de archivos y disco

El árbol de carpetas y la cuota viven en el estado de la partida (`GT.state.fsRoot` y
`GT.state.disk`) y los comparten la Terminal y el Explorador. La unidad `C:` mide 2 GB y
arranca ocupada por los archivos del sistema; el espacio usado se calcula sumando el árbol.

| Comando | Qué hace |
|---|---|
| `dir` · `cd` · `type` | Listar, moverse y leer. `dir` informa el espacio libre |
| `del <archivo>` | Borra. Acepta comodines: `del *.tmp` |
| `copy` / `move <origen> <destino>` | Copia (ocupa lugar) o mueve (no ocupa) |
| `ren <viejo> <nuevo>` | Renombra |
| `md` / `rd <carpeta>` | Crea o borra una carpeta (`rd <carpeta> /s` con su contenido) |
| `espacio` | Uso del disco y qué carpeta ocupa más |

Todos aceptan rutas (`type \Sistema\registro.log`). Hay cosas que el sistema no deja tocar:
los archivos del sistema, los que todavía hacen falta para un objetivo, las carpetas con
clave y los archivos **en uso** por un proceso.

El malware usa el disco en su contra: en el nivel 2 cada proceso hostil escribe basura en
`C:\Sistema\Temp`. Con el disco lleno se pierde integridad, y la basura no se puede borrar
mientras el proceso que la escribe siga vivo.

Para programar encima, `js/filesystem.js` expone `GT.fs.writeFile`, `makeDir`, `remove`,
`rename`, `copy`, `move`, `usage` y `sizeOf`. Ninguna tira excepciones: devuelven
`{ ok: true, ... }` o `{ error: 'codigo', name }`, y `GT.fs.explain(resultado)` da el
mensaje para mostrar. Cada cambio se avisa por el bus: `GT.on('fs', fn)` y `GT.on('disk', fn)`.

## Herramientas de mantenimiento

Cuatro comandos de Terminal en `js/sysutils.js`. El estado está en `GT.state.sys`.

| Comando | Qué hace | Dónde es obligatorio |
|---|---|---|
| `backup create <carpeta>` · `list` · `restore <n>` · `delete <n>` | Copia una carpeta del usuario a la partición `D:` y la puede devolver | Nivel 1, y para recuperar el archivo roto del nivel 4 |
| `diag` | CPU, memoria y disco. Con el sistema tildado, distingue al programa colgado del proceso que lo bloquea | Nivel 2 |
| `restore list` · `apply <n>` · `create <nombre>` · `delete <n>` | Puntos de restauración. El último que trae la PC se guardó **después** de la infección: aplicarlo restaura el malware | Nivel 5 |
| `part list` · `info <n>` · `delete <n>` · `create` | Tabla de particiones, con una oculta que creó el malware. Borrar pide confirmar con `/si` | Nivel 5 |

Un backup guarda **tus archivos**; un punto de restauración guarda **la configuración del
sistema**. `backup` no acepta carpetas del sistema, y `restore` no toca los documentos.

Si se restaura el sistema o se borra la partición oculta antes del nivel 5, el malware lo
revierte: sigue en memoria. Por eso el orden de los niveles es el que es.

## Nivel 4 — Ransomware

Está en `js/ransom.js`, con el estado en `GT.state.ransom`.

- Los documentos pasan a terminar en `.locked`. Lo que se ve al abrirlos es su contenido real
  pasado por XOR con la clave.
- El Administrador de tareas y el correo quedan bloqueados y `scan` deshabilitado.
- El reloj arranca en 4 minutos. Cada vez que llega a cero se destruye un archivo, y vuelve a
  correr desde 45 segundos. Mientras el proceso cifrador viva, cada 20 segundos cifra uno más.
- Al matar el proceso queda `C:\Sistema\volcado.dmp` con los dos bytes de los que sale la
  clave: hay que calcular el XOR. Se acepta en decimal, en hexadecimal (`0x66`) o en binario.
  La clave cambia en cada partida.
- `decrypt <clave>` descifra sólo la carpeta actual. Un archivo queda con la cabecera rota y
  sólo vuelve con `backup restore`.

Los tiempos y los castigos están en `GT.CONFIG` (`RANSOM_*`).

## TEC-Bot

`js/chatbot.js` tiene tres partes separadas: la base de conocimiento (33 temas de hardware y
software), el buscador y la ventana.

```js
GlitchTec.bot.ask('qué es el phishing');
// { type: 'answer', title: 'Phishing', text: '...', related: [...] }
GlitchTec.bot.ask('pista');
// { type: 'hint', ok: true, text: '...', left: 1 }
```

El buscador normaliza la pregunta (sin acentos, sin plurales, sin palabras de relleno) y
puntúa cada tema; si ninguno llega al mínimo dice que no sabe. No toca el DOM, así que lo
puede usar cualquier interfaz. Para sumar un tema alcanza con agregar un objeto a `TOPICS`.

Las pistas salen del mismo lugar que el comando `pista`, pero **no cuestan puntos**. A cambio
tienen cupo: `GT.CONFIG.BOT_HINTS_PER_LEVEL` (2) por nivel. En el taller usa
`GT.tech.getHint()`, que orienta hacia la zona a revisar sin decir cuál es la falla.

## Cuentas de usuario

`js/auth.js` expone `GT.auth` y avisa cada cambio de sesión con el evento `auth` del bus:

```js
GT.auth.register({ username, email, password })   // -> { ok, user } o { ok: false, errors }
GT.auth.login(usuarioOCorreo, password)
GT.auth.logout()
GT.auth.history()                                  // partidas de la cuenta
GT.auth.user                                       // null si es un invitado
GT.on('auth', function (e) { /* e.user */ });
```

Del lado del servidor:

- La contraseña **nunca se guarda**: se guarda su hash (`password_hash`, bcrypt con sal propia
  por usuario).
- La sesión va en una cookie `HttpOnly` y `SameSite=Strict`, limitada a la carpeta del juego.
  El identificador se regenera al iniciar sesión.
- El inicio de sesión responde el mismo error exista o no la cuenta, y la bloquea 5 minutos
  al quinto intento fallido seguido.
- Las reglas de validación (usuario de 3 a 24 caracteres, correo válido, contraseña de 8 a 72
  con letras y números) están en `api/auth.php` y repetidas en `js/auth.js`: el navegador
  avisa rápido, pero la que vale es la del servidor.
- La partida se asocia al usuario **de la sesión**, nunca a un dato que mande el navegador.

Sin sesión se juega igual, como invitado. Abriendo `index.html` sin servidor no hay cuentas.

## Qué quedó provisional (para Front-End y Diseño)

La lógica de estas pantallas está completa; lo que tienen es una maqueta mínima para poder
usarlas. Se pueden rehacer enteras mientras conserven los ganchos de la tercera columna, que
es de donde se agarra el código.

| Pantalla | Dónde está | Qué hay que conservar |
|---|---|---|
| Login y registro | `#screen-auth` en `index.html`, estilos `.auth-*` en `css/screens.css` | Los `id` (`auth-login`, `auth-registro`, `auth-note`, `auth-user`, `auth-forms`, `auth-history`, `auth-logout`), los `data-auth-tab`, los `data-error` y los `name` de los campos |
| Nota de rescate | `ransom.openNote()` en `js/ransom.js` | `#ransom-clock`, `#ransom-count`, `#ransom-msg` y los botones `data-ransom="pay"` y `data-ransom="refuse"` |
| Reloj del rescate | Va pegado al nombre del nivel en el HUD | Para un reloj propio: `GT.on('ransom', fn)` recibe `{ timeLeft, locked }` en cada cuadro |
| Chat de TEC-Bot | `bot.open()` en `js/chatbot.js`, con los estilos de la Terminal | `.bot-log` y `.bot-input`. Falta ponerlo en la pantalla del taller: `GT.bot.ask()` ya responde ahí |
| Sistema tildado | `#desktop` recibe la clase `is-frozen` | Esa clase, para el estilo que se le quiera dar |
| Archivos cifrados | Los ítems del Explorador llevan la clase `encrypted` | Esa clase |
| Explorador | Botón `data-nav="del"` y barra de estado con el uso del disco | El `data-nav` y `#exp-status` |
| Laboratorio de redes | El cable y el switch se trabajan desde la lista de zonas | Faltan dibujarlos en el banco 3D (`PARTS` en `js/bench3d.js`, zonas `patch`, `nic` y `switch`) |

Arte que falta, ya catalogado en `js/assets.js` (alcanza con ponerle el archivo): `app.asistente`,
`fs.cifrado`, `hw.nic`, `hw.rj45`, `hw.utp`, `hw.switch`, `hw.crimpeadora` y `hw.lantester`.

---

## El hacker (GL1TCH-M4N)

Vive en `js/hacker.js` y es autónomo: `game.js` sólo lo arranca, lo tickea y lo frena.

| Qué hace | Detalle |
|---|---|
| Se pasea | Salta a una posición aleatoria de la pantalla cada 6–12 s, con un globo de amenaza. |
| Bloquea teclas | 3 a 5 teclas mueren **en todo el sistema** (filtro global en fase de captura). Se recuperan respondiendo una **pregunta de software** con el mouse. El panel es arrastrable y plegable: el juego no se frena. |
| Corrompe la vista | Invierte y rota los colores de la pantalla durante **20 segundos**, con cuenta regresiva a la vista. |
| Se lo puede espantar | Un click lo hace saltar y retrasa su próximo ataque. |

Los parámetros (frecuencias, duración, castigos) están en `GT.hacker.CFG`.
Para probarlo a mano desde la consola del navegador:

```js
GlitchTec.hacker.forceLock();     // secuestro de teclado
GlitchTec.hacker.forceColors();   // corrupción de colores (20 s)
GlitchTec.hacker.forceMove();     // que salte a otro lado
```

---

## Instalación con XAMPP (stack completo)

### 1. Clonar

```bash
git clone https://github.com/<tu-org>/glitch-tec.git
cd glitch-tec
```

### 2. Copiar a htdocs

Copiá la carpeta del proyecto a:

```
C:\xampp\htdocs\glitch-tec\
```

### 3. Crear la base de datos

1. Abrí **phpMyAdmin** → `http://localhost/phpmyadmin`
2. Importá `sql/schema.sql`  
   (crea la BD `glitchtec`, tablas `usuarios` / `partidas` / `eventos` y datos de ejemplo).

> **Si ya tenías la base creada**, no importes `schema.sql` de nuevo (duplicaría los datos de
> ejemplo): importá `sql/migracion_usuarios.sql`, que crea la tabla `usuarios` y le agrega
> `user_id` a `partidas` sin tocar lo guardado. `api/ping.php` avisa con `"cuentas": false`
> si a tu base le falta, y hasta entonces las partidas se guardan sólo en esta PC.

### 4. Configurar conexión

Editá `api/config.php` si tu MySQL no usa usuario `root` sin clave:

```php
const DB_USER = 'root';
const DB_PASS = '';
```

### 5. Abrir el juego

```
http://localhost/glitch-tec/
```

Comprobá el backend:

```
http://localhost/glitch-tec/api/ping.php
```

Debería responder `{ "ok": true, "db": true, "cuentas": true, ... }`.

Las cuentas necesitan **PHP 7.3 o más nuevo** (cualquier XAMPP actual) y que el juego se sirva
desde el mismo servidor que la API.

> Si abrís `index.html` directo (file://), el juego funciona igual en **modo offline** y guarda
> el ranking en `localStorage`. En ese modo no hay cuentas de usuario.

---

## El mando (app Android)

El juego se maneja **solo** con la app del celular (`mando_android/`): un stick y dos
botones de clic, que llegan por WebSocket a un relay Node (`tools/mando_server/`). La
página no tiene ningún control propio. Levantar todo (relay, emulador y app) con
`tools\mando_dev.ps1`. El formato de los mensajes y las funciones que usa cada sector
(eventos, cursor virtual, minijuegos, RAM virtual) están en [tools/LEEME_mando.md](tools/LEEME_mando.md).

## Estructura del proyecto

```
glitch-tec/
├── index.html              # Shell de la interfaz (menú, modos, escritorio, taller)
├── css/                    # Estilos (escritorio, ventanas, CRT, hacker, taller)
│   ├── base.css            # Sistema visual: paleta, biseles, tipografía, scrollbars
│   ├── screens.css         # Título, manual, boot, pantalla azul, victoria
│   ├── desktop.css         # Escritorio, iconos, barra de tareas, menú Inicio, HUD
│   ├── windows.css         # Chrome de ventanas y aplicaciones internas
│   ├── effects.css         # Filtro CRT y corrupción
│   ├── hacker.css          # Personaje, panel de rescate, corrupción de colores
│   ├── tech.css            # Banco de trabajo del modo técnico
│   └── assets.css          # Contenedores de imágenes, sprites y marcadores
├── js/
│   ├── vendor/p5.min.js    # Motor Processing (p5.js)
│   ├── assets.js           # Catálogo y contenedores de recursos gráficos
│   ├── engine.js           # Sketches p5: CRT, CPU/RAM, núcleo
│   ├── state.js            # Estado global + bus de eventos
│   ├── game.js             # Orquestador / loop / selección de modo
│   ├── filesystem.js       # Árbol de archivos, cuota de disco y operaciones
│   ├── terminal.js         # CLI (mecánica principal)
│   ├── explorer.js         # Explorador de archivos
│   ├── processes.js        # Administrador de tareas
│   ├── sysutils.js         # Mantenimiento: backup, restore, part y diag
│   ├── mail.js             # TEC-Mail (phishing)
│   ├── ransom.js           # Nivel 4: ransomware, reloj y descifrado
│   ├── boss.js             # Nivel final (purge)
│   ├── hacker.js           # GL1TCH-M4N: paseo, bloqueo de teclas, colores
│   ├── bench3d.js          # Sketch p5 WEBGL: escritorio 3D (gabinete, monitor, herramientas)
│   ├── tech.js             # Modo Servicio Técnico (8 órdenes de trabajo)
│   ├── chatbot.js          # TEC-Bot: temas, buscador y pistas sin costo
│   ├── api.js              # Cliente PHP / fallback local
│   ├── auth.js             # Cuentas: registro, sesión e historial
│   ├── ranking.js          # Pantalla de ranking (global / local, por modo)
│   └── ...
├── api/                    # Endpoints PHP
│   ├── config.php
│   ├── auth.php            # Biblioteca: validación, hash de contraseñas y sesión
│   ├── ping.php
│   ├── registro.php
│   ├── login.php
│   ├── logout.php
│   ├── sesion.php
│   ├── mis_partidas.php
│   ├── partida_start.php
│   ├── partida_end.php
│   ├── evento.php
│   └── ranking.php
├── sql/
│   ├── schema.sql              # Esquema MySQL + seed
│   └── migracion_usuarios.sql  # Para bases creadas antes de las cuentas
└── README.md
```

---

## API PHP

| Endpoint | Método | Descripción |
|---|---|---|
| `api/ping.php` | GET | Healthcheck + estado de la BD y de la estructura de cuentas |
| `api/registro.php` | POST | Crea una cuenta (`username`, `email`, `password`) y deja la sesión iniciada |
| `api/login.php` | POST | Inicia sesión con usuario o correo (`login`, `password`) |
| `api/logout.php` | POST | Cierra la sesión |
| `api/sesion.php` | GET | Devuelve el usuario de la sesión, o `null` si es un invitado |
| `api/mis_partidas.php?limit=20` | GET | Historial y resumen por modo de la cuenta. Exige sesión |
| `api/partida_start.php` | POST | Abre una partida (guarda el **modo** jugado y, si hay sesión, el **usuario**) y devuelve su **token** |
| `api/partida_end.php` | POST | Cierra con puntaje y stats. Exige el token y que la partida siga abierta |
| `api/evento.php` | POST | Log de eventos de gameplay |
| `api/ranking.php?limit=10&modo=virus\|tecnico` | GET | Top de partidas **ganadas**, con filtro opcional por modo |

Como los dos modos puntúan distinto, `partidas` tiene una columna `modo`
(`virus` / `tecnico`).

Cada partida recibe un token secreto al abrirse: sin él no se puede cerrar, y una partida ya
cerrada no se puede volver a escribir. Así nadie puede pisar el puntaje de otro mandando
`match_id` correlativos. Los valores numéricos se recortan a rangos válidos antes de guardarse.

Si ya tenías la base creada de antes de las cuentas, importá `sql/migracion_usuarios.sql`.

---

## Motor p5.js

`js/engine.js` monta tres sketches en **instance mode**:

- **CRT del escritorio** — estática, scanlines y tearing ligados a la infección.
- **Medidores CPU/RAM** — series en vivo dentro del Administrador de tareas.
- **Núcleo GLITCH.CORE** — visual del jefe final que reacciona a cada acierto.

---

## GitHub

```bash
git init
git add .
git commit -m "Prototipo funcional Glitch.TEC (alfa)"
git branch -M main
git remote add origin https://github.com/<tu-org>/glitch-tec.git
git push -u origin main
```

---

## Estado del prototipo (alfa)

Implementado: selección de modo, escritorio WinTEC 95, Terminal, Explorador, pop-ups del malware,
Administrador de tareas, TEC-Mail, purga final, **hacker con bloqueo de teclas y corrupción de
colores**, **modo Servicio Técnico con 8 órdenes de trabajo** en un banco 3D,
puntuación/integridad/tiempo, **rachas y multiplicadores**, **combate jugador vs. malware**,
**ranking global y local**, **cuentas de usuario con historial**, **sistema de archivos con
cuota de disco**, **herramientas de mantenimiento del sistema**, **nivel de ransomware**,
**laboratorio de redes**, **asistente TEC-Bot**,
p5.js, API PHP y esquema MySQL.

Pendiente: el diseño de las pantallas que quedaron como maqueta (ver *Qué quedó provisional*),
dibujar el cable y el switch en el banco 3D, el arte de las piezas nuevas, más narrativa,
balance fino de CPU y audio dinámico por nivel de infección.
