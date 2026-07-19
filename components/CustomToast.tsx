import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');

let showToastFn: any = null;

export const Toast = {
    show: (options: { type: 'success' | 'error' | 'info', text1: string, text2?: string }) => {
        if (showToastFn) {
            showToastFn(options);
        }
    }
};

export function ToastProvider({ children }: { children?: React.ReactNode }) {
    const [toast, setToast] = useState<{ type: string; text1: string; text2?: string, id: number } | null>(null);
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const translateAnim = useRef(new Animated.Value(-40)).current;

    useEffect(() => {
        showToastFn = (options: any) => {
            const id = Date.now();
            setToast({ ...options, id });

            fadeAnim.setValue(0);
            translateAnim.setValue(-40);

            // Smooth fade + slide down animation
            Animated.parallel([
                Animated.timing(fadeAnim, {
                    toValue: 1,
                    duration: 350,
                    useNativeDriver: true,
                }),
                Animated.spring(translateAnim, {
                    toValue: 0,
                    useNativeDriver: true,
                    tension: 40,
                    friction: 7,
                })
            ]).start();

            // Auto hide after 3.5 seconds
            setTimeout(() => {
                hideToast(id);
            }, 3500);
        };
    }, []);

    const hideToast = (idToHide: number) => {
        setToast((currentToast) => {
            if (currentToast && currentToast.id === idToHide) {
                Animated.parallel([
                    Animated.timing(fadeAnim, {
                        toValue: 0,
                        duration: 300,
                        useNativeDriver: true,
                    }),
                    Animated.timing(translateAnim, {
                        toValue: -30,
                        duration: 300,
                        useNativeDriver: true,
                    })
                ]).start(() => {
                    setToast(null);
                });
            }
            return currentToast;
        });
    };

    return (
        <>
            {children}
            {toast ? (
                <SafeAreaView pointerEvents="box-none" style={styles.overlay}>
                    <Animated.View style={[
                        styles.toastContainer,
                        { opacity: fadeAnim, transform: [{ translateY: translateAnim }] },
                        toast.type === 'error' ? styles.errorBg :
                            toast.type === 'info' ? styles.infoBg : styles.successBg
                    ]}>
                        <TouchableOpacity onPress={() => hideToast(toast.id)} activeOpacity={0.9}>
                            <View style={styles.content}>
                                <Text style={[styles.text1, toast.type === 'success' && { color: '#0F2C59' }]}>{toast.text1}</Text>
                                {toast.text2 ? <Text style={[styles.text2, toast.type === 'success' && { color: '#3A5B80' }]}>{toast.text2}</Text> : null}
                            </View>
                        </TouchableOpacity>
                    </Animated.View>
                </SafeAreaView>
            ) : null}
        </>
    );
}

const styles = StyleSheet.create({
    overlay: {
        position: 'absolute',
        top: 20,
        left: 0,
        right: 0,
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 99999,
    },
    toastContainer: {
        width: Math.min(width - 32, 400),
        paddingVertical: 14,
        paddingHorizontal: 18,
        borderRadius: 16,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.12,
        shadowRadius: 10,
        elevation: 8,
        borderWidth: 1.5,
        alignSelf: 'center',
    },
    successBg: {
        backgroundColor: '#ECFDF5', 
        borderColor: '#10B981',
    },
    errorBg: {
        backgroundColor: '#FEF2F2',
        borderColor: '#EF4444',
    },
    infoBg: {
        backgroundColor: '#EFF6FF',
        borderColor: '#3B82F6',
    },
    content: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    text1: {
        fontWeight: '700',
        fontSize: 15,
        color: '#1E293B',
        textAlign: 'center',
    },
    text2: {
        fontSize: 13,
        fontWeight: '500',
        marginTop: 4,
        color: '#64748B',
        textAlign: 'center',
    }
});
