import "../global.css";
import { useEffect, useState } from "react";
import { Slot, useRouter, useSegments } from "expo-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { NativeModules, View, ActivityIndicator, Alert } from "react-native";
import { useAuthStore } from "../stores/auth";
import { useConfigStore } from "../stores/config.store";
import { ToastProvider } from '../components/CustomToast';

// Conditional Firebase import 
let messaging: any;
try {
    if (NativeModules.RNFBAppModule) {
        messaging = require('@react-native-firebase/messaging').default;
    }
} catch (e) {
    console.log("Firebase Messaging not available");
}

const queryClient = new QueryClient();

function AuthGuard() {
    const { token, user, isLoading, loadFromStorage } = useAuthStore();
    const { fetchConfig, config } = useConfigStore();
    const segments = useSegments();
    const router = useRouter();
    const [isAppReady, setIsAppReady] = useState(false);

    useEffect(() => {
        const init = async () => {
            try {
                // Parallel load with a safety timeout of 4 seconds
                const timeout = new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Init timeout')), 4000)
                );
                
                await Promise.race([
                    Promise.all([loadFromStorage(), fetchConfig()]),
                    timeout
                ]).catch(err => {
                    console.log("[Layout] Init timeout or error, proceeding anyway. Error: ", err);
                });

            } catch (err) {
                console.log("[Layout] Init error", err);
            } finally {
                setIsAppReady(true);
            }
        };
        init();
    }, []);

    useEffect(() => {
        if (!isAppReady || isLoading) return;

        const currentSegment = segments[0] as string;
        const currentSubSegment = segments[1] as string;
        const inAuth = currentSegment === "(auth)";
        const isInReviewStatus = currentSubSegment === "review-status";
        const inOnboarding = currentSegment === "onboarding";
        const isPolicyPage = currentSegment === "privacy" || currentSegment === "terms";
        const inRegister = currentSubSegment === "register";

        if (config?.maintenanceMode) {
            if (currentSegment !== 'maintenance') {
                router.replace('/maintenance' as any);
            }
            return;
        }

        if (token && (inOnboarding || (inAuth && !isInReviewStatus && !inRegister))) {
            if (user?.isRegistered === false) {
                router.replace("/(auth)/register" as any);
            } else if (user?.status === "Pending") {
                router.replace("/(auth)/review-status" as any);
            } else {
                router.replace("/(tabs)/home" as any);
            }
            return;
        }

        if (!token && !inAuth && !inOnboarding && !isPolicyPage) {
            router.replace("/(auth)/role-select");
        }
    }, [token, isAppReady, isLoading, segments, config?.maintenanceMode, user?.isRegistered, user?.status]);

    if (!isAppReady || isLoading) {
        return (
            <View style={{ flex: 1, backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator size="large" color="#1A7FD4" />
            </View>
        );
    }

    return <Slot />;
}

export default function RootLayout() {
    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <SafeAreaProvider>
                <QueryClientProvider client={queryClient}>
                    <ToastProvider>
                        <StatusBar style="dark" />
                        <AuthGuard />
                    </ToastProvider>
                </QueryClientProvider>
            </SafeAreaProvider>
        </GestureHandlerRootView>
    );
}
