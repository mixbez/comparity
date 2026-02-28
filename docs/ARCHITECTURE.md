# Comparity — System Architecture

## High-Level Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        TELEGRAM                                  │
│  ┌──────────────┐    ┌──────────────────────────────────────┐   │
│  │  Bot Chat    │    │        Telegram Mini App (TWA)        │   │
│  │  (Inline +   │    │   React + Tailwind + DnD Kit         │   │
│  │   Commands)  │    │   Chain visualization + drag-n-drop   │   │
│  └──────┬───────┘    └──────────────┬───────────────────────┘   │
└─────────┼────────────────────────── ┼ ──────────────────────────┘
          │  Webhook (HTTPS)           │  REST API calls
          ▼                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                     BACKEND (Node.js)                           │
│  ┌─────────────────┐      ┌──────────────────────────────────┐  │
│  │   Telegraf Bot  │      │      Fastify REST API            │  │
│  │                 │      │  /api/game/*  /api/cards/*       │  │
│  │  - Commands     │      │  /api/sessions/*                  │  │
│  │  - Inline mode  │      │  JWT auth via Telegram init_data  │  │
│  │  - Callbacks    │      └─────────────┬────────────────────┘  │
│  └────────┬────────┘                    │                        │
│           └──────────────┬─────────────┘                        │
│                          ▼                                       │
│              ┌───────────────────────┐                          │
│              │     Game Engine       │                          │
│              │  - Move validation    │                          │
│              │  - Chain management   │                          │
│              │  - Challenge logic    │                          │
│              │  - Score calculation  │                          │
│              └──────────┬────────────┘                          │
│                         │                                        │
│           ┌─────────────┼─────────────┐                        │
│           ▼             ▼             ▼                        │
│    ┌─────────────┐ ┌─────────┐ ┌──────────┐                   │
│    │   Redis     │ │Postgres │ │  S3/CDN  │                   │
│    │  Sessions   │ │  (main) │ │  Images  │                   │
│    │  Game state │ │  Users  │ │  Cards   │                   │
│    │  Pub/Sub    │ │  Cards  │ └──────────┘                   │
│    └─────────────┘ │  Decks  │                                 │
│                    │ Sessions│                                  │
│                    └─────────┘                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

### Telegraf Bot
- Handles `/start`, `/play`, `/stats`, `/decks` commands
- Inline mode for group game invitations
- Callback buttons for Challenge/Pass actions
- Sends Mini App launch button with game session context

### Fastify REST API
- Authenticates via Telegram WebApp `initData` (HMAC-SHA256)
- Exposes game state to the Mini App
- Processes moves and challenges from Mini App
- Real-time updates via Server-Sent Events (SSE)

### Game Engine
- Pure functions for game logic (easily testable)
- Move validation (is position correct in chain?)
- Challenge resolution (who wins?)
- Score updates

### Redis
- Active game sessions (TTL 1 hour)
- Player presence / turn queues
- Pub/Sub for real-time state sync between bot and API

### PostgreSQL
- Persistent storage for users, cards, decks
- Completed session records and analytics
- Leaderboards

## Data Flow: Solo Game

```
User: /play
  Bot → Create session in Redis
  Bot → Pick starting card from deck
  Bot → Send TWA button "Open Game"

User: Opens Mini App
  TWA → GET /api/sessions/:id (auth via initData)
  TWA → Display chain with starting card

User: Drags card to position
  TWA → POST /api/sessions/:id/move { cardId, position, isBluff }
  Engine → Validate or accept (bluff = skip validation)
  Engine → Update Redis chain state
  TWA → Show result (correct / incorrect)
  Bot → Send next card (if correct)
```

## Data Flow: Group Game (Inline Mode)

```
User: @comparitybot in group chat
  Bot → Show inline keyboard with decks
  User picks deck → Bot posts "game card" message in chat

Group members: vote on position (1,2,3,4,5...)
  Bot → Majority vote wins after 30s
  Any member → Can Challenge before reveal

Bot → Reveals result, updates score, posts next card
```

## Challenge / Bluff Resolution

```
Player A places card face-down (bluff):
  Chain: [Card1=100] [CardA=???] [Card2=500]

Player B hits "Challenge":
  Engine reveals CardA.value

  Case 1: CardA.value = 300 (correct position)
    → Player A: +2 points, Player B: -1 point
    → Card stays in chain (revealed)

  Case 2: CardA.value = 600 (wrong position!)
    → Player A: -1 point, Player B: +2 points
    → Card removed from chain
```
