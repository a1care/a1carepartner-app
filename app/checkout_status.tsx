import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialCommunityIcons } from "@expo/vector-icons";

const PRIMARY = "#0B3370";
const SUCCESS_COLOR = "#059669";
const ERROR_COLOR = "#DC2626";
const PENDING_COLOR = "#D97706";

type StatusKey = "success" | "failure" | "pending";

const CONFIG: Record<StatusKey, { colors: [string, string]; icon: any; iconColor: string; title: string; message: string }> = {
    success: {
        colors: ["#F0FDF4", "#DCFCE7"],
        icon: "check-decagram",
        iconColor: SUCCESS_COLOR,
        title: "Payment Successful",
        message: "Your transaction is complete. Everything is ready to go.",
    },
    failure: {
        colors: ["#FEF2F2", "#FEE2E2"],
        icon: "close-circle",
        iconColor: ERROR_COLOR,
        title: "Payment Failed",
        message: "We couldn't complete your transaction. No amount was charged. Please try again.",
    },
    pending: {
        colors: ["#FFFBEB", "#FEF3C7"],
        icon: "clock-outline",
        iconColor: PENDING_COLOR,
        title: "Payment Pending",
        message: "Your payment is being processed. We'll notify you once it's confirmed.",
    },
};

export default function CheckoutStatusScreen() {
    const router = useRouter();
    const { status, context, type } = useLocalSearchParams<{ status?: string; context?: string; type?: string }>();
    const key: StatusKey = (status === "success" || status === "failure" || status === "pending") ? status : "pending";
    const cfg = CONFIG[key];
    const isSubscription = context === "subscription";
    const isWallet = type === "WALLET_TOPUP" || context === "wallet";

    const handleTryAgain = () => {
        if (isWallet) {
            router.replace("/wallet" as any);
        } else if (isSubscription) {
            router.replace("/subscriptions" as any);
        } else if (router.canGoBack()) {
            router.back();
        } else {
            router.replace("/(tabs)/home" as any);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.content}>
                <View style={styles.card}>
                    <LinearGradient colors={cfg.colors} style={styles.iconBox}>
                        <MaterialCommunityIcons name={cfg.icon} size={84} color={cfg.iconColor} />
                    </LinearGradient>
                    <Text style={styles.title}>{cfg.title}</Text>
                    <Text style={styles.message}>{cfg.message}</Text>
                </View>
            </View>

            <View style={styles.footer}>
                {key === "success" ? (
                    <TouchableOpacity
                        style={styles.primaryBtn}
                        onPress={() => router.replace(isSubscription ? "/subscriptions" : "/(tabs)/home" as any)}
                    >
                        <Text style={styles.primaryBtnText}>{isSubscription ? "View Subscription" : "Continue"}</Text>
                    </TouchableOpacity>
                ) : key === "failure" ? (
                    <TouchableOpacity style={styles.primaryBtn} onPress={handleTryAgain}>
                        <Text style={styles.primaryBtnText}>Try Again</Text>
                    </TouchableOpacity>
                ) : null}

                <TouchableOpacity style={styles.secondaryBtn} onPress={() => router.replace("/(tabs)/home" as any)}>
                    <Text style={styles.secondaryBtnText}>Back to Home</Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#F4F7FC", justifyContent: "space-between" },
    content: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24 },
    card: { 
        backgroundColor: '#FFFFFF', 
        borderRadius: 32, 
        paddingVertical: 48, 
        paddingHorizontal: 32, 
        alignItems: 'center', 
        width: '100%',
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.05,
        shadowRadius: 32,
        elevation: 8,
        borderWidth: 1.5,
        borderColor: '#E2E8F0'
    },
    iconBox: { width: 140, height: 140, borderRadius: 70, justifyContent: "center", alignItems: "center", marginBottom: 32 },
    title: { fontSize: 32, fontWeight: "900", color: "#0F172A", textAlign: "center", letterSpacing: -1, marginBottom: 12 },
    message: { fontSize: 16, color: "#64748B", textAlign: "center", lineHeight: 24, fontWeight: "600" },
    footer: { padding: 24, gap: 14, paddingBottom: 40 },
    primaryBtn: { height: 60, backgroundColor: PRIMARY, borderRadius: 20, justifyContent: "center", alignItems: "center", shadowColor: PRIMARY, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.25, shadowRadius: 16, elevation: 6 },
    primaryBtnText: { color: "#FFF", fontSize: 17, fontWeight: "900", letterSpacing: 0.5 },
    secondaryBtn: { height: 60, backgroundColor: "#F8FAFC", borderRadius: 20, justifyContent: "center", alignItems: "center", borderWidth: 1.5, borderColor: "#E2E8F0" },
    secondaryBtnText: { color: "#475569", fontSize: 17, fontWeight: "900", letterSpacing: 0.5 },
});
