import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, RefreshControl, Dimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { useRouter, useLocalSearchParams } from "expo-router";
import * as Location from 'expo-location';
import { partnerBookingService } from '../../lib/bookings';
import { MessageCircle, MapPin, Navigation, Calendar, Clock, CreditCard } from 'lucide-react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { io, Socket } from 'socket.io-client';
import { LinearGradient } from "expo-linear-gradient";
import { useAuthStore } from "../../stores/auth";

const { width } = Dimensions.get("window");

const TABS = ["Pending", "Confirmed", "Completed", "Cancelled"];

const statusColors: Record<string, { bg: string; text: string; icon: string }> = {
    Pending: { bg: "#FFFBEB", text: "#D97706", icon: "clock-outline" },
    Broadcasted: { bg: "#F5F3FF", text: "#7C3AED", icon: "broadcast" },
    ACCEPTED: { bg: "#ECFDF5", text: "#059669", icon: "check-circle-outline" },
    Confirmed: { bg: "#ECFDF5", text: "#047857", icon: "check-decagram" },
    Active: { bg: "#ECFDF5", text: "#047857", icon: "radio-tower" },
    IN_PROGRESS: { bg: "#EFF6FF", text: "#3B82F6", icon: "map-marker-path" },
    Completed: { bg: "#F0F9FF", text: "#0369A1", icon: "star-circle" },
    COMPLETED: { bg: "#F0F9FF", text: "#0369A1", icon: "star-circle" },
    Cancelled: { bg: "#FEF2F2", text: "#B91C1C", icon: "close-circle-outline" },
};

const API_URL = process.env.EXPO_PUBLIC_API_URL?.replace('/api', '') || 'https://api.a1carehospital.in';

