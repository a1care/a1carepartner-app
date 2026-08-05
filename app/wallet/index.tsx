import React, { useState } from "react";
import {
    View, Text, StyleSheet, TouchableOpacity, ScrollView,
    TextInput, Alert, ActivityIndicator, Dimensions, Modal
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
// react-native-razorpay is not New-Architecture compatible (iOS link failure),
// so load it optionally — top-up gracefully degrades if the native module is absent.
let RazorpayCheckout: any = null;
try {
    RazorpayCheckout = require("react-native-razorpay").default;
} catch {
    RazorpayCheckout = null;
}
import { api } from "../../lib/api";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeInUp, FadeInRight } from "react-native-reanimated";
import { useAuthStore } from "../../stores/auth";

const { width } = Dimensions.get("window");

const getPaymentErrorMessage = (err: any) => {
    const fallback = "Payment failed. Please try again.";
    const description = err?.description;
    if (typeof description === "string" && description.trim()) {
        try {
            const parsed = JSON.parse(description);
            if (parsed?.error?.reason === "payment_error") {
                return "Payment could not be authenticated. Please try again or use another payment method.";
            }
            if (typeof parsed?.error?.description === "string" && parsed.error.description.trim()) {
                return parsed.error.description.trim();
            }
        } catch {
            return description.trim();
        }
        return description.trim();
    }
    if (description && typeof description === "object") {
        if (description.reason === "payment_error") {
            return "Payment could not be authenticated. Please try again or use another payment method.";
        }
        if (typeof description.description === "string" && description.description.trim()) {
            return description.description.trim();
        }
    }
    if (typeof err?.response?.data?.message === "string" && err.response.data.message.trim()) {
        return err.response.data.message.trim();
    }
    if (typeof err?.message === "string" && err.message.trim()) {
        return err.message.trim();
    }
    return fallback;
};

