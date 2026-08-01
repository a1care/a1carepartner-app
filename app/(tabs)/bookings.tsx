import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, RefreshControl, Dimensions, Animated, Platform, FlatList } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useState, useRef, useEffect, useCallback, memo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { useRouter, useLocalSearchParams } from "expo-router";
import * as Location from 'expo-location';
import { partnerBookingService } from '../../lib/bookings';
import { MessageCircle, MapPin, Navigation, Calendar, Clock, CreditCard } from 'lucide-react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { getSocket } from "../../lib/socket";
import { LinearGradient } from "expo-linear-gradient";
import { useAuthStore } from "../../stores/auth";
import { CustomAlert } from "../../stores/alert.store";

const { width } = Dimensions.get("window");

const TABS = ["Pending", "Missing", "Confirmed", "Completed", "Cancelled"];

const confirmAction = (title: string, message: string, onConfirm: () => void) => {
    CustomAlert.show(title, message, [
        { text: "Cancel", style: "cancel" },
        { text: "Confirm", onPress: onConfirm }
    ]);
};

// Map API statuses to tab names so no booking goes missing
const STATUS_TO_TAB: Record<string, string> = {
    Pending: "Pending", PENDING: "Pending",
    PARTNER_ASSIGNED: "Pending", BROADCASTED: "Pending", Broadcasted: "Pending",
    ACCEPTED: "Confirmed", Confirmed: "Confirmed",
    IN_PROGRESS: "Confirmed", Active: "Confirmed",
    COMPLETED: "Completed", Completed: "Completed",
    CANCELLED: "Cancelled", Cancelled: "Cancelled",
    Missing: "Missing", MISSING: "Missing",
};

const formatDate = (dateString?: string) => {
    if (!dateString) return "";
    try {
        const d = new Date(dateString);
        if (isNaN(d.getTime())) return "";
        return d.toLocaleDateString("en-US", {
            day: "numeric",
            month: "short",
        });
    } catch {
        return "";
    }
};

const formatDateTime = (dateString?: string) => {
    if (!dateString) return "";
    try {
        const d = new Date(dateString);
        if (isNaN(d.getTime())) return "";
        return d.toLocaleString("en-US", {
            day: "numeric",
            month: "short",
            year: "numeric",
            hour: "numeric",
            minute: "2-digit",
            hour12: true
        });
    } catch {
        return "";
    }
};

const statusColors: Record<string, { bg: string; text: string; icon: string; label: string }> = {
    Pending: { bg: "#FFFBEB", text: "#D97706", icon: "clock-outline", label: "Pending" },
    PENDING: { bg: "#FFFBEB", text: "#D97706", icon: "clock-outline", label: "Pending" },
    Broadcasted: { bg: "#F5F3FF", text: "#7C3AED", icon: "broadcast", label: "Open" },
    BROADCASTED: { bg: "#F5F3FF", text: "#7C3AED", icon: "broadcast", label: "Open" },
    ACCEPTED: { bg: "#ECFDF5", text: "#059669", icon: "check-circle-outline", label: "Accepted" },
    Confirmed: { bg: "#ECFDF5", text: "#047857", icon: "check-decagram", label: "Confirmed" },
    Active: { bg: "#ECFDF5", text: "#047857", icon: "radio-tower", label: "Active" },
    IN_PROGRESS: { bg: "#EFF6FF", text: "#3B82F6", icon: "map-marker-path", label: "In Progress" },
    Completed: { bg: "#F0F9FF", text: "#0369A1", icon: "star-circle", label: "Completed" },
    COMPLETED: { bg: "#F0F9FF", text: "#0369A1", icon: "star-circle", label: "Completed" },
    Cancelled: { bg: "#FEF2F2", text: "#B91C1C", icon: "close-circle-outline", label: "Cancelled" },
    CANCELLED: { bg: "#FEF2F2", text: "#B91C1C", icon: "close-circle-outline", label: "Cancelled" },
    Missing: { bg: "#FEF3C7", text: "#D97706", icon: "alert-circle-outline", label: "Missing" },
    MISSING: { bg: "#FEF3C7", text: "#D97706", icon: "alert-circle-outline", label: "Missing" },
};

const API_URL = process.env.EXPO_PUBLIC_API_URL?.replace('/api', '') || 'https://api.a1carehospital.in';

