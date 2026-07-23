import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, RefreshControl, Platform, Animated, Modal, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { getRolePath } from '../../lib/roleApi';
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { Toast } from "../../components/CustomToast";

const StatCard = ({ title, amount, icon, color }: any) => (
    <View style={styles.statCard}>
        <View style={[styles.iconContainer, { backgroundColor: color + '15' }]}>
            <MaterialCommunityIcons name={icon} size={24} color={color} />
        </View>
        <Text style={styles.statTitle}>{title}</Text>
        <Text style={[styles.statAmount, { color: color }]} numberOfLines={1}>
            ₹{Number(amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </Text>
    </View>
);

const EarningsSkeleton = () => {
    const pulseAnim = useRef(new Animated.Value(0.3)).current;
    useEffect(() => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
                Animated.timing(pulseAnim, { toValue: 0.3, duration: 800, useNativeDriver: true })
            ])
        ).start();
    }, []);

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Financial Overview</Text>
            </View>
            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                <Animated.View style={[styles.balanceCard, { opacity: pulseAnim, backgroundColor: '#E2E8F0', elevation: 0 }]}>
                    <View style={{ height: 60 }} />
                </Animated.View>
                
                <View style={styles.statsGrid}>
                    {[1, 2, 3, 4].map((i) => (
                        <Animated.View key={i} style={[styles.statCard, { opacity: pulseAnim, backgroundColor: '#E2E8F0', height: 110, justifyContent: 'center', alignItems: 'center', elevation: 0 }]} />
                    ))}
                </View>

                <View style={styles.historyHeader}>
                    <Text style={styles.historyTitle}>Payout History</Text>
                </View>

                <View style={{ gap: 12, marginTop: 10 }}>
                    {[1, 2, 3].map((i) => (
                        <Animated.View key={i} style={{ opacity: pulseAnim, height: 70, backgroundColor: '#E2E8F0', borderRadius: 20 }} />
                    ))}
                </View>
            </ScrollView>
        </SafeAreaView>
    );
};

