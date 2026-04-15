import { View, Text, StyleSheet, ScrollView, TouchableOpacity, BackHandler } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect } from "react";

import { useConfigStore } from "../stores/config.store";

export default function PrivacyPolicyScreen() {
    const router = useRouter();
    const { config } = useConfigStore();

    useEffect(() => {
        const backAction = () => {
            router.navigate("/(tabs)/profile" as any);
            return true;
        };
        const backHandler = BackHandler.addEventListener("hardwareBackPress", backAction);
        return () => backHandler.remove();
    }, []);

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.navigate("/(tabs)/profile" as any)} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color="#1E293B" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Privacy Policy</Text>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                <View style={styles.card}>
                    <Text style={styles.lastUpdate}>Last Updated: February 2026</Text>

                    {config?.contact.privacyPolicy ? (
                        <Text style={styles.paragraph}>{config.contact.privacyPolicy}</Text>
                    ) : (
                        <>
                            <Text style={styles.sectionTitle}>1. Introduction</Text>
                            <Text style={styles.paragraph}>
                                At A1Care, your privacy is our priority. This Privacy Policy explains how we collect, use, and protect your information when you use our Partner Application.
                            </Text>

                            <Text style={styles.sectionTitle}>2. Information We Collect</Text>
                            <Text style={styles.paragraph}>
                                • Profile Data: Name, mobile number, gender, and profile picture. {"\n"}
                                • Professional Data: Medical licenses, degrees, and specialization details. {"\n"}
                                • Financial Data: Bank details and transaction history in your A1Care wallet. {"\n"}
                                • Location Data: Real-time location to match you with nearby patients.
                            </Text>

                            <Text style={styles.sectionTitle}>3. How We Use Data</Text>
                            <Text style={styles.paragraph}>
                                We use your data to facilitate bookings, verify your professional identity, process your earnings, and improve the overall service matching efficiency.
                            </Text>

                            <Text style={styles.sectionTitle}>4. Data Sharing</Text>
                            <Text style={styles.paragraph}>
                                Your professional name and photo are shared with patients who book your services. We do not sell your personal data to third parties for marketing.
                            </Text>

                            <Text style={styles.sectionTitle}>5. Security</Text>
                            <Text style={styles.paragraph}>
                                We implement industry-standard encryption to protect your sensitive data, including medical licenses and financial information.
                            </Text>
                        </>
                    )}

                    <TouchableOpacity style={styles.supportLink} onPress={() => router.push("/raise_ticket")}>
                        <Text style={styles.supportText}>Questions? Contact Privacy Team</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#F8FAFC" },
    header: { flexDirection: "row", alignItems: "center", padding: 20, backgroundColor: "#FFF", borderBottomWidth: 1, borderBottomColor: "#F1F5F9" },
    backButton: { marginRight: 15 },
    headerTitle: { fontSize: 20, fontWeight: "900", color: "#1E293B" },
    scrollContent: { padding: 20 },
    card: { backgroundColor: "#FFF", padding: 25, borderRadius: 28, borderWidth: 1, borderColor: "#F1F5F9", elevation: 2, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 10 },
    lastUpdate: { fontSize: 13, color: "#94A3B8", fontWeight: "700", marginBottom: 20 },
    sectionTitle: { fontSize: 17, fontWeight: "900", color: "#1E293C", marginTop: 20, marginBottom: 10 },
    paragraph: { fontSize: 15, lineHeight: 24, color: "#475569", marginBottom: 15 },
    supportLink: { marginTop: 30, padding: 15, backgroundColor: "#F1F5F9", borderRadius: 15, alignItems: 'center' },
    supportText: { color: "#2D935C", fontWeight: "800", fontSize: 14 }
});
