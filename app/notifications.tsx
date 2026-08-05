import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    View,
    Text,
    ScrollView,
    StyleSheet,
    RefreshControl,
    ActivityIndicator,
    TouchableOpacity,
    Alert,
    Platform,
    Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { api } from '../lib/api';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuthStore } from '../stores/auth';

// ── Icon/Color Mapping (Matching Partner app aesthetics) ─────────────────
const TYPE_META: Record<string, { icon: any; color: string; bgColor: string }> = {
    ServiceRequest:      { icon: "medical-bag",       color: '#2D935C', bgColor: '#ECFDF5' },
    DoctorAppointment:   { icon: "calendar-check",    color: '#3B82F6', bgColor: '#EFF6FF' },
    Wallet:              { icon: "wallet",            color: '#F59E0B', bgColor: '#FFFBEB' },
    Ticket:              { icon: "alert-circle",      color: '#EF4444', bgColor: '#FEF2F2' },
    Broadcast:           { icon: "bullhorn",          color: '#8B5CF6', bgColor: '#F5F3FF' },
    Message:             { icon: "message-text",      color: '#3B82F6', bgColor: '#EFF6FF' }, // Reusing blue styling for messages
    default:             { icon: "bell",              color: '#2D935C', bgColor: '#ECFDF5' },
};

function getMeta(refType?: string) {
    return TYPE_META[refType ?? ''] ?? TYPE_META.default;
}

function timeAgo(dateStr: string) {
    try {
        const diff = Date.now() - new Date(dateStr).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 1)  return 'Just now';
        if (mins < 60) return `${mins}m ago`;
        const hrs = Math.floor(mins / 60);
        if (hrs < 24)  return `${hrs}h ago`;
        const days = Math.floor(hrs / 24);
        if (days < 7)  return `${days}d ago`;
        return new Date(dateStr).toLocaleDateString();
    } catch {
        return 'Recently';
    }
}

const NotificationsSkeleton = () => {
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
        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
            {[1, 2, 3, 4, 5, 6].map((i) => (
                <Animated.View 
                    key={i} 
                    style={[
                        styles.card, 
                        { opacity: pulseAnim, backgroundColor: '#E2E8F0', height: 86, elevation: 0 }
                    ]}
                />
            ))}
        </ScrollView>
    );
};

