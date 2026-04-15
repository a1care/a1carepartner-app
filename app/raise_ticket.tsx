import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert, BackHandler } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";

export default function RaiseTicketScreen() {
    const router = useRouter();
    const queryClient = useQueryClient();
    const [form, setForm] = useState({
        subject: "",
        description: "",
        priority: "Medium"
    });

    useEffect(() => {
        const backAction = () => {
            router.navigate("/(tabs)/profile" as any);
            return true;
        };
        const backHandler = BackHandler.addEventListener("hardwareBackPress", backAction);
        return () => backHandler.remove();
    }, []);

    const { data: tickets = [], isLoading } = useQuery({
        queryKey: ["profileTickets"],
        queryFn: async () => {
            const res = await api.get("/tickets/my");
            return res.data.data || [];
        }
    });

    const createMutation = useMutation({
        mutationFn: async (payload: typeof form) => {
            return await api.post("/tickets/create", payload);
        },
        onSuccess: () => {
            Alert.alert("Ticket Raised", "Our support team will look into it shortly.");
            setForm({ subject: "", description: "", priority: "Medium" });
            queryClient.invalidateQueries({ queryKey: ["profileTickets"] });
            router.replace("/(tabs)/profile");
        },
        onError: () => {
            Alert.alert("Error", "Failed to raise ticket. Please try again.");
        }
    });

    const handleSubmit = () => {
        if (!form.subject || !form.description) {
            Alert.alert("Missing Info", "Please provide both subject and description.");
            return;
        }
        createMutation.mutate(form);
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.navigate("/(tabs)/profile" as any)} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color="#1E293B" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Support Center</Text>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent}>
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Raise a New Ticket</Text>
                    <View style={styles.form}>
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Subject <Text style={styles.asterisk}>*</Text></Text>
                            <TextInput
                                style={styles.input}
                                value={form.subject}
                                onChangeText={(v) => setForm(prev => ({ ...prev, subject: v }))}
                                placeholder="Brief summary of the issue"
                            />
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Description <Text style={styles.asterisk}>*</Text></Text>
                            <TextInput
                                style={[styles.input, styles.textArea]}
                                value={form.description}
                                onChangeText={(v) => setForm(prev => ({ ...prev, description: v }))}
                                placeholder="Detailed explanation..."
                                multiline
                                numberOfLines={4}
                            />
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Priority</Text>
                            <View style={styles.priorityRow}>
                                {["Low", "Medium", "High"].map((p) => (
                                    <TouchableOpacity
                                        key={p}
                                        onPress={() => setForm(prev => ({ ...prev, priority: p }))}
                                        style={[
                                            styles.priorityBtn,
                                            form.priority === p && styles.priorityBtnActive,
                                            form.priority === p && p === "Low" && { backgroundColor: "#DCFCE7", borderColor: "#22C55E" },
                                            form.priority === p && p === "Medium" && { backgroundColor: "#FEF3C7", borderColor: "#F59E0B" },
                                            form.priority === p && p === "High" && { backgroundColor: "#FEE2E2", borderColor: "#EF4444" },
                                        ]}
                                    >
                                        <Text style={[
                                            styles.priorityText,
                                            form.priority === p && styles.priorityTextActive,
                                            form.priority === p && p === "Low" && { color: "#166534" },
                                            form.priority === p && p === "Medium" && { color: "#92400E" },
                                            form.priority === p && p === "High" && { color: "#991B1B" },
                                        ]}>{p}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>

                        <TouchableOpacity
                            style={styles.submitButton}
                            onPress={handleSubmit}
                            disabled={createMutation.isPending}
                        >
                            {createMutation.isPending ? (
                                <ActivityIndicator color="#FFF" />
                            ) : (
                                <Text style={styles.submitButtonText}>Submit Ticket</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>

                <Text style={styles.sectionTitle}>Recent Tickets</Text>
                {isLoading ? (
                    <ActivityIndicator color="#2D935C" />
                ) : tickets.length > 0 ? (
                    tickets.map((t: any) => (
                        <TouchableOpacity 
                            key={t._id} 
                            style={styles.ticketCard}
                            onPress={() => router.push({
                                pathname: "/support_chat",
                                params: { ticketId: t._id, subject: t.subject }
                            })}
                        >
                            <View style={styles.ticketHeader}>
                                <Text style={styles.ticketSubject} numberOfLines={1}>{t.subject}</Text>
                                <View style={[styles.statusTag, { backgroundColor: t.status === "Open" ? "#FEF3C7" : "#DCFCE7" }]}>
                                    <Text style={[styles.statusTagText, { color: t.status === "Open" ? "#92400E" : "#166534" }]}>{t.status}</Text>
                                </View>
                            </View>
                            <Text style={styles.ticketDesc} numberOfLines={2}>{t.description}</Text>
                            <Text style={styles.ticketDate}>{new Date(t.createdAt).toLocaleDateString()}</Text>
                        </TouchableOpacity>
                    ))
                ) : (
                    <View style={styles.emptyTickets}>
                        <Text style={styles.emptyText}>No tickets found. Need help? Raise one above.</Text>
                    </View>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#F8FAFC" },
    header: { flexDirection: "row", alignItems: "center", padding: 20, backgroundColor: "#FFF", borderBottomWidth: 1, borderBottomColor: "#F1F5F9" },
    backButton: { marginRight: 15 },
    headerTitle: { fontSize: 20, fontWeight: "800", color: "#1E293B" },
    scrollContent: { padding: 20 },
    card: { backgroundColor: "#FFF", padding: 20, borderRadius: 24, borderWidth: 1, borderColor: "#F1F5F9", elevation: 2, marginBottom: 30 },
    cardTitle: { fontSize: 18, fontWeight: "800", color: "#1E293B", marginBottom: 20 },
    form: { gap: 16 },
    inputGroup: { gap: 8 },
    label: { fontSize: 14, fontWeight: "700", color: "#475569", marginLeft: 4 },
    asterisk: { color: "#EF4444" },
    input: { height: 56, backgroundColor: "#F8FAFC", borderRadius: 16, paddingHorizontal: 18, fontSize: 15, color: "#1E293B", borderWidth: 1, borderColor: "#E2E8F0" },
    textArea: { height: 120, textAlignVertical: "top", paddingTop: 16 },
    priorityRow: { flexDirection: "row", gap: 10 },
    priorityBtn: { flex: 1, height: 44, borderRadius: 12, borderWidth: 1, borderColor: "#E2E8F0", justifyContent: "center", alignItems: "center", backgroundColor: "#FFF" },
    priorityBtnActive: { borderWidth: 1 },
    priorityText: { fontSize: 14, fontWeight: "600", color: "#64748B" },
    priorityTextActive: { fontWeight: "800" },
    submitButton: { backgroundColor: "#2D935C", height: 56, borderRadius: 28, justifyContent: "center", alignItems: "center", marginTop: 10 },
    submitButtonText: { color: "#FFF", fontSize: 16, fontWeight: "800" },
    sectionTitle: { fontSize: 18, fontWeight: "800", color: "#1E293B", marginBottom: 16 },
    ticketCard: { backgroundColor: "#FFF", padding: 18, borderRadius: 20, borderWidth: 1, borderColor: "#F1F5F9", marginBottom: 12 },
    ticketHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
    ticketSubject: { fontSize: 15, fontWeight: "700", color: "#1E293B", flex: 1, marginRight: 10 },
    statusTag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
    statusTagText: { fontSize: 11, fontWeight: "700" },
    ticketDesc: { fontSize: 13, color: "#64748B", lineHeight: 18, marginBottom: 10 },
    ticketDate: { fontSize: 11, color: "#94A3B8" },
    emptyTickets: { padding: 40, alignItems: "center" },
    emptyText: { color: "#94A3B8", textAlign: "center", fontSize: 14 }
});
