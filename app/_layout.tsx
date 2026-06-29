import "../global.css";
import { useEffect, useRef, useState } from "react";
import { Slot, useRouter, useSegments } from "expo-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { NativeModules, View, ActivityIndicator, Alert } from "react-native";
import { useAuthStore } from "../stores/auth";
import { useConfigStore } from "../stores/config.store";
import { ToastProvider } from '../components/CustomToast';
import { needsKycUpload, roleFromPartner } from "../lib/partnerOnboarding";
import { connectSocket, disconnectSocket } from "../lib/socket";
import BookingAssignmentPopup, { AssignmentRequest } from "../components/BookingAssignmentPopup";
import { api } from "../lib/api";

// Conditional Firebase import 
let messaging: any;
try {
    if (NativeModules.RNFBAppModule) {
        messaging = require('@react-native-firebase/messaging').default;
    }
} catch (e) {
    if (__DEV__) console.log("Firebase Messaging not available");
}

const queryClient = new QueryClient();

function AuthGuard() {
    const { token, user, isLoading, loadFromStorage } = useAuthStore();
    const { fetchConfig, config } = useConfigStore();
    const segments = useSegments();
    const router = useRouter();
    const [isAppReady, setIsAppReady] = useState(false);
    const [assignmentRequest, setAssignmentRequest] = useState<AssignmentRequest | null>(null);

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

        if (token && (inOnboarding || (inAuth && !isInReviewStatus && !inRegister))) {
            if (needsKycUpload(user, user?.role)) {
                router.replace({
                    pathname: "/(auth)/register",
                    params: { role: roleFromPartner(user, user?.role) }
                } as any);
            } else if (user?.status === "Pending") {
                router.replace("/(auth)/review-status" as any);
            } else if (user?.status === "Rejected") {
                router.replace("/(auth)/review-status" as any); // C4: block Rejected partners from home
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
            socket.on("booking:assignment_request", (data: AssignmentRequest) => {
                console.log("[Layout] 🚨 Assignment request received in layout:", data);
                setAssignmentRequest(data);
            });
            return () => {
                socket.off("booking:assignment_request");
                disconnectSocket();
            };
        }
    }, [token, user?._id]);

    // FCM: handle push notification taps from background/killed state
    useEffect(() => {
        if (!messaging) return;
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
        return () => unsubscribeBg();
    }, []);

    const handleAccept = async (bookingId: string) => {
        try {
            await api.post(`/service-bookings/accept/${bookingId}`);
            setAssignmentRequest(null);
            Alert.alert("✅ Accepted!", "You have accepted the job. Check My Bookings.");
        } catch (err: any) {
            Alert.alert("Error", err?.response?.data?.message || "Failed to accept booking.");
        }
    };

    const handleReject = async (bookingId: string) => {
        setAssignmentRequest(null);
        try {
            await api.post(`/service-bookings/reject-assignment/${bookingId}`);
        } catch (err) {
            // Silent - backend handles timeout cleanup
        }
    };

    if (!isAppReady || isLoading) {
        return (
            <View style={{ flex: 1, backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator size="large" color="#2D935C" />
            </View>
        );
    }

    return (
        <>
            <Slot />
            <BookingAssignmentPopup
                request={assignmentRequest}
                onAccept={handleAccept}
                onReject={handleReject}
            />
        </>
    );
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