const BookingsSkeleton = ({ pulseAnim }: { pulseAnim: Animated.Value }) => {
    return (
        <View style={{ gap: 16 }}>
            {[1, 2, 3].map((i) => (
                <Animated.View 
                    key={i} 
                    style={{ 
                        opacity: pulseAnim, 
                        height: 160, 
                        backgroundColor: '#E2E8F0', 
                        borderRadius: 24 
                    }} 
                />
            ))}
        </View>
    );
};


const BookingCard = memo(({
    b,
    hasActiveSub,
    unreadCount,
    isTracking,
    onAccept,
    onReject,
    onUpdateStatus,
    onCollectCash,
    onStartTracking,
    onStopTracking,
    onComplete,
    onNavigateCard,
    onNavigateChat,
    onNavigateSubscriptions
}: any) => {
    const isFutureDate = !!(b.date && new Date(new Date(b.date).setHours(0,0,0,0)) > new Date(new Date().setHours(0,0,0,0)));
    return (
        <View style={styles.card}>
            <TouchableOpacity 
                activeOpacity={['CANCELLED', 'Cancelled', 'Missing', 'RETURNED_TO_ADMIN'].includes(b.status) ? 1 : 0.7} 
                style={styles.cardInfo} 
                onPress={onNavigateCard}
            >
                <View style={styles.cardHeader}>
                    <View>
                        <Text style={styles.patientName}>{b.patientName || 'Guest Patient'}</Text>
                        <View style={styles.serviceRow}>
                            <MaterialCommunityIcons name={b.bookingType === 'Doctor' ? 'stethoscope' : 'flask-outline'} size={14} color='#64748B' />
                            <Text style={styles.serviceText}>{b.serviceType}</Text>
                        </View>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: statusColors[b.status]?.bg || '#F1F5F9' }]}>
                        <MaterialCommunityIcons name={(statusColors[b.status]?.icon || 'help-circle-outline') as any} size={14} color={statusColors[b.status]?.text || '#64748B'} style={{marginRight: 4}} />
                        <Text style={[styles.statusText, { color: statusColors[b.status]?.text || '#64748B' }]}>{statusColors[b.status]?.label || b.status}</Text>
                    </View>
                </View>
                <View style={styles.divider} />
                <View style={styles.detailsRow}>
                    <View style={styles.detailItem}>
                         <Clock size={16} color='#64748B' />
                         <Text style={styles.detailText}>{b.date ? `${formatDate(b.date)} | ` : ''}{b.timeSlot || 'Anytime'}</Text>
                    </View>
                    <View style={styles.detailItem}>
                        <CreditCard size={16} color='#2D935C' />
                        <View>
                            <Text style={[styles.detailText, { fontWeight: '800', color: '#1E293B' }]}>₹{b.totalAmount || 0}</Text>
                            {b.paymentMode === 'OFFLINE' && <Text style={{ fontSize: 8, color: '#F59E0B', fontWeight: '900' }}>CASH PAYMENT</Text>}
                         </View>
                    </View>
                </View>
                <View style={styles.addressRow}>
                    <MapPin size={16} color='#EF4444' />
                    <Text style={styles.addressText} numberOfLines={1}>{b.location?.address || 'Location not provided'}</Text>
                </View>
                <View style={[styles.addressRow, { marginTop: 4 }]}>
                    <MaterialCommunityIcons name='clock-in' size={16} color='#64748B' />
                    <Text style={[styles.addressText, { color: '#64748B', fontSize: 12 }]} numberOfLines={1}>Received: {b.createdAt ? formatDateTime(b.createdAt) : 'N/A'}</Text>
                </View>
            </TouchableOpacity>
            <View style={styles.actionsContainer}>
                {b.status?.toLowerCase?.() === 'broadcasted' && (
                     <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 11, color: '#7C3AED', fontWeight: '600', marginBottom: 6 }}>📢 Open to all partners — first to accept gets it</Text>
                        {!hasActiveSub && <Text style={{ fontSize: 11, color: '#EF4444', fontWeight: '600', marginBottom: 4 }}>⚠️ Active subscription required to claim jobs</Text>}
                        <View style={styles.dualActions}>
                            <TouchableOpacity style={[styles.mainBtn, { flex: 1, backgroundColor: hasActiveSub ? '#8B5CF6' : '#94A3B8' }]} onPress={() => { if (!hasActiveSub) { CustomAlert.show('Subscription Required', 'You need an active subscription to accept jobs.', [{ text: 'View Plans', onPress: onNavigateSubscriptions }, { text: 'Cancel', style: 'cancel' }], { type: 'warning' }); return; } onAccept(); }}>
                                <Text style={styles.mainBtnText}>⚡ Accept</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.declineBtn} onPress={onReject}><Ionicons name='close' size={20} color='#EF4444' /></TouchableOpacity>
                        </View>
                     </View>
                )}
                {b.status === 'PARTNER_ASSIGNED' && (
                    <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 11, color: '#2D935C', fontWeight: '600', marginBottom: 6 }}>📋 Admin assigned this job to you</Text>
                        <View style={styles.dualActions}>
                            <TouchableOpacity style={[styles.mainBtn, { flex: 1, backgroundColor: '#2D935C' }]} onPress={onAccept}><Text style={styles.mainBtnText}>✅ Accept Job</Text></TouchableOpacity>
                            <TouchableOpacity style={styles.declineBtn} onPress={onReject}><Ionicons name='close' size={20} color='#EF4444' /></TouchableOpacity>
                            {!isFutureDate && <TouchableOpacity style={styles.commBtn} onPress={onNavigateChat}><MessageCircle size={22} color='#2D935C' />{unreadCount > 0 && <View style={styles.chatDot} />}</TouchableOpacity>}
                        </View>
                    </View>
                )}
                {b.status === 'Pending' && (
                    <View style={styles.dualActions}>
                        <TouchableOpacity style={[styles.mainBtn, { flex: 1 }]} onPress={() => onUpdateStatus('Confirmed')}><Text style={styles.mainBtnText}>Confirm Visit</Text></TouchableOpacity>
                        <TouchableOpacity style={styles.declineBtn} onPress={() => onUpdateStatus('Cancelled')}><Ionicons name='close' size={20} color='#EF4444' /></TouchableOpacity>
                        {!isFutureDate && <TouchableOpacity style={styles.commBtn} onPress={onNavigateChat}><MessageCircle size={22} color='#2D935C' />{unreadCount > 0 && <View style={styles.chatDot} />}</TouchableOpacity>}
                    </View>
                )}
                {(b.status === 'Confirmed' || b.status === 'ACCEPTED' || b.status === 'IN_PROGRESS' || b.status === 'Active') && (
                    <View style={{ flex: 1, gap: 8 }}>
                        {b.paymentMode === 'OFFLINE' && b.paymentStatus !== 'COMPLETED' && (
                            <View style={{ gap: 4 }}>
                                <Text style={{ fontSize: 12, color: '#D97706', fontWeight: '800', textAlign: 'center', marginBottom: 2 }}>⚠️ Please collect cash from patient</Text>
                                <TouchableOpacity style={[styles.mainBtn, { backgroundColor: '#F59E0B' }]} onPress={onCollectCash}><Text style={styles.mainBtnText}>💵 Collect Cash</Text></TouchableOpacity>
                            </View>
                        )}
                        {isFutureDate ? (
                            <View style={{ backgroundColor: '#FEF2F2', padding: 12, borderRadius: 8, alignItems: 'center', marginTop: 8 }}><Text style={{ color: '#EF4444', fontWeight: 'bold', fontSize: 13 }}>🕒 Action Locked: Available on {new Date(b.date).toLocaleDateString()}</Text></View>
                        ) : (
                        <View style={styles.activeActions}>
                            {isTracking !== b._id ? (
                                <TouchableOpacity style={[styles.mainBtn, { backgroundColor: '#3B82F6', flex: 1.2 }]} onPress={onStartTracking}><Navigation size={18} color='#FFF' /><Text style={styles.mainBtnText}>Navigate</Text></TouchableOpacity>
                            ) : (
                                <TouchableOpacity style={[styles.mainBtn, { backgroundColor: '#EF4444', flex: 1.2 }]} onPress={onStopTracking}><Text style={styles.mainBtnText}>Stop Track</Text></TouchableOpacity>
                            )}
                            <TouchableOpacity style={[styles.mainBtn, { flex: 1.2 }]} onPress={onComplete}><Text style={styles.mainBtnText}>Complete</Text></TouchableOpacity>
                            <TouchableOpacity style={styles.commBtn} onPress={onNavigateChat}><MessageCircle size={22} color='#2D935C' />{unreadCount > 0 && <View style={styles.chatDot} />}</TouchableOpacity>
                        </View>
                        )}
                    </View>
                )}
            </View>
        </View>
    );
});

