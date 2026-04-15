import { create } from 'zustand';
import axios from 'axios';

interface AppConfig {
    branding: {
        appName: string;
        logoUrl: string;
        splashImageUrl: string;
        primaryColor: string;
        secondaryColor: string;
        accentColor: string;
    };
    contact: {
        supportEmail: string;
        supportPhone: string;
        whatsappNumber: string;
        address: string;
        website: string;
        faq: string;
        privacyPolicy: string;
        termsAndConditions: string;
    };
    landing: {
        festivalBanners: any[];
        playStoreUrl: string;
        appStoreUrl: string;
    };
    googleMapsApiKey: string;
    maintenanceMode: boolean;
}

interface ConfigState {
    config: AppConfig | null;
    isLoading: boolean;
    error: string | null;
    fetchConfig: () => Promise<void>;
    getMapsKey: () => string;
}

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://api.a1carehospital.in/api';
const FALLBACK_MAPS_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || 'AIzaSyCQp47kwCVpsPbgSWB-c9HrlsqyiLwe06o';

export const useConfigStore = create<ConfigState>((set, get) => ({
    config: null,
    isLoading: false,
    error: null,
    getMapsKey: () => get().config?.googleMapsApiKey || FALLBACK_MAPS_KEY,
    fetchConfig: async () => {
        set({ isLoading: true });
        try {
            const response = await axios.get(`${API_URL}/common/config/partner`);
            if (response.data.success) {
                set({ config: response.data.data, isLoading: false, error: null });
            } else {
                set({ error: 'Failed to fetch config', isLoading: false });
            }
        } catch (err: any) {
            console.error('[ConfigStore] fetch error:', err.message);
            set({ error: err.message, isLoading: false });
        }
    },
}));
