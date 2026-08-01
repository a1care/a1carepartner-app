import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TextInput,
    TouchableOpacity,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { useQuery, useMutation } from '@tanstack/react-query';
import { partnerBookingService } from '../lib/bookings';
import { Ionicons } from '@expo/vector-icons';
import { getSocket } from '../lib/socket';
import { api } from '../lib/api';

// ── A1Care Brand Color Palette ──────────────────────────────
const PRIMARY      = '#2D935C';
const HEADER_COLOR = '#2D935C';
const AVATAR_BG    = '#1E6B43';
const MY_BUBBLE    = '#2D935C';
const MY_BUBBLE_TEXT = '#FFFFFF';
const THEIR_BUBBLE = '#FFFFFF';
const THEIR_TEXT   = '#1E293B';
const BG_CHAT      = '#F0F7F4';
const TICK_COLOR   = '#A7F3D0';

const QUICK_REPLIES = [
    "I'm on my way 🚗",
    "I've arrived 📍",
    "Please be ready",
    "5 min late, sorry!",
    "Share exact location?",
    "Service done ✅",
    "Thank you! 🙏",
];

function formatMsgTime(dateStr: string) {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function isSameDay(a: string, b: string) {
    const da = new Date(a), db = new Date(b);
    return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate();
}

function dayLabel(dateStr: string) {
    const d = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
    if (isSameDay(dateStr, today.toISOString())) return 'Today';
    if (isSameDay(dateStr, yesterday.toISOString())) return 'Yesterday';
    return d.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function BookingChatScreen() {
    const { id, name } = useLocalSearchParams<{ id: string; name: string }>();
    const router = useRouter();
    const scrollRef = useRef<ScrollView>(null);
    const [typedMessage, setTypedMessage] = useState('');
    const [chatMessages, setChatMessages] = useState<any[]>([]);
    const socketRef = useRef<any>(null);
    const patientName = Array.isArray(name) ? name[0] : (name || 'Patient');

    const { data: initialData, isLoading } = useQuery({
        queryKey: ['booking-chat', id],
        queryFn: () => partnerBookingService.getMessages(id!),
        enabled: !!id,
    });

    useEffect(() => {
        if (initialData?.length > 0) {
            setChatMessages(initialData);
        }
    }, [initialData]);

    useEffect(() => {
        if (!id) return;
        const socket = getSocket();
        if (!socket) return;
        socketRef.current = socket;
        socket.emit('join_room', id);
        const handleMsg = (data: any) => {
            if (data.roomId === id || data.bookingId === id) {
                setChatMessages(prev => {
                    if (prev.find((m: any) => m._id && m._id === data._id)) return prev;
                    return [...prev, data];
                });
            }
        };
        socket.on('receive_message', handleMsg);
        return () => {
            socket.off('receive_message', handleMsg);
            socket.emit('leave_room', id);
        };
    }, [id]);

    useFocusEffect(
        useCallback(() => {
            if (id) api.patch(`/chat/${id}/read`).catch(() => {});
        }, [id])
    );

    const sendMutation = useMutation({
        mutationFn: (msg: string) => partnerBookingService.sendMessage(id!, msg),
        onSuccess: (newMsg: any) => {
            socketRef.current?.emit('send_message', { ...newMsg, roomId: id, senderType: 'Partner' });
            setChatMessages(prev => [...prev, newMsg]);
            setTypedMessage('');
        },
        onError: () => Alert.alert('Error', 'Failed to send message. Please try again.'),
    });

    const handleSend = (msg?: string) => {
        const text = (msg || typedMessage).trim();
        if (!text || sendMutation.isPending) return;
        sendMutation.mutate(text);
    };

    useEffect(() => {
        if (chatMessages.length > 0)
            setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 150);
    }, [chatMessages]);

    const initials = patientName.split(' ').slice(0, 2).map((w: string) => w[0]).join('').toUpperCase();

    const handleBack = () => {
        if (router.canGoBack()) {
            router.back();
        } else {
            router.replace('/(tabs)/bookings' as any);
        }
    };

    return (
        <SafeAreaView style={styles.root} edges={['top']}>
            {/* ── Header ── */}
            <View style={styles.header}>
                <TouchableOpacity onPress={handleBack} style={styles.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <Ionicons name="arrow-back" size={22} color="#fff" />
                </TouchableOpacity>

                <View style={styles.avatarCircle}>
                    <Text style={styles.avatarText}>{initials}</Text>
                </View>

                <View style={styles.headerMeta}>
                    <Text style={styles.headerName} numberOfLines={1}>{patientName}</Text>
                    <View style={styles.headerSubRow}>
                        <View style={styles.greenDot} />
                        <Text style={styles.headerSub}>Booking #{id?.slice(-6).toUpperCase()}</Text>
                    </View>
                </View>

                <TouchableOpacity style={styles.headerAction}>
                    <Ionicons name="call-outline" size={20} color="#fff" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.headerAction}>
                    <Ionicons name="ellipsis-vertical" size={20} color="#fff" />
                </TouchableOpacity>
            </View>

            {/* ── Chat Body ── */}
            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
            >
                <View style={{ flex: 1 }}>
                <View style={[StyleSheet.absoluteFillObject, { backgroundColor: BG_CHAT }]} />

                {isLoading && chatMessages.length === 0 ? (
                    <View style={styles.center}>
                        <ActivityIndicator color={PRIMARY} size="large" />
                    </View>
                ) : (
                    <ScrollView
                        ref={scrollRef}
                        contentContainerStyle={styles.msgList}
                        showsVerticalScrollIndicator={false}
                        keyboardShouldPersistTaps="handled"
                    >
                        {/* Privacy notice */}
                        {chatMessages.length === 0 && (
                            <View style={styles.emptyWrap}>
                                <View style={styles.lockBadge}>
                                    <Ionicons name="lock-closed" size={11} color="#6B7280" />
                                    <Text style={styles.lockText}>
                                        Messages are private between you and the patient
                                    </Text>
                                </View>
                            </View>
                        )}

                        {chatMessages.map((msg: any, idx: number) => {
                            const isMe = msg.senderType === 'Partner';
                            const showDay = idx === 0 || !isSameDay(msg.createdAt, chatMessages[idx - 1]?.createdAt);
                            const isLast = idx === chatMessages.length - 1;

                            return (
                                <React.Fragment key={msg._id || idx}>
                                    {showDay && (
                                        <View style={styles.dayChip}>
                                            <Text style={styles.dayText}>{dayLabel(msg.createdAt)}</Text>
                                        </View>
                                    )}
                                    <View style={[styles.msgRow, isMe ? styles.rowMe : styles.rowThem]}>
                                        <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleThem]}>
                                            {isMe
                                                ? <View style={styles.tailRight} />
                                                : <View style={styles.tailLeft} />
                                            }
                                            <Text style={[styles.msgText, { color: isMe ? MY_BUBBLE_TEXT : THEIR_TEXT }]}>
                                                {msg.message}
                                            </Text>
                                            <View style={styles.metaRow}>
                                                <Text style={styles.msgTime}>{formatMsgTime(msg.createdAt)}</Text>
                                                {isMe && (
                                                    <Ionicons
                                                        name="checkmark-done"
                                                        size={14}
                                                        color={PRIMARY}
                                                        style={{ marginLeft: 3 }}
                                                    />
                                                )}
                                            </View>
                                        </View>
                                    </View>
                                </React.Fragment>
                            );
                        })}
                    </ScrollView>
                )}
            </View>

            {/* ── Quick Replies ── */}
            {chatMessages.length === 0 && (
                <View style={styles.quickWrap}>
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.quickList}
                        keyboardShouldPersistTaps="handled"
                    >
                        {QUICK_REPLIES.map((q) => (
                            <TouchableOpacity
                                key={q}
                                style={styles.quickChip}
                                activeOpacity={0.75}
                                onPress={() => handleSend(q)}
                            >
                                <Text style={styles.quickText} numberOfLines={1}>{q}</Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>
            )}

            {/* ── Input Bar ── */}
                <View style={styles.inputBar}>
                    <View style={styles.inputWrap}>
                        <TouchableOpacity style={{ paddingHorizontal: 8 }}>
                            <Ionicons name="happy-outline" size={22} color="#94A3B8" />
                        </TouchableOpacity>
                        <TextInput
                            style={styles.input}
                            placeholder="Reply to patient..."
                            placeholderTextColor="#94A3B8"
                            value={typedMessage}
                            onChangeText={setTypedMessage}
                            multiline
                        />
                    </View>
                    <TouchableOpacity
                        style={[styles.sendBtn, { backgroundColor: typedMessage.trim() ? PRIMARY : '#8DB48E' }]}
                        onPress={() => handleSend()}
                        disabled={sendMutation.isPending}
                        activeOpacity={0.85}
                    >
                        {sendMutation.isPending
                            ? <ActivityIndicator color="#fff" size="small" />
                            : <Ionicons name="send" size={20} color="#fff" />
                        }
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: HEADER_COLOR },

    header: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: HEADER_COLOR,
        paddingHorizontal: 10, paddingVertical: 12, gap: 10,
        shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
        elevation: 4,
    },
    backBtn: { padding: 6, borderRadius: 20 },
    avatarCircle: {
        width: 42, height: 42, borderRadius: 21,
        backgroundColor: AVATAR_BG,
        alignItems: 'center', justifyContent: 'center',
        borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)',
    },
    avatarText: { color: '#fff', fontWeight: '900', fontSize: 15, letterSpacing: 0.5 },
    headerMeta: { flex: 1 },
    headerName: { color: '#fff', fontWeight: '800', fontSize: 16 },
    headerSubRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
    greenDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#A7F3D0' },
    headerSub: { color: 'rgba(255,255,255,0.8)', fontSize: 11, fontWeight: '600' },
    headerAction: { padding: 8 },

    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    msgList: { paddingHorizontal: 12, paddingTop: 16, paddingBottom: 10 },

    emptyWrap: { alignItems: 'center', paddingTop: 28 },
    lockBadge: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        backgroundColor: 'rgba(255,255,255,0.92)',
        paddingHorizontal: 16, paddingVertical: 8,
        borderRadius: 12, maxWidth: 290,
        shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 1 },
        elevation: 1,
    },
    lockText: { fontSize: 11.5, color: '#64748B', textAlign: 'center', lineHeight: 17, fontWeight: '500' },

    dayChip: {
        alignSelf: 'center', backgroundColor: '#D1FAE5',
        paddingHorizontal: 16, paddingVertical: 5,
        borderRadius: 14, marginVertical: 12,
        elevation: 1, borderWidth: 1, borderColor: '#A7F3D0',
    },
    dayText: { fontSize: 11.5, color: '#065F46', fontWeight: '700' },

    msgRow: { marginBottom: 5 },
    rowMe: { alignItems: 'flex-end' },
    rowThem: { alignItems: 'flex-start' },

    bubble: {
        maxWidth: '78%',
        paddingHorizontal: 13, paddingTop: 9, paddingBottom: 7,
        borderRadius: 14, elevation: 2,
        shadowColor: '#000', shadowOpacity: 0.07, shadowRadius: 4, shadowOffset: { width: 0, height: 1 },
        position: 'relative',
    },
    bubbleMe: { backgroundColor: MY_BUBBLE, borderTopRightRadius: 3 },
    bubbleThem: { backgroundColor: THEIR_BUBBLE, borderTopLeftRadius: 3, borderWidth: 1, borderColor: '#E8F5EE' },

    tailRight: {
        position: 'absolute', top: 0, right: -8,
        width: 0, height: 0,
        borderTopWidth: 11, borderTopColor: MY_BUBBLE,
        borderLeftWidth: 9, borderLeftColor: 'transparent',
    },
    tailLeft: {
        position: 'absolute', top: 0, left: -8,
        width: 0, height: 0,
        borderTopWidth: 11, borderTopColor: THEIR_BUBBLE,
        borderRightWidth: 9, borderRightColor: 'transparent',
    },

    msgText: { fontSize: 14.5, lineHeight: 21 },
    metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 5, gap: 3 },
    msgTime: { fontSize: 10.5 },

    // Quick replies
    quickWrap: { backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#E8F5EE', paddingBottom: 2 },
    quickList: { paddingHorizontal: 12, paddingVertical: 10, flexDirection: 'row', gap: 8 },
    quickChip: {
        backgroundColor: '#F0FDF6',
        borderRadius: 20,
        paddingHorizontal: 15,
        paddingVertical: 8,
        borderWidth: 1.5,
        borderColor: '#A7F3D0',
    },
    quickText: { fontSize: 13, color: PRIMARY, fontWeight: '700' },

    // Input bar
    inputBar: {
        flexDirection: 'row', alignItems: 'flex-end',
        gap: 8, paddingHorizontal: 10, paddingVertical: 10,
        backgroundColor: '#fff',
        borderTopWidth: 1, borderTopColor: '#E8F5EE',
    },
    inputWrap: {
        flex: 1, flexDirection: 'row', alignItems: 'center',
        backgroundColor: '#F8FAFC',
        borderRadius: 26, borderWidth: 1.5, borderColor: '#D1FAE5',
        paddingVertical: 6, paddingRight: 10, minHeight: 46,
    },
    input: {
        flex: 1, fontSize: 15, color: '#1E293B',
        paddingHorizontal: 10, maxHeight: 110, lineHeight: 20,
    },
    sendBtn: {
        width: 48, height: 48, borderRadius: 24,
        backgroundColor: PRIMARY,
        alignItems: 'center', justifyContent: 'center',
        elevation: 3,
        shadowColor: PRIMARY, shadowOpacity: 0.35, shadowRadius: 6, shadowOffset: { width: 0, height: 3 },
    },
});
