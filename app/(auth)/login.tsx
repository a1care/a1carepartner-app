import React, { useState } from 'react';
import {
    View, Text, TextInput, TouchableOpacity, StyleSheet,
    ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator, Alert, NativeModules
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Toast } from "../../components/CustomToast";
import { api } from "../../lib/api";
import { useAuthStore, PartnerRole } from "../../stores/auth";
import { Ionicons } from "@expo/vector-icons";

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
    const { role } = useLocalSearchParams<{ role: string }>();
    const { setAuth } = useAuthStore();
    const [mobile, setMobile] = useState("");
    const [otp, setOtp] = useState("");
    const [otpSessionId, setOtpSessionId] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [googleLoading, setGoogleLoading] = useState(false);
    const [verifying, setVerifying] = useState(false);

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

            const res = await api.post("/doctor/auth/verify-otp", payload);
            const authToken = res.data?.data?.token;

            if (!authToken) throw new Error("No auth token received");

            // Partner verify-otp currently returns only the JWT token.
            // Fetch the actual partner profile separately for routing decisions.
            const detailsRes = await api.get("/doctor/auth/details", {
                headers: { Authorization: `Bearer ${authToken}` }
            });
            const userData = detailsRes.data?.data;

            if (!userData) {
                throw new Error("Unable to load partner profile after login");
            }

            // Update Auth Store (this will trigger AuthGuard in layout)
            await setAuth(authToken, {
                ...userData,
                role: role as PartnerRole
            });

            Toast.show({ type: 'success', text1: 'Login Successful' });

            // Precise navigation if AuthGuard hasn't kicked in yet
            if (userData.isRegistered === false) {
                router.replace({
                    pathname: "/(auth)/register",
                    params: { role: role ?? "doctor", token: authToken }
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

        setLoading(true);
        try {
            await api.post("/doctor/auth/send-otp", { mobileNumber: cleaned });
            setOtpSessionId("ACTIVE");
            Toast.show({ type: 'success', text1: 'OTP Sent' });
        } catch (err: any) {
            Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to send OTP.' });
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyOtp = async () => {
        if (otp.length < 6) return Toast.show({ type: 'error', text1: 'Invalid OTP' });
        const cleaned = mobile.replace(/\D/g, '').slice(-10);
        await finishLogin(undefined, `+91${cleaned}`, otp);
    };

    return (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
            <LinearGradient colors={["#C8E6F9", "#EBF5FB", "#FFFFFF"]} style={StyleSheet.absoluteFill} />

            <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: 28 }}>
                <TouchableOpacity onPress={() => router.back()} style={{ marginBottom: 20 }}>
                    <Text style={styles.back}>← Back</Text>
                </TouchableOpacity>

                <Text style={styles.logo}>
                    <Text style={{ color: "#1A7FD4" }}>A1</Text>
                    <Text style={{ color: "#27AE60" }}>Care</Text>
                    <Text style={{ color: "#1A7FD4" }}> 24/7</Text>
                </Text>

                <Text style={styles.heading}>Welcome Back</Text>
                <Text style={styles.sub}>Sign in as a {roleLabels[role ?? ""] ?? "Partner"}</Text>

                <View style={styles.form}>
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Mobile Number</Text>
                        <View style={styles.inputWrapper}>
                            <Text style={styles.prefix}>+91</Text>
                            <TextInput
                                style={styles.flexInput}
                                placeholder="98765 43210"
                                keyboardType="phone-pad"
                                value={mobile}
                                onChangeText={(text) => setMobile(text.replace(/\D/g, ''))}
                                maxLength={10}
                                placeholderTextColor="#9CB3C4"
                                editable={!otpSessionId}
                            />
                        </View>
                    </View>

                    {otpSessionId && (
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Enter OTP</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="0 0 0 0 0 0"
                                keyboardType="number-pad"
                                value={otp}
                                onChangeText={setOtp}
                                maxLength={6}
                                placeholderTextColor="#9CB3C4"
                                autoFocus
                            />
                        </View>
                    )}

                    {!otpSessionId ? (
                        <TouchableOpacity onPress={handleSendOtp} disabled={loading} activeOpacity={0.85}>
                            <LinearGradient colors={["#1A7FD4", "#0D5FA0"]} style={styles.cta}>
                                {loading ? <ActivityIndicator color={"#fff"} /> : <Text style={styles.ctaText}>Send OTP</Text>}
                            </LinearGradient>
                        </TouchableOpacity>
                    ) : (
                        <TouchableOpacity onPress={handleVerifyOtp} disabled={verifying} activeOpacity={0.85}>
                            <LinearGradient colors={["#27AE60", "#1E8449"]} style={styles.cta}>
                                {verifying ? <ActivityIndicator color={"#fff"} /> : <Text style={styles.ctaText}>Verify & Login</Text>}
                            </LinearGradient>
                        </TouchableOpacity>
                    )}

                    {/* Google Sign-in hidden for now */}
                    {/* {!otpSessionId && (
                        <>
                            <View style={styles.divider}>
                                <View style={styles.dividerLine} /><Text style={styles.dividerText}>OR</Text><View style={styles.dividerLine} />
                            </View>

                            <TouchableOpacity style={styles.googleBtn} onPress={handleGoogleSignIn} disabled={googleLoading}>
                                {googleLoading ? <ActivityIndicator color="#1A7FD4" /> : (
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                                        <Ionicons name="logo-google" size={20} color="#EA4335" />
                                        <Text style={styles.googleBtnText}>Continue with Google</Text>
                                    </View>
                                )}
                            </TouchableOpacity>
                        </>
                    )} */}
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
};

export default LoginScreen;

const styles = StyleSheet.create({
    back: { fontSize: 16, color: "#1A7FD4", fontWeight: "600" },
    logo: { fontSize: 26, fontWeight: "900", textAlign: "center", marginBottom: 8 },
    heading: { fontSize: 26, fontWeight: "800", color: "#0D2E4D", textAlign: "center" },
    sub: { fontSize: 14, color: "#4A6E8A", textAlign: "center", marginTop: 6, marginBottom: 28 },
    form: { gap: 16 },
    inputGroup: { gap: 8 },
    label: { fontSize: 13, fontWeight: "700", color: "#0D2E4D", marginLeft: 4 },
    inputWrapper: {
        flexDirection: "row", alignItems: "center", height: 52, backgroundColor: "#FFFFFF", borderRadius: 16,
        paddingHorizontal: 18, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
        borderWidth: 1.5, borderColor: "#D8EAF5",
    },
    prefix: { fontSize: 15, color: "#4A6E8A", fontWeight: "600", marginRight: 8 },
    flexInput: { flex: 1, fontSize: 15, color: "#0D2E4D" },
    input: {
        height: 52, backgroundColor: "#FFFFFF", borderRadius: 16, paddingHorizontal: 18, fontSize: 15, color: "#0D2E4D",
        shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 8, elevation: 2, borderWidth: 1.5, borderColor: "#D8EAF5",
        textAlign: "center", letterSpacing: 8, fontWeight: "700"
    },
    cta: { height: 58, borderRadius: 29, alignItems: "center", justifyContent: "center", marginTop: 8 },
    ctaText: { fontSize: 17, fontWeight: "800", color: "#fff" },
    divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 20, gap: 12 },
    dividerLine: { flex: 1, height: 1.5, backgroundColor: "#D8EAF5" },
    dividerText: { fontSize: 12, fontWeight: "700", color: "#9CB3C4" },
    googleBtn: { height: 56, backgroundColor: "#FFFFFF", borderRadius: 28, flexDirection: "row", alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: "#D8EAF5" },
    googleBtnText: { fontSize: 15, fontWeight: "700", color: "#0D2E4D" },
});
