import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert, BackHandler } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useState, useEffect, useRef } from "react";
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
    const [isRaising, setIsRaising] = useState(false);
    const params = useLocalSearchParams<{ autoOpen?: string }>();
    const hasAutoOpened = useRef(false);

    useEffect(() => {
        if (params?.autoOpen === "true" && !hasAutoOpened.current) {
            setIsRaising(true);
            hasAutoOpened.current = true;
            // Optionally clear the param so it doesn't re-trigger
            router.setParams({ autoOpen: undefined });
        }
    }, [params?.autoOpen]);

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
            router.replace("/my_tickets");
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
                <View style={{ width: 24 }} />
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                {!isRaising ? (
                    <TouchableOpacity 
                        style={styles.raiseTicketBtn} 
                        onPress={() => setIsRaising(true)}
                    >
                        <Ionicons name="add-circle-outline" size={22} color="#FFF" style={{ marginRight: 8 }} />
                        <Text style={styles.raiseTicketBtnText}>Raise a New Ticket</Text>
                    </TouchableOpacity>
                ) : (
                    <View style={styles.card}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                            <Text style={[styles.cardTitle, { marginBottom: 0 }]}>Raise a New Ticket</Text>
                            <TouchableOpacity onPress={() => setIsRaising(false)} style={{ padding: 4 }}>
                                <Ionicons name="close" size={22} color="#64748B" />
                            </TouchableOpacity>
                        </View>
                        <View style={styles.form}>
                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Subject <Text style={styles.asterisk}>*</Text></Text>
                                <View style={styles.inputWrapper}>
                                    <Ionicons name="create-outline" size={20} color="#64748B" style={styles.inputIcon} />
                                    <TextInput
                                        style={styles.input}
                                        value={form.subject}
                                        onChangeText={(v) => setForm(prev => ({ ...prev, subject: v }))}
                                        placeholder="Brief summary of the issue"
                                        placeholderTextColor="#94A3B8"
                                    />
                                </View>
                            </View>

                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Description <Text style={styles.asterisk}>*</Text></Text>
                                <View style={styles.inputWrapperLarge}>
                                    <Ionicons name="chatbubble-ellipses-outline" size={20} color="#64748B" style={styles.inputIconLarge} />
                                    <TextInput
                                        style={[styles.input, styles.textArea]}
                                        value={form.description}
                                        onChangeText={(v) => setForm(prev => ({ ...prev, description: v }))}
                                        placeholder="Detailed explanation of your concern..."
                                        placeholderTextColor="#94A3B8"
                                        multiline
                                        numberOfLines={4}
                                    />
                                </View>
                            </View>

                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Priority Level</Text>
                                <View style={styles.priorityRow}>
                                    {["Low", "Medium", "High"].map((p) => {
                                        const isActive = form.priority === p;
                                        const activeColors = p === "Low" ? { bg: "#ECFDF5", border: "#10B981", text: "#047857" } : p === "Medium" ? { bg: "#FFFBEB", border: "#F59E0B", text: "#B45309" } : { bg: "#FEF2F2", border: "#EF4444", text: "#B91C1C" };
                                        return (
                                            <TouchableOpacity
                                                key={p}
                                                onPress={() => setForm(prev => ({ ...prev, priority: p }))}
                                                style={[
                                                    styles.priorityBtn,
                                                    isActive ? { backgroundColor: activeColors.bg, borderColor: activeColors.border } : null
                                                ]}
                                            >
                                                <Text style={[
                                                    styles.priorityText,
                                                    isActive ? { color: activeColors.text, fontWeight: '800' } : null
                                                ]}>{p}</Text>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>
                            </View>

                            <TouchableOpacity
                                style={[styles.submitButton, createMutation.isPending && { opacity: 0.7 }]}
                                onPress={handleSubmit}
                                disabled={createMutation.isPending}
                            >
                                {createMutation.isPending ? (
                                    <ActivityIndicator color="#FFF" />
                                ) : (
                                    <Text style={styles.submitButtonText}>Submit Ticket</Text>
                                )}
                            </TouchableOpacity>

                            <TouchableOpacity 
                                style={styles.cancelBtnOutline} 
                                onPress={() => setIsRaising(false)}
                            >
                                <Text style={styles.cancelBtnOutlineText}>Cancel</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                )}

                <Text style={styles.sectionTitle}>Recent Tickets</Text>
                {isLoading ? (
                    <ActivityIndicator color="#2D935C" style={{ marginTop: 20 }} />
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
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                                <View style={[styles.ticketIconContainer, { backgroundColor: t.status === "Open" ? "#FFFBEB" : "#ECFDF5" }]}>
                                    <Ionicons name="chatbubbles-outline" size={22} color={t.status === "Open" ? "#D97706" : "#10B981"} />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <View style={styles.ticketHeader}>
                                        <Text style={styles.ticketSubject} numberOfLines={1}>{t.subject}</Text>
                                        <View style={[styles.statusTag, { backgroundColor: t.status === "Open" ? "#FEF3C7" : "#DCFCE7" }]}>
                                            <Text style={[styles.statusTagText, { color: t.status === "Open" ? "#92400E" : "#166534" }]}>{t.status}</Text>
                                        </View>
                                    </View>
                                    <Text style={styles.ticketDesc} numberOfLines={1}>{t.description}</Text>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                                        <Text style={styles.ticketDate}>{new Date(t.createdAt).toLocaleDateString()}</Text>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                            <View style={[styles.priorityBadge, t.priority === "High" ? { backgroundColor: '#FEE2E2' } : t.priority === "Medium" ? { backgroundColor: '#FEF3C7' } : { backgroundColor: '#E2E8F0' }]}>
                                                <Text style={[styles.priorityBadgeText, t.priority === "High" ? { color: '#EF4444' } : t.priority === "Medium" ? { color: '#F59E0B' } : { color: '#64748B' }]}>{t.priority} Priority</Text>
                                            </View>
                                            <Ionicons name="chevron-forward" size={16} color="#94A3B8" />
                                        </View>
                                    </View>
                                </View>
                            </View>
                        </TouchableOpacity>
                    ))
                ) : (
                    <View style={styles.emptyTickets}>
                        <Ionicons name="ticket-outline" size={48} color="#CBD5E1" />
                        <Text style={styles.emptyText}>No support tickets found. Raise a ticket above if you need help!</Text>
                    </View>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#F8FAFC" },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 15, backgroundColor: "#FFF", borderBottomWidth: 1, borderBottomColor: "#E2E8F0" },
    backButton: { padding: 5 },
    headerTitle: { fontSize: 18, fontWeight: "800", color: "#1E293B" },
    scrollContent: { padding: 20, paddingBottom: 40 },
    card: { backgroundColor: "#FFF", padding: 20, borderRadius: 24, borderWidth: 1.5, borderColor: "#F1F5F9", elevation: 1, shadowColor: "#000", shadowOpacity: 0.02, shadowOffset: { width: 0, height: 2 }, shadowRadius: 8, marginBottom: 30 },
    cardTitle: { fontSize: 16, fontWeight: "800", color: "#1E293B", textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 20 },
    form: { gap: 20 },
    inputGroup: { gap: 8 },
    label: { fontSize: 14, fontWeight: "800", color: "#1E293B", marginBottom: 2, marginLeft: 2 },
    asterisk: { color: "#EF4444" },
    inputWrapper: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#FFF",
        borderRadius: 16,
        borderWidth: 1.5,
        borderColor: "#E2E8F0",
        paddingHorizontal: 16,
        elevation: 1,
        shadowColor: "#000",
        shadowOpacity: 0.02,
        shadowOffset: { width: 0, height: 2 },
        shadowRadius: 4
    },
    inputWrapperLarge: {
        flexDirection: "row",
        backgroundColor: "#FFF",
        borderRadius: 16,
        borderWidth: 1.5,
        borderColor: "#E2E8F0",
        paddingHorizontal: 16,
        paddingTop: 16,
        elevation: 1,
        shadowColor: "#000",
        shadowOpacity: 0.02,
        shadowOffset: { width: 0, height: 2 },
        shadowRadius: 4
    },
    input: {
        flex: 1,
        paddingVertical: 14,
        fontSize: 15,
        color: "#1E293B",
        fontWeight: "600"
    },
    inputIcon: {
        marginRight: 10,
    },
    inputIconLarge: {
        marginRight: 10,
        marginTop: 2
    },
    textArea: { height: 120, textAlignVertical: "top", paddingVertical: 0 },
    priorityRow: { flexDirection: "row", gap: 10 },
    priorityBtn: { flex: 1, height: 48, borderRadius: 12, borderWidth: 1.5, borderColor: "#E2E8F0", justifyContent: "center", alignItems: "center", backgroundColor: "#FFF" },
    priorityBtnActive: { borderWidth: 1.5 },
    priorityText: { fontSize: 14, fontWeight: "700", color: "#64748B" },
    priorityTextActive: { fontWeight: "800" },
    submitButton: { backgroundColor: "#2D935C", height: 60, borderRadius: 20, justifyContent: "center", alignItems: "center", marginTop: 10, elevation: 3, shadowColor: "#2D935C", shadowOpacity: 0.2, shadowOffset: { width: 0, height: 4 }, shadowRadius: 10 },
    submitButtonText: { color: "#FFF", fontSize: 16, fontWeight: "800" },
    sectionTitle: { fontSize: 16, fontWeight: "800", color: "#1E293B", textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 16, marginTop: 10 },
    ticketCard: { backgroundColor: "#FFF", padding: 16, borderRadius: 20, borderWidth: 1.5, borderColor: "#F1F5F9", marginBottom: 12, elevation: 1, shadowColor: "#000", shadowOpacity: 0.02, shadowOffset: { width: 0, height: 2 }, shadowRadius: 4 },
    ticketIconContainer: { width: 44, height: 44, borderRadius: 12, justifyContent: "center", alignItems: "center" },
    ticketHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
    ticketSubject: { fontSize: 15, fontWeight: "800", color: "#1E293B", flex: 1, marginRight: 10 },
    statusTag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
    statusTagText: { fontSize: 11, fontWeight: "800" },
    ticketDesc: { fontSize: 13, color: "#64748B", fontWeight: "600", lineHeight: 18, marginBottom: 6 },
    ticketDate: { fontSize: 12, color: "#94A3B8", fontWeight: "600" },
    priorityBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
    priorityBadgeText: { fontSize: 10, fontWeight: "800" },
    emptyTickets: { padding: 40, alignItems: "center", justifyContent: "center", gap: 12 },
    emptyText: { color: "#64748B", textAlign: "center", fontSize: 14, fontWeight: "600" },
    raiseTicketBtn: {
        backgroundColor: "#2D935C",
        height: 44,
        borderRadius: 22,
        flexDirection: "row",
        justifyContent: "center",
        alignItems: "center",
        alignSelf: "flex-end",
        paddingHorizontal: 20,
        marginBottom: 20,
        elevation: 3,
        shadowColor: "#2D935C",
        shadowOpacity: 0.15,
        shadowOffset: { width: 0, height: 3 },
        shadowRadius: 6
    },
    raiseTicketBtnText: { color: "#FFF", fontSize: 14, fontWeight: "800" },
    cancelBtnOutline: {
        height: 50,
        borderRadius: 16,
        borderWidth: 1.5,
        borderColor: "#CBD5E1",
        justifyContent: "center",
        alignItems: "center",
        marginTop: 5
    },
    cancelBtnOutlineText: { color: "#64748B", fontSize: 15, fontWeight: "800" }
});
