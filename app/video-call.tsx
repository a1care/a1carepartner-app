import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ActivityIndicator, Alert, TouchableOpacity, Text } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
// import AgoraUIKit from 'agora-rn-uikit'; // This crashes in Expo Go!
let AgoraUIKit: any = null;
try {
    AgoraUIKit = require('agora-rn-uikit').default;
} catch (e) {
    console.warn("AgoraUIKit not available (Expo Go?)");
}

import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../lib/api';

/**
 * Partner App Video Consultation Screen.
 * Uses Agora for secure RTC.
 */
export default function VideoCallScreen() {
    const { channelName, bookingId } = useLocalSearchParams();
    const router = useRouter();
    const [tokenData, setTokenData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchToken() {
            try {
                // Request token from Agora backend module we just created
                const res = await api.get(`/agora/token?channelName=${channelName || bookingId}`);
                setTokenData(res.data.data);
            } catch (err: any) {
                console.error("Failed to fetch Agora token", err);
                Alert.alert("Error", "Could not start video call. Ensure backend keys are set.");
                router.back();
            } finally {
                setLoading(false);
            }
        }
        fetchToken();
    }, [channelName, bookingId]);

    if (loading) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator size="large" color="#2D935C" />
                <Text style={styles.loadingText}>Initializing secure consultation...</Text>
            </View>
        );
    }

    if (!tokenData?.token) {
        return (
            <View style={styles.centered}>
                <Text>Token Error. Check environment.</Text>
                <TouchableOpacity onPress={() => router.back()} style={styles.retryButton}>
                    <Text style={{ color: '#2D935C' }}>Go Back</Text>
                </TouchableOpacity>
            </View>
        );
    }

    const connectionData = {
        appId: tokenData.appId,
        channel: tokenData.channelName,
        token: tokenData.token,
        uid: 0,
    };

    const callbacks = {
        EndCall: () => {
            Alert.alert("Consultation Finished", "End of session.");
            router.back();
        },
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.exitButton}>
                    <Ionicons name="arrow-back" size={24} color="#FFF" />
                </TouchableOpacity>
                <Text style={styles.headerText}>Video Consultation</Text>
            </View>
            <View style={{ flex: 1 }}>
                {AgoraUIKit ? (
                    <AgoraUIKit connectionData={connectionData} rtcCallbacks={callbacks} />
                ) : (
                    <View style={styles.centered}>
                        <Text style={{ textAlign: 'center', padding: 20 }}>
                            Video calls are not available in Expo Go. 
                            Please use a Development Build or Release APK to test this feature.
                        </Text>
                        <TouchableOpacity onPress={() => router.back()} style={styles.retryButton}>
                            <Text style={{ color: '#2D935C', fontWeight: 'bold' }}>Go Back</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC' },
    loadingText: { marginTop: 15, fontSize: 16, color: '#2D935C', fontWeight: '600' },
    header: { 
        height: 60, 
        flexDirection: 'row', 
        alignItems: 'center', 
        paddingHorizontal: 15,
        backgroundColor: 'rgba(0,0,0,0.6)',
        position: 'absolute',
        top: 40,
        left: 0,
        right: 0,
        zIndex: 10,
        borderRadius: 20,
        marginHorizontal: 15
    },
    headerText: { color: '#FFF', fontSize: 18, fontWeight: '700', marginLeft: 15 },
    exitButton: { padding: 5 },
    retryButton: { marginTop: 20 }
});
