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
  primary: '#15803D',
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
  }
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
                <LinearGradient colors={['#15803D', '#166534']} style={styles.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                    <View style={styles.heroBubble1} /><View style={styles.heroBubble2} />
                    <Ionicons name="gift" size={48} color="rgba(255,255,255,0.3)" style={{ marginBottom: 12 }} />
                    <Text style={styles.heroTitle}>Invite & Earn {data?.rewardAmount ? `₹${data.rewardAmount}` : ''}</Text>
                    <Text style={styles.heroSub}>For every friend or partner who signs up and completes a service using your code, you get {data?.rewardAmount ? `₹${data.rewardAmount}` : 'rewarded'} in your A1Care wallet.</Text>
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
                                <LinearGradient colors={['#15803D', '#166534']} style={styles.shareBtnInner} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                                    <Ionicons name="share-social" size={18} color="#FFF" />
                                    <Text style={styles.shareBtnText}>Share with Network</Text>
                                </LinearGradient>
                            </TouchableOpacity>
                        </>
                    )}
                </View>

                {/* How it works */}
                <View style={styles.card}>
                    <Text style={styles.cardLabel}>HOW IT WORKS</Text>
                    {[
                        { icon: 'share-social-outline', text: 'Share your unique referral code' },
                        { icon: 'person-add-outline', text: 'They sign up and enter your code' },
                        { icon: 'checkmark-circle-outline', text: 'They complete their first job or booking' },
                        { icon: 'wallet-outline', text: 'You get the reward credited to your wallet' },
                    ].map((step, i) => (
                        <View key={i} style={styles.stepRow}>
                            <View style={styles.stepIconBox}>
                                <Ionicons name={step.icon as any} size={18} color={Colors.primary} />
                            </View>
                            <Text style={styles.stepText}>{step.text}</Text>
                        </View>
                    ))}
                </View>

                <View style={{ height: 40 }} />
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },
    scroll: { paddingHorizontal: 20, paddingBottom: 20 },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 16 },
    backBtn: { width: 38, height: 38, borderRadius: 12, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center' },
    headerTitle: { fontSize: 18, fontWeight: '800', color: '#0F172A' },
    hero: { borderRadius: 24, padding: 28, marginBottom: 20, alignItems: 'center', overflow: 'hidden', position: 'relative' },
    heroBubble1: { position: 'absolute', top: -40, right: -40, width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(255,255,255,0.08)' },
    heroBubble2: { position: 'absolute', bottom: -20, left: -20, width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(255,255,255,0.08)' },
    heroTitle: { fontSize: 22, fontWeight: '900', color: '#FFF', textAlign: 'center', marginBottom: 8 },
    heroSub: { fontSize: 13, color: 'rgba(255,255,255,0.8)', textAlign: 'center', lineHeight: 20 },
    card: { backgroundColor: '#FFF', borderRadius: 20, padding: 20, marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, elevation: 3 },
    cardLabel: { fontSize: 11, fontWeight: '900', color: '#94A3B8', letterSpacing: 1.2, marginBottom: 14 },
    codeRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F0FDF4', borderRadius: 14, paddingHorizontal: 20, paddingVertical: 14, marginBottom: 16 },
    codeText: { flex: 1, fontSize: 28, fontWeight: '900', color: '#15803D', letterSpacing: 6 },
    copyBtn: { padding: 8 },
    shareBtn: { borderRadius: 14, overflow: 'hidden' },
    shareBtnInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14 },
    shareBtnText: { fontSize: 15, fontWeight: '800', color: '#FFF' },
    stepRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, marginBottom: 14 },
    stepIconBox: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#F0FDF4', justifyContent: 'center', alignItems: 'center' },
    stepText: { flex: 1, fontSize: 14, color: '#475569', fontWeight: '500', lineHeight: 20, marginTop: 7 },
});
