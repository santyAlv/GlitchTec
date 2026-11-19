-- ============================================================
-- Glitch.TEC — esquema para Postgres (Supabase)
-- La misma base que sql/schema.sql (MySQL), traducida:
--   AUTO_INCREMENT      -> GENERATED ALWAYS AS IDENTITY
--   ENUM                -> text con CHECK
--   TINYINT(1) 0/1      -> smallint (SUM(won) sigue contando ganadas)
--   JSON                -> jsonb
--   DATETIME            -> timestamp(0): sin decimales, igual que MySQL
--   collation _ci       -> citext en usuario y mail: "Santi" y "santi"
--                          siguen siendo el mismo usuario
-- Ejecutar una vez en el SQL Editor de Supabase.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS citext WITH SCHEMA extensions;

CREATE TABLE IF NOT EXISTS public.usuarios (
  id                integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  username          extensions.citext NOT NULL,
  email             extensions.citext NOT NULL,
  password_hash     varchar(255)      NOT NULL,
  fecha_registro    timestamp(0)      NOT NULL DEFAULT now(),
  ultimo_login      timestamp(0)      NULL,
  intentos_fallidos smallint          NOT NULL DEFAULT 0 CHECK (intentos_fallidos >= 0),
  bloqueado_hasta   timestamp(0)      NULL,
  -- registro.php busca estos nombres en el error para saber qué campo culpar
  CONSTRAINT uq_username UNIQUE (username),
  CONSTRAINT uq_email    UNIQUE (email),
  CONSTRAINT ck_username_largo CHECK (char_length(username) <= 24),
  CONSTRAINT ck_email_largo    CHECK (char_length(email) <= 120)
);

CREATE TABLE IF NOT EXISTS public.partidas (
  id            integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id       integer      NULL REFERENCES public.usuarios(id) ON DELETE SET NULL,
  player_name   varchar(40)  NOT NULL DEFAULT 'estudiante',
  modo          text         NOT NULL DEFAULT 'virus'   CHECK (modo IN ('virus', 'tecnico')),
  status        text         NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'won', 'lost', 'abandoned')),
  token         char(32)     NULL,
  won           smallint     NOT NULL DEFAULT 0 CHECK (won IN (0, 1)),
  score         integer      NOT NULL DEFAULT 0,
  base_score    integer      NOT NULL DEFAULT 0,
  level_reached smallint     NOT NULL DEFAULT 0 CHECK (level_reached >= 0),
  elapsed_sec   integer      NOT NULL DEFAULT 0 CHECK (elapsed_sec >= 0),
  integrity_end smallint     NOT NULL DEFAULT 0 CHECK (integrity_end BETWEEN 0 AND 255),
  mistakes      integer      NOT NULL DEFAULT 0 CHECK (mistakes >= 0),
  hints_used    integer      NOT NULL DEFAULT 0 CHECK (hints_used >= 0),
  popups_closed integer      NOT NULL DEFAULT 0 CHECK (popups_closed >= 0),
  best_streak   integer      NOT NULL DEFAULT 0 CHECK (best_streak BETWEEN 0 AND 65535),
  sospechosa    smallint     NOT NULL DEFAULT 0 CHECK (sospechosa IN (0, 1)),
  started_at    timestamp(0) NOT NULL,
  finished_at   timestamp(0) NULL
);
CREATE INDEX IF NOT EXISTS idx_partidas_score    ON public.partidas (score DESC);
CREATE INDEX IF NOT EXISTS idx_partidas_status   ON public.partidas (status);
CREATE INDEX IF NOT EXISTS idx_partidas_modo     ON public.partidas (modo);
CREATE INDEX IF NOT EXISTS idx_partidas_finished ON public.partidas (finished_at);
CREATE INDEX IF NOT EXISTS idx_partidas_ranking  ON public.partidas (status, modo, score);
CREATE INDEX IF NOT EXISTS idx_partidas_user     ON public.partidas (user_id);

CREATE TABLE IF NOT EXISTS public.eventos (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  partida_id  integer      NOT NULL REFERENCES public.partidas(id) ON DELETE CASCADE,
  event_type  varchar(40)  NOT NULL,
  detail_json jsonb        NULL,
  created_at  timestamp(0) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_eventos_partida ON public.eventos (partida_id);
CREATE INDEX IF NOT EXISTS idx_eventos_type    ON public.eventos (event_type);

CREATE TABLE IF NOT EXISTS public.minijuegos (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  partida_id    integer      NOT NULL REFERENCES public.partidas(id) ON DELETE CASCADE,
  tipo          varchar(30)  NOT NULL,
  puntos        integer      NOT NULL DEFAULT 0,
  segundos      integer      NOT NULL DEFAULT 0 CHECK (segundos BETWEEN 0 AND 65535),
  precision_pct smallint     NOT NULL DEFAULT 0 CHECK (precision_pct BETWEEN 0 AND 255),
  detail_json   jsonb        NULL,
  created_at    timestamp(0) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_minijuegos_partida     ON public.minijuegos (partida_id);
CREATE INDEX IF NOT EXISTS idx_minijuegos_tipo_puntos ON public.minijuegos (tipo, puntos);

-- Supabase publica las tablas de public en su API REST con la clave anon.
-- RLS activo y SIN políticas: esa API no puede leer ni escribir nada (ni los
-- hashes de usuarios). El juego no la usa: entra por PHP con el rol dueño de
-- las tablas, al que RLS no le aplica.
ALTER TABLE public.usuarios   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partidas   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eventos    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.minijuegos ENABLE ROW LEVEL SECURITY;

-- Partidas de ejemplo para que el ranking no arranque vacío (las mismas de schema.sql)
INSERT INTO public.partidas
  (player_name, modo, status, won, score, base_score, level_reached,
   elapsed_sec, integrity_end, mistakes, hints_used, popups_closed,
   started_at, finished_at)
SELECT * FROM (VALUES
  ('Nayla',    'virus',   'won',  1, 2840, 2100, 4, 720,  78, 2, 1, 14, now() - interval '2 days',  now() - interval '2 days'  + interval '12 minutes'),
  ('Santiago', 'virus',   'won',  1, 2510, 1950, 4, 840,  61, 4, 2, 11, now() - interval '1 day',   now() - interval '1 day'   + interval '14 minutes'),
  ('Alex',     'virus',   'lost', 0,  980,  980, 2, 310,   0, 5, 1,  6, now() - interval '5 hours', now() - interval '5 hours' + interval '5 minutes'),
  ('Morena',   'tecnico', 'won',  1, 3120, 2300, 4, 690,  92, 1, 0, 18, now() - interval '3 hours', now() - interval '3 hours' + interval '11 minutes'),
  ('Damián',   'tecnico', 'won',  1, 4093, 2909, 4, 540, 100, 1, 0,  0, now() - interval '2 hours', now() - interval '2 hours' + interval '9 minutes')
) AS v
WHERE NOT EXISTS (SELECT 1 FROM public.partidas);
