# Comparity — Database Schema

## PostgreSQL Schema

```sql
-- ================================================================
-- USERS
-- ================================================================
CREATE TABLE users (
  id          BIGINT PRIMARY KEY,          -- Telegram user_id
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
-- DECKS (Card collections / categories)
-- ================================================================
CREATE TABLE decks (
  id              SERIAL PRIMARY KEY,
  slug            VARCHAR(64)  UNIQUE NOT NULL,  -- 'retro-tech', 'economy'
  name            VARCHAR(128) NOT NULL,           -- 'Ретро-технологии'
  description     TEXT,
  icon_emoji      VARCHAR(8),                      -- '💾'
  cover_image_url TEXT,
  parameter_name  VARCHAR(64)  NOT NULL,           -- 'Год выхода', 'Цена $'
  parameter_unit  VARCHAR(32),                     -- 'год', '$', 'кг'
  is_active       BOOLEAN      DEFAULT TRUE,
  card_count      INTEGER      DEFAULT 0,          -- denormalized cache
  created_at      TIMESTAMPTZ  DEFAULT NOW()
);

-- ================================================================
-- CARDS
-- ================================================================
CREATE TABLE cards (
  id              SERIAL PRIMARY KEY,
  deck_id         INTEGER      NOT NULL REFERENCES decks(id),
  title           VARCHAR(256) NOT NULL,           -- 'Apple Macintosh 128K'
  subtitle        VARCHAR(256),                    -- 'Первый массовый Mac'
  image_url       TEXT         NOT NULL,
  hidden_value    NUMERIC(15,4) NOT NULL,          -- 1984 (year) or 2495.00 ($)
  display_value   VARCHAR(64)  NOT NULL,           -- '1984' or '$2,495'
  flavor_text     TEXT,                            -- Fun fact shown after reveal
  difficulty      SMALLINT     DEFAULT 2,          -- 1=easy, 3=hard (for card draw logic)
  is_active       BOOLEAN      DEFAULT TRUE,
  created_at      TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX idx_cards_deck_id ON cards(deck_id);
CREATE INDEX idx_cards_hidden_value ON cards(deck_id, hidden_value);

-- ================================================================
-- SESSIONS
-- ================================================================
CREATE TYPE session_type   AS ENUM ('SOLO', 'GROUP');
CREATE TYPE session_status AS ENUM ('WAITING', 'ACTIVE', 'FINISHED', 'ABANDONED');

CREATE TABLE sessions (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  type          session_type NOT NULL DEFAULT 'SOLO',
  status        session_status NOT NULL DEFAULT 'WAITING',
  deck_id       INTEGER      NOT NULL REFERENCES decks(id),
  chat_id       BIGINT,                            -- NULL for solo, group chat_id for GROUP
  message_id    INTEGER,                           -- Telegram message with game card
  max_players   SMALLINT     DEFAULT 1,
  turn_timeout  INTEGER      DEFAULT 60,           -- seconds per turn
  created_by    BIGINT       NOT NULL REFERENCES users(id),
  started_at    TIMESTAMPTZ,
  finished_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX idx_sessions_status ON sessions(status);
CREATE INDEX idx_sessions_chat_id ON sessions(chat_id);

-- ================================================================
-- SESSION PLAYERS
-- ================================================================
CREATE TABLE session_players (
  id          SERIAL  PRIMARY KEY,
  session_id  UUID    NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  user_id     BIGINT  NOT NULL REFERENCES users(id),
  score       INTEGER DEFAULT 0,
  turn_order  SMALLINT,                            -- for multi-player turn sequence
  is_active   BOOLEAN DEFAULT TRUE,
  joined_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(session_id, user_id)
);

CREATE INDEX idx_session_players_session ON session_players(session_id);

-- ================================================================
-- CHAIN STATE (snapshot persisted per session, live state in Redis)
-- ================================================================
CREATE TABLE chain_cards (
  id            SERIAL  PRIMARY KEY,
  session_id    UUID    NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  card_id       INTEGER NOT NULL REFERENCES cards(id),
  position      SMALLINT NOT NULL,                -- 0-indexed position in chain
  is_face_down  BOOLEAN  DEFAULT FALSE,           -- bluff: hidden until challenged
  placed_by     BIGINT   REFERENCES users(id),
  placed_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(session_id, position)
);

CREATE INDEX idx_chain_cards_session ON chain_cards(session_id, position);

-- ================================================================
-- TURNS (full history of moves)
-- ================================================================
CREATE TYPE turn_status AS ENUM (
  'PENDING',      -- waiting for challenge window
  'ACCEPTED',     -- no challenge, move stands
  'CORRECT',      -- validated correct position
  'INCORRECT',    -- wrong position, card removed
  'CHALLENGED',   -- was challenged
  'BLUFF_CAUGHT', -- bluff was caught by challenger
  'BLUFF_HELD'    -- bluff survived challenge
);

CREATE TABLE turns (
  id                  SERIAL      PRIMARY KEY,
  session_id          UUID        NOT NULL REFERENCES sessions(id),
  user_id             BIGINT      NOT NULL REFERENCES users(id),
  card_id             INTEGER     NOT NULL REFERENCES cards(id),
  proposed_position   SMALLINT    NOT NULL,
  is_bluff            BOOLEAN     DEFAULT FALSE,
  status              turn_status DEFAULT 'PENDING',
  challenged_by       BIGINT      REFERENCES users(id),
  score_delta_placer  SMALLINT    DEFAULT 0,       -- points awarded to the placer
  score_delta_chall   SMALLINT    DEFAULT 0,       -- points awarded to the challenger
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  resolved_at         TIMESTAMPTZ
);

CREATE INDEX idx_turns_session ON turns(session_id, created_at DESC);
```

