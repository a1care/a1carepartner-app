import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { Toast } from "../../components/CustomToast";

const StatCard = ({ title, amount, icon, color }: any) => (
    <View style={styles.statCard}>
        <View style={[styles.iconContainer, { backgroundColor: color + '15' }]}>
            <MaterialCommunityIcons name={icon} size={24} color={color} />
        </View>
        <Text style={styles.statTitle}>{title}</Text>
        <Text style={[styles.statAmount, { color: color }]}>₹{amount}</Text>
    </View>
);

export default function EarningsScreen() {
    const queryClient = useQueryClient();
    const [refreshing, setRefreshing] = useState(false);

    const { data: summary, isLoading, refetch } = useQuery({
        queryKey: ['staff_earnings'],
        queryFn: async () => {
            const res = await api.get('/doctor/earnings/summary');
            return res.data.data;
        }
    });

    const { data: payouts } = useQuery({
        queryKey: ['staff_payouts'],
        queryFn: async () => {
            const res = await api.get('/doctor/earnings/payouts');
            return res.data.data;
        }
    });

    const withdrawMutation = useMutation({
        mutationFn: async (amount: number) => {
            return await api.post('/doctor/earnings/withdraw', { amount });
        },
        onSuccess: () => {
            Alert.alert("Success", "Withdrawal request submitted successfully.");
            queryClient.invalidateQueries({ queryKey: ['staff_earnings'] });
            queryClient.invalidateQueries({ queryKey: ['staff_payouts'] });
        },
        onError: (err: any) => {
            Alert.alert("Extraction Failed", err?.response?.data?.message || "Something went wrong");
        }
    });

    const onRefresh = async () => {
        setRefreshing(true);
        await refetch();
        setRefreshing(false);
    };

    if (isLoading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#2D935C" />
            </View>
        );
    }

    const { stats, balance } = summary || { stats: {}, balance: 0 };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Financial Overview</Text>
                <TouchableOpacity onPress={onRefresh}>
                    <Ionicons name="refresh" size={20} color="#64748B" />
                </TouchableOpacity>
            </View>

            <ScrollView 
                contentContainerStyle={styles.scrollContent}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            >
                {/* Balance Section */}
                <View style={styles.balanceCard}>
                    <View>
                        <Text style={styles.balanceLabel}>Withdrawable Balance</Text>
                        <Text style={styles.balanceAmount}>₹{balance}</Text>
                    </View>
                    <TouchableOpacity 
                        style={[styles.withdrawBtn, { opacity: 0.7 }]} 
                        onPress={() => {
                            Toast.show({
                                type: 'info',
                                text1: 'Coming Soon',
                                text2: 'This feature will be available in the next update.'
                            });
                        }}
                    >
                        <Text style={styles.withdrawBtnText}>Withdraw All</Text>
                    </TouchableOpacity>
                </View>

                {/* Grid Stats */}
                <View style={styles.statsGrid}>
                    <StatCard title="Total Earnings" amount={stats.totalEarnings || 0} icon="cash-multiple" color="#2D935C" />
                    <StatCard title="Today's Sales" amount={stats.today || 0} icon="trending-up" color="#6366F1" />
                    <StatCard title="This Week" amount={stats.thisWeek || 0} icon="calendar-week" color="#F59E0B" />
                    <StatCard title="Withdrawn" amount={stats.withdrawn || 0} icon="bank-transfer-out" color="#EC4899" />
                </View>

                <View style={styles.historyHeader}>
                    <Text style={styles.historyTitle}>Payout History</Text>
                </View>

                {/* History List */}
                {payouts?.length > 0 ? (
                    payouts.map((p: any) => (
                        <View key={p._id} style={styles.payoutItem}>
                            <View style={styles.payoutIcon}>
                                <Ionicons name="wallet-outline" size={20} color="#64748B" />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.payoutAmount}>₹{p.amount}</Text>
                                <Text style={styles.payoutDate}>{new Date(p.createdAt).toLocaleDateString()}</Text>
                            </View>
                            <View style={[
                                styles.statusBadge, 
                                { backgroundColor: p.status === 'COMPLETED' ? '#ECFDF5' : p.status === 'PENDING' ? '#FFFBEB' : '#FEF2F2' }
                            ]}>
                                <Text style={[
                                    styles.statusText, 
                                    { color: p.status === 'COMPLETED' ? '#10B981' : p.status === 'PENDING' ? '#D97706' : '#EF4444' }
                                ]}>
                                    {p.status}
                                </Text>
                            </View>
                        </View>
                    ))
                ) : (
                    <View style={styles.emptyState}>
                        <Ionicons name="receipt-outline" size={48} color="#CBD5E1" />
                        <Text style={styles.emptyText}>No payout history found yet.</Text>
                    </View>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#F8FAFC" },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, backgroundColor: '#FFF' },
    headerTitle: { fontSize: 20, fontWeight: '800', color: '#1E293B' },
    scrollContent: { padding: 16 },
    balanceCard: {
        backgroundColor: '#1E293B',
        borderRadius: 24,
        padding: 24,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
        elevation: 10,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 12,
    },
    balanceLabel: { color: '#94A3B8', fontSize: 13, fontWeight: '600', marginBottom: 4 },
    balanceAmount: { color: '#FFF', fontSize: 28, fontWeight: '900' },
    withdrawBtn: { backgroundColor: '#2D935C', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12 },
    withdrawBtnText: { color: '#FFF', fontSize: 13, fontWeight: '800' },
    statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 24 },
    statCard: {
        width: '48%',
        backgroundColor: '#FFF',
        borderRadius: 20,
        padding: 16,
        borderWidth: 1,
        borderColor: '#F1F5F9',
        elevation: 2,
    },
    iconContainer: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
    statTitle: { fontSize: 12, color: '#64748B', fontWeight: '700', marginBottom: 4 },
    statAmount: { fontSize: 18, fontWeight: '900' },
    historyHeader: { marginVertical: 16 },
    historyTitle: { fontSize: 18, fontWeight: '800', color: '#1E293B' },
    payoutItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFF',
        padding: 16,
        borderRadius: 16,
        marginBottom: 10,
        gap: 12,
        borderWidth: 1,
        borderColor: '#F1F5F9',
    },
    payoutIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F8FAFC', justifyContent: 'center', alignItems: 'center' },
    payoutAmount: { fontSize: 16, fontWeight: '800', color: '#1E293B' },
    payoutDate: { fontSize: 12, color: '#94A3B8', marginTop: 2 },
    statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
    statusText: { fontSize: 10, fontWeight: '800' },
    emptyState: { alignItems: 'center', marginTop: 40 },
    emptyText: { color: '#94A3B8', marginTop: 12, fontWeight: '600' }
});
