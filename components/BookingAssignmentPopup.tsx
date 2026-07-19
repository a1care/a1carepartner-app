import React, { useEffect, useRef, useState } from "react";
import {
    Modal, View, Text, TouchableOpacity, StyleSheet, Animated, Vibration, Platform
} from "react-native";
import { Bell, Clock, ArrowRight, X } from "lucide-react-native";

const ACCEPTANCE_TIMEOUT_SECONDS = 5 * 60; // 5 minutes

export interface AssignmentRequest {
    bookingId: string;
    serviceName: string;
    patientName: string;
    location: string;
    amount: number;
    scheduledTime?: string;
    acceptanceDeadline?: string;
}

interface Props {
    request: AssignmentRequest | null;
    onDecline: (bookingId: string) => void;
    onPress: (bookingId: string) => void;
}

export default function BookingAssignmentPopup({ request, onDecline, onPress }: Props) {
    const [secondsLeft, setSecondsLeft] = useState(ACCEPTANCE_TIMEOUT_SECONDS);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const slideAnim = useRef(new Animated.Value(-150)).current; // Start off-screen (top)
    const pulseAnim = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        if (!request) {
            // Slide out
            Animated.timing(slideAnim, {
                toValue: -150,
                duration: 300,
                useNativeDriver: true,
            }).start();
            if (timerRef.current) clearInterval(timerRef.current);
            setSecondsLeft(ACCEPTANCE_TIMEOUT_SECONDS);
            return;
        }

        // Slide in
        Animated.spring(slideAnim, {
            toValue: Platform.OS === 'web' ? 20 : 50, // Screen margin from top
            tension: 50,
            friction: 8,
            useNativeDriver: true,
        }).start();

        // Calculate remaining time from deadline if provided
        if (request.acceptanceDeadline) {
            const remaining = Math.floor((new Date(request.acceptanceDeadline).getTime() - Date.now()) / 1000);
            setSecondsLeft(Math.max(0, remaining));
        } else {
            setSecondsLeft(ACCEPTANCE_TIMEOUT_SECONDS);
        }

        Vibration.vibrate([0, 500, 200, 500]);

        timerRef.current = setInterval(() => {
            setSecondsLeft((s) => {
                if (s <= 1) {
                    clearInterval(timerRef.current!);
                    onDecline(request.bookingId); // auto-decline on timeout
                    return 0;
                }
                return s - 1;
            });
        }, 1000);

        // Pulse animation
        Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, { toValue: 1.03, duration: 800, useNativeDriver: true }),
                Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
            ])
        ).start();

        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [request?.bookingId]);

    if (!request) return null;

    const mins = Math.floor(secondsLeft / 60);
    const secs = secondsLeft % 60;
    const progress = secondsLeft / ACCEPTANCE_TIMEOUT_SECONDS;

    return (
        <Modal visible={!!request} transparent animationType="none" statusBarTranslucent pointerEvents="box-none">
            <View style={styles.overlay} pointerEvents="box-none">
                <Animated.View style={[
                    styles.floatingContainer,
                    { transform: [{ translateY: slideAnim }, { scale: pulseAnim }] }
                ]}>
                    <TouchableOpacity
                        activeOpacity={0.9}
                        style={styles.cardClickable}
                        onPress={() => onPress(request.bookingId)}
                    >
                        <View style={styles.header}>
                            <View style={styles.bellBadge}>
                                <Bell size={18} color="#FFF" />
                            </View>
                            <View style={{ flex: 1, marginLeft: 12 }}>
                                <Text style={styles.headerTitle}>New Booking Alert! 🚨</Text>
                                <Text style={styles.headerSub} numberOfLines={1}>{request.serviceName} for {request.patientName}</Text>
                            </View>
                            <Text style={styles.priceTag}>₹{request.amount}</Text>
                        </View>

                        <View style={styles.detailsRow}>
                            <View style={styles.timerContainer}>
                                <Clock size={14} color="#6B7280" />
                                <Text style={styles.timerText}>
                                    {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
                                </Text>
                            </View>
                            <View style={styles.actionPrompt}>
                                <Text style={styles.actionText}>Tap to View Details</Text>
                                <ArrowRight size={14} color="#2D935C" />
                            </View>
                        </View>

                        {/* Progress indicator bar */}
                        <View style={styles.progressBg}>
                            <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
                        </View>
                    </TouchableOpacity>

                    {/* Small overlay close button */}
                    <TouchableOpacity
                        style={styles.closeBtn}
                        onPress={() => onDecline(request.bookingId)}
                    >
                        <X size={16} color="#6B7280" />
                    </TouchableOpacity>
                </Animated.View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        alignItems: "center",
    },
    floatingContainer: {
        width: "90%",
        maxWidth: 420,
        backgroundColor: "#FFFFFF",
        borderRadius: 20,
        padding: 16,
        elevation: 10,
        shadowColor: "#1E293B",
        shadowOpacity: 0.15,
        shadowRadius: 15,
        shadowOffset: { width: 0, height: 8 },
        borderWidth: 1,
        borderColor: "#E2E8F0",
        position: "relative",
    },
    cardClickable: {
        width: "100%",
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
    },
    bellBadge: {
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: "#2D935C",
        justifyContent: "center",
        alignItems: "center",
    },
    headerTitle: {
        fontSize: 16,
        fontWeight: "800",
        color: "#1E293B",
    },
    headerSub: {
        fontSize: 13,
        color: "#64748B",
        fontWeight: "600",
        marginTop: 2,
    },
    priceTag: {
        fontSize: 18,
        fontWeight: "900",
        color: "#2D935C",
        marginRight: 20,
    },
    detailsRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginTop: 12,
        paddingTop: 10,
        borderTopWidth: 1,
        borderTopColor: "#F1F5F9",
    },
    timerContainer: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
    },
    timerText: {
        fontSize: 14,
        fontWeight: "700",
        color: "#EF4444",
    },
    actionPrompt: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
    },
    actionText: {
        fontSize: 13,
        fontWeight: "800",
        color: "#2D935C",
    },
    progressBg: {
        height: 4,
        backgroundColor: "#E2E8F0",
        borderRadius: 2,
        marginTop: 10,
        overflow: "hidden",
    },
    progressFill: {
        height: "100%",
        backgroundColor: "#2D935C",
    },
    closeBtn: {
        position: "absolute",
        top: 10,
        right: 10,
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: "#F1F5F9",
        justifyContent: "center",
        alignItems: "center",
    },
});
