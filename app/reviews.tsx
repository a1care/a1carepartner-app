import React from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';

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

    const renderStars = (rating: number) => {
        return (
            <View style={{ flexDirection: 'row', gap: 2 }}>
                {[1, 2, 3, 4, 5].map(star => (
                    <Ionicons 
                        key={star} 
                        name={star <= rating ? "star" : "star-outline"} 
                        size={16} 
                        color={star <= rating ? "#F59E0B" : "#CBD5E1"} 
                    />
                ))}
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color="#1E293B" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>My Reviews</Text>
                <View style={{ width: 44 }} />
            </View>

            {isLoading ? (
                <View style={styles.center}>
                    <ActivityIndicator size="large" color="#15803D" />
                </View>
            ) : reviews.length === 0 ? (
                <View style={styles.center}>
                    <Ionicons name="star-outline" size={64} color="#CBD5E1" />
                    <Text style={styles.emptyText}>No reviews yet.</Text>
                    <Text style={styles.emptySub}>Complete more jobs to get rated!</Text>
                </View>
            ) : (
                <FlatList
                    data={reviews}
                    keyExtractor={(item: any) => item._id}
                    contentContainerStyle={styles.listContent}
                    renderItem={({ item }) => (
                        <View style={styles.reviewCard}>
                            <View style={styles.reviewHeader}>
                                <View style={styles.reviewerInfo}>
                                    <View style={styles.avatar}>
                                        {resolvePhoto(item.userId?.profileImage) ? (
                                            <Image source={{ uri: resolvePhoto(item.userId?.profileImage)! }} style={styles.avatarImg} />
                                        ) : (
                                            <Ionicons name="person" size={20} color="#94A3B8" />
                                        )}
                                    </View>
                                    <View>
                                        <Text style={styles.reviewerName}>{item.userId?.name || 'Customer'}</Text>
                                        <Text style={styles.reviewDate}>
                                            {format(new Date(item.createdAt), 'MMM dd, yyyy')}
                                        </Text>
                                    </View>
                                </View>
                                {renderStars(item.rating)}
                            </View>
                            
                            {!!item.comment && (
                                <Text style={styles.comment}>{item.comment}</Text>
                            )}

                            {item.bookingId && (
                                <View style={styles.bookingRef}>
                                    <Ionicons name="calendar-outline" size={14} color="#64748B" />
                                    <Text style={styles.bookingRefText}>
                                        Booking: {item.bookingId?.date ? format(new Date(item.bookingId.date), 'MMM dd') : ''} {item.bookingId?.startingTime || ''}
                                    </Text>
                                </View>
                            )}
                        </View>
                    )}
                />
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8FAFC',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 14,
        backgroundColor: '#FFF',
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
    },
    backBtn: {
        width: 44,
        height: 44,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#1E293B',
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    emptyText: {
        fontSize: 18,
        fontWeight: '700',
        color: '#475569',
        marginTop: 16,
        marginBottom: 8,
    },
    emptySub: {
        fontSize: 14,
        color: '#94A3B8',
        textAlign: 'center',
    },
    listContent: {
        padding: 16,
        gap: 16,
    },
    reviewCard: {
        backgroundColor: '#FFF',
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: '#F1F5F9',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 3,
        elevation: 2,
    },
    reviewHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 12,
    },
    reviewerInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    avatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#F1F5F9',
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
    },
    avatarImg: {
        width: '100%',
        height: '100%',
    },
    reviewerName: {
        fontSize: 15,
        fontWeight: '700',
        color: '#1E293B',
        marginBottom: 2,
    },
    reviewDate: {
        fontSize: 12,
        color: '#94A3B8',
    },
    comment: {
        fontSize: 14,
        color: '#334155',
        lineHeight: 22,
        marginBottom: 12,
    },
    bookingRef: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: '#F1F5F9',
    },
    bookingRefText: {
        fontSize: 12,
        color: '#64748B',
        fontWeight: '500',
    },
});
