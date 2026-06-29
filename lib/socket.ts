import { io, Socket } from "socket.io-client";

const SOCKET_URL = (process.env.EXPO_PUBLIC_API_URL ?? "https://api.a1carehospital.in/api")
    .replace(/\/api\/?$/, "");

let socket: Socket | null = null;

export function connectSocket(token: string, partnerId: string) {
    if (socket?.connected) return socket;

    socket = io(SOCKET_URL, {
        auth: { token },
        transports: ["polling", "websocket"], // polling first — works through Nginx without WS upgrade
        path: "/socket.io/",
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 2000,
    });

    socket.on("connect", () => {
        if (__DEV__) console.log("[Socket] Connected:", socket?.id);
        socket?.emit("join_room", `partner:${partnerId}`);
        // Do NOT join "admin" room — partners should not receive admin events
        socket?.emit("check_pending_assignment", { partnerId });
    });

    socket.on("disconnect", (reason) => {
        if (__DEV__) console.log("[Socket] Disconnected:", reason);
    });

    socket.on("connect_error", (err) => {
        if (__DEV__) console.log("[Socket] Connection Error:", err.message);
    });

    socket.on("booking:assignment_request", (_data: any) => {
        // Assignment handling is done in _layout.tsx listener
    });

    return socket;
}

export function disconnectSocket() {
    socket?.disconnect();
    socket = null;
}

export function getSocket() {
    return socket;
}
