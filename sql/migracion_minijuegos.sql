-- ============================================================
-- Glitch.TEC — migración: rondas de minijuegos y partidas sospechosas
-- Para una base que YA existía. Si la base es nueva no hace falta:
-- sql/schema.sql ya crea todo esto.
--
-- Ejecutar UNA sola vez, en phpMyAdmin (pestaña Importar) o con:
--   mysql -u root < sql/migracion_minijuegos.sql
--
-- No toca ninguna partida guardada: las que ya estaban quedan con
-- sospechosa = 0 (limpias) y sin rondas de minijuegos.
-- ============================================================

USE glitchtec;

-- Una fila por ronda de minijuego (Firewall, caza de pop-ups, soldadura...).
-- Va en tabla aparte, y no como columnas de partidas, porque una partida puede
-- tener muchas rondas de cualquier tipo. Los campos comunes son columnas para
-- poder ordenar y promediar; lo propio de cada minijuego va en detail_json.
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
  -- el ranking por minijuego: WHERE tipo = ... ORDER BY puntos DESC
  KEY idx_tipo_puntos (tipo, puntos),
  -- Si se borra la partida, se borran sus rondas (igual que sus eventos).
  CONSTRAINT fk_minijuegos_partida
    FOREIGN KEY (partida_id) REFERENCES partidas(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Partida que no cuadra con lo que el servidor vio (ver partida_end.php):
-- no entra al ranking. Si se corre dos veces, este ALTER falla con
-- "Duplicate column name 'sospechosa'": quiere decir que ya estaba aplicado.
ALTER TABLE partidas
  ADD COLUMN sospechosa TINYINT(1) NOT NULL DEFAULT 0 AFTER best_streak;
