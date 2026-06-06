import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";

const PRIMARY = "#2D935C";

export default function ServiceDetailScreen() {
    const router = useRouter();
    const params = useLocalSearchParams<{ serviceId?: string; id?: string }>();
    const id = params.serviceId || params.id;

    const { data: svc, isLoading, isError, refetch } = useQuery({
        queryKey: ["service-detail", id],
        queryFn: async () => {
            const res = await api.get(`/childService/detail/${id}`);
            return res.data?.data;
        },
        enabled: !!id,
    });

    if (isLoading) {
        return <SafeAreaView style={styles.center}><ActivityIndicator size="large" color={PRIMARY} /></SafeAreaView>;
    }
    if (isError || !svc) {
        return (
            <SafeAreaView style={styles.center}>
                <MaterialCommunityIcons name="alert-circle-outline" size={48} color="#CBD5E1" />
                <Text style={styles.errText}>Could not load this service.</Text>
                <TouchableOpacity style={styles.retryBtn} onPress={() => refetch()}><Text style={styles.retryText}>Retry</Text></TouchableOpacity>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.headerBar}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color="#1E293B" />
                </TouchableOpacity>
                <Text style={styles.headerTitle} numberOfLines={1}>Service Details</Text>
            </View>

            <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
                {svc.imageUrl ? (
                    <Image source={{ uri: svc.imageUrl }} style={styles.banner} />
                ) : (
                    <View style={[styles.banner, styles.bannerFallback]}>
                        <MaterialCommunityIcons name="medical-bag" size={48} color="#CBD5E1" />
                    </View>
                )}

                <View style={styles.body}>
                    <Text style={styles.name}>{svc.name}</Text>

                    <View style={styles.metaRow}>
                        <View style={styles.priceTag}>
                            <Text style={styles.priceText}>₹{svc.price ?? 0}</Text>
                        </View>
                        {svc.rating ? (
                            <View style={styles.ratingTag}>
                                <Ionicons name="star" size={14} color="#F59E0B" />
                                <Text style={styles.ratingText}>{Number(svc.rating).toFixed(1)}</Text>
                            </View>
                        ) : null}
                        {svc.fulfillmentMode ? (
                            <View style={styles.modeTag}>
                                <MaterialCommunityIcons name="map-marker-radius-outline" size={14} color={PRIMARY} />
                                <Text style={styles.modeText}>{String(svc.fulfillmentMode).replace(/_/g, " ")}</Text>
                            </View>
                        ) : null}
                    </View>

                    <Text style={styles.sectionTitle}>About this service</Text>
                    <Text style={styles.description}>{svc.description || "No description available for this service."}</Text>

                    {typeof svc.completed === "number" ? (
                        <View style={styles.statRow}>
                            <MaterialCommunityIcons name="check-decagram" size={18} color={PRIMARY} />
                            <Text style={styles.statText}>{svc.completed} completed bookings</Text>
                        </View>
                    ) : null}
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#FFFFFF" },
    center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#F8FAFC", gap: 14 },
    errText: { color: "#64748B", fontWeight: "700" },
    retryBtn: { paddingHorizontal: 24, paddingVertical: 12, backgroundColor: PRIMARY, borderRadius: 14 },
    retryText: { color: "#FFF", fontWeight: "800" },
    headerBar: { flexDirection: "row", alignItems: "center", padding: 16, gap: 12 },
    backBtn: { width: 40, height: 40, borderRadius: 10, backgroundColor: "#F8FAFC", justifyContent: "center", alignItems: "center" },
    headerTitle: { fontSize: 18, fontWeight: "900", color: "#1E293B" },
    scroll: { paddingBottom: 40 },
    banner: { width: "100%", height: 220 },
    bannerFallback: { backgroundColor: "#F1F5F9", justifyContent: "center", alignItems: "center" },
    body: { padding: 24, gap: 14 },
    name: { fontSize: 26, fontWeight: "900", color: "#1E293B" },
    metaRow: { flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap" },
    priceTag: { backgroundColor: "#ECFDF5", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12 },
    priceText: { color: "#047857", fontWeight: "900", fontSize: 16 },
    ratingTag: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#FFFBEB", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12 },
    ratingText: { color: "#B45309", fontWeight: "800", fontSize: 14 },
    modeTag: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#F0FDF4", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12 },
    modeText: { color: PRIMARY, fontWeight: "800", fontSize: 12, textTransform: "capitalize" },
    sectionTitle: { fontSize: 13, fontWeight: "900", color: "#94A3B8", textTransform: "uppercase", letterSpacing: 0.5, marginTop: 8 },
    description: { fontSize: 15, color: "#475569", lineHeight: 24 },
    statRow: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#F8FAFC", padding: 14, borderRadius: 14, marginTop: 6 },
    statText: { fontSize: 14, color: "#475569", fontWeight: "700" },
});
