import { View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator, Alert, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { api } from "../lib/api";

const PRIMARY = "#2D935C";

export default function BookingFeedbackScreen() {
    const router = useRouter();
    const queryClient = useQueryClient();
    const { bookingId, patientName, type } = useLocalSearchParams<{ bookingId?: string; patientName?: string; type?: string }>();
    const bookingType = type === "Doctor" ? "Doctor" : "Service";

    const [rating, setRating] = useState(0);
    const [comment, setComment] = useState("");
    const [submitted, setSubmitted] = useState(false);

    const mutation = useMutation({
        mutationFn: async () => {
            return api.post("/reviews/add", {
                bookingId,
                bookingType,
                rating,
                comment: comment.trim() || undefined,
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["bookings"] });
            setSubmitted(true);
        },
        onError: (err: any) => {
            Alert.alert("Couldn't submit", err?.response?.data?.message || "Please try again.");
        },
    });

    const submit = () => {
        if (rating < 1) {
            Alert.alert("Add a rating", "Please tap a star to rate before submitting.");
            return;
        }
        mutation.mutate();
    };

    if (submitted) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.successWrap}>
                    <LinearGradient colors={["#ECFDF5", "#D1FAE5"]} style={styles.iconBox}>
                        <MaterialCommunityIcons name="star-check" size={64} color={PRIMARY} />
                    </LinearGradient>
                    <Text style={styles.title}>Thanks for your feedback!</Text>
                    <Text style={styles.subtitle}>Your rating helps keep the A1Care community safe and reliable.</Text>

                    <View style={styles.successBtns}>
                        {bookingId ? (
                            <TouchableOpacity
                                style={styles.outlineBtn}
                                onPress={() => router.replace({ pathname: "/booking_detail" as any, params: { bookingId: String(bookingId), bookingType } })}
                            >
                                <Text style={styles.outlineText}>View Booking</Text>
                            </TouchableOpacity>
                        ) : null}
                        <TouchableOpacity style={styles.submitBtn} onPress={() => router.replace("/(tabs)/bookings")}>
                            <Text style={styles.submitText}>Done</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
                <LinearGradient colors={["#ECFDF5", "#D1FAE5"]} style={styles.iconBox}>
                    <MaterialCommunityIcons name="check-decagram" size={64} color={PRIMARY} />
                </LinearGradient>

                <Text style={styles.title}>Job Complete 🎉</Text>
                <Text style={styles.subtitle}>
                    How was your experience{patientName ? ` with ${patientName}` : ""}? Your feedback helps keep A1Care safe.
                </Text>

                {/* Stars */}
                <View style={styles.starsRow}>
                    {[1, 2, 3, 4, 5].map((n) => (
                        <TouchableOpacity key={n} onPress={() => setRating(n)} activeOpacity={0.7} style={styles.starBtn}>
                            <Ionicons name={n <= rating ? "star" : "star-outline"} size={44} color={n <= rating ? "#F59E0B" : "#CBD5E1"} />
                        </TouchableOpacity>
                    ))}
                </View>
                {rating > 0 ? <Text style={styles.ratingLabel}>{["", "Poor", "Fair", "Good", "Great", "Excellent"][rating]}</Text> : null}

                {/* Comment */}
                <TextInput
                    style={styles.input}
                    placeholder="Add a comment (optional)…"
                    placeholderTextColor="#94A3B8"
                    value={comment}
                    onChangeText={setComment}
                    multiline
                    numberOfLines={4}
                />

                <TouchableOpacity style={styles.submitBtn} onPress={submit} disabled={mutation.isPending}>
                    {mutation.isPending ? <ActivityIndicator color="#FFF" /> : <Text style={styles.submitText}>Submit Rating</Text>}
                </TouchableOpacity>

                <TouchableOpacity style={styles.skipBtn} onPress={() => router.replace("/(tabs)/bookings")}>
                    <Text style={styles.skipText}>Skip</Text>
                </TouchableOpacity>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#FFFFFF" },
    scroll: { flexGrow: 1, alignItems: "center", justifyContent: "center", padding: 28, gap: 14 },
    iconBox: { width: 120, height: 120, borderRadius: 60, justifyContent: "center", alignItems: "center", marginBottom: 6 },
    title: { fontSize: 26, fontWeight: "900", color: "#1E293B", textAlign: "center" },
    subtitle: { fontSize: 15, color: "#64748B", textAlign: "center", lineHeight: 22, fontWeight: "500", marginBottom: 8 },
    starsRow: { flexDirection: "row", gap: 6, marginTop: 8 },
    starBtn: { padding: 4 },
    ratingLabel: { fontSize: 15, fontWeight: "800", color: "#B45309" },
    input: { width: "100%", minHeight: 110, backgroundColor: "#F8FAFC", borderRadius: 18, borderWidth: 1, borderColor: "#E2E8F0", padding: 16, fontSize: 15, color: "#1E293B", textAlignVertical: "top", marginTop: 12 },
    submitBtn: { width: "100%", height: 54, backgroundColor: PRIMARY, borderRadius: 16, justifyContent: "center", alignItems: "center", marginTop: 8 },
    submitText: { color: "#FFF", fontSize: 16, fontWeight: "800" },
    skipBtn: { paddingVertical: 12 },
    skipText: { color: "#94A3B8", fontSize: 15, fontWeight: "700" },
    successWrap: { flex: 1, alignItems: "center", justifyContent: "center", padding: 28, gap: 14 },
    successBtns: { width: "100%", gap: 12, marginTop: 18 },
    outlineBtn: { width: "100%", height: 54, borderRadius: 16, borderWidth: 1.5, borderColor: PRIMARY, justifyContent: "center", alignItems: "center" },
    outlineText: { color: PRIMARY, fontSize: 16, fontWeight: "800" },
});
