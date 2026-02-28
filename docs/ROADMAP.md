# Comparity MVP — 2-Week Roadmap

## Sprint Structure: 2 weeks, daily deploys to staging

---

## Week 1 — Core Backend & Bot

### Day 1-2: Infrastructure & DB
- [ ] Docker Compose: PostgreSQL + Redis + backend + frontend
- [ ] PostgreSQL migrations (all tables)
- [ ] Redis connection + session helpers
- [ ] Seed data: 2 decks × 10 cards each
- [ ] CI: GitHub Actions — lint + test on push

**Deliverable**: `docker-compose up` → DB ready, seed loaded

---

### Day 3-4: Telegraf Bot — Solo Flow
- [ ] `/start` → welcome message + deck picker (inline keyboard)
- [ ] `/play` → create session, pick starting card, launch TWA button
- [ ] `/stats` → show user score + win/loss ratio
- [ ] `/decks` → list available decks with emoji
- [ ] Session creation logic in Redis
- [ ] Card draw (avoid repeat cards in same session)

**Deliverable**: Bot creates session, sends launch button

---

### Day 5-6: Game Engine
- [ ] `validateMove(chain, card, position)` — pure function
- [ ] `resolveChallenge(turn, chain)` — pure function
- [ ] `calculateScores(turnResult)` — pure function
- [ ] `drawNextCard(sessionId, deckId)` — avoids repeats
- [ ] Unit tests for all engine functions (Jest)
- [ ] Challenge window timer (30s via Redis TTL key)

**Deliverable**: Engine fully tested, 90%+ coverage on logic

---

### Day 7: REST API — Game Endpoints
- [ ] `POST /api/auth` — verify Telegram initData, return JWT
- [ ] `GET /api/sessions/:id` — full session state
- [ ] `POST /api/sessions/:id/move` — place card
- [ ] `POST /api/sessions/:id/challenge` — challenge last move
- [ ] `GET /api/sessions/:id/stream` — SSE for real-time updates
- [ ] `GET /api/decks` — list decks
- [ ] `GET /api/leaderboard` — top 10 players

**Deliverable**: Postman collection passing all scenarios

---

## Week 2 — Mini App & Group Mode

### Day 8-9: React Mini App — Chain View
- [ ] Vite + React + Tailwind + @dnd-kit/core setup
- [ ] Telegram WebApp SDK integration (theme, initData)
- [ ] Chain component: horizontal scroll, card slots
- [ ] Card component: face-up + face-down states
- [ ] Drag-and-drop: drag card to position in chain
- [ ] Position indicators with slot highlighting on drag
- [ ] "Place" / "Bluff" toggle before confirming position

**Deliverable**: Playable solo game in Mini App

---

### Day 10-11: React Mini App — Game Flow
- [ ] API integration (all endpoints)
- [ ] SSE client for real-time state updates
- [ ] Move result animation (correct = green flash, wrong = red shake)
- [ ] Challenge button appears for 30s after each bluff placement
- [ ] Challenge result reveal animation (card flip)
- [ ] Score display + delta animations (+2, -1)
- [ ] Game over screen with final scores

**Deliverable**: Complete solo game loop working end-to-end

---

### Day 12: Group / Inline Mode
- [ ] Bot: `@comparitybot` inline query → deck picker
- [ ] Bot posts game card to group chat with position buttons (1–N+1)
- [ ] Users vote on position via callback buttons
- [ ] 30-second voting window → majority wins
- [ ] "Challenge" button available to all group members
- [ ] Bot posts result message with score update
- [ ] Group leaderboard command

**Deliverable**: Playable group game in Telegram chat

---

### Day 13: Polish & QA
- [ ] Error handling: session expired, card not found, invalid move
- [ ] Rate limiting on API (100 req/min per user)
- [ ] Telegram WebApp back button / close behavior
- [ ] Loading skeletons in Mini App
- [ ] Mobile-first responsive layout check (iPhone SE → large Android)
- [ ] Localization strings (ru/en)

---

### Day 14: Deploy & Launch Prep
- [ ] Deploy to VPS (or Railway/Render): bot webhook set
- [ ] Nginx reverse proxy + SSL (Let's Encrypt)
- [ ] Environment variable audit (no secrets in git)
- [ ] Smoke test full solo + group game on production
- [ ] Analytics: track game_start, move_placed, challenge_used, game_finish
- [ ] README with setup instructions

**Deliverable**: Production URL, bot live, first real game played

---

## Post-MVP Backlog (Week 3+)
- Card image uploads via admin panel
- ELO-based matchmaking for multiplayer
- Daily challenge (same card set for all players)
- Achievements / badges system
- More decks: Поп-культура, Спорт, Наука
- Monetization: premium decks via Telegram Stars
