import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    Modal,
    Alert,
    Pressable,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useState } from "react";

const PRIMARY = "#2D935C";

type PaymentMode = "WALLET" | "OFFLINE" | "ONLINE";

const PAYMENT_OPTIONS: { mode: PaymentMode; label: string; desc: string; icon: string; iconLib: "Ionicons" | "MaterialCommunityIcons" | "FontAwesome5"; color: string; bg: string }[] = [
    {
        mode: "WALLET",
        label: "Wallet",
        desc: "Pay using A1Care wallet balance",
        icon: "wallet-outline",
        iconLib: "Ionicons",
        color: "#6366F1",
        bg: "#EEF2FF",
    },
    {
        mode: "OFFLINE",
        label: "Cash",
        desc: "Pay cash on service delivery",
        icon: "cash-outline",
        iconLib: "Ionicons",
        color: "#059669",
        bg: "#ECFDF5",
    },
    {
        mode: "ONLINE",
        label: "Online",
        desc: "Pay via UPI / Card / Net Banking",
        icon: "phone-portrait-outline",
        iconLib: "Ionicons",
        color: "#0EA5E9",
        bg: "#EFF6FF",
    },
];

function PaymentIcon({ opt }: { opt: typeof PAYMENT_OPTIONS[0] }) {
    if (opt.iconLib === "Ionicons")
        return <Ionicons name={opt.icon as any} size={22} color={opt.color} />;
    if (opt.iconLib === "FontAwesome5")
        return <FontAwesome5 name={opt.icon as any} size={20} color={opt.color} />;
    return <MaterialCommunityIcons name={opt.icon as any} size={22} color={opt.color} />;
}

