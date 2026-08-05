import React, { useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';

const PRIMARY = '#059669';

const API_ORIGIN = (process.env.EXPO_PUBLIC_API_URL ?? 'https://api.a1carehospital.in/api').replace(/\/api\/?$/, '');
const resolvePhoto = (url?: string | null) => {
    if (!url) return null;
    if (url.startsWith('http')) return url;
    return `${API_ORIGIN}${url.startsWith('/') ? url : `/${url}`}`;
};

export default function ReviewsScreen() {
    const router = useRouter();

    const { data: reviews = [], isLoading } = useQuery({
        queryKey: ['myReviews'],
        queryFn: async () => {
            const res = await api.get('/reviews/my-reviews');
            return res.data.data || [];
        }
    });

    const { avgRating, totalReviews } = useMemo(() => {
        if (!reviews.length) return { avgRating: 0, totalReviews: 0 };
        const sum = reviews.reduce((acc: number, r: any) => acc + (r.rating || 0), 0);
        return {
            avgRating: (sum / reviews.length).toFixed(1),
            totalReviews: reviews.length
        };
    }, [reviews]);

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {/* Floating Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <Ionicons name="arrow-back" size={24} color="#0F172A" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>My Reviews</Text>
                <View style={{ width: 44 }} />
            </View>

            {isLoading ? (
                <View style={styles.center}>
                    <ActivityIndicator size="large" color={PRIMARY} />
                </View>
            ) : reviews.length === 0 ? (
                <View style={styles.center}>
                    <View style={styles.emptyIconCircle}>
                        <Ionicons name="star-half-outline" size={48} color="#94A3B8" />
                    </View>
                    <Text style={styles.emptyText}>No reviews yet</Text>
                    <Text style={styles.emptySub}>Complete more jobs to get rated by your patients!</Text>
                </View>
            ) : (
                <FlatList
                    data={reviews}
                    keyExtractor={(item: any) => item._id}
                    contentContainerStyle={styles.listContent}
                    ListHeaderComponent={
                        <View style={styles.summaryCard}>
                            <View style={styles.summaryLeft}>
                                <Text style={styles.summaryAvg}>{avgRating}</Text>
                                <View style={styles.summaryStars}>
                                    {[1, 2, 3, 4, 5].map(star => (
                                        <Ionicons 
                                            key={star} 
                                            name={star <= Number(avgRating) ? "star" : (star - 0.5 <= Number(avgRating) ? "star-half" : "star-outline")} 
                                            size={20} 
                                            color="#F59E0B" 
                                        />
                                    ))}
                                </View>
                                <Text style={styles.summaryTotal}>Based on {totalReviews} reviews</Text>
                            </View>
                            <View style={styles.summaryRight}>
                                <Ionicons name="trophy-outline" size={42} color="#FEF08A" style={{ opacity: 0.8 }} />
                            </View>
                        </View>
                    }
                    renderItem={({ item }) => {
                        const name = item.userId?.name || 'Customer';
                        const initials = name.split(' ').slice(0, 2).map((w: string) => w[0]).join('').toUpperCase();
                        
                        return (
                            <View style={styles.reviewCard}>
                                <View style={styles.reviewHeader}>
                                    <View style={styles.reviewerInfo}>
                                        <View style={styles.avatar}>
                                            {resolvePhoto(item.userId?.profileImage) ? (
                                                <Image source={{ uri: resolvePhoto(item.userId?.profileImage)! }} style={styles.avatarImg} />
                                            ) : (
                                                <Text style={styles.avatarText}>{initials}</Text>
                                            )}
                                        </View>
                                        <View>
                                            <Text style={styles.reviewerName}>{name}</Text>
                                            <Text style={styles.reviewDate}>
                                                {format(new Date(item.createdAt), 'MMM dd, yyyy')}
                                            </Text>
                                        </View>
                                    </View>
                                    <View style={styles.ratingBadge}>
                                        <Text style={styles.ratingBadgeText}>{item.rating.toFixed(1)}</Text>
                                        <Ionicons name="star" size={12} color="#F59E0B" />
                                    </View>
                                </View>
                                
                                {!!item.comment && (
                                    <View style={styles.commentBox}>
                                        <Text style={styles.comment}>"{item.comment}"</Text>
                                    </View>
                                )}

                                {item.bookingId && (
                                    <View style={styles.bookingRef}>
                                        <View style={styles.bookingPill}>
                                            <Ionicons name="calendar-outline" size={14} color="#64748B" />
                                            <Text style={styles.bookingRefText}>
                                                {item.bookingId?.date ? format(new Date(item.bookingId.date), 'MMM dd, yyyy') : 'Booking'} • {item.bookingId?.serviceName || 'Service'}
                                            </Text>
                                        </View>
                                    </View>
                                )}
                            </View>
                        );
                    }}
                />
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },
    
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 16, paddingVertical: 14,
        backgroundColor: '#FFFFFF',
        shadowColor: '#0F172A', shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 4 },
        elevation: 6, zIndex: 10,
    },
    backBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center' },
    headerTitle: { fontSize: 18, fontWeight: '900', color: '#0F172A', letterSpacing: -0.5 },
    
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
    emptyIconCircle: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
    emptyText: { fontSize: 20, fontWeight: '800', color: '#0F172A', marginBottom: 8 },
    emptySub: { fontSize: 15, color: '#64748B', textAlign: 'center', lineHeight: 22 },

    listContent: { padding: 16, paddingBottom: 40, gap: 16 },

    summaryCard: {
        backgroundColor: PRIMARY,
        borderRadius: 24, padding: 24,
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: 8,
        shadowColor: PRIMARY, shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 6 },
        elevation: 8,
    },
    summaryLeft: { flex: 1 },
    summaryAvg: { fontSize: 42, fontWeight: '900', color: '#FFFFFF', marginBottom: 4, letterSpacing: -1 },
    summaryStars: { flexDirection: 'row', gap: 4, marginBottom: 8 },
    summaryTotal: { fontSize: 14, color: 'rgba(255,255,255,0.8)', fontWeight: '600' },
    summaryRight: { width: 70, height: 70, borderRadius: 35, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },

    reviewCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 20, padding: 16,
        shadowColor: '#0F172A', shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 2 },
        elevation: 3,
    },
    reviewHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
    reviewerInfo: { flexDirection: 'row', alignItems: 'center', gap: 14 },
    avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#0F172A', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
    avatarImg: { width: '100%', height: '100%' },
    avatarText: { color: '#FFFFFF', fontWeight: '800', fontSize: 16, letterSpacing: 0.5 },
    reviewerName: { fontSize: 16, fontWeight: '800', color: '#0F172A', marginBottom: 2, letterSpacing: -0.3 },
    reviewDate: { fontSize: 13, color: '#64748B', fontWeight: '500' },
    
    ratingBadge: { 
        flexDirection: 'row', alignItems: 'center', gap: 4,
        backgroundColor: '#FEF3C7', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12 
    },
    ratingBadgeText: { fontSize: 14, fontWeight: '800', color: '#B45309' },

    commentBox: { backgroundColor: '#F8FAFC', padding: 14, borderRadius: 12, marginBottom: 14 },
    comment: { fontSize: 15, color: '#334155', lineHeight: 24, fontStyle: 'italic' },
    
    bookingRef: { flexDirection: 'row', alignItems: 'center' },
    bookingPill: { 
        flexDirection: 'row', alignItems: 'center', gap: 6,
        backgroundColor: '#F1F5F9', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 
    },
    bookingRefText: { fontSize: 13, color: '#475569', fontWeight: '600' },
});
