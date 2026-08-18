import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ActivityIndicator,
    AppState,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { Colors, Shadows } from '../../constants/colors';
import { FontSize } from '../../constants/spacing';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
// @ts-ignore — Map resolves to Map.native.tsx / Map.web.tsx at runtime; no shared .tsx stub
import Map from '../../components/Map';
import { api } from '../../lib/api';

export default function PartnerTrackingScreen() {
    const { id, destLat, destLng, address } = useLocalSearchParams<{ id: string, destLat?: string, destLng?: string, address?: string }>();
    const router = useRouter();
    const [liveLocation, setLiveLocation] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isBackgrounded, setIsBackgrounded] = useState(false);

    useEffect(() => {
        let subscription: Location.LocationSubscription;

        const pushLocation = (coords: Location.LocationObjectCoords) => {
            api.post('/appointment/location/update', {
                latitude: coords.latitude,
                longitude: coords.longitude,
                heading: coords.heading ?? 0,
                speed: coords.speed ?? 0,
                isOnline: true,
            }).catch(() => {});
        };

        const startWatching = async () => {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                setIsLoading(false);
                return;
            }

            subscription = await Location.watchPositionAsync(
                {
                    accuracy: Location.Accuracy.Balanced,
                    timeInterval: 5000,
                    distanceInterval: 10,
                },
                (loc) => {
                    setLiveLocation(loc.coords);
                    setIsLoading(false);
                    pushLocation(loc.coords);
                }
            );
        };

        startWatching();

        // Warn partner when the app is backgrounded mid-tracking
        const appStateSub = AppState.addEventListener('change', (nextState) => {
            setIsBackgrounded(nextState === 'background' || nextState === 'inactive');
        });

        return () => {
            if (subscription) {
                try {
                    subscription.remove();
                } catch (e) {
                    console.log('Error removing location subscription on web', e);
                }
            }
            appStateSub.remove();
        };
    }, []);

    const location = liveLocation;
    const destLatNum = parseFloat(destLat || '');
    const destLngNum = parseFloat(destLng || '');
    
    // Fallback: If coordinates weren't passed through params (e.g. launched from feed), fetch them from the single booking API
    const [fetchedCoords, setFetchedCoords] = useState<{lat: number, lng: number} | null>(null);

    useEffect(() => {
        if (isNaN(destLatNum) || isNaN(destLngNum)) {
            api.get(`/appointment/single/${id}`).then(res => {
                const b = res.data.data;
                const addr = b?.address || b?.addressId;
                const c = addr?.coords || addr?.location || b?.location;
                if (c?.lat && c?.lng) {
                    setFetchedCoords({ lat: parseFloat(c.lat), lng: parseFloat(c.lng) });
                }
            }).catch(e => console.log('Error fetching tracking coords:', e));
        }
    }, [id, destLatNum, destLngNum]);

    const finalDestLat = fetchedCoords ? fetchedCoords.lat : destLatNum;
    const finalDestLng = fetchedCoords ? fetchedCoords.lng : destLngNum;

    const getDistanceAndEta = () => {
        if (!location?.latitude || !location?.longitude || isNaN(finalDestLat) || isNaN(finalDestLng)) {
            return { distanceStr: '-- km', durationStr: '-- mins' };
        }
        const toRad = (value: number) => (value * Math.PI) / 180;
        const R = 6371; // Earth radius in km
        const dLat = toRad(destLatNum - location.latitude);
        const dLon = toRad(destLngNum - location.longitude);
        const lat1 = toRad(location.latitude);
        const lat2 = toRad(destLatNum);

        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const distance = R * c;

        const durationMin = Math.max(1, Math.round(distance * 3)); // Assume 20km/h avg speed

        return {
            distanceStr: `${distance.toFixed(1)} km`,
            durationStr: `${durationMin} mins`,
        };
    };

    const { distanceStr, durationStr } = getDistanceAndEta();

    const openGoogleMapsApp = () => {
        if (address) {
            const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
            import('react-native').then(({ Linking }) => Linking.openURL(url));
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            {isBackgrounded && (
                <View style={{ backgroundColor: '#FEF3C7', padding: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ color: '#92400E', fontWeight: '700', fontSize: 12 }}>⚠️ Tracking paused — return to app to continue updating your location</Text>
                </View>
            )}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
                </TouchableOpacity>
                <View style={styles.headerInfo}>
                    <Text style={styles.headerTitle}>Live Tracking</Text>
                    <Text style={styles.headerSub}>Navigating to Customer</Text>
                </View>
                {address && (
                    <TouchableOpacity onPress={openGoogleMapsApp} style={styles.navigateBtn}>
                        <FontAwesome5 name="directions" size={18} color="#fff" />
                    </TouchableOpacity>
                )}
            </View>

            {isLoading && !location ? (
                <View style={styles.center}>
                    <ActivityIndicator color={Colors.primary} size="large" />
                    <Text style={styles.loadingText}>Acquiring GPS signal...</Text>
                </View>
            ) : !location ? (
                <View style={styles.center}>
                    <Ionicons name="location-outline" size={60} color={Colors.muted} />
                    <Text style={styles.noLocText}>Unable to get location</Text>
                    <Text style={styles.noLocSub}>Please check your GPS settings and permissions.</Text>
                </View>
            ) : (
                <View style={{ flex: 1 }}>
                    <Map location={location} destLatNum={finalDestLat} destLngNum={finalDestLng} />
                    
                    <View style={styles.infoSheet}>
                        <View style={styles.dragHandle} />
                        
                        <View style={styles.sheetHeader}>
                            <View style={styles.pulseContainer}>
                                <View style={styles.pulseDot} />
                                <Text style={styles.liveText}>LIVE TRACKING</Text>
                            </View>
                            <Text style={styles.arrivingText}>Arriving in <Text style={styles.timeBold}>{durationStr}</Text></Text>
                        </View>
                        
                        <View style={styles.divider} />
                        
                        <View style={styles.providerRow}>
                            <View style={styles.markerCircle}>
                                <FontAwesome5 name="motorcycle" size={20} color="#F97316" />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.cardTitle}>You are on the way</Text>
                                <Text style={styles.cardSub} numberOfLines={1}>To: {address || 'Customer Location'}</Text>
                            </View>
                        </View>
                        
                        <View style={styles.statGrid}>
                            <View style={styles.statBox}>
                                <Text style={styles.statLabel}>DISTANCE REMAINING</Text>
                                <Text style={styles.statVal}>{distanceStr}</Text>
                            </View>
                            <View style={styles.statBoxRight}>
                                <Text style={styles.statLabel}>ESTIMATED TIME</Text>
                                <Text style={styles.statVal}>{durationStr}</Text>
                            </View>
                        </View>
                    </View>
                </View>
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },
    header: { flexDirection: "row", alignItems: "center", padding: 16, backgroundColor: Colors.white, ...Shadows.card, zIndex: 10 },
    backButton: { marginRight: 15 },
    headerInfo: { flex: 1 },
    headerTitle: { fontSize: FontSize.base, fontWeight: "800", color: '#0F172A' },
    headerSub: { fontSize: FontSize.xs, color: '#F97316', fontWeight: '600' },
    navigateBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#0F172A', justifyContent: 'center', alignItems: 'center', ...Shadows.small },
    center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 30 },
    loadingText: { marginTop: 15, color: Colors.textSecondary, fontSize: FontSize.sm },
    noLocText: { fontSize: FontSize.base, fontWeight: '700', color: Colors.textPrimary, marginTop: 20 },
    noLocSub: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center', marginTop: 8 },
    infoSheet: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: Colors.white,
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        padding: 24,
        paddingTop: 12,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -10 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
        elevation: 20,
    },
    dragHandle: { width: 40, height: 4, backgroundColor: '#E2E8F0', borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
    sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    pulseContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEF2F2', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, gap: 6 },
    pulseDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#DC2626' },
    liveText: { fontSize: 10, fontWeight: '800', color: '#DC2626', letterSpacing: 0.5 },
    arrivingText: { fontSize: FontSize.sm, color: '#64748B', fontWeight: '500' },
    timeBold: { fontSize: FontSize.lg, color: '#0F172A', fontWeight: '800' },
    divider: { height: 1, backgroundColor: '#F1F5F9', marginBottom: 20 },
    providerRow: { flexDirection: 'row', alignItems: 'center', gap: 15, marginBottom: 24 },
    markerCircle: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#FFF7ED', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#FFEDD5' },
    cardTitle: { fontSize: FontSize.base, fontWeight: '800', color: '#0F172A', marginBottom: 4 },
    cardSub: { fontSize: 13, color: '#64748B', fontWeight: '500' },
    statGrid: { flexDirection: 'row', backgroundColor: '#F8FAFC', borderRadius: 16, padding: 16 },
    statBox: { flex: 1, borderRightWidth: 1, borderRightColor: '#E2E8F0' },
    statBoxRight: { flex: 1, alignItems: 'flex-end' },
    statLabel: { fontSize: 10, color: '#94A3B8', fontWeight: '700', letterSpacing: 0.5, marginBottom: 4 },
    statVal: { fontSize: 16, fontWeight: '800', color: '#0F172A' },
});
