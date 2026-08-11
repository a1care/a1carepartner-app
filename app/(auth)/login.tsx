import React, { useState } from 'react';
import {
    View, Text, TextInput, TouchableOpacity, StyleSheet,
    ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator, Alert, NativeModules, Modal
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Toast } from "../../components/CustomToast";
import { api } from "../../lib/api";
import { useAuthStore, PartnerRole } from "../../stores/auth";
import { needsKycUpload, roleFromPartner } from "../../lib/partnerOnboarding";
import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";

const getAuthModule = () => {
    try {
        return require('@react-native-firebase/auth');
    } catch (e) {
        return null;
    }
};

const getGoogleSignin = () => {
    try {
        return require('@react-native-google-signin/google-signin').GoogleSignin;
    } catch (e) {
        return null;
    }
};

const roleLabels: Record<string, string> = {
    doctor: "Doctor",
    nurse: "Nurse",
    ambulance: "Ambulance Driver",
    rental: "Equipment Provider"
};

const LoginScreen = () => {
    const router = useRouter();
    const { role, specialization } = useLocalSearchParams<{ role: string, specialization?: string }>();
    const { setAuth } = useAuthStore();
    const [mobile, setMobile] = useState("");
    const [otp, setOtp] = useState("");
    const [otpSessionId, setOtpSessionId] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [googleLoading, setGoogleLoading] = useState(false);
    const [verifying, setVerifying] = useState(false);
    const [resendTimer, setResendTimer] = useState(0);
    const [showRestoreModal, setShowRestoreModal] = useState(false);
    const [restoring, setRestoring] = useState(false);

    React.useEffect(() => {
        if (resendTimer <= 0) return;
        const t = setTimeout(() => setResendTimer(s => s - 1), 1000);
        return () => clearTimeout(t);
    }, [resendTimer]);

    // Initialize Google Sign-in
    React.useEffect(() => {
        const GoogleSignin = getGoogleSignin();
        if (GoogleSignin) {
            GoogleSignin.configure({
                webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
            });
        }
    }, []);

    const handleGoogleSignIn = async () => {
        const GoogleSignin = getGoogleSignin();
        const authModule = getAuthModule();

        if (!GoogleSignin || !authModule) {
            Alert.alert("Development Mode", "Google Sign-in is for Debug/Release APK builds only.");
            return;
        }

        setGoogleLoading(true);
        try {
            await GoogleSignin.hasPlayServices();
            const signInResult = await GoogleSignin.signIn();
            const idToken = signInResult.data?.idToken || signInResult.idToken;

            if (!idToken) throw new Error("No ID Token found.");

            // Firebase v23+ exposes GoogleAuthProvider on the nested firebase.auth namespace, not on the default export
            const firebase = authModule.firebase || authModule;
            const provider = firebase?.auth?.GoogleAuthProvider;
            const authFactory = authModule.default || authModule;
            const authInstance = typeof authFactory === "function" ? authFactory() : authFactory;

            if (!provider) {
                throw new Error("GoogleAuthProvider not found. Check if @react-native-firebase/auth is properly installed.");
            }

            const googleCredential = provider.credential(idToken);
            const userCredential = await authInstance.signInWithCredential(googleCredential);
            const firebaseUser = userCredential.user;
            const fbToken = await firebaseUser.getIdToken(true);

            let linkedMobile = firebaseUser.phoneNumber || "";
            if (!linkedMobile) {
                const cleaned = mobile.replace(/\D/g, '');
                if (cleaned.length === 10) {
                    linkedMobile = `+91${cleaned}`;
                } else {
                    setGoogleLoading(false);
                    Alert.alert("Mobile Required", "Enter your 10-digit mobile number first, then click Google again to link it.");
                    return;
                }
            }

            await finishLogin(fbToken, linkedMobile);

        } catch (err: any) {
            if (!err.message?.includes('SIGN_IN_CANCELLED')) {
                Toast.show({ type: 'error', text1: 'Google Sign-in Failed', text2: err.message });
            }
        } finally {
            setGoogleLoading(false);
        }
    };

    const finishLogin = async (idToken?: string, mobileNumber?: string, otpValue?: string) => {
        setVerifying(true);
        try {
            const cleanedMobile = mobileNumber ? (mobileNumber.startsWith('+') ? mobileNumber : `+91${mobileNumber.replace(/\D/g, '').slice(-10)}`) : undefined;
            const payload: Record<string, string> = {};
            if (idToken) payload.idToken = idToken;
            if (cleanedMobile) payload.mobileNumber = cleanedMobile;
            if (otpValue) payload.otp = otpValue;
            if (role) payload.role = role;

            const selectedRole = role?.toLowerCase() || 'doctor';
            const rolePath = selectedRole.includes('nurse') ? 'nurse' :
                             selectedRole.includes('ambulance') ? 'ambulance' :
                             selectedRole.includes('rental') ? 'rental' : 'doctor';

            const res = await api.post(`/${rolePath}/auth/verify-otp`, payload);
            const authToken = res.data?.data?.token;
            const refreshToken = res.data?.data?.refreshToken;

            if (!authToken) throw new Error("No auth token received");

            // Partner verify-otp currently returns only the JWT token.
            // Fetch the actual partner profile separately for routing decisions.
            const detailsRes = await api.get(`/${rolePath}/auth/details`, {
                headers: { Authorization: `Bearer ${authToken}` }
            });
            const userData = detailsRes.data?.data;

            if (!userData) {
                throw new Error("Unable to load partner profile after login");
            }

            const partnerRole = roleFromPartner(userData, role);

            // Update Auth Store (this will trigger AuthGuard in layout)
            await setAuth(authToken, {
                ...userData,
                role: partnerRole as PartnerRole
            }, refreshToken);

            Toast.show({ type: 'success', text1: 'Login Successful' });

            // Precise navigation if AuthGuard hasn't kicked in yet
            if (needsKycUpload(userData, partnerRole)) {
                router.replace({
                    pathname: "/(auth)/register",
                    params: { role: partnerRole, token: authToken, specialization }
                });
            } else if (userData.status === "Pending") {
                router.replace("/(auth)/review-status");
            } else {
                router.replace("/(tabs)/home");
            }

        } catch (err: any) {
            console.log("[Login] Error:", err?.response?.data || err.message);
            const msg = err?.response?.data?.message || err?.message || "Verification Failed";
            Toast.show({ type: 'error', text1: 'Login Failed', text2: msg });
        } finally {
            setVerifying(false);
        }
    };

    const handleSendOtp = async () => {
        let cleaned = mobile.replace(/\D/g, '');
        if (cleaned.startsWith('91') && cleaned.length > 10) cleaned = cleaned.slice(-10);
        if (cleaned.length < 10) return Toast.show({ type: 'error', text1: 'Invalid Mobile' });

        const selectedRole = role?.toLowerCase() || 'doctor';
        const rolePath = selectedRole.includes('nurse') ? 'nurse' :
                         selectedRole.includes('ambulance') ? 'ambulance' :
                         selectedRole.includes('rental') ? 'rental' : 'doctor';

        setLoading(true);
        try {
            await api.post(`/${rolePath}/auth/send-otp`, { mobileNumber: cleaned });
            setOtpSessionId("ACTIVE");
            setResendTimer(30);
            Toast.show({ type: 'success', text1: 'OTP Sent', text2: 'Enter the 6-digit code sent to your number.' });
        } catch (err: any) {
            if (err?.response?.data?.message === "ACCOUNT_DELETED") {
                setShowRestoreModal(true);
            } else {
                Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to send OTP.' });
            }
        } finally {
            setLoading(false);
        }
    };

    const handleRestoreAccount = async () => {
        let cleaned = mobile.replace(/\D/g, '');
        if (cleaned.startsWith('91') && cleaned.length > 10) cleaned = cleaned.slice(-10);

        const selectedRole = role?.toLowerCase() || 'doctor';
        const rolePath = selectedRole.includes('nurse') ? 'nurse' :
                         selectedRole.includes('ambulance') ? 'ambulance' :
                         selectedRole.includes('rental') ? 'rental' : 'doctor';

        setRestoring(true);
        try {
            await api.post(`/${rolePath}/auth/restore`, { mobileNumber: cleaned });
            setShowRestoreModal(false);
            Toast.show({ type: 'success', text1: 'Account Restored', text2: 'Your account is active again!' });
            // Automatically send OTP now
            handleSendOtp();
        } catch (err: any) {
            Toast.show({ type: 'error', text1: 'Restore Failed', text2: err?.response?.data?.message || 'Could not restore account' });
        } finally {
            setRestoring(false);
        }
    };

    const handleVerifyOtp = async () => {
        if (otp.length < 6) return Toast.show({ type: 'error', text1: 'Invalid OTP' });
        const cleaned = mobile.replace(/\D/g, '').slice(-10);
        await finishLogin(undefined, `+91${cleaned}`, otp);
    };

    return (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <StatusBar style="light" />

            <ScrollView
                contentContainerStyle={{ flexGrow: 1 }}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                bounces={false}
            >
                {/* ── Top Hero ── */}
                <LinearGradient
                    colors={['#064E3B', '#059669', '#10B981']}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                    style={styles.hero}
                >
                    {/* Blobs */}
                    <View style={styles.blob1} />
                    <View style={styles.blob2} />
                    <View style={styles.blob3} />

                    {/* Back */}
                    <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                        <Ionicons name="arrow-back" size={20} color="#fff" />
                    </TouchableOpacity>

                    {/* Logo mark */}
                    <View style={styles.logoMark}>
                        <Ionicons name="briefcase" size={34} color="#fff" />
                    </View>

                    <Text style={styles.brandName}>
                        <Text style={{ color: '#12B3B6' }}>A1</Text>
                        <Text style={{ color: '#fff' }}>Care </Text>
                        <Text style={{ color: '#8BE3E5' }}>Partner</Text>
                    </Text>
                    
                    <Text style={styles.heroTitle}>{otpSessionId ? "Verify OTP" : "Welcome Back 👋"}</Text>
                    <Text style={styles.heroSub}>
                        {otpSessionId 
                            ? `Secure code sent to +91 ${mobile}`
                            : `Sign in as a ${roleLabels[role ?? ""] ?? "Partner"}`}
                    </Text>

                    {/* Trust strips */}
                    <View style={styles.trustRow}>
                        {[
                            { icon: 'shield-checkmark-outline' as const, label: '100% Secure' },
                            { icon: 'people-outline' as const, label: 'Verified Partners' },
                        ].map((t, i) => (
                            <View key={i} style={styles.trustPill}>
                                <Ionicons name={t.icon} size={13} color="rgba(255,255,255,0.9)" />
                                <Text style={styles.trustText}>{t.label}</Text>
                            </View>
                        ))}
                    </View>
                </LinearGradient>

                {/* ── Bottom Form Card ── */}
                <View style={styles.formCard}>
                    <View style={styles.dragHandle} />

                    <Text style={styles.formTitle}>{otpSessionId ? "Enter Code" : "Sign In / Register"}</Text>
                    <Text style={styles.formSub}>
                        {otpSessionId ? "Please type the 6-digit code" : "Enter your mobile number to get started"}
                    </Text>

                    {!otpSessionId ? (
                        <>
                            {/* Mobile input */}
                            <View style={styles.inputLabel}>
                                <Text style={styles.labelText}>Mobile Number</Text>
                                <Text style={styles.required}> *</Text>
                            </View>

                            <View style={styles.inputWrapper}>
                                <View style={styles.prefixBox}>
                                    <Ionicons name="call-outline" size={16} color="#059669" />
                                    <Text style={styles.prefix}>+91</Text>
                                </View>
                                <View style={styles.inputDivider} />
                                <TextInput
                                    style={styles.flexInput}
                                    placeholder="98765 43210"
                                    keyboardType="phone-pad"
                                    value={mobile}
                                    onChangeText={(text) => setMobile(text.replace(/\D/g, ''))}
                                    maxLength={10}
                                    placeholderTextColor="#CBD5E1"
                                    editable={!loading}
                                />
                                {mobile.length === 10 && (
                                    <View style={styles.validCheck}>
                                        <Ionicons name="checkmark-circle" size={20} color="#16A34A" />
                                    </View>
                                )}
                            </View>

                            {/* Send OTP Button */}
                            <TouchableOpacity
                                onPress={handleSendOtp}
                                disabled={loading || mobile.length < 10}
                                activeOpacity={0.88}
                                style={[styles.ctaWrap, mobile.length < 10 && { opacity: 0.7 }]}
                            >
                                <LinearGradient
                                    colors={['#064E3B', '#10B981']}
                                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                                    style={styles.cta}
                                >
                                    {loading ? (
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                            <ActivityIndicator color="#fff" />
                                            <Text style={styles.ctaText}>Sending OTP...</Text>
                                        </View>
                                    ) : (
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                            <Text style={styles.ctaText}>Send OTP</Text>
                                            <Ionicons name="arrow-forward" size={18} color="#fff" />
                                        </View>
                                    )}
                                </LinearGradient>
                            </TouchableOpacity>
                        </>
                    ) : (
                        <>
                            {/* OTP input */}
                            <View style={styles.otpContainer}>
                                <TextInput
                                    style={styles.hiddenOtpInput}
                                    value={otp}
                                    onChangeText={setOtp}
                                    keyboardType='number-pad'
                                    textContentType="oneTimeCode"
                                    autoComplete={Platform.OS === 'ios' ? 'one-time-code' : 'sms-otp'}
                                    importantForAutofill="yes"
                                    maxLength={6}
                                    autoFocus
                                    caretHidden
                                    onSubmitEditing={() => handleVerifyOtp()}
                                />
                                {Array(6).fill('').map((_, i) => {
                                    const digit = otp[i] || '';
                                    const isFocused = i === otp.length;
                                    const hasValue = !!digit;
                                    return (
                                        <View
                                            key={i}
                                            style={[
                                                styles.otpBox,
                                                hasValue && styles.otpBoxFilled,
                                                isFocused && styles.otpBoxFocused,
                                            ]}
                                        >
                                            <Text style={styles.otpDigit}>{digit}</Text>
                                        </View>
                                    );
                                })}
                            </View>

                            {/* Verify Button */}
                            <TouchableOpacity
                                onPress={handleVerifyOtp}
                                disabled={verifying || otp.length < 6}
                                activeOpacity={0.88}
                                style={[styles.ctaWrap, otp.length < 6 && { opacity: 0.7 }, { marginTop: 20 }]}
                            >
                                <LinearGradient
                                    colors={['#064E3B', '#10B981']}
                                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                                    style={styles.cta}
                                >
                                    {verifying ? (
                                        <ActivityIndicator color="#fff" />
                                    ) : (
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                            <Text style={styles.ctaText}>Verify & Login</Text>
                                            <Ionicons name="arrow-forward" size={18} color="#fff" />
                                        </View>
                                    )}
                                </LinearGradient>
                            </TouchableOpacity>

                            {/* Resend Action */}
                            <View style={styles.resendRow}>
                                <TouchableOpacity onPress={() => { setOtpSessionId(null); setOtp(""); }} activeOpacity={0.7} style={{ marginRight: 'auto' }}>
                                    <Text style={styles.resendText}>← Change Number</Text>
                                </TouchableOpacity>
                                
                                {resendTimer > 0 ? (
                                    <Text style={styles.timer}>Resend in {resendTimer}s</Text>
                                ) : (
                                    <TouchableOpacity onPress={handleSendOtp} activeOpacity={0.6}>
                                        <Text style={styles.resendBtn}>Resend OTP</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        </>
                    )}
                </View>
            </ScrollView>

            <Modal visible={showRestoreModal} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.iconContainer}>
                            <Ionicons name="warning" size={32} color="#EF4444" />
                        </View>
                        <Text style={styles.modalTitle}>Account Unavailable</Text>
                        <Text style={styles.modalDesc}>
                            Your account is currently disabled and scheduled for deletion. If this was a mistake or you changed your mind, you can reactivate it right now.
                        </Text>
                        
                        <TouchableOpacity style={styles.restoreBtn} onPress={handleRestoreAccount} disabled={restoring}>
                            <LinearGradient colors={["#27AE60", "#1E8449"]} style={styles.restoreBtnGradient}>
                                {restoring ? <ActivityIndicator color="#FFF" /> : <Text style={styles.restoreBtnText}>Restore My Account</Text>}
                            </LinearGradient>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowRestoreModal(false)} disabled={restoring}>
                            <Text style={styles.cancelBtnText}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </KeyboardAvoidingView>
    );
};

