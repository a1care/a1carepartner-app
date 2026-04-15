import { View, Text, StyleSheet, FlatList, TouchableOpacity, BackHandler } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { api } from '../lib/api';

export default function CustomersScreen() {
    const router = useRouter();

    useEffect(() => {
        const backAction = () => {
            router.navigate("/(tabs)/home" as any);
            return true;
        };
        const backHandler = BackHandler.addEventListener("hardwareBackPress", backAction);
        return () => backHandler.remove();
    }, []);

    const { data: bookings = [], isLoading } = useQuery({
        queryKey: ["customers"],
        queryFn: async () => {
            const res = await api.get("/appointment/patient/appointments/pending");
            return res.data.data || [];
        }
    });

    // Unique customers
    const customers = Array.from(new Set(bookings.map((b: any) => b.patientName || "Guest Patient")))
        .map(name => ({ id: name, name }));

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.navigate("/(tabs)/home" as any)} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color="#1E293B" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>My Customers</Text>
            </View>

            {isLoading ? (
                <Text style={styles.loadingText}>Loading customers...</Text>
            ) : customers.length === 0 ? (
                <View style={styles.emptyState}>
                    <Ionicons name="people-outline" size={48} color="#CBD5E1" />
                    <Text style={styles.emptyStateText}>No customers found yet.</Text>
                </View>
            ) : (
                <FlatList
                    data={customers}
                    keyExtractor={(item) => item.id as string}
                    contentContainerStyle={styles.listContainer}
                    renderItem={({ item }) => (
                        <View style={styles.card}>
                            <View style={styles.avatar}>
                                <Ionicons name="person" size={20} color="#64748B" />
                            </View>
                            <Text style={styles.cardTitle}>{String(item.name || "Guest")}</Text>
                        </View>
                    )}
                />
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#F8FAFC" },
    header: { flexDirection: 'row', alignItems: 'center', padding: 20, backgroundColor: "#FFF", borderBottomWidth: 1, borderColor: "#E2E8F0" },
    backBtn: { marginRight: 15 },
    headerTitle: { fontSize: 20, fontWeight: "800", color: "#1E293B" },
    loadingText: { textAlign: 'center', marginTop: 40, color: "#64748B" },
    emptyState: { alignItems: 'center', justifyContent: 'center', marginTop: 80 },
    emptyStateText: { marginTop: 10, color: "#94A3B8", fontSize: 16 },
    listContainer: { padding: 20 },
    card: { flexDirection: 'row', alignItems: 'center', backgroundColor: "#FFF", padding: 16, borderRadius: 16, marginBottom: 12, elevation: 1 },
    avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#F1F5F9", alignItems: 'center', justifyContent: 'center', marginRight: 15 },
    cardTitle: { fontSize: 16, fontWeight: "700", color: "#1E293B" },
});
