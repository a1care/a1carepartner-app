import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');

let showToastFn: any = null;

// This provides the exact same API as react-native-toast-message, 
// so you don't need to change much in your code!
export const Toast = {
    show: (options: { type: 'success' | 'error' | 'info', text1: string, text2?: string }) => {
        if (showToastFn) {
            showToastFn(options);
        }
    }
};

export function ToastProvider({ children }: { children?: React.ReactNode }) {
    const [toast, setToast] = useState<{ type: string; text1: string; text2?: string, id: number } | null>(null);
    const slideAnim = useRef(new Animated.Value(-20)).current;
    const fadeAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        showToastFn = (options: any) => {
            const id = Date.now();
            setToast({ ...options, id });

            // Reset for compact top-toast animation
            slideAnim.setValue(-20);
            fadeAnim.setValue(0);

            Animated.parallel([
                Animated.timing(slideAnim, {
                    toValue: 0,
                    duration: 220,
                    useNativeDriver: true,
                }),
                Animated.timing(fadeAnim, {
                    toValue: 1,
                    duration: 220,
                    useNativeDriver: true,
                }),
            ]).start();

            // Auto hide after 3 seconds
            setTimeout(() => {
                hideToast(id);
            }, 3000);
        };
    }, []);

    const hideToast = (idToHide: number) => {
        setToast((currentToast) => {
            if (currentToast && currentToast.id === idToHide) {
                Animated.parallel([
                    Animated.timing(slideAnim, {
                        toValue: -16,
                        duration: 180,
                        useNativeDriver: true,
                    }),
                    Animated.timing(fadeAnim, {
                        toValue: 0,
                        duration: 180,
                        useNativeDriver: true,
                    }),
                ]).start(() => setToast(null));
            }
            return currentToast;
        });
    };

    return (
        <>
            {children}
            {toast ? (
                <SafeAreaView pointerEvents="box-none" style={StyleSheet.absoluteFill}>
                    <Animated.View style={[
                        styles.toastContainer,
                        { transform: [{ translateY: slideAnim }], opacity: fadeAnim },
                        toast.type === 'error' ? styles.errorBg :
                            toast.type === 'info' ? styles.infoBg : styles.successBg
                    ]}>
                        <TouchableOpacity onPress={() => hideToast(toast.id)} activeOpacity={0.8}>
                            <View style={styles.content}>
                                <View style={styles.titleRow}>
                                    <View style={[styles.dot, toast.type === 'error' ? styles.dotError : toast.type === 'info' ? styles.dotInfo : styles.dotSuccess]} />
                                    <Text style={[styles.text1, toast.type === 'success' && { color: '#0D2E4D' }]} numberOfLines={1}>{toast.text1}</Text>
                                </View>
                                {toast.text2 ? <Text style={[styles.text2, toast.type === 'success' && { color: '#4A6E8A', opacity: 1 }]} numberOfLines={2}>{toast.text2}</Text> : null}
                            </View>
                        </TouchableOpacity>
                    </Animated.View>
                </SafeAreaView>
            ) : null}
        </>
    );
}

const styles = StyleSheet.create({
    toastContainer: {
        position: 'absolute',
        top: 54,
        alignSelf: 'center',
        width: width * 0.9,
        minHeight: 52,
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 14,
        shadowColor: "#1E293B",
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.12,
        shadowRadius: 10,
        elevation: 6,
        zIndex: 9999,
        borderWidth: 1
    },
    successBg: {
        backgroundColor: '#EBF5FB', // A1Care Light Blue
        borderColor: '#1A7FD4', 
        borderWidth: 1.5,
    },
    errorBg: {
        backgroundColor: '#EF4444', // Home Action Red
    },
    infoBg: {
        backgroundColor: '#6366F1', // Home Indigo
    },
    content: {
        paddingRight: 4,
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    dotSuccess: { backgroundColor: '#1A7FD4' },
    dotError: { backgroundColor: '#FFFFFF' },
    dotInfo: { backgroundColor: '#FFFFFF' },
    text1: {
        color: 'white',
        fontWeight: '700',
        fontSize: 15,
        letterSpacing: 0.1,
    },
    text2: {
        color: 'white',
        fontSize: 13,
        fontWeight: '500',
        marginTop: 4,
        opacity: 0.9,
    }
});
