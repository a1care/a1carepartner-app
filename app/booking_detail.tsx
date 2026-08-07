import { Toast } from '../components/CustomToast';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Linking, Image, Alert, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { Phone, MapPin, Navigation, MessageCircle, Calendar, Clock, CreditCard, Tag, FileText } from "lucide-react-native";
import { partnerBookingService } from "../lib/bookings";
import { api } from "../lib/api";
import { useAuthStore } from "../stores/auth";
import { resolvePhoto } from "../utils/image";
import { CustomAlert } from "../stores/alert.store";

const PRIMARY = "#2D935C";

const confirmAction = (title: string, message: string, onConfirm: () => void) => {
    CustomAlert.show(title, message, [
        { text: "Cancel", style: "cancel" },
        { text: "Confirm", style: "destructive", onPress: onConfirm }
    ]);
};

const statusColors: Record<string, { bg: string; text: string; label: string }> = {
    Pending: { bg: "#FFFBEB", text: "#D97706", label: "Pending" },
    PENDING: { bg: "#FFFBEB", text: "#D97706", label: "Pending" },
    ACCEPTED: { bg: "#ECFDF5", text: "#059669", label: "Accepted" },
    Confirmed: { bg: "#ECFDF5", text: "#047857", label: "Confirmed" },
    IN_PROGRESS: { bg: "#EFF6FF", text: "#3B82F6", label: "In Progress" },
    Completed: { bg: "#F0F9FF", text: "#0369A1", label: "Completed" },
    COMPLETED: { bg: "#F0F9FF", text: "#0369A1", label: "Completed" },
    Cancelled: { bg: "#FEF2F2", text: "#B91C1C", label: "Cancelled" },
    CANCELLED: { bg: "#FEF2F2", text: "#B91C1C", label: "Cancelled" },
    Missing: { bg: "#FEF3C7", text: "#D97706", label: "Missing" },
    MISSING: { bg: "#FEF3C7", text: "#D97706", label: "Missing" },
};

const getStatusLabel = (status: string) =>
    statusColors[status]?.label || status.replace(/_/g, ' ');

