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
import { api } from '../lib/api';
import { Ionicons, Feather } from '@expo/vector-icons';

export default function SupportChatScreen() {
    const { ticketId, subject } = useLocalSearchParams<{ ticketId: string, subject: string }>();
    const router = useRouter();
    const queryClient = useQueryClient();
    const scrollRef = useRef<ScrollView>(null);
    const [typedMessage, setTypedMessage] = useState('');

    const { data: messages = [], isLoading, refetch } = useQuery({
        queryKey: ['chat', ticketId],
        queryFn: async () => {
            const res = await api.get(`/tickets/messages/${ticketId}`);
            return res.data.data || [];
        },
        refetchInterval: 5000,
        enabled: !!ticketId,
    });

    const mutation = useMutation({
        mutationFn: async (msg: string) => {
            return await api.post(`/tickets/messages/send`, { ticketId, message: msg, senderType: 'Staff' });
        },
        onSuccess: () => {
            setTypedMessage('');
            queryClient.invalidateQueries({ queryKey: ['chat', ticketId] });
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
        if (messages.length > 0) {
            setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 300);
        }
    }, [messages]);

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color="#1E293B" />
                </TouchableOpacity>
                <View style={styles.headerInfo}>
                    <Text style={styles.headerTitle} numberOfLines={1}>{subject || 'Support Chat'}</Text>
                    <Text style={styles.headerSub}>A1Care Support Team</Text>
                </View>
            </View>

            {isLoading && messages.length === 0 ? (
                <View style={styles.center}>
                    <ActivityIndicator color="#2D935C" />
                </View>
            ) : (
                <ScrollView 
                    ref={scrollRef} 
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                >
                    {messages.map((msg: any) => {
                        const isMe = msg.senderType === 'Staff';
                        return (
                            <View key={msg._id} style={[styles.bubble, isMe ? styles.myBubble : styles.theirBubble]}>
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
                        placeholder="Type your reply..."
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