export default function EarningsScreen() {
    const queryClient = useQueryClient();
    const [refreshing, setRefreshing] = useState(false);
    const [isWithdrawModalVisible, setIsWithdrawModalVisible] = useState(false);
    const [payoutMethod, setPayoutMethod] = useState<'UPI' | 'BANK'>('UPI');
    const [upiId, setUpiId] = useState('');
    const [bankDetails, setBankDetails] = useState({
        accountHolderName: '',
        bankName: '',
        accountNumber: '',
        confirmAccountNumber: '',
        ifscCode: ''
    });
    const [useDifferentBank, setUseDifferentBank] = useState(false);
    const [upiVerificationStatus, setUpiVerificationStatus] = useState<'idle' | 'verifying' | 'verified' | 'failed'>('idle');
    const [upiAccountName, setUpiAccountName] = useState('');

    const handleVerifyUpi = () => {
        if (!upiId.trim() || !upiId.includes('@')) {
            Alert.alert("Invalid UPI", "Please enter a valid UPI ID format (e.g. name@upi)");
            return;
        }
        setUpiVerificationStatus('verifying');
        setTimeout(() => {
            setUpiVerificationStatus('verified');
            setUpiAccountName(staffDetails?.bankDetails?.accountHolderName || "Vinod");
        }, 1200);
    };

    const handleUpiChange = (text: string) => {
        setUpiId(text);
        setUpiVerificationStatus('idle');
        setUpiAccountName('');
    };

    const [activeTab, setActiveTab] = useState<'PAYOUTS' | 'BOOKINGS'>('PAYOUTS');

    const { data: summary, isLoading, refetch } = useQuery({
        queryKey: ['staff_earnings'],
        queryFn: async () => {
            const res = await api.get(`/${getRolePath()}/earnings/summary`);
            return res.data.data;
        }
    });

    const { data: payouts, refetch: refetchPayouts } = useQuery({
        queryKey: ['staff_payouts'],
        queryFn: async () => {
            const res = await api.get(`/${getRolePath()}/earnings/payouts`);
            return res.data.data;
        }
    });

    const { data: bookingHistory, refetch: refetchHistory } = useQuery({
        queryKey: ['staff_booking_earnings'],
        queryFn: async () => {
            const res = await api.get(`/${getRolePath()}/earnings/history`);
            return res.data.data;
        }
    });

    const { data: staffDetails } = useQuery({
        queryKey: ["staffDetailsForPayout"],
        queryFn: async () => {
            const res = await api.get(`/${getRolePath()}/auth/details`);
            return res.data.data;
        }
    });

    useEffect(() => {
        if (isWithdrawModalVisible) {
            setUseDifferentBank(false);
            if (staffDetails?.bankDetails) {
                const bd = staffDetails.bankDetails;
                if (bd.upiId) setUpiId(bd.upiId);
                setBankDetails({
                    accountHolderName: bd.accountHolderName || "",
                    bankName: bd.bankName || "",
                    accountNumber: bd.accountNumber || "",
                    confirmAccountNumber: bd.accountNumber || "",
                    ifscCode: bd.ifscCode || ""
                });
            }
        }
    }, [isWithdrawModalVisible, staffDetails]);

    const withdrawMutation = useMutation({
        mutationFn: async (params: { amount: number; payoutMethod: 'UPI' | 'BANK'; upiId?: string; bankDetails?: any }) => {
            return await api.post(`/${getRolePath()}/earnings/withdraw`, params);
        },
        onSuccess: () => {
            if (Platform.OS === 'web') {
                Toast.show({ type: "success", text1: "Success", text2: "Withdrawal request submitted successfully." });
            } else {
                Alert.alert("Success", "Withdrawal request submitted successfully.");
            }
            queryClient.invalidateQueries({ queryKey: ['staff_earnings'] });
            queryClient.invalidateQueries({ queryKey: ['staff_payouts'] });
            setUpiId('');
            setBankDetails({
                accountHolderName: '',
                bankName: '',
                accountNumber: '',
                confirmAccountNumber: '',
                ifscCode: ''
            });
        },
        onError: (err: any) => {
            const msg = err?.response?.data?.message || "Something went wrong";
            if (Platform.OS === 'web') {
                Toast.show({ type: "error", text1: "Extraction Failed", text2: msg });
            } else {
                Alert.alert("Extraction Failed", msg);
            }
        }
    });

    const onRefresh = async () => {
        setRefreshing(true);
        await Promise.all([refetch(), refetchPayouts(), refetchHistory()]);
        setRefreshing(false);
    };

    if (isLoading) {
        return <EarningsSkeleton />;
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
                        <Text style={styles.balanceAmount}>₹{Number(balance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
                    </View>
                    <TouchableOpacity
                        style={[styles.withdrawBtn, withdrawMutation.isPending && { opacity: 0.6 }]}
                        disabled={withdrawMutation.isPending}
                        onPress={() => {
                            if (!balance || balance < 500) {
                                if (Platform.OS === 'web') {
                                    Toast.show({ type: "error", text1: "Insufficient Balance", text2: "Minimum withdrawal amount is ₹500." });
                                } else {
                                    Alert.alert("Insufficient Balance", "Minimum withdrawal amount is ₹500.");
                                }
                                return;
                            }
                            setIsWithdrawModalVisible(true);
                        }}
                    >
                        <Text style={styles.withdrawBtnText}>{withdrawMutation.isPending ? "Processing..." : "Withdraw All"}</Text>
                    </TouchableOpacity>
                </View>

                {/* Grid Stats */}
                <View style={styles.statsGrid}>
                    <StatCard title="Total Earnings" amount={stats.totalEarnings || 0} icon="cash-multiple" color="#2D935C" />
                    <StatCard title="Today's Sales" amount={stats.today || 0} icon="trending-up" color="#6366F1" />
                    <StatCard title="This Week" amount={stats.thisWeek || 0} icon="calendar-week" color="#F59E0B" />
                    <StatCard title="Withdrawn" amount={stats.withdrawn || 0} icon="bank-transfer-out" color="#EC4899" />
                </View>

                {/* Sub Tab Switcher */}
                <View style={styles.tabSwitcher}>
                    <TouchableOpacity 
                        style={[styles.tabButton, activeTab === 'PAYOUTS' && styles.tabButtonActive]}
                        onPress={() => setActiveTab('PAYOUTS')}
                    >
                        <Text style={[styles.tabButtonText, activeTab === 'PAYOUTS' && styles.tabButtonTextActive]}>Payout Requests</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                        style={[styles.tabButton, activeTab === 'BOOKINGS' && styles.tabButtonActive]}
                        onPress={() => setActiveTab('BOOKINGS')}
                    >
                        <Text style={[styles.tabButtonText, activeTab === 'BOOKINGS' && styles.tabButtonTextActive]}>Booking Earnings</Text>
                    </TouchableOpacity>
                </View>

                {/* History List */}
                {activeTab === 'PAYOUTS' ? (
                    payouts?.length > 0 ? (
                        payouts.map((p: any) => (
                            <View key={p._id} style={styles.payoutItem}>
                                <View style={styles.payoutIcon}>
                                    <Ionicons name="wallet-outline" size={20} color="#64748B" />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.payoutAmount}>₹{Number(p.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
                                    <Text style={styles.payoutDate}>{new Date(p.createdAt).toLocaleDateString()}</Text>
                                </View>
                                <View style={[
                                    styles.statusBadge,
                                    { backgroundColor: p.status === 'COMPLETED' ? '#ECFDF5' : p.status === 'PENDING' ? '#FFFBEB' : p.status === 'APPROVED' ? '#EFF6FF' : '#FEF2F2' }
                                ]}>
                                    <Text style={[
                                        styles.statusText,
                                        { color: p.status === 'COMPLETED' ? '#10B981' : p.status === 'PENDING' ? '#D97706' : p.status === 'APPROVED' ? '#3B82F6' : '#EF4444' }
                                    ]}>
                                        {p.status === 'COMPLETED' ? 'Paid' : p.status === 'PENDING' ? 'Pending' : p.status === 'APPROVED' ? 'Approved' : p.status === 'REJECTED' ? 'Rejected' : p.status}
                                    </Text>
                                </View>
                            </View>
                        ))
                    ) : (
                        <View style={styles.emptyState}>
                            <Ionicons name="receipt-outline" size={48} color="#CBD5E1" />
                            <Text style={styles.emptyText}>No payout history found yet.</Text>
                        </View>
                    )
                ) : (
                    bookingHistory?.length > 0 ? (
                        bookingHistory.map((bh: any) => (
                            <View key={bh._id} style={styles.payoutItem}>
                                <View style={[styles.payoutIcon, { backgroundColor: '#F0FDF4' }]}>
                                    <Ionicons name="checkmark-circle-outline" size={20} color="#16A34A" />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.serviceTitleText}>{bh.type}</Text>
                                    <Text style={styles.serviceDetailsText}>{bh.details}</Text>
                                    <Text style={styles.payoutDate}>{new Date(bh.createdAt).toLocaleDateString("en-IN", { day: '2-digit', month: 'short', year: 'numeric' })}</Text>
                                </View>
                                <View style={{ alignItems: 'flex-end' }}>
                                    <Text style={styles.earningText}>+₹{Number(bh.partnerEarning || 0).toFixed(2)}</Text>
                                    <Text style={styles.totalBookingVal}>Val: ₹{bh.totalAmount || 0}</Text>
                                </View>
                            </View>
                        ))
                    ) : (
                        <View style={styles.emptyState}>
                            <Ionicons name="shield-checkmark-outline" size={48} color="#CBD5E1" />
                            <Text style={styles.emptyText}>No booking earnings completed yet.</Text>
                        </View>
                    )
                )}
            </ScrollView>

            <Modal
                visible={isWithdrawModalVisible}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setIsWithdrawModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Withdraw Payout</Text>
                            <TouchableOpacity onPress={() => setIsWithdrawModalVisible(false)}>
                                <Ionicons name="close" size={24} color="#64748B" />
                            </TouchableOpacity>
                        </View>
                        
                        <Text style={styles.modalSub}>Requesting payout of <Text style={{fontWeight: '900', color: '#1E293B'}}>₹{balance}</Text></Text>

                        {/* Payout Method Selector */}
                        <View style={styles.methodSelector}>
                            <TouchableOpacity 
                                style={[styles.methodBtn, payoutMethod === 'UPI' && styles.methodBtnActive]}
                                onPress={() => setPayoutMethod('UPI')}
                            >
                                <MaterialCommunityIcons name="qrcode-scan" size={20} color={payoutMethod === 'UPI' ? '#FFF' : '#64748B'} style={{marginRight: 6}} />
                                <Text style={[styles.methodBtnText, payoutMethod === 'UPI' && styles.methodBtnTextActive]}>UPI Transfer</Text>
                            </TouchableOpacity>
                            <TouchableOpacity 
                                style={[styles.methodBtn, payoutMethod === 'BANK' && styles.methodBtnActive]}
                                onPress={() => setPayoutMethod('BANK')}
                            >
                                <MaterialCommunityIcons name="bank" size={20} color={payoutMethod === 'BANK' ? '#FFF' : '#64748B'} style={{marginRight: 6}} />
                                <Text style={[styles.methodBtnText, payoutMethod === 'BANK' && styles.methodBtnTextActive]}>Bank Account</Text>
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={{ maxHeight: 330, marginVertical: 15 }} showsVerticalScrollIndicator={false}>
                            {payoutMethod === 'UPI' ? (
                                <View style={styles.formGroup}>
                                    <Text style={styles.inputLabel}>UPI ID / VPA</Text>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', borderRadius: 12, borderWidth: 1.5, borderColor: upiVerificationStatus === 'verified' ? '#2D935C' : '#E2E8F0', paddingRight: 12 }}>
                                        <TextInput 
                                            style={{ flex: 1, height: 48, paddingHorizontal: 16, fontSize: 14, color: '#1E293B' }}
                                            placeholder="e.g. name@upi"
                                            placeholderTextColor="#94A3B8"
                                            value={upiId}
                                            onChangeText={handleUpiChange}
                                            autoCapitalize="none"
                                        />
                                        {upiVerificationStatus === 'verifying' ? (
                                            <ActivityIndicator size="small" color="#2D935C" />
                                        ) : upiVerificationStatus === 'verified' ? (
                                            <Ionicons name="checkmark-circle" size={22} color="#2D935C" />
                                        ) : upiId.trim().includes('@') ? (
                                            <TouchableOpacity onPress={handleVerifyUpi}>
                                                <Text style={{ color: '#2D935C', fontWeight: '800', fontSize: 13 }}>Verify</Text>
                                            </TouchableOpacity>
                                        ) : null}
                                    </View>
                                    {upiVerificationStatus === 'verified' && (
                                        <Text style={{ color: '#2D935C', fontSize: 12, fontWeight: '700', marginLeft: 4, marginTop: -2 }}>
                                            ✓ Verified: {upiAccountName}
                                        </Text>
                                    )}
                                    <Text style={styles.inputTip}>Make sure this UPI ID is active and linked to your bank account.</Text>
                                </View>
                            ) : (
                                staffDetails?.bankDetails?.accountNumber && !useDifferentBank ? (
                                    <View style={{ gap: 12, paddingHorizontal: 4 }}>
                                        <Text style={styles.inputLabel}>Saved Settlement Bank Account</Text>
                                        <View style={styles.bankCard}>
                                            <View style={styles.bankCardDeco1} />
                                            <View style={styles.bankCardDeco2} />
                                            <View style={styles.bankCardRow}>
                                                <View style={styles.bankChip} />
                                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                                    <Text style={{ color: '#FFF', fontSize: 11, fontWeight: '800' }}>SELECTED</Text>
                                                    <Ionicons name="checkmark-circle" size={18} color="#FFF" />
                                                </View>
                                            </View>
                                            <Text style={styles.bankCardNumber}>
                                                {staffDetails.bankDetails.accountNumber.replace(/(\d{4})/g, '$1 ').trim()}
                                            </Text>
                                            <View style={styles.bankCardFooter}>
                                                <View>
                                                    <Text style={styles.bankCardFieldLabel}>ACCOUNT HOLDER</Text>
                                                    <Text style={styles.bankCardFieldValue}>{staffDetails.bankDetails.accountHolderName}</Text>
                                                </View>
                                                <View style={{ alignItems: "flex-end" }}>
                                                    <Text style={styles.bankCardFieldLabel}>IFSC CODE</Text>
                                                    <Text style={styles.bankCardFieldValue}>{staffDetails.bankDetails.ifscCode}</Text>
                                                </View>
                                            </View>
                                        </View>
                                        <TouchableOpacity 
                                            style={{ flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'center', marginTop: 5 }}
                                            onPress={() => setUseDifferentBank(true)}
                                        >
                                            <Ionicons name="create-outline" size={16} color="#2D935C" />
                                            <Text style={{ color: '#2D935C', fontWeight: '800', fontSize: 13 }}>Use a different bank account</Text>
                                        </TouchableOpacity>
                                    </View>
                                ) : (
                                    <View style={styles.formGroup}>
                                        {staffDetails?.bankDetails?.accountNumber ? (
                                            <TouchableOpacity 
                                                style={{ flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'flex-end', marginBottom: 5 }}
                                                onPress={() => setUseDifferentBank(false)}
                                            >
                                                <Ionicons name="wallet-outline" size={16} color="#2D935C" />
                                                <Text style={{ color: '#2D935C', fontWeight: '800', fontSize: 13 }}>Use saved bank account</Text>
                                            </TouchableOpacity>
                                        ) : null}
                                        <Text style={styles.inputLabel}>Account Holder Name</Text>
                                        <TextInput 
                                            style={styles.textInput}
                                            placeholder="Name as in bank record"
                                            placeholderTextColor="#94A3B8"
                                            value={bankDetails.accountHolderName}
                                            onChangeText={(v) => setBankDetails({ ...bankDetails, accountHolderName: v })}
                                        />
                                        <Text style={styles.inputLabel}>Bank Name</Text>
                                        <TextInput 
                                            style={styles.textInput}
                                            placeholder="e.g. State Bank of India"
                                            placeholderTextColor="#94A3B8"
                                            value={bankDetails.bankName}
                                            onChangeText={(v) => setBankDetails({ ...bankDetails, bankName: v })}
                                        />
                                        <Text style={styles.inputLabel}>Account Number</Text>
                                        <TextInput 
                                            style={styles.textInput}
                                            placeholder="Enter Account Number"
                                            placeholderTextColor="#94A3B8"
                                            keyboardType="numeric"
                                            value={bankDetails.accountNumber}
                                            onChangeText={(v) => setBankDetails({ ...bankDetails, accountNumber: v })}
                                        />
                                        <Text style={styles.inputLabel}>Confirm Account Number</Text>
                                        <TextInput 
                                            style={styles.textInput}
                                            placeholder="Re-enter Account Number"
                                            placeholderTextColor="#94A3B8"
                                            keyboardType="numeric"
                                            value={bankDetails.confirmAccountNumber}
                                            onChangeText={(v) => setBankDetails({ ...bankDetails, confirmAccountNumber: v })}
                                        />
                                        <Text style={styles.inputLabel}>IFSC Code</Text>
                                        <TextInput 
                                            style={styles.textInput}
                                            placeholder="e.g. SBIN0001234"
                                            placeholderTextColor="#94A3B8"
                                            autoCapitalize="characters"
                                            value={bankDetails.ifscCode}
                                            onChangeText={(v) => setBankDetails({ ...bankDetails, ifscCode: v })}
                                        />
                                    </View>
                                )
                            )}
                        </ScrollView>

                        <TouchableOpacity 
                            style={[styles.submitBtn, withdrawMutation.isPending && { opacity: 0.7 }]}
                            disabled={withdrawMutation.isPending}
                            onPress={() => {
                                if (payoutMethod === 'UPI') {
                                    if (!upiId.trim()) {
                                        Alert.alert("Input Error", "Please enter a valid UPI ID");
                                        return;
                                    }
                                    if (upiVerificationStatus !== 'verified') {
                                        Alert.alert("Verification Required", "Please click 'Verify' and successfully verify your UPI ID before requesting withdrawal.");
                                        return;
                                    }
                                    withdrawMutation.mutate({ amount: balance, payoutMethod: 'UPI', upiId });
                                } else {
                                    if (staffDetails?.bankDetails?.accountNumber && !useDifferentBank) {
                                        withdrawMutation.mutate({ amount: balance, payoutMethod: 'BANK', bankDetails: staffDetails.bankDetails });
                                    } else {
                                        const { accountNumber, confirmAccountNumber, accountHolderName, bankName, ifscCode } = bankDetails;
                                        if (!accountHolderName.trim() || !bankName.trim() || !accountNumber.trim() || !confirmAccountNumber.trim() || !ifscCode.trim()) {
                                            Alert.alert("Input Error", "Please fill in all bank details fields");
                                            return;
                                        }
                                        if (accountNumber !== confirmAccountNumber) {
                                            Alert.alert("Input Error", "Account numbers do not match");
                                            return;
                                        }
                                        withdrawMutation.mutate({ amount: balance, payoutMethod: 'BANK', bankDetails });
                                    }
                                }
                                setIsWithdrawModalVisible(false);
                            }}
                        >
                            <Text style={styles.submitBtnText}>{withdrawMutation.isPending ? "Submitting..." : "Confirm & Request"}</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
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
    emptyText: { color: '#94A3B8', marginTop: 12, fontWeight: '600' },
    tabSwitcher: { flexDirection: 'row', backgroundColor: '#F1F5F9', padding: 4, borderRadius: 14, marginBottom: 16 },
    tabButton: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10 },
    tabButtonActive: { backgroundColor: '#FFF', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 3 },
    tabButtonText: { fontSize: 13, fontWeight: '700', color: '#64748B' },
    tabButtonTextActive: { color: '#1E293B' },
    serviceTitleText: { fontSize: 14, fontWeight: '800', color: '#1E293B' },
    serviceDetailsText: { fontSize: 12, color: '#64748B', marginTop: 2 },
    earningText: { fontSize: 15, fontWeight: '900', color: '#16A34A' },
    totalBookingVal: { fontSize: 11, color: '#94A3B8', marginTop: 2, fontWeight: '700' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalContent: { backgroundColor: '#FFF', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, minHeight: 450 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    modalTitle: { fontSize: 20, fontWeight: '900', color: '#1E293B' },
    modalSub: { fontSize: 14, color: '#64748B', marginBottom: 20 },
    methodSelector: { flexDirection: 'row', gap: 12, marginBottom: 15 },
    methodBtn: { flex: 1, height: 48, borderRadius: 12, backgroundColor: '#F1F5F9', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#E2E8F0' },
    methodBtnActive: { backgroundColor: '#2D935C', borderColor: '#2D935C' },
    methodBtnText: { fontSize: 13, fontWeight: '700', color: '#64748B' },
    methodBtnTextActive: { color: '#FFF' },
    formGroup: { gap: 10 },
    inputLabel: { fontSize: 13, fontWeight: '700', color: '#475569', marginTop: 8 },
    textInput: { height: 48, borderRadius: 12, borderWidth: 1.5, borderColor: '#E2E8F0', paddingHorizontal: 16, fontSize: 14, color: '#1E293B', backgroundColor: '#F8FAFC' },
    inputTip: { fontSize: 11, color: '#64748B', fontStyle: 'italic' },
    submitBtn: { height: 50, borderRadius: 16, backgroundColor: '#2D935C', alignItems: 'center', justifyContent: 'center', marginTop: 20, shadowColor: '#2D935C', shadowOpacity: 0.2, shadowRadius: 10, elevation: 4 },
    submitBtnText: { color: '#FFF', fontSize: 15, fontWeight: '800' },
    bankCard: { borderRadius: 20, padding: 20, marginBottom: 10, minHeight: 160, overflow: "hidden", elevation: 4, backgroundColor: "#2D935C" },
    bankCardDeco1: { position: "absolute", width: 180, height: 180, borderRadius: 90, backgroundColor: "rgba(255,255,255,0.04)", top: -60, right: -60 },
    bankCardDeco2: { position: "absolute", width: 130, height: 130, borderRadius: 65, backgroundColor: "rgba(255,255,255,0.04)", bottom: -40, left: -20 },
    bankCardRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 15, alignItems: "center" },
    bankChip: { width: 34, height: 24, backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 4 },
    bankCardNumber: { fontSize: 17, fontWeight: "800", color: "#FFF", letterSpacing: 2, marginBottom: 15 },
    bankCardFooter: { flexDirection: "row", justifyContent: "space-between" },
    bankCardFieldLabel: { fontSize: 8, color: "rgba(255,255,255,0.6)", fontWeight: "700", marginBottom: 2 },
    bankCardFieldValue: { fontSize: 13, color: "#FFF", fontWeight: "700" },
});
