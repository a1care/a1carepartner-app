import { View, Text, StyleSheet, ScrollView, TouchableOpacity, BackHandler } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState, useEffect } from "react";

const FAQS = [
    {
        question: "How do I receive service bookings?",
        answer: "Once your profile is verified and you are toggled 'Online', you will receive real-time notifications for bookings in your area matching your specialization."
    },
    {
        question: "When do I get paid for my services?",
        answer: "Earnings are credited to your A1Care wallet immediately after the booking is marked 'Completed' by both you and the patient. You can withdraw to your bank account weekly."
    },
    {
        question: "What should I do if I'm running late?",
        answer: "Always use the 'Contact' button in the booking details to inform the patient. Reliability is key to maintaining a high partner rating."
    },
    {
        question: "How do I update my professional documents?",
        answer: "You can reach out to support through the 'Raise a Ticket' section to update your medical degree or license documents for re-verification."
    },
    {
        question: "Is there a penalty for cancelling a booking?",
        answer: "Frequent cancellations affect your visibility and rating. We recommend only going 'Online' when you are fully available to provide services."
    }
];

import { useConfigStore } from "../stores/config.store";

export default function FAQScreen() {
    const router = useRouter();
    const { config } = useConfigStore();
    const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

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
                <Text style={styles.headerTitle}>Help & Support</Text>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                <View style={styles.infoBox}>
                    <Ionicons name="help-circle" size={40} color="#2D935C" />
                    <Text style={styles.infoTitle}>How can we help you?</Text>
                    <Text style={styles.infoSub}>Search through our frequently asked questions below.</Text>
                </View>

                {config?.contact.faq ? (
                    <View style={styles.faqItem}>
                        <Text style={styles.answerText}>{config.contact.faq}</Text>
                    </View>
                ) : (
                    FAQS.map((faq, index) => (
                        <TouchableOpacity
                            key={index}
                            style={styles.faqItem}
                            activeOpacity={0.7}
                            onPress={() => setExpandedIndex(expandedIndex === index ? null : index)}
                        >
                            <View style={styles.questionRow}>
                                <Text style={styles.questionText}>{faq.question}</Text>
                                <Ionicons
                                    name={expandedIndex === index ? "chevron-up" : "chevron-down"}
                                    size={20}
                                    color="#64748B"
                                />
                            </View>
                            {expandedIndex === index && (
                                <View style={styles.answerBox}>
                                    <Text style={styles.answerText}>{faq.answer}</Text>
                                </View>
                            )}
                        </TouchableOpacity>
                    ))
                )}

                <View style={[styles.card, { marginTop: 20, alignItems: 'center' }]}>
                    <Text style={styles.stillHelp}>Still need help?</Text>
                    <TouchableOpacity style={styles.contactBtn} onPress={() => router.push("/raise_ticket")}>
                        <Text style={styles.contactBtnText}>Contact Support</Text>
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
    infoBox: { alignItems: 'center', marginBottom: 30, marginTop: 10 },
    infoTitle: { fontSize: 22, fontWeight: '900', color: '#1E293B', marginTop: 10 },
    infoSub: { fontSize: 14, color: '#64748B', marginTop: 5 },
    faqItem: { backgroundColor: "#FFF", padding: 20, borderRadius: 20, marginBottom: 12, borderWidth: 1, borderColor: "#F1F5F9" },
    questionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    questionText: { fontSize: 16, fontWeight: '700', color: '#1E293B', flex: 1, marginRight: 15 },
    answerBox: { marginTop: 15, paddingTop: 15, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
    answerText: { fontSize: 14, color: '#475569', lineHeight: 22 },
    card: { backgroundColor: "#FFF", padding: 25, borderRadius: 24, borderWidth: 1, borderColor: "#F1F5F9" },
    stillHelp: { fontSize: 16, fontWeight: '700', color: '#1E293B' },
    contactBtn: { backgroundColor: '#2D935C', paddingHorizontal: 30, paddingVertical: 12, borderRadius: 12, marginTop: 15 },
    contactBtnText: { color: '#FFF', fontWeight: '800', fontSize: 14 }
});
