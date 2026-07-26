import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Switch, ActivityIndicator, RefreshControl, Image, Platform, NativeModules, Alert, Modal } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useState, useMemo, useEffect, useRef } from "react";
import { useAuthStore } from "../../stores/auth";
import { getRolePath } from "../../lib/roleApi";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { Toast } from "../../components/CustomToast";
import * as Location from 'expo-location';
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getFirebaseMessaging } from "../../lib/nativeFirebase";

// Global persistence to prevent flickering during tab switches
let cachedLocationArea = "";
let cachedLocationCity = "";

export default function HomeScreen() {
    const router = useRouter();
    const { user, setUser, token } = useAuthStore() as any;
    const [isOnline, setIsOnline] = useState(user?.status === "Active");
    const [showAreaPicker, setShowAreaPicker] = useState(false);
    const [recentAreas, setRecentAreas] = useState<string[]>([]);
    const [isStatusLoading, setIsStatusLoading] = useState(!user); // loading until user hydrates
    const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
    const statusInitializedRef = useRef(false);
    const [locationArea, setLocationArea] = useState(cachedLocationArea || "...");
    const [locationCity, setLocationCity] = useState(cachedLocationCity || "...");
    const role = user?.role ?? "doctor";
    const primaryColor = "#2D935C";
    const queryClient = useQueryClient();
    const locationWatcherRef = useRef<Location.LocationSubscription | null>(null);
    const locationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const messaging = useMemo(() => getFirebaseMessaging(), []);

    // 1. Handle Permissions & Tracking after login
    useEffect(() => {
        if (!token) return;

        let isMounted = true;

        const initRealtimeFeatures = async () => {
            setupNotifications();

            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                if (isMounted) {
                    setLocationArea("Location access denied");
                    setLocationCity("Please enable in settings");
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
            try {
                locationWatcherRef.current?.remove();
            } catch (err) {
                console.log("[Location Cleanup] Watcher remove failed:", err);
            }
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
                    await api.put("/notifications/fcm-token/partner", { fcmToken });
                } else {
                    console.warn("[FCM] No token received from Firebase");
                }
            }
        } catch (e) {
            console.warn("[FCM] Notification setup error:", e);
        }
    };

    const syncCurrentLocation = async (coordsParam?: { latitude: number; longitude: number; heading?: number | null; speed?: number | null }) => {
        try {
            let coords = coordsParam;
            if (!coords) {
                let loc = await Location.getLastKnownPositionAsync();
                if (!loc) {
                    loc = await Promise.race([
                        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
                        new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000))
                    ]);
                }
                if (loc) {
                    coords = {
                        latitude: loc.coords.latitude,
                        longitude: loc.coords.longitude,
                        heading: loc.coords.heading,
                        speed: loc.coords.speed,
                    };
                }
            }

            if (coords) {
                await AsyncStorage.setItem("last_location", JSON.stringify(coords));
                await api.post("/appointment/location/update", {
                    ...coords,
                    isOnline: isOnline // use actual toggle state, not hardcoded true
                });
                console.log("[Location] Synced:", coords.latitude, coords.longitude);
            } else {
                console.log("[Location] No coordinates resolved yet.");
            }
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

            locationIntervalRef.current = setInterval(() => syncCurrentLocation(), 5 * 60 * 1000);
        } catch (e) {
            console.log("[Location] Setup error:", e);
        }
    };

    const setupLocation = async () => {
        try {
            const cachedArea = await AsyncStorage.getItem("last_location_area");
            const cachedCityLocal = await AsyncStorage.getItem("last_location_city");
            const cachedRecents = await AsyncStorage.getItem("recent_areas_partner");
            if (cachedArea) setLocationArea(cachedArea);
            if (cachedCityLocal) setLocationCity(cachedCityLocal);
            if (cachedRecents) {
                try { setRecentAreas(JSON.parse(cachedRecents)); } catch (e) { }
            }

            // Try last known position first (fastest)
            let location = await Location.getLastKnownPositionAsync();
            if (!location) {
                // If last known position is not available, request a fresh one with a strict 3-second timeout constraint to avoid 6000ms hang
                location = await Promise.race([
                    Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
                    new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000))
                ]);
            }

            if (location) {
                await syncCurrentLocation({
                    latitude: location.coords.latitude,
                    longitude: location.coords.longitude,
                    heading: location.coords.heading,
                    speed: location.coords.speed,
                });
                await reverseGeocode(location.coords.latitude, location.coords.longitude);
            }

            try {
                locationWatcherRef.current?.remove();
            } catch (err) {}
            locationWatcherRef.current = await Location.watchPositionAsync(
                { accuracy: Location.Accuracy.Balanced, distanceInterval: 100 },
                (loc) => {
                    syncCurrentLocation({
                        latitude: loc.coords.latitude,
                        longitude: loc.coords.longitude,
                        heading: loc.coords.heading,
                        speed: loc.coords.speed,
                    });
                    reverseGeocode(loc.coords.latitude, loc.coords.longitude);
                }
            );
        } catch (e) {
            console.log("Location setup error", e);
        }
    };
    const reverseGeocode = async (lat: number, lng: number) => {
        try {
            let city = "Unknown City";
            let area = "Unknown Area";

            // reverseGeocodeAsync is not supported on web in Expo SDK - use Nominatim fallback
            if (Platform.OS === 'web') {
                const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`, {
                    headers: { 'Accept': 'application/json' }
                });
                const data = await res.json();
                if (data && data.address) {
                    const addr = data.address;
                    city = addr.city || addr.town || addr.village || addr.county || addr.state || "Unknown City";
                    area = addr.suburb || addr.neighbourhood || addr.quarter || addr.road || "Unknown Area";
                    
                    setLocationArea(area);
                    setLocationCity(city);
                    cachedLocationArea = area;
                    cachedLocationCity = city;
                    await AsyncStorage.setItem("last_location_area", area);
                    await AsyncStorage.setItem("last_location_city", city);
                    return;
                }
            }

            const address = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
            if (address && address[0]) {
                const geo = address[0];
                city = geo.city || geo.region || "Unknown City";
                area = geo.district || geo.subregion || geo.street || "Unknown Area";
                
                setLocationArea(area);
                setLocationCity(city);
                cachedLocationArea = area;
                cachedLocationCity = city;
                await AsyncStorage.setItem("last_location_area", area);
                await AsyncStorage.setItem("last_location_city", city);
            }
        } catch (e) {
            console.log("[Location] Geocoding failed:", e);
        }
    };

    const { data: staffData, isLoading: loadingUser, refetch: refetchUser } = useQuery({
        queryKey: ["staffDetails"],
        queryFn: async () => {
            const res = await api.get(`/${getRolePath()}/auth/details`);
            return res.data.data;
        },
        enabled: !!token,
    });

    const { data: mySubscription, refetch: refetchSubscription } = useQuery({
        queryKey: ["mySubscription"],
        queryFn: async () => {
            const res = await api.get("/subscription/my-active");
            return res.data?.data || null;
        },
        enabled: !!token,
    });

    useEffect(() => {
        if (staffData) {
            if (!statusInitializedRef.current) {
                statusInitializedRef.current = true;
                setIsOnline(staffData.status === "Active");
            }
            setIsStatusLoading(false);
            setUser({ ...user, ...staffData }); // Sync to global store to unlock tabs/layout
        }
    }, [staffData]);

    const [period, setPeriod] = useState<"thisMonth" | "lastMonth">("thisMonth");

    const { data: bookings = [], isLoading: loadingStats, refetch: refetchStats, isRefetching } = useQuery({
        queryKey: ["homeStats", period],
        queryFn: async () => {
            // Fetch ALL statuses including completed for accurate home stats count
            const res = await api.get("/appointment/provider/feed", {
                params: { status: 'all' }
            });
            return res.data.data || [];
        },
        enabled: !!token,
    });

    const { data: earningsSummary, refetch: refetchEarnings } = useQuery({
        queryKey: ["staff_earnings"],
        queryFn: async () => {
            const res = await api.get(`/${getRolePath()}/earnings/summary`);
            return res.data.data;
        },
        enabled: !!token,
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

    // Unread chat messages count
    const { data: unreadChats = 0 } = useQuery({
        queryKey: ["unread_chats"],
        queryFn: async () => {
            const res = await api.get("/chat/unread/count");
            return res.data?.data?.count || 0;
        },
        enabled: !!user?._id,
        refetchInterval: 30000,
    });

    const totalUnread = unreadCount + unreadChats;

    const stats = useMemo(() => {
        // Use real completed count from earnings summary (includes both Doctor + Service)
        const completed = earningsSummary?.stats?.jobsCompleted ??
            bookings.filter((b: any) => b.status === "Completed" || b.status === "COMPLETED").length;
        const earnings = earningsSummary?.stats?.totalEarnings ??
            bookings
                .filter((b: any) => b.status === "Completed" || b.status === "COMPLETED")
                .reduce((acc: number, b: any) => acc + (b.partnerEarning ?? b.totalAmount ?? 0), 0);

        return [
            { label: "Bookings", value: bookings.length.toString(), icon: "calendar-outline", color: "#6366F1" },
            { label: "Earning", value: `₹${Number(earnings).toLocaleString('en-IN')}`, icon: "cash-outline", color: "#2D935C" },
            { label: "Completed", value: completed.toString(), icon: "checkmark-circle-outline", color: "#10B981" },
            { label: "Rating", value: staffData?.rating ? staffData.rating.toFixed(1) : "N/A", icon: "star-outline", color: "#F59E0B" },
        ];
    }, [bookings, staffData, earningsSummary]);

    const handleToggleOnline = async (val: boolean) => {
        if (isUpdatingStatus) return;
        
        // Prevent going online if subscription is fully expired
        if (val && mySubscription?.isExpired && !mySubscription?.isInGracePeriod) {
            Toast.show({ type: "error", text1: "Subscription Expired", text2: "Please renew your plan to go online." });
            return;
        }

        setIsUpdatingStatus(true);
        const previousStatus = isOnline;
        setIsOnline(val);

        try {
            // Use cached location; if absent or zeroed, try to get a fresh fix
            const cachedRaw = await AsyncStorage.getItem("last_location");
            let coords = cachedRaw ? JSON.parse(cachedRaw) : null;

            const hasValidCoords = coords && (coords.latitude !== 0 || coords.longitude !== 0);
            if (!hasValidCoords) {
                try {
                    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
                    coords = {
                        latitude: loc.coords.latitude,
                        longitude: loc.coords.longitude,
                        heading: loc.coords.heading ?? 0,
                        speed: loc.coords.speed ?? 0,
                    };
                } catch {
                    // Location unavailable — proceed with zeros; backend decides
                }
            }

            await api.post("/appointment/location/update", {
                latitude: coords?.latitude ?? 0,
                longitude: coords?.longitude ?? 0,
                heading: coords?.heading ?? 0,
                speed: coords?.speed ?? 0,
                isOnline: val,
            });
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
        refetchSubscription();
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

            {mySubscription?.isExpired && (
                <View style={{ backgroundColor: '#FEE2E2', padding: 12, borderBottomWidth: 1, borderColor: '#FCA5A5', flexDirection: 'row', alignItems: 'center' }}>
                    <Ionicons name="warning" size={20} color="#DC2626" />
                    <View style={{ marginLeft: 8, flex: 1 }}>
                        <Text style={{ color: '#991B1B', fontWeight: 'bold' }}>
                            {mySubscription?.isInGracePeriod ? "Subscription Expired (Grace Period)" : "Subscription Expired"}
                        </Text>
                        <Text style={{ color: '#B91C1C', fontSize: 12, marginTop: 2 }}>
                            {mySubscription?.isInGracePeriod 
                                ? "You will stop receiving bookings soon. Please renew your plan." 
                                : "You are currently blocked from receiving new bookings. Please renew your plan."}
                        </Text>
                    </View>
                    <TouchableOpacity onPress={() => router.push("/subscription/plans")} style={{ backgroundColor: '#DC2626', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 }}>
                        <Text style={{ color: '#FFF', fontWeight: '600', fontSize: 12 }}>Renew</Text>
                    </TouchableOpacity>
                </View>
            )}

            <ScrollView
                refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={onRefresh} tintColor={primaryColor} />}
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.header}>
                    <View style={styles.locationBar}>
                        <TouchableOpacity style={styles.locationInfo} onPress={() => setShowAreaPicker(true)} activeOpacity={0.8}>
                            <View style={styles.locationPin}><Ionicons name="location-sharp" size={18} color="#1A7FD4" /></View>
                            <View style={styles.locationTextContainer}>
                                <Text style={styles.locationArea} numberOfLines={1}>{locationArea}</Text>
                                <Text style={styles.locationCity} numberOfLines={1}>{locationCity}</Text>
                            </View>
                        </TouchableOpacity>

                        {/* Area Picker Modal */}
                        <Modal visible={showAreaPicker} transparent animationType="slide" onRequestClose={() => setShowAreaPicker(false)}>
                            <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' }} activeOpacity={1} onPress={() => setShowAreaPicker(false)} />
                            <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 32, position: 'absolute', bottom: 0, left: 0, right: 0 }}>
                                <View style={{ alignItems: 'center', paddingVertical: 12 }}>
                                    <View style={{ width: 40, height: 4, backgroundColor: '#e0e0e0', borderRadius: 2 }} />
                                    <Text style={{ fontSize: 16, fontWeight: '700', marginTop: 10, color: '#1a1a1a' }}>Select Your Area</Text>
                                </View>
                                <ScrollView style={{ maxHeight: 300 }}>
                                    {recentAreas.length > 0 && (
                                        <View>
                                            <Text style={{ fontSize: 13, fontWeight: '600', color: '#888', paddingHorizontal: 24, paddingVertical: 8, backgroundColor: '#f9f9f9' }}>RECENT</Text>
                                            {recentAreas.map((area) => (
                                                <TouchableOpacity
                                                    key={`recent-${area}`}
                                                    onPress={async () => {
                                                        setLocationArea(area);
                                                        setLocationCity('Hyderabad');
                                                        cachedLocationArea = area;
                                                        cachedLocationCity = 'Hyderabad';
                                                        await AsyncStorage.setItem('last_location_area', area);
                                                        await AsyncStorage.setItem('last_location_city', 'Hyderabad');
                                                        
                                                        let newRecents = [area, ...recentAreas.filter(a => a !== area)].slice(0, 3);
                                                        setRecentAreas(newRecents);
                                                        await AsyncStorage.setItem('recent_areas_partner', JSON.stringify(newRecents));
                                                        
                                                        setShowAreaPicker(false);
                                                    }}
                                                    style={{
                                                        flexDirection: 'row',
                                                        alignItems: 'center',
                                                        paddingHorizontal: 24,
                                                        paddingVertical: 14,
                                                        borderBottomWidth: 1,
                                                        borderBottomColor: '#f0f0f0',
                                                        backgroundColor: locationArea === area ? '#EBF5FB' : '#fff',
                                                    }}
                                                >
                                                    <Ionicons name="location-sharp" size={16} color="#1A7FD4" style={{ marginRight: 12 }} />
                                                    <Text style={{ fontSize: 15, color: '#1a1a1a', fontWeight: locationArea === area ? '700' : '400' }}>{area}</Text>
                                                    {locationArea === area && <Text style={{ marginLeft: 'auto', color: '#1A7FD4', fontSize: 18 }}>✓</Text>}
                                                </TouchableOpacity>
                                            ))}
                                            <Text style={{ fontSize: 13, fontWeight: '600', color: '#888', paddingHorizontal: 24, paddingVertical: 8, backgroundColor: '#f9f9f9' }}>ALL AREAS</Text>
                                        </View>
                                    )}
                                    {[
                                        'Safilguda',
                                        'Neredmet',
                                        'Malkajgiri',
                                        'Anand Bagh',
                                        'Dayanand Nagar',
                                        'Moula Ali',
                                        'A.S. Rao Nagar',
                                        'Sainikpuri',
                                    ].map((area) => (
                                        <TouchableOpacity
                                            key={area}
                                            onPress={async () => {
                                                setLocationArea(area);
                                                setLocationCity('Hyderabad');
                                                cachedLocationArea = area;
                                                cachedLocationCity = 'Hyderabad';
                                                await AsyncStorage.setItem('last_location_area', area);
                                                await AsyncStorage.setItem('last_location_city', 'Hyderabad');
                                                
                                                let newRecents = [area, ...recentAreas.filter(a => a !== area)].slice(0, 3);
                                                setRecentAreas(newRecents);
                                                await AsyncStorage.setItem('recent_areas_partner', JSON.stringify(newRecents));
                                                
                                                setShowAreaPicker(false);
                                            }}
                                            style={{
                                                flexDirection: 'row',
                                                alignItems: 'center',
                                                paddingHorizontal: 24,
                                                paddingVertical: 14,
                                                borderBottomWidth: 1,
                                                borderBottomColor: '#f0f0f0',
                                                backgroundColor: locationArea === area ? '#EBF5FB' : '#fff',
                                            }}
                                        >
                                            <Ionicons name="location-sharp" size={16} color="#1A7FD4" style={{ marginRight: 12 }} />
                                            <Text style={{ fontSize: 15, color: '#1a1a1a', fontWeight: locationArea === area ? '700' : '400' }}>{area}</Text>
                                            {locationArea === area && <Text style={{ marginLeft: 'auto', color: '#1A7FD4', fontSize: 18 }}>✓</Text>}
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>
                                <TouchableOpacity
                                    onPress={() => { setShowAreaPicker(false); setupLocation(); }}
                                    style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 14, borderTopWidth: 1, borderTopColor: '#f0f0f0' }}
                                >
                                    <Ionicons name="location-sharp" size={16} color="#1A7FD4" style={{ marginRight: 12 }} />
                                    <Text style={{ fontSize: 15, color: '#1A7FD4', fontWeight: '600' }}>Use my current location</Text>
                                </TouchableOpacity>
                            </View>
                        </Modal>
                        <TouchableOpacity style={styles.notificationBtn} onPress={() => router.push("/notifications")}>
                            <Ionicons name="notifications-outline" size={24} color="#1E293B" />
                            {totalUnread > 0 && <View style={styles.badgeDot} />}
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
                        {isStatusLoading
                            ? <ActivityIndicator size="small" color="#2D935C" />
                            : <Switch
                                value={isOnline}
                                onValueChange={handleToggleOnline}
                                trackColor={{ false: "#CBD5E1", true: "#2D935C" }}
                                thumbColor={"#FFF"}
                                disabled={isUpdatingStatus}
                            />
                        }
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
                                    <Text style={styles.requestTime}>{item.date ? new Date(item.date).toLocaleDateString() : item.scheduledTime ? new Date(item.scheduledTime).toLocaleDateString() : "Date TBD"} • {item.timeSlot || item.appointmentTime || item.startingTime || "Time TBD"}</Text>
                                </View>
                                <View style={[styles.statusBadge, { backgroundColor: ({ PENDING: '#FEF3C7', Pending: '#FEF3C7', PARTNER_ASSIGNED: '#D1FAE5', BROADCASTED: '#F3E8FF', ACCEPTED: '#D1FAE5', Confirmed: '#D1FAE5', IN_PROGRESS: '#DBEAFE', COMPLETED: '#D1FAE5', Completed: '#D1FAE5' } as Record<string, string>)[item.status] || '#F1F5F9' }]}>
                                    <Text style={[styles.statusBadgeText, { color: ({ PENDING: '#92400E', Pending: '#92400E', PARTNER_ASSIGNED: '#065F46', BROADCASTED: '#6B21A8', ACCEPTED: '#065F46', Confirmed: '#065F46', IN_PROGRESS: '#1E40AF', COMPLETED: '#065F46', Completed: '#065F46' } as Record<string, string>)[item.status] || '#64748B' }]}>
                                        {({ PENDING: 'Pending', Pending: 'Pending', PARTNER_ASSIGNED: 'Assigned', BROADCASTED: 'Open', ACCEPTED: 'Accepted', Confirmed: 'Confirmed', IN_PROGRESS: 'In Progress', COMPLETED: 'Completed', Completed: 'Completed' } as Record<string, string>)[item.status] || (item.status || 'Pending')}
                                    </Text>
                                </View>
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
    locationInfo: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F1F5F9', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20, marginRight: 'auto' },
    locationPin: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#E8F4FD', justifyContent: 'center', alignItems: 'center', marginRight: 8, elevation: 0 },
    locationTextContainer: { flexDirection: 'column', justifyContent: 'center' },
    locationArea: { fontSize: 13, fontWeight: '800', color: '#0D2E4D' },
    locationCity: { fontSize: 10, fontWeight: '600', color: '#6B8A9E', marginTop: 1 },
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

