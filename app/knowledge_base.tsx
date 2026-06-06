import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, LayoutAnimation, Platform, UIManager } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";

const PRIMARY = "#2D935C";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

// Tolerant field access — admin stores knowledgeBase as a free-form array.
const getTitle = (item: any) => item?.title || item?.heading || item?.question || item?.name || "Untitled";
const getBody = (item: any) => item?.content || item?.body || item?.answer || item?.description || item?.text || "";
const getCategory = (item: any) => item?.category || item?.tag || null;

export default function KnowledgeBaseScreen() {
    const router = useRouter();
    const [openIdx, setOpenIdx] = useState<number | null>(null);

    const { data: items = [], isLoading } = useQuery({
        queryKey: ["knowledgeBase"],
        queryFn: async () => {
            const res = await api.get("/common/config/partner");
            return res.data?.data?.knowledgeBase || [];
        },
    });

    const toggle = (idx: number) => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setOpenIdx(openIdx === idx ? null : idx);
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color="#1E293B" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Knowledge Base</Text>
            </View>

            <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
                <View style={styles.hero}>
                    <View style={styles.heroIcon}>
                        <MaterialCommunityIcons name="book-open-page-variant" size={28} color={PRIMARY} />
                    </View>
                    <Text style={styles.heroTitle}>Guides & How-tos</Text>
                    <Text style={styles.heroSub}>Everything you need to deliver great service.</Text>
                </View>

                {isLoading ? (
                    <ActivityIndicator color={PRIMARY} style={{ marginTop: 40 }} />
                ) : items.length === 0 ? (
                    <View style={styles.empty}>
                        <MaterialCommunityIcons name="book-outline" size={44} color="#CBD5E1" />
                        <Text style={styles.emptyText}>No articles yet</Text>
                        <Text style={styles.emptySub}>Check back soon — our team is adding guides.</Text>
                    </View>
                ) : (
                    items.map((item: any, idx: number) => {
                        const open = openIdx === idx;
                        const category = getCategory(item);
                        return (
                            <TouchableOpacity key={idx} activeOpacity={0.9} style={styles.card} onPress={() => toggle(idx)}>
                                <View style={styles.cardHead}>
                                    <View style={{ flex: 1 }}>
                                        {category ? <Text style={styles.category}>{String(category).toUpperCase()}</Text> : null}
                                        <Text style={styles.cardTitle}>{getTitle(item)}</Text>
                                    </View>
                                    <Ionicons name={open ? "chevron-up" : "chevron-down"} size={20} color="#94A3B8" />
                                </View>
                                {open ? <Text style={styles.cardBody}>{getBody(item)}</Text> : null}
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
    headerTitle: { fontSize: 20, fontWeight: "900", color: "#1E293B" },
    scroll: { padding: 20, gap: 12 },
    hero: { alignItems: "center", gap: 6, marginBottom: 10 },
    heroIcon: { width: 64, height: 64, borderRadius: 20, backgroundColor: "#ECFDF5", justifyContent: "center", alignItems: "center", marginBottom: 6 },
    heroTitle: { fontSize: 22, fontWeight: "900", color: "#1E293B" },
    heroSub: { fontSize: 14, color: "#64748B", fontWeight: "500", textAlign: "center" },
    empty: { alignItems: "center", marginTop: 50, gap: 10 },
    emptyText: { color: "#475569", fontWeight: "800", fontSize: 16 },
    emptySub: { color: "#94A3B8", fontSize: 13, textAlign: "center" },
    card: { backgroundColor: "#FFF", borderRadius: 20, padding: 18, borderWidth: 1, borderColor: "#F1F5F9" },
    cardHead: { flexDirection: "row", alignItems: "center", gap: 12 },
    category: { fontSize: 10, fontWeight: "900", color: PRIMARY, letterSpacing: 0.5, marginBottom: 4 },
    cardTitle: { fontSize: 15, fontWeight: "800", color: "#1E293B" },
    cardBody: { fontSize: 14, color: "#475569", lineHeight: 22, marginTop: 14 },
});
