import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../lib/api";
import { useAuthStore } from "../../stores/auth";
import { Toast } from "../../components/CustomToast";
import { missingRequiredDocuments, needsKycUpload, roleFromPartner } from "../../lib/partnerOnboarding";

const ReviewStatusScreen = () => {
    const router = useRouter();
    const { user, token, setAuth } = useAuthStore() as any;
    const [loading, setLoading] = React.useState(false);

    React.useEffect(() => {
        if (user && needsKycUpload(user, user?.role)) {
            router.replace({
                pathname: "/(auth)/register",
                params: { role: roleFromPartner(user, user?.role), token }
            } as any);
        }
    }, [user?._id, user?.documents, user?.role, token]);

    const handleCheckUpdate = async () => {
        setLoading(true);
        try {
            const res = await api.get("/doctor/auth/details");
            const staff = res.data.data;
            const partnerRole = roleFromPartner(staff, user?.role);
            await setAuth(token || "", { ...staff, role: partnerRole });

            if (needsKycUpload(staff, partnerRole)) {
                Toast.show({ type: 'info', text1: 'Documents Required', text2: 'Please upload your missing KYC documents.' });
                router.replace({
                    pathname: "/(auth)/register",
                    params: { role: partnerRole, token }
                } as any);
                return;
            }
            
            if (staff.status === "Active") {
                Toast.show({ type: 'success', text1: 'Verified!', text2: 'Welcome to A1Care' });
                router.replace("/(tabs)/home");
            } else {
                Toast.show({ type: 'info', text1: 'Still Under Review', text2: 'Our team is reviewing your profile.' });
            }
        } catch (err: any) {
            console.error("Status update error:", err);
            Toast.show({ type: 'error', text1: 'Error', text2: 'Could not connect to server' });
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = async () => {
        await useAuthStore.getState().logout();
        router.replace("/(auth)/role-select");
    };

    const missingDocs = missingRequiredDocuments(user, user?.role);
    const hasMissingDocs = missingDocs.length > 0;

    return (
        <View style={styles.container}>
            <LinearGradient colors={["#C8E6F9", "#EBF5FB", "#FFFFFF"]} style={StyleSheet.absoluteFill} />
            
            <View style={styles.content}>
                <View style={styles.iconWrapper}>
                    <LinearGradient colors={["#ECFDF5", "#D1FAE5"]} style={styles.iconBg} />
                    <Ionicons name="shield-checkmark" size={64} color="#10B981" />
                </View>

                <Text style={styles.title}>Account Under Review</Text>
                <Text style={styles.desc}>
                    We are currently verifying your credentials and documentation. 
                    This process usually takes <Text style={{fontWeight:'800', color:'#1A7FD4'}}>24-48 hours</Text>.
                </Text>

                <View style={styles.stepsBox}>
                    <View style={styles.step}>
                        <View style={[styles.stepDot, styles.stepActive]}>
                            <Ionicons name="checkmark" size={14} color="#FFF" />
                        </View>
                        <View style={styles.stepLine} />
                        <Text style={styles.stepText}>{hasMissingDocs ? "Documents Required" : "Documents Submitted"}</Text>
                    </View>

                    <View style={styles.step}>
                        <View style={[styles.stepDot, styles.stepCurrent]}>
                            <ActivityIndicator size="small" color="#FFF" />
                        </View>
                        <View style={[styles.stepLine, { backgroundColor: "#D1D5DB" }]} />
                        <Text style={[styles.stepText, { color: "#1A7FD4" }]}>{hasMissingDocs ? "Upload Pending" : "Admin Reviewing"}</Text>
                    </View>

                    <View style={styles.step}>
                        <View style={[styles.stepDot, styles.stepInactive]} />
                        <Text style={[styles.stepText, { opacity: 0.5 }]}>Go Live & Earn</Text>
                    </View>
                </View>

                <TouchableOpacity style={styles.button} onPress={handleCheckUpdate} disabled={loading} activeOpacity={0.8}>
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

                <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
                    <Text style={styles.logoutText}>Logout</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
};

export default ReviewStatusScreen;

const styles = StyleSheet.create({
    container: { flex: 1, justifyContent: "center", padding: 30 },
    content: { alignItems: "center", gap: 10 },
    iconWrapper: {
        width: 120, height: 120, borderRadius: 40,
        justifyContent: "center", alignItems: "center",
        marginBottom: 20, overflow: 'hidden'
    },
    iconBg: { ...StyleSheet.absoluteFillObject },
    title: { fontSize: 26, fontWeight: "900", color: "#1E293B", textAlign: "center" },
    desc: { 
        fontSize: 15, color: "#64748B", textAlign: "center", 
        lineHeight: 22, paddingHorizontal: 15, marginBottom: 30 
    },
    stepsBox: { width: "100%", paddingHorizontal: 20, gap: 0, marginBottom: 40 },
    step: { flexDirection: "row", alignItems: "center", height: 50, gap: 15 },
    stepDot: { width: 30, height: 30, borderRadius: 15, justifyContent: "center", alignItems: "center", zIndex: 2 },
    stepActive: { backgroundColor: "#10B981" },
    stepCurrent: { backgroundColor: "#1A7FD4" },
    stepInactive: { backgroundColor: "#FFF", borderWidth: 2, borderColor: "#CBD5E1" },
    stepLine: { position: "absolute", left: 14, top: 30, width: 2, height: 20, backgroundColor: "#10B981" },
    stepText: { fontSize: 16, fontWeight: "700", color: "#1E293B" },
    button: { width: "100%", height: 60, borderRadius: 20, overflow: "hidden", elevation: 4 },
    gradientBtn: { flex: 1, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 10 },
    buttonText: { fontSize: 16, fontWeight: "800", color: "#FFF" },
    logoutBtn: { marginTop: 20, padding: 10 },
    logoutText: { color: "#EA4335", fontWeight: "700", fontSize: 15 }
});