export default function BookingDetailScreen() {
    const router = useRouter();
    const queryClient = useQueryClient();
    const params = useLocalSearchParams<{ bookingId?: string; id?: string; bookingType?: string; type?: string }>();
    const id = params.bookingId || params.id;
    const bookingType = ((params.bookingType || params.type) === "Doctor" ? "Doctor" : "Service") as "Doctor" | "Service";

    const { user } = useAuthStore() as any;

    const { data: booking, isLoading, isError, error, refetch } = useQuery({
        queryKey: ["booking-detail", id],
        queryFn: () => partnerBookingService.getBookingDetail(String(id), bookingType),
        enabled: !!id,
        retry: (failureCount, error: any) => {
            // Do not retry on 403 Forbidden since it means the booking is no longer available to them
            if (error?.response?.status === 403) return false;
            return failureCount < 3;
        }
    });

    const { data: activeSub } = useQuery({
        queryKey: ["myActiveSubscription"],
        queryFn: async () => {
            const res = await api.get("/subscription/my-active");
            return res.data.data;
        },
    });
    const hasActiveSub = !!activeSub;

    const collectCash = useMutation({
        mutationFn: () => partnerBookingService.markCashCollected(String(id), bookingType),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["booking-detail", id] });
            queryClient.invalidateQueries({ queryKey: ["bookings"] });
            Toast.show({ type: 'success', text1: "Cash Collected ✅", text2: "Payment has been marked as received." });
        },
        onError: (err: any) => {
            Toast.show({ type: 'error', text1: "Error", text2: err?.response?.data?.message || "Could not mark cash as collected" });
        }
    });

    const updateStatus = useMutation({
        mutationFn: (status: string) => partnerBookingService.updateStatus(String(id), status, bookingType),
        onSuccess: (_d, status) => {
            queryClient.invalidateQueries({ queryKey: ["bookings"] });
            queryClient.invalidateQueries({ queryKey: ["booking-detail", id] });
            queryClient.invalidateQueries({ queryKey: ["homeStats"] });
            if (status === "Completed" || status === "COMPLETED") {
                router.replace({ pathname: "/booking_feedback" as any, params: { bookingId: String(id), patientName: booking?.patient?.name || "Patient", type: bookingType } });
            } else {
                refetch();
            }
        },
    });

    const acceptService = useMutation({
        mutationFn: async () => {
            return partnerBookingService.acceptServiceRequest(String(id), user?.roleId);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["bookings"] });
            queryClient.invalidateQueries({ queryKey: ["booking-detail", id] });
            queryClient.invalidateQueries({ queryKey: ["homeStats"] });
            Toast.show({ type: 'success', text1: "Job Claimed! ✅", text2: "Booking moved to your Confirmed tab. Navigate to the patient's location to begin." });
            refetch();
        },
        onError: (err: any) => {
            Toast.show({ type: 'error', text1: "Error", text2: err?.response?.data?.message || "Someone else just claimed this job." });
        }
    });

    const rejectService = useMutation({
        mutationFn: async () => partnerBookingService.rejectServiceRequest(String(id), user?.roleId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["bookings"] });
            queryClient.invalidateQueries({ queryKey: ["booking-detail", id] });
            Toast.show({ type: 'info', text1: "Job Rejected", text2: "The booking has been returned to admin." });
            router.back();
        },
        onError: (err: any) => {
            Toast.show({ type: 'error', text1: "Error", text2: err?.response?.data?.message || "Could not reject booking" });
        }
    });

    const call = (mobile?: string | null) => { if (mobile) Linking.openURL(`tel:${mobile}`); };
    const openMaps = () => {
        const locationString = booking.address?.address || booking.address?.street || booking.location?.address || booking.address?.label;
        const addr = booking?.address || booking?.addressId;
        const coords = addr?.coords || addr?.location || booking?.location;
        
        let q = "";
        // Prioritize full address strings if available (Google Maps geocodes this much more accurately to building entrances than raw GPS coordinates)
        if (locationString && locationString !== "Location not provided" && locationString !== "HOME" && locationString !== "WORK" && locationString !== "OTHER") {
            q = encodeURIComponent(locationString);
        } else if (coords?.lat && coords?.lng) {
            q = `${coords.lat},${coords.lng}`;
        }

        if (!q) return;
        
        const scheme = Platform.select({
            ios: `maps://app?daddr=${q}`,
            android: `google.navigation:q=${q}`,
            default: `https://www.google.com/maps/dir/?api=1&destination=${q}`
        });
        
        Linking.canOpenURL(scheme).then(supported => {
            if (supported) {
                Linking.openURL(scheme);
            } else {
                Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${q}`);
            }
        }).catch(() => {
            Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${q}`);
        });
    };

    if (isLoading) {
        return (
            <SafeAreaView style={styles.center}>
                <ActivityIndicator size="large" color={PRIMARY} />
            </SafeAreaView>
        );
    }
    if (isError || !booking) {
        const isForbidden = (error as any)?.response?.status === 403;
        return (
            <SafeAreaView style={styles.center}>
                <MaterialCommunityIcons name={isForbidden ? "lock-outline" : "alert-circle-outline"} size={48} color="#CBD5E1" />
                <Text style={[styles.errText, { textAlign: 'center', marginTop: 12, paddingHorizontal: 20 }]}>
                    {isForbidden ? "Something went wrong." : "Could not load this booking."}
                </Text>
                {isForbidden ? (
                    <TouchableOpacity style={styles.retryBtn} onPress={() => router.back()}>
                        <Text style={styles.retryText}>Please try again</Text>
                    </TouchableOpacity>
                ) : (
                    <TouchableOpacity style={styles.retryBtn} onPress={() => refetch()}>
                        <Text style={styles.retryText}>Retry</Text>
                    </TouchableOpacity>
                )}
            </SafeAreaView>
        );
    }

    const sc = statusColors[booking.status] || { bg: "#F1F5F9", text: "#64748B" };
    const isActive = ["Confirmed", "ACCEPTED", "IN_PROGRESS", "Active"].includes(booking.status);
    const isPending = booking.status === "Pending";
    const isBroadcasted = booking.status?.toLowerCase?.() === "broadcasted";
    const isPartnerAssigned = booking.status === "PARTNER_ASSIGNED";
    const isFutureDate = !!(booking.date && new Date(new Date(booking.date).setHours(0,0,0,0)) > new Date(new Date().setHours(0,0,0,0)));

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color="#1E293B" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Booking Details</Text>
                <View style={[styles.statusBadge, { backgroundColor: sc.bg }]}>
                    <Text style={[styles.statusText, { color: sc.text }]}>{getStatusLabel(booking.status)}</Text>
                </View>
            </View>

            <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
                <View style={styles.card}>
                    <View style={styles.patientRow}>
                        {booking.patient?.profileImage ? (
                            <Image source={{ uri: resolvePhoto(booking.patient.profileImage) }} style={styles.avatar} />
                        ) : (
                            <View style={styles.avatarFallback}>
                                <Text style={styles.avatarLetter}>{(booking.patient?.name || "P").charAt(0).toUpperCase()}</Text>
                            </View>
                        )}
                        <View style={{ flex: 1 }}>
                            <Text style={styles.patientName}>{booking.patient?.name || "Patient"}</Text>
                            <View style={styles.serviceRow}>
                                <MaterialCommunityIcons name={bookingType === "Doctor" ? "stethoscope" : "flask-outline"} size={14} color="#64748B" />
                                <Text style={styles.serviceText}>{booking.childServiceId?.name || booking.serviceName}</Text>
                            </View>
                        </View>
                        {booking.patient?.mobile && !isFutureDate && (
                            <TouchableOpacity style={styles.callBtn} onPress={() => call(booking.patient.mobile)}>
                                <Phone size={22} color="#FFF" />
                            </TouchableOpacity>
                        )}
                    </View>
                </View>

                {/* Schedule + payment */}
                <View style={styles.card}>
                    <Text style={styles.sectionTitle}>Schedule & Payment</Text>
                    <Row icon={<Calendar size={18} color="#64748B" />} label="Date" value={booking.date ? new Date(booking.date).toDateString() : "—"} />
                    <Row icon={<Clock size={18} color="#64748B" />} label="Time" value={booking.timeSlot || "As scheduled"} />
                    <Row icon={<CreditCard size={18} color={PRIMARY} />} label="Amount" value={`₹${booking.totalAmount || 0}`} valueBold />
                    <Row icon={<CreditCard size={18} color="#64748B" />} label="Payment" value={`${booking.paymentMode || "ONLINE"} · ${booking.paymentStatus || "PENDING"}`} />
                    {booking.couponCode ? (
                        <Row icon={<Tag size={18} color="#7C3AED" />} label="Coupon" value={`${booking.couponCode} (−₹${booking.discountAmount || 0})`} />
                    ) : null}
                    {booking.partnerEarning != null ? (
                        <Row icon={<MaterialCommunityIcons name="wallet-outline" size={18} color="#059669" />} label="Your earning" value={`₹${booking.partnerEarning}`} valueBold />
                    ) : null}
                </View>

                {/* Location */}
                <TouchableOpacity style={styles.card} onPress={openMaps} activeOpacity={0.9}>
                    <Text style={styles.sectionTitle}>Location</Text>
                    <View style={styles.addressRow}>
                        <View style={styles.addressIconBox}>
                            <MapPin size={22} color="#0F172A" />
                        </View>
                        <View style={{ flex: 1, gap: 4 }}>
                            {(() => {
                                const locationString = booking.address?.label || booking.location?.address || "Location not provided";
                                return (
                                    <>
                                        <Text style={styles.addressLabel}>ADDRESS</Text>
                                        <Text style={styles.addressText}>{locationString}</Text>
                                    </>
                                );
                            })()}
                        </View>
                    </View>
                    {!isFutureDate && (
                        <TouchableOpacity style={styles.mapBtn} onPress={() => {
                            const addr = booking?.address || booking?.addressId;
                            const coords = addr?.coords || addr?.location || booking?.location;
                            const lat = coords?.lat;
                            const lng = coords?.lng;
                            const locationString = booking.address?.address || booking.address?.street || booking.location?.address || booking.address?.label;
                            
                            router.push({
                                pathname: '/tracking/[id]' as any,
                                params: {
                                    id: booking._id,
                                    address: locationString || '',
                                    destLat: lat ? String(lat) : '',
                                    destLng: lng ? String(lng) : ''
                                }
                            });
                        }}>
                            <Navigation size={16} color="#FFF" />
                            <Text style={styles.mapBtnText}>Start Live Tracking</Text>
                        </TouchableOpacity>
                    )}
                </TouchableOpacity>


                {/* Notes */}
                {booking.notes ? (
                    <View style={styles.card}>
                        <Text style={styles.sectionTitle}>Notes from Patient</Text>
                        <View style={styles.notesRow}>
                            <FileText size={16} color="#64748B" />
                            <Text style={styles.notesText}>{booking.notes}</Text>
                        </View>
                    </View>
                ) : null}

                {/* Timeline */}
                <View style={styles.card}>
                    <Text style={styles.sectionTitle}>Timeline</Text>
                    <TimelineItem label="Created" time={booking.createdAt} active />
                    <TimelineItem label={getStatusLabel(booking.status)} time={booking.updatedAt} active last />
                </View>
            </ScrollView>

            {/* Collect cash row — only for OFFLINE unpaid bookings */}
            {booking.paymentMode === "OFFLINE" && booking.paymentStatus !== "COMPLETED" && (
                <View style={{ paddingHorizontal: 20, paddingBottom: 8, backgroundColor: "#FFF", gap: 6 }}>
                    <Text style={{ fontSize: 12, color: '#D97706', fontWeight: '800', textAlign: 'center' }}>
                        ⚠️ Please collect cash from patient
                    </Text>
                    <TouchableOpacity
                        style={[styles.primaryBtn, { backgroundColor: '#F59E0B', borderRadius: 14 }]}
                        onPress={() => confirmAction(
                            "Confirm Cash Received",
                            "Have you collected the cash payment from the patient?",
                            () => collectCash.mutate()
                        )}
                        disabled={collectCash.isPending}
                    >
                        <Text style={styles.primaryBtnText}>{collectCash.isPending ? "..." : "💵 Mark Cash Collected"}</Text>
                    </TouchableOpacity>
                </View>
            )}

            {/* Sticky actions */}
            {!["missing", "returned_to_admin", "completed", "cancelled"].includes(booking.status?.toLowerCase?.() || "") && (
                <View style={styles.actionBar}>
                    {!isFutureDate && !isBroadcasted && !isPartnerAssigned && (
                        <TouchableOpacity
                            style={styles.iconBtn}
                            onPress={() => router.push({ pathname: "/booking_chat" as any, params: { id: String(id), name: booking.patient?.name || "Patient", mobile: booking.patient?.mobile || "" } })}
                        >
                            <MessageCircle size={22} color={PRIMARY} />
                        </TouchableOpacity>
                    )}

                    {isBroadcasted && (
                        <View style={{ flex: 1, flexDirection: 'row', gap: 10 }}>
                            <TouchableOpacity
                                style={[styles.primaryBtn, { flex: 1, backgroundColor: hasActiveSub ? '#8B5CF6' : '#94A3B8' }]}
                                onPress={() => {
                                    if (!hasActiveSub) {
                                        CustomAlert.show("Subscription Required", "You need an active subscription to accept jobs.", [
                                            { text: "View Plans", onPress: () => router.push("/subscriptions" as any) },
                                            { text: "Cancel", style: "cancel" }
                                        ], { type: "warning" });
                                        return;
                                    }
                                    acceptService.mutate();
                                }}
                                disabled={acceptService.isPending}
                            >
                                <Text style={styles.primaryBtnText}>{acceptService.isPending ? "..." : "⚡ Accept"}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: '#FEF2F2', justifyContent: 'center', alignItems: 'center' }}
                                onPress={() => rejectService.mutate()}
                                disabled={rejectService.isPending}
                            >
                                <Ionicons name="close" size={24} color="#EF4444" />
                            </TouchableOpacity>
                        </View>
                    )}

                    {isPartnerAssigned && (
                        <View style={{ flex: 1, flexDirection: 'row', gap: 10 }}>
                            <TouchableOpacity
                                style={[styles.primaryBtn, { flex: 1 }]}
                                onPress={() => acceptService.mutate()}
                                disabled={acceptService.isPending}
                            >
                                <Text style={styles.primaryBtnText}>{acceptService.isPending ? "..." : "⚡ Accept"}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: '#FEF2F2', justifyContent: 'center', alignItems: 'center' }}
                                onPress={() => rejectService.mutate()}
                                disabled={rejectService.isPending}
                            >
                                <Ionicons name="close" size={24} color="#EF4444" />
                            </TouchableOpacity>
                        </View>
                    )}

                    {isPending && (
                        <TouchableOpacity style={styles.primaryBtn} onPress={() => updateStatus.mutate("Confirmed")} disabled={updateStatus.isPending}>
                            <Text style={styles.primaryBtnText}>{updateStatus.isPending ? "..." : "Confirm Visit"}</Text>
                        </TouchableOpacity>
                    )}
                    {isActive && !isPartnerAssigned && (
                        isFutureDate ? (
                            <View style={{ backgroundColor: '#FEF2F2', padding: 16, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }}>
                                <Text style={{ color: '#EF4444', fontWeight: 'bold', fontSize: 14 }}>🕒 Action Locked: Available on {new Date(booking.date).toLocaleDateString()}</Text>
                            </View>
                        ) : (
                        <TouchableOpacity
                            style={styles.primaryBtn}
                            onPress={() => {
                                if (booking.paymentMode === 'OFFLINE' && booking.paymentStatus !== 'COMPLETED') {
                                    Toast.show({ type: 'info', text1: "Collect Cash First", text2: `Please collect the cash payment of ₹${booking.totalAmount || 0} first.` });
                                    return;
                                }
                                updateStatus.mutate(bookingType === "Doctor" ? "Completed" : "COMPLETED");
                            }}
                            disabled={updateStatus.isPending}
                        >
                            <Text style={styles.primaryBtnText}>{updateStatus.isPending ? "..." : "Complete"}</Text>
                        </TouchableOpacity>
                        )
                    )}
                </View>
            )}
        </SafeAreaView>
    );
}

