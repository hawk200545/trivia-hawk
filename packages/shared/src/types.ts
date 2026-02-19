// ─── WebSocket Event Types ───

export type WsEventType =
    // Client → Server
    | "JOIN_ROOM"
    | "LEAVE_ROOM"
    | "START_GAME"
    | "SUBMIT_ANSWER"
    // Server → Client
    | "ROOM_STATE"
    | "PLAYER_JOINED"
    | "PLAYER_LEFT"
    | "QUESTION_START"
    | "QUESTION_END"
    | "LEADERBOARD"
    | "GAME_OVER"
    | "ERROR";

export interface WsMessage<T = unknown> {
    type: WsEventType;
    payload: T;
}

// ─── Client → Server Payloads ───

export interface JoinRoomPayload {
    roomCode: string;
    userId: string;
    username: string;
}

export interface StartGamePayload {
    roomId: string;
}

export interface SubmitAnswerPayload {
    roomId: string;
    questionId: string;
    answerIndex: number;
    timeMs: number;
}

export interface LeaveRoomPayload {
    roomCode: string;
    userId: string;
}

// ─── Server → Client Payloads ───

export interface Player {
    userId: string;
    username: string;
    connected: boolean;
}

export interface RoomStatePayload {
    roomId: string;
    roomCode: string;
    players: Player[];
    status: "LOBBY" | "ACTIVE" | "FINISHED";
    hostId: string;
}

export interface PlayerJoinedPayload {
    userId: string;
    username: string;
}

export interface PlayerLeftPayload {
    userId: string;
    username: string;
}

export interface QuestionData {
    id: string;
    text: string;
    imageUrl: string | null;
    options: string[];
    timeLimitSecs: number;
}

export interface QuestionStartPayload {
    question: QuestionData;
    questionIndex: number;
    total: number;
    timeLimitSecs: number;
    startedAt: number; // timestamp ms
}

export interface PlayerResult {
    userId: string;
    username: string;
    answerIndex: number | null;
    correct: boolean;
    pointsEarned: number;
    timeMs: number;
}

export interface QuestionEndPayload {
    correctIndex: number;
    results: PlayerResult[];
}

export interface LeaderboardEntry {
    userId: string;
    username: string;
    points: number;
}

export interface LeaderboardPayload {
    scores: LeaderboardEntry[];
}

export interface GameOverPayload {
    finalScores: LeaderboardEntry[];
    winner: LeaderboardEntry;
}

export interface ErrorPayload {
    message: string;
}

// ─── API Types ───

export interface CreateQuizRequest {
    title: string;
    hostId: string;
    questions: {
        text: string;
        imageUrl?: string;
        options: string[];
        correctIndex: number;
        timeLimitSecs?: number;
        order: number;
    }[];
}

export interface CreateRoomRequest {
    quizId: string;
    hostId: string;
}

export interface RegisterRequest {
    username: string;
    password: string;
}

export interface LoginRequest {
    username: string;
    password: string;
}

export interface AnswerRecord {
    questionId: string;
    answerIndex: number;
    correct: boolean;
    timeMs: number;
}
