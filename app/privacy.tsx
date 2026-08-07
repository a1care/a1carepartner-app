import { View, Text, StyleSheet, ScrollView, TouchableOpacity, BackHandler, useWindowDimensions, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect } from "react";
import RenderHtml from "react-native-render-html";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";

export default function PrivacyPolicyScreen() {
    const router = useRouter();
    const { width } = useWindowDimensions();

    const { data: privacyData, isLoading } = useQuery({
        queryKey: ["cms-privacy", "PARTNER"],
        queryFn: async () => {
            const res = await api.get("/cms/public/PARTNER/PRIVACY");
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
                    {privacyData?.content ? (
                        <RenderHtml 
                            contentWidth={width - 50} 
                            source={{ html: privacyData.content }} 
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
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 15, backgroundColor: "#FFF", borderBottomWidth: 1, borderBottomColor: "#E2E8F0" },
    backButton: { padding: 5 },
    headerTitle: { fontSize: 18, fontWeight: "800", color: "#1E293B" },
    scrollContent: { padding: 20, paddingBottom: 40 },
    card: { backgroundColor: "#FFF", padding: 24, borderRadius: 24, borderWidth: 1.5, borderColor: "#F1F5F9", elevation: 1, shadowColor: "#000", shadowOpacity: 0.02, shadowOffset: { width: 0, height: 2 }, shadowRadius: 8 },
    iconContainer: { width: 64, height: 64, borderRadius: 32, backgroundColor: "#E8F8EF", justifyContent: 'center', alignItems: 'center', alignSelf: 'center', marginBottom: 15 },
    lastUpdate: { fontSize: 13, color: "#94A3B8", fontWeight: "800", marginBottom: 20, textAlign: 'center' },
    sectionTitle: { fontSize: 16, fontWeight: "800", color: "#1E293B", marginTop: 20, marginBottom: 10 },
    paragraph: { fontSize: 15, lineHeight: 26, color: "#475569", fontWeight: "500", marginBottom: 15 },
    htmlH1: { fontSize: 20, fontWeight: '900', color: '#FFFFFF', backgroundColor: '#064E3B', padding: 16, borderRadius: 12, overflow: 'hidden', marginBottom: 20, marginTop: 4, letterSpacing: -0.2, lineHeight: 28 } as any,
    htmlH2: { fontSize: 20, fontWeight: '800', color: '#0F172A', marginTop: 28, marginBottom: 12, letterSpacing: -0.3 } as any,
    htmlH3: { fontSize: 16, fontWeight: '800', color: '#334155', marginTop: 16, marginBottom: 8 } as any,
    htmlBold: { fontWeight: '800', color: '#0F172A' } as any,
    supportLink: { marginTop: 25, padding: 14, backgroundColor: "#E8F8EF", borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
    supportText: { color: "#2D935C", fontWeight: "800", fontSize: 14 }
});
