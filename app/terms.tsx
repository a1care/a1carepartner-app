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
                <View style={{ width: 24 }} />
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                <View style={styles.card}>
                    {termsData?.content ? (
                        <RenderHtml 
                            contentWidth={width - 50} 
                            source={{ html: termsData.content }} 
                            tagsStyles={{ 
                                p: styles.paragraph, 
                                span: styles.paragraph, 
                                li: styles.paragraph,
                                h1: styles.htmlH1,
                                h2: styles.htmlH2,
                                h3: styles.htmlH3,
                                strong: styles.htmlBold
                            }} 
                        />
                    ) : null}
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
    paragraph: { fontSize: 15, lineHeight: 26, color: "#475569", fontWeight: "500", marginBottom: 15 },
    htmlH1: { fontSize: 20, fontWeight: '900', color: '#FFFFFF', backgroundColor: '#064E3B', padding: 16, borderRadius: 12, overflow: 'hidden', marginBottom: 20, marginTop: 4, letterSpacing: -0.2, lineHeight: 28 } as any,
    htmlH2: { fontSize: 20, fontWeight: '800', color: '#0F172A', marginTop: 28, marginBottom: 12, letterSpacing: -0.3 } as any,
    htmlH3: { fontSize: 16, fontWeight: '800', color: '#334155', marginTop: 16, marginBottom: 8 } as any,
    htmlBold: { fontWeight: '800', color: '#0F172A' } as any,
    footer: { marginTop: 30, paddingTop: 20, borderTopWidth: 1, borderTopColor: "#F1F5F9" },
    footerText: { fontSize: 13, color: "#94A3B8", textAlign: 'center', fontStyle: 'italic' }
});
