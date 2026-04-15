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
    const slideAnim = useRef(new Animated.Value(width)).current;

    useEffect(() => {
        showToastFn = (options: any) => {
            const id = Date.now();
            setToast({ ...options, id });

            // Instantly reset position to off-screen right
            slideAnim.setValue(width);

            // Animate sliding in from Right to Left
            Animated.spring(slideAnim, {
                toValue: 0,
                useNativeDriver: true,
                damping: 15,
                stiffness: 100,
            }).start();

            // Auto hide after 3 seconds
            setTimeout(() => {
                hideToast(id);
            }, 3000);
        };
    }, []);

    const hideToast = (idToHide: number) => {
        setToast((currentToast) => {
            if (currentToast && currentToast.id === idToHide) {
                // Animate sliding back out to the Right
                Animated.timing(slideAnim, {
                    toValue: width,
                    duration: 300,
                    useNativeDriver: true,
                }).start(() => {
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
                <SafeAreaView pointerEvents="box-none" style={StyleSheet.absoluteFill}>
                    <Animated.View style={[
                        styles.toastContainer,
                        { transform: [{ translateX: slideAnim }] },
                        toast.type === 'error' ? styles.errorBg :
                            toast.type === 'info' ? styles.infoBg : styles.successBg
                    ]}>
                        <TouchableOpacity onPress={() => hideToast(toast.id)} activeOpacity={0.8}>
                            <View style={styles.content}>
                                <Text style={[styles.text1, toast.type === 'success' && { color: '#0D2E4D' }]}>{toast.text1}</Text>
                                {toast.text2 ? <Text style={[styles.text2, toast.type === 'success' && { color: '#4A6E8A', opacity: 1 }]}>{toast.text2}</Text> : null}
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
        top: 60,     // Shows below the status bar area
        right: 16,   // Anchored to the right side
        width: width * 0.85,
        padding: 16,
        borderRadius: 20, // More rounded like home page cards
        shadowColor: "#1E293B",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.15,
        shadowRadius: 15,
        elevation: 10,
        zIndex: 9999,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
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
        paddingRight: 8,
    },
    text1: {
        color: 'white',
        fontWeight: '900',
        fontSize: 16,
        letterSpacing: 0.3,
    },
    text2: {
        color: 'white',
        fontSize: 13,
        fontWeight: '600',
        marginTop: 2,
        opacity: 0.9,
    }
});