const WalletScreen = () => {
    const { user } = useAuthStore();
    const router = useRouter();
    const queryClient = useQueryClient();
    
    const rawRole = typeof user?.role === 'string' ? user.role : (user?.role as any)?.name;
    const role = rawRole?.toLowerCase();
    const rolePath = role === 'nurse' ? 'nurse' : role === 'ambulance' ? 'ambulance' : 'doctor';
    const [activeTab, setActiveTab] = useState<"Added" | "Withdrawn">("Added");
    const [showTopUp, setShowTopUp] = useState(false);
    const [showWithdraw, setShowWithdraw] = useState(false);
    const [amount, setAmount] = useState("");

    // Fetch Earnings Summary (Financial Hub)
    const { data: summary, isLoading: loadingSummary } = useQuery({
        queryKey: ['staff_earnings'],
        queryFn: async () => {
            const res = await api.get(`/${rolePath}/earnings/summary`);
            return res.data.data;
        }
    });

    // Fetch Payouts (Withdrawn History)
    const { data: payouts, isLoading: loadingPayouts } = useQuery({
        queryKey: ['staff_payouts'],
        queryFn: async () => {
            const res = await api.get(`/${rolePath}/earnings/payouts`);
            return res.data.data;
        }
    });

    // Fetch Credits / Additions (top-ups and booking payments received)
    const { data: additions, isLoading: loadingAdditions } = useQuery({
        queryKey: ['staff_additions'],
        enabled: activeTab === 'Added',
        queryFn: async () => {
            const res = await api.get(`/${rolePath}/earnings/additions`);
            return res.data.data ?? [];
        }
    });

    const withdrawMutation = useMutation({
        mutationFn: async (withdrawAmount: number) => {
            return await api.post(`/${rolePath}/earnings/withdraw`, { amount: withdrawAmount });
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

    const topUpMutation = useMutation({
        mutationFn: async (topUpAmount: number) => {
            if (!RazorpayCheckout || typeof RazorpayCheckout.open !== "function") {
                throw new Error("Online top-up is currently unavailable. Please contact support to add funds.");
            }
            const orderRes = await api.post("/payments/orders/create", {
                amount: topUpAmount,
                type: "WALLET_TOPUP"
            });
            const order = orderRes.data?.data;
            const razorRes = await api.post("/payments/razorpay/initiate", { orderId: order._id });
            const razorData = razorRes.data?.data;

            const paymentData: any = await RazorpayCheckout.open({
                key: razorData.key,
                amount: razorData.razorOrder.amount,
                currency: "INR",
                name: "A1Care 24/7",
                description: "Wallet Top-up",
                order_id: razorData.razorOrder.id,
                prefill: {
                    email: razorData.customer?.email || "",
                    contact: razorData.customer?.contact || "",
                    name: razorData.customer?.name || "",
                },
                theme: { color: "#2D935C" },
            });

            await api.post("/payments/razorpay/verify", {
                razorpay_order_id: paymentData.razorpay_order_id,
                razorpay_payment_id: paymentData.razorpay_payment_id,
                razorpay_signature: paymentData.razorpay_signature,
                orderId: order._id,
            });

            return topUpAmount;
        },
        onSuccess: (topUpAmount) => {
            queryClient.invalidateQueries({ queryKey: ['staff_earnings'] });
            queryClient.invalidateQueries({ queryKey: ['staff_payouts'] });
            queryClient.invalidateQueries({ queryKey: ['staff_additions'] });
            setShowTopUp(false);
            setAmount("");
            setActiveTab("Added");
            router.replace({
                pathname: "/checkout_status" as any,
                params: {
                    status: "success",
                    type: "WALLET_TOPUP"
                }
            });
        },
        onError: (err: any) => {
            if (err?.code !== 2 && err?.code !== "2") {
                router.replace({
                    pathname: "/checkout_status" as any,
                    params: {
                        status: "failure",
                        type: "WALLET_TOPUP"
                    }
                });
            } else {
                Alert.alert("Payment Cancelled", "You cancelled the payment.");
            }
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
        const amt = parseFloat(amount);
        if (isNaN(amt) || amt <= 0) {
            Alert.alert("Invalid Amount", "Please enter a valid amount.");
            return;
        }
        topUpMutation.mutate(amt);
    };

    return (
        <SafeAreaView style={styles.container}>

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
                    <LinearGradient 
                        colors={["#064E3B", "#059669"]} 
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.cardGradient}
                    >
                        <View style={styles.cardHeader}>
                            <View>
                                <Text style={styles.label}>Settlement Balance</Text>
                                <Text style={styles.amount}>₹{(summary?.balance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
                                {user?.name ? <Text style={styles.cardName}>{user.name}</Text> : null}
                            </View>
                            <FontAwesome5 name="wallet" size={32} color="rgba(255,255,255,0.2)" />
                        </View>
                        
                        <View style={styles.cardFooter}>
                            <TouchableOpacity style={styles.cardBtn} onPress={() => { setAmount(""); setShowWithdraw(true); }}>
                                <MaterialCommunityIcons name="bank-transfer-out" size={20} color="#FFF" />
                                <Text style={styles.cardBtnText}>Withdraw</Text>
                            </TouchableOpacity>
                            <View style={styles.cardDivider} />
                            <TouchableOpacity style={styles.cardBtn} onPress={() => { setAmount(""); setShowTopUp(true); }}>
                                <MaterialCommunityIcons name="plus-circle-outline" size={20} color="#FFF" />
                                <Text style={styles.cardBtnText}>Add Money</Text>
                            </TouchableOpacity>
                        </View>
                        
                        <View style={styles.disaWatermark}>
                            <Text style={styles.disaText}>A1CARE</Text>
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
                    ) : loadingAdditions ? (
                        <ActivityIndicator color="#2D935C" style={{ marginTop: 32 }} />
                    ) : additions?.length > 0 ? (
                        additions.map((a: any, i: number) => (
                            <Animated.View entering={FadeInRight} key={a._id || i} style={styles.historyItem}>
                                <View style={[styles.itemIcon, { backgroundColor: '#F0FDF4' }]}>
                                    <MaterialCommunityIcons name="plus-circle-outline" size={20} color="#22C55E" />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.itemTitle}>{a.description || a.type || 'Credit'}</Text>
                                    <Text style={styles.itemSub}>{new Date(a.createdAt || a.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</Text>
                                </View>
                                <Text style={[styles.itemAmt, { color: '#22C55E' }]}>+ ₹{Number(a.amount || 0).toLocaleString('en-IN')}</Text>
                            </Animated.View>
                        ))
                    ) : (
                        <View style={styles.emptyState}>
                            <Ionicons name="wallet-outline" size={48} color="#CBD5E1" />
                            <Text style={styles.emptyText}>No wallet additions yet</Text>
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
                            <View style={styles.inputContainer}>
                                <Text style={styles.currencySymbol}>₹</Text>
                                <TextInput 
                                    style={styles.inputField} 
                                    placeholder="0" 
                                    keyboardType="numeric" 
                                    value={amount}
                                    onChangeText={setAmount}
                                    autoFocus
                                    // @ts-ignore
                                    style={[styles.inputField, { outlineStyle: 'none' }]}
                                />
                            </View>
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
                            <Text style={styles.modalLabel}>Deposit Amount</Text>
                            <View style={styles.inputContainer}>
                                <Text style={styles.currencySymbol}>₹</Text>
                                <TextInput 
                                    style={styles.inputField} 
                                    placeholder="0" 
                                    keyboardType="numeric" 
                                    value={amount}
                                    onChangeText={setAmount}
                                    autoFocus
                                    // @ts-ignore
                                    style={[styles.inputField, { outlineStyle: 'none' }]}
                                />
                            </View>
                            <View style={styles.quickAmts}>
                                {[500, 1000, 2000, 5000].map(val => (
                                    <TouchableOpacity key={val} style={styles.quickAmtBtn} onPress={() => setAmount(val.toString())}>
                                        <Text style={styles.quickAmtText}>+₹{val}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            <TouchableOpacity style={styles.modalBtn} onPress={handleTopUp} disabled={topUpMutation.isPending}>
                                {topUpMutation.isPending ? <ActivityIndicator color="#FFF" /> : <Text style={styles.modalBtnText}>Proceed to Secure Payment</Text>}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#F8FAFC" },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingVertical: 16 },
    backBtn: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#FFF', justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: '#E2E8F0' },
    headerTitle: { fontSize: 20, fontWeight: '900', color: '#0F172A', letterSpacing: -0.5 },
    scrollContent: { padding: 24, paddingBottom: 40 },
    balanceCard: { borderRadius: 32, overflow: 'hidden', elevation: 8, shadowColor: '#064E3B', shadowOpacity: 0.25, shadowRadius: 16, shadowOffset: { width: 0, height: 8 } },
    cardGradient: { padding: 28, minHeight: 220 },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, zIndex: 1 },
    cardName: { fontSize: 15, color: 'rgba(255,255,255,0.9)', fontWeight: '800', marginTop: 8 },
    label: { color: 'rgba(255,255,255,0.8)', fontSize: 13, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 6 },
    amount: { color: '#FFF', fontSize: 48, fontWeight: '900', letterSpacing: -1.5 },
    cardFooter: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 'auto', zIndex: 1 },
    cardBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 20 },
    cardBtnText: { color: '#FFF', fontSize: 15, fontWeight: '900' },
    cardDivider: { width: 1, height: 28, backgroundColor: 'rgba(255,255,255,0.2)' },
    disaWatermark: { position: 'absolute', bottom: -15, right: -10, zIndex: 0 },
    disaText: { color: 'rgba(255,255,255,0.06)', fontSize: 72, fontWeight: '900', letterSpacing: -4, fontStyle: 'italic' },
    statsGrid: { flexDirection: 'row', marginTop: 24, gap: 12 },
    statBox: { flex: 1, backgroundColor: '#FFF', padding: 20, borderRadius: 24, borderWidth: 1.5, borderColor: '#E2E8F0', elevation: 2, shadowColor: '#0F172A', shadowOpacity: 0.04, shadowRadius: 12 },
    statLabel: { fontSize: 12, color: '#64748B', fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
    statVal: { fontSize: 22, fontWeight: '900', color: '#0F172A', marginTop: 8, letterSpacing: -0.5 },
    tabContainer: { flexDirection: 'row', backgroundColor: '#F1F5F9', borderRadius: 20, padding: 6, marginVertical: 32 },
    tab: { flex: 1, paddingVertical: 14, alignItems: 'center', borderRadius: 16 },
    activeTab: { backgroundColor: '#FFF', elevation: 2, shadowColor: '#0F172A', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
    tabText: { fontSize: 14, fontWeight: '800', color: '#64748B' },
    activeTabText: { color: '#0F172A' },
    historyList: { marginTop: 0 },
    historyItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', padding: 18, borderRadius: 24, borderWidth: 1.5, borderColor: '#E2E8F0', marginBottom: 14, elevation: 1, shadowColor: '#0F172A', shadowOpacity: 0.03, shadowRadius: 8 },
    itemIcon: { width: 52, height: 52, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginRight: 16 },
    itemTitle: { fontSize: 16, fontWeight: '800', color: '#0F172A', marginBottom: 4 },
    itemSub: { fontSize: 13, color: '#64748B', fontWeight: '600' },
    itemAmt: { fontSize: 18, fontWeight: '900', letterSpacing: -0.5 },
    emptyState: { alignItems: 'center', marginVertical: 60, opacity: 0.6 },
    emptyText: { marginTop: 16, fontSize: 16, fontWeight: '800', color: '#94A3B8' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.6)', justifyContent: 'flex-end' },
    modalContent: { backgroundColor: '#FFF', borderTopLeftRadius: 40, borderTopRightRadius: 40, padding: 32, minHeight: 400 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 },
    modalTitle: { fontSize: 24, fontWeight: '900', color: '#0F172A', letterSpacing: -0.5 },
    modalBody: { gap: 24 },
    modalLabel: { fontSize: 13, fontWeight: '800', color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.5 },
    inputContainer: { 
        flexDirection: 'row', 
        alignItems: 'center', 
        backgroundColor: '#F0FDF4', 
        borderRadius: 20, 
        borderWidth: 2, 
        borderColor: '#86EFAC', 
        paddingHorizontal: 24, 
        paddingVertical: 12 
    },
    currencySymbol: { fontSize: 40, fontWeight: '900', color: '#166534', marginRight: 8 },
    inputField: { 
        flex: 1, 
        height: 72, 
        fontSize: 48, 
        fontWeight: '900', 
        color: '#166534', 
        letterSpacing: -1, 
        borderWidth: 0, 
        backgroundColor: 'transparent' 
    },
    modalInfo: { textAlign: 'center', color: '#94A3B8', fontWeight: '800', fontSize: 14 },
    modalBtn: { height: 64, backgroundColor: '#059669', borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginTop: 10, elevation: 8, shadowColor: '#059669', shadowOpacity: 0.25, shadowRadius: 16, shadowOffset: { width: 0, height: 6 } },
    modalBtnText: { color: '#FFF', fontSize: 18, fontWeight: '900' },
    quickAmts: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
    quickAmtBtn: { flex: 1, height: 48, backgroundColor: '#F8FAFC', borderRadius: 14, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: '#E2E8F0' },
    quickAmtText: { color: '#475569', fontWeight: '800', fontSize: 14 }
});

export default WalletScreen;
