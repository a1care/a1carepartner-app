import React, { useState, useRef, useEffect } from 'react';
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
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { partnerBookingService } from '../lib/bookings';
import { Ionicons, Feather } from '@expo/vector-icons';
import { io, Socket } from 'socket.io-client';

const API_URL = process.env.EXPO_PUBLIC_API_URL?.replace('/api', '') || 'https://api.a1carehospital.in';

export default function BookingChatScreen() {
    const { id, name } = useLocalSearchParams<{ id: string, name: string }>();
    const router = useRouter();
    const queryClient = useQueryClient();
    const scrollRef = useRef<ScrollView>(null);
    const [typedMessage, setTypedMessage] = useState('');
    const socketRef = useRef<Socket | null>(null);

    const { data: initialMessages = [], isLoading } = useQuery({
        queryKey: ['booking-chat', id],
        queryFn: () => partnerBookingService.getMessages(id!),
        enabled: !!id,
    });

    const [chatMessages, setChatMessages] = useState<any[]>([]);

    useEffect(() => {
        if (initialMessages.length > 0) {
            setChatMessages(initialMessages);
        }
    }, [initialMessages]);

    useEffect(() => {
        if (!id) return;

        socketRef.current = io(API_URL);
        const socket = socketRef.current;

        socket.on('connect', () => {
            socket.emit('join_room', id);
        });

        socket.on('receive_message', (data) => {
            if (data.roomId === id) {
                setChatMessages(prev => [...prev, data]);
            }
        });

        return () => {
            socket.disconnect();
        };
    }, [id]);

    const mutation = useMutation({
        mutationFn: (msg: string) => partnerBookingService.sendMessage(id!, msg),
        onSuccess: (newMsg) => {
            setTypedMessage('');
            socketRef.current?.emit('send_message', {
                ...newMsg,
                roomId: id,
                senderType: 'Staff'
            });
            setChatMessages(prev => [...prev, newMsg]);
        },
        onError: () => {
            Alert.alert("Error", "Failed to send message.");
        }
    });

    const handleSend = () => {
        if (!typedMessage.trim() || mutation.isPending) return;
        mutation.mutate(typedMessage);
    };

    useEffect(() => {
        if (chatMessages.length > 0) {
            setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 300);
        }
    }, [chatMessages]);

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color="#1E293B" />
                </TouchableOpacity>
                <View style={styles.headerInfo}>
                    <Text style={styles.headerTitle} numberOfLines={1}>{name || 'Patient'}</Text>
                    <Text style={styles.headerSub}>Booking ID: #{id?.slice(-6).toUpperCase()}</Text>
                </View>
            </View>

            {isLoading && chatMessages.length === 0 ? (
                <View style={styles.center}>
                    <ActivityIndicator color="#2D935C" />
                </View>
            ) : (
                <ScrollView 
                    ref={scrollRef} 
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                >
                    {chatMessages.map((msg: any) => {
                        const isMe = msg.senderType === 'Staff';
                        return (
                            <View key={msg._id || Math.random()} style={[styles.bubble, isMe ? styles.myBubble : styles.theirBubble]}>
                                <Text style={[styles.msgText, isMe ? styles.myText : styles.theirText]}>{msg.message}</Text>
                                <Text style={[styles.timeText, isMe ? styles.myTime : styles.theirTime]}>
                                    {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </Text>
                            </View>
                        );
                    })}
                </ScrollView>
            )}

            <KeyboardAvoidingView 
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
            >
                <View style={styles.inputArea}>
                    <TextInput
                        style={styles.input}
                        placeholder="Reply to patient..."
                        value={typedMessage}
                        onChangeText={setTypedMessage}
                        multiline
                    />
                    <TouchableOpacity 
                        style={[styles.sendButton, !typedMessage.trim() && { opacity: 0.5 }]} 
                        onPress={handleSend}
                    >
                        <Feather name="send" size={20} color="#FFF" />
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#F8FAFC" },
    header: { flexDirection: "row", alignItems: "center", padding: 16, backgroundColor: "#FFF", borderBottomWidth: 1, borderBottomColor: "#F1F5F9" },
    backButton: { marginRight: 15 },
    headerInfo: { flex: 1 },
    headerTitle: { fontSize: 16, fontWeight: "800", color: "#1E293B" },
    headerSub: { fontSize: 12, color: "#2D935C" },
    center: { flex: 1, justifyContent: "center", alignItems: "center" },
    scrollContent: { padding: 20 },
    bubble: { maxWidth: "80%", padding: 14, borderRadius: 20, marginBottom: 10 },
    myBubble: { alignSelf: "flex-end", backgroundColor: "#2D935C", borderBottomRightRadius: 4 },
    theirBubble: { alignSelf: "flex-start", backgroundColor: "#FFF", borderBottomLeftRadius: 4, borderWidth: 1, borderColor: "#F1F5F9" },
    msgText: { fontSize: 14, lineHeight: 20 },
    myText: { color: "#FFF" },
    theirText: { color: "#1E293B" },
    timeText: { fontSize: 10, marginTop: 4, alignSelf: "flex-end" },
    myTime: { color: "rgba(255,255,255,0.7)" },
    theirTime: { color: "#94A3B8" },
    inputArea: { flexDirection: "row", alignItems: "center", padding: 12, backgroundColor: "#FFF", borderTopWidth: 1, borderTopColor: "#F1F5F9" },
    input: { flex: 1, backgroundColor: "#F8FAFC", borderRadius: 24, paddingHorizontal: 18, paddingVertical: 10, fontSize: 15, color: "#1E293B", marginRight: 10, maxHeight: 100 },
    sendButton: { width: 50, height: 50, borderRadius: 25, backgroundColor: "#2D935C", justifyContent: "center", alignItems: "center" }
});
