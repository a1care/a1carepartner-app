import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Animated, Easing } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { api } from "../../lib/api";
import { useAuthStore } from "../../stores/auth";
import { Toast } from "../../components/CustomToast";

const ReviewStatusScreen = () => {
    const router = useRouter();
    const { user, setAuth, logout } = useAuthStore() as any;
    const [loading, setLoading] = React.useState(false);
    const [staffData, setStaffData] = React.useState<any>(user || null);
    const pulseAnim = React.useRef(new Animated.Value(1)).current;

    const handleCheckUpdate = async () => {
        setLoading(true);
        try {
            const res = await api.get("/doctor/auth/details");
            const staff = res.data.data;
            setStaffData(staff);

            if (staff.status === "Active") {
                Toast.show({ type: "success", text1: "Verified!", text2: "Welcome to A1Care" });
                const authHeader = api.defaults.headers.Authorization;
                const token = typeof authHeader === "string" ? authHeader.replace("Bearer ", "") : "";
                await setAuth(token, { ...staff, role: user?.role });
                router.replace("/(tabs)/home");
            } else if (staff.status === "Rejected") {
                Toast.show({ type: "error", text1: "Rejected by Admin", text2: staff.rejectionReason || "Please correct details and re-upload." });
            } else {
                Toast.show({ type: "info", text1: "Still Under Review", text2: "Our team is reviewing your profile." });
            }
        } catch (err: any) {
            console.error("Status update error:", err);
            Toast.show({ type: "error", text1: "Error", text2: "Could not connect to server" });
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = async () => {
        try {
            await logout();
            delete (api.defaults.headers as any).Authorization;
        } finally {
            router.replace("/(auth)/role-select");
        }
    };

    const handleReupload = () => {
        router.replace({ pathname: "/(auth)/register", params: { role: staffData?.role || user?.role || "doctor" } });
    };

    const isRejected = staffData?.status === "Rejected";

    React.useEffect(() => {
        if (!isRejected) return;
        const loop = Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, { toValue: 1.08, duration: 850, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
                Animated.timing(pulseAnim, { toValue: 1, duration: 850, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
            ])
        );
        loop.start();
        return () => loop.stop();
    }, [isRejected, pulseAnim]);

    return (
        <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
        <View style={styles.container}>
            <LinearGradient colors={["#CDEBFF", "#EAF5FE", "#F8FBFF"]} style={StyleSheet.absoluteFill} />

            <View style={styles.content}>
                <Animated.View style={[styles.iconWrapper, isRejected && styles.iconWrapperRejected, isRejected && { transform: [{ scale: pulseAnim }] }]}>
                    <LinearGradient
                        colors={isRejected ? ["transparent", "transparent"] : ["#ECFDF5", "#D1FAE5"]}
                        style={styles.iconBg}
                    />
                    <Ionicons
                        name={isRejected ? "close-circle" : "shield-checkmark"}
                        size={62}
                        color={isRejected ? "#DC2626" : "#059669"}
                    />
                </Animated.View>

                <Text style={styles.title}>{isRejected ? "Rejected by Admin" : "Account Under Review"}</Text>
                <Text style={styles.desc}>
                    {isRejected
                        ? "Please update your details and documents, then submit again for review."
                        : <>We are verifying your credentials. This usually takes <Text style={styles.highlight}>24-48 hours</Text>.</>
                    }
                </Text>

                {isRejected && (
                    <View style={styles.reasonCard}>
                        <Text style={styles.reasonLabel}>Rejection Reason</Text>
                        <Text style={styles.reasonText}>{staffData?.rejectionReason || "Details/documents need correction."}</Text>
                    </View>
                )}

                <View style={styles.stepsBox}>
                    <View style={styles.step}>
                        <View style={[styles.stepDot, styles.stepActive]}>
                            <Ionicons name="checkmark" size={14} color="#FFF" />
                        </View>
                        <View style={styles.stepLine} />
                        <Text style={styles.stepText}>Documents Submitted</Text>
                    </View>

                    <View style={styles.step}>
                        <View style={[styles.stepDot, isRejected ? styles.stepRejected : styles.stepCurrent]}>
                            {isRejected ? <Ionicons name="close" size={14} color="#FFF" /> : <ActivityIndicator size="small" color="#FFF" />}
                        </View>
                        <View style={[styles.stepLine, { backgroundColor: "#D1D5DB" }]} />
                        <Text style={[styles.stepText, { color: isRejected ? "#DC2626" : "#1A7FD4" }]}>
                            {isRejected ? "Rejected by Admin" : "Admin Reviewing"}
                        </Text>
                    </View>

                    <View style={styles.step}>
                        <View style={[styles.stepDot, styles.stepInactive]} />
                        <Text style={[styles.stepText, { opacity: 0.55 }]}>Go Live & Earn</Text>
                    </View>
                </View>

                <TouchableOpacity style={styles.button} onPress={handleCheckUpdate} disabled={loading} activeOpacity={0.85}>
                    <LinearGradient colors={["#1A7FD4", "#0D5FA0"]} style={styles.gradientBtn}>
                        {loading ? (
                            <ActivityIndicator color="#FFF" />
                        ) : (
                            <>
                                <Ionicons name="refresh" size={20} color="#FFF" />
                                <Text style={styles.buttonText}>Check Status</Text>
                            </>
                        )}
                    </LinearGradient>
                </TouchableOpacity>

                {isRejected && (
                    <TouchableOpacity style={styles.button} onPress={handleReupload} activeOpacity={0.85}>
                        <LinearGradient colors={["#F97316", "#EA580C"]} style={styles.gradientBtn}>
                            <Ionicons name="cloud-upload-outline" size={20} color="#FFF" />
                            <Text style={styles.buttonText}>Re-upload Details</Text>
                        </LinearGradient>
                    </TouchableOpacity>
                )}

                <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
                    <Text style={styles.logoutText}>Logout</Text>
                </TouchableOpacity>
            </View>
        </View>
        </SafeAreaView>
    );
};

export default ReviewStatusScreen;

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: "#CDEBFF" },
    container: { flex: 1, justifyContent: "center", paddingHorizontal: 24, paddingTop: 16, paddingBottom: 20 },
    content: { alignItems: "center", gap: 8 },
    iconWrapper: {
        width: 122,
        height: 122,
        borderRadius: 34,
        justifyContent: "center",
        alignItems: "center",
        marginBottom: 10,
        overflow: "hidden",
    },
    iconWrapperRejected: {
        borderWidth: 0,
        borderColor: "transparent",
        backgroundColor: "transparent",
        marginTop: 4,
    },
    iconBg: { ...StyleSheet.absoluteFillObject },
    title: { fontSize: 24, fontWeight: "700", color: "#1E293B", textAlign: "center", letterSpacing: -0.2 },
    desc: { fontSize: 15, color: "#64748B", textAlign: "center", lineHeight: 22, paddingHorizontal: 10, marginBottom: 14 },
    highlight: { fontWeight: "600", color: "#1A7FD4" },
    reasonCard: {
        width: "100%",
        backgroundColor: "#FFF7ED",
        borderColor: "#FDBA74",
        borderWidth: 1,
        borderRadius: 16,
        padding: 14,
        marginBottom: 14,
    },
    reasonLabel: { fontSize: 11, fontWeight: "700", color: "#C2410C", textTransform: "uppercase", marginBottom: 5 },
    reasonText: { fontSize: 15, color: "#7C2D12", lineHeight: 21, fontWeight: "500" },
    stepsBox: {
        width: "100%",
        backgroundColor: "#FFFFFFEE",
        borderRadius: 18,
        borderWidth: 1,
        borderColor: "#E2E8F0",
        padding: 16,
        marginBottom: 18,
    },
    step: { flexDirection: "row", alignItems: "center", height: 46, gap: 14 },
    stepDot: { width: 30, height: 30, borderRadius: 15, justifyContent: "center", alignItems: "center", zIndex: 2 },
    stepActive: { backgroundColor: "#10B981" },
    stepCurrent: { backgroundColor: "#1A7FD4" },
    stepRejected: { backgroundColor: "#DC2626" },
    stepInactive: { backgroundColor: "#FFF", borderWidth: 2, borderColor: "#CBD5E1" },
    stepLine: { position: "absolute", left: 14, top: 30, width: 2, height: 20, backgroundColor: "#10B981" },
    stepText: { fontSize: 15, fontWeight: "600", color: "#1E293B" },
    button: { width: "100%", height: 58, borderRadius: 18, overflow: "hidden", elevation: 4, marginTop: 10 },
    gradientBtn: { flex: 1, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 10 },
    buttonText: { fontSize: 16, fontWeight: "700", color: "#FFF" },
    logoutBtn: { marginTop: 18, padding: 10 },
    logoutText: { color: "#EA4335", fontWeight: "600", fontSize: 16 },
});
