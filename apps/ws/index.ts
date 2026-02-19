import type { ServerWebSocket } from "bun";
import { prisma } from "@repo/db/client";
import {
    calculatePoints,
    type WsMessage,
    type JoinRoomPayload,
    type LeaveRoomPayload,
    type StartGamePayload,
    type SubmitAnswerPayload,
    type Player,
    type QuestionData,
    type RoomStatePayload,
    type QuestionStartPayload,
    type QuestionEndPayload,
    type LeaderboardPayload,
    type GameOverPayload,
    type LeaderboardEntry,
    type PlayerResult,
    type AnswerRecord,
} from "@repo/shared";

// ─── Types ───

interface PlayerConnection {
    ws: ServerWebSocket<WsData>;
    userId: string;
    username: string;
    connected: boolean;
}

interface PlayerAnswer {
    answerIndex: number;
    timeMs: number;
    correct: boolean;
    pointsEarned: number;
}

interface GameState {
    roomId: string;
    roomCode: string;
    hostId: string;
    quizId: string;
    players: Map<string, PlayerConnection>; // userId → connection
    status: "LOBBY" | "ACTIVE" | "FINISHED";
    questions: QuestionData[];
    questionIds: string[]; // actual DB IDs
    correctIndices: number[];
    currentQuestionIndex: number;
    answers: Map<string, Map<string, PlayerAnswer>>; // questionId → userId → answer
    scores: Map<string, number>; // userId → total points
    questionTimer: ReturnType<typeof setTimeout> | null;
}

interface WsData {
    userId: string;
    roomId: string;
}

// ─── In-Memory State ───

const rooms = new Map<string, GameState>();
const codeToRoomId = new Map<string, string>();

// ─── Helpers ───

function send(ws: ServerWebSocket<WsData>, msg: WsMessage): void {
    ws.send(JSON.stringify(msg));
}

function broadcast(game: GameState, msg: WsMessage, excludeUserId?: string): void {
    const data = JSON.stringify(msg);
    for (const [uid, player] of game.players) {
        if (uid !== excludeUserId && player.connected) {
            player.ws.send(data);
        }
    }
}

function getPlayerList(game: GameState): Player[] {
    return Array.from(game.players.values()).map((p) => ({
        userId: p.userId,
        username: p.username,
        connected: p.connected,
    }));
}

function getLeaderboard(game: GameState): LeaderboardEntry[] {
    return Array.from(game.players.values())
        .map((p) => ({
            userId: p.userId,
            username: p.username,
            points: game.scores.get(p.userId) ?? 0,
        }))
        .sort((a, b) => b.points - a.points);
}

function buildRoomState(game: GameState): RoomStatePayload {
    return {
        roomId: game.roomId,
        roomCode: game.roomCode,
        players: getPlayerList(game),
        status: game.status,
        hostId: game.hostId,
    };
}

// ─── Event Handlers ───

