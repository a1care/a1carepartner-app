import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type PartnerRole = "doctor" | "nurse" | "ambulance" | "rental";

interface PartnerUser {
    _id: string;
    name: string;
    email?: string;
    mobileNumber: string;
    roleId?: string;
    role: PartnerRole;
    profileImage?: string;
    isVerified?: boolean;
    isRegistered?: boolean;
    isOnline?: boolean;
}

interface AuthState {
    token: string | null;
    user: PartnerUser | null;
    isLoading: boolean;
    confirmationResult: any | null;
    setConfirmationResult: (result: any) => void;
    setAuth: (token: string, user: PartnerUser) => Promise<void>;
    setUser: (user: PartnerUser) => Promise<void>;
    logout: () => Promise<void>;
    loadFromStorage: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
    token: null,
    user: null,
    isLoading: true,
    confirmationResult: null,
    setConfirmationResult: (result: any) => set({ confirmationResult: result }),
    setAuth: async (token, user) => {
        await AsyncStorage.setItem("partner_token", token);
        await AsyncStorage.setItem("partner_user", JSON.stringify(user));
        set({ token, user, confirmationResult: null });
    },
    setUser: async (user) => {
        await AsyncStorage.setItem("partner_user", JSON.stringify(user));
        set({ user });
    },
    logout: async () => {
        await AsyncStorage.removeItem("partner_token");
        await AsyncStorage.removeItem("partner_user");
        set({ token: null, user: null, confirmationResult: null });
    },
    loadFromStorage: async () => {
        const token = await AsyncStorage.getItem("partner_token");
        const userStr = await AsyncStorage.getItem("partner_user");
        const user = userStr ? JSON.parse(userStr) : null;
        set({ token, user, isLoading: false });
    },
}));
