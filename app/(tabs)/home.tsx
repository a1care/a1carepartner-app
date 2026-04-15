import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Switch, ActivityIndicator, RefreshControl, Image, Platform, NativeModules, Alert } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useState, useMemo, useEffect, useRef } from "react";
import { useAuthStore } from "../../stores/auth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { Toast } from "../../components/CustomToast";
import * as Location from 'expo-location';
import AsyncStorage from "@react-native-async-storage/async-storage";

// Conditional Firebase import 
let messaging: any;
try {
    if (NativeModules.RNFBAppModule) {
        messaging = require('@react-native-firebase/messaging').default;
    }
} catch (e) { }

// Global persistence to prevent flickering during tab switches
let cachedLocationText = "";

// Global persistence to prevent flickering during tab switches
let cachedCity = "";

export default function HomeScreen() {
    const router = useRouter();
    const { user, setUser, token } = useAuthStore() as any;
    const [isOnline, setIsOnline] = useState(user?.status === "Active");
    const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
    const [locationAddress, setLocationAddress] = useState(cachedLocationText || "...");
    const role = user?.role ?? "doctor";
    const primaryColor = "#2D935C";
    const queryClient = useQueryClient();
    const locationWatcherRef = useRef<Location.LocationSubscription | null>(null);
    const locationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // 1. Handle Permissions & Tracking after login
    useEffect(() => {
        if (!token) return;

        let isMounted = true;

        const initRealtimeFeatures = async () => {
            setupNotifications();

            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                if (isMounted) {
                    setLocationAddress("Location access denied");
                    Toast.show({ type: 'info', text1: 'Location Required', text2: 'Please enable location to receive nearby bookings.' });
                }
                return;
            }

            await setupLocation();
            await setupLocationSync();
        };

        initRealtimeFeatures();

        return () => {
            isMounted = false;
            locationWatcherRef.current?.remove();
            locationWatcherRef.current = null;
            if (locationIntervalRef.current) {
                clearInterval(locationIntervalRef.current);
                locationIntervalRef.current = null;
            }
        };
    }, [token]);

    useEffect(() => {
        if (!token || !messaging) return;

        const unsubscribe = messaging().onTokenRefresh(async (nextToken: string) => {
            try {
                await api.put("/notifications/fcm-token/partner", { fcmToken: nextToken });
            } catch (e) {
                console.log("FCM token refresh sync error", e);
            }
        });

        return unsubscribe;
    }, [token]);

    const setupNotifications = async () => {
        if (!messaging) return;
        try {
            const authStatus = await messaging().requestPermission();
            const enabled = authStatus === 1 || authStatus === 2;
            if (enabled) {
                const fcmToken = await messaging().getToken();
                if (fcmToken) {
                    console.log("[FCM] Generated Token:", fcmToken);
                    await api.put("/notifications/fcm-token/partner", { fcmToken });
                    console.log("[FCM] Token synced with backend");
                } else {
                    console.log("[FCM] No token received from Firebase");
                }
            } else {
                console.log("[FCM] Permission not granted:", authStatus);
            }
        } catch (e) {
            console.log("[FCM] Notification setup error:", e);
        }
    };

    const syncCurrentLocation = async () => {
        try {
            const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
            const coords = {
                latitude: loc.coords.latitude,
                longitude: loc.coords.longitude,
                heading: loc.coords.heading,
                speed: loc.coords.speed,
            };

            await AsyncStorage.setItem("last_location", JSON.stringify(coords));
            await api.post("/appointment/location/update", {
                ...coords,
                isOnline: true
            });
            console.log("[Location] Synced:", coords.latitude, coords.longitude);
            return coords;
        } catch (err) {
            console.log("[Location] Sync failed:", err);
        }
    };

    const setupLocationSync = async () => {
        try {
            await syncCurrentLocation();

            if (locationIntervalRef.current) {
                clearInterval(locationIntervalRef.current);
            }

            locationIntervalRef.current = setInterval(syncCurrentLocation, 5 * 60 * 1000);
        } catch (e) {
            console.log("[Location] Setup error:", e);
        }
    };

    const setupLocation = async () => {
        try {
            const cached = await AsyncStorage.getItem("last_location_text");
            if (cached) setLocationAddress(cached);

            const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
            if (location) {
                await updateLocationOnBackend(location.coords.latitude, location.coords.longitude);
                await reverseGeocode(location.coords.latitude, location.coords.longitude);
            }

            locationWatcherRef.current?.remove();
            locationWatcherRef.current = await Location.watchPositionAsync(
                { accuracy: Location.Accuracy.Balanced, distanceInterval: 100 },
                (loc) => {
                    updateLocationOnBackend(loc.coords.latitude, loc.coords.longitude);
                    reverseGeocode(loc.coords.latitude, loc.coords.longitude);
                }
            );
        } catch (e) {
            console.log("Location setup error", e);
        }
    };
    const reverseGeocode = async (lat: number, lng: number) => {
        try {
            const address = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
            if (address && address[0]) {
                const { city, region, district } = address[0];
                const cityText = city || district || region || "Unknown City";
                setLocationAddress(cityText);
                cachedLocationText = cityText; // Update global cache
                await AsyncStorage.setItem("last_location_text", cityText);
            }
        } catch (e) { }
    };

    const updateLocationOnBackend = async (lat: number, lng: number) => {
        try {
            await api.put("/doctor/auth/register", {
                location: {
                    type: "Point",
                    coordinates: [lng, lat] // MongoDB uses [lng, lat]
                }
            });
        } catch (e) {
            console.log("Failed to update location on backend", e);
        }
    };

    const { data: staffData, isLoading: loadingUser, refetch: refetchUser } = useQuery({
        queryKey: ["staffDetails"],
        queryFn: async () => {
            const res = await api.get("/doctor/auth/details");
            return res.data.data;
        }
    });

    useEffect(() => {
        if (staffData) {
            setIsOnline(staffData.status === "Active");
            setUser({ ...user, ...staffData }); // Sync to global store to unlock tabs/layout
        }
    }, [staffData]);

    const [period, setPeriod] = useState<"thisMonth" | "lastMonth">("thisMonth");

    const { data: bookings = [], isLoading: loadingStats, refetch: refetchStats, isRefetching } = useQuery({
        queryKey: ["homeStats", period],
        queryFn: async () => {
            const res = await api.get("/appointment/provider/feed", {
                params: { status: "Pending", period }
            });
            return res.data.data || [];
        }
    });

    // Unread notifications count
    const { data: unreadCount = 0 } = useQuery({
        queryKey: ["partner_notifications_unread"],
        queryFn: async () => {
            const res = await api.get("/notifications?unread=true&limit=1");
            return res.data?.data?.unreadCount || 0;
        },
        enabled: !!user?._id,
        refetchInterval: 30000,
    });

    const stats = useMemo(() => {
        const completed = bookings.filter((b: any) => b.status === "Completed").length;
        const earnings = bookings
            .filter((b: any) => b.status === "Completed")
            .reduce((acc: number, b: any) => acc + (b.totalAmount || 0), 0);

        return [
            { label: "Bookings", value: bookings.length.toString(), icon: "calendar-outline", color: "#6366F1" },
            { label: "Earning", value: `₹${earnings}`, icon: "cash-outline", color: "#2D935C" },
            { label: "Completed", value: completed.toString(), icon: "checkmark-circle-outline", color: "#10B981" },
            { label: "Rating", value: staffData?.rating ? staffData.rating.toFixed(1) : "N/A", icon: "star-outline", color: "#F59E0B" },
        ];
    }, [bookings, staffData]);

    const handleToggleOnline = async (val: boolean) => {
        if (isUpdatingStatus) return;
        setIsUpdatingStatus(true);
        const previousStatus = isOnline;
        setIsOnline(val);

        try {
            const newStatus = val ? "Active" : "Inactive";
            await api.put("/doctor/auth/register", { status: newStatus });
            setUser({ ...user, status: newStatus });
            Toast.show({
                type: "success",
                text1: val ? "You are now Online" : "You are now Offline",
            });
        } catch (err) {
            setIsOnline(previousStatus);
            Toast.show({ type: "error", text1: "Status Update Failed" });
        } finally {
            setIsUpdatingStatus(false);
        }
    };

    const onRefresh = () => {
        refetchUser();
        refetchStats();
        syncCurrentLocation();
    };

    if (loadingUser && !user) {
        return (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#F3F4F9" }}>
                <ActivityIndicator size="large" color={primaryColor} />
            </View>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            {staffData?.status === "Pending" && (
                <View style={styles.kycOverlay}>
                    <LinearGradient colors={["#FFFFFF", "#F8FAFC"]} style={styles.kycContent}>
                        <View style={styles.kycHeader}>
                            <View style={styles.kyclIconBox}>
                                <LinearGradient colors={["#ECFDF5", "#D1FAE5"]} style={StyleSheet.absoluteFill} />
                                <Ionicons name="shield-checkmark" size={42} color="#10B981" />
                            </View>
                            <Text style={styles.kycTitle}>Verification in Progress</Text>
                            <Text style={styles.kycDesc}>
                                We are reviewing your certificates and credentials. This usually takes <Text style={{ fontWeight: '800', color: '#1E293B' }}>24-48 hours</Text>.
                            </Text>
                        </View>
                        <TouchableOpacity style={styles.kycCta} onPress={onRefresh} activeOpacity={0.8}>
                            <LinearGradient colors={["#1E293B", "#0F172A"]} style={StyleSheet.absoluteFill} />
                            <Ionicons name="refresh" size={20} color="#FFF" />
                            <Text style={styles.kycCtaText}>Check Update</Text>
                        </TouchableOpacity>
                    </LinearGradient>
                </View>
            )}

            <ScrollView
                refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={onRefresh} tintColor={primaryColor} />}
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.header}>
                    <View style={styles.locationBar}>
                        <View style={styles.locationInfo}>
                            <View style={styles.locationPin}><Ionicons name="location" size={16} color="#2D935C" /></View>
                            <Text style={styles.locationLabel} numberOfLines={1}>{locationAddress}</Text>
                        </View>
                        <TouchableOpacity style={styles.notificationBtn} onPress={() => router.push("/notifications")}>
                            <Ionicons name="notifications-outline" size={24} color="#1E293B" />
                            {unreadCount > 0 && <View style={styles.badgeDot} />}
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.profileBtn} onPress={() => router.push("/profile_edit")}>
                            {staffData?.profileImage || user?.profileImage ? (
                                <Image source={{ uri: staffData?.profileImage || user?.profileImage }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
                            ) : (
                                <View style={styles.avatarPlaceholder}><Ionicons name="person" size={20} color="#64748B" /></View>
                            )}
                        </TouchableOpacity>
                    </View>

                    <View style={styles.headerContent}>
                        <View>
                            <Text style={styles.greetingText}>Welcome back,</Text>
                            <Text style={styles.nameText}>{user?.name ?? "Partner"}</Text>
                        </View>
                    </View>

                    <View style={[styles.statusCard, { borderLeftColor: isOnline ? "#2D935C" : "#94A3B8" }]}>
                        <View style={styles.statusInfo}>
                            <View style={styles.statusIndicator}>
                                <View style={[styles.statusDot, { backgroundColor: isOnline ? "#2D935C" : "#94A3B8" }]} />
                                <Text style={[styles.statusText, { color: isOnline ? "#2D935C" : "#64748B" }]}>
                                    {isOnline ? "Currently Active" : "Currently Offline"}
                                </Text>
                            </View>
                            <Text style={styles.statusSubText}>
                                {isOnline ? "You are visible to patients" : "You are hidden from searches"}
                            </Text>
                        </View>
                        <Switch
                            value={isOnline}
                            onValueChange={handleToggleOnline}
                            trackColor={{ false: "#CBD5E1", true: "#2D935C" }}
                            thumbColor={"#FFF"}
                            disabled={isUpdatingStatus}
                        />
                    </View>
                </View>

                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Dashboard</Text>
                    <View style={styles.periodSwitcher}>
                        <TouchableOpacity onPress={() => setPeriod("thisMonth")} style={[styles.periodBtn, period === "thisMonth" && styles.periodBtnActive]}>
                            <Text style={[styles.periodText, period === "thisMonth" && styles.periodTextActive]}>Month</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => setPeriod("lastMonth")} style={[styles.periodBtn, period === "lastMonth" && styles.periodBtnActive]}>
                            <Text style={[styles.periodText, period === "lastMonth" && styles.periodTextActive]}>Last</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                <View style={styles.statsGrid}>
                    {stats.map((s, idx) => (
                        <View key={idx} style={styles.statBox}>
                            <View style={[styles.statIconContainer, { backgroundColor: s.color + '10' }]}>
                                <Ionicons name={s.icon as any} size={22} color={s.color} />
                            </View>
                            <View>
                                <Text style={styles.statValText}>{s.value}</Text>
                                <Text style={styles.statLabelText}>{s.label}</Text>
                            </View>
                        </View>
                    ))}
                </View>

                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Quick Access</Text>
                </View>

                <View style={styles.actionGrid}>
                    <TouchableOpacity style={styles.actionItem} onPress={() => router.push("/(tabs)/bookings")}>
                        <LinearGradient colors={["#ECFDF5", "#F0FDF4"]} style={styles.actionIconBox}>
                            <MaterialCommunityIcons name="calendar-check" size={28} color="#2D935C" />
                        </LinearGradient>
                        <Text style={styles.actionLabel}>Schedule</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.actionItem} onPress={() => router.push("/customers")}>
                        <LinearGradient colors={["#EEF2FF", "#F5F3FF"]} style={styles.actionIconBox}>
                            <MaterialCommunityIcons name="account-group" size={28} color="#6366F1" />
                        </LinearGradient>
                        <Text style={styles.actionLabel}>Users</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.actionItem} onPress={() => router.push("/(tabs)/earnings")}>
                        <LinearGradient colors={["#FFFBEB", "#FEF3C7"]} style={styles.actionIconBox}>
                            <MaterialCommunityIcons name="cash-multiple" size={28} color="#F59E0B" />
                        </LinearGradient>
                        <Text style={styles.actionLabel}>Earnings</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.actionItem} onPress={() => router.push("/profile_edit")}>
                        <LinearGradient colors={["#FEF2F2", "#FFF1F1"]} style={styles.actionIconBox}>
                            <MaterialCommunityIcons name="cog" size={28} color="#EF4444" />
                        </LinearGradient>
                        <Text style={styles.actionLabel}>Settings</Text>
                    </TouchableOpacity>
                </View>

                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Recent Requests</Text>
                </View>

                <View style={styles.requestsContainer}>
                    {bookings.length > 0 ? (
                        bookings.slice(0, 3).map((item: any, index: number) => (
                            <TouchableOpacity key={index} style={styles.requestCard} onPress={() => router.push("/(tabs)/bookings")}>
                                <View style={styles.requestIconBox}><Ionicons name="calendar" size={20} color="#2D935C" /></View>
                                <View style={styles.requestMainInfo}>
                                    <Text style={styles.requestName}>{item.patientName || "New Patient"}</Text>
                                    <Text style={styles.requestTime}>{new Date(item.appointmentDate).toDateString()} • {item.appointmentTime}</Text>
                                </View>
                                <View style={styles.statusBadge}><Text style={styles.statusBadgeText}>Pending</Text></View>
                            </TouchableOpacity>
                        ))
                    ) : (
                        <View style={styles.emptyRequestsCard}>
                            <Ionicons name="mail-open-outline" size={40} color="#CBD5E1" />
                            <Text style={styles.emptyRequestsText}>No active requests</Text>
                        </View>
                    )}
                </View>

                <View style={{ height: 60 }} />
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#F8FAFC" },
    header: { backgroundColor: "#FFF", paddingHorizontal: 15, paddingBottom: 25, borderBottomLeftRadius: 32, borderBottomRightRadius: 32, elevation: 4 },
    locationBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 15, marginBottom: 20 },
    locationInfo: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F1F5F9', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 20, marginRight: 'auto' },
    locationPin: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#FFF', justifyContent: 'center', alignItems: 'center', marginRight: 8, elevation: 1 },
    locationLabel: { fontSize: 13, fontWeight: '700', color: '#334155' },
    notificationBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center', marginLeft: 10 },
    profileBtn: { width: 44, height: 44, borderRadius: 22, overflow: 'hidden', borderWidth: 2, borderColor: '#F1F5F9' },
    avatarPlaceholder: { flex: 1, backgroundColor: '#F8FAFC', justifyContent: 'center', alignItems: 'center' },
    headerContent: { marginBottom: 22, paddingHorizontal: 5 },
    greetingText: { fontSize: 13, color: "#64748B", fontWeight: "600" },
    nameText: { fontSize: 24, fontWeight: "900", color: "#1E293B" },
    statusCard: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#FFF", borderRadius: 24, padding: 18, borderLeftWidth: 6, elevation: 3, marginHorizontal: 5 },
    statusInfo: { flex: 1 },
    statusIndicator: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    statusDot: { width: 10, height: 10, borderRadius: 5 },
    statusText: { fontSize: 15, fontWeight: "800" },
    statusSubText: { fontSize: 12, color: "#94A3B8", marginTop: 4 },
    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginTop: 30, marginBottom: 15 },
    sectionTitle: { fontSize: 18, fontWeight: "800", color: "#1E293B" },
    periodSwitcher: { flexDirection: 'row', backgroundColor: '#E2E8F0', borderRadius: 12, overflow: 'hidden' },
    periodBtn: { paddingHorizontal: 12, paddingVertical: 6 },
    periodBtnActive: { backgroundColor: '#2D935C' },
    periodText: { fontSize: 12, fontWeight: '700', color: '#334155' },
    periodTextActive: { color: '#FFF' },
    statsGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 15, gap: 12 },
    statBox: { width: '47%', backgroundColor: '#FFF', borderRadius: 24, padding: 15, flexDirection: 'row', alignItems: 'center', gap: 12, elevation: 1 },
    statIconContainer: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    statValText: { fontSize: 18, fontWeight: '900', color: '#1E293B' },
    statLabelText: { fontSize: 11, color: '#64748B', fontWeight: '600' },
    actionGrid: { flexDirection: 'row', paddingHorizontal: 20, justifyContent: 'space-between', gap: 10 },
    actionItem: { alignItems: 'center', gap: 8 },
    actionIconBox: { width: 64, height: 64, borderRadius: 20, justifyContent: 'center', alignItems: 'center', elevation: 2 },
    actionLabel: { fontSize: 12, fontWeight: '700', color: '#475569' },
    requestsContainer: { paddingHorizontal: 20, gap: 12 },
    requestCard: { backgroundColor: '#FFF', borderRadius: 20, padding: 15, flexDirection: 'row', alignItems: 'center', elevation: 2 },
    requestIconBox: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#F0FDF4', justifyContent: 'center', alignItems: 'center', marginRight: 15 },
    requestMainInfo: { flex: 1 },
    requestName: { fontSize: 16, fontWeight: '700', color: '#1E293B' },
    requestTime: { fontSize: 12, color: '#64748B' },
    statusBadge: { backgroundColor: '#FEF3C7', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
    statusBadgeText: { fontSize: 11, fontWeight: '700', color: '#92400E' },
    emptyRequestsCard: { backgroundColor: '#FFF', borderRadius: 28, padding: 30, alignItems: 'center', borderStyle: 'dashed', borderWidth: 2, borderColor: '#E2E8F0' },
    emptyRequestsText: { fontSize: 14, fontWeight: '700', color: '#94A3B8', marginTop: 10 },
    kycOverlay: { ...StyleSheet.absoluteFillObject, zIndex: 10000, backgroundColor: "rgba(15, 23, 42, 0.6)", justifyContent: "center", alignItems: "center", padding: 24 },
    kycContent: { width: "100%", borderRadius: 40, padding: 32, alignItems: "center", elevation: 20 },
    kycHeader: { alignItems: 'center', marginBottom: 32 },
    kyclIconBox: { width: 86, height: 86, borderRadius: 30, justifyContent: "center", alignItems: "center", marginBottom: 20, overflow: 'hidden' },
    kycTitle: { fontSize: 24, fontWeight: "900", color: "#1E293B", marginBottom: 10, textAlign: "center" },
    kycDesc: { fontSize: 15, color: "#64748B", lineHeight: 22, textAlign: "center" },
    kycCta: { flexDirection: "row", alignItems: "center", justifyContent: 'center', height: 60, width: '100%', borderRadius: 20, gap: 10, overflow: 'hidden' },
    kycCtaText: { fontSize: 16, fontWeight: "800", color: "#FFF" },
    badgeDot: { position: "absolute", top: 10, right: 10, width: 10, height: 10, borderRadius: 5, backgroundColor: "#EF4444", borderWidth: 2, borderColor: "#FFF" },
});
