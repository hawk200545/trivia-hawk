# Multiplayer Quiz / Trivia Game — Claude Project Instructions

## Project Overview

A real-time multiplayer quiz/trivia game where hosts create quizzes and players join via room codes. Features live question reveal, timers, answer submission, leaderboard, and optional power-ups and team modes.

## Tech Stack

- **Frontend**: Next.js (app router) — `apps/web`
- **HTTP Server**: Node.js with Hono — `apps/http_server`
- **WebSocket Server**: Node.js ws/uWebSockets — `apps/ws_server`
- **Database**: PostgreSQL via Prisma — `packages/prisma`
- **Monorepo**: Turborepo + Bun

---

## 🏗️ Monorepo Structure

```
/
├── apps/
│   ├── web/              # Next.js frontend
│   ├── http_server/      # REST API (Hono)
│   └── ws_server/        # WebSocket server
├── packages/
│   ├── prisma/           # Prisma schema + generated client
│   ├── typescript-config/ # Shared tsconfig bases
│   └── shared/           # Shared types, utils, constants
├── turbo.json
├── package.json
└── bun.lockb
```

---

## ⚠️ CRITICAL: Bun & Workspace Rules

> **NEVER use `npm install` or `yarn`. ALWAYS use `bun install`.**

1. **Always run `bun install` from the repo root** after adding or changing any `package.json`. Workspace symlinks in `node_modules/@repo/` won't exist until you do. This is the #1 cause of "Cannot find module" errors.

2. **Don't create `package.json` files without installing.** If you add a new app/package or add a dependency, run `bun install` at the repo root immediately after, or TypeScript will not resolve `@repo/*` packages.

3. **`@repo/typescript-config`** — Every app/package extends `@repo/typescript-config/base.json` (or `nextjs.json`, `react-library.json`). When creating a new app:
   - `tsconfig.json` must extend the correct base
   - `@repo/typescript-config` must be in `devDependencies` as `"workspace:*"`

4. **Prisma** — The Prisma client lives in `packages/prisma`. After any schema changes:
   - Run `bunx prisma generate` from `packages/prisma`
   - Run `bun install` from repo root if `@prisma/client` is not resolving

5. **Put dependencies in the right place.** Runtime deps go in `dependencies`, not `devDependencies`. Prisma client, Hono, ws, etc. needed at runtime → `dependencies`.

---

## 🚫 Don'ts

- Don't install packages from inside individual app folders — always install from repo root
- Don't use relative paths like `../../packages/typescript-config/base.json` in `tsconfig.json` — use the `@repo/` alias
- Don't forget Turbo caches builds — run `turbo run build --force` if you suspect stale caches
- Don't use `npm` or `yarn` anywhere in this project

---

## 🧱 Creating New Apps or Packages

- Copy the `package.json` and `tsconfig.json` pattern from an existing app (e.g., `apps/http_server`)
- Always include `@repo/typescript-config` and any shared packages in `devDependencies`
- Run `bun install` from the repo root immediately after creating the new app/package

---

## Database Schema (Prisma — `packages/prisma`)

Key models to implement:

```prisma
// packages/prisma/schema.prisma

model User {
  id        String   @id @default(cuid())
  username  String   @unique
  createdAt DateTime @default(now())
  quizzes   Quiz[]
  scores    Score[]
}

model Quiz {
  id        String     @id @default(cuid())
  title     String
  hostId    String
  host      User       @relation(fields: [hostId], references: [id])
  questions Question[]
  rooms     Room[]
  createdAt DateTime   @default(now())
}

model Question {
  id            String   @id @default(cuid())
  quizId        String
  quiz          Quiz     @relation(fields: [quizId], references: [id])
  text          String
  imageUrl      String?
  options       Json     // string[]
  correctIndex  Int
  timeLimitSecs Int      @default(30)
  order         Int
}

model Room {
  id        String     @id @default(cuid())
  code      String     @unique  // 6-char join code
  quizId    String
  quiz      Quiz       @relation(fields: [quizId], references: [id])
  status    RoomStatus @default(LOBBY)
  createdAt DateTime   @default(now())
  scores    Score[]
}

model Score {
  id       String @id @default(cuid())
  roomId   String
  room     Room   @relation(fields: [roomId], references: [id])
  userId   String
  user     User   @relation(fields: [userId], references: [id])
  points   Int    @default(0)
  answers  Json   // { questionId: string, answerIndex: number, correct: boolean, timeMs: number }[]
}

enum RoomStatus {
  LOBBY
  ACTIVE
  FINISHED
}
```

After any schema change:
```bash
cd packages/prisma
bunx prisma migrate dev --name <migration_name>
bunx prisma generate
cd ../..
bun install
```

---

## WebSocket Event Protocol (`apps/ws_server`)

All messages are JSON. Structure: `{ type: string, payload: any }`

### Client → Server Events

| Event | Payload | Description |
|-------|---------|-------------|
| `JOIN_ROOM` | `{ roomCode, userId, username }` | Player joins lobby |
| `START_GAME` | `{ roomId }` | Host starts game |
| `SUBMIT_ANSWER` | `{ roomId, questionId, answerIndex, timeMs }` | Player submits answer |
| `USE_POWERUP` | `{ roomId, type }` | Player uses a power-up |

