import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";

const PRIMARY = "#2D935C";
const FILTERS = ["All", "Open", "Closed"];

const priorityColor: Record<string, string> = {
    Low: "#22C55E",
    Medium: "#F59E0B",
    High: "#EF4444",
    Critical: "#B91C1C",
};

const timeSince = (iso?: string) => {
    if (!iso) return "";
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
};

export default function MyTicketsScreen() {
    const router = useRouter();
    const [filter, setFilter] = useState("All");

    const { data: tickets = [], isLoading, refetch, isRefetching } = useQuery({
        queryKey: ["profileTickets"],
        queryFn: async () => {
            const res = await api.get("/tickets/my");
            return res.data.data || [];
        },
    });

    const filtered = tickets.filter((t: any) => {
        if (filter === "All") return true;
        if (filter === "Open") return t.status !== "Closed" && t.status !== "Resolved";
        return t.status === "Closed" || t.status === "Resolved";
    });

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color="#1E293B" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>My Tickets</Text>
                <TouchableOpacity onPress={() => router.push("/raise_ticket")} style={styles.newBtn}>
                    <Ionicons name="add" size={22} color="#FFF" />
                </TouchableOpacity>
            </View>

            <View style={styles.filterRow}>
                {FILTERS.map((f) => (
                    <TouchableOpacity key={f} onPress={() => setFilter(f)} style={[styles.filterChip, filter === f && styles.filterChipActive]}>
                        <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>{f}</Text>
                    </TouchableOpacity>
                ))}
            </View>

            <ScrollView
                contentContainerStyle={styles.scroll}
                refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={PRIMARY} />}
                showsVerticalScrollIndicator={false}
            >
                {isLoading ? (
                    <ActivityIndicator color={PRIMARY} style={{ marginTop: 60 }} />
                ) : filtered.length === 0 ? (
                    <View style={styles.empty}>
                        <MaterialCommunityIcons name="ticket-outline" size={48} color="#CBD5E1" />
                        <Text style={styles.emptyText}>No {filter.toLowerCase()} tickets</Text>
                        <TouchableOpacity style={styles.emptyCta} onPress={() => router.push("/raise_ticket")}>
                            <Text style={styles.emptyCtaText}>Raise a ticket</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    filtered.map((t: any) => {
                        const isOpen = t.status !== "Closed" && t.status !== "Resolved";
                        return (
                            <TouchableOpacity
                                key={t._id}
                                style={styles.card}
                                onPress={() => router.push({ pathname: "/support_chat", params: { ticketId: t._id, subject: t.subject } })}
                            >
                                <View style={styles.cardTop}>
                                    <Text style={styles.subject} numberOfLines={1}>{t.subject}</Text>
                                    <View style={[styles.statusTag, { backgroundColor: isOpen ? "#FEF3C7" : "#DCFCE7" }]}>
                                        <Text style={[styles.statusTagText, { color: isOpen ? "#92400E" : "#166534" }]}>{t.status || "Open"}</Text>
                                    </View>
                                </View>
                                <Text style={styles.desc} numberOfLines={2}>{t.description}</Text>
                                <View style={styles.cardBottom}>
                                    {t.priority ? (
                                        <View style={styles.priorityWrap}>
                                            <View style={[styles.priorityDot, { backgroundColor: priorityColor[t.priority] || "#94A3B8" }]} />
                                            <Text style={styles.priorityText}>{t.priority}</Text>
                                        </View>
                                    ) : <View />}
                                    <Text style={styles.date}>{timeSince(t.createdAt)}</Text>
                                </View>
                            </TouchableOpacity>
                        );
                    })
                )}
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#F8FAFC" },
    header: { flexDirection: "row", alignItems: "center", padding: 20, gap: 12, backgroundColor: "#FFF", borderBottomWidth: 1, borderBottomColor: "#F1F5F9" },
    backBtn: { width: 40, height: 40, borderRadius: 10, justifyContent: "center", alignItems: "center" },
    headerTitle: { flex: 1, fontSize: 20, fontWeight: "900", color: "#1E293B" },
    newBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: PRIMARY, justifyContent: "center", alignItems: "center" },
    filterRow: { flexDirection: "row", gap: 10, paddingHorizontal: 20, paddingVertical: 16 },
    filterChip: { paddingHorizontal: 18, paddingVertical: 9, borderRadius: 12, backgroundColor: "#FFF", borderWidth: 1, borderColor: "#F1F5F9" },
    filterChipActive: { backgroundColor: PRIMARY, borderColor: PRIMARY },
    filterText: { fontSize: 13, fontWeight: "800", color: "#64748B" },
    filterTextActive: { color: "#FFF" },
    scroll: { padding: 20, paddingTop: 4, gap: 12 },
    empty: { alignItems: "center", marginTop: 70, gap: 14 },
    emptyText: { color: "#475569", fontWeight: "800", fontSize: 16 },
    emptyCta: { paddingHorizontal: 24, paddingVertical: 12, backgroundColor: PRIMARY, borderRadius: 14 },
    emptyCtaText: { color: "#FFF", fontWeight: "800" },
    card: { backgroundColor: "#FFF", padding: 18, borderRadius: 20, borderWidth: 1, borderColor: "#F1F5F9", gap: 10 },
    cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10 },
    subject: { flex: 1, fontSize: 15, fontWeight: "800", color: "#1E293B" },
    statusTag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
    statusTagText: { fontSize: 11, fontWeight: "800" },
    desc: { fontSize: 13, color: "#64748B", lineHeight: 18 },
    cardBottom: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    priorityWrap: { flexDirection: "row", alignItems: "center", gap: 6 },
    priorityDot: { width: 8, height: 8, borderRadius: 4 },
    priorityText: { fontSize: 12, color: "#64748B", fontWeight: "700" },
    date: { fontSize: 11, color: "#94A3B8", fontWeight: "600" },
});
