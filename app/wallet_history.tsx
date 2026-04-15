import React, { useState } from "react";
import {
    View, Text, StyleSheet, TouchableOpacity, ScrollView,
    TextInput, Alert, ActivityIndicator, Dimensions, Modal
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeInUp, FadeInRight } from "react-native-reanimated";
import { Toast } from "../components/CustomToast";

const { width } = Dimensions.get("window");

export default function WalletScreen() {
    const router = useRouter();
    const queryClient = useQueryClient();
    const [activeTab, setActiveTab] = useState<"Added" | "Withdrawn">("Added");
    const [showTopUp, setShowTopUp] = useState(false);
    const [showWithdraw, setShowWithdraw] = useState(false);
    const [amount, setAmount] = useState("");

    // Fetch Earnings Summary (Financial Hub)
    const { data: summary, isLoading: loadingSummary } = useQuery({
        queryKey: ['staff_earnings'],
        queryFn: async () => {
            const res = await api.get('/doctor/earnings/summary');
            return res.data.data;
        }
    });

    // Fetch Payouts (Withdrawn History)
    const { data: payouts, isLoading: loadingPayouts } = useQuery({
        queryKey: ['staff_payouts'],
        queryFn: async () => {
            const res = await api.get('/doctor/earnings/payouts');
            return res.data.data;
        }
    });

    const withdrawMutation = useMutation({
        mutationFn: async (withdrawAmount: number) => {
            return await api.post('/doctor/earnings/withdraw', { amount: withdrawAmount });
        },
        onSuccess: () => {
            Alert.alert("Request Submitted", "Your withdrawal request is being processed. Payments are typically settled every Thursday.");
            setShowWithdraw(false);
            setAmount("");
            queryClient.invalidateQueries({ queryKey: ['staff_earnings'] });
            queryClient.invalidateQueries({ queryKey: ['staff_payouts'] });
        },
        onError: (err: any) => {
            Alert.alert("Failed", err?.response?.data?.message || "Withdrawal failed. Try again.");
        }
    });

    // Payment gateway disabled: admins will top-up wallets manually.
    const topUpMutation = useMutation({
        mutationFn: async (_topUpAmount: number) => Promise.resolve(),
        onSuccess: () => {
            Alert.alert("Top-up Disabled", "Please contact admin to add wallet balance while the gateway is offline.");
            setShowTopUp(false);
            setAmount("");
        },
        onError: () => {
            Alert.alert("Top-up Disabled", "Please contact admin to add wallet balance while the gateway is offline.");
        }
    });

    const handleWithdraw = () => {
        const amt = parseFloat(amount);
        if (isNaN(amt) || amt < 500) {
            Alert.alert("Invalid Amount", "Minimum withdrawal is ₹500");
            return;
        }
        if (amt > (summary?.balance || 0)) {
            Alert.alert("Insufficient Balance", "You cannot withdraw more than your current earnings.");
            return;
        }
        withdrawMutation.mutate(amt);
    };

    const handleTopUp = () => {
        Alert.alert("Top-up Disabled", "Please contact admin to add wallet balance while the gateway is offline.");
    };

    const handleComingSoon = () => {
        Toast.show({
            type: 'info',
            text1: 'Coming Soon',
            text2: 'This feature will be available in the next update.'
        });
    };

    return (
        <SafeAreaView style={styles.container}>
            <LinearGradient colors={["#FFFFFF", "#F8FAFC"]} style={StyleSheet.absoluteFill} />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="chevron-back" size={24} color="#1E293B" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Financial Wallet</Text>
                <TouchableOpacity onPress={() => queryClient.invalidateQueries({ queryKey: ['staff_earnings'] })}>
                    <Ionicons name="refresh" size={20} color="#64748B" />
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                {/* Main Balance Card */}
                <Animated.View entering={FadeInUp.duration(600)} style={styles.balanceCard}>
                    <LinearGradient colors={["#1E293B", "#0F172A"]} style={styles.cardGradient}>
                        <View style={styles.cardHeader}>
                            <View>
                                <Text style={styles.label}>Settlement Balance</Text>
                                <Text style={styles.amount}>₹{(summary?.balance || 0).toLocaleString()}</Text>
                            </View>
                            <FontAwesome5 name="wallet" size={32} color="rgba(255,255,255,0.15)" />
                        </View>
                        
                        <View style={styles.cardFooter}>
                            <TouchableOpacity style={styles.cardBtn} onPress={handleComingSoon}>
                                <MaterialCommunityIcons name="bank-transfer-out" size={20} color="#FFF" />
                                <Text style={styles.cardBtnText}>Withdraw</Text>
                            </TouchableOpacity>
                            <View style={styles.cardDivider} />
                            <TouchableOpacity style={styles.cardBtn} onPress={handleComingSoon}>
                                <MaterialCommunityIcons name="plus-circle-outline" size={20} color="#FFF" />
                                <Text style={styles.cardBtnText}>Add Money</Text>
                            </TouchableOpacity>
                        </View>
                    </LinearGradient>
                </Animated.View>

                {/* Quick Stats Grid */}
                <View style={styles.statsGrid}>
                    <View style={styles.statBox}>
                        <Text style={styles.statLabel}>Total Earned</Text>
                        <Text style={styles.statVal}>₹{summary?.stats?.totalEarnings || 0}</Text>
                    </View>
                    <View style={styles.statBox}>
                        <Text style={styles.statLabel}>Total Withdrawn</Text>
                        <Text style={[styles.statVal, { color: '#EF4444' }]}>₹{summary?.stats?.withdrawn || 0}</Text>
                    </View>
                </View>

                {/* Tabs */}
                <View style={styles.tabContainer}>
                    <TouchableOpacity 
                        style={[styles.tab, activeTab === "Added" && styles.activeTab]}
                        onPress={() => setActiveTab("Added")}
                    >
                        <Text style={[styles.tabText, activeTab === "Added" && styles.activeTabText]}>Additions</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                        style={[styles.tab, activeTab === "Withdrawn" && styles.activeTab]}
                        onPress={() => setActiveTab("Withdrawn")}
                    >
                        <Text style={[styles.tabText, activeTab === "Withdrawn" && styles.activeTabText]}>Withdrawals</Text>
                    </TouchableOpacity>
                </View>

                {/* List Area */}
                <View style={styles.historyList}>
                    {activeTab === "Withdrawn" ? (
                        payouts?.length > 0 ? (
                            payouts.map((p: any) => (
                                <Animated.View entering={FadeInRight} key={p._id} style={styles.historyItem}>
                                    <View style={[styles.itemIcon, { backgroundColor: '#FEF2F2' }]}>
                                        <MaterialCommunityIcons name="bank-transfer-out" size={20} color="#EF4444" />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.itemTitle}>Payout Request</Text>
                                        <Text style={styles.itemSub}>{new Date(p.createdAt).toLocaleDateString()} • {p.status}</Text>
                                    </View>
                                    <Text style={[styles.itemAmt, { color: '#EF4444' }]}>- ₹{p.amount}</Text>
                                </Animated.View>
                            ))
                        ) : (
                            <View style={styles.emptyState}>
                                <Ionicons name="receipt-outline" size={48} color="#CBD5E1" />
                                <Text style={styles.emptyText}>No withdrawal history</Text>
                            </View>
                        )
                    ) : (
                        <View style={styles.emptyState}>
                            <Ionicons name="wallet-outline" size={48} color="#CBD5E1" />
                            <Text style={styles.emptyText}>No wallet additions found</Text>
                        </View>
                    )}
                </View>
            </ScrollView>

            {/* Withdraw Modal */}
            <Modal visible={showWithdraw} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Request Payout</Text>
                            <TouchableOpacity onPress={() => { setShowWithdraw(false); setAmount(""); }}>
                                <Ionicons name="close" size={24} color="#64748B" />
                            </TouchableOpacity>
                        </View>
                        <View style={styles.modalBody}>
                            <Text style={styles.modalLabel}>Enter Amount (Min ₹500)</Text>
                            <TextInput 
                                style={styles.modalInput} 
                                placeholder="0.00" 
                                keyboardType="numeric" 
                                value={amount}
                                onChangeText={setAmount}
                                autoFocus
                            />
                            <Text style={styles.modalInfo}>Max Withdrawable: ₹{summary?.balance || 0}</Text>
                            
                            <TouchableOpacity style={styles.modalBtn} onPress={handleWithdraw} disabled={withdrawMutation.isPending}>
                                {withdrawMutation.isPending ? <ActivityIndicator color="#FFF" /> : <Text style={styles.modalBtnText}>Confirm Withdrawal</Text>}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Top-up Modal */}
            <Modal visible={showTopUp} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Add Money to Wallet</Text>
                            <TouchableOpacity onPress={() => { setShowTopUp(false); setAmount(""); }}>
                                <Ionicons name="close" size={24} color="#64748B" />
                            </TouchableOpacity>
                        </View>
                        <View style={styles.modalBody}>
                            <Text style={styles.modalLabel}>Amount to Add</Text>
                            <TextInput 
                                style={styles.modalInput} 
                                placeholder="0.00" 
                                keyboardType="numeric" 
                                value={amount}
                                onChangeText={setAmount}
                                autoFocus
                            />
                            <View style={styles.quickAmts}>
                                {[500, 1000, 2000, 5000].map(val => (
                                    <TouchableOpacity key={val} style={styles.quickAmtBtn} onPress={() => setAmount(val.toString())}>
                                        <Text style={styles.quickAmtText}>+₹{val}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            <TouchableOpacity style={[styles.modalBtn, { backgroundColor: '#2D935C' }]} onPress={handleTopUp} disabled={topUpMutation.isPending}>
                                {topUpMutation.isPending ? <ActivityIndicator color="#FFF" /> : <Text style={styles.modalBtnText}>Initiate Secure Payment</Text>}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#FFF" },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
    backBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#FFF', justifyContent: 'center', alignItems: 'center', elevation: 2 },
    headerTitle: { fontSize: 18, fontWeight: '800', color: '#1E293B' },
    scrollContent: { padding: 20 },
    balanceCard: { borderRadius: 32, overflow: 'hidden', elevation: 15, shadowColor: '#1e293b', shadowOpacity: 0.2, shadowRadius: 20 },
    cardGradient: { padding: 32 },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32 },
    label: { color: 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
    amount: { color: '#FFF', fontSize: 42, fontWeight: '900', marginTop: 8 },
    cardFooter: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    cardBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12 },
    cardBtnText: { color: '#FFF', fontSize: 15, fontWeight: '800' },
    cardDivider: { width: 1, height: 24, backgroundColor: 'rgba(255,255,255,0.1)' },
    statsGrid: { flexDirection: 'row', gap: 16, marginTop: 24 },
    statBox: { flex: 1, backgroundColor: '#F8FAFC', padding: 20, borderRadius: 24, borderWidth: 1, borderColor: '#F1F5F9' },
    statLabel: { fontSize: 11, color: '#64748B', fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
    statVal: { fontSize: 20, fontWeight: '900', color: '#1E293B', marginTop: 6 },
    tabContainer: { flexDirection: 'row', backgroundColor: '#F1F5F9', borderRadius: 16, padding: 6, marginVertical: 32 },
    tab: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 12 },
    activeTab: { backgroundColor: '#FFF', elevation: 3, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 8 },
    tabText: { fontSize: 14, fontWeight: '800', color: '#64748B' },
    activeTabText: { color: '#1E293B' },
    historyList: { gap: 12 },
    historyItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', padding: 16, borderRadius: 20, borderWidth: 1, borderColor: '#F1F5F9' },
    itemIcon: { width: 48, height: 48, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
    itemTitle: { fontSize: 16, fontWeight: '800', color: '#1E293B' },
    itemSub: { fontSize: 12, color: '#94A3B8', marginTop: 2, fontWeight: '600' },
    itemAmt: { fontSize: 16, fontWeight: '900' },
    emptyState: { alignItems: 'center', marginVertical: 40, opacity: 0.5 },
    emptyText: { marginTop: 15, fontSize: 15, fontWeight: '700', color: '#94A3B8' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.6)', justifyContent: 'flex-end' },
    modalContent: { backgroundColor: '#FFF', borderTopLeftRadius: 40, borderTopRightRadius: 40, padding: 32, minHeight: 400 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 },
    modalTitle: { fontSize: 22, fontWeight: '900', color: '#1E293B' },
    modalBody: { gap: 24 },
    modalLabel: { fontSize: 14, fontWeight: '800', color: '#64748B' },
    modalInput: { height: 80, fontSize: 48, fontWeight: '900', color: '#1E293B', textAlign: 'center' },
    modalInfo: { textAlign: 'center', color: '#94A3B8', fontWeight: '700', fontSize: 13 },
    modalBtn: { height: 64, backgroundColor: '#1E293B', borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginTop: 10, elevation: 8 },
    modalBtnText: { color: '#FFF', fontSize: 18, fontWeight: '800' },
    quickAmts: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
    quickAmtBtn: { flex: 1, height: 44, backgroundColor: '#F8FAFC', borderRadius: 12, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#F1F5F9' },
    quickAmtText: { color: '#64748B', fontWeight: '800', fontSize: 13 }
});
