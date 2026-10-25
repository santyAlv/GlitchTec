-- ============================================================
-- Glitch.TEC — esquema MySQL / MariaDB
-- Ejecutar en phpMyAdmin o: mysql -u root < sql/schema.sql
-- ============================================================

CREATE DATABASE IF NOT EXISTS glitchtec
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE glitchtec;

-- ------------------------------------------------------------
-- Usuarios (cuentas de los jugadores)
-- ------------------------------------------------------------
-- Una fila por cuenta registrada. Va ANTES que partidas porque partidas la
-- referencia con una clave foranea, y MySQL no deja apuntar a una tabla que
-- todavia no existe.
CREATE TABLE IF NOT EXISTS usuarios (
  id              INT UNSIGNED     NOT NULL AUTO_INCREMENT,
  -- El collation utf8mb4_unicode_ci no distingue mayusculas: con el UNIQUE de
  -- abajo, "Santi" y "santi" son el MISMO usuario y no se pueden registrar los
  -- dos. Es lo que quiero: si no, alguien se haria pasar por otro en el ranking.
  username        VARCHAR(24)      NOT NULL,
  email           VARCHAR(120)     NOT NULL,
  -- NUNCA se guarda la contrasenia: se guarda su HASH, que es el resultado de
  -- pasarla por una funcion de un solo sentido (bcrypt, via password_hash() de
  -- PHP). Con el hash puedo comprobar si una clave es la correcta, pero no
  -- puedo recuperar la clave original: si alguien se roba la base, se lleva
  -- hashes y no contrasenias. El hash de bcrypt mide 60 caracteres; le doy 255
  -- porque PHP puede cambiar de algoritmo mas adelante (argon2 ocupa mas) y la
  -- documentacion recomienda dejarle ese lugar.
  password_hash   VARCHAR(255)     NOT NULL,
  fecha_registro  DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ultimo_login    DATETIME         NULL,
  -- Freno contra la fuerza bruta: login.php cuenta los intentos fallidos
  -- seguidos y, al quinto, bloquea la cuenta unos minutos. Sin esto se pueden
  -- probar miles de claves por minuto contra un mismo usuario.
  intentos_fallidos TINYINT UNSIGNED NOT NULL DEFAULT 0,
  bloqueado_hasta DATETIME         NULL,
  PRIMARY KEY (id),
  -- UNIQUE = la base misma garantiza que no haya dos iguales. Validar en PHP
  -- no alcanza: dos registros que llegan en el mismo instante pasarian los dos
  -- el chequeo y quedarian duplicados. Ademas, un UNIQUE ya es un indice, asi
  -- que buscar por username o por email al iniciar sesion es inmediato.
  UNIQUE KEY uq_username (username),
  UNIQUE KEY uq_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- Partidas
-- ------------------------------------------------------------
-- Una fila por partida jugada = el ESTADO FINAL de cada una.
-- Es la tabla que consulta el ranking.
CREATE TABLE IF NOT EXISTS partidas (
  -- UNSIGNED porque un id nunca puede ser negativo: con el mismo espacio de
  -- 4 bytes duplico el maximo. AUTO_INCREMENT lo genera MySQL solo, y ese es
  -- el numero que partida_start.php le devuelve al navegador.
  id             INT UNSIGNED     NOT NULL AUTO_INCREMENT,
  -- Duenio de la partida. NULL = la jugo un invitado (sin cuenta, o con el
  -- juego abierto sin servidor). Lo completa partida_start.php con el usuario
  -- de la sesion, nunca con un dato que mande el navegador.
  user_id        INT UNSIGNED     NULL,
  player_name    VARCHAR(40)      NOT NULL DEFAULT 'estudiante',
  -- ENUM = la columna SOLO acepta uno de esos dos valores; si intento meter
  -- otra cosa, la base lo rechaza. Es validacion en el ultimo eslabon: aunque
  -- me olvide de validar en el JS y en el PHP, aca no entra basura.
  modo           ENUM('virus','tecnico')
                                  NOT NULL DEFAULT 'virus',
  status         ENUM('running','won','lost','abandoned')
                                  NOT NULL DEFAULT 'running',
  -- Token secreto de la partida (32 caracteres hex). Lo genera
  -- partida_start.php y solo lo conoce el navegador que abrio la partida:
  -- partida_end.php no deja cerrarla sin el. NULL en los datos de ejemplo.
  token          CHAR(32)         NULL,
  won            TINYINT(1)       NOT NULL DEFAULT 0,
  score          INT              NOT NULL DEFAULT 0,
  base_score     INT              NOT NULL DEFAULT 0,
  level_reached  TINYINT UNSIGNED NOT NULL DEFAULT 0,
  elapsed_sec    INT UNSIGNED     NOT NULL DEFAULT 0,
  integrity_end  TINYINT UNSIGNED NOT NULL DEFAULT 0,
  mistakes       INT UNSIGNED     NOT NULL DEFAULT 0,
  hints_used     INT UNSIGNED     NOT NULL DEFAULT 0,
  popups_closed  INT UNSIGNED     NOT NULL DEFAULT 0,
  best_streak    SMALLINT UNSIGNED NOT NULL DEFAULT 0,  -- mejor racha de aciertos
  -- 1 = partida que no cuadra con lo que el servidor vio (ver partida_end.php):
  -- no entra al ranking.
  sospechosa     TINYINT(1)       NOT NULL DEFAULT 0,
  started_at     DATETIME         NOT NULL,
  finished_at    DATETIME         NULL,
  PRIMARY KEY (id),
  -- LOS INDICES. Un indice es como el indice de un libro: sin el, MySQL tiene
  -- que leer TODAS las filas para encontrar lo que busca (full scan). Puse uno
  -- por cada columna por la que filtro u ordeno de verdad:
  --   idx_score    -> el ranking hace ORDER BY score DESC
  --   idx_modo     -> el filtro ?modo=virus|tecnico
  --   idx_finished -> el WHERE finished_at IS NOT NULL
  --   idx_ranking  -> el ranking: WHERE status = 'won' AND modo = ... ORDER BY
  --                   score. Es compuesto y el orden de las columnas importa:
  --                   primero las que filtro por igualdad, al final la que
  --                   ordeno. Con el filtro de modo MySQL lo usa entero.
  -- No hay que indexar todo por las dudas: cada indice acelera las lecturas
  -- pero hace un poquito mas lenta cada escritura y ocupa lugar.
  KEY idx_score (score DESC),
  KEY idx_status (status),
  KEY idx_modo (modo),
  KEY idx_finished (finished_at),
  KEY idx_ranking (status, modo, score),
  --   idx_user     -> el historial de una cuenta: WHERE user_id = ...
  KEY idx_user (user_id),
  -- CLAVE FORANEA partidas -> usuarios (relacion 1 a N: un usuario tiene muchas
  -- partidas, cada partida es de un solo usuario o de nadie).
  -- ON DELETE SET NULL y no CASCADE como en eventos: si se borra una cuenta,
  -- sus partidas NO se borran, quedan como de invitado. El ranking es historia
  -- del juego y no tiene por que perder filas porque alguien se dio de baja.
  CONSTRAINT fk_partidas_usuario
    FOREIGN KEY (user_id) REFERENCES usuarios(id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- Eventos de gameplay (analytics / debugging)
-- ------------------------------------------------------------
-- MUCHAS filas por partida = la HISTORIA de lo que fue pasando.
-- Relacion 1 a N con partidas: una partida tiene muchos eventos, cada evento
-- pertenece a una sola partida. Va en tabla aparte y no como columnas de
-- partidas justamente por eso: la cantidad de eventos es variable.
CREATE TABLE IF NOT EXISTS eventos (
  -- BIGINT y no INT: de eventos hay muchisimos mas que de partidas (decenas
  -- por cada una), asi que le doy mas techo al contador.
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  partida_id   INT UNSIGNED    NOT NULL,
  event_type   VARCHAR(40)     NOT NULL,
  -- Columna JSON: el detalle de cada evento tiene forma distinta segun el
  -- tipo (un keylock guarda las teclas, un match_won guarda el puntaje). En
  -- vez de inventar veinte columnas que casi siempre estarian vacias, guardo
  -- la parte variable como JSON y listo.
  detail_json  JSON            NULL,
  created_at   DATETIME        NOT NULL,
  PRIMARY KEY (id),
  KEY idx_partida (partida_id),
  KEY idx_type (event_type),
  -- CLAVE FORANEA: partida_id tiene que existir SI O SI en partidas.id. Es la
  -- integridad referencial: la base no me deja guardar un evento huerfano de
  -- una partida que no existe.
  -- ON DELETE CASCADE: si borro una partida, se borran solos todos sus
  -- eventos. Sin esto quedarian apuntando a la nada (o el DELETE fallaria).
  CONSTRAINT fk_eventos_partida
    FOREIGN KEY (partida_id) REFERENCES partidas(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- Rondas de minijuegos (Firewall, caza de pop-ups, soldadura...)
-- ------------------------------------------------------------
-- Una fila por ronda. Los campos comunes son columnas para poder ordenar y
-- promediar (ranking por minijuego); lo propio de cada uno va en detail_json.
-- Para una base ya creada: sql/migracion_minijuegos.sql.
CREATE TABLE IF NOT EXISTS minijuegos (
  id            BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT,
  partida_id    INT UNSIGNED     NOT NULL,
  tipo          VARCHAR(30)      NOT NULL,                 -- 'firewall', 'popups', ...
  puntos        INT              NOT NULL DEFAULT 0,       -- puntaje ganado en la ronda
  segundos      SMALLINT UNSIGNED NOT NULL DEFAULT 0,      -- duración de la ronda
  precision_pct TINYINT UNSIGNED NOT NULL DEFAULT 0,       -- aciertos sobre el total, 0-100
  detail_json   JSON             NULL,
  created_at    DATETIME         NOT NULL,
  PRIMARY KEY (id),
  KEY idx_partida (partida_id),
  KEY idx_tipo_puntos (tipo, puntos),
  CONSTRAINT fk_minijuegos_partida
    FOREIGN KEY (partida_id) REFERENCES partidas(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- Datos de ejemplo (opcionales, para probar el ranking)
-- ------------------------------------------------------------
INSERT INTO partidas
  (player_name, modo, status, won, score, base_score, level_reached,
   elapsed_sec, integrity_end, mistakes, hints_used, popups_closed,
   started_at, finished_at)
VALUES
  ('Nayla',   'virus',   'won',  1, 2840, 2100, 4, 720, 78, 2, 1, 14,
   DATE_SUB(NOW(), INTERVAL 2 DAY), DATE_SUB(NOW(), INTERVAL 2 DAY) + INTERVAL 12 MINUTE),
  ('Santiago','virus',   'won',  1, 2510, 1950, 4, 840, 61, 4, 2, 11,
   DATE_SUB(NOW(), INTERVAL 1 DAY), DATE_SUB(NOW(), INTERVAL 1 DAY) + INTERVAL 14 MINUTE),
  ('Alex',    'virus',   'lost', 0, 980,  980,  2, 310,  0, 5, 1,  6,
   DATE_SUB(NOW(), INTERVAL 5 HOUR), DATE_SUB(NOW(), INTERVAL 5 HOUR) + INTERVAL 5 MINUTE),
  ('Morena',  'tecnico', 'won',  1, 3120, 2300, 4, 690, 92, 1, 0, 18,
   DATE_SUB(NOW(), INTERVAL 3 HOUR), DATE_SUB(NOW(), INTERVAL 3 HOUR) + INTERVAL 11 MINUTE),
  ('Damián',  'tecnico', 'won',  1, 4093, 2909, 4, 540, 100, 1, 0, 0,
   DATE_SUB(NOW(), INTERVAL 2 HOUR), DATE_SUB(NOW(), INTERVAL 2 HOUR) + INTERVAL 9 MINUTE);

-- ------------------------------------------------------------
-- Migración para bases ya creadas (antes del segundo modo de juego)
-- ------------------------------------------------------------
-- ALTER TABLE partidas
--   ADD COLUMN modo ENUM('virus','tecnico') NOT NULL DEFAULT 'virus' AFTER player_name,
--   ADD KEY idx_modo (modo);

-- Migración para el ranking (token por partida y mejor racha)
-- ALTER TABLE partidas
--   ADD COLUMN token CHAR(32) NULL AFTER status,
--   ADD COLUMN best_streak SMALLINT UNSIGNED NOT NULL DEFAULT 0 AFTER popups_closed,
--   ADD KEY idx_ranking (status, modo, score);

-- Migración para las cuentas de usuario (login y registro)
-- Esta va en un archivo aparte porque, además del ALTER, tiene que crear la
-- tabla usuarios ANTES de poder apuntarle con la clave foránea. En una base
-- ya creada alcanza con importar:
--   sql/migracion_usuarios.sql