export default LoginScreen;

const styles = StyleSheet.create({
    // ── Hero ──
    hero: {
        paddingTop: 60,
        paddingBottom: 44,
        paddingHorizontal: 28,
        alignItems: 'center',
        overflow: 'hidden',
        position: 'relative',
    },
    blob1: { position: 'absolute', top: -60, right: -60, width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(255,255,255,0.06)' },
    blob2: { position: 'absolute', bottom: -40, left: -40, width: 150, height: 150, borderRadius: 75, backgroundColor: 'rgba(255,255,255,0.05)' },
    blob3: { position: 'absolute', top: 20, left: 10, width: 70, height: 70, borderRadius: 35, backgroundColor: 'rgba(255,255,255,0.04)' },

    backBtn: {
        position: 'absolute', top: 18, left: 18,
        width: 40, height: 40, borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.15)',
        justifyContent: 'center', alignItems: 'center',
    },
    logoMark: {
        width: 70, height: 70, borderRadius: 35,
        backgroundColor: 'rgba(255,255,255,0.15)',
        borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.3)',
        justifyContent: 'center', alignItems: 'center',
        marginBottom: 14,
    },
    brandName: { fontSize: 22, fontWeight: '900', marginBottom: 8, letterSpacing: 0.5 },
    heroTitle: { fontSize: 28, fontWeight: '900', color: '#fff', letterSpacing: -0.5, marginBottom: 8 },
    heroSub: { fontSize: 14, color: 'rgba(255,255,255,0.75)', fontWeight: '500', marginBottom: 24 },

    trustRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', justifyContent: 'center' },
    trustPill: {
        flexDirection: 'row', alignItems: 'center', gap: 5,
        backgroundColor: 'rgba(255,255,255,0.14)',
        borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6,
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
    },
    trustText: { fontSize: 11, color: 'rgba(255,255,255,0.9)', fontWeight: '700' },

    // ── Form Card ──
    formCard: {
        flex: 1,
        backgroundColor: '#F4F7FC',
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        marginTop: -24,
        paddingHorizontal: 24,
        paddingTop: 20,
        paddingBottom: 48,
    },
    dragHandle: {
        width: 42, height: 4, borderRadius: 2,
        backgroundColor: '#CBD5E1',
        alignSelf: 'center',
        marginBottom: 24,
    },
    formTitle: { fontSize: 24, fontWeight: '900', color: '#0F172A', letterSpacing: -0.4, marginBottom: 6 },
    formSub: { fontSize: 14, color: '#64748B', fontWeight: '500', marginBottom: 28 },

    inputLabel: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
    labelText: { fontSize: 13, fontWeight: '800', color: '#0F172A' },
    required: { fontSize: 13, color: '#EF4444', fontWeight: '900' },

    inputWrapper: {
        flexDirection: 'row', alignItems: 'center',
        height: 58,
        backgroundColor: '#FFFFFF',
        borderRadius: 18,
        borderWidth: 1.5,
        borderColor: '#E2E8F0',
        paddingHorizontal: 16,
        shadowColor: '#0A1A3A',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.04,
        shadowRadius: 10,
        elevation: 3,
        marginBottom: 20,
    },
    prefixBox: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingRight: 12 },
    prefix: { fontSize: 15, fontWeight: '800', color: '#059669' },
    inputDivider: { width: 1, height: 22, backgroundColor: '#E2E8F0', marginRight: 14 },
    flexInput: { flex: 1, fontSize: 17, color: '#0F172A', fontWeight: '700', letterSpacing: 1 },
    validCheck: { marginLeft: 8 },

    // OTP Specific
    otpContainer: { 
        flexDirection: 'row', 
        justifyContent: 'space-between', 
        width: '100%',
        position: 'relative',
    },
    hiddenOtpInput: {
        position: 'absolute',
        opacity: 0.01,
        width: '100%',
        height: '100%',
    },
    otpBox: {
        width: 48, 
        height: 56, 
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        alignItems: 'center', 
        justifyContent: 'center',
        borderWidth: 1.5, 
        borderColor: '#E2E8F0',
        shadowColor: '#0A1A3A',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.02,
        shadowRadius: 5,
        elevation: 1,
    },
    otpBoxFilled: { borderColor: '#94A3B8' },
    otpBoxFocused: { 
        borderColor: '#059669',
        shadowColor: '#059669',
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 3,
    },
    otpDigit: { fontSize: 22, fontWeight: '800', color: '#0F172A' },

    ctaWrap: {
        borderRadius: 30,
        overflow: 'hidden',
        shadowColor: '#059669',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.28,
        shadowRadius: 20,
        elevation: 8,
        marginBottom: 16,
    },
    cta: {
        height: 58,
        alignItems: 'center',
        justifyContent: 'center',
    },
    ctaText: { fontSize: 17, fontWeight: '900', color: '#fff', letterSpacing: 0.3 },

    resendRow: { flexDirection: 'row', alignItems: 'center', marginTop: 16 },
    resendText: { color: '#64748B', fontSize: 14, fontWeight: '600' },
    timer: { color: '#0F172A', fontWeight: '700', fontSize: 14 },
    resendBtn: { color: '#12B3B6', fontWeight: '800', fontSize: 14 },

    divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 24, gap: 12 },
    dividerLine: { flex: 1, height: 1, backgroundColor: "#CBD5E1" },
    dividerText: { fontSize: 12, fontWeight: "700", color: "#94A3B8" },
    
    googleBtn: { 
        height: 58, 
        backgroundColor: "#FFFFFF", 
        borderRadius: 18, 
        flexDirection: "row", 
        alignItems: "center", 
        justifyContent: "center", 
        borderWidth: 1.5, 
        borderColor: "#E2E8F0",
        shadowColor: '#0A1A3A',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.03,
        shadowRadius: 4,
        elevation: 1,
    },
    googleBtnText: { fontSize: 15, fontWeight: "700", color: "#0F172A" },
    
    // Modal Styles
    modalOverlay: { flex: 1, backgroundColor: 'rgba(13, 46, 77, 0.4)', justifyContent: 'flex-end' },
    modalContent: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 32, paddingBottom: Platform.OS === 'ios' ? 48 : 32, alignItems: 'center' },
    iconContainer: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#FEE2E2', alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
    modalTitle: { fontSize: 24, fontWeight: '800', color: '#0D2E4D', marginBottom: 12, textAlign: 'center' },
    modalDesc: { fontSize: 15, color: '#4A6E8A', textAlign: 'center', lineHeight: 22, marginBottom: 32, paddingHorizontal: 12 },
    restoreBtn: { width: '100%', height: 56, borderRadius: 28, overflow: 'hidden', marginBottom: 16 },
    restoreBtnGradient: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    restoreBtnText: { fontSize: 17, fontWeight: '700', color: '#FFFFFF' },
    cancelBtn: { width: '100%', height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: '#D8EAF5' },
    cancelBtnText: { fontSize: 16, fontWeight: '700', color: '#64748B' },
});
