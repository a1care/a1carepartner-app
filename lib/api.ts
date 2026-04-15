import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

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
        const requestUrl = error?.config?.url || "";
        const isAuthDetailsRequest =
            typeof requestUrl === "string" &&
            (requestUrl.includes("/doctor/auth/details") || requestUrl.includes("/doctor/auth/verify-otp"));

        if (error?.response?.status === 401 && isAuthDetailsRequest) {
            await AsyncStorage.removeItem("partner_token");
            await AsyncStorage.removeItem("partner_user");
        }
        return Promise.reject(error);
    }
);
