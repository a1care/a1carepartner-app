import { View, Text, StyleSheet, ScrollView, TouchableOpacity, BackHandler, useWindowDimensions, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect } from "react";
import RenderHtml from "react-native-render-html";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";

export default function TermsConditionsScreen() {
    const router = useRouter();
    const { width } = useWindowDimensions();

    const { data: termsData, isLoading } = useQuery({
        queryKey: ["cms-terms", "PARTNER"],
        queryFn: async () => {
            const res = await api.get("/cms/public/PARTNER/TERMS");
            return res.data.data;
        }
    });

    useEffect(() => {
        const backAction = () => {
            router.navigate("/(tabs)/profile" as any);
            return true;
        };
        const backHandler = BackHandler.addEventListener("hardwareBackPress", backAction);
        return () => backHandler.remove();
    }, []);

    if (isLoading) {
        return (
            <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator size="large" color="#2D935C" />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.navigate("/(tabs)/profile" as any)} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color="#1E293B" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Terms & Conditions</Text>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                <View style={styles.card}>
                    <Text style={styles.lastUpdate}>Effective Date: February 21, 2026</Text>

                    <Text style={styles.intro}>By joining the A1Care Partner Program, you agree to the following professional terms and conditions.</Text>

                    {termsData?.content ? (
                        <RenderHtml contentWidth={width - 50} source={{ html: termsData.content }} tagsStyles={{ p: styles.paragraph, span: styles.paragraph, li: styles.paragraph }} />
                    ) : (
                        <>
                            <Text style={styles.sectionTitle}>1. Professional Responsibility</Text>
                            <Text style={styles.paragraph}>
                                All partners must maintain valid required medical licenses at all times. You agree to provide services with the highest standard of professional care and ethics.
                            </Text>

                            <Text style={styles.sectionTitle}>2. Service Fulfillment</Text>
                            <Text style={styles.paragraph}>
                                Accepting a booking creates a binding agreement to provide services. Failure to show up without valid notice may result in account suspension and service penalty fees.
                            </Text>

                            <Text style={styles.sectionTitle}>3. Payments & Commission</Text>
                            <Text style={styles.paragraph}>
                                A1Care charges a service fee for every successful booking. Net earnings (after commission) will be credited to your wallet. Payouts are processed to the bank account provided in your profile.
                            </Text>

                            <Text style={styles.sectionTitle}>4. Code of Conduct</Text>
                            <Text style={styles.paragraph}>
                                Respectful behavior towards patients is mandatory. A1Care has a zero-tolerance policy for harassment, overcharging patients, or providing unauthorized medical advice.
                            </Text>

                            <Text style={styles.sectionTitle}>5. Account Termination</Text>
                            <Text style={styles.paragraph}>
                                A1Care reserves the right to suspend or terminate accounts that fail to meet verification standards, receive multiple negative ratings, or violate these terms.
                            </Text>
                        </>
                    )}
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
    card: { backgroundColor: "#FFF", padding: 25, borderRadius: 28, borderWidth: 1, borderColor: "#F1F5F9", elevation: 2 },
    lastUpdate: { fontSize: 13, color: "#94A3B8", fontWeight: "700", marginBottom: 10 },
    intro: { fontSize: 15, fontWeight: "700", color: "#2D935C", marginBottom: 20, lineHeight: 22 },
    sectionTitle: { fontSize: 17, fontWeight: "900", color: "#1E293C", marginTop: 20, marginBottom: 10 },
    paragraph: { fontSize: 15, lineHeight: 24, color: "#475569", marginBottom: 15 },
    footer: { marginTop: 30, paddingTop: 20, borderTopWidth: 1, borderTopColor: "#F1F5F9" },
    footerText: { fontSize: 13, color: "#94A3B8", textAlign: 'center', fontStyle: 'italic' }
});
