import { useState } from "react";
import {
    View, Text, TouchableOpacity, StyleSheet, ScrollView, Dimensions,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { PartnerRole } from "../../stores/auth";

const { width } = Dimensions.get("window");

const roles: { key: PartnerRole; emoji: string; label: string; desc: string; color: string; bg: string }[] = [
    { key: "doctor", emoji: "👨‍⚕️", label: "Doctor", desc: "General & specialist\nconsultation services", color: "#1A7FD4", bg: "#E8F4FD" },
    { key: "nurse", emoji: "👩‍⚕️", label: "Nurse", desc: "Home nursing &\ncare support", color: "#27AE60", bg: "#E8F8EF" },
    { key: "ambulance", emoji: "🚑", label: "Ambulance", desc: "Emergency &\ntransport services", color: "#E74C3C", bg: "#FDECEA" },
    { key: "rental", emoji: "🛏️", label: "Medical Rental", desc: "Equipment rental\n& delivery", color: "#F39C12", bg: "#FEF9E7" },
];

export default function RoleSelectScreen() {
    const router = useRouter();
    const [selected, setSelected] = useState<PartnerRole | null>(null);

    const handleContinue = () => {
        if (!selected) return;
        router.push({ pathname: "/(auth)/login", params: { role: selected } });
    };

    return (
        <View style={{ flex: 1, backgroundColor: "#EBF5FB" }}>
            <LinearGradient colors={["#C8E6F9", "#EBF5FB"]} style={StyleSheet.absoluteFill} />

            <ScrollView contentContainerStyle={{ paddingTop: 60, paddingHorizontal: 24, paddingBottom: 40 }}>
                <Text style={styles.logoText}>
                    <Text style={{ color: "#1A7FD4" }}>A1</Text>
                    <Text style={{ color: "#27AE60" }}>Care</Text>
                    <Text style={{ color: "#1A7FD4" }}> 24/7</Text>
                </Text>

                <Text style={styles.heading}>I am a...</Text>
                <Text style={styles.sub}>Select your provider role to continue onboarding</Text>

                <View style={styles.grid}>
                    {roles.map((r) => (
                        <TouchableOpacity
                            key={r.key}
                            onPress={() => setSelected(r.key)}
                            activeOpacity={0.8}
                            style={[
                                styles.card,
                                { backgroundColor: r.bg, borderColor: selected === r.key ? r.color : "transparent" }
                            ]}
                        >
                            {selected === r.key && (
                                <View style={[styles.checkBadge, { backgroundColor: r.color }]}>
                                    <Text style={{ color: "#fff", fontSize: 11, fontWeight: "800" }}>✓</Text>
                                </View>
                            )}
                            <Text style={{ fontSize: 44, marginBottom: 10 }}>{r.emoji}</Text>
                            <Text style={[styles.cardLabel, { color: r.color }]}>{r.label}</Text>
                            <Text style={styles.cardDesc}>{r.desc}</Text>
                        </TouchableOpacity>
                    ))}
                </View>

                <TouchableOpacity
                    onPress={handleContinue}
                    disabled={!selected}
                    activeOpacity={0.85}
                    style={{ marginTop: 20 }}
                >
                    <LinearGradient
                        colors={selected ? ["#1A7FD4", "#0D5FA0"] : ["#CBD5E1", "#CBD5E1"]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.cta}
                    >
                        <Text style={styles.ctaText}>Continue as {selected ? roles.find(r => r.key === selected)?.label : "..."}</Text>
                    </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity onPress={() => router.push("/(auth)/login")} className="mt-4 items-center">
                    <Text style={styles.loginLink}>Already have an account? <Text style={{ color: "#1A7FD4", fontWeight: "700" }}>Log In</Text></Text>
                </TouchableOpacity>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    logoText: { fontSize: 26, fontWeight: "900", textAlign: "center", marginBottom: 32 },
    heading: { fontSize: 28, fontWeight: "800", color: "#0D2E4D", textAlign: "center" },
    sub: { fontSize: 14, color: "#4A6E8A", textAlign: "center", marginTop: 8, marginBottom: 28 },
    grid: { flexDirection: "row", flexWrap: "wrap", gap: 16, justifyContent: "center" },
    card: {
        width: (width - 64) / 2, borderRadius: 24,
        padding: 20, alignItems: "center",
        borderWidth: 2.5,
        shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
        position: "relative",
    },
    checkBadge: {
        position: "absolute", top: 10, right: 10,
        width: 22, height: 22, borderRadius: 11,
        alignItems: "center", justifyContent: "center",
    },
    cardLabel: { fontSize: 16, fontWeight: "800", marginBottom: 4 },
    cardDesc: { fontSize: 12, color: "#6B8A9E", textAlign: "center", lineHeight: 17 },
    cta: {
        height: 58, borderRadius: 29,
        alignItems: "center", justifyContent: "center",
        shadowColor: "#1A7FD4", shadowOpacity: 0.3, shadowRadius: 12, elevation: 6,
    },
    ctaText: { fontSize: 17, fontWeight: "800", color: "#fff" },
    loginLink: { fontSize: 14, color: "#6B8A9E", textAlign: "center" },
});
