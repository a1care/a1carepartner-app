import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? "https://api.a1carehospital.in/api";

export const api = axios.create({
    baseURL: BASE_URL,
    timeout: 20000,
});

api.interceptors.request.use(async (config) => {
    const token = await AsyncStorage.getItem("partner_token");
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

api.interceptors.response.use(
    (res) => res,
    async (error) => {
        const requestUrl = error?.config?.url || "";
        const isLoginRequest = typeof requestUrl === "string" && requestUrl.includes("/verify-otp");

        // C5: Any 401 on a non-login endpoint means the token is expired — clear session
        if (error?.response?.status === 401 && !isLoginRequest) {
            await AsyncStorage.removeItem("partner_token");
            await AsyncStorage.removeItem("partner_user");
            // Dynamic import to avoid circular dependency
            const { useAuthStore } = await import('../stores/auth');
            useAuthStore.getState().logout();
        }
        return Promise.reject(error);
    }
);
