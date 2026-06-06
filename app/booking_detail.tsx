import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Linking, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { Phone, MapPin, Navigation, MessageCircle, Calendar, Clock, CreditCard, Tag, FileText } from "lucide-react-native";
import { partnerBookingService } from "../lib/bookings";

const PRIMARY = "#2D935C";

const statusColors: Record<string, { bg: string; text: string }> = {
    Pending: { bg: "#FFFBEB", text: "#D97706" },
    ACCEPTED: { bg: "#ECFDF5", text: "#059669" },
    Confirmed: { bg: "#ECFDF5", text: "#047857" },
    IN_PROGRESS: { bg: "#EFF6FF", text: "#3B82F6" },
    Completed: { bg: "#F0F9FF", text: "#0369A1" },
    COMPLETED: { bg: "#F0F9FF", text: "#0369A1" },
    Cancelled: { bg: "#FEF2F2", text: "#B91C1C" },
    CANCELLED: { bg: "#FEF2F2", text: "#B91C1C" },
};

export default function BookingDetailScreen() {
    const router = useRouter();
    const queryClient = useQueryClient();
    const params = useLocalSearchParams<{ bookingId?: string; id?: string; bookingType?: string; type?: string }>();
    const id = params.bookingId || params.id;
    const bookingType = ((params.bookingType || params.type) === "Doctor" ? "Doctor" : "Service") as "Doctor" | "Service";

    const { data: booking, isLoading, isError, refetch } = useQuery({
        queryKey: ["booking-detail", id],
        queryFn: () => partnerBookingService.getBookingDetail(String(id), bookingType),
        enabled: !!id,
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

    const call = (mobile?: string | null) => { if (mobile) Linking.openURL(`tel:${mobile}`); };
    const openMaps = () => {
        if (!booking?.address) return;
        const q = booking.address.coords
            ? `${booking.address.coords.lat},${booking.address.coords.lng}`
            : encodeURIComponent(booking.address.label || "");
        Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${q}`);
    };

    if (isLoading) {
        return (
            <SafeAreaView style={styles.center}>
                <ActivityIndicator size="large" color={PRIMARY} />
            </SafeAreaView>
        );
    }
    if (isError || !booking) {
        return (
            <SafeAreaView style={styles.center}>
                <MaterialCommunityIcons name="alert-circle-outline" size={48} color="#CBD5E1" />
                <Text style={styles.errText}>Could not load this booking.</Text>
                <TouchableOpacity style={styles.retryBtn} onPress={() => refetch()}>
                    <Text style={styles.retryText}>Retry</Text>
                </TouchableOpacity>
            </SafeAreaView>
        );
    }

    const sc = statusColors[booking.status] || { bg: "#F1F5F9", text: "#64748B" };
    const isActive = ["Confirmed", "ACCEPTED", "IN_PROGRESS"].includes(booking.status);
    const isPending = booking.status === "Pending";

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color="#1E293B" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Job Details</Text>
                <View style={[styles.statusBadge, { backgroundColor: sc.bg }]}>
                    <Text style={[styles.statusText, { color: sc.text }]}>{booking.status}</Text>
                </View>
            </View>

            <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
                {/* Patient card */}
                <View style={styles.card}>
                    <View style={styles.patientRow}>
                        {booking.patient?.profileImage ? (
                            <Image source={{ uri: booking.patient.profileImage }} style={styles.avatar} />
                        ) : (
                            <View style={styles.avatarFallback}>
                                <Text style={styles.avatarLetter}>{(booking.patient?.name || "P").charAt(0).toUpperCase()}</Text>
                            </View>
                        )}
                        <View style={{ flex: 1 }}>
                            <Text style={styles.patientName}>{booking.patient?.name || "Patient"}</Text>
                            <View style={styles.serviceRow}>
                                <MaterialCommunityIcons name={bookingType === "Doctor" ? "stethoscope" : "flask-outline"} size={14} color="#64748B" />
                                <Text style={styles.serviceText}>{booking.serviceName}</Text>
                            </View>
                        </View>
                        {booking.patient?.mobile && (
                            <TouchableOpacity style={styles.callBtn} onPress={() => call(booking.patient.mobile)}>
                                <Phone size={20} color="#FFF" />
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
                <View style={styles.card}>
                    <Text style={styles.sectionTitle}>Location</Text>
                    <View style={styles.addressRow}>
                        <MapPin size={18} color="#EF4444" />
                        <Text style={styles.addressText}>{booking.address?.label || "Not provided"}</Text>
                    </View>
                    <TouchableOpacity style={styles.mapBtn} onPress={openMaps}>
                        <Navigation size={16} color="#FFF" />
                        <Text style={styles.mapBtnText}>Open in Maps</Text>
                    </TouchableOpacity>
                </View>

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
                    <TimelineItem label={`Status: ${booking.status}`} time={booking.updatedAt} active last />
                </View>
            </ScrollView>

            {/* Sticky actions */}
            <View style={styles.actionBar}>
                <TouchableOpacity
                    style={styles.iconBtn}
                    onPress={() => router.push({ pathname: "/booking_chat" as any, params: { id: String(id), name: booking.patient?.name || "Patient" } })}
                >
                    <MessageCircle size={22} color={PRIMARY} />
                </TouchableOpacity>
                {isActive && (
                    <TouchableOpacity
                        style={styles.iconBtn}
                        onPress={() => router.push({ pathname: "/video-call" as any, params: { bookingId: String(id), channelName: String(id) } })}
                    >
                        <Ionicons name="videocam" size={22} color="#C2410C" />
                    </TouchableOpacity>
                )}
                {isPending && (
                    <TouchableOpacity style={styles.primaryBtn} onPress={() => updateStatus.mutate("Confirmed")} disabled={updateStatus.isPending}>
                        <Text style={styles.primaryBtnText}>{updateStatus.isPending ? "..." : "Confirm Visit"}</Text>
                    </TouchableOpacity>
                )}
                {isActive && (
                    <TouchableOpacity
                        style={styles.primaryBtn}
                        onPress={() => updateStatus.mutate(bookingType === "Doctor" ? "Completed" : "COMPLETED")}
                        disabled={updateStatus.isPending}
                    >
                        <Text style={styles.primaryBtnText}>{updateStatus.isPending ? "..." : "End Service"}</Text>
                    </TouchableOpacity>
                )}
            </View>
        </SafeAreaView>
    );
}

function Row({ icon, label, value, valueBold }: { icon: React.ReactNode; label: string; value: string; valueBold?: boolean }) {
    return (
        <View style={styles.row}>
            <View style={styles.rowLeft}>{icon}<Text style={styles.rowLabel}>{label}</Text></View>
            <Text style={[styles.rowValue, valueBold && { fontWeight: "900", color: "#1E293B" }]}>{value}</Text>
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
    container: { flex: 1, backgroundColor: "#F8FAFC" },
    center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#F8FAFC", gap: 14 },
    errText: { color: "#64748B", fontWeight: "700" },
    retryBtn: { paddingHorizontal: 24, paddingVertical: 12, backgroundColor: PRIMARY, borderRadius: 14 },
    retryText: { color: "#FFF", fontWeight: "800" },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 16, gap: 12 },
    backBtn: { width: 40, height: 40, borderRadius: 10, backgroundColor: "#FFF", justifyContent: "center", alignItems: "center", elevation: 2, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 5 },
    headerTitle: { flex: 1, fontSize: 20, fontWeight: "900", color: "#1E293B" },
    statusBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
    statusText: { fontSize: 11, fontWeight: "800", textTransform: "uppercase" },
    scroll: { padding: 20, paddingBottom: 120, gap: 16 },
    card: { backgroundColor: "#FFF", borderRadius: 24, padding: 20, gap: 12, elevation: 3, shadowColor: "#1E293B", shadowOpacity: 0.06, shadowRadius: 10 },
    patientRow: { flexDirection: "row", alignItems: "center", gap: 14 },
    avatar: { width: 54, height: 54, borderRadius: 27 },
    avatarFallback: { width: 54, height: 54, borderRadius: 27, backgroundColor: PRIMARY, justifyContent: "center", alignItems: "center" },
    avatarLetter: { color: "#FFF", fontSize: 22, fontWeight: "900" },
    patientName: { fontSize: 18, fontWeight: "900", color: "#1E293B" },
    serviceRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 },
    serviceText: { fontSize: 13, color: "#64748B", fontWeight: "700" },
    callBtn: { width: 46, height: 46, borderRadius: 23, backgroundColor: PRIMARY, justifyContent: "center", alignItems: "center" },
    sectionTitle: { fontSize: 12, fontWeight: "900", color: "#94A3B8", textTransform: "uppercase", letterSpacing: 0.5 },
    row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    rowLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
    rowLabel: { fontSize: 14, color: "#64748B", fontWeight: "600" },
    rowValue: { fontSize: 14, color: "#475569", fontWeight: "700" },
    addressRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, backgroundColor: "#FFF5F5", padding: 14, borderRadius: 14 },
    addressText: { flex: 1, fontSize: 14, color: "#B91C1C", fontWeight: "700", lineHeight: 20 },
    mapBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#3B82F6", height: 46, borderRadius: 14 },
    mapBtnText: { color: "#FFF", fontWeight: "800", fontSize: 14 },
    notesRow: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
    notesText: { flex: 1, fontSize: 14, color: "#475569", fontStyle: "italic", lineHeight: 20 },
    tlRow: { flexDirection: "row", gap: 12 },
    tlLeft: { alignItems: "center", width: 16 },
    tlDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: "#CBD5E1", marginTop: 3 },
    tlLine: { flex: 1, width: 2, backgroundColor: "#E2E8F0", marginVertical: 2 },
    tlLabel: { fontSize: 14, fontWeight: "800", color: "#1E293B" },
    tlTime: { fontSize: 12, color: "#94A3B8", marginTop: 2 },
    actionBar: { position: "absolute", bottom: 0, left: 0, right: 0, flexDirection: "row", gap: 12, padding: 20, backgroundColor: "#FFF", borderTopWidth: 1, borderTopColor: "#F1F5F9" },
    iconBtn: { width: 52, height: 52, borderRadius: 16, backgroundColor: "#F0FDF4", justifyContent: "center", alignItems: "center" },
    primaryBtn: { flex: 1, height: 52, backgroundColor: PRIMARY, borderRadius: 16, justifyContent: "center", alignItems: "center" },
    primaryBtnText: { color: "#FFF", fontSize: 15, fontWeight: "800" },
});
