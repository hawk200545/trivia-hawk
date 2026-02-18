"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import type { WsMessage, WsEventType } from "@repo/shared";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:3002/ws";

type MessageHandler = (msg: WsMessage) => void;

export function useWebSocket() {
    const wsRef = useRef<WebSocket | null>(null);
    const handlersRef = useRef<Map<WsEventType, MessageHandler[]>>(new Map());
    const [connected, setConnected] = useState(false);
    const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const shouldReconnect = useRef(true);

    const connect = useCallback(() => {
        if (wsRef.current?.readyState === WebSocket.OPEN || wsRef.current?.readyState === WebSocket.CONNECTING) return;

        const ws = new WebSocket(WS_URL);

        ws.onopen = () => {
            console.log("WebSocket connected");
            setConnected(true);
            // Clear any pending reconnect
            if (reconnectTimer.current) {
                clearTimeout(reconnectTimer.current);
                reconnectTimer.current = null;
            }
        };

        ws.onclose = () => {
            console.log("WebSocket disconnected");
            setConnected(false);
            wsRef.current = null;

            // Auto-reconnect with backoff
            if (shouldReconnect.current && !reconnectTimer.current) {
                reconnectTimer.current = setTimeout(() => {
                    console.log("Reconnecting...");
                    reconnectTimer.current = null;
                    connect();
                }, 3000);
            }
        };

        ws.onerror = (err) => {
            console.error("WebSocket error:", err);
            ws.close();
        };

        ws.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data) as WsMessage;
                const handlers = handlersRef.current.get(msg.type) ?? [];
                handlers.forEach((h) => h(msg));

                // Also fire wildcard handlers
                const wildcardHandlers = handlersRef.current.get("*" as WsEventType) ?? [];
                wildcardHandlers.forEach((h) => h(msg));
            } catch (err) {
                console.error("Failed to parse WebSocket message:", err);
            }
        };

        wsRef.current = ws;
    }, []);

    const disconnect = useCallback(() => {
        shouldReconnect.current = false;
        if (reconnectTimer.current) {
            clearTimeout(reconnectTimer.current);
            reconnectTimer.current = null;
        }
        if (wsRef.current) {
            wsRef.current.close();
            wsRef.current = null;
        }
        setConnected(false);
    }, []);

    const sendMessage = useCallback((msg: WsMessage) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify(msg));
        } else {
            console.warn("WebSocket not connected, cannot send:", msg);
        }
    }, []);

    const on = useCallback((type: WsEventType | "*", handler: MessageHandler) => {
        const key = type as WsEventType;
        const handlers = handlersRef.current.get(key) ?? [];
        handlers.push(handler);
        handlersRef.current.set(key, handlers);

        // Return unsubscribe function
        return () => {
            const current = handlersRef.current.get(key) ?? [];
            const filtered = current.filter((h) => h !== handler);
            handlersRef.current.set(key, filtered);
        };
    }, []);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            shouldReconnect.current = false;
            if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
            if (wsRef.current) wsRef.current.close();
        };
    }, []);

    return { connect, disconnect, sendMessage, on, connected };
}
