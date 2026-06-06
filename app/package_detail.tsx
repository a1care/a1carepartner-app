import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";

const PRIMARY = "#2D935C";

export default function PackageDetailScreen() {
    const router = useRouter();
    const { id } = useLocalSearchParams<{ id: string }>();

    const { data: pkg, isLoading, isError, refetch } = useQuery({
        queryKey: ["package-detail", id],
        queryFn: async () => {
            const res = await api.get(`/health-packages/detail/${id}`);
            return res.data?.data;
        },
        enabled: !!id,
    });

    if (isLoading) {
        return <SafeAreaView style={styles.center}><ActivityIndicator size="large" color={PRIMARY} /></SafeAreaView>;
    }
    if (isError || !pkg) {
        return (
            <SafeAreaView style={styles.center}>
                <MaterialCommunityIcons name="alert-circle-outline" size={48} color="#CBD5E1" />
                <Text style={styles.errText}>Could not load this package.</Text>
                <TouchableOpacity style={styles.retryBtn} onPress={() => refetch()}><Text style={styles.retryText}>Retry</Text></TouchableOpacity>
            </SafeAreaView>
        );
    }

    const tests: string[] = Array.isArray(pkg.testsIncluded) ? pkg.testsIncluded : [];
    const hasDiscount = pkg.originalPrice && pkg.originalPrice > pkg.price;
    const discountPct = hasDiscount ? Math.round(((pkg.originalPrice - pkg.price) / pkg.originalPrice) * 100) : 0;

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.headerBar}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color="#1E293B" />
                </TouchableOpacity>
                <Text style={styles.headerTitle} numberOfLines={1}>Health Package</Text>
            </View>

            <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
                {pkg.imageUrl ? (
                    <Image source={{ uri: pkg.imageUrl }} style={styles.banner} />
                ) : (
                    <View style={[styles.banner, { backgroundColor: pkg.color || "#EFF6FF", justifyContent: "center", alignItems: "center" }]}>
                        <MaterialCommunityIcons name="clipboard-pulse-outline" size={48} color="#FFF" />
                    </View>
                )}

                <View style={styles.body}>
                    {pkg.badge ? (
                        <View style={[styles.badge, { backgroundColor: (pkg.color || PRIMARY) + "22" }]}>
                            <Text style={[styles.badgeText, { color: pkg.color || PRIMARY }]}>{pkg.badge}</Text>
                        </View>
                    ) : null}

                    <Text style={styles.name}>{pkg.name}</Text>

                    <View style={styles.priceRow}>
                        <Text style={styles.price}>₹{pkg.price ?? 0}</Text>
                        {hasDiscount ? <Text style={styles.original}>₹{pkg.originalPrice}</Text> : null}
                        {hasDiscount ? (
                            <View style={styles.offTag}><Text style={styles.offText}>{discountPct}% OFF</Text></View>
                        ) : null}
                    </View>

                    {pkg.validityDays ? (
                        <View style={styles.validityRow}>
                            <Ionicons name="time-outline" size={16} color="#64748B" />
                            <Text style={styles.validityText}>Valid for {pkg.validityDays} days</Text>
                        </View>
                    ) : null}

                    <Text style={styles.sectionTitle}>About this package</Text>
                    <Text style={styles.description}>{pkg.description || "No description available."}</Text>

                    {tests.length > 0 ? (
                        <>
                            <Text style={styles.sectionTitle}>Tests included ({tests.length})</Text>
                            <View style={styles.testList}>
                                {tests.map((t, i) => (
                                    <View key={i} style={styles.testItem}>
                                        <MaterialCommunityIcons name="check-circle" size={18} color={PRIMARY} />
                                        <Text style={styles.testText}>{t}</Text>
                                    </View>
                                ))}
                            </View>
                        </>
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
    banner: { width: "100%", height: 200 },
    body: { padding: 24, gap: 12 },
    badge: { alignSelf: "flex-start", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
    badgeText: { fontSize: 11, fontWeight: "900", textTransform: "uppercase", letterSpacing: 0.5 },
    name: { fontSize: 26, fontWeight: "900", color: "#1E293B" },
    priceRow: { flexDirection: "row", alignItems: "center", gap: 12 },
    price: { fontSize: 24, fontWeight: "900", color: "#047857" },
    original: { fontSize: 16, color: "#94A3B8", textDecorationLine: "line-through", fontWeight: "700" },
    offTag: { backgroundColor: "#FEE2E2", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
    offText: { color: "#B91C1C", fontWeight: "900", fontSize: 12 },
    validityRow: { flexDirection: "row", alignItems: "center", gap: 6 },
    validityText: { fontSize: 13, color: "#64748B", fontWeight: "700" },
    sectionTitle: { fontSize: 13, fontWeight: "900", color: "#94A3B8", textTransform: "uppercase", letterSpacing: 0.5, marginTop: 10 },
    description: { fontSize: 15, color: "#475569", lineHeight: 24 },
    testList: { gap: 10, marginTop: 4 },
    testItem: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#F8FAFC", padding: 14, borderRadius: 14 },
    testText: { flex: 1, fontSize: 14, color: "#334155", fontWeight: "700" },
});