export default function BookingsScreen() {
    const queryClient = useQueryClient();
    const router = useRouter();
    const { user, token } = useAuthStore();
    const { status } = useLocalSearchParams<{ status?: string }>();
    const [activeTab, setActiveTab] = useState("Pending");
    const primaryColor = "#2D935C";

    const pulseAnim = useRef(new Animated.Value(0.3)).current;
    useEffect(() => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
                Animated.timing(pulseAnim, { toValue: 0.3, duration: 800, useNativeDriver: true })
            ])
        ).start();
    }, []);

    const [isTracking, setIsTracking] = useState<string | null>(null);
    const trackingInterval = useRef<any>(null);

    useEffect(() => {
        if (status && TABS.includes(status)) {
            setActiveTab(status);
        }
    }, [status]);

    const { data: allBookings = [], isLoading, refetch, isRefetching } = useQuery({
        queryKey: ["bookings"],
        queryFn: async () => {
            const res = await api.get("/appointment/provider/feed", { params: { status: 'all' } });
            return res.data.data || [];
        },
        refetchInterval: 15000,
    });

    // Immediately refresh list when admin assigns a booking via socket
    useEffect(() => {
        const sock = getSocket();
        if (!sock) return;
        const onAssigned = () => {
            queryClient.invalidateQueries({ queryKey: ["bookings"] });
        };
        sock.on("booking:assignment_request", onAssigned);
        sock.on("booking:assigned", onAssigned);
        return () => {
            sock.off("booking:assignment_request", onAssigned);
            sock.off("booking:assigned", onAssigned);
        };
    }, []);

    // Client-side tab filtering using the STATUS_TO_TAB map so nothing is ever silently dropped
    const bookings = allBookings.filter((b: any) =>
        (STATUS_TO_TAB[b.status] ?? "Pending") === activeTab
    ).sort((a: any, b: any) => {
        const aIsFuture = !!(a.date && new Date(new Date(a.date).setHours(0,0,0,0)) > new Date(new Date().setHours(0,0,0,0)));
        const bIsFuture = !!(b.date && new Date(new Date(b.date).setHours(0,0,0,0)) > new Date(new Date().setHours(0,0,0,0)));

        if (aIsFuture && !bIsFuture) return 1;
        if (!aIsFuture && bIsFuture) return -1;

        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : (a.date ? new Date(a.date).getTime() : 0);
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : (b.date ? new Date(b.date).getTime() : 0);
        return dateB - dateA;
    });

    const { data: activeSub } = useQuery({
        queryKey: ["myActiveSubscription"],
        queryFn: async () => {
            const res = await api.get("/subscription/my-active");
            return res.data.data;
        },
        staleTime: 60000,
    });
    const hasActiveSub = !!activeSub;

    // Per-booking unread chat counts → green dot on the chat button of cards with unread.
    const { data: unreadByBooking = {} } = useQuery<Record<string, number>>({
        queryKey: ["unread_chats_by_booking"],
        queryFn: async () => {
            const res = await api.get("/chat/unread/count");
            return res.data?.data?.byBooking || {};
        },
        enabled: !!user?._id,
        refetchInterval: 30000,
    });

    const updateStatusMutation = useMutation({
        mutationFn: ({ id, status, bookingType }: { id: string, status: string, bookingType: 'Doctor' | 'Service' }) =>
            partnerBookingService.updateStatus(id, status, bookingType),
        onMutate: async ({ id, status }) => {
            await queryClient.cancelQueries({ queryKey: ["bookings"] });
            const previousBookings = queryClient.getQueryData(["bookings"]);
            queryClient.setQueryData(["bookings"], (old: any) => {
                if (!old) return old;
                return old.map((b: any) => b._id === id ? { ...b, status } : b);
            });
            return { previousBookings };
        },
        onSuccess: (data, variables) => {
            queryClient.invalidateQueries({ queryKey: ["bookings"] });
            queryClient.invalidateQueries({ queryKey: ["homeStats"] });
            if (variables.status === 'Completed' || variables.status === 'COMPLETED') {
                setActiveTab("Completed");
            }
        },
        onError: (err: any, variables, context: any) => {
            if (context?.previousBookings) {
                queryClient.setQueryData(["bookings"], context.previousBookings);
            }
            CustomAlert.show("Error", err?.response?.data?.message || "Action failed", [{ text: "OK" }], { type: "error" });
        }
    });

    const collectCashMutation = useMutation({
        mutationFn: ({ id, bookingType }: { id: string; bookingType: 'Doctor' | 'Service' }) => {
            const path = bookingType === 'Doctor'
                ? `/appointment/cash/${id}`
                : `/service/booking/cash/${id}`;
            return api.patch(path);
        },
        onMutate: async ({ id }) => {
            await queryClient.cancelQueries({ queryKey: ["bookings"] });
            const previousBookings = queryClient.getQueryData(["bookings"]);
            queryClient.setQueryData(["bookings"], (old: any) => {
                if (!old) return old;
                return old.map((b: any) => b._id === id ? { ...b, paymentStatus: 'Completed' } : b);
            });
            return { previousBookings };
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["bookings"] });
            CustomAlert.show(
                "Cash Collected \u2705", 
                "Payment has been marked as received.",
                [{ text: "OK", style: "default" }],
                { type: "success" }
            );
        },
        onError: (err: any, variables: any, context: any) => {
            if (context?.previousBookings) {
                queryClient.setQueryData(["bookings"], context.previousBookings);
            }
            CustomAlert.show("Error", err?.response?.data?.message || "Could not mark cash as collected", [{ text: "OK" }], { type: "error" });
        }
    });

    const rejectServiceMutation = useMutation({
        mutationFn: async (id: string) => partnerBookingService.rejectServiceRequest(id),
        onMutate: async (id) => {
            await queryClient.cancelQueries({ queryKey: ["bookings"] });
            const previousBookings = queryClient.getQueryData(["bookings"]);
            queryClient.setQueryData(["bookings"], (old: any) => {
                if (!old) return old;
                return old.filter((b: any) => b._id !== id);
            });
            return { previousBookings };
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["bookings"] });
            CustomAlert.show("Job Rejected", "The booking has been returned to admin.");
        },
        onError: (err: any, id, context: any) => {
            if (context?.previousBookings) {
                queryClient.setQueryData(["bookings"], context.previousBookings);
            }
            CustomAlert.show("Error", err?.response?.data?.message || "Could not reject booking");
        }
    });

    const acceptServiceMutation = useMutation({
        mutationFn: async (id: string) => {
            const res = await partnerBookingService.acceptServiceRequest(id, user?.roleId);
            return res;
        },
        onMutate: async (id) => {
            await queryClient.cancelQueries({ queryKey: ["bookings"] });
            const previousBookings = queryClient.getQueryData(["bookings"]);
            queryClient.setQueryData(["bookings"], (old: any) => {
                if (!old) return old;
                return old.map((b: any) => b._id === id ? { ...b, status: "ACCEPTED" } : b);
            });
            return { previousBookings };
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["bookings"] });
            queryClient.invalidateQueries({ queryKey: ["homeStats"] });
            setActiveTab("Confirmed");
            CustomAlert.show("Job Claimed! ✅", "Booking moved to your Confirmed tab. Navigate to the patient's location to begin.");
        },
        onError: (err: any, id, context: any) => {
            if (context?.previousBookings) {
                queryClient.setQueryData(["bookings"], context.previousBookings);
            }
            CustomAlert.show("Busy!", err?.response?.data?.message || "Someone else just claimed this job.");
        }
    });

    const openMaps = (address: string) => {
        const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
        import('react-native').then(({ Linking }) => Linking.openURL(url));
    };

    const startTracking = async (id: string, address?: string) => {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
            CustomAlert.show("Permission", "Please allow location to track your journey.");
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
                getSocket()?.emit('update_location', { roomId: id, ...coords });
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

    const renderEmptyComponent = useCallback(() => (
        isLoading ? (
            <BookingsSkeleton pulseAnim={pulseAnim} />
        ) : (
            <View style={styles.empty}>
                <LinearGradient colors={["#F8FAFC", "#F1F5F9"]} style={styles.emptyIconBox}>
                    <MaterialCommunityIcons name="clipboard-text-outline" size={48} color="#CBD5E1" />
                </LinearGradient>
                <Text style={styles.emptyText}>No {activeTab.toLowerCase()} requests</Text>
                <Text style={styles.emptySub}>Your queue is currently empty</Text>
            </View>
        )
    ), [isLoading, pulseAnim, activeTab]);

    const renderItem = useCallback(({ item: b }: { item: any }) => (
        <BookingCard
            b={b}
            hasActiveSub={hasActiveSub}
            unreadCount={unreadByBooking[b._id] || 0}
            isTracking={isTracking}
            onAccept={() => acceptServiceMutation.mutate(b._id)}
            onReject={() => rejectServiceMutation.mutate(b._id)}
            onUpdateStatus={(status: string) => updateStatusMutation.mutate({ id: b._id, status, bookingType: b.bookingType })}
            onCollectCash={() => confirmAction(
                "Confirm Cash Received",
                "Have you collected the cash payment from the patient?",
                () => collectCashMutation.mutate({ id: b._id, bookingType: b.bookingType })
            )}
            onStartTracking={async () => {
                if (b.status !== "IN_PROGRESS") {
                    try {
                        await updateStatusMutation.mutateAsync({ id: b._id, status: "IN_PROGRESS", bookingType: b.bookingType });
                    } catch { /* ignore */ }
                }
                startTracking(b._id, b.location?.address);
            }}
            onStopTracking={stopTracking}
            onComplete={async () => {
                if (b.paymentMode === 'OFFLINE' && b.paymentStatus !== 'COMPLETED') {
                    CustomAlert.show(
                        "Collect Cash First", 
                        `Please collect the cash payment of ₹${b.totalAmount || 0} first.`,
                        [{ text: "OK", style: "default" }],
                        { type: "warning" }
                    );
                    return;
                }
                try {
                    await updateStatusMutation.mutateAsync({
                        id: b._id,
                        status: b.bookingType === 'Doctor' ? "Completed" : "COMPLETED",
                        bookingType: b.bookingType
                    });
                    router.push({ pathname: '/booking_feedback' as any, params: { bookingId: b._id, patientName: b.patientName || 'Patient', type: b.bookingType } });
                } catch { /* ignore */ }
            }}
            onNavigateCard={() => {
                if (!["CANCELLED", "Cancelled", "Missing", "RETURNED_TO_ADMIN"].includes(b.status)) {
                    router.push({ pathname: '/booking_detail' as any, params: { bookingId: b._id, bookingType: b.bookingType } });
                }
            }}
            onNavigateChat={() => router.push({ pathname: '/booking_chat' as any, params: { id: b._id, name: b.patientName || 'Patient' } })}
            onNavigateSubscriptions={() => router.push("/subscriptions" as any)}
        />
    ), [hasActiveSub, unreadByBooking, isTracking, acceptServiceMutation, rejectServiceMutation, updateStatusMutation, collectCashMutation, router, startTracking, stopTracking]);

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <TouchableOpacity onPress={() => router.push("/(tabs)/home")} style={styles.backBtnSmall}>
                        <Ionicons name="arrow-back" size={24} color="#1E293B" />
                    </TouchableOpacity>
                    <View>
                        <Text style={styles.title}>My Bookings</Text>
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

            <FlatList
                data={bookings}
                renderItem={renderItem}
                keyExtractor={(item) => item._id}
                contentContainerStyle={[styles.scrollContent, bookings.length === 0 && { flex: 1 }]}
                ListEmptyComponent={renderEmptyComponent}
                refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={primaryColor} />}
                showsVerticalScrollIndicator={false}
                initialNumToRender={5}
                maxToRenderPerBatch={5}
                windowSize={5}
                removeClippedSubviews={true}
            />
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
    scrollContent: { padding: 24, gap: 20, paddingBottom: 100 },
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
    actionsContainer: { width: '100%', gap: 12 },
    actions: { flexDirection: 'row', gap: 12 },
    mainBtn: { flex: 2, height: 50, backgroundColor: "#2D935C", borderRadius: 16, flexDirection: 'row', alignItems: "center", justifyContent: "center", gap: 8 },
    mainBtnText: { fontSize: 14, fontWeight: "800", color: "#fff" },
    dualActions: { flex: 1, flexDirection: 'row', gap: 10 },
    activeActions: { flex: 1, flexDirection: 'row', gap: 10 },
    declineBtn: { width: 50, height: 50, backgroundColor: "#FEF2F2", borderRadius: 16, alignItems: "center", justifyContent: "center" },
    commsRow: { flexDirection: 'row', gap: 10 },
    commBtn: { width: 50, height: 50, backgroundColor: '#F0FDF4', borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
    chatDot: { position: 'absolute', top: 10, right: 10, width: 11, height: 11, borderRadius: 6, backgroundColor: '#22C55E', borderWidth: 2, borderColor: '#FFF' },
});
