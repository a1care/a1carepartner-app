import { View, Text, StyleSheet, ScrollView, TouchableOpacity, BackHandler, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";

const FALLBACK_FAQS = [
    {
        question: "How do I receive service bookings?",
        answer: "Once your profile is verified and you are toggled 'Online', you will receive real-time notifications for bookings in your area matching your specialization."
    },
    {
        question: "When do I get paid for my services?",
        answer: "Earnings are credited to your A1Care wallet immediately after the booking is marked 'Completed' by both you and the patient. You can withdraw to your bank account weekly."
    }
];

export default function FAQScreen() {
    const router = useRouter();
    const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

    const { data: faqData, isLoading } = useQuery({
        queryKey: ["cms-faq", "PARTNER"],
        queryFn: async () => {
            const res = await api.get("/cms/public/PARTNER/FAQ");
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

    const faqItems = faqData?.faqs && faqData.faqs.length > 0 ? faqData.faqs : FALLBACK_FAQS;

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
                <Text style={styles.headerTitle}>Help & Support</Text>
                <View style={{ width: 24 }} />
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                <View style={styles.infoBox}>
                    <View style={styles.infoIconBg}>
                        <Ionicons name="help-circle" size={32} color="#2D935C" />
                    </View>
                    <Text style={styles.infoTitle}>How can we help you?</Text>
                    <Text style={styles.infoSub}>Search through our frequently asked questions below.</Text>
                </View>

                {faqItems.length > 0 ? (
                    faqItems.map((faq, index) => (
                        <TouchableOpacity
                            key={index}
                            style={[
                                styles.faqItem,
                                expandedIndex === index && styles.faqItemExpanded
                            ]}
                            activeOpacity={0.8}
                            onPress={() => setExpandedIndex(expandedIndex === index ? null : index)}
                        >
                            <View style={styles.questionRow}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 10 }}>
                                    <Text style={styles.qIndicator}>Q</Text>
                                    <Text style={styles.questionText}>{faq.question}</Text>
                                </View>
                                <Ionicons
                                    name={expandedIndex === index ? "chevron-up" : "chevron-down"}
                                    size={20}
                                    color={expandedIndex === index ? "#2D935C" : "#64748B"}
                                />
                            </View>
                            {expandedIndex === index && (
                                <View style={styles.answerBox}>
                                    <Text style={styles.answerText}>{faq.answer}</Text>
                                </View>
                            )}
                        </TouchableOpacity>
                    ))
                ) : null}

                <View style={[styles.card, { marginTop: 25, alignItems: 'center' }]}>
                    <Ionicons name="chatbubbles-outline" size={36} color="#2D935C" style={{ marginBottom: 8 }} />
                    <Text style={styles.stillHelp}>Still need help?</Text>
                    <Text style={{ color: '#64748B', fontSize: 13, marginTop: 4, textAlign: 'center' }}>
                        Our dedicated support team is available to assist you.
                    </Text>
                    <TouchableOpacity style={styles.contactBtn} onPress={() => router.push({ pathname: "/raise_ticket", params: { autoOpen: "true" } } as any)}>
                        <Text style={styles.contactBtnText}>Contact Support</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#F8FAFC" },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 15, backgroundColor: "#FFF", borderBottomWidth: 1, borderBottomColor: "#E2E8F0" },
    backButton: { padding: 5 },
    headerTitle: { fontSize: 18, fontWeight: "800", color: "#1E293B" },
    scrollContent: { padding: 20, paddingBottom: 40 },
    infoBox: { alignItems: 'center', marginBottom: 25, marginTop: 10 },
    infoIconBg: { width: 64, height: 64, borderRadius: 32, backgroundColor: "#E8F8EF", justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
    infoTitle: { fontSize: 20, fontWeight: '900', color: '#1E293B' },
    infoSub: { fontSize: 14, color: '#64748B', marginTop: 4, textAlign: 'center' },
    faqItem: { backgroundColor: "#FFF", padding: 18, borderRadius: 16, marginBottom: 12, borderWidth: 1.5, borderColor: "#F1F5F9", elevation: 1, shadowColor: "#000", shadowOpacity: 0.02, shadowOffset: { width: 0, height: 2 }, shadowRadius: 4 },
    faqItemExpanded: { borderColor: "#2D935C" },
    questionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    qIndicator: { width: 24, height: 24, borderRadius: 12, backgroundColor: "#E8F8EF", color: "#2D935C", textAlign: 'center', lineHeight: 24, fontWeight: "900", fontSize: 12 },
    questionText: { fontSize: 15, fontWeight: '800', color: '#1E293B', flex: 1 },
    answerBox: { marginTop: 15, padding: 14, backgroundColor: '#F8FAFC', borderRadius: 12, borderWidth: 1, borderColor: '#F1F5F9' },
    answerText: { fontSize: 14, color: '#475569', lineHeight: 22, fontWeight: "600" },
    card: { backgroundColor: "#FFF", padding: 20, borderRadius: 24, borderWidth: 1.5, borderColor: "#F1F5F9", elevation: 1, shadowColor: "#000", shadowOpacity: 0.02, shadowOffset: { width: 0, height: 2 }, shadowRadius: 4 },
    stillHelp: { fontSize: 16, fontWeight: '800', color: '#1E293B' },
    contactBtn: { backgroundColor: '#2D935C', height: 50, borderRadius: 16, paddingHorizontal: 30, justifyContent: 'center', alignItems: 'center', marginTop: 16, width: '100%', elevation: 3, shadowColor: "#2D935C", shadowOpacity: 0.2, shadowOffset: { width: 0, height: 4 }, shadowRadius: 10 },
    contactBtnText: { color: '#FFF', fontWeight: '800', fontSize: 15 }
});
