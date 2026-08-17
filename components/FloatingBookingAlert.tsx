import React, { useEffect, useRef, useState } from "react";
import {
    View, Text, TouchableOpacity, StyleSheet, Animated, Vibration, Platform, Dimensions, Alert, AppState
} from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter, useSegments } from "expo-router";
import { useAuthStore } from "../stores/auth";
import { api } from "../lib/api";
import { partnerBookingService } from "../lib/bookings";
import { Bell, Clock, ArrowRight, X, ShieldAlert, Sparkles, Navigation } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Toast } from "./CustomToast";

const { width } = Dimensions.get("window");

export default function FloatingBookingAlert() {
    const router = useRouter();
    const queryClient = useQueryClient();
    const { token, user } = useAuthStore();
    // Track dismissed timestamps internally so they can expire after 2 minutes (120s)
    const [dismissedTimes, setDismissedTimes] = useState<Record<string, number>>({});
    
    // Slide animation for the floating card
    const slideAnim = useRef(new Animated.Value(-200)).current; // Start hidden (above top of screen)
    const scaleAnim = useRef(new Animated.Value(1)).current;
    
    // Check active subscription
    const { data: activeSub } = useQuery({
        queryKey: ["myActiveSubscription"],
        queryFn: async () => {
            const res = await api.get("/subscription/my-active");
            return res.data.data;
        },
        enabled: !!token,
        staleTime: 60000,
    });
    const hasActiveSub = !!activeSub;

    // Fetch unified feed periodically to check for available bookings
    const { data: allBookings = [], refetch: refetchBookings } = useQuery({
        queryKey: ["bookings"],
        queryFn: async () => {
            const res = await api.get("/appointment/provider/feed", { params: { status: 'all' } });
            const data = res.data.data;
            return Array.isArray(data) ? data : [];
        },
        enabled: !!token,
        refetchInterval: 10000,
        refetchIntervalInBackground: true,
        refetchOnMount: true,
        refetchOnWindowFocus: true,
        staleTime: 0,
    });

    // Immediately refetch when app returns to foreground
    useEffect(() => {
        const sub = AppState.addEventListener("change", (state) => {
            if (state === "active" && token) refetchBookings();
        });
        return () => sub.remove();
    }, [token, refetchBookings]);

    const [nowTime, setNowTime] = useState(Date.now());
    
    // Periodically update nowTime every 5 seconds to automatically expire dismissals
    useEffect(() => {
        const interval = setInterval(() => {
            setNowTime(Date.now());
        }, 5000);
        return () => clearInterval(interval);
    }, []);

    // Find all actionable bookings (open/broadcasted or assigned to this partner directly)
    const availableBookings = allBookings.filter((b: any) => {
        const isActionable = 
            b.status?.toLowerCase() === "broadcasted" || 
            b.status?.toLowerCase() === "missing" ||
            b.status?.toLowerCase() === "pending" ||
            b.status?.toUpperCase() === "PARTNER_ASSIGNED";
        
        const isDirect = b.status?.toUpperCase() === "PARTNER_ASSIGNED";
        // Only float broadcasted/missing bookings if they are new (created in the last 2 minutes)
        // Direct assignments always float.
        const isNew = isDirect || (b.createdAt ? (Date.now() - new Date(b.createdAt).getTime() < 120000) : false);
        
        // Expiration check: if it was dismissed within the last 2 minutes, filter it out
        const dismissedAt = dismissedTimes[b._id];
        const isCurrentlyDismissed = dismissedAt && (nowTime - dismissedAt < 120000);

        return isActionable && isNew && !isCurrentlyDismissed;
    });

    const activeAlertBooking = availableBookings[0] || null;
    const prevAlertBookingId = useRef<string | null>(null);
    const [secondsLeft, setSecondsLeft] = useState(120);

    useEffect(() => {
        if (!activeAlertBooking) return;
        
        const tick = () => {
            let remaining = 120; // 2 minutes default
            const isDirect = activeAlertBooking.status?.toUpperCase() === "PARTNER_ASSIGNED";
            
            if (isDirect && activeAlertBooking.acceptanceDeadline) {
                const deadline = new Date(activeAlertBooking.acceptanceDeadline).getTime();
                remaining = Math.max(0, Math.round((deadline - Date.now()) / 1000));
            } else {
                const createdTime = activeAlertBooking.createdAt ? new Date(activeAlertBooking.createdAt).getTime() : Date.now();
                const elapsed = Math.round((Date.now() - createdTime) / 1000);
                remaining = Math.max(0, 120 - elapsed); // 2 minutes window
            }
            
            setSecondsLeft(remaining);
            
            if (remaining <= 0) {
                setDismissedTimes(prev => ({ ...prev, [activeAlertBooking._id]: Date.now() }));
            }
        };

        tick();
        const interval = setInterval(tick, 1000);
        return () => clearInterval(interval);
    }, [activeAlertBooking]);

    // Mutation to accept booking
    const acceptMutation = useMutation({
        mutationKey: ["acceptBookingRequest"],
        mutationFn: async (bookingId: string) => {
            return partnerBookingService.acceptServiceRequest(bookingId, user?.roleId);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["bookings"] });
            queryClient.invalidateQueries({ queryKey: ["homeStats"] });
            
            // Auto slide out
            Animated.timing(slideAnim, {
                toValue: -200,
                duration: 300,
                useNativeDriver: true,
            }).start();

            Toast.show({
                type: "success",
                text1: "Booking Claimed! ✅",
                text2: "Moved to your Confirmed tab."
            });
            
            if (activeAlertBooking) {
                router.push({
                    pathname: "/booking_detail" as any,
                    params: { bookingId: activeAlertBooking._id, bookingType: activeAlertBooking.bookingType }
                });
            }
        },
        onError: (err: any) => {
            Alert.alert("Claim Failed", err?.response?.data?.message || "Someone else just claimed this job.");
        }
    });

    useEffect(() => {
        if (!activeAlertBooking) {
            // Slide out of view (upwards)
            Animated.timing(slideAnim, {
                toValue: -200,
                duration: 300,
                useNativeDriver: true,
            }).start();
            prevAlertBookingId.current = null;
            return;
        }

        // Trigger action when a brand new booking appears
        if (activeAlertBooking._id !== prevAlertBookingId.current) {
            prevAlertBookingId.current = activeAlertBooking._id;
            
            // Vibrate pattern
            Vibration.vibrate([0, 500, 200, 500]);

            // Slide in from top (translate to 0)
            Animated.spring(slideAnim, {
                toValue: 0,
                tension: 40,
                friction: 7,
                useNativeDriver: true,
            }).start();

            // Pulsing scale effect
            Animated.loop(
                Animated.sequence([
                    Animated.timing(scaleAnim, { toValue: 1.02, duration: 1000, useNativeDriver: true }),
                    Animated.timing(scaleAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
                ])
            ).start();
        }
    }, [activeAlertBooking?._id]);

    const segments = useSegments();
    const isHideScreen = segments.includes("booking_detail") || segments.includes("booking_chat") || segments.includes("booking_feedback");

    if (!token || !activeAlertBooking || isHideScreen) return null;

    const rejectMutation = useMutation({
        mutationFn: async (bookingId: string) => {
            const isDirect = activeAlertBooking?.status?.toUpperCase() === "PARTNER_ASSIGNED";
            if (isDirect) {
                return api.post(`/service/booking/reject-assignment/${bookingId}`);
            }
            return api.post(`/service/booking/reject/${bookingId}`, { roleId: user?.roleId });
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ["bookings"] });
        },
    });

    const handleDismiss = () => {
        setDismissedTimes(prev => ({ ...prev, [activeAlertBooking._id]: Date.now() }));
        Animated.timing(slideAnim, {
            toValue: -200,
            duration: 250,
            useNativeDriver: true,
        }).start();
        rejectMutation.mutate(activeAlertBooking._id);
    };

    const handleAccept = () => {
        if (!hasActiveSub) {
            Alert.alert("Subscription Required", "You need an active subscription to accept jobs.", [
                { text: "View Plans", onPress: () => router.push("/subscriptions" as any) },
                { text: "Cancel", style: "cancel" }
            ]);
            return;
        }
        acceptMutation.mutate(activeAlertBooking._id);
    };

    return (
        <Animated.View style={[
            styles.floatingWrapper,
            { transform: [{ translateY: slideAnim }, { scale: scaleAnim }] }
        ]}>
            <LinearGradient
                colors={["#FFFFFF", "#F8FAFC"]}
                style={styles.gradientContainer}
            >
                {/* Header Badge */}
                <View style={styles.badgeRow}>
                    <View style={styles.pulseContainer}>
                        <View style={styles.pulseRing} />
                        <View style={styles.pulseDot} />
                    </View>
                    <Text style={styles.badgeText}>
                        {activeAlertBooking.status === "PARTNER_ASSIGNED" ? "⚡ DIRECT JOB ASSIGNED" : "📢 NEW BOOKING AVAILABLE"}
                    </Text>
                    {availableBookings.length > 1 && (
                        <View style={styles.countBadge}>
                            <Text style={styles.countText}>+{availableBookings.length - 1} more</Text>
                        </View>
                    )}
                    <View style={{ 
                        backgroundColor: secondsLeft < 300 ? "#FEF2F2" : "#FFF7ED", 
                        borderColor: secondsLeft < 300 ? "#FCA5A5" : "#FCD34D", 
                        borderWidth: 1, 
                        paddingHorizontal: 8, 
                        paddingVertical: 2, 
                        borderRadius: 10, 
                        marginLeft: "auto", 
                        marginRight: 8 
                    }}>
                        <Text style={{ fontSize: 10, color: secondsLeft < 300 ? "#EF4444" : "#D97706", fontWeight: "bold" }}>
                            ⏳ {String(Math.floor(secondsLeft / 60)).padStart(2, "0")}:{String(secondsLeft % 60).padStart(2, "0")}
                        </Text>
                    </View>
                    <TouchableOpacity style={styles.closeButton} onPress={handleDismiss}>
                        <X size={16} color="#64748B" />
                    </TouchableOpacity>
                </View>

                {/* Main Content */}
                <View style={styles.contentBody}>
                    <View style={styles.mainInfo}>
                        <Text style={styles.serviceName}>{activeAlertBooking.serviceType}</Text>
                        <Text style={styles.patientName}>Patient: {activeAlertBooking.patientName || "Guest Patient"}</Text>
                        <Text style={styles.addressText} numberOfLines={1}>📍 {activeAlertBooking.location?.address || "Location not provided"}</Text>
                    </View>
                    <View style={styles.priceContainer}>
                        <Text style={styles.priceSymbol}>₹</Text>
                        <Text style={styles.priceAmount}>{activeAlertBooking.totalAmount || 0}</Text>
                    </View>
                </View>

                {/* Date / Time slotted */}
                <View style={styles.infoRow}>
                    <Clock size={13} color="#64748B" />
                    <Text style={styles.infoText}>
                        {activeAlertBooking.date 
                            ? new Date(activeAlertBooking.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }) + " | " 
                            : ""}
                        {activeAlertBooking.timeSlot || "As Scheduled"}
                    </Text>
                    {activeAlertBooking.paymentMode === "OFFLINE" && (
                        <View style={styles.cashBadge}>
                            <Text style={styles.cashText}>💵 CASH visit</Text>
                        </View>
                    )}
                </View>

                {/* Action Buttons */}
                <View style={styles.actionsRow}>
                    <TouchableOpacity
                        style={styles.detailsBtn}
                        onPress={() => {
                            router.push({
                                pathname: "/booking_detail" as any,
                                params: { bookingId: activeAlertBooking._id, bookingType: activeAlertBooking.bookingType }
                            });
                        }}
                    >
                        <Text style={styles.detailsBtnText}>View Details</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[
                            styles.acceptBtn,
                            { backgroundColor: activeAlertBooking.status === "PARTNER_ASSIGNED" ? "#2D935C" : "#8B5CF6" }
                        ]}
                        onPress={handleAccept}
                        disabled={acceptMutation.isPending}
                    >
                        <Text style={styles.acceptBtnText}>
                            {acceptMutation.isPending ? "Claiming..." : "⚡ Accept & Claim"}
                        </Text>
                    </TouchableOpacity>
                </View>
                {/* Visual Timer Progress Bar Line */}
                <View style={{
                    position: "absolute",
                    bottom: 0,
                    left: 0,
                    height: 4,
                    backgroundColor: "#EF4444",
                    width: `${(secondsLeft / (activeAlertBooking?.status?.toUpperCase() === "PARTNER_ASSIGNED" ? 300 : 60)) * 100}%`,
                    borderBottomLeftRadius: 24,
                    borderBottomRightRadius: secondsLeft >= (activeAlertBooking?.status?.toUpperCase() === "PARTNER_ASSIGNED" ? 295 : 58) ? 24 : 0,
                }} />
            </LinearGradient>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    floatingWrapper: {
        position: "absolute",
        top: Platform.OS === "ios" ? 54 : 42, // Floating card at the very top (Rapido/MNC styles)
        left: 16,
        right: 16,
        backgroundColor: "#FFFFFF",
        borderRadius: 24,
        elevation: 20,
        shadowColor: "#1E293B",
        shadowOpacity: 0.25,
        shadowRadius: 20,
        shadowOffset: { width: 0, height: 10 },
        borderWidth: 1.5,
        borderColor: "#E2E8F0",
        overflow: "hidden",
        zIndex: 99999,
    },
    gradientContainer: {
        padding: 16,
    },
    badgeRow: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 10,
    },
    pulseContainer: {
        width: 14,
        height: 14,
        justifyContent: "center",
        alignItems: "center",
        marginRight: 6,
    },
    pulseRing: {
        position: "absolute",
        width: 14,
        height: 14,
        borderRadius: 7,
        backgroundColor: "#EF4444",
        opacity: 0.4,
    },
    pulseDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: "#EF4444",
    },
    badgeText: {
        fontSize: 11,
        fontWeight: "900",
        color: "#EF4444",
        letterSpacing: 0.8,
    },
    countBadge: {
        backgroundColor: "#F1F5F9",
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 8,
        marginLeft: 8,
    },
    countText: {
        fontSize: 10,
        fontWeight: "800",
        color: "#475569",
    },
    closeButton: {
        marginLeft: "auto",
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: "#F1F5F9",
        justifyContent: "center",
        alignItems: "center",
    },
    contentBody: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "flex-start",
        marginBottom: 10,
    },
    mainInfo: {
        flex: 1,
        marginRight: 12,
    },
    serviceName: {
        fontSize: 18,
        fontWeight: "900",
        color: "#1E293B",
        marginBottom: 4,
    },
    patientName: {
        fontSize: 13,
        fontWeight: "700",
        color: "#475569",
        marginBottom: 2,
    },
    addressText: {
        fontSize: 12,
        fontWeight: "600",
        color: "#64748B",
    },
    priceContainer: {
        flexDirection: "row",
        alignItems: "baseline",
        backgroundColor: "#F0FDF4",
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: "#DCFCE7",
    },
    priceSymbol: {
        fontSize: 12,
        fontWeight: "800",
        color: "#15803D",
        marginRight: 2,
    },
    priceAmount: {
        fontSize: 18,
        fontWeight: "900",
        color: "#15803D",
    },
    infoRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        marginBottom: 14,
        paddingBottom: 10,
        borderBottomWidth: 1,
        borderBottomColor: "#F1F5F9",
    },
    infoText: {
        fontSize: 12,
        fontWeight: "600",
        color: "#64748B",
    },
    cashBadge: {
        backgroundColor: "#FEF3C7",
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 6,
    },
    cashText: {
        fontSize: 9,
        fontWeight: "900",
        color: "#B45309",
        textTransform: "uppercase",
    },
    actionsRow: {
        flexDirection: "row",
        gap: 10,
    },
    detailsBtn: {
        flex: 1,
        height: 44,
        backgroundColor: "#F1F5F9",
        borderRadius: 12,
        justifyContent: "center",
        alignItems: "center",
    },
    detailsBtnText: {
        fontSize: 13,
        fontWeight: "800",
        color: "#475569",
    },
    acceptBtn: {
        flex: 1.5,
        height: 44,
        borderRadius: 12,
        justifyContent: "center",
        alignItems: "center",
        shadowColor: "#2D935C",
        shadowOpacity: 0.15,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 4 },
    },
    acceptBtnText: {
        fontSize: 13,
        fontWeight: "900",
        color: "#FFFFFF",
    },
});
