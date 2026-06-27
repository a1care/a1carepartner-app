import React, { useEffect, useRef, useState } from "react";
import {
    Modal, View, Text, TouchableOpacity, StyleSheet, Animated, Vibration,
} from "react-native";
import { MapPin, Clock, IndianRupee, Briefcase } from "lucide-react-native";

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
    onAccept: (bookingId: string) => void;
    onReject: (bookingId: string) => void;
}

export default function BookingAssignmentPopup({ request, onAccept, onReject }: Props) {
    const [secondsLeft, setSecondsLeft] = useState(ACCEPTANCE_TIMEOUT_SECONDS);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const pulseAnim = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        if (!request) {
            if (timerRef.current) clearInterval(timerRef.current);
            setSecondsLeft(ACCEPTANCE_TIMEOUT_SECONDS);
            return;
        }

        // Calculate remaining time from deadline if provided
        if (request.acceptanceDeadline) {
            const remaining = Math.floor((new Date(request.acceptanceDeadline).getTime() - Date.now()) / 1000);
            setSecondsLeft(Math.max(0, remaining));
        } else {
            setSecondsLeft(ACCEPTANCE_TIMEOUT_SECONDS);
        }

        Vibration.vibrate([0, 500, 200, 500, 200, 500]);

        timerRef.current = setInterval(() => {
            setSecondsLeft((s) => {
                if (s <= 1) {
                    clearInterval(timerRef.current!);
                    onReject(request.bookingId); // auto-reject on timeout
                    return 0;
                }
                return s - 1;
            });
        }, 1000);

        // Pulse animation on timer ring
        Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, { toValue: 1.08, duration: 600, useNativeDriver: true }),
                Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
            ])
        ).start();

        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [request?.bookingId]);

    if (!request) return null;

    const mins = Math.floor(secondsLeft / 60);
    const secs = secondsLeft % 60;
    const urgency = secondsLeft < 60;
    const progress = secondsLeft / ACCEPTANCE_TIMEOUT_SECONDS;

    return (
        <Modal visible={!!request} transparent animationType="slide" statusBarTranslucent>
            <View style={styles.overlay}>
                <View style={styles.card}>
                    {/* Header */}
                    <View style={styles.header}>
                        <Text style={styles.headerTitle}>🚨 New Job Request!</Text>
                        <Text style={styles.headerSub}>Respond before the timer runs out</Text>
                    </View>

                    {/* Timer */}
                    <Animated.View style={[styles.timerRing, urgency && styles.timerRingUrgent, { transform: [{ scale: pulseAnim }] }]}>
                        <Text style={[styles.timerText, urgency && styles.timerTextUrgent]}>
                            {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
                        </Text>
                        <Text style={styles.timerLabel}>remaining</Text>
                    </Animated.View>

                    {/* Progress bar */}
                    <View style={styles.progressBg}>
                        <View style={[styles.progressFill, { width: `${progress * 100}%`, backgroundColor: urgency ? "#EF4444" : "#10B981" }]} />
                    </View>

                    {/* Booking Details */}
                    <View style={styles.details}>
                        <Row icon={<Briefcase size={18} color="#6366F1" />} label="Service" value={request.serviceName} />
                        <Row icon={<Text style={{ fontSize: 16 }}>👤</Text>} label="Patient" value={request.patientName} />
                        <Row icon={<MapPin size={18} color="#EF4444" />} label="Location" value={request.location} />
                        <Row icon={<IndianRupee size={18} color="#10B981" />} label="Earnings" value={`₹${request.amount}`} />
                        {request.scheduledTime && (
                            <Row icon={<Clock size={18} color="#F59E0B" />} label="Schedule" value={new Date(request.scheduledTime).toLocaleString()} />
                        )}
                    </View>

                    {/* Actions */}
                    <View style={styles.actions}>
                        <TouchableOpacity style={styles.rejectBtn} onPress={() => onReject(request.bookingId)}>
                            <Text style={styles.rejectText}>✗ Reject</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.acceptBtn} onPress={() => onAccept(request.bookingId)}>
                            <Text style={styles.acceptText}>✓ Accept Job</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
    return (
        <View style={styles.row}>
            {icon}
            <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.rowLabel}>{label}</Text>
                <Text style={styles.rowValue}>{value}</Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
    card: { backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
    header: { alignItems: "center", marginBottom: 20 },
    headerTitle: { fontSize: 22, fontWeight: "800", color: "#111827" },
    headerSub: { fontSize: 13, color: "#6B7280", marginTop: 4 },
    timerRing: {
        alignSelf: "center", width: 100, height: 100, borderRadius: 50,
        borderWidth: 6, borderColor: "#10B981", justifyContent: "center", alignItems: "center", marginBottom: 12,
    },
    timerRingUrgent: { borderColor: "#EF4444" },
    timerText: { fontSize: 28, fontWeight: "800", color: "#10B981" },
    timerTextUrgent: { color: "#EF4444" },
    timerLabel: { fontSize: 11, color: "#9CA3AF" },
    progressBg: { height: 6, backgroundColor: "#E5E7EB", borderRadius: 3, marginBottom: 20 },
    progressFill: { height: 6, borderRadius: 3 },
    details: { gap: 12, marginBottom: 24 },
    row: { flexDirection: "row", alignItems: "center", backgroundColor: "#F9FAFB", padding: 12, borderRadius: 12 },
    rowLabel: { fontSize: 11, color: "#9CA3AF", fontWeight: "600" },
    rowValue: { fontSize: 14, color: "#111827", fontWeight: "600", marginTop: 2 },
    actions: { flexDirection: "row", gap: 12 },
    rejectBtn: { flex: 1, padding: 16, borderRadius: 14, borderWidth: 2, borderColor: "#EF4444", alignItems: "center" },
    rejectText: { fontSize: 16, fontWeight: "700", color: "#EF4444" },
    acceptBtn: { flex: 2, padding: 16, borderRadius: 14, backgroundColor: "#10B981", alignItems: "center" },
    acceptText: { fontSize: 16, fontWeight: "700", color: "#fff" },
});
