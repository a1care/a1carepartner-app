import { io, Socket } from "socket.io-client";

const SOCKET_URL = (process.env.EXPO_PUBLIC_API_URL ?? "https://api.a1carehospital.in/api")
    .replace(/\/api\/?$/, "");

let socket: Socket | null = null;

export function connectSocket(token: string, partnerId: string) {
    if (socket?.connected) return socket;

    socket = io(SOCKET_URL, {
        auth: { token },
        transports: ["websocket"],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 2000,
    });

    socket.on("connect", () => {
        console.log("[Socket] Connected:", socket?.id);
        socket?.emit("join_room", `partner:${partnerId}`);
        socket?.emit("join_room", "admin");
    });

    socket.on("disconnect", (reason) => {
        console.log("[Socket] Disconnected:", reason);
    });

    socket.on("connect_error", (err) => {
        console.log("[Socket] Error:", err.message);
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
