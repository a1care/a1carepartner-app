import React from 'react';
import { View, StyleSheet, TouchableOpacity, Text, Alert } from 'react-native';
import { useRouter } from 'expo-router';

// Dynamically require to avoid breaking Expo Go
let AgoraUIKit: any = null;
try {
    AgoraUIKit = require('agora-rn-uikit').default;
} catch (e) {
    console.warn("AgoraUIKit not available (Expo Go?)");
}

interface AgoraCallProps {
    tokenData: {
        appId: string;
        channelName: string;
        token: string;
    };
}

export default function AgoraCall({ tokenData }: AgoraCallProps) {
    const router = useRouter();

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

    if (AgoraUIKit) {
        return <AgoraUIKit connectionData={connectionData} rtcCallbacks={callbacks} />;
    }

    return (
        <View style={styles.centered}>
            <Text style={{ textAlign: 'center', padding: 20 }}>
                Video calls are not available in Expo Go. 
                Please use a Development Build or Release APK to test this feature.
            </Text>
            <TouchableOpacity onPress={() => router.back()} style={styles.retryButton}>
                <Text style={{ color: '#2D935C', fontWeight: 'bold' }}>Go Back</Text>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC' },
    retryButton: { marginTop: 20 }
});
