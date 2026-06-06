import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialCommunityIcons } from "@expo/vector-icons";

const PRIMARY = "#2D935C";

type StatusKey = "success" | "failure" | "pending";

const CONFIG: Record<StatusKey, { colors: [string, string]; icon: any; iconColor: string; title: string; message: string }> = {
    success: {
        colors: ["#ECFDF5", "#D1FAE5"],
        icon: "check-decagram",
        iconColor: PRIMARY,
        title: "Payment Successful",
        message: "Your transaction is complete and your subscription is now active.",
    },
    failure: {
        colors: ["#FEF2F2", "#FEE2E2"],
        icon: "close-circle",
        iconColor: "#EF4444",
        title: "Payment Failed",
        message: "We couldn't complete your transaction. No amount was charged. Please try again.",
    },
    pending: {
        colors: ["#FFFBEB", "#FEF3C7"],
        icon: "clock-outline",
        iconColor: "#D97706",
        title: "Payment Pending",
        message: "Your payment is being processed. We'll update your subscription once it's confirmed.",
    },
};

export default function CheckoutStatusScreen() {
    const router = useRouter();
    const { status, context } = useLocalSearchParams<{ status?: string; context?: string }>();
    const key: StatusKey = (status === "success" || status === "failure" || status === "pending") ? status : "pending";
    const cfg = CONFIG[key];
    const isSubscription = context === "subscription";

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.content}>
                <LinearGradient colors={cfg.colors} style={styles.iconBox}>
                    <MaterialCommunityIcons name={cfg.icon} size={76} color={cfg.iconColor} />
                </LinearGradient>
                <Text style={styles.title}>{cfg.title}</Text>
                <Text style={styles.message}>{cfg.message}</Text>
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
                    <TouchableOpacity style={styles.primaryBtn} onPress={() => router.replace("/subscriptions" as any)}>
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
    container: { flex: 1, backgroundColor: "#FFFFFF", justifyContent: "space-between" },
    content: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32, gap: 16 },
    iconBox: { width: 150, height: 150, borderRadius: 75, justifyContent: "center", alignItems: "center", marginBottom: 10 },
    title: { fontSize: 28, fontWeight: "900", color: "#1E293B", textAlign: "center" },
    message: { fontSize: 15, color: "#64748B", textAlign: "center", lineHeight: 23, fontWeight: "500" },
    footer: { padding: 24, gap: 12 },
    primaryBtn: { height: 54, backgroundColor: PRIMARY, borderRadius: 16, justifyContent: "center", alignItems: "center" },
    primaryBtnText: { color: "#FFF", fontSize: 16, fontWeight: "800" },
    secondaryBtn: { height: 54, backgroundColor: "#F1F5F9", borderRadius: 16, justifyContent: "center", alignItems: "center" },
    secondaryBtnText: { color: "#475569", fontSize: 16, fontWeight: "800" },
});
