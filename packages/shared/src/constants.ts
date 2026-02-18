export const MAX_POINTS = 1000;
export const DEFAULT_TIME_LIMIT = 30;
export const ROOM_CODE_LENGTH = 6;

/**
 * Calculate points for a correct answer based on response time.
 * Faster correct answers earn more points.
 * Incorrect answers always earn 0.
 */
export function calculatePoints(
    correct: boolean,
    timeMs: number,
    timeLimitSecs: number
): number {
    if (!correct) return 0;
    const timeFraction = timeMs / (timeLimitSecs * 1000);
    return Math.round(MAX_POINTS * (1 - timeFraction) * 0.5 + MAX_POINTS * 0.5);
}

/**
 * Generate a random room code (6 uppercase alphanumeric characters).
 */
export function generateRoomCode(): string {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous chars (0,O,1,I)
    let code = "";
    for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
        code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
}
