import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useConfigStore } from '../stores/config.store';

export default function MaintenanceScreen() {
    const { config } = useConfigStore();

    const primaryColor = config?.branding.primaryColor || '#2F80ED';

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.content}>
                <View style={[styles.iconContainer, { backgroundColor: primaryColor + '10' }]}>
                    <Ionicons name="construct" size={80} color={primaryColor} />
                </View>
                
                <Text style={styles.title}>Partner System Maintenance</Text>
                <Text style={styles.description}>
                    We are performing critical system updates to enhance your experience. 
                    The partner portal will be back online shortly.
                </Text>

                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Emergency Coordination?</Text>
                    
                    {config?.contact.supportPhone && (
                        <TouchableOpacity 
                            style={styles.contactItem}
                            onPress={() => Linking.openURL(`tel:${config.contact.supportPhone}`)}
                        >
                            <Ionicons name="call" size={20} color={primaryColor} />
                            <Text style={styles.contactText}>{config.contact.supportPhone}</Text>
                        </TouchableOpacity>
                    )}

                    {config?.contact.supportEmail && (
                        <TouchableOpacity 
                            style={styles.contactItem}
                            onPress={() => Linking.openURL(`mailto:${config.contact.supportEmail}`)}
                        >
                            <Ionicons name="mail" size={20} color={primaryColor} />
                            <Text style={styles.contactText}>{config.contact.supportEmail}</Text>
                        </TouchableOpacity>
                    )}
                </View>

                <Text style={styles.footer}>We appreciate your professional cooperation.</Text>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 30,
    },
    iconContainer: {
        width: 140,
        height: 140,
        borderRadius: 70,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 30,
    },
    title: {
        fontSize: 26,
        fontWeight: '900',
        color: '#1A1A1A',
        marginBottom: 15,
        textAlign: 'center',
    },
    description: {
        fontSize: 16,
        color: '#666',
        textAlign: 'center',
        lineHeight: 24,
        marginBottom: 40,
    },
    card: {
        width: '100%',
        backgroundColor: '#F8F9FA',
        borderRadius: 24,
        padding: 24,
        borderWidth: 1,
        borderColor: '#EEE',
    },
    cardTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#1A1A1A',
        marginBottom: 20,
        textAlign: 'center',
    },
    contactItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 15,
        marginBottom: 15,
        backgroundColor: '#fff',
        padding: 15,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#F0F0F0',
    },
    contactText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#444',
    },
    footer: {
        marginTop: 40,
        fontSize: 14,
        color: '#999',
        fontWeight: '600',
    }
});
