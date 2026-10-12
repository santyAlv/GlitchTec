-- ============================================================
-- Glitch.TEC — migración: cuentas de usuario
-- Para una base que YA existía antes de las cuentas. Si la base es
-- nueva no hace falta: sql/schema.sql ya crea todo esto.
--
-- Ejecutar UNA sola vez, en phpMyAdmin (pestaña Importar) o con:
--   mysql -u root < sql/migracion_usuarios.sql
--
-- No toca ninguna partida guardada: las que ya estaban quedan con
-- user_id en NULL, que es lo mismo que "jugada por un invitado".
-- ============================================================

USE glitchtec;

-- La misma tabla que define schema.sql (ahí están explicadas las columnas).
CREATE TABLE IF NOT EXISTS usuarios (
  id              INT UNSIGNED     NOT NULL AUTO_INCREMENT,
  username        VARCHAR(24)      NOT NULL,
  email           VARCHAR(120)     NOT NULL,
  password_hash   VARCHAR(255)     NOT NULL,
  fecha_registro  DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ultimo_login    DATETIME         NULL,
  intentos_fallidos TINYINT UNSIGNED NOT NULL DEFAULT 0,
  bloqueado_hasta DATETIME         NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_username (username),
  UNIQUE KEY uq_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- El dueño de cada partida. Va después de crear usuarios porque la clave
-- foránea apunta a esa tabla. Si se corre dos veces, este ALTER falla con
-- "Duplicate column name 'user_id'": quiere decir que ya estaba aplicado.
ALTER TABLE partidas
  ADD COLUMN user_id INT UNSIGNED NULL AFTER id,
  ADD KEY idx_user (user_id),
  ADD CONSTRAINT fk_partidas_usuario
    FOREIGN KEY (user_id) REFERENCES usuarios(id) ON DELETE SET NULL;
