import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';

export default function ToolsScreen() {
    const router = useRouter();

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color="#1E293B" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Provider Tools</Text>
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                <Text style={styles.subtext}>Manage your external devices and integrations from here.</Text>

                <View style={styles.toolCard}>
                    <View style={styles.iconBox}>
                        <Ionicons name="print" size={24} color="#2D935C" />
                    </View>
                    <View style={styles.toolInfo}>
                        <Text style={styles.toolTitle}>Bluetooth Printer</Text>
                        <Text style={styles.toolDesc}>Connect receipt printer for billing</Text>
                    </View>
                    <TouchableOpacity style={styles.btn}>
                        <Text style={styles.btnText}>Connect</Text>
                    </TouchableOpacity>
                </View>

                <View style={styles.toolCard}>
                    <View style={styles.iconBox}>
                        <Ionicons name="fitness" size={24} color="#6366F1" />
                    </View>
                    <View style={styles.toolInfo}>
                        <Text style={styles.toolTitle}>Vitals Monitor</Text>
                        <Text style={styles.toolDesc}>Sync health monitoring devices</Text>
                    </View>
                    <TouchableOpacity style={styles.btn}>
                        <Text style={styles.btnText}>Pair</Text>
                    </TouchableOpacity>
                </View>

            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#F8FAFC" },
    header: { flexDirection: 'row', alignItems: 'center', padding: 20, backgroundColor: "#FFF", borderBottomWidth: 1, borderColor: "#E2E8F0" },
    backBtn: { marginRight: 15 },
    headerTitle: { fontSize: 20, fontWeight: "800", color: "#1E293B" },
    content: { padding: 20 },
    subtext: { color: "#64748B", marginBottom: 20, fontSize: 14 },
    toolCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: "#FFF", padding: 16, borderRadius: 16, marginBottom: 12, elevation: 2 },
    iconBox: { width: 44, height: 44, borderRadius: 12, backgroundColor: "#F0FDF4", alignItems: 'center', justifyContent: 'center', marginRight: 15 },
    toolInfo: { flex: 1 },
    toolTitle: { fontSize: 16, fontWeight: "700", color: "#1E293B" },
    toolDesc: { fontSize: 12, color: "#64748B", marginTop: 2 },
    btn: { backgroundColor: "#F1F5F9", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
    btnText: { fontSize: 12, fontWeight: "700", color: "#475569" },
});