## Redis Data Structures

### Active Game Session
```
KEY: game:session:{uuid}
TYPE: JSON string (via JSON.stringify)
TTL: 3600 seconds (1 hour)

{
  "id": "uuid",
  "type": "SOLO",
  "status": "ACTIVE",
  "deckId": 1,
  "deckParameterName": "Год выхода",
  "chain": [
    {
      "cardId": 42,
      "title": "Atari 2600",
      "imageUrl": "https://...",
      "hiddenValue": 1977,
      "displayValue": "1977",
      "isFaceDown": false,
      "placedBy": 123456789
    }
  ],
  "players": {
    "123456789": {
      "score": 5,
      "turnOrder": 0
    }
  },
  "currentTurn": {
    "userId": 123456789,
    "cardId": 55,
    "card": { ... },
    "startedAt": "ISO timestamp"
  },
  "pendingChallenge": null,
  "chatId": null,
  "updatedAt": "ISO timestamp"
}
```

### Player Turn Queue (group mode)
```
KEY: game:queue:{session_id}
TYPE: Redis List (LPUSH / RPOP)
VALUE: user_id strings
TTL: 3600
```

### Pub/Sub Channel (real-time sync)
```
CHANNEL: game:updates:{session_id}
MESSAGE: JSON event { type, payload }

Event types:
  - CHAIN_UPDATED   → { chain }
  - TURN_RESULT     → { turnId, status, scoreDeltas }
  - CHALLENGE_START → { challengerId, timeoutMs }
  - CHALLENGE_END   → { result, newScores }
  - GAME_OVER       → { winner, finalScores }
```

### Leaderboard (sorted set)
```
KEY: leaderboard:global
KEY: leaderboard:deck:{deckId}
TYPE: Redis Sorted Set
SCORE: total points
MEMBER: user_id
```

## Seed Data (Example Cards)

### Deck: Ретро-технологии (параметр: Год выхода)
| Title | Year | Display |
|---|---|---|
| Atari 2600 | 1977 | 1977 |
| ZX Spectrum | 1982 | 1982 |
| Apple Macintosh 128K | 1984 | 1984 |
| Game Boy | 1989 | 1989 |
| DOOM (игра) | 1993 | 1993 |
| Nokia 3310 | 2000 | 2000 |
| iPod (1st gen) | 2001 | 2001 |
| iPhone (1st gen) | 2007 | 2007 |

### Deck: Экономика (параметр: ВВП страны 2023, $трлн)
| Title | GDP | Display |
|---|---|---|
| Люксембург | 0.09 | $0.09T |
| Норвегия | 0.55 | $0.55T |
| Австралия | 1.69 | $1.69T |
| Южная Корея | 1.71 | $1.71T |
| Германия | 4.46 | $4.46T |
| Япония | 4.21 | $4.21T |
| Китай | 17.79 | $17.79T |
| США | 26.95 | $26.95T |