export default function PackageDetailScreen() {
    const router = useRouter();
    const qc = useQueryClient();
    const { id } = useLocalSearchParams<{ id: string }>();

    const [showPaymentSheet, setShowPaymentSheet] = useState(false);
    const [selectedMode, setSelectedMode] = useState<PaymentMode>("OFFLINE");
    const [booked, setBooked] = useState(false);

    const { data: pkg, isLoading, isError, refetch } = useQuery({
        queryKey: ["package-detail", id],
        queryFn: async () => {
            const res = await api.get(`/health-packages/detail/${id}`);
            return res.data?.data;
        },
        enabled: !!id,
    });

    // Fetch wallet balance to validate
    const { data: walletData } = useQuery({
        queryKey: ["partner-wallet"],
        queryFn: async () => {
            const res = await api.get("/wallet/summary");
            return res.data?.data;
        },
    });

    const bookMutation = useMutation({
        mutationFn: async (mode: PaymentMode) => {
            const now = new Date();
            const end = new Date(now.getTime() + 30 * 60 * 1000);
            const res = await api.post("/service/booking", {
                healthPackageId: id,
                paymentMode: mode,
                bookingType: "SCHEDULED",
                fulfillmentMode: "HOME_VISIT",
                scheduledSlot: {
                    startTime: now.toISOString(),
                    endTime: end.toISOString(),
                },
            });
            return res.data?.data;
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["bookings"] });
            qc.invalidateQueries({ queryKey: ["partner-wallet"] });
            setShowPaymentSheet(false);
            setBooked(true);
        },
        onError: (err: any) => {
            setShowPaymentSheet(false);
            Alert.alert("Booking Failed", err?.response?.data?.message || "Something went wrong. Please try again.");
        },
    });

    const handleConfirmBooking = () => {
        if (selectedMode === "WALLET") {
            const balance = walletData?.balance ?? 0;
            if (balance < (pkg?.price ?? 0)) {
                Alert.alert(
                    "Insufficient Wallet Balance",
                    `Your wallet balance (₹${balance}) is less than the package price (₹${pkg?.price ?? 0}). Please choose another payment method or top up your wallet.`,
                    [{ text: "OK" }]
                );
                return;
            }
        }
        if (selectedMode === "ONLINE") {
            Alert.alert("Online Payment", "Online payment gateway is not available in the Partner App. Please choose Wallet or Cash.");
            return;
        }
        Alert.alert(
            "Confirm Booking",
            `Confirm booking for "${pkg?.name}" with ${selectedMode === "OFFLINE" ? "Cash" : selectedMode === "WALLET" ? "Wallet" : "Online"} payment of ₹${pkg?.price ?? 0}?`,
            [
                { text: "Cancel", style: "cancel" },
                { text: "Confirm", onPress: () => bookMutation.mutate(selectedMode) },
            ]
        );
    };

    // ── Loading ──
    if (isLoading) {
        return <SafeAreaView style={styles.center}><ActivityIndicator size="large" color={PRIMARY} /></SafeAreaView>;
    }

    // ── Error ──
    if (isError || !pkg) {
        return (
            <SafeAreaView style={styles.center}>
                <MaterialCommunityIcons name="alert-circle-outline" size={48} color="#CBD5E1" />
                <Text style={styles.errText}>Could not load this package.</Text>
                <TouchableOpacity style={styles.retryBtn} onPress={() => refetch()}>
                    <Text style={styles.retryText}>Retry</Text>
                </TouchableOpacity>
            </SafeAreaView>
        );
    }

    // ── Success ──
    if (booked) {
        return (
            <SafeAreaView style={styles.successRoot}>
                <View style={styles.successBox}>
                    <View style={styles.successIconCircle}>
                        <Ionicons name="checkmark" size={52} color="#fff" />
                    </View>
                    <Text style={styles.successTitle}>Booking Placed!</Text>
                    <Text style={styles.successSub}>
                        Your health package booking has been placed successfully. The request will be assigned shortly.
                    </Text>
                    <TouchableOpacity style={styles.successBtn} onPress={() => router.replace("/(tabs)/bookings" as any)}>
                        <Text style={styles.successBtnText}>View My Bookings</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.successSecondary} onPress={() => router.back()}>
                        <Text style={styles.successSecondaryText}>Back to Packages</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    const tests: string[] = Array.isArray(pkg.testsIncluded) ? pkg.testsIncluded : [];
    const hasDiscount = pkg.originalPrice && pkg.originalPrice > pkg.price;
    const discountPct = hasDiscount ? Math.round(((pkg.originalPrice - pkg.price) / pkg.originalPrice) * 100) : 0;

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.headerBar}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color="#1E293B" />
                </TouchableOpacity>
                <Text style={styles.headerTitle} numberOfLines={1}>Package Details</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
                {/* Hero Card */}
                <View style={[styles.heroCard, { backgroundColor: pkg.color || "#2F80ED" }]}>
                    {pkg.badge ? (
                        <View style={styles.heroBadge}>
                            <Text style={styles.heroBadgeText}>{pkg.badge}</Text>
                        </View>
                    ) : null}
                    <Text style={styles.heroName}>{pkg.name}</Text>
                    <View style={styles.heroPriceRow}>
                        <Text style={styles.heroPrice}>₹{pkg.price ?? 0}</Text>
                        {hasDiscount ? <Text style={styles.heroOriginal}>₹{pkg.originalPrice}</Text> : null}
                        {hasDiscount ? (
                            <View style={styles.offTag}><Text style={styles.offText}>{discountPct}% OFF</Text></View>
                        ) : null}
                    </View>
                    <View style={styles.heroFooter}>
                        <View style={styles.heroStat}>
                            <Ionicons name="flask-outline" size={16} color="rgba(255,255,255,0.9)" />
                            <Text style={styles.heroStatText}>{tests.length} Tests</Text>
                        </View>
                        {pkg.validityDays ? (
                            <>
                                <View style={styles.heroStatDivider} />
                                <View style={styles.heroStat}>
                                    <Ionicons name="time-outline" size={16} color="rgba(255,255,255,0.9)" />
                                    <Text style={styles.heroStatText}>{pkg.validityDays} Days Validity</Text>
                                </View>
                            </>
                        ) : null}
                    </View>
                </View>

                <View style={styles.body}>
                    {/* Description */}
                    <Text style={styles.sectionTitle}>About this Package</Text>
                    <Text style={styles.description}>{pkg.description || "No description available."}</Text>

                    {/* Tests */}
                    {tests.length > 0 ? (
                        <>
                            <Text style={styles.sectionTitle}>Tests Included ({tests.length})</Text>
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

                    {/* Home Collection Notice */}
                    <View style={styles.noticeCard}>
                        <View style={[styles.noticeIconBox, { backgroundColor: "#ECFDF5" }]}>
                            <MaterialCommunityIcons name="home-map-marker" size={22} color={PRIMARY} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.noticeTitle}>Home Sample Collection</Text>
                            <Text style={styles.noticeDesc}>Our certified phlebotomist will visit your home to collect samples.</Text>
                        </View>
                    </View>

                    {/* Spacer for footer */}
                    <View style={{ height: 24 }} />
                </View>
            </ScrollView>

            {/* Sticky Footer */}
            <View style={styles.footer}>
                <View>
                    <Text style={styles.footerLabel}>Total Amount</Text>
                    <Text style={styles.footerPrice}>₹{pkg.price ?? 0}</Text>
                </View>
                <TouchableOpacity
                    style={styles.bookBtn}
                    activeOpacity={0.85}
                    onPress={() => setShowPaymentSheet(true)}
                >
                    <Text style={styles.bookBtnText}>Book Now</Text>
                </TouchableOpacity>
            </View>

            {/* Payment Mode Bottom Sheet */}
            <Modal
                visible={showPaymentSheet}
                animationType="slide"
                transparent
                onRequestClose={() => setShowPaymentSheet(false)}
            >
                <Pressable style={styles.sheetOverlay} onPress={() => setShowPaymentSheet(false)}>
                    <Pressable style={styles.sheetContainer} onPress={e => e.stopPropagation()}>
                        <View style={styles.sheetHandle} />
                        <Text style={styles.sheetTitle}>Choose Payment Method</Text>
                        <Text style={styles.sheetSub}>Select how you'd like to pay for this package</Text>

                        {/* Wallet Balance Chip */}
                        <View style={styles.walletChip}>
                            <Ionicons name="wallet-outline" size={16} color="#6366F1" />
                            <Text style={styles.walletChipText}>Wallet Balance: ₹{walletData?.balance ?? 0}</Text>
                        </View>

                        <View style={styles.paymentList}>
                            {PAYMENT_OPTIONS.map((opt) => {
                                const isSelected = selectedMode === opt.mode;
                                return (
                                    <TouchableOpacity
                                        key={opt.mode}
                                        style={[styles.paymentOption, isSelected && styles.paymentOptionSelected]}
                                        activeOpacity={0.8}
                                        onPress={() => setSelectedMode(opt.mode)}
                                    >
                                        <View style={[styles.paymentIconBox, { backgroundColor: opt.bg }]}>
                                            <PaymentIcon opt={opt} />
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={[styles.paymentLabel, isSelected && { color: PRIMARY }]}>{opt.label}</Text>
                                            <Text style={styles.paymentDesc}>{opt.desc}</Text>
                                        </View>
                                        <View style={[styles.radioOuter, isSelected && styles.radioOuterSelected]}>
                                            {isSelected && <View style={styles.radioInner} />}
                                        </View>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>

                        <View style={styles.sheetSummary}>
                            <Text style={styles.sheetSummaryLabel}>Package Total</Text>
                            <Text style={styles.sheetSummaryValue}>₹{pkg.price ?? 0}</Text>
                        </View>

                        <TouchableOpacity
                            style={[styles.confirmBtn, bookMutation.isPending && { opacity: 0.6 }]}
                            activeOpacity={0.85}
                            onPress={handleConfirmBooking}
                            disabled={bookMutation.isPending}
                        >
                            {bookMutation.isPending ? (
                                <ActivityIndicator color="#fff" size="small" />
                            ) : (
                                <Text style={styles.confirmBtnText}>
                                    Confirm & Book — ₹{pkg.price ?? 0}
                                </Text>
                            )}
                        </TouchableOpacity>
                    </Pressable>
                </Pressable>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#F8FAFC" },
    center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#F8FAFC", gap: 14 },
    errText: { color: "#64748B", fontWeight: "700" },
    retryBtn: { paddingHorizontal: 24, paddingVertical: 12, backgroundColor: PRIMARY, borderRadius: 14 },
    retryText: { color: "#FFF", fontWeight: "800" },

    // Header
    headerBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 14, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#F1F5F9" },
    backBtn: { width: 40, height: 40, borderRadius: 10, backgroundColor: "#F8FAFC", justifyContent: "center", alignItems: "center" },
    headerTitle: { fontSize: 17, fontWeight: "900", color: "#1E293B" },

    // Scroll
    scroll: { paddingBottom: 20 },

    // Hero Card
    heroCard: { margin: 16, borderRadius: 20, padding: 24, gap: 10 },
    heroBadge: { alignSelf: "flex-start", backgroundColor: "rgba(255,255,255,0.25)", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
    heroBadgeText: { color: "#fff", fontSize: 10, fontWeight: "900", textTransform: "uppercase", letterSpacing: 0.8 },
    heroName: { fontSize: 24, fontWeight: "900", color: "#fff" },
    heroPriceRow: { flexDirection: "row", alignItems: "center", gap: 10 },
    heroPrice: { fontSize: 26, fontWeight: "900", color: "#fff" },
    heroOriginal: { fontSize: 15, color: "rgba(255,255,255,0.65)", textDecorationLine: "line-through", fontWeight: "700" },
    offTag: { backgroundColor: "#FEF3C7", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
    offText: { color: "#92400E", fontWeight: "900", fontSize: 11 },
    heroFooter: { flexDirection: "row", alignItems: "center", gap: 14, marginTop: 4, paddingTop: 12, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.2)" },
    heroStat: { flexDirection: "row", alignItems: "center", gap: 6 },
    heroStatText: { color: "rgba(255,255,255,0.9)", fontSize: 13, fontWeight: "700" },
    heroStatDivider: { width: 1, height: 16, backgroundColor: "rgba(255,255,255,0.3)" },

    // Body
    body: { paddingHorizontal: 16, gap: 10 },
    sectionTitle: { fontSize: 12, fontWeight: "900", color: "#94A3B8", textTransform: "uppercase", letterSpacing: 0.6, marginTop: 8 },
    description: { fontSize: 14, color: "#475569", lineHeight: 22 },
    testList: { gap: 8 },
    testItem: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#fff", padding: 14, borderRadius: 12, borderWidth: 1, borderColor: "#F1F5F9" },
    testText: { flex: 1, fontSize: 13, color: "#334155", fontWeight: "700" },

    // Notice
    noticeCard: { flexDirection: "row", alignItems: "flex-start", gap: 12, backgroundColor: "#fff", borderRadius: 14, padding: 14, borderWidth: 1, borderColor: "#E7FFF4", marginTop: 6 },
    noticeIconBox: { width: 44, height: 44, borderRadius: 12, justifyContent: "center", alignItems: "center" },
    noticeTitle: { fontSize: 13, fontWeight: "800", color: "#1E293B" },
    noticeDesc: { fontSize: 12, color: "#64748B", marginTop: 2, lineHeight: 18 },

    // Footer
    footer: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 14, backgroundColor: "#fff", borderTopWidth: 1, borderTopColor: "#F1F5F9" },
    footerLabel: { fontSize: 11, color: "#94A3B8", fontWeight: "600" },
    footerPrice: { fontSize: 20, fontWeight: "900", color: PRIMARY, marginTop: 2 },
    bookBtn: { backgroundColor: "#1E293B", paddingHorizontal: 32, paddingVertical: 14, borderRadius: 14 },
    bookBtnText: { color: "#fff", fontSize: 15, fontWeight: "900", letterSpacing: 0.3 },

    // Payment Sheet
    sheetOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
    sheetContainer: { backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 12, paddingHorizontal: 20, paddingBottom: 36 },
    sheetHandle: { width: 40, height: 4, backgroundColor: "#E2E8F0", borderRadius: 2, alignSelf: "center", marginBottom: 20 },
    sheetTitle: { fontSize: 18, fontWeight: "900", color: "#1E293B", textAlign: "center" },
    sheetSub: { fontSize: 12, color: "#94A3B8", textAlign: "center", marginTop: 4, marginBottom: 16 },

    walletChip: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#EEF2FF", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, alignSelf: "center", marginBottom: 16 },
    walletChipText: { color: "#4F46E5", fontSize: 13, fontWeight: "700" },

    paymentList: { gap: 10 },
    paymentOption: { flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: "#F8FAFC", borderRadius: 14, padding: 14, borderWidth: 1.5, borderColor: "#F1F5F9" },
    paymentOptionSelected: { borderColor: PRIMARY, backgroundColor: "#ECFDF5" },
    paymentIconBox: { width: 44, height: 44, borderRadius: 12, justifyContent: "center", alignItems: "center" },
    paymentLabel: { fontSize: 15, fontWeight: "800", color: "#1E293B" },
    paymentDesc: { fontSize: 12, color: "#64748B", marginTop: 2 },
    radioOuter: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: "#CBD5E1", justifyContent: "center", alignItems: "center" },
    radioOuterSelected: { borderColor: PRIMARY },
    radioInner: { width: 12, height: 12, borderRadius: 6, backgroundColor: PRIMARY },

    sheetSummary: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 16, marginTop: 8, borderTopWidth: 1, borderTopColor: "#F1F5F9" },
    sheetSummaryLabel: { fontSize: 13, color: "#64748B", fontWeight: "700" },
    sheetSummaryValue: { fontSize: 18, fontWeight: "900", color: "#1E293B" },

    confirmBtn: { backgroundColor: PRIMARY, paddingVertical: 16, borderRadius: 16, alignItems: "center" },
    confirmBtnText: { color: "#fff", fontSize: 15, fontWeight: "900", letterSpacing: 0.3 },

    // Success
    successRoot: { flex: 1, backgroundColor: "#F8FAFC", justifyContent: "center", alignItems: "center", padding: 24 },
    successBox: { alignItems: "center", gap: 14, maxWidth: 340 },
    successIconCircle: { width: 96, height: 96, borderRadius: 48, backgroundColor: PRIMARY, justifyContent: "center", alignItems: "center", marginBottom: 8 },
    successTitle: { fontSize: 24, fontWeight: "900", color: "#1E293B", textAlign: "center" },
    successSub: { fontSize: 14, color: "#64748B", textAlign: "center", lineHeight: 22 },
    successBtn: { backgroundColor: PRIMARY, paddingHorizontal: 36, paddingVertical: 14, borderRadius: 14, marginTop: 8 },
    successBtnText: { color: "#fff", fontSize: 15, fontWeight: "900" },
    successSecondary: { paddingVertical: 10 },
    successSecondaryText: { color: "#94A3B8", fontSize: 14, fontWeight: "700" },
});
