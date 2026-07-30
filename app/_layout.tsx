import "../global.css";
import { useEffect, useRef, useState } from "react";
import { Slot, useRouter, useSegments } from "expo-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { NativeModules, View, ActivityIndicator, Alert, AppState, StyleSheet } from "react-native";
import { focusManager } from "@tanstack/react-query";
import { useAuthStore } from "../stores/auth";
import { useConfigStore } from "../stores/config.store";
import { ToastProvider } from '../components/CustomToast';
import { needsKycUpload, roleFromPartner } from "../lib/partnerOnboarding";
import { connectSocket, disconnectSocket } from "../lib/socket";

import FloatingBookingAlert from "../components/FloatingBookingAlert";
import { partnerBookingService } from "../lib/bookings";
import { api } from "../lib/api";
import { syncPartnerLocation } from "../lib/partnerLocationSync";
import { useFonts } from 'expo-font';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

// React Query: refetch when app returns to foreground (critical for APK polling)
focusManager.setEventListener((handleFocus) => {
    const sub = AppState.addEventListener("change", (state) => {
        handleFocus(state === "active");
    });
    return () => sub.remove();
});

// Conditional Firebase import
let messaging: any;
try {
    if (NativeModules.RNFBAppModule) {
        messaging = require('@react-native-firebase/messaging').default;
    }
} catch (e) {
    if (__DEV__) console.log("Firebase Messaging not available");
}

// Register FCM token with server after login
async function registerFcmToken() {
    if (!messaging) return;
    try {
        const authStatus = await messaging().requestPermission();
        const enabled =
            authStatus === 1 || // AUTHORIZED
            authStatus === 2;   // PROVISIONAL
        if (!enabled) return;
        const token = await messaging().getToken();
        if (token) {
            await api.put('/notifications/fcm-token/partner', { fcmToken: token });
            if (__DEV__) console.log('[FCM] Token registered:', token.slice(0, 20) + '...');
        }
    } catch (e) {
        if (__DEV__) console.log('[FCM] Token registration failed:', e);
    }
}

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 1000 * 60 * 2, // 2 minutes
            retry: 1,
        },
    },
});

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
                    if (__DEV__) console.log("[Layout] Init timeout or error:", err);
                });

            } catch (err) {
                if (__DEV__) console.log("[Layout] Init error", err);
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

        if (token && (inOnboarding || inAuth)) {
            if (needsKycUpload(user, user?.role)) {
                if (!inRegister) {
                    router.replace({
                        pathname: "/(auth)/register",
                        params: { role: roleFromPartner(user, user?.role) }
                    } as any);
                }
            } else if (user?.status === "Pending" || user?.status === "Rejected") {
                if (!isInReviewStatus) {
                    router.replace("/(auth)/review-status" as any);
                }
            } else {
                router.replace("/(tabs)/home" as any);
            }
            return;
        }

        // C4+C6: block Pending/Rejected partners even if they reach tabs
        if (token && user && (user.status === "Pending" || user.status === "Rejected") && !inAuth && !isPolicyPage) {
            router.replace("/(auth)/review-status" as any);
            return;
        }

        if (!token && !inAuth && !inOnboarding && !isPolicyPage) {
            router.replace("/(auth)/role-select");
        }
    }, [token, isAppReady, isLoading, segments, config?.maintenanceMode, user?.isRegistered, user?.status, user?.documents, user?.role]);

    // Socket: connect when logged in, disconnect on logout
    useEffect(() => {
        if (__DEV__) console.log("[Layout] Socket effect");
        if (token && user?._id) {
            
            const socket = connectSocket(token, user._id);
            socket.on("booking:assignment_request", (data: any) => {
                console.log("[Layout] ?? Ultra-fast assignment request received in layout, refetching feed");
                queryClient.refetchQueries({ queryKey: ["bookings"] }); // Silently update the feed behind the popup
            });

            socket.off("flash_notification");
            socket.on("flash_notification", (data: any) => {
                const currentSegment = (segments as string[]).join('/');
                if (currentSegment.includes(`chat`) && currentSegment.includes(data.threadId)) {
                    return;
                }

                Toast.show({
                    type: 'info',
                    text1: data.title || "New Message",
                    text2: data.body || "Tap to view",
                    position: 'top',
                    onPress: () => {
                        if (data.type === "BOOKING_CHAT") {
                            router.push(`/booking_chat?id=${data.threadId}&name=${encodeURIComponent(data.senderName)}`);
                        } else if (data.type === "TICKET_CHAT") {
                            router.push(`/support_chat?id=${data.threadId}&subject=${encodeURIComponent(data.title)}`);
                        }
                        Toast.hide();
                    },
                    visibilityTime: 4000
                });
            });

            return () => {
                socket.off("booking:assignment_request");
                socket.off("flash_notification");
                disconnectSocket();
            };
        }
    }, [token, user?._id]);

    // Sync location globally on login so APK geo-filter includes this partner in feed
    useEffect(() => {
        if (!token || !user?._id) return;
        syncPartnerLocation(user?.status === "Active");
    }, [token, user?._id]);

    // FCM: register token when user logs in
    useEffect(() => {
        if (token && user?._id) {
            registerFcmToken();
            // Refresh token if it rotates
            const unsub = messaging?.().onTokenRefresh?.((newToken: string) => {
                api.put('/notifications/fcm-token/partner', { fcmToken: newToken }).catch(() => {});
            });
            return () => unsub?.();
        }
    }, [token, user?._id]);

    // FCM: handle push notification taps from background/killed state
    useEffect(() => {
        if (!messaging) return;
        // Foreground messages — refresh booking feed so FloatingBookingAlert appears
        const unsubscribeFg = messaging().onMessage((remoteMessage: any) => {
            const { title, body } = remoteMessage?.notification || {};
            const isBookingAlert =
                remoteMessage?.data?.bookingId ||
                remoteMessage?.data?.screen?.includes?.("/booking/") ||
                title?.toLowerCase().includes("booking");

            if (isBookingAlert) {
                queryClient.refetchQueries({ queryKey: ["bookings"] });
            } else if (title || body) {
                Alert.alert(title || "Notification", body || "");
            }
        });
        // App opened from background via notification tap
        const unsubscribeBg = messaging().onNotificationOpenedApp((remoteMessage: any) => {
            const bookingId = remoteMessage?.data?.bookingId;
            if (bookingId) router.push({ pathname: '/booking_detail', params: { bookingId } } as any);
        });
        // App opened from killed state via notification tap
        messaging().getInitialNotification().then((remoteMessage: any) => {
            if (remoteMessage?.data?.bookingId) {
                router.push({ pathname: '/booking_detail', params: { bookingId: remoteMessage.data.bookingId } } as any);
            }
        });
        return () => { unsubscribeFg(); unsubscribeBg(); };
    }, []);


    if (!isAppReady || isLoading) {
        return (
            <View style={{ flex: 1, backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator size="large" color="#2D935C" />
            </View>
        );
    }

    return (
        <View style={styles.root}>
            <Slot />
            <View style={styles.overlayLayer} pointerEvents="box-none">
                <FloatingBookingAlert />
            </View>

        </View>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1 },
    overlayLayer: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 99999,
        elevation: 99999,
    },
});

export default function RootLayout() {
    const [fontsLoaded] = useFonts({
        ...Ionicons.font,
        ...MaterialCommunityIcons.font,
    });

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