function Row({ icon, label, value, valueBold }: { icon: React.ReactNode; label: string; value: string; valueBold?: boolean }) {
    return (
        <View style={styles.row}>
            <View style={styles.rowLeft}>
                <View style={styles.rowIconBox}>{icon}</View>
                <Text style={styles.rowLabel}>{label}</Text>
            </View>
            <Text style={[styles.rowValue, valueBold && { fontWeight: "900", color: PRIMARY, fontSize: 17 }]}>{value}</Text>
        </View>
    );
}

function TimelineItem({ label, time, active, last }: { label: string; time?: string; active?: boolean; last?: boolean }) {
    return (
        <View style={styles.tlRow}>
            <View style={styles.tlLeft}>
                <View style={[styles.tlDot, active && { backgroundColor: PRIMARY }]} />
                {!last && <View style={styles.tlLine} />}
            </View>
            <View style={{ paddingBottom: last ? 0 : 16 }}>
                <Text style={styles.tlLabel}>{label}</Text>
                {time ? <Text style={styles.tlTime}>{new Date(time).toLocaleString()}</Text> : null}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#F4F7FC" },
    center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#F4F7FC", gap: 14 },
    errText: { color: "#64748B", fontWeight: "700" },
    retryBtn: { paddingHorizontal: 24, paddingVertical: 12, backgroundColor: PRIMARY, borderRadius: 14 },
    retryText: { color: "#FFF", fontWeight: "800" },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 16, gap: 12 },
    backBtn: { width: 44, height: 44, borderRadius: 16, backgroundColor: "#FFF", justifyContent: "center", alignItems: "center", elevation: 2, shadowColor: "#0F172A", shadowOpacity: 0.05, shadowRadius: 8, borderWidth: 1.5, borderColor: '#E2E8F0' },
    headerTitle: { flex: 1, fontSize: 24, fontWeight: "900", color: "#0F172A", letterSpacing: -0.5 },
    statusBadge: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 14 },
    statusText: { fontSize: 11, fontWeight: "900", textTransform: "uppercase", letterSpacing: 0.8 },
    scroll: { padding: 24, paddingBottom: 120, gap: 16 },
    card: { backgroundColor: "#FFFFFF", borderRadius: 32, padding: 24, elevation: 12, shadowColor: "#0F172A", shadowOpacity: 0.06, shadowRadius: 32, shadowOffset: { width: 0, height: 16 }, gap: 16, marginBottom: 8 },
    patientRow: { flexDirection: "row", alignItems: "center", gap: 16 },
    avatar: { width: 64, height: 64, borderRadius: 32 },
    avatarFallback: { width: 64, height: 64, borderRadius: 32, backgroundColor: PRIMARY, justifyContent: "center", alignItems: "center" },
    avatarLetter: { color: "#FFF", fontSize: 26, fontWeight: "900" },
    patientName: { fontSize: 24, fontWeight: "900", color: "#0F172A", letterSpacing: -1, marginBottom: 2 },
    serviceRow: { flexDirection: "row", alignItems: "center", gap: 6, paddingRight: 10 },
    serviceText: { fontSize: 15, color: "#64748B", fontWeight: "800", flexShrink: 1 },
    callBtn: { width: 50, height: 50, borderRadius: 16, backgroundColor: PRIMARY, justifyContent: "center", alignItems: "center", shadowColor: PRIMARY, shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
    sectionTitle: { fontSize: 11, fontWeight: "900", color: "#94A3B8", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 },
    row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 4 },
    rowLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
    rowIconBox: { width: 38, height: 38, borderRadius: 12, backgroundColor: "#F1F5F9", justifyContent: "center", alignItems: "center" },
    rowLabel: { fontSize: 15, color: "#475569", fontWeight: "800" },
    rowValue: { fontSize: 15, color: "#0F172A", fontWeight: "800", letterSpacing: -0.3 },
    addressRow: { flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: "#F8FAFC", padding: 18, borderRadius: 24, borderWidth: 1.5, borderColor: '#F1F5F9' },
    addressIconBox: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#E2E8F0', justifyContent: 'center', alignItems: 'center' },
    addressLabel: { fontSize: 10, color: "#94A3B8", fontWeight: "900", textTransform: "uppercase", letterSpacing: 1 },
    addressText: { fontSize: 15, color: "#0F172A", fontWeight: "800", lineHeight: 22 },
    mapBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#0F172A", height: 52, borderRadius: 16, marginTop: 4, shadowColor: "#0F172A", shadowOpacity: 0.2, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
    mapBtnText: { color: "#FFF", fontWeight: "900", fontSize: 15, letterSpacing: 0.3 },
    notesRow: { flexDirection: "row", gap: 12, alignItems: "flex-start", backgroundColor: '#FEF3C7', padding: 16, borderRadius: 20 },
    notesText: { flex: 1, fontSize: 15, color: "#92400E", fontStyle: "italic", lineHeight: 22, fontWeight: '600' },
    tlRow: { flexDirection: "row", gap: 14 },
    tlLeft: { alignItems: "center", width: 16 },
    tlDot: { width: 14, height: 14, borderRadius: 7, backgroundColor: "#CBD5E1", marginTop: 2 },
    tlLine: { flex: 1, width: 2.5, backgroundColor: "#E2E8F0", marginVertical: 4 },
    tlLabel: { fontSize: 16, fontWeight: "900", color: "#0F172A" },
    tlTime: { fontSize: 13, color: "#64748B", marginTop: 4, fontWeight: '700' },
    actionBar: { position: "absolute", bottom: 0, left: 0, right: 0, flexDirection: "row", gap: 12, padding: 24, backgroundColor: "#FFFFFF", borderTopWidth: 1.5, borderTopColor: "#E2E8F0", elevation: 20 },
    iconBtn: { width: 50, height: 50, borderRadius: 16, backgroundColor: "#F0FDF4", justifyContent: "center", alignItems: "center", borderWidth: 1.5, borderColor: '#A7F3D0' },
    primaryBtn: { flex: 1, height: 50, backgroundColor: PRIMARY, borderRadius: 16, justifyContent: "center", alignItems: "center", shadowColor: PRIMARY, shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
    primaryBtnText: { color: "#FFF", fontSize: 16, fontWeight: "900", letterSpacing: 0.5 },
});