### Server → Client Events

| Event | Payload | Description |
|-------|---------|-------------|
| `ROOM_STATE` | `{ players, status }` | Current lobby state |
| `PLAYER_JOINED` | `{ userId, username }` | Broadcast new player |
| `QUESTION_START` | `{ question, questionIndex, total, timeLimitSecs }` | Reveal question + start timer |
| `QUESTION_END` | `{ correctIndex, results }` | Show correct answer + per-player result |
| `LEADERBOARD` | `{ scores: [{userId, username, points}] }` | Updated standings |
| `GAME_OVER` | `{ finalScores, winner }` | Game finished |
| `ERROR` | `{ message }` | Error feedback |

---

## Game Flow

```
Host creates quiz → Gets room code
Players join via room code → Lobby shows connected players
Host starts game →
  Loop per question:
    1. Server broadcasts QUESTION_START (question data, timer)
    2. Players submit answers within time limit
    3. Timer expires OR all answered → Server broadcasts QUESTION_END
    4. Points calculated (faster correct answers = more points)
    5. LEADERBOARD broadcast
  After all questions → GAME_OVER broadcast
```

### Scoring Formula

```ts
const MAX_POINTS = 1000;
const points = answer.correct
  ? Math.round(MAX_POINTS * (1 - answer.timeMs / (question.timeLimitSecs * 1000)) * 0.5 + MAX_POINTS * 0.5)
  : 0;
```

---

## Feature Checklist

### Core (implement first)
- [ ] Quiz creation UI (custom questions + question bank)
- [ ] Room creation with generated 6-char code
- [ ] Lobby with player list (WebSocket)
- [ ] Real-time question reveal with countdown timer
- [ ] Multiple choice answer submission
- [ ] Image support in questions (`imageUrl` field)
- [ ] Per-question results (correct/incorrect indicator)
- [ ] Live leaderboard after each question
- [ ] Game over screen with final scores

### Bonus
- [ ] Power-ups (50/50, extra time, double points)
- [ ] Teams mode (players assigned to teams, team scores aggregated)
- [ ] Saved high scores per quiz (`Score` model)
- [ ] Question bank (pre-seeded questions by category)
- [ ] Host dashboard (see answer distribution in real time)

---

## App-Specific Notes

### `apps/web` (Next.js)
- Use app router (`app/`)
- WebSocket connection managed in a client component with `useEffect`
- Key routes:
  - `/` — Home / create or join game
  - `/host/[quizId]` — Host quiz management
  - `/room/[code]` — Player game view
  - `/leaderboard/[roomId]` — Final results

### `apps/http_server` (Hono)
- REST endpoints for quiz CRUD, room creation, user auth
- Imports `@repo/prisma` for DB access
- Key routes:
  - `POST /quiz` — Create quiz
  - `GET /quiz/:id` — Get quiz with questions
  - `POST /room` — Create room (returns room code)
  - `GET /room/:code` — Get room state
  - `GET /scores/:roomId` — Get final scores

### `apps/ws_server`
- Pure WebSocket server (no HTTP routing needed)
- In-memory game state (Map of roomId → game state) for active games
- Persist final scores to DB via Prisma at game end
- Handle player disconnection gracefully (mark as disconnected, allow rejoin by userId)

### `packages/shared`
- Export shared TypeScript types: `WsMessage`, `Question`, `Player`, `RoomStatus`, etc.
- Export constants: `MAX_POINTS`, `DEFAULT_TIME_LIMIT`, power-up types
- Both `apps/web` and `apps/ws_server` import from `@repo/shared`

---

## Environment Variables

```env
# apps/http_server & apps/ws_server
DATABASE_URL="postgresql://user:password@localhost:5432/quizgame"

# apps/web
NEXT_PUBLIC_HTTP_URL="http://localhost:3001"
NEXT_PUBLIC_WS_URL="ws://localhost:3002"
```

---

## Running Locally

```bash
# Install all dependencies
bun install

# Start PostgreSQL (Docker example)
docker run -d -e POSTGRES_PASSWORD=password -e POSTGRES_DB=quizgame -p 5432:5432 postgres

# Run migrations
cd packages/prisma && bunx prisma migrate dev && cd ../..

# Run all apps in dev mode
bun run dev
# or with turbo:
turbo run dev
```

---

## Turbo Pipeline (`turbo.json`)

```json
{
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "dist/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {},
    "typecheck": {
      "dependsOn": ["^build"]
    }
  }
}
```

---

## State Synchronization Notes

- The WebSocket server is the **source of truth** for active game state
- HTTP server handles persistent data (quizzes, users, final scores)
- On reconnect, server sends current `ROOM_STATE` to the rejoining client
- Use `roomId` (not `roomCode`) internally after join; `roomCode` is only for joining
- Timer is authoritative on the **server** — clients display a countdown synced to server's question start timestamp

---

## Key Invariants to Maintain

1. A player cannot submit an answer after `QUESTION_END` is broadcast
2. Only the host (room creator) can call `START_GAME`
3. Room codes are unique and expire after game ends (or after 24h)
4. Questions are revealed one at a time in `order` sequence
5. Leaderboard is always sorted by `points` descending