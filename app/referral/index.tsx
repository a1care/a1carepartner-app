import React, { useState } from 'react';
import {
    View, Text, TouchableOpacity, Share, StyleSheet,
    ActivityIndicator, ScrollView, Alert, TextInput, Clipboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { getRolePath } from '../../lib/roleApi';

const Colors = {
  primary: '#059669',
};

// Internal service to match customer app's structure
const referralService = {
  getMyCode: async () => {
    const res = await api.get('/referral/my-code');
    return res.data.data;
  },
  validate: async (code: string) => {
    const res = await api.post('/referral/validate', { code });
    return res.data.data;
  },
  getMyEarnings: async () => {
    const res = await api.get('/referral/my-earnings');
    return res.data.data as { 
        totalEarned: number; 
        totalPending: number; 
        items: any[]; 
    };
  },
};

export default function ReferralScreen() {
    const router = useRouter();
    const [friendCode, setFriendCode] = useState('');
    const [validating, setValidating] = useState(false);
    const [validResult, setValidResult] = useState<{ referrerName: string; rewardAmount: number } | null>(null);

    const { data, isLoading, isError } = useQuery({
        queryKey: ['referral-code'],
        queryFn: referralService.getMyCode,
    });

    const { data: earningsData } = useQuery({
        queryKey: ['referral-earnings'],
        queryFn: referralService.getMyEarnings,
    });

    const handleShare = async () => {
        if (!data?.shareMessage) return;
        try {
            await Share.share({ message: data.shareMessage });
        } catch (e) {
            // user dismissed
        }
    };

    const handleCopy = () => {
        if (!data?.referralCode) return;
        Clipboard.setString(data.referralCode);
        Alert.alert('Copied!', 'Referral code copied to clipboard.');
    };

    const handleValidateFriend = async () => {
        const code = friendCode.trim().toUpperCase();
        if (!code) { Alert.alert('Enter a code', 'Please enter a referral code to validate.'); return; }
        setValidating(true);
        setValidResult(null);
        try {
            const result = await referralService.validate(code);
            setValidResult(result);
        } catch (err: any) {
            Alert.alert('Invalid Code', err?.response?.data?.message || 'That referral code is not valid.');
        } finally {
            setValidating(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                        <Ionicons name="arrow-back" size={22} color="#0F172A" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Refer & Earn</Text>
                    <View style={{ width: 38 }} />
                </View>

                {/* Hero Banner */}
                <LinearGradient colors={['#0B3370', '#1E3A8A']} style={styles.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                    <View style={styles.heroBubble1} /><View style={styles.heroBubble2} />
                    <Ionicons name="gift" size={56} color="#F59E0B" style={{ marginBottom: 16 }} />
                    <Text style={styles.heroTitle}>Invite & Earn {data?.rewardAmount ? `₹${data.rewardAmount}` : ''}</Text>
                    <Text style={styles.heroSub}>For every friend or partner who signs up and completes a service using your code, you get {data?.rewardAmount ? `₹${data.rewardAmount}` : 'rewarded'} directly in your wallet.</Text>
                </LinearGradient>

                {/* Your Code */}
                <View style={styles.card}>
                    <Text style={styles.cardLabel}>YOUR REFERRAL CODE</Text>
                    {isLoading ? (
                        <ActivityIndicator color={Colors.primary} style={{ marginVertical: 16 }} />
                    ) : isError ? (
                        <Text style={{ color: '#EF4444', fontSize: 13 }}>Failed to load code</Text>
                    ) : (
                        <>
                            <View style={styles.codeRow}>
                                <Text style={styles.codeText}>{data?.referralCode ?? '—'}</Text>
                                <TouchableOpacity onPress={handleCopy} style={styles.copyBtn}>
                                    <Ionicons name="copy-outline" size={18} color={Colors.primary} />
                                </TouchableOpacity>
                            </View>
                            <TouchableOpacity onPress={handleShare} style={styles.shareBtn} activeOpacity={0.85}>
                                <LinearGradient colors={['#059669', '#047857']} style={styles.shareBtnInner} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                                    <Ionicons name="share-social" size={20} color="#FFF" />
                                    <Text style={styles.shareBtnText}>Share with Network</Text>
                                </LinearGradient>
                            </TouchableOpacity>
                        </>
                    )}
                </View>

                {/* Earnings Summary */}
                <View style={styles.card}>
                    <Text style={styles.cardLabel}>EARNINGS SUMMARY</Text>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 }}>
                        <View style={{ flex: 1, backgroundColor: '#F0FDF4', borderRadius: 20, padding: 20, marginRight: 8, borderWidth: 1, borderColor: '#DCFCE7' }}>
                            <Text style={{ fontSize: 12, color: '#059669', fontWeight: '800', marginBottom: 6, letterSpacing: 0.5 }}>TOTAL EARNED</Text>
                            <Text style={{ fontSize: 28, fontWeight: '900', color: '#047857', letterSpacing: -1 }}>₹{earningsData?.totalEarned || 0}</Text>
                        </View>
                        <View style={{ flex: 1, backgroundColor: '#FFF7ED', borderRadius: 20, padding: 20, marginLeft: 8, borderWidth: 1, borderColor: '#FFEDD5' }}>
                            <Text style={{ fontSize: 12, color: '#EA580C', fontWeight: '800', marginBottom: 6, letterSpacing: 0.5 }}>PENDING</Text>
                            <Text style={{ fontSize: 28, fontWeight: '900', color: '#C2410C', letterSpacing: -1 }}>₹{earningsData?.totalPending || 0}</Text>
                        </View>
                    </View>
                    <Text style={{ fontSize: 13, color: '#64748B', lineHeight: 20, fontWeight: '500' }}>Pending rewards will unlock automatically when they complete their first service.</Text>
                </View>

                {/* Referral History */}
                <View style={styles.card}>
                    <Text style={styles.cardLabel}>REFERRAL HISTORY</Text>
                    {(!earningsData?.items || earningsData.items.length === 0) ? (
                        <View style={{ paddingVertical: 20, alignItems: 'center' }}>
                            <Ionicons name="people-outline" size={32} color="#CBD5E1" />
                            <Text style={{ marginTop: 8, color: '#94A3B8', fontSize: 13, textAlign: 'center' }}>
                                No referrals yet. Share your code to start earning!
                            </Text>
                        </View>
                    ) : (
                        earningsData.items.map((item: any, index: number) => (
                            <View key={index} style={[styles.stepRow, { borderBottomWidth: index === earningsData.items.length - 1 ? 0 : 1, borderBottomColor: '#F1F5F9', paddingBottom: 12, marginBottom: 12 }]}>
                                <View style={[styles.stepIconBox, { backgroundColor: item.status === 'REWARDED' ? '#F0FDF4' : '#FFF7ED' }]}>
                                    <Ionicons 
                                        name={item.status === 'REWARDED' ? "checkmark-circle" : "time"} 
                                        size={20} 
                                        color={item.status === 'REWARDED' ? Colors.primary : "#EA580C"} 
                                    />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={{ fontSize: 14, fontWeight: '600', color: '#1E293B' }}>{item.refereeId?.name || 'Pending'}</Text>
                                    <Text style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>{item.status === 'REWARDED' ? 'Earned Reward' : 'Pending First Service'}</Text>
                                </View>
                                <Text style={{ fontSize: 15, fontWeight: 'bold', color: item.status === 'REWARDED' ? Colors.primary : "#EA580C" }}>
                                    +₹{item.rewardAmount}
                                </Text>
                            </View>
                        ))
                    )}
                </View>

                <View style={{ height: 40 }} />
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F4F7FC' },
    scroll: { paddingHorizontal: 24, paddingBottom: 24 },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 16, marginBottom: 8 },
    backBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center', shadowColor: '#0F172A', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
    headerTitle: { fontSize: 22, fontWeight: '900', color: '#0F172A', letterSpacing: -0.5 },
    hero: { borderRadius: 32, padding: 32, marginBottom: 24, alignItems: 'center', overflow: 'hidden', position: 'relative', elevation: 8, shadowColor: '#0B3370', shadowOpacity: 0.25, shadowOffset: { width: 0, height: 8 }, shadowRadius: 24 },
    heroBubble1: { position: 'absolute', top: -40, right: -40, width: 150, height: 150, borderRadius: 75, backgroundColor: 'rgba(255,255,255,0.06)' },
    heroBubble2: { position: 'absolute', bottom: -20, left: -20, width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(255,255,255,0.06)' },
    heroTitle: { fontSize: 26, fontWeight: '900', color: '#FFFFFF', textAlign: 'center', marginBottom: 12, letterSpacing: -0.5 },
    heroSub: { fontSize: 14, color: 'rgba(255,255,255,0.85)', textAlign: 'center', lineHeight: 22, fontWeight: '500' },
    card: { backgroundColor: '#FFFFFF', borderRadius: 32, padding: 28, marginBottom: 20, shadowColor: '#0F172A', shadowOpacity: 0.04, shadowRadius: 20, shadowOffset: { width: 0, height: 10 }, elevation: 4, borderWidth: 1.5, borderColor: '#E2E8F0' },
    cardLabel: { fontSize: 12, fontWeight: '900', color: '#64748B', letterSpacing: 1.5, marginBottom: 16 },
    codeRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F0FDF4', borderRadius: 20, paddingHorizontal: 24, paddingVertical: 18, marginBottom: 20, borderWidth: 1, borderColor: '#DCFCE7' },
    codeText: { flex: 1, fontSize: 32, fontWeight: '900', color: '#059669', letterSpacing: 8 },
    copyBtn: { padding: 8 },
    shareBtn: { borderRadius: 20, overflow: 'hidden', shadowColor: '#059669', shadowOpacity: 0.25, shadowOffset: { width: 0, height: 6 }, shadowRadius: 12, elevation: 6 },
    shareBtnInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 18 },
    shareBtnText: { fontSize: 16, fontWeight: '900', color: '#FFF', letterSpacing: 0.5 },
    stepRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 16, marginBottom: 16 },
    stepIconBox: { width: 44, height: 44, borderRadius: 16, backgroundColor: '#F0FDF4', justifyContent: 'center', alignItems: 'center' },
    stepText: { flex: 1, fontSize: 15, color: '#475569', fontWeight: '600', lineHeight: 22, marginTop: 7 },
});