async function handleJoinRoom(
    ws: ServerWebSocket<WsData>,
    payload: JoinRoomPayload
): Promise<void> {
    const { roomCode, userId, username } = payload;

    // Find room by code
    let roomId = codeToRoomId.get(roomCode);
    let game = roomId ? rooms.get(roomId) : undefined;

    if (!game) {
        // Load from DB
        const dbRoom = await prisma.room.findUnique({
            where: { code: roomCode },
            include: {
                quiz: {
                    include: { questions: { orderBy: { order: "asc" } } },
                },
            },
        });

        if (!dbRoom) {
            send(ws, { type: "ERROR", payload: { message: "Room not found" } });
            return;
        }

        if (dbRoom.status === "FINISHED") {
            send(ws, { type: "ERROR", payload: { message: "Game has already ended" } });
            return;
        }

        // Create in-memory game state
        game = {
            roomId: dbRoom.id,
            roomCode: dbRoom.code,
            hostId: dbRoom.hostId,
            quizId: dbRoom.quizId,
            players: new Map(),
            status: dbRoom.status as "LOBBY" | "ACTIVE",
            questions: dbRoom.quiz.questions.map((q) => ({
                id: q.id,
                text: q.text,
                imageUrl: q.imageUrl,
                options: q.options as string[],
                timeLimitSecs: q.timeLimitSecs,
            })),
            questionIds: dbRoom.quiz.questions.map((q) => q.id),
            correctIndices: dbRoom.quiz.questions.map((q) => q.correctIndex),
            currentQuestionIndex: -1,
            answers: new Map(),
            scores: new Map(),
            questionTimer: null,
        };

        rooms.set(dbRoom.id, game);
        codeToRoomId.set(dbRoom.code, dbRoom.id);
        roomId = dbRoom.id;
    }

    // Check if player is rejoining
    const existingPlayer = game.players.get(userId);
    if (existingPlayer) {
        existingPlayer.ws = ws;
        existingPlayer.connected = true;
        ws.data = { userId, roomId: game.roomId };

        // Send current state to the rejoining player
        send(ws, { type: "ROOM_STATE", payload: buildRoomState(game) });

        // Broadcast updated state to everyone so they see this player as connected again
        broadcast(game, {
            type: "ROOM_STATE",
            payload: buildRoomState(game),
        }, userId);
        return;
    }

    // New player
    game.players.set(userId, {
        ws,
        userId,
        username,
        connected: true,
    });
    game.scores.set(userId, 0);
    ws.data = { userId, roomId: game.roomId };

    // Send room state to the joining player
    send(ws, { type: "ROOM_STATE", payload: buildRoomState(game) });

    // Broadcast updated ROOM_STATE to everyone else too
    // This ensures everyone has the exact same list of players
    broadcast(game, {
        type: "ROOM_STATE",
        payload: buildRoomState(game),
    }, userId);
}

function handleLeaveRoom(
    ws: ServerWebSocket<WsData>,
    payload: LeaveRoomPayload
): void {
    const { roomCode, userId } = payload;
    const roomId = codeToRoomId.get(roomCode);
    const game = roomId ? rooms.get(roomId) : undefined;

    if (!game) return;

    // Remove player from game
    game.players.delete(userId);
    game.scores.delete(userId);

    // Clear ws data so the close handler doesn't try to process this player again
    ws.data = { userId: "", roomId: "" };

    // Broadcast updated room state
    broadcast(game, {
        type: "ROOM_STATE",
        payload: buildRoomState(game),
    });

    console.log(`Player ${userId} left room ${roomCode}`);
}

async function handleStartGame(
    ws: ServerWebSocket<WsData>,
    payload: StartGamePayload
): Promise<void> {
    const game = rooms.get(payload.roomId);
    if (!game) {
        send(ws, { type: "ERROR", payload: { message: "Room not found" } });
        return;
    }

    if (game.hostId !== ws.data?.userId) {
        send(ws, { type: "ERROR", payload: { message: "Only the host can start the game" } });
        return;
    }

    if (game.status !== "LOBBY") {
        send(ws, { type: "ERROR", payload: { message: "Game already started" } });
        return;
    }

    if (game.questions.length === 0) {
        send(ws, { type: "ERROR", payload: { message: "No questions in this quiz" } });
        return;
    }

    game.status = "ACTIVE";

    // Update DB
    await prisma.room.update({
        where: { id: game.roomId },
        data: { status: "ACTIVE" },
    });

    // Start the first question
    nextQuestion(game);
}

function nextQuestion(game: GameState): void {
    game.currentQuestionIndex++;

    if (game.currentQuestionIndex >= game.questions.length) {
        // Game over
        endGame(game);
        return;
    }

    const idx = game.currentQuestionIndex;
    const question = game.questions[idx]!;

    // Initialize answers map for this question
    game.answers.set(question.id, new Map());

    const startPayload: QuestionStartPayload = {
        question: {
            id: question.id,
            text: question.text,
            imageUrl: question.imageUrl,
            options: question.options,
            timeLimitSecs: question.timeLimitSecs,
        },
        questionIndex: idx,
        total: game.questions.length,
        timeLimitSecs: question.timeLimitSecs,
        startedAt: Date.now(),
    };

    broadcast(game, { type: "QUESTION_START", payload: startPayload });

    // Set timer for question end
    game.questionTimer = setTimeout(() => {
        endQuestion(game);
    }, question.timeLimitSecs * 1000);
}