export default function BookingsScreen() {
    const queryClient = useQueryClient();
    const router = useRouter();
    const { user } = useAuthStore();
    const { status } = useLocalSearchParams<{ status?: string }>();
    const [activeTab, setActiveTab] = useState("Pending");
    const primaryColor = "#2D935C";

    const [isTracking, setIsTracking] = useState<string | null>(null);
    const trackingInterval = useRef<any>(null);
    const socketRef = useRef<Socket | null>(null);

    useEffect(() => {
        if (status && TABS.includes(status)) {
            setActiveTab(status);
        }
        socketRef.current = io(API_URL);
        return () => {
            socketRef.current?.disconnect();
        };
    }, [status]);

    const { data: bookings = [], isLoading, refetch, isRefetching } = useQuery({
        queryKey: ["bookings", activeTab],
        queryFn: async () => {
            const res = await api.get("/appointment/provider/feed", {
                params: { status: activeTab }
            });
            return res.data.data || [];
        }
    });

    const updateStatusMutation = useMutation({
        mutationFn: ({ id, status, bookingType }: { id: string, status: string, bookingType: 'Doctor' | 'Service' }) => 
            partnerBookingService.updateStatus(id, status, bookingType),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["bookings"] });
            queryClient.invalidateQueries({ queryKey: ["homeStats"] });
        },
        onError: (err: any) => {
            Alert.alert("Error", err?.response?.data?.message || "Action failed");
        }
    });

    const acceptServiceMutation = useMutation({
        mutationFn: async (id: string) => {
            console.log('[Partner] Accepting service', id);
            const res = await partnerBookingService.acceptServiceRequest(id, user?.roleId);
            console.log('[Partner] Accept success', JSON.stringify(res.data || res, null, 2));
            return res;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["bookings"] });
            Alert.alert("Job Claimed!", "Check 'Confirmed' tab to start the journey.");
        },
        onError: (err: any) => {
            console.log('[Partner] Accept failed', err?.response?.data || err.message);
            Alert.alert("Busy!", err?.response?.data?.message || "Someone else just claimed this job.");
        }
    });

    const openMaps = (address: string) => {
        const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
        import('react-native').then(({ Linking }) => Linking.openURL(url));
    };

    const startTracking = async (id: string, address?: string) => {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert("Permission", "Please allow location to track your journey.");
            return;
        }

        if (address) openMaps(address);

        setIsTracking(id);
        if (trackingInterval.current) clearInterval(trackingInterval.current);
        
        trackingInterval.current = setInterval(async () => {
            try {
                const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
                const coords = {
                    latitude: loc.coords.latitude,
                    longitude: loc.coords.longitude,
                    heading: loc.coords.heading || 0,
                    speed: loc.coords.speed || 0,
                };
                await partnerBookingService.updateLocation(coords);
                socketRef.current?.emit('update_location', { roomId: id, ...coords });
            } catch (err) {
                console.error("Tracking error", err);
            }
        }, 12000);
    };

    const stopTracking = () => {
        setIsTracking(null);
        if (trackingInterval.current) {
            clearInterval(trackingInterval.current);
            trackingInterval.current = null;
        }
    };

    useEffect(() => {
        return () => {
            if (trackingInterval.current) clearInterval(trackingInterval.current);
        };
    }, []);

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <TouchableOpacity onPress={() => router.push("/(tabs)/home")} style={styles.backBtnSmall}>
                        <Ionicons name="arrow-back" size={24} color="#1E293B" />
                    </TouchableOpacity>
                    <View>
                        <Text style={styles.title}>Service Hub</Text>
                        <Text style={styles.sub}>{bookings.length} assigned requests</Text>
                    </View>
                </View>
                <TouchableOpacity onPress={() => refetch()} style={styles.refreshBtn}>
                    <Ionicons name="refresh" size={20} color="#2D935C" />
                </TouchableOpacity>
            </View>

            <View style={styles.tabsWrapper}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsContent}>
                    {TABS.map(t => (
                        <TouchableOpacity
                            key={t}
                            onPress={() => setActiveTab(t)}
                            style={[styles.tab, activeTab === t && styles.tabActive]}
                        >
                            <Text style={[styles.tabText, activeTab === t && styles.tabTextActive]}>{t}</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            <ScrollView
                contentContainerStyle={styles.scrollContent}
                refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={primaryColor} />}
                showsVerticalScrollIndicator={false}
            >
                {isLoading ? (
                    <View style={styles.loaderBox}>
                        <ActivityIndicator size="large" color={primaryColor} />
                        <Text style={styles.loaderText}>Syncing Feed...</Text>
                    </View>
                ) : bookings.length === 0 ? (
                    <View style={styles.empty}>
                        <LinearGradient colors={["#F8FAFC", "#F1F5F9"]} style={styles.emptyIconBox}>
                            <MaterialCommunityIcons name="clipboard-text-outline" size={48} color="#CBD5E1" />
                        </LinearGradient>
                        <Text style={styles.emptyText}>No {activeTab.toLowerCase()} requests</Text>
                        <Text style={styles.emptySub}>Your queue is currently empty</Text>
                    </View>
                ) : (
                    bookings.map((b: any) => (
                        <View key={b._id} style={styles.card}>
                            <View style={styles.cardInfo}>
                                <View style={styles.cardHeader}>
                                    <View>
                                        <Text style={styles.patientName}>{b.patientName || "Guest Patient"}</Text>
                                        <View style={styles.serviceRow}>
                                            <MaterialCommunityIcons 
                                                name={b.bookingType === 'Doctor' ? "stethoscope" : "flask-outline"} 
                                                size={14} 
                                                color="#64748B" 
                                            />
                                            <Text style={styles.serviceText}>{b.serviceType}</Text>
                                        </View>
                                    </View>
                                    <View style={[styles.statusBadge, { backgroundColor: statusColors[b.status]?.bg || "#F1F5F9" }]}>
                                        <MaterialCommunityIcons name={statusColors[b.status]?.icon as any || "help-circle-outline"} size={14} color={statusColors[b.status]?.text || "#64748B"} style={{marginRight: 4}} />
                                        <Text style={[styles.statusText, { color: statusColors[b.status]?.text || "#64748B" }]}>{b.status}</Text>
                                    </View>
                                </View>

                                <View style={styles.divider} />

                                <View style={styles.detailsRow}>
                                    <View style={styles.detailItem}>
                                        <Clock size={16} color="#64748B" />
                                        <Text style={styles.detailText}>{b.timeSlot || "Anytime"}</Text>
                                    </View>
                                    <View style={styles.detailItem}>
                                        <CreditCard size={16} color="#2D935C" />
                                        <View>
                                            <Text style={[styles.detailText, { fontWeight: '800', color: '#1E293B' }]}>₹{b.totalAmount || 0}</Text>
                                            {b.paymentMode === 'OFFLINE' && <Text style={{ fontSize: 8, color: '#F59E0B', fontWeight: '900' }}>CASH PAYMENT</Text>}
                                         </View>
                                    </View>
                                </View>

                                <View style={styles.addressRow}>
                                    <MapPin size={16} color="#EF4444" />
                                    <Text style={styles.addressText} numberOfLines={1}>{b.location?.address || "Location not provided"}</Text>
                                </View>
                            </View>

                            <View style={styles.actions}>
                                {b.status?.toLowerCase?.() === "broadcasted" && (
                                    <TouchableOpacity
                                        style={[styles.mainBtn, { backgroundColor: '#8B5CF6' }]}
                                        onPress={() => acceptServiceMutation.mutate(b._id)}
                                    >
                                        <Text style={styles.mainBtnText}>⚡ Accept Request</Text>
                                    </TouchableOpacity>
                                )}

                                {b.status === "Pending" && (
                                    <View style={styles.dualActions}>
                                        <TouchableOpacity
                                            style={styles.mainBtn}
                                            onPress={() => updateStatusMutation.mutate({ id: b._id, status: "Confirmed", bookingType: b.bookingType })}
                                        >
                                            <Text style={styles.mainBtnText}>Confirm Visit</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={styles.declineBtn}
                                            onPress={() => updateStatusMutation.mutate({ id: b._id, status: "Cancelled", bookingType: b.bookingType })}
                                        >
                                            <Ionicons name="close" size={20} color="#EF4444" />
                                        </TouchableOpacity>
                                    </View>
                                )}
                                
                                {(b.status === "Confirmed" || b.status === "ACCEPTED" || b.status === "IN_PROGRESS") && (
                                    <View style={styles.activeActions}>
                                        {isTracking !== b._id ? (
                                            <TouchableOpacity
                                                style={[styles.mainBtn, { backgroundColor: '#3B82F6' }]}
                                                onPress={() => startTracking(b._id, b.location?.address)}
                                            >
                                                <Navigation size={18} color="#FFF" />
                                                <Text style={styles.mainBtnText}>Navigate</Text>
                                            </TouchableOpacity>
                                        ) : (
                                            <TouchableOpacity
                                                style={[styles.mainBtn, { backgroundColor: '#EF4444' }]}
                                                onPress={stopTracking}
                                            >
                                                <Text style={styles.mainBtnText}>Stop Track</Text>
                                            </TouchableOpacity>
                                        )}
                                        <TouchableOpacity
                                            style={[styles.mainBtn, { flex: 1.2 }]}
                                            onPress={() => updateStatusMutation.mutate({ 
                                                id: b._id, 
                                                status: b.bookingType === 'Doctor' ? "Completed" : "COMPLETED", 
                                                bookingType: b.bookingType 
                                            })}
                                        >
                                            <Text style={styles.mainBtnText}>End Service</Text>
                                        </TouchableOpacity>
                                    </View>
                                )}

                                {b.status !== "Pending" && b.status !== "Broadcasted" && (
                                    <View style={styles.commsRow}>
                                        <TouchableOpacity 
                                            style={styles.commBtn}
                                            onPress={() => router.push({
                                                pathname: '/booking_chat' as any,
                                                params: { id: b._id, name: b.patientName || 'Patient' }
                                            })}
                                        >
                                            <MessageCircle size={22} color="#2D935C" />
                                        </TouchableOpacity>

                                        {(b.status === "Confirmed" || b.status === "ACCEPTED" || b.status === "IN_PROGRESS") && (
                                            <TouchableOpacity 
                                                style={[styles.commBtn, { backgroundColor: '#FFF7ED' }]}
                                                onPress={() => router.push({
                                                    pathname: '/video-call' as any,
                                                    params: { bookingId: b._id, channelName: b._id }
                                                })}
                                            >
                                                <Ionicons name="videocam" size={22} color="#C2410C" />
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                )}
                            </View>
                        </View>
                    ))
                )}
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#F8FAFC" },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 20 },
    title: { fontSize: 28, fontWeight: "900", color: "#1E293B", letterSpacing: -0.5 },
    sub: { fontSize: 13, color: "#64748B", marginTop: 2, fontWeight: '600' },
    refreshBtn: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#FFF', justifyContent: 'center', alignItems: 'center', elevation: 3, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 5 },
    backBtnSmall: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#FFF', justifyContent: 'center', alignItems: 'center', elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5 },
    tabsWrapper: { height: 64, backgroundColor: '#F8FAFC' },
    tabsContent: { paddingHorizontal: 24, alignItems: 'center', gap: 12 },
    tab: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 15, backgroundColor: "#FFF", borderWidth: 1, borderColor: "#F1F5F9" },
    tabActive: { backgroundColor: "#2D935C", borderColor: "#2D935C" },
    tabText: { fontSize: 13, fontWeight: "800", color: "#64748B" },
    tabTextActive: { color: "#FFF" },
    scrollContent: { padding: 24, gap: 20 },
    loaderBox: { alignItems: 'center', marginTop: 100, gap: 15 },
    loaderText: { fontSize: 15, color: '#64748B', fontWeight: '700' },
    empty: { alignItems: "center", marginTop: 60, gap: 16 },
    emptyIconBox: { width: 100, height: 100, borderRadius: 35, justifyContent: 'center', alignItems: 'center' },
    emptyText: { fontSize: 18, color: "#475569", fontWeight: "900" },
    emptySub: { fontSize: 14, color: "#94A3B8", fontWeight: "600" },
    card: { backgroundColor: "#FFF", borderRadius: 32, padding: 24, elevation: 6, shadowColor: "#1E293B", shadowOpacity: 0.08, shadowRadius: 15, gap: 20, borderWidth: 1, borderColor: '#F8FAFC' },
    cardInfo: { gap: 16 },
    cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
    patientName: { fontSize: 18, fontWeight: "900", color: "#1E293B" },
    serviceRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
    serviceText: { fontSize: 13, color: "#64748B", fontWeight: '700' },
    statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
    statusText: { fontSize: 11, fontWeight: "800", textTransform: 'uppercase' },
    divider: { height: 1.5, backgroundColor: "#F1F5F9", marginVertical: 4 },
    detailsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    detailItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    detailText: { fontSize: 14, color: "#475569", fontWeight: '600' },
    addressRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FFF5F5', padding: 12, borderRadius: 12 },
    addressText: { fontSize: 13, color: "#B91C1C", fontWeight: '700', flex: 1 },
    actions: { flexDirection: 'row', gap: 12 },
    mainBtn: { flex: 2, height: 50, backgroundColor: "#2D935C", borderRadius: 16, flexDirection: 'row', alignItems: "center", justifyContent: "center", gap: 8 },
    mainBtnText: { fontSize: 14, fontWeight: "800", color: "#fff" },
    dualActions: { flex: 1, flexDirection: 'row', gap: 10 },
    activeActions: { flex: 1, flexDirection: 'row', gap: 10 },
    declineBtn: { width: 50, height: 50, backgroundColor: "#FEF2F2", borderRadius: 16, alignItems: "center", justifyContent: "center" },
    commsRow: { flexDirection: 'row', gap: 10 },
    commBtn: { width: 50, height: 50, backgroundColor: '#F0FDF4', borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
});
