# Glitch.TEC — PC Corrompida

Prototipo funcional de un **videojuego educativo** sobre informática, con **dos modos de juego**:

| Modo | De qué va |
|---|---|
| **PC Corrompida** (software) | Un escritorio WinTEC XP infectado por un malware consciente. Terminal real, administrador de tareas, correo y purga final. Un **hacker** se pasea por la pantalla, te bloquea teclas y te corrompe los colores. |
| **Servicio Técnico** (hardware) | Sos el técnico del taller: entran equipos rotos y hay que **diagnosticar** por qué fallan, repararlos y explicar la falla. |

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
   por velocidad con **rachas y multiplicadores**, reloj y 4 niveles por modo.
   En la purga final, **barra de vida del jugador contra la del malware**.
8. **Victoria / derrota** — sistema restaurado / equipos entregados, o BSOD / taller cerrado.
9. **Ranking** — tabla de posiciones global (MySQL) o local (esta PC), filtrable por modo.

---

## Cómo jugar (rápido)

1. Abrí `index.html` en el navegador **o** serví el proyecto con XAMPP (recomendado).
2. **ELEGIR MODO DE JUEGO**.

### Modo 1 — PC Corrompida

1. En la Terminal: `help` → leé `C:\Documentos\leeme.txt` → `scan` el archivo con doble extensión.
2. Desbloqueá la cuarentena (binario `101101` → decimal `45`).
3. Matá los procesos **sin firma digital**.
4. Clasificá los correos de TEC-Mail.
5. Escribí `purge` y respondé las 5 preguntas finales.
6. Mientras tanto, **el hacker molesta**: si te bloquea teclas, respondé su pregunta de software
   para recuperarlas. Si le hacés click, se escapa y retrasa su próximo ataque.

### Modo 2 — Servicio Técnico

1. Leé la **orden de trabajo**: lo que dice el cliente y el síntoma real del equipo.
2. **Inspeccioná** (gratis, pero consume minutos de taller) hasta encontrar la falla.
3. **Actuá** sobre lo que encontraste. Ojo: cambiar una pieza sana cuesta plata y reputación.
4. **Probá el equipo**. Si sigue fallando, el síntoma cambia y hay que seguir buscando.
5. **Cerrá la orden** explicando cuál era la falla.

Las cuatro órdenes: *no enciende* (alimentación) · *enciende sin imagen* (RAM mal asentada) ·
*se apaga sola* (polvo + pasta térmica) · *lentísima y se cuelga* (disco moribundo: **respaldo primero**).

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
   (crea la BD `glitchtec`, tablas `partidas` / `eventos` y datos de ejemplo).

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

Debería responder `{ "ok": true, "db": true, ... }`.

> Si abrís `index.html` directo (file://), el juego funciona igual en **modo offline** y guarda el ranking en `localStorage`.

---

## Estructura del proyecto

```
glitch-tec/
├── index.html              # Shell de la interfaz (menú, modos, escritorio, taller)
├── css/                    # Estilos (escritorio, ventanas, CRT, hacker, taller)
│   ├── hacker.css          # Personaje, panel de rescate, corrupción de colores
│   └── tech.css            # Banco de trabajo del modo técnico
├── js/
│   ├── vendor/p5.min.js    # Motor Processing (p5.js)
│   ├── engine.js           # Sketches p5: CRT, CPU/RAM, núcleo
│   ├── state.js            # Estado global + bus de eventos
│   ├── game.js             # Orquestador / loop / selección de modo
│   ├── terminal.js         # CLI (mecánica principal)
│   ├── processes.js        # Administrador de tareas
│   ├── mail.js             # TEC-Mail (phishing)
│   ├── boss.js             # Nivel final (purge)
│   ├── hacker.js           # GL1TCH-M4N: paseo, bloqueo de teclas, colores
│   ├── tech.js             # Modo Servicio Técnico (4 órdenes de trabajo)
│   ├── api.js              # Cliente PHP / fallback local
│   ├── ranking.js          # Pantalla de ranking (global / local, por modo)
│   └── ...
├── api/                    # Endpoints PHP
│   ├── config.php
│   ├── ping.php
│   ├── partida_start.php
│   ├── partida_end.php
│   ├── evento.php
│   └── ranking.php
├── sql/
│   └── schema.sql          # Esquema MySQL + seed
└── README.md
```

---

## API PHP

| Endpoint | Método | Descripción |
|---|---|---|
| `api/ping.php` | GET | Healthcheck + estado de la BD |
| `api/partida_start.php` | POST | Abre una partida (guarda el **modo** jugado) y devuelve su **token** |
| `api/partida_end.php` | POST | Cierra con puntaje y stats. Exige el token y que la partida siga abierta |
| `api/evento.php` | POST | Log de eventos de gameplay |
| `api/ranking.php?limit=10&modo=virus\|tecnico` | GET | Top de partidas **ganadas**, con filtro opcional por modo |

Como los dos modos puntúan distinto, `partidas` tiene una columna `modo`
(`virus` / `tecnico`).

Cada partida recibe un token secreto al abrirse: sin él no se puede cerrar, y una partida ya
cerrada no se puede volver a escribir. Así nadie puede pisar el puntaje de otro mandando
`match_id` correlativos. Los valores numéricos se recortan a rangos válidos antes de guardarse.

Si ya tenías la base creada, corré los `ALTER TABLE` comentados al final de `sql/schema.sql`.

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

Implementado: selección de modo, escritorio WinTEC XP, Terminal, Explorador, pop-ups del malware,
Administrador de tareas, TEC-Mail, purga final, **hacker con bloqueo de teclas y corrupción de
colores**, **modo Servicio Técnico con 4 órdenes de trabajo**, puntuación/integridad/tiempo,
**rachas y multiplicadores**, **combate jugador vs. malware**, **ranking global y local**,
p5.js, API PHP y esquema MySQL.

Pendiente (post-alfa): módulos avanzados de ransomware/spyware, más narrativa, más órdenes de
trabajo en el taller, balance fino de CPU y audio dinámico por nivel de infección.