function endQuestion(game: GameState): void {
    if (game.questionTimer) {
        clearTimeout(game.questionTimer);
        game.questionTimer = null;
    }

    const idx = game.currentQuestionIndex;
    const question = game.questions[idx]!;
    const correctIndex = game.correctIndices[idx]!;
    const questionAnswers = game.answers.get(question.id) ?? new Map();

    // Build results
    const results: PlayerResult[] = Array.from(game.players.values()).map((player) => {
        const answer = questionAnswers.get(player.userId);
        if (!answer) {
            return {
                userId: player.userId,
                username: player.username,
                answerIndex: null,
                correct: false,
                pointsEarned: 0,
                timeMs: 0,
            };
        }
        return {
            userId: player.userId,
            username: player.username,
            answerIndex: answer.answerIndex,
            correct: answer.correct,
            pointsEarned: answer.pointsEarned,
            timeMs: answer.timeMs,
        };
    });

    const endPayload: QuestionEndPayload = {
        correctIndex,
        results,
    };

    broadcast(game, { type: "QUESTION_END", payload: endPayload });

    // Send leaderboard
    const leaderboardPayload: LeaderboardPayload = {
        scores: getLeaderboard(game),
    };

    // Delay leaderboard slightly for dramatic effect
    setTimeout(() => {
        broadcast(game, { type: "LEADERBOARD", payload: leaderboardPayload });

        // Start next question after a brief pause
        setTimeout(() => {
            nextQuestion(game);
        }, 3000);
    }, 2000);
}

async function endGame(game: GameState): Promise<void> {
    game.status = "FINISHED";

    const finalScores = getLeaderboard(game);
    const winner = finalScores[0]!;

    const gameOverPayload: GameOverPayload = {
        finalScores,
        winner,
    };

    broadcast(game, { type: "GAME_OVER", payload: gameOverPayload });

    // Persist scores to DB
    try {
        await prisma.room.update({
            where: { id: game.roomId },
            data: { status: "FINISHED" },
        });

        for (const [userId, totalPoints] of game.scores) {
            const allAnswers: AnswerRecord[] = [];
            for (const [questionId, answerMap] of game.answers) {
                const answer = answerMap.get(userId);
                if (answer) {
                    allAnswers.push({
                        questionId,
                        answerIndex: answer.answerIndex,
                        correct: answer.correct,
                        timeMs: answer.timeMs,
                    });
                }
            }

            await prisma.score.upsert({
                where: {
                    roomId_userId: {
                        roomId: game.roomId,
                        userId,
                    },
                },
                create: {
                    roomId: game.roomId,
                    userId,
                    points: totalPoints,
                    answers: allAnswers as any,
                },
                update: {
                    points: totalPoints,
                    answers: allAnswers as any,
                },
            });
        }
    } catch (err) {
        console.error("Failed to persist scores:", err);
    }

    // Cleanup after a delay
    setTimeout(() => {
        rooms.delete(game.roomId);
        codeToRoomId.delete(game.roomCode);
    }, 60_000);
}