export default function PartnerNotificationsScreen() {
    const router = useRouter();
    const qc = useQueryClient();
    const [localList, setLocalList] = useState<any[]>([]);

    const { token } = useAuthStore() as any;

    const { data, isLoading, isRefetching, refetch } = useQuery({
        queryKey: ['partner_notifications'],
        queryFn: async () => {
            const res = await api.get('/notifications?limit=40');
            return res.data?.data;
        },
        enabled: !!token,
    });

    useEffect(() => {
        if (data?.notifications) {
            setLocalList(data.notifications);
        }
    }, [data]);

    const unreadCount = localList.filter(n => !n.isRead).length;

    // Mutations
    const markAllMutation = useMutation({
        mutationFn: () => api.put('/notifications/read-all'),
        onMutate: () => {
            setLocalList(prev => prev.map(n => ({ ...n, isRead: true })));
            qc.setQueryData(['partner_notifications'], (prev: any) => prev ? { ...prev, unreadCount: 0, notifications: (prev.notifications || []).map((n: any) => ({ ...n, isRead: true })) } : prev);
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['partner_notifications'] });
            qc.invalidateQueries({ queryKey: ['partner_notifications_unread'] });
        },
    });

    // Auto mark read on entry
    useFocusEffect(
        useCallback(() => {
            if (unreadCount > 0 && !markAllMutation.isPending) {
                markAllMutation.mutate();
            }
        }, [unreadCount])
    );

    const markOneMutation = useMutation({
        mutationFn: (id: string) => api.put(`/notifications/${id}/read`),
        onMutate: (id: string) => {
            setLocalList(prev => prev.map(n => n._id === id ? { ...n, isRead: true } : n));
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['partner_notifications'] });
            qc.invalidateQueries({ queryKey: ['partner_notifications_unread'] });
        },
    });

    const clearAllMutation = useMutation({
        mutationFn: () => api.delete('/notifications/clear-all'),
        onMutate: () => {
            setLocalList([]);
            qc.setQueryData(['partner_notifications'], { notifications: [], unreadCount: 0 });
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['partner_notifications'] });
            qc.invalidateQueries({ queryKey: ['partner_notifications_unread'] });
        },
    });

    const ALLOWED_SCREENS = [
        '/(tabs)/bookings', '/booking_detail', '/wallet',
        '/my_tickets', '/subscriptions', '/(tabs)/profile',
        '/booking_chat', '/support_chat'
    ];

    const handlePress = (n: any) => {
        if (!n.isRead) markOneMutation.mutate(n._id);
        // Validate deeplink screen against allowlist before navigating
        if (n.data?.screen && ALLOWED_SCREENS.some(s => (n.data.screen as string).startsWith(s))) {
            router.push(n.data.screen as any);
            return;
        }
        switch (n.refType) {
            case 'DoctorAppointment':
            case 'ServiceRequest':
                if (n.refId) {
                    router.push({ pathname: '/booking_detail', params: { bookingId: n.refId, bookingType: n.refType === 'DoctorAppointment' ? 'Doctor' : 'Service' } } as any);
                } else {
                    router.push('/(tabs)/bookings' as any);
                }
                break;
            case 'Wallet':
                router.push('/wallet' as any);
                break;
            case 'Ticket':
                router.push('/my_tickets' as any); // navigate to ticket list, not new ticket form
                break;
            case 'Message':
                if (n.data?.type === "BOOKING_CHAT") {
                    router.push(`/booking_chat?id=${n.data.threadId}` as any);
                } else if (n.data?.type === "TICKET_CHAT") {
                    router.push(`/support_chat?id=${n.data.threadId}` as any);
                }
                break;
        }
    };

    const handleClearAll = () => {
        if (localList.length === 0) return;
        Alert.alert(
            "Clear Notifications",
            "Delete all notifications forever?",
            [
                { text: "Cancel", style: "cancel" },
                { text: "Clear All", style: "destructive", onPress: () => clearAllMutation.mutate() }
            ]
        );
    };

    return (
        <SafeAreaView style={styles.root} edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color="#1E293B" />
                </TouchableOpacity>
                <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={styles.headerTitle}>Notifications</Text>
                    <Text style={styles.headerSub}>{unreadCount > 0 ? `${unreadCount} new alerts` : 'No unread alerts'}</Text>
                </View>
                <TouchableOpacity 
                    style={[styles.clearBtn, localList.length === 0 && { opacity: 0.5 }]} 
                    onPress={handleClearAll}
                    disabled={localList.length === 0 || clearAllMutation.isPending}
                >
                    {clearAllMutation.isPending ? <ActivityIndicator size="small" color="#EF4444" /> : <Text style={styles.clearBtnText}>Clear All</Text>}
                </TouchableOpacity>
            </View>

            {isLoading ? (
                <NotificationsSkeleton />
            ) : (
                <ScrollView 
                    contentContainerStyle={styles.list}
                    refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#2D935C" />}
                >
                    {localList.length > 0 ? (
                        localList.map((n) => {
                            const meta = getMeta(n.refType);
                            const isNew = !n.isRead;
                            return (
                                <TouchableOpacity 
                                    key={n._id} 
                                    style={[styles.card, isNew && styles.cardUnread]}
                                    onPress={() => handlePress(n)}
                                    activeOpacity={0.8}
                                >
                                    <View style={[styles.iconBox, { backgroundColor: meta.bgColor }]}>
                                        <MaterialCommunityIcons name={meta.icon as any} size={24} color={meta.color} />
                                    </View>
                                    <View style={styles.content}>
                                        <View style={styles.cardHeader}>
                                            <View style={styles.titleRow}>
                                                {isNew && (
                                                    <View style={styles.newBadge}>
                                                        <Text style={styles.newBadgeText}>NEW</Text>
                                                    </View>
                                                )}
                                                <Text style={[styles.title, isNew && { color: '#0F172A' }]} numberOfLines={1}>
                                                    {n.title}
                                                </Text>
                                            </View>
                                        </View>
                                        <Text style={styles.body} numberOfLines={2}>{n.body}</Text>
                                        <Text style={styles.time}>{timeAgo(n.createdAt)}</Text>
                                    </View>
                                </TouchableOpacity>
                            );
                        })
                    ) : (
                        <View style={styles.emptyContainer}>
                            <View style={styles.emptyIconBox}>
                                <Ionicons name="notifications-off-outline" size={60} color="#CBD5E1" />
                            </View>
                            <Text style={styles.emptyTitle}>Inbox is empty</Text>
                            <Text style={styles.emptyDesc}>We'll notify you when something important happens.</Text>
                        </View>
                    )}
                    <View style={{ height: 100 }} />
                </ScrollView>
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: '#F8FAFC' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 16, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
    backBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#F8FAFC', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#F1F5F9' },
    headerTitle: { fontSize: 20, fontWeight: '900', color: '#0F172A', letterSpacing: -0.3 },
    headerSub: { fontSize: 13, color: '#3B82F6', fontWeight: '700', marginTop: 2 },
    clearBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 16, backgroundColor: '#FEF2F2' },
    clearBtnText: { color: '#EF4444', fontSize: 13, fontWeight: '800' },
    list: { padding: 16 },
    card: { 
        flexDirection: 'row', 
        backgroundColor: '#FFF', 
        borderRadius: 24, 
        padding: 18, 
        marginBottom: 14, 
        elevation: 8, 
        shadowColor: '#0A1A3A', 
        shadowOpacity: 0.06, 
        shadowRadius: 24,
        shadowOffset: { width: 0, height: 8 },
        borderWidth: 1,
        borderColor: '#F1F5F9',
    },
    cardUnread: { backgroundColor: '#FFFFFF', borderColor: '#E2E8F0', shadowOpacity: 0.08 },
    iconBox: { width: 56, height: 56, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
    content: { flex: 1, marginLeft: 16, justifyContent: 'center' },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
    titleRow: { flexDirection: 'row', alignItems: 'center', flex: 1 },
    newBadge: { backgroundColor: '#3B82F6', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginRight: 8 },
    newBadgeText: { color: '#FFFFFF', fontSize: 9, fontWeight: '900', letterSpacing: 0.5 },
    title: { fontSize: 16, fontWeight: '900', color: '#1E293B', flex: 1, letterSpacing: -0.2 },
    body: { fontSize: 14, color: '#475569', lineHeight: 20, marginBottom: 8, fontWeight: '600' },
    time: { fontSize: 12, color: '#94A3B8', fontWeight: '800' },
    emptyContainer: { alignItems: 'center', marginTop: 80, paddingHorizontal: 40 },
    emptyIconBox: { width: 120, height: 120, borderRadius: 60, backgroundColor: '#FFF', justifyContent: 'center', alignItems: 'center', marginBottom: 20, elevation: 2 },
    emptyTitle: { fontSize: 20, fontWeight: '900', color: '#1E293B', marginBottom: 10 },
    emptyDesc: { fontSize: 14, color: '#64748B', textAlign: 'center', lineHeight: 20 },
});

