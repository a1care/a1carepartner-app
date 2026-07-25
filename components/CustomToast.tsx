import React from 'react';
import { StyleSheet, View, Text, Platform } from 'react-native';
import ToastMsg, { BaseToast, ErrorToast } from 'react-native-toast-message';
import { CheckCircle, XCircle, Info, AlertTriangle } from 'lucide-react-native';

export const Toast = {
    show: (options: { type: 'success' | 'error' | 'info' | 'warning', text1: string, text2?: string }) => {
        ToastMsg.show({
            ...options,
            position: 'top',
            visibilityTime: 3500,
            autoHide: true,
            topOffset: Platform.OS === 'ios' ? 55 : 40,
        });
    }
};

export function ToastProvider({ children }: { children?: React.ReactNode }) {
    return (
        <>
            {children}
            <ToastMsg
                config={{
                    success: ({ text1, text2 }) => (
                        <View style={[styles.toastBase, styles.toastSuccess]}>
                            <View style={[styles.toastAccent, { backgroundColor: '#10B981' }]} />
                            <View style={styles.toastIconWrap}>
                                <CheckCircle size={20} color="#10B981" />
                            </View>
                            <View style={styles.toastContent}>
                                <Text style={[styles.toastText1, { color: '#065F46' }]} numberOfLines={1}>{text1}</Text>
                                {text2 ? <Text style={[styles.toastText2, { color: '#047857' }]} numberOfLines={2}>{text2}</Text> : null}
                            </View>
                        </View>
                    ),
                    error: ({ text1, text2 }) => (
                        <View style={[styles.toastBase, styles.toastError]}>
                            <View style={[styles.toastAccent, { backgroundColor: '#EF4444' }]} />
                            <View style={styles.toastIconWrap}>
                                <XCircle size={20} color="#EF4444" />
                            </View>
                            <View style={styles.toastContent}>
                                <Text style={[styles.toastText1, { color: '#991B1B' }]} numberOfLines={1}>{text1}</Text>
                                {text2 ? <Text style={[styles.toastText2, { color: '#B91C1C' }]} numberOfLines={2}>{text2}</Text> : null}
                            </View>
                        </View>
                    ),
                    info: ({ text1, text2 }) => (
                        <View style={[styles.toastBase, styles.toastInfo]}>
                            <View style={[styles.toastAccent, { backgroundColor: '#3B82F6' }]} />
                            <View style={styles.toastIconWrap}>
                                <Info size={20} color="#3B82F6" />
                            </View>
                            <View style={styles.toastContent}>
                                <Text style={[styles.toastText1, { color: '#1E40AF' }]} numberOfLines={1}>{text1}</Text>
                                {text2 ? <Text style={[styles.toastText2, { color: '#1D4ED8' }]} numberOfLines={2}>{text2}</Text> : null}
                            </View>
                        </View>
                    ),
                    warning: ({ text1, text2 }) => (
                        <View style={[styles.toastBase, styles.toastWarning]}>
                            <View style={[styles.toastAccent, { backgroundColor: '#F59E0B' }]} />
                            <View style={styles.toastIconWrap}>
                                <AlertTriangle size={20} color="#F59E0B" />
                            </View>
                            <View style={styles.toastContent}>
                                <Text style={[styles.toastText1, { color: '#78350F' }]} numberOfLines={1}>{text1}</Text>
                                {text2 ? <Text style={[styles.toastText2, { color: '#92400E' }]} numberOfLines={2}>{text2}</Text> : null}
                            </View>
                        </View>
                    ),
                }}
            />
        </>
    );
}

const styles = StyleSheet.create({
    toastBase: {
        width: '92%',
        maxWidth: 420,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.12,
        shadowRadius: 16,
        elevation: 10,
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.06)',
        minHeight: 56,
    },
    toastAccent: {
        width: 5,
        alignSelf: 'stretch',
    },
    toastIconWrap: {
        paddingHorizontal: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    toastContent: {
        flex: 1,
        paddingVertical: 12,
        paddingRight: 16,
        justifyContent: 'center',
    },
    toastSuccess: {
        backgroundColor: '#F0FDF4',
        borderColor: 'rgba(16,185,129,0.15)',
    },
    toastError: {
        backgroundColor: '#FFF1F2',
        borderColor: 'rgba(239,68,68,0.15)',
    },
    toastInfo: {
        backgroundColor: '#EFF6FF',
        borderColor: 'rgba(59,130,246,0.15)',
    },
    toastWarning: {
        backgroundColor: '#FFFBEB',
        borderColor: 'rgba(245,158,11,0.15)',
    },
    toastText1: {
        fontSize: 14,
        fontWeight: '700',
        lineHeight: 20,
    },
    toastText2: {
        fontSize: 12,
        fontWeight: '400',
        marginTop: 2,
        lineHeight: 17,
        opacity: 0.85,
    },
});

