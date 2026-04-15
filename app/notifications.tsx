import React, { useState, useEffect, useCallback } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { api } from '../lib/api';
import { LinearGradient } from 'expo-linear-gradient';

// ── Icon/Color Mapping (Matching Partner app aesthetics) ─────────────────
const TYPE_META: Record<string, { icon: any; color: string; bgColor: string }> = {
    ServiceRequest:      { icon: "medical-bag",       color: '#2D935C', bgColor: '#ECFDF5' },
    DoctorAppointment:   { icon: "calendar-check",    color: '#3B82F6', bgColor: '#EFF6FF' },
    Wallet:              { icon: "wallet",            color: '#F59E0B', bgColor: '#FFFBEB' },
    Ticket:              { icon: "alert-circle",      color: '#EF4444', bgColor: '#FEF2F2' },
    Broadcast:           { icon: "bullhorn",          color: '#8B5CF6', bgColor: '#F5F3FF' },
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

export default function PartnerNotificationsScreen() {
    const router = useRouter();
    const qc = useQueryClient();
    const [localList, setLocalList] = useState<any[]>([]);

    const { data, isLoading, isRefetching, refetch } = useQuery({
        queryKey: ['partner_notifications'],
        queryFn: async () => {
            const res = await api.get('/notifications?limit=40');
            return res.data?.data;
        },
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

    const handlePress = (n: any) => {
        if (!n.isRead) markOneMutation.mutate(n._id);
        
        switch (n.refType) {
            case 'DoctorAppointment':
            case 'ServiceRequest':
                router.push('/(tabs)/bookings');
                break;
            case 'Wallet':
                router.push('/wallet_history');
                break;
            case 'Ticket':
                router.push('/raise_ticket');
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
                <View style={styles.center}>
                    <ActivityIndicator size="large" color="#2D935C" />
                </View>
            ) : (
                <ScrollView 
                    contentContainerStyle={styles.list}
                    refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#2D935C" />}
                >
                    {localList.length > 0 ? (
                        localList.map((n) => {
                            const meta = getMeta(n.refType);
                            return (
                                <TouchableOpacity 
                                    key={n._id} 
                                    style={[styles.card, !n.isRead && styles.cardUnread]}
                                    onPress={() => handlePress(n)}
                                >
                                    <View style={[styles.iconBox, { backgroundColor: meta.bgColor }]}>
                                        <MaterialCommunityIcons name={meta.icon as any} size={24} color={meta.color} />
                                    </View>
                                    <View style={styles.content}>
                                        <View style={styles.cardHeader}>
                                            <Text style={styles.title} numberOfLines={1}>{n.title}</Text>
                                            {!n.isRead && <View style={styles.unreadDot} />}
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
                    <View style={{ height: 40 }} />
                </ScrollView>
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: '#F8FAFC' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: { flexDirection: 'row', alignItems: 'center', padding: 20, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
    backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center' },
    headerTitle: { fontSize: 20, fontWeight: '900', color: '#1E293B' },
    headerSub: { fontSize: 12, color: '#64748B', fontWeight: '600' },
    clearBtn: { paddingHorizontal: 15, paddingVertical: 8, borderRadius: 12, backgroundColor: '#FEF2F2' },
    clearBtnText: { color: '#EF4444', fontSize: 13, fontWeight: '800' },
    list: { padding: 15 },
    card: { flexDirection: 'row', backgroundColor: '#FFF', borderRadius: 20, padding: 16, marginBottom: 12, elevation: 1, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10 },
    cardUnread: { backgroundColor: '#F0FDF4', borderWidth: 1, borderColor: '#DCFCE7' },
    iconBox: { width: 50, height: 50, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
    content: { flex: 1, marginLeft: 15 },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
    title: { fontSize: 15, fontWeight: '800', color: '#1E293B', flex: 1 },
    unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#2D935C' },
    body: { fontSize: 13, color: '#64748B', lineHeight: 18, marginBottom: 8 },
    time: { fontSize: 11, color: '#94A3B8', fontWeight: '700' },
    emptyContainer: { alignItems: 'center', marginTop: 80, paddingHorizontal: 40 },
    emptyIconBox: { width: 120, height: 120, borderRadius: 60, backgroundColor: '#FFF', justifyContent: 'center', alignItems: 'center', marginBottom: 20, elevation: 2 },
    emptyTitle: { fontSize: 20, fontWeight: '900', color: '#1E293B', marginBottom: 10 },
    emptyDesc: { fontSize: 14, color: '#64748B', textAlign: 'center', lineHeight: 20 },
});
