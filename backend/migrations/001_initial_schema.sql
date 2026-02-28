-- Comparity — Initial Schema Migration
-- Run: psql $DATABASE_URL -f migrations/001_initial_schema.sql

BEGIN;

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ================================================================
-- USERS
-- ================================================================
CREATE TABLE IF NOT EXISTS users (
  id          BIGINT      PRIMARY KEY,
  username    VARCHAR(64),
  first_name  VARCHAR(128) NOT NULL,
  last_name   VARCHAR(128),
  language    VARCHAR(8)   DEFAULT 'ru',
  score_total INTEGER      DEFAULT 0,
  games_won   INTEGER      DEFAULT 0,
  games_lost  INTEGER      DEFAULT 0,
  games_total INTEGER      DEFAULT 0,
  created_at  TIMESTAMPTZ  DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  DEFAULT NOW()
);

-- ================================================================
-- DECKS
-- ================================================================
CREATE TABLE IF NOT EXISTS decks (
  id              SERIAL       PRIMARY KEY,
  slug            VARCHAR(64)  UNIQUE NOT NULL,
  name            VARCHAR(128) NOT NULL,
  description     TEXT,
  icon_emoji      VARCHAR(8),
  cover_image_url TEXT,
  parameter_name  VARCHAR(64)  NOT NULL,
  parameter_unit  VARCHAR(32),
  is_active       BOOLEAN      DEFAULT TRUE,
  card_count      INTEGER      DEFAULT 0,
  created_at      TIMESTAMPTZ  DEFAULT NOW()
);

-- ================================================================
-- CARDS
-- ================================================================
CREATE TABLE IF NOT EXISTS cards (
  id            SERIAL        PRIMARY KEY,
  deck_id       INTEGER       NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
  title         VARCHAR(256)  NOT NULL,
  subtitle      VARCHAR(256),
  image_url     TEXT          NOT NULL DEFAULT '',
  hidden_value  NUMERIC(15,4) NOT NULL,
  display_value VARCHAR(64)   NOT NULL,
  flavor_text   TEXT,
  difficulty    SMALLINT      DEFAULT 2,
  is_active     BOOLEAN       DEFAULT TRUE,
  created_at    TIMESTAMPTZ   DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cards_deck_id ON cards(deck_id);
CREATE INDEX IF NOT EXISTS idx_cards_value ON cards(deck_id, hidden_value);

-- ================================================================
-- SESSIONS
-- ================================================================
DO $$ BEGIN CREATE TYPE session_type AS ENUM ('SOLO', 'GROUP'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE session_status AS ENUM ('WAITING', 'ACTIVE', 'FINISHED', 'ABANDONED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS sessions (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  type          session_type  NOT NULL DEFAULT 'SOLO',
  status        session_status NOT NULL DEFAULT 'WAITING',
  deck_id       INTEGER       NOT NULL REFERENCES decks(id),
  chat_id       BIGINT,
  message_id    INTEGER,
  max_players   SMALLINT      DEFAULT 1,
  turn_timeout  INTEGER       DEFAULT 60,
  created_by    BIGINT        NOT NULL REFERENCES users(id),
  started_at    TIMESTAMPTZ,
  finished_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ   DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sessions_status  ON sessions(status);
CREATE INDEX IF NOT EXISTS idx_sessions_chat_id ON sessions(chat_id);

-- ================================================================
-- SESSION PLAYERS
-- ================================================================
CREATE TABLE IF NOT EXISTS session_players (
  id          SERIAL   PRIMARY KEY,
  session_id  UUID     NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  user_id     BIGINT   NOT NULL REFERENCES users(id),
  score       INTEGER  DEFAULT 0,
  turn_order  SMALLINT,
  is_active   BOOLEAN  DEFAULT TRUE,
  joined_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(session_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_session_players ON session_players(session_id);

-- ================================================================
-- CHAIN CARDS (snapshot)
-- ================================================================
CREATE TABLE IF NOT EXISTS chain_cards (
  id           SERIAL   PRIMARY KEY,
  session_id   UUID     NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  card_id      INTEGER  NOT NULL REFERENCES cards(id),
  position     SMALLINT NOT NULL,
  is_face_down BOOLEAN  DEFAULT FALSE,
  placed_by    BIGINT   REFERENCES users(id),
  placed_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(session_id, position)
);

CREATE INDEX IF NOT EXISTS idx_chain_cards ON chain_cards(session_id, position);

-- ================================================================
-- TURNS
-- ================================================================
DO $$ BEGIN CREATE TYPE turn_status AS ENUM ('PENDING', 'ACCEPTED', 'CORRECT', 'INCORRECT', 'CHALLENGED', 'BLUFF_CAUGHT', 'BLUFF_HELD'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS turns (
  id                  SERIAL      PRIMARY KEY,
  session_id          UUID        NOT NULL REFERENCES sessions(id),
  user_id             BIGINT      NOT NULL REFERENCES users(id),
  card_id             INTEGER     NOT NULL REFERENCES cards(id),
  proposed_position   SMALLINT    NOT NULL,
  is_bluff            BOOLEAN     DEFAULT FALSE,
  status              turn_status DEFAULT 'PENDING',
  challenged_by       BIGINT      REFERENCES users(id),
  score_delta_placer  SMALLINT    DEFAULT 0,
  score_delta_chall   SMALLINT    DEFAULT 0,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  resolved_at         TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_turns_session ON turns(session_id, created_at DESC);

COMMIT;
