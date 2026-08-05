import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, RefreshControl, Platform, Animated, Modal, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { getRolePath } from '../../lib/roleApi';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Toast } from '../../components/CustomToast';
// @ts-ignore
import RazorpayCheckout from 'react-native-razorpay';

const StatCard = ({ title, amount, icon, color }: any) => (
    <View style={styles.statCard}>
        <View style={styles.statCardTopRow}>
            <View style={[styles.iconContainer, { backgroundColor: color + '15' }]}>
                <MaterialCommunityIcons name={icon} size={22} color={color} />
            </View>
        </View>
        <Text style={styles.statTitle}>{title}</Text>
        <Text style={styles.statAmount} numberOfLines={1}>
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
                    <View style={{ height: 160 }} />
                </Animated.View>
                <View style={styles.statsGrid}>
                    {[1, 2, 3, 4].map((i) => (
                        <Animated.View key={i} style={[styles.statCard, { opacity: pulseAnim, backgroundColor: '#E2E8F0', height: 120, elevation: 0 }]} />
                    ))}
                </View>
            </ScrollView>
        </SafeAreaView>
    );
};

export default function EarningsScreen() {
    const queryClient = useQueryClient();
    const [refreshing, setRefreshing] = useState(false);
    
    // Modals
    const [isWithdrawModalVisible, setIsWithdrawModalVisible] = useState(false);
    const [isTopUpModalVisible, setIsTopUpModalVisible] = useState(false);
    
    const [withdrawAmount, setWithdrawAmount] = useState('');
    const [topUpAmount, setTopUpAmount] = useState('');
    
    const [payoutMethod, setPayoutMethod] = useState<'UPI' | 'BANK'>('UPI');
    const [upiId, setUpiId] = useState('');
    const [bankDetails, setBankDetails] = useState({
        accountHolderName: '', bankName: '', accountNumber: '', confirmAccountNumber: '', ifscCode: ''
    });
    const [useDifferentBank, setUseDifferentBank] = useState(false);
    const [upiVerificationStatus, setUpiVerificationStatus] = useState<'idle' | 'verifying' | 'verified' | 'failed'>('idle');
    const [upiAccountName, setUpiAccountName] = useState('');

    const [activeTab, setActiveTab] = useState<'PAYOUTS' | 'BOOKINGS'>('PAYOUTS');

    const handleVerifyUpi = () => {
        if (!upiId.trim() || !upiId.includes('@')) {
            Alert.alert('Invalid UPI', 'Please enter a valid UPI ID format');
            return;
        }
        setUpiVerificationStatus('verifying');
        setTimeout(() => {
            setUpiVerificationStatus('verified');
            setUpiAccountName(staffDetails?.bankDetails?.accountHolderName || 'Partner');
        }, 1200);
    };

    const handleUpiChange = (text: string) => {
        setUpiId(text);
        setUpiVerificationStatus('idle');
        setUpiAccountName('');
    };

    const { data: summary, isLoading, refetch } = useQuery({
        queryKey: ['staff_earnings'],
        queryFn: async () => { const res = await api.get(`/${getRolePath()}/earnings/summary`); return res.data.data; }
    });

    const { data: payouts, refetch: refetchPayouts } = useQuery({
        queryKey: ['staff_payouts'],
        queryFn: async () => { const res = await api.get(`/${getRolePath()}/earnings/payouts`); return res.data.data; }
    });

    const { data: bookingHistory, refetch: refetchHistory } = useQuery({
        queryKey: ['staff_booking_earnings'],
        queryFn: async () => { const res = await api.get(`/${getRolePath()}/earnings/history`); return res.data.data; }
    });

    const { data: staffDetails } = useQuery({
        queryKey: ['staffDetailsForPayout'],
        queryFn: async () => { const res = await api.get(`/${getRolePath()}/auth/details`); return res.data.data; }
    });

    useEffect(() => {
        if (isWithdrawModalVisible) {
            setUseDifferentBank(false);
            if (staffDetails?.bankDetails) {
                const bd = staffDetails.bankDetails;
                if (bd.upiId) setUpiId(bd.upiId);
                setBankDetails({
                    accountHolderName: bd.accountHolderName || '',
                    bankName: bd.bankName || '',
                    accountNumber: bd.accountNumber || '',
                    confirmAccountNumber: bd.accountNumber || '',
                    ifscCode: bd.ifscCode || ''
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
                Toast.show({ type: 'success', text1: 'Success', text2: 'Withdrawal request submitted.' });
            } else {
                Alert.alert('Success', 'Withdrawal request submitted successfully.');
            }
            queryClient.invalidateQueries({ queryKey: ['staff_earnings'] });
            queryClient.invalidateQueries({ queryKey: ['staff_payouts'] });
            setIsWithdrawModalVisible(false);
        },
        onError: (err: any) => {
            const msg = err?.response?.data?.message || 'Something went wrong';
            if (Platform.OS === 'web') Toast.show({ type: 'error', text1: 'Extraction Failed', text2: msg });
            else Alert.alert('Extraction Failed', msg);
        }
    });

    const topUpMutation = useMutation({
        mutationFn: async (amt: number) => {
            const orderRes = await api.post('/payments/orders/create', { amount: amt, type: 'WALLET_TOPUP' });
            const order = orderRes.data?.data;
            const razorRes = await api.post('/payments/razorpay/initiate', { orderId: order._id });
            const razorData = razorRes.data?.data;

            const paymentData: any = await RazorpayCheckout.open({
                key: razorData.key,
                amount: razorData.razorOrder.amount,
                currency: 'INR',
                name: 'A1Care 24/7',
                description: 'Wallet Top-up',
                order_id: razorData.razorOrder.id,
                prefill: { email: razorData.customer?.email || '', contact: razorData.customer?.contact || '', name: razorData.customer?.name || '' },
                theme: { color: '#059669' },
            });

            await api.post('/payments/razorpay/verify', {
                razorpay_order_id: paymentData.razorpay_order_id,
                razorpay_payment_id: paymentData.razorpay_payment_id,
                razorpay_signature: paymentData.razorpay_signature,
                orderId: order._id,
            });
            return amt;
        },
        onSuccess: (amt) => {
            queryClient.invalidateQueries({ queryKey: ['staff_earnings'] });
            setIsTopUpModalVisible(false);
            setTopUpAmount('');
            if (Platform.OS === 'web') Toast.show({ type: 'success', text1: 'Success', text2: `₹${amt} added.` });
            else Alert.alert('Success', `₹${amt} successfully added to your wallet.`);
        },
        onError: (err: any) => {
            if (err?.message) Alert.alert('Error', err.message);
            else Alert.alert('Cancelled', 'You cancelled the payment.');
        }
    });

    const onRefresh = async () => {
        setRefreshing(true);
        await Promise.all([refetch(), refetchPayouts(), refetchHistory()]);
        setRefreshing(false);
    };

    if (isLoading) return <EarningsSkeleton />;

    const { stats, balance } = summary || { stats: {}, balance: 0 };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Financial Overview</Text>
                <TouchableOpacity onPress={onRefresh} style={styles.refreshBtn}>
                    <Ionicons name="reload" size={16} color="#64748B" />
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
                
                {/* Premium Balance Card */}
                <View style={styles.balanceCard}>
                    <Text style={styles.watermark}>A1CARE</Text>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <Text style={styles.balanceLabel}>SETTLEMENT BALANCE</Text>
                        <Ionicons name="wallet-outline" size={24} color="rgba(255,255,255,0.4)" />
                    </View>
                    <Text style={styles.balanceAmount}>₹{Number(balance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
                    <Text style={styles.partnerName}>{staffDetails?.name || staffDetails?.bankDetails?.accountHolderName || 'Partner'}</Text>

                    <View style={styles.actionRow}>
                        <TouchableOpacity style={[styles.actionBtn, withdrawMutation.isPending && { opacity: 0.6 }]} disabled={withdrawMutation.isPending} onPress={() => {
                            if (!balance || balance < 500) {
                                if (Platform.OS === 'web') Toast.show({ type: "error", text1: "Insufficient Balance", text2: "Minimum withdrawal is ₹500." });
                                else Alert.alert('Insufficient Balance', 'Minimum withdrawal amount is ₹500.');
                                return;
                            }
                            setWithdrawAmount(String(balance));
                            setIsWithdrawModalVisible(true);
                        }}>
                            <MaterialCommunityIcons name="bank-transfer-out" size={20} color="#FFF" />
                            <Text style={styles.actionBtnText}>Withdraw</Text>
                        </TouchableOpacity>
                        
                        <View style={styles.actionDivider} />
                        
                        <TouchableOpacity style={styles.actionBtn} onPress={() => setIsTopUpModalVisible(true)}>
                            <MaterialCommunityIcons name="plus-circle-outline" size={20} color="#FFF" />
                            <Text style={styles.actionBtnText}>Add Money</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Grid Stats */}
                <View style={styles.statsGrid}>
                    <StatCard title="Total Earnings" amount={stats.totalEarnings || 0} icon="cash-multiple" color="#059669" />
                    <StatCard title="Today's Sales" amount={stats.today || 0} icon="trending-up" color="#6366F1" />
                    <StatCard title="This Week" amount={stats.thisWeek || 0} icon="calendar-week" color="#F59E0B" />
                    <StatCard title="Withdrawn" amount={stats.withdrawn || 0} icon="bank-transfer-out" color="#EC4899" />
                </View>

                {/* Sub Tab Switcher */}
                <View style={styles.tabSwitcher}>
                    <TouchableOpacity style={[styles.tabButton, activeTab === 'PAYOUTS' && styles.tabButtonActive]} onPress={() => setActiveTab('PAYOUTS')}>
                        <Text style={[styles.tabButtonText, activeTab === 'PAYOUTS' && styles.tabButtonTextActive]}>Payout Requests</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.tabButton, activeTab === 'BOOKINGS' && styles.tabButtonActive]} onPress={() => setActiveTab('BOOKINGS')}>
                        <Text style={[styles.tabButtonText, activeTab === 'BOOKINGS' && styles.tabButtonTextActive]}>Booking Earnings</Text>
                    </TouchableOpacity>
                </View>

                {/* History List */}
                {activeTab === 'PAYOUTS' ? (
                    payouts?.length > 0 ? (
                        payouts.map((p: any) => {
                            const isSub = p.adminNote?.toLowerCase().includes('subscription');
                            const isUpi = p.bankDetails?.upiId || p.method === 'UPI';
                            const title = isSub ? (p.adminNote.length > 25 ? p.adminNote.substring(0, 25) + '...' : p.adminNote) : (isUpi ? 'Withdrawal • UPI' : 'Withdrawal • Bank Account');
                            const iconName = isSub ? 'crown' : (isUpi ? 'qrcode-scan' : 'bank');
                            const iconColor = isSub ? '#F59E0B' : '#EF4444';
                            const iconBg = isSub ? '#FEF3C7' : '#FEF2F2';

                            return (
                                <View key={p._id} style={styles.transactionItem}>
                                    <View style={[styles.transactionIconBox, { backgroundColor: iconBg }]}>
                                        <MaterialCommunityIcons name={iconName} size={22} color={iconColor} />
                                    </View>
                                    <View style={styles.transactionInfo}>
                                        <Text style={styles.transactionTitle} numberOfLines={1}>
                                            {title}
                                        </Text>
                                        <Text style={styles.transactionDate}>{new Date(p.createdAt).toLocaleDateString("en-IN", { day: '2-digit', month: 'short', year: 'numeric' })}</Text>
                                    </View>
                                <View style={styles.transactionAmountSection}>
                                    <Text style={styles.transactionAmountNegative}>-₹{Number(p.amount || 0).toLocaleString('en-IN')}</Text>
                                    <View style={[styles.transactionStatus, { backgroundColor: p.status === 'COMPLETED' ? '#ECFDF5' : p.status === 'PENDING' ? '#FFFBEB' : p.status === 'APPROVED' ? '#EFF6FF' : '#FEF2F2' }]}>
                                        <Text style={[styles.transactionStatusText, { color: p.status === 'COMPLETED' ? '#10B981' : p.status === 'PENDING' ? '#D97706' : p.status === 'APPROVED' ? '#3B82F6' : '#EF4444' }]}>
                                            {p.status === 'COMPLETED' ? 'Settled' : p.status === 'PENDING' ? 'Processing' : p.status === 'APPROVED' ? 'Approved' : 'Failed'}
                                        </Text>
                                    </View>
                                </View>
                            </View>
                            );
                        })
                    ) : (
                        <View style={styles.emptyState}>
                            <Ionicons name="receipt-outline" size={48} color="#E2E8F0" />
                            <Text style={styles.emptyText}>No payout history found yet.</Text>
                        </View>
                    )
                ) : (
                    bookingHistory?.length > 0 ? (
                        bookingHistory.map((bh: any) => (
                            <View key={bh._id} style={styles.transactionItem}>
                                <View style={[styles.transactionIconBox, { backgroundColor: '#F0FDF4' }]}>
                                    <MaterialCommunityIcons name={bh.type === 'WALLET_TOPUP' ? 'wallet-plus' : 'briefcase-check'} size={22} color="#10B981" />
                                </View>
                                <View style={styles.transactionInfo}>
                                    <Text style={styles.transactionTitle} numberOfLines={1}>
                                        {bh.type === 'WALLET_TOPUP' ? 'Wallet Top-up Added' : (bh.type || 'Booking Settlement')}
                                    </Text>
                                    <Text style={styles.transactionDetails} numberOfLines={1}>
                                        {bh.details || (bh.type === 'WALLET_TOPUP' ? 'Self-added via Razorpay' : 'Service Completed Successfully')}
                                    </Text>
                                    <Text style={styles.transactionDate}>{new Date(bh.createdAt).toLocaleDateString("en-IN", { day: '2-digit', month: 'short', year: 'numeric' })}</Text>
                                </View>
                                <View style={styles.transactionAmountSection}>
                                    <Text style={styles.transactionAmountPositive}>+₹{Number(bh.partnerEarning || bh.amount || 0).toLocaleString('en-IN')}</Text>
                                    {bh.totalAmount ? (
                                        <Text style={styles.transactionMetaVal}>Booking: ₹{bh.totalAmount}</Text>
                                    ) : null}
                                </View>
                            </View>
                        ))
                    ) : (
                        <View style={styles.emptyState}>
                            <Ionicons name="shield-checkmark-outline" size={48} color="#E2E8F0" />
                            <Text style={styles.emptyText}>No booking earnings completed yet.</Text>
                        </View>
                    )
                )}
            </ScrollView>

            {/* WITHDRAW MODAL */}
            <Modal visible={isWithdrawModalVisible} animationType="slide" transparent={true} onRequestClose={() => setIsWithdrawModalVisible(false)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <View>
                                <Text style={styles.modalTitle}>Request Payout</Text>
                                <Text style={styles.modalSub}>Available: <Text style={{fontWeight: '900', color: '#0F172A'}}>₹{balance}</Text></Text>
                            </View>
                            <TouchableOpacity onPress={() => setIsWithdrawModalVisible(false)} style={styles.closeBtn}>
                                <Ionicons name="close" size={20} color="#0F172A" />
                            </TouchableOpacity>
                        </View>


                        <View style={styles.premiumSegmentContainer}>
                            <TouchableOpacity style={[styles.premiumSegmentBtn, payoutMethod === 'UPI' && styles.premiumSegmentBtnActive]} onPress={() => setPayoutMethod('UPI')}>
                                <MaterialCommunityIcons name="qrcode-scan" size={18} color={payoutMethod === 'UPI' ? '#059669' : '#64748B'} style={{marginRight: 6}} />
                                <Text style={[styles.premiumSegmentText, payoutMethod === 'UPI' && styles.premiumSegmentTextActive]}>UPI</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.premiumSegmentBtn, payoutMethod === 'BANK' && styles.premiumSegmentBtnActive]} onPress={() => setPayoutMethod('BANK')}>
                                <MaterialCommunityIcons name="bank" size={18} color={payoutMethod === 'BANK' ? '#059669' : '#64748B'} style={{marginRight: 6}} />
                                <Text style={[styles.premiumSegmentText, payoutMethod === 'BANK' && styles.premiumSegmentTextActive]}>Bank</Text>
                            </TouchableOpacity>
                        </View>
                        <ScrollView style={{ maxHeight: 330, marginVertical: 15 }} showsVerticalScrollIndicator={false}>
                            {payoutMethod === 'UPI' ? (
                                <View style={styles.formGroup}>
                                    <Text style={styles.inputLabelBold}>UPI ID / VPA</Text>
                                    <View style={styles.inputBox}>
                                        <TextInput style={styles.inputText} placeholder="e.g. name@upi" placeholderTextColor="#94A3B8" value={upiId} onChangeText={handleUpiChange} autoCapitalize="none" />
                                        {upiVerificationStatus === 'verifying' ? <ActivityIndicator size="small" color="#059669" /> : upiVerificationStatus === 'verified' ? <Ionicons name="checkmark-circle" size={22} color="#059669" /> : upiId.trim().includes('@') ? <TouchableOpacity onPress={handleVerifyUpi}><Text style={{ color: '#059669', fontWeight: '800', fontSize: 13 }}>Verify</Text></TouchableOpacity> : null}
                                    </View>
                                    {upiVerificationStatus === 'verified' && <Text style={{ color: '#059669', fontSize: 12, fontWeight: '700', marginLeft: 4, marginTop: -2 }}>✓ Verified: {upiAccountName}</Text>}
                                </View>
                            ) : (
                                staffDetails?.bankDetails?.accountNumber && !useDifferentBank ? (
                                    <View style={{ gap: 12, paddingHorizontal: 4 }}>
                                        <Text style={styles.inputLabelBold}>Saved Settlement Bank Account</Text>
                                        <View style={styles.savedBankCard}>
                                            <View style={styles.savedBankCardDeco1} />
                                            <View style={styles.savedBankCardRow}>
                                                <View style={styles.bankChip} />
                                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                                    <Text style={{ color: '#FFF', fontSize: 11, fontWeight: '800' }}>SELECTED</Text>
                                                    <Ionicons name="checkmark-circle" size={18} color="#FFF" />
                                                </View>
                                            </View>
                                            <Text style={styles.savedBankCardNumber}>{staffDetails.bankDetails.accountNumber.replace(/(\d{4})/g, '$1 ').trim()}</Text>
                                            <View style={styles.savedBankCardFooter}>
                                                <View>
                                                    <Text style={styles.savedBankCardFieldLabel}>ACCOUNT HOLDER</Text>
                                                    <Text style={styles.savedBankCardFieldValue}>{staffDetails.bankDetails.accountHolderName}</Text>
                                                </View>
                                                <View style={{ alignItems: "flex-end" }}>
                                                    <Text style={styles.savedBankCardFieldLabel}>IFSC CODE</Text>
                                                    <Text style={styles.savedBankCardFieldValue}>{staffDetails.bankDetails.ifscCode}</Text>
                                                </View>
                                            </View>
                                        </View>
                                        <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'center', marginTop: 5 }} onPress={() => setUseDifferentBank(true)}>
                                            <Ionicons name="create-outline" size={16} color="#059669" />
                                            <Text style={{ color: '#059669', fontWeight: '800', fontSize: 13 }}>Use a different bank account</Text>
                                        </TouchableOpacity>
                                    </View>
                                ) : (
                                    <View style={styles.formGroup}>
                                        <Text style={styles.inputLabelBold}>Account Holder Name</Text>
                                        <View style={styles.inputBox}><TextInput style={styles.inputText} placeholder="Name as in bank record" value={bankDetails.accountHolderName} onChangeText={(v) => setBankDetails({ ...bankDetails, accountHolderName: v })} /></View>
                                        <Text style={styles.inputLabelBold}>Bank Name</Text>
                                        <View style={styles.inputBox}><TextInput style={styles.inputText} placeholder="e.g. State Bank of India" value={bankDetails.bankName} onChangeText={(v) => setBankDetails({ ...bankDetails, bankName: v })} /></View>
                                        <Text style={styles.inputLabelBold}>Account Number</Text>
                                        <View style={styles.inputBox}><TextInput style={styles.inputText} placeholder="Enter Account Number" keyboardType="numeric" value={bankDetails.accountNumber} onChangeText={(v) => setBankDetails({ ...bankDetails, accountNumber: v })} /></View>
                                        <Text style={styles.inputLabelBold}>Confirm Account Number</Text>
                                        <View style={styles.inputBox}><TextInput style={styles.inputText} placeholder="Re-enter Account Number" keyboardType="numeric" value={bankDetails.confirmAccountNumber} onChangeText={(v) => setBankDetails({ ...bankDetails, confirmAccountNumber: v })} /></View>
                                        <Text style={styles.inputLabelBold}>IFSC Code</Text>
                                        <View style={styles.inputBox}><TextInput style={styles.inputText} placeholder="e.g. SBIN0001234" autoCapitalize="characters" value={bankDetails.ifscCode} onChangeText={(v) => setBankDetails({ ...bankDetails, ifscCode: v })} /></View>
                                    </View>
                                )
                            )}
                        </ScrollView>
                        <TouchableOpacity style={styles.submitBtn} disabled={withdrawMutation.isPending} onPress={() => {
                            if (payoutMethod === 'UPI') {
                                if (!upiId.trim() || upiVerificationStatus !== 'verified') { Alert.alert('Error', 'Verify UPI ID'); return; }
                                withdrawMutation.mutate({ amount: balance, payoutMethod: 'UPI', upiId });
                            } else {
                                if (staffDetails?.bankDetails?.accountNumber && !useDifferentBank) withdrawMutation.mutate({ amount: balance, payoutMethod: 'BANK', bankDetails: staffDetails.bankDetails });
                                else {
                                    const { accountNumber, confirmAccountNumber, accountHolderName, bankName, ifscCode } = bankDetails;
                                    if (!accountHolderName.trim() || !bankName.trim() || !accountNumber.trim() || !confirmAccountNumber.trim() || !ifscCode.trim()) { Alert.alert("Input Error", "Please fill in all bank details fields"); return; }
                                    if (accountNumber !== confirmAccountNumber) { Alert.alert("Input Error", "Account numbers do not match"); return; }
                                    withdrawMutation.mutate({ amount: balance, payoutMethod: 'BANK', bankDetails });
                                }
                            }
                        }}>
                            <Text style={styles.submitBtnText}>{withdrawMutation.isPending ? "Submitting..." : "Confirm & Request"}</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* ADD MONEY (TOP-UP) MODAL */}
            <Modal visible={isTopUpModalVisible} animationType="slide" transparent={true} onRequestClose={() => setIsTopUpModalVisible(false)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Add Money</Text>
                            <TouchableOpacity onPress={() => setIsTopUpModalVisible(false)}>
                                <Ionicons name="close" size={24} color="#64748B" />
                            </TouchableOpacity>
                        </View>
                        <View style={{ marginTop: 10 }}>
                            <Text style={styles.inputLabelBold}>ENTER DEPOSIT AMOUNT</Text>
                            <View style={styles.amountInputContainer}>
                                <Text style={styles.currencySymbol}>₹</Text>
                                <TextInput style={styles.amountInput} keyboardType="numeric" value={topUpAmount} onChangeText={setTopUpAmount} placeholder="0" placeholderTextColor="#94A3B8" />
                            </View>
                            <View style={styles.quickAmts}>
                                {[500, 1000, 2000, 5000].map(val => (
                                    <TouchableOpacity key={val} style={styles.quickAmtBtn} onPress={() => setTopUpAmount(val.toString())}>
                                        <Text style={styles.quickAmtText}>+₹{val}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                            <TouchableOpacity style={[styles.submitBtn, { marginTop: 30 }]} disabled={topUpMutation.isPending} onPress={() => {
                                const amountNum = parseFloat(topUpAmount);
                                if (isNaN(amountNum) || amountNum <= 0) { Alert.alert('Invalid', 'Please enter a valid amount'); return; }
                                topUpMutation.mutate(amountNum);
                            }}>
                                <Text style={styles.submitBtnText}>{topUpMutation.isPending ? 'Processing...' : 'Proceed to Secure Payment'}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingTop: 16, paddingBottom: 16 },
    refreshBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center' },
    headerTitle: { fontSize: 24, fontWeight: '900', color: '#0F172A', letterSpacing: -0.5 },
    scrollContent: { paddingHorizontal: 24, paddingTop: 10, paddingBottom: 110 },
    balanceCard: { backgroundColor: '#059669', borderRadius: 32, padding: 28, marginBottom: 24, elevation: 12, shadowColor: '#059669', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.25, shadowRadius: 20, overflow: 'hidden' },
    watermark: { position: 'absolute', bottom: -20, right: -15, fontSize: 60, fontWeight: '900', color: 'rgba(255,255,255,0.06)', letterSpacing: 2 },
    balanceLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 11, fontWeight: '900', marginBottom: 12, letterSpacing: 1.2 },
    balanceAmount: { color: '#FFF', fontSize: 44, fontWeight: '900', letterSpacing: -1.5, marginBottom: 4 },
    partnerName: { color: 'rgba(255,255,255,0.9)', fontSize: 14, fontWeight: '800', letterSpacing: 0.5, marginBottom: 28 },
    actionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 20, paddingVertical: 14, paddingHorizontal: 24 },
    actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    actionBtnText: { color: '#FFF', fontSize: 14, fontWeight: '900' },
    actionDivider: { width: 1, height: 24, backgroundColor: 'rgba(255,255,255,0.3)' },
    statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginBottom: 32 },
    statCard: { width: '47.5%', backgroundColor: '#FFF', borderRadius: 28, padding: 20, elevation: 8, shadowColor: '#0F172A', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.06, shadowRadius: 20 },
    statCardTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    iconContainer: { width: 44, height: 44, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
    statTitle: { color: '#64748B', fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 },
    statAmount: { fontSize: 24, fontWeight: '900', color: '#0F172A', letterSpacing: -1 },
    tabSwitcher: { flexDirection: 'row', backgroundColor: '#F1F5F9', padding: 6, borderRadius: 20, marginBottom: 24 },
    tabButton: { flex: 1, paddingVertical: 14, alignItems: 'center', borderRadius: 16 },
    tabButtonActive: { backgroundColor: '#FFF', elevation: 2, shadowColor: '#0F172A', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4 },
    tabButtonText: { fontSize: 13, fontWeight: '900', color: '#64748B' },
    tabButtonTextActive: { color: '#0F172A' },
    transactionItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', padding: 18, borderRadius: 24, marginBottom: 14, gap: 14, borderWidth: 1.5, borderColor: '#E2E8F0', shadowColor: '#0F172A', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 8, elevation: 1 },
    transactionIconBox: { width: 48, height: 48, borderRadius: 16, backgroundColor: '#F8FAFC', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#F1F5F9' },
    transactionInfo: { flex: 1, justifyContent: 'center' },
    transactionTitle: { fontSize: 15, fontWeight: '900', color: '#0F172A', letterSpacing: -0.3 },
    transactionDetails: { fontSize: 12, color: '#64748B', marginTop: 4, fontWeight: '700' },
    transactionDate: { fontSize: 11, color: '#94A3B8', marginTop: 6, fontWeight: '800' },
    transactionAmountSection: { alignItems: 'flex-end', justifyContent: 'center' },
    transactionAmountPositive: { fontSize: 17, fontWeight: '900', color: '#10B981', letterSpacing: -0.3 },
    transactionAmountNegative: { fontSize: 17, fontWeight: '900', color: '#EF4444', letterSpacing: -0.3 },
    transactionStatus: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, marginTop: 8 },
    transactionStatusText: { fontSize: 10, fontWeight: '900', letterSpacing: 0.5, textTransform: 'uppercase' },
    transactionMetaVal: { fontSize: 11, color: '#94A3B8', marginTop: 6, fontWeight: '800' },
    emptyState: { alignItems: 'center', marginTop: 60, opacity: 0.7 },
    emptyText: { color: '#94A3B8', marginTop: 16, fontWeight: '900', fontSize: 15 },
    serviceTitleText: { fontSize: 15, fontWeight: '900', color: '#0F172A', letterSpacing: -0.3 },
    serviceDetailsText: { fontSize: 12, color: '#64748B', marginTop: 4, fontWeight: '700' },
    earningText: { fontSize: 16, fontWeight: '900', color: '#059669', letterSpacing: -0.5 },
    totalBookingVal: { fontSize: 11, color: '#94A3B8', marginTop: 4, fontWeight: '800' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.6)', justifyContent: 'flex-end' },
    modalContent: { backgroundColor: '#FFF', borderTopLeftRadius: 40, borderTopRightRadius: 40, padding: 32, paddingBottom: 48, minHeight: 450, shadowColor: '#000', shadowOffset: { width: 0, height: -10 }, shadowOpacity: 0.1, shadowRadius: 20, elevation: 20 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
    modalTitle: { fontSize: 28, fontWeight: '900', color: '#0F172A', letterSpacing: -1, marginBottom: 4 },
    modalSub: { fontSize: 15, color: '#64748B', fontWeight: '600' },
    closeBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center' },
    premiumSegmentContainer: { flexDirection: 'row', backgroundColor: '#F1F5F9', padding: 6, borderRadius: 20, marginBottom: 24 },
    premiumSegmentBtn: { flex: 1, height: 48, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
    premiumSegmentBtnActive: { backgroundColor: '#FFF', shadowColor: '#0F172A', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 4 },
    premiumSegmentText: { fontSize: 15, fontWeight: '800', color: '#64748B' },
    premiumSegmentTextActive: { color: '#0F172A', fontWeight: '900' },
    formGroup: { gap: 16 },
    inputLabelBold: { fontSize: 12, fontWeight: '900', color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: -4 },
    inputBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', borderRadius: 16, borderWidth: 1.5, borderColor: '#E2E8F0', paddingRight: 12 },
    inputText: { flex: 1, height: 56, paddingHorizontal: 20, fontSize: 15, color: '#0F172A', fontWeight: '800', outlineStyle: 'none' } as any,
    amountInputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F0FDF4', borderRadius: 20, borderWidth: 2, borderColor: '#86EFAC', paddingHorizontal: 24, height: 80, marginVertical: 12 },
    currencySymbol: { fontSize: 40, fontWeight: '900', color: '#166534', marginRight: 12 },
    amountInput: { flex: 1, fontSize: 48, fontWeight: '900', color: '#166534', outlineStyle: 'none' } as any,
    submitBtn: { backgroundColor: '#059669', height: 64, borderRadius: 20, justifyContent: 'center', alignItems: 'center', shadowColor: '#059669', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 8, marginTop: 10 },
    submitBtnText: { color: '#FFF', fontSize: 18, fontWeight: '900', letterSpacing: 0.5 },
    savedBankCard: { backgroundColor: '#1E293B', borderRadius: 24, padding: 24, marginTop: 8, overflow: 'hidden', elevation: 8 },
    savedBankCardDeco1: { position: 'absolute', width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(255,255,255,0.03)', top: -100, right: -50 },
    savedBankCardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
    bankChip: { width: 44, height: 32, backgroundColor: '#94A3B8', borderRadius: 8, opacity: 0.8 },
    savedBankCardNumber: { color: '#FFF', fontSize: 24, fontWeight: '900', letterSpacing: 2, marginBottom: 24 },
    savedBankCardFooter: { flexDirection: 'row', justifyContent: 'space-between' },
    savedBankCardFieldLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 10, fontWeight: '900', letterSpacing: 1, marginBottom: 4 },
    savedBankCardFieldValue: { color: '#FFF', fontSize: 14, fontWeight: '800' },
    quickAmts: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginTop: 12 },
    quickAmtBtn: { flex: 1, height: 48, backgroundColor: '#F8FAFC', borderRadius: 14, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: '#E2E8F0' },
    quickAmtText: { color: '#475569', fontWeight: '900', fontSize: 14 }
});
