import { Hono } from "hono";
import { cors } from "hono/cors";
import { prisma } from "@repo/db/client";
import { generateRoomCode } from "@repo/shared";
import type {
    CreateQuizRequest,
    CreateRoomRequest,
    RegisterRequest,
    LoginRequest,
} from "@repo/shared";

const app = new Hono();

// ─── Middleware ───
app.use("/*", cors());

// ─── Health ───
app.get("/", (c) => c.json({ status: "ok", service: "trivia-hawk-api" }));

// ─── Auth ───
app.post("/api/register", async (c) => {
    try {
        const body = await c.req.json<RegisterRequest>();
        if (!body.username || !body.password) {
            return c.json({ error: "Username and password required" }, 400);
        }

        const existing = await prisma.user.findUnique({
            where: { username: body.username },
        });
        if (existing) {
            return c.json({ error: "Username already taken" }, 409);
        }

        const hashedPassword = await Bun.password.hash(body.password);
        const user = await prisma.user.create({
            data: {
                username: body.username,
                password: hashedPassword,
            },
        });

        return c.json({
            id: user.id,
            username: user.username,
        });
    } catch (err) {
        console.error("Register error:", err);
        return c.json({ error: "Failed to register" }, 500);
    }
});

app.post("/api/login", async (c) => {
    try {
        const body = await c.req.json<LoginRequest>();
        if (!body.username || !body.password) {
            return c.json({ error: "Username and password required" }, 400);
        }

        const user = await prisma.user.findUnique({
            where: { username: body.username },
        });
        if (!user) {
            return c.json({ error: "Invalid credentials" }, 401);
        }

        const valid = await Bun.password.verify(body.password, user.password);
        if (!valid) {
            return c.json({ error: "Invalid credentials" }, 401);
        }

        return c.json({
            id: user.id,
            username: user.username,
        });
    } catch (err) {
        console.error("Login error:", err);
        return c.json({ error: "Failed to login" }, 500);
    }
});

// ─── Quiz CRUD ───
app.post("/api/quiz", async (c) => {
    try {
        const body = await c.req.json<CreateQuizRequest>();
        if (!body.title || !body.hostId || !body.questions?.length) {
            return c.json({ error: "Title, hostId, and questions are required" }, 400);
        }

        const quiz = await prisma.quiz.create({
            data: {
                title: body.title,
                hostId: body.hostId,
                questions: {
                    create: body.questions.map((q, i) => ({
                        text: q.text,
                        imageUrl: q.imageUrl ?? null,
                        options: q.options,
                        correctIndex: q.correctIndex,
                        timeLimitSecs: q.timeLimitSecs ?? 30,
                        order: q.order ?? i,
                    })),
                },
            },
            include: { questions: { orderBy: { order: "asc" } } },
        });

        return c.json(quiz);
    } catch (err) {
        console.error("Create quiz error:", err);
        return c.json({ error: "Failed to create quiz" }, 500);
    }
});

app.get("/api/quiz/:id", async (c) => {
    try {
        const quiz = await prisma.quiz.findUnique({
            where: { id: c.req.param("id") },
            include: {
                questions: { orderBy: { order: "asc" } },
                host: { select: { id: true, username: true } },
            },
        });

        if (!quiz) return c.json({ error: "Quiz not found" }, 404);
        return c.json(quiz);
    } catch (err) {
        console.error("Get quiz error:", err);
        return c.json({ error: "Failed to get quiz" }, 500);
    }
});

app.get("/api/quizzes", async (c) => {
    try {
        const hostId = c.req.query("hostId");
        const where = hostId ? { hostId } : {};

        const quizzes = await prisma.quiz.findMany({
            where,
            include: {
                _count: { select: { questions: true } },
                host: { select: { id: true, username: true } },
            },
            orderBy: { createdAt: "desc" },
        });

        return c.json(quizzes);
    } catch (err) {
        console.error("List quizzes error:", err);
        return c.json({ error: "Failed to list quizzes" }, 500);
    }
});

// ─── Room ───
app.post("/api/room", async (c) => {
    try {
        const body = await c.req.json<CreateRoomRequest>();
        if (!body.quizId || !body.hostId) {
            return c.json({ error: "quizId and hostId are required" }, 400);
        }

        // Generate a unique room code
        let code: string;
        let attempts = 0;
        do {
            code = generateRoomCode();
            const existing = await prisma.room.findUnique({ where: { code } });
            if (!existing) break;
            attempts++;
        } while (attempts < 10);

        if (attempts >= 10) {
            return c.json({ error: "Could not generate unique room code" }, 500);
        }

        const room = await prisma.room.create({
            data: {
                code,
                quizId: body.quizId,
                hostId: body.hostId,
            },
            include: {
                quiz: {
                    select: { id: true, title: true, _count: { select: { questions: true } } },
                },
            },
        });

        return c.json(room);
    } catch (err) {
        console.error("Create room error:", err);
        return c.json({ error: "Failed to create room" }, 500);
    }
});

app.get("/api/room/:code", async (c) => {
    try {
        const room = await prisma.room.findUnique({
            where: { code: c.req.param("code") },
            include: {
                quiz: {
                    select: { id: true, title: true, _count: { select: { questions: true } } },
                },
                scores: {
                    include: { user: { select: { id: true, username: true } } },
                },
            },
        });

        if (!room) return c.json({ error: "Room not found" }, 404);
        return c.json(room);
    } catch (err) {
        console.error("Get room error:", err);
        return c.json({ error: "Failed to get room" }, 500);
    }
});

// ─── Scores ───
app.get("/api/scores/:roomId", async (c) => {
    try {
        const scores = await prisma.score.findMany({
            where: { roomId: c.req.param("roomId") },
            include: {
                user: { select: { id: true, username: true } },
            },
            orderBy: { points: "desc" },
        });

        return c.json(scores);
    } catch (err) {
        console.error("Get scores error:", err);
        return c.json({ error: "Failed to get scores" }, 500);
    }
});

// ─── Start Server ───
const port = Number(process.env.PORT) || 3001;

export default {
    port,
    fetch: app.fetch,
};

console.log(`🚀 HTTP Server running on http://localhost:${port}`);