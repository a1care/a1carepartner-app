import React from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, ActivityIndicator, Dimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useAuthStore } from "../stores/auth";

const { width } = Dimensions.get("window");

export default function ViewProfileScreen() {
    const router = useRouter();
    const { user } = useAuthStore() as any;

    const { data: staffData, isLoading } = useQuery({
        queryKey: ["profileDetailsView"],
        queryFn: async () => {
            const res = await api.get("/doctor/auth/details");
            return res.data.data;
        }
    });

    if (isLoading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#2D935C" />
            </View>
        );
    }

    const data = staffData || user;
    const roleLabel = data?.role?.name || data?.role || "Partner";

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color="#1E293B" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Public Profile</Text>
                <TouchableOpacity onPress={() => router.push("/profile_edit")} style={styles.editHeaderBtn}>
                    <Ionicons name="create-outline" size={22} color="#2D935C" />
                </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
                {/* Profile Header Card */}
                <View style={styles.profileHeaderCard}>
                    <LinearGradient colors={["#FFFFFF", "#F8FAFC"]} style={styles.cardGradient} />
                    <View style={styles.avatarWrapper}>
                        {data?.profileImage ? (
                            <Image source={{ uri: data.profileImage }} style={styles.avatar} />
                        ) : (
                            <View style={[styles.avatar, styles.avatarPlaceholder]}>
                                <Ionicons name="person" size={50} color="#CBD5E1" />
                            </View>
                        )}
                        <View style={styles.statusBadge}>
                            <View style={[styles.statusDot, { backgroundColor: data?.status === "Active" ? "#10B981" : "#94A3B8" }]} />
                            <Text style={styles.statusText}>{data?.status || "Pending"}</Text>
                        </View>
                    </View>

                    <Text style={styles.nameText}>{data?.name || "Member Name"}</Text>
                    <Text style={styles.roleText}>{roleLabel} • {data?.experience || 0} Years Exp.</Text>
                    
                    <View style={styles.ratingRow}>
                        <View style={styles.statItem}>
                            <Text style={styles.statValue}>{data?.rating?.toFixed(1) || "0.0"}</Text>
                            <Text style={styles.statLabel}>Rating</Text>
                        </View>
                        <View style={styles.statDivider} />
                        <View style={styles.statItem}>
                            <Text style={styles.statValue}>{data?.completed || 0}</Text>
                            <Text style={styles.statLabel}>Jobs</Text>
                        </View>
                    </View>
                </View>

                {/* About Section */}
                {data?.about && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>About Me</Text>
                        <Text style={styles.aboutText}>{data.about}</Text>
                    </View>
                )}

                {/* Specialties */}
                {data?.specialization && data.specialization.length > 0 && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Specializations</Text>
                        <View style={styles.specContainer}>
                            {data.specialization.map((spec: string, idx: number) => (
                                <View key={idx} style={styles.specChip}>
                                    <Text style={styles.specText}>{spec}</Text>
                                </View>
                            ))}
                        </View>
                    </View>
                )}

                {/* Quick Details Grid */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Service Details</Text>
                    <View style={styles.detailGrid}>
                        <DetailItem 
                            icon="time-outline" 
                            label="Working Hours" 
                            value={data?.workingHours || "Not Set"} 
                        />
                        <DetailItem 
                            icon="navigate-outline" 
                            label="Service Radius" 
                            value={`${data?.serviceRadius || 0} km`} 
                        />
                        <DetailItem 
                            icon="home-outline" 
                            label="Home Visit Fee" 
                            value={`₹${data?.homeConsultationFee || 0}`} 
                        />
                        <DetailItem 
                            icon="videocam-outline" 
                            label="Online Visit Fee" 
                            value={`₹${data?.onlineConsultationFee || 0}`} 
                        />
                    </View>
                </View>

                {/* Contact Info */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Contact Information</Text>
                    <View style={styles.contactCard}>
                        <View style={styles.contactItem}>
                            <Ionicons name="call-outline" size={20} color="#64748B" />
                            <Text style={styles.contactValue}>{data?.mobileNumber || "—"}</Text>
                        </View>
                        <View style={styles.contactDivider} />
                        <View style={styles.contactItem}>
                            <Ionicons name="mail-outline" size={20} color="#64748B" />
                            <Text style={styles.contactValue}>{data?.email || "—"}</Text>
                        </View>
                    </View>
                </View>

                <TouchableOpacity 
                    style={styles.editBtn} 
                    onPress={() => router.push("/profile_edit")}
                >
                    <LinearGradient colors={["#2D935C", "#1E6B43"]} style={styles.editBtnGradient}>
                        <Ionicons name="create" size={20} color="#FFF" />
                        <Text style={styles.editBtnText}>Edit Profile</Text>
                    </LinearGradient>
                </TouchableOpacity>

                <View style={{ height: 40 }} />
            </ScrollView>
        </SafeAreaView>
    );
}

function DetailItem({ icon, label, value }: { icon: any, label: string, value: string }) {
    return (
        <View style={styles.detailCard}>
            <View style={styles.detailIconBox}>
                <Ionicons name={icon} size={20} color="#2D935C" />
            </View>
            <View>
                <Text style={styles.detailLabelText}>{label}</Text>
                <Text style={styles.detailValueText}>{value}</Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#F8FAFC" },
    loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#F8FAFC" },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 15, backgroundColor: "#FFF" },
    backBtn: { padding: 8, borderRadius: 12, backgroundColor: "#F1F5F9" },
    headerTitle: { fontSize: 18, fontWeight: "800", color: "#1E293B" },
    editHeaderBtn: { padding: 8, borderRadius: 12, backgroundColor: "#ECFDF5" },
    scrollContent: { padding: 20 },
    profileHeaderCard: { padding: 24, borderRadius: 32, alignItems: "center", marginBottom: 25, elevation: 2, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 10, overflow: "hidden" },
    cardGradient: { ...StyleSheet.absoluteFillObject },
    avatarWrapper: { position: "relative", marginBottom: 16 },
    avatar: { width: 120, height: 120, borderRadius: 60, borderWidth: 4, borderColor: "#FFF" },
    avatarPlaceholder: { backgroundColor: "#F1F5F9", justifyContent: "center", alignItems: "center" },
    statusBadge: { position: "absolute", bottom: 0, alignSelf: "center", backgroundColor: "#FFF", flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, elevation: 3, gap: 6 },
    statusDot: { width: 8, height: 8, borderRadius: 4 },
    statusText: { fontSize: 11, fontWeight: "800", color: "#1E293B", textTransform: "uppercase" },
    nameText: { fontSize: 24, fontWeight: "900", color: "#1E293B", marginBottom: 4 },
    roleText: { fontSize: 14, color: "#64748B", fontWeight: "600", marginBottom: 20 },
    ratingRow: { flexDirection: "row", alignItems: "center", gap: 30 },
    statItem: { alignItems: "center" },
    statValue: { fontSize: 18, fontWeight: "900", color: "#1E293B" },
    statLabel: { fontSize: 12, color: "#94A3B8", fontWeight: "600" },
    statDivider: { width: 1, height: 30, backgroundColor: "#E2E8F0" },
    section: { marginBottom: 25 },
    sectionTitle: { fontSize: 16, fontWeight: "800", color: "#334155", marginBottom: 12, marginLeft: 4 },
    aboutText: { fontSize: 15, color: "#475569", lineHeight: 24, backgroundColor: "#FFF", padding: 16, borderRadius: 20, borderWidth: 1, borderColor: "#F1F5F9" },
    specContainer: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
    specChip: { backgroundColor: "#ECFDF5", paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: "#D1FAE5" },
    specText: { fontSize: 13, fontWeight: "700", color: "#065F46" },
    detailGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
    detailCard: { width: "48%", backgroundColor: "#FFF", borderRadius: 20, padding: 15, flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderColor: "#F1F5F9" },
    detailIconBox: { width: 36, height: 36, borderRadius: 10, backgroundColor: "#F0FDF4", justifyContent: "center", alignItems: "center" },
    detailLabelText: { fontSize: 10, color: "#94A3B8", fontWeight: "700", textTransform: "uppercase" },
    detailValueText: { fontSize: 13, fontWeight: "800", color: "#1E293B" },
    contactCard: { backgroundColor: "#FFF", borderRadius: 20, padding: 16, borderWidth: 1, borderColor: "#F1F5F9" },
    contactItem: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8 },
    contactValue: { fontSize: 15, fontWeight: "600", color: "#334155" },
    contactDivider: { height: 1, backgroundColor: "#F8FAFC", marginVertical: 4 },
    editBtn: { marginTop: 10, borderRadius: 20, overflow: "hidden", elevation: 4 },
    editBtnGradient: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 18, gap: 10 },
    editBtnText: { color: "#FFF", fontSize: 16, fontWeight: "800" },
});
