import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import { useAuthStore } from "../stores/auth";

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ??
    (Platform.OS === 'web'
        ? "https://api.a1carehospital.in/api"
        : "https://api.a1carehospital.in/api");

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
        // Handle 401 Unauthorized globally
        if (error?.response?.status === 401) {
            console.log("[API] 401 Unauthorized detected. Logging out...");
            try {
                // Clear state and storage via the store
                await useAuthStore.getState().logout();
            } catch (logoutError) {
                console.error("[API] Error during automatic logout:", logoutError);
            }
        }
        return Promise.reject(error);
    }
);
