import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? "https://api.a1carehospital.in/api";

export const api = axios.create({
    baseURL: BASE_URL,
    timeout: 20000,
});

let isRefreshing = false;
let failedQueue: Array<{
    resolve: (token: string) => void;
    reject: (error: any) => void;
}> = [];

const processQueue = (error: any, token: string | null = null) => {
    failedQueue.forEach(prom => {
        if (error) {
            prom.reject(error);
        } else {
            prom.resolve(token as string);
        }
    });
    failedQueue = [];
};

api.interceptors.request.use(async (config) => {
    const token = await AsyncStorage.getItem("partner_token");
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    if (['post', 'put', 'patch'].includes(config.method?.toLowerCase() || '')) {
        if (!config.headers['Idempotency-Key']) {
            config.headers['Idempotency-Key'] = Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
        }
    }
    return config;
});

api.interceptors.response.use(
    (res) => res,
    async (error) => {
        const originalRequest = error?.config;
        const requestUrl = originalRequest?.url || "";
        const isLoginRequest = typeof requestUrl === "string" && requestUrl.includes("/verify-otp");

        // C5: Any 401 on a non-login endpoint means the token is expired ?" attempt refresh
        if (error?.response?.status === 401 && !isLoginRequest && !originalRequest._retry) {
            if (isRefreshing) {
                return new Promise(function(resolve, reject) {
                    failedQueue.push({ resolve, reject });
                }).then(token => {
                    originalRequest.headers.Authorization = 'Bearer ' + token;
                    return api(originalRequest);
                }).catch(err => {
                    return Promise.reject(err);
                });
            }

            originalRequest._retry = true;
            isRefreshing = true;

            try {
                const refreshToken = await AsyncStorage.getItem("partner_refresh_token");
                if (!refreshToken) throw new Error("No refresh token");

                // Get role path from user storage to know which API to hit
                const userStr = await AsyncStorage.getItem("partner_user");
                const user = userStr ? JSON.parse(userStr) : {};
                const role = user?.role?.toLowerCase?.() ?? 'doctor';
                let rolePath = 'doctor';
                if (role.includes('nurse')) rolePath = 'nurse';
                else if (role.includes('ambulance')) rolePath = 'ambulance';
                else if (role.includes('rental')) rolePath = 'rental';

                const res = await axios.post(`${BASE_URL}/${rolePath}/auth/refresh`, { refreshToken });
                const { token: newToken, refreshToken: newRefreshToken } = res.data.data;

                await AsyncStorage.setItem("partner_token", newToken);
                await AsyncStorage.setItem("partner_refresh_token", newRefreshToken);

                api.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
                originalRequest.headers.Authorization = `Bearer ${newToken}`;

                processQueue(null, newToken);
                return api(originalRequest);
            } catch (refreshError) {
                processQueue(refreshError, null);
                await AsyncStorage.removeItem("partner_token");
                await AsyncStorage.removeItem("partner_refresh_token");
                await AsyncStorage.removeItem("partner_user");
                const { useAuthStore } = await import('../stores/auth');
                useAuthStore.getState().logout();
                return Promise.reject(refreshError);
            } finally {
                isRefreshing = false;
            }
        }
        return Promise.reject(error);
    }
);
