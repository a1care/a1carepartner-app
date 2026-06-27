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
        console.log("[Socket] ✅ Connected:", socket?.id);
        console.log("[Socket] Joining room:", `partner:${partnerId}`);
        socket?.emit("join_room", `partner:${partnerId}`);
        socket?.emit("join_room", "admin");
        console.log("[Socket] Room join emitted");
    });

    socket.on("disconnect", (reason) => {
        console.log("[Socket] ❌ Disconnected:", reason);
    });

    socket.on("connect_error", (err) => {
        console.log("[Socket] ❌ Connection Error:", err.message);
        console.log("[Socket] URL was:", SOCKET_URL);
    });

    socket.on("booking:assignment_request", (data: any) => {
        console.log("[Socket] 🚨 RAW assignment_request received:", JSON.stringify(data));
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
