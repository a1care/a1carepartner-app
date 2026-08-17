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
    Pending: { bg: "#FEF3C7", text: "#D97706", icon: "clock-outline", label: "Pending" },
    PENDING: { bg: "#FEF3C7", text: "#D97706", icon: "clock-outline", label: "Pending" },
    Broadcasted: { bg: "#F3E8FF", text: "#7C3AED", icon: "broadcast", label: "Open" },
    BROADCASTED: { bg: "#F3E8FF", text: "#7C3AED", icon: "broadcast", label: "Open" },
    ACCEPTED: { bg: "#D1FAE5", text: "#059669", icon: "check-circle-outline", label: "Accepted" },
    Confirmed: { bg: "#D1FAE5", text: "#047857", icon: "check-decagram", label: "Confirmed" },
    Active: { bg: "#D1FAE5", text: "#047857", icon: "radio-tower", label: "Active" },
    IN_PROGRESS: { bg: "#DBEAFE", text: "#2563EB", icon: "map-marker-path", label: "In Progress" },
    Completed: { bg: "#E0F2FE", text: "#0284C7", icon: "star-circle", label: "Completed" },
    COMPLETED: { bg: "#E0F2FE", text: "#0284C7", icon: "star-circle", label: "Completed" },
    Cancelled: { bg: "#FEE2E2", text: "#DC2626", icon: "close-circle-outline", label: "Cancelled" },
    CANCELLED: { bg: "#FEE2E2", text: "#DC2626", icon: "close-circle-outline", label: "Cancelled" },
    Missing: { bg: "#FFEDD5", text: "#EA580C", icon: "alert-circle-outline", label: "Missing" },
    MISSING: { bg: "#FFEDD5", text: "#EA580C", icon: "alert-circle-outline", label: "Missing" },
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
                    <View style={{ flex: 1, paddingRight: 10 }}>
                        <Text style={styles.patientName}>{b.patientName || 'Guest Patient'}</Text>
                        <View style={[styles.serviceRow, { flexShrink: 1 }]}>
                            <MaterialCommunityIcons name={b.bookingType === 'Doctor' ? 'stethoscope' : 'flask-outline'} size={14} color='#64748B' />
                            <Text style={styles.serviceText} numberOfLines={1} ellipsizeMode="tail">
                                {typeof b.serviceType === 'object' ? (b.serviceType?.name || 'Service') : (b.serviceType || 'Service')}
                            </Text>
                        </View>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: statusColors[b.status]?.bg || '#F1F5F9' }]}>
                        <MaterialCommunityIcons name={(statusColors[b.status]?.icon || 'help-circle-outline') as any} size={14} color={statusColors[b.status]?.text || '#64748B'} style={{marginRight: 4}} />
                        <Text style={[styles.statusText, { color: statusColors[b.status]?.text || '#64748B' }]}>{statusColors[b.status]?.label || String(b.status || 'Unknown')}</Text>
                    </View>
                </View>
                
                <View style={styles.premiumDetailsBox}>
                    <View style={[styles.detailItemPremium, { flex: 1.5 }]}>
                         <View style={styles.detailIconBox}><Clock size={16} color='#0F172A' /></View>
                         <View style={{ flex: 1 }}>
                             <Text style={styles.premiumLabel}>SCHEDULED FOR</Text>
                             <Text style={styles.detailText}>{b.date ? `${formatDate(b.date)} • ` : ''}{b.timeSlot || 'Anytime'}</Text>
                         </View>
                    </View>
                    
                    <View style={styles.detailDivider} />

                    <View style={[styles.detailItemPremium, { flex: 1 }]}>
                        <View style={[styles.detailIconBox, { backgroundColor: '#ECFDF5' }]}><CreditCard size={16} color='#059669' /></View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.premiumLabel}>AMOUNT</Text>
                            <Text style={[styles.detailText, { color: '#059669', fontSize: 18 }]}>₹{b.totalAmount || 0}</Text>
                            {b.paymentMode === 'OFFLINE' && <Text style={{ fontSize: 9, color: '#F59E0B', fontWeight: '900', marginTop: 2, letterSpacing: 0.5 }}>CASH PAYMENT</Text>}
                         </View>
                    </View>
                </View>

                <View style={styles.infoPill}>
                    <MapPin size={20} color='#0F172A' />
                    <Text style={styles.infoPillText} numberOfLines={1}>{b.location?.address || 'Location not provided'}</Text>
                </View>
                <View style={[styles.infoPill, { marginTop: -6, backgroundColor: 'transparent', borderWidth: 0, paddingTop: 0 }]}>
                    <MaterialCommunityIcons name='clock-outline' size={16} color='#94A3B8' />
                    <Text style={[styles.infoPillText, { color: '#94A3B8', fontSize: 12 }]} numberOfLines={1}>Received: {b.createdAt ? formatDateTime(b.createdAt) : 'N/A'}</Text>
                </View>
            </TouchableOpacity>
            <View style={styles.actionsContainer}>
                {(b.status?.toLowerCase?.() === 'broadcasted' || (b.status?.toUpperCase?.() === 'PENDING' && b.bookingType === 'Service')) && (
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
                {(b.status === 'Pending' || (b.status === 'PENDING' && b.bookingType === 'Doctor')) && (
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
                            <View style={{ backgroundColor: '#FEF2F2', padding: 12, borderRadius: 8, alignItems: 'center', marginTop: 8 }}>
                                <Text style={{ color: '#EF4444', fontWeight: 'bold', fontSize: 13 }}>🕒 Action Locked: Available on {new Date(b.date).toLocaleDateString()}</Text>
                            </View>
                        ) : (
                            <View style={styles.activeActions}>

                                <TouchableOpacity style={[styles.mainBtn, { flex: 1.2 }]} onPress={onComplete}>
                                    <Text style={styles.mainBtnText}>Complete</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.commBtn} onPress={onNavigateChat}>
                                    <MessageCircle size={22} color='#059669' />
                                    {unreadCount > 0 && <View style={styles.chatDot} />}
                                </TouchableOpacity>
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

    const startTracking = async (id: string, address?: string, destLat?: number, destLng?: number) => {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
            CustomAlert.show("Permission", "Please allow location to track your journey.");
            return;
        }

        // Navigate to the new tracking screen
        router.push({
            pathname: '/tracking/[id]' as any,
            params: {
                id,
                address: address || '',
                destLat: destLat ? String(destLat) : '',
                destLng: destLng ? String(destLng) : ''
            }
        });

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
                const addr = b?.address || b?.addressId;
                const coords = addr?.coords || addr?.location || b?.location;
                const lat = coords?.lat;
                const lng = coords?.lng;
                const locationString = b.address?.address || b.address?.street || b.location?.address || b.address?.label;
                startTracking(b._id, locationString, lat, lng);
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
                    router.push({ pathname: '/booking_feedback' as any, params: { bookingId: String(b._id), patientName: String(b.patientName || 'Patient'), type: String(b.bookingType) } });
                } catch { /* ignore */ }
            }}
            onNavigateCard={() => {
                if (!["CANCELLED", "Cancelled", "Missing", "RETURNED_TO_ADMIN"].includes(b.status)) {
                    router.push({ pathname: '/booking_detail' as any, params: { bookingId: String(b._id), bookingType: String(b.bookingType) } });
                }
            }}
            onNavigateChat={() => router.push({ pathname: '/booking_chat' as any, params: { id: String(b._id), name: String(b.patientName || 'Patient') } })}
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
    container: { flex: 1, backgroundColor: "#F4F7FC" },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 20 },
    title: { fontSize: 28, fontWeight: "900", color: "#0F172A", letterSpacing: -0.5 },
    sub: { fontSize: 13, color: "#64748B", marginTop: 4, fontWeight: '700' },
    refreshBtn: { width: 48, height: 48, borderRadius: 16, backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center', elevation: 4, shadowColor: '#0F172A', shadowOpacity: 0.05, shadowRadius: 8, borderWidth: 1.5, borderColor: '#E2E8F0' },
    backBtnSmall: { width: 44, height: 44, borderRadius: 16, backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center', elevation: 3, shadowColor: '#0F172A', shadowOpacity: 0.05, shadowRadius: 8, borderWidth: 1.5, borderColor: '#E2E8F0' },
    tabsWrapper: { height: 64, backgroundColor: '#F4F7FC' },
    tabsContent: { paddingHorizontal: 24, alignItems: 'center', gap: 14 },
    tab: { paddingHorizontal: 22, paddingVertical: 12, borderRadius: 20, backgroundColor: "#FFFFFF", borderWidth: 1.5, borderColor: "#E2E8F0", shadowColor: '#0F172A', shadowOpacity: 0.02, shadowRadius: 4, elevation: 1 },
    tabActive: { backgroundColor: "#059669", borderColor: "#059669", shadowColor: '#059669', shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
    tabText: { fontSize: 14, fontWeight: "900", color: "#64748B" },
    tabTextActive: { color: "#FFFFFF" },
    scrollContent: { padding: 24, gap: 24, paddingBottom: 110 },
    loaderBox: { alignItems: 'center', marginTop: 100, gap: 16 },
    loaderText: { fontSize: 15, color: '#64748B', fontWeight: '800' },
    empty: { alignItems: "center", marginTop: 80, gap: 16 },
    emptyIconBox: { width: 120, height: 120, borderRadius: 40, justifyContent: 'center', alignItems: 'center', shadowColor: '#0F172A', shadowOpacity: 0.04, shadowRadius: 16, elevation: 2 },
    emptyText: { fontSize: 20, color: "#0F172A", fontWeight: "900", letterSpacing: -0.3 },
    emptySub: { fontSize: 14, color: "#64748B", fontWeight: "700" },
    card: { backgroundColor: "#FFFFFF", borderRadius: 32, padding: 20, elevation: 8, shadowColor: "#0F172A", shadowOpacity: 0.06, shadowRadius: 24, shadowOffset: { width: 0, height: 12 }, gap: 14, marginBottom: 8 },
    cardInfo: { gap: 14 },
    cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
    patientName: { fontSize: 22, fontWeight: "900", color: "#0F172A", letterSpacing: -1, marginBottom: 2 },
    serviceRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingRight: 10 },
    serviceText: { fontSize: 14, color: "#64748B", fontWeight: '800', flexShrink: 1 },
    statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 14 },
    statusText: { fontSize: 11, fontWeight: "900", textTransform: 'uppercase', letterSpacing: 0.8 },
    premiumDetailsBox: { backgroundColor: '#F8FAFC', borderRadius: 20, padding: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: '#F1F5F9' },
    detailItemPremium: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    detailIconBox: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#E2E8F0', justifyContent: 'center', alignItems: 'center' },
    premiumLabel: { fontSize: 9, fontWeight: '900', color: '#94A3B8', letterSpacing: 1, marginBottom: 2 },
    detailText: { fontSize: 13, color: "#0F172A", fontWeight: '900', letterSpacing: -0.3 },
    detailDivider: { width: 1.5, height: 36, backgroundColor: '#E2E8F0', marginHorizontal: 12 },
    infoPill: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FFF', paddingHorizontal: 14, paddingVertical: 12, borderRadius: 16, borderWidth: 1, borderColor: '#F1F5F9' },
    infoPillText: { fontSize: 13, color: "#475569", fontWeight: '800', flex: 1, letterSpacing: 0.3 },
    actionsContainer: { width: '100%', gap: 12, marginTop: 4 },
    actions: { flexDirection: 'row', gap: 12 },
    mainBtn: { flex: 2, height: 50, backgroundColor: "#059669", borderRadius: 16, flexDirection: 'row', alignItems: "center", justifyContent: "center", gap: 8, shadowColor: '#059669', shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
    secondaryBtn: { backgroundColor: "#FFFFFF", borderWidth: 1.5, borderColor: "#E2E8F0", shadowOpacity: 0.05, shadowRadius: 6, elevation: 1, shadowColor: "#0F172A" },
    mainBtnText: { fontSize: 15, fontWeight: "900", color: "#FFFFFF", letterSpacing: 0.3 },
    dualActions: { flex: 1, flexDirection: 'row', gap: 12 },
    activeActions: { flex: 1, flexDirection: 'row', gap: 10, marginTop: 8 },
    declineBtn: { width: 50, height: 50, backgroundColor: "#FEF2F2", borderRadius: 16, alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: '#FECACA' },
    commsRow: { flexDirection: 'row', gap: 12 },
    commBtn: { width: 50, height: 50, backgroundColor: '#F0FDF4', borderRadius: 16, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: '#A7F3D0' },
    chatDot: { position: 'absolute', top: 10, right: 10, width: 12, height: 12, borderRadius: 6, backgroundColor: '#059669', borderWidth: 2, borderColor: '#FFFFFF' },
});