function handleSubmitAnswer(
    ws: ServerWebSocket<WsData>,
    payload: SubmitAnswerPayload
): void {
    const game = rooms.get(payload.roomId);
    if (!game) {
        send(ws, { type: "ERROR", payload: { message: "Room not found" } });
        return;
    }

    if (game.status !== "ACTIVE") {
        send(ws, { type: "ERROR", payload: { message: "Game is not active" } });
        return;
    }

    const userId = ws.data?.userId;
    if (!userId) {
        send(ws, { type: "ERROR", payload: { message: "Not authenticated" } });
        return;
    }

    const idx = game.currentQuestionIndex;
    const question = game.questions[idx]!;

    if (payload.questionId !== question.id) {
        send(ws, { type: "ERROR", payload: { message: "Wrong question" } });
        return;
    }

    const questionAnswers = game.answers.get(question.id);
    if (!questionAnswers) {
        send(ws, { type: "ERROR", payload: { message: "Question not active" } });
        return;
    }

    // Already answered?
    if (questionAnswers.has(userId)) {
        send(ws, { type: "ERROR", payload: { message: "Already answered" } });
        return;
    }

    const correctIndex = game.correctIndices[idx]!;
    const correct = payload.answerIndex === correctIndex;
    const pointsEarned = calculatePoints(correct, payload.timeMs, question.timeLimitSecs);

    questionAnswers.set(userId, {
        answerIndex: payload.answerIndex,
        timeMs: payload.timeMs,
        correct,
        pointsEarned,
    });

    // Update total score
    const currentTotal = game.scores.get(userId) ?? 0;
    game.scores.set(userId, currentTotal + pointsEarned);

    // Check if all connected players have answered
    const connectedPlayers = Array.from(game.players.values()).filter((p) => p.connected);
    const answeredCount = questionAnswers.size;
    if (answeredCount >= connectedPlayers.length) {
        endQuestion(game);
    }
}

// ─── Server ───

const port = Number(process.env.WS_PORT) || 3002;

Bun.serve<WsData>({
    port,
    fetch(req, server) {
        // Upgrade to WebSocket
        const url = new URL(req.url);
        if (url.pathname === "/ws") {
            const upgraded = server.upgrade(req, {
                data: { userId: "", roomId: "" },
            });
            if (upgraded) return undefined;
            return new Response("WebSocket upgrade failed", { status: 400 });
        }

        return new Response("Trivia Hawk WebSocket Server", { status: 200 });
    },
    websocket: {
        open(ws) {
            console.log("Client connected");
        },
        async message(ws, message) {
            try {
                const raw = typeof message === "string" ? message : Buffer.from(message).toString();
                const msg = JSON.parse(raw) as WsMessage;

                switch (msg.type) {
                    case "JOIN_ROOM":
                        await handleJoinRoom(ws, msg.payload as JoinRoomPayload);
                        break;
                    case "LEAVE_ROOM":
                        handleLeaveRoom(ws, msg.payload as LeaveRoomPayload);
                        break;
                    case "START_GAME":
                        await handleStartGame(ws, msg.payload as StartGamePayload);
                        break;
                    case "SUBMIT_ANSWER":
                        handleSubmitAnswer(ws, msg.payload as SubmitAnswerPayload);
                        break;
                    default:
                        // Ignore unknown or server-only messages
                        break;
                }
            } catch (err) {
                console.error("Message handling error:", err);
                send(ws, {
                    type: "ERROR",
                    payload: { message: "Invalid message format" },
                });
            }
        },
        close(ws) {
            const data = ws.data;
            if (!data?.roomId || !data?.userId) return;

            const game = rooms.get(data.roomId);
            if (!game) return;

            const player = game.players.get(data.userId);
            if (player) {
                // GUARD: Only mark disconnected if this ws is still the player's active socket.
                // Prevents a stale socket from overriding a freshly-reconnected player.
                if (player.ws !== ws) {
                    console.log(`Stale socket closed for ${data.userId}, ignoring`);
                    return;
                }

                player.connected = false;

                // Notify others that player left
                // IMPORTANT: We broadcast the FULL updated room state so clients sync perfectly
                const roomState = buildRoomState(game);
                broadcast(game, {
                    type: "ROOM_STATE",
                    payload: roomState,
                });
            }

            console.log(`Client disconnected: ${data.userId}`);
        },
    },
});

console.log(`⚡ WebSocket Server running on ws://localhost:${port}/ws`);