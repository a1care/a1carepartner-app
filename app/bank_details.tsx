import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    TextInput, ActivityIndicator, KeyboardAvoidingView, Platform, Modal, Dimensions, BackHandler
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { LinearGradient } from "expo-linear-gradient";
import { Toast } from "../components/CustomToast";

const { height } = Dimensions.get("window");

const COMMON_BANKS = [
    "State Bank of India (SBI)", "HDFC Bank", "ICICI Bank", "Axis Bank", 
    "Kotak Mahindra Bank", "Punjab National Bank (PNB)", "Canara Bank", 
    "Bank of Baroda (BoB)", "IDFC First Bank", "IndusInd Bank", 
    "Federal Bank", "YES Bank", "Union Bank of India", "IDBI Bank", "RBL Bank"
].sort();

const INITIAL_FORM = {
    accountHolderName: "",
    accountNumber: "",
    ifscCode: "",
    bankName: "",
    upiId: "",
};

export default function BankDetailsScreen() {
    const router = useRouter();
    const queryClient = useQueryClient();
    const [form, setForm] = useState(INITIAL_FORM);
    const [showBankDropdown, setShowBankDropdown] = useState(false);
    const [bankSearch, setBankSearch] = useState("");

    useEffect(() => {
        const backAction = () => {
            router.navigate("/(tabs)/profile" as any);
            return true;
        };
        const backHandler = BackHandler.addEventListener("hardwareBackPress", backAction);
        return () => backHandler.remove();
    }, []);

    const filteredBanks = COMMON_BANKS.filter(b => b.toLowerCase().includes(bankSearch.toLowerCase()));

    const { isLoading } = useQuery({
        queryKey: ["bankStaffDetails"],
        queryFn: async () => {
            const res = await api.get("/doctor/auth/details");
            const data = res.data.data;
            if (data?.bankDetails) setForm(data.bankDetails);
            return data;
        },
    });

    const updateMutation = useMutation({
        mutationFn: async (updatedForm: typeof form) => {
            return await api.put("/doctor/auth/register", { bankDetails: updatedForm });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["bankStaffDetails"] });
            Toast.show({ type: "success", text1: "Details Saved!" });
            router.back();
        },
    });

    const handleSave = () => {
        const { accountHolderName, accountNumber, ifscCode, bankName } = form;
        if (!accountHolderName || !accountNumber || !ifscCode || !bankName) return Toast.show({ type: "error", text1: "Missing Fields" });
        
        if (accountNumber.length < 9 || accountNumber.length > 18) return Toast.show({ type: "error", text1: "Invalid Account", text2: "Must be 9-18 digits" });
        if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifscCode)) return Toast.show({ type: "error", text1: "Invalid IFSC Format" });

        updateMutation.mutate(form);
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.navigate("/(tabs)/profile" as any)} style={styles.backBtn}><Ionicons name="arrow-back" size={22} color="#1E293B" /></TouchableOpacity>
                <View><Text style={styles.headerTitle}>Settlement Details</Text><Text style={styles.headerSub}>Bank account for receiving payments</Text></View>
                <View style={{ width: 40 }} />
            </View>

            <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
                <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                    <LinearGradient colors={["#1B6B3A", "#2D935C"]} style={styles.bankCard} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                        <View style={styles.bankCardDeco1} /><View style={styles.bankCardDeco2} />
                        <View style={styles.bankCardRow}><View style={styles.bankChip} /><Ionicons name="wifi" size={20} color="rgba(255,255,255,0.5)" style={{ transform: [{ rotate: '90deg' }] }} /></View>
                        <Text style={styles.bankCardNumber}>{form.accountNumber ? form.accountNumber.replace(/(\d{4})(?=\d)/g, "$1 ") : "•••• •••• •••• ••••"}</Text>
                        <View style={styles.bankCardFooter}>
                            <View><Text style={styles.bankCardFieldLabel}>ACCOUNT HOLDER</Text><Text style={styles.bankCardFieldValue}>{form.accountHolderName || "Your Name"}</Text></View>
                            <View style={{ alignItems: "flex-end" }}><Text style={styles.bankCardFieldLabel}>IFSC CODE</Text><Text style={styles.bankCardFieldValue}>{form.ifscCode || "SBIN000XXXX"}</Text></View>
                        </View>
                    </LinearGradient>

                    {isLoading ? <ActivityIndicator size="large" color="#2D935C" /> : (
                        <View style={styles.form}>
                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Account Holder Name</Text>
                                <TextInput style={styles.input} value={form.accountHolderName} onChangeText={(v) => setForm({ ...form, accountHolderName: v.replace(/[^a-zA-Z\s]/g, "") })} placeholder="As per bank records" />
                            </View>

                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Bank Name</Text>
                                <TouchableOpacity style={styles.dropdownToggle} onPress={() => setShowBankDropdown(true)}>
                                    <Text style={[styles.dropdownValue, !form.bankName && { color: "#A0AABB" }]}>{form.bankName || "Select your bank"}</Text>
                                    <Ionicons name="chevron-down" size={18} color="#94A3B8" />
                                </TouchableOpacity>
                            </View>

                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Account Number</Text>
                                <TextInput style={styles.input} value={form.accountNumber} onChangeText={(v) => setForm({ ...form, accountNumber: v.replace(/\D/g, "").slice(0, 18) })} placeholder="9-18 digit account number" keyboardType="number-pad" />
                            </View>

                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>IFSC Code</Text>
                                <TextInput style={styles.input} value={form.ifscCode} onChangeText={(v) => setForm({ ...form, ifscCode: v.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 11) })} placeholder="e.g. SBIN0001234" autoCapitalize="characters" />
                            </View>

                            <TouchableOpacity style={[styles.saveBtn, updateMutation.isPending && { opacity: 0.6 }]} onPress={handleSave} disabled={updateMutation.isPending}>
                                <LinearGradient colors={["#2D935C", "#1B6B3A"]} style={styles.saveBtnGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                                    {updateMutation.isPending ? <ActivityIndicator color="#FFF" /> : <Text style={styles.saveBtnText}>Save Bank Account</Text>}
                                </LinearGradient>
                            </TouchableOpacity>
                        </View>
                    )}
                </ScrollView>

                <Modal visible={showBankDropdown} transparent animationType="slide">
                    <View style={styles.modalOverlay}>
                        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setShowBankDropdown(false)} />
                        <View style={styles.modalContent}>
                            <View style={styles.modalHeader}><Text style={styles.modalTitle}>Select Bank</Text><TouchableOpacity onPress={() => setShowBankDropdown(false)}><Ionicons name="close" size={24} color="#64748B" /></TouchableOpacity></View>
                            <TextInput style={styles.searchBar} placeholder="Search bank..." value={bankSearch} onChangeText={setBankSearch} />
                            <ScrollView style={{ maxHeight: 400 }}>
                                {filteredBanks.map(b => (
                                    <TouchableOpacity key={b} style={styles.modalItem} onPress={() => { setForm({ ...form, bankName: b }); setShowBankDropdown(false); }}>
                                        <Text style={[styles.modalItemText, form.bankName === b && styles.modalItemTextActive]}>{b}</Text>
                                        {form.bankName === b && <Ionicons name="checkmark-circle" size={20} color="#2D935C" />}
                                    </TouchableOpacity>
                                ))}
                                {bankSearch.trim() && !COMMON_BANKS.some(b => b.toLowerCase() === bankSearch.toLowerCase()) && (
                                    <TouchableOpacity style={styles.customAddBtn} onPress={() => { setForm({ ...form, bankName: bankSearch }); setShowBankDropdown(false); }}>
                                        <Text style={{ color: '#2D935C', fontWeight: '700' }}>Add "{bankSearch}" as bank</Text>
                                    </TouchableOpacity>
                                )}
                            </ScrollView>
                        </View>
                    </View>
                </Modal>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#F8FAFC" },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 14, backgroundColor: "#FFF", borderBottomWidth: 1, borderBottomColor: "#F1F5F9" },
    backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: "#F1F5F9", alignItems: "center", justifyContent: "center" },
    headerTitle: { fontSize: 17, fontWeight: "900", color: "#1E293B" },
    headerSub: { fontSize: 11, color: "#94A3B8", marginTop: 2 },
    scrollContent: { padding: 20, paddingBottom: 60 },
    bankCard: { borderRadius: 24, padding: 24, marginBottom: 25, minHeight: 180, overflow: "hidden", elevation: 8 },
    bankCardDeco1: { position: "absolute", width: 200, height: 200, borderRadius: 100, backgroundColor: "rgba(255,255,255,0.05)", top: -60, right: -60 },
    bankCardDeco2: { position: "absolute", width: 150, height: 150, borderRadius: 75, backgroundColor: "rgba(255,255,255,0.05)", bottom: -40, left: -20 },
    bankCardRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 20 },
    bankChip: { width: 40, height: 28, backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 6 },
    bankCardNumber: { fontSize: 19, fontWeight: "800", color: "#FFF", letterSpacing: 2, marginBottom: 20 },
    bankCardFooter: { flexDirection: "row", justifyContent: "space-between" },
    bankCardFieldLabel: { fontSize: 9, color: "rgba(255,255,255,0.6)", fontWeight: "700", marginBottom: 4 },
    bankCardFieldValue: { fontSize: 14, color: "#FFF", fontWeight: "700" },
    form: { gap: 20 },
    inputGroup: { gap: 8 },
    label: { fontSize: 13, fontWeight: "800", color: "#334155", marginLeft: 2 },
    input: { height: 56, backgroundColor: "#FFF", borderRadius: 16, paddingHorizontal: 18, fontSize: 15, color: "#1E293B", borderWidth: 1.5, borderColor: "#F1F5F9" },
    dropdownToggle: { height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#FFF', borderRadius: 16, paddingHorizontal: 18, borderWidth: 1.5, borderColor: '#F1F5F9' },
    dropdownValue: { fontSize: 15, fontWeight: '600', color: '#1E293B' },
    saveBtn: { borderRadius: 20, overflow: "hidden", marginTop: 10 },
    saveBtnGradient: { height: 60, alignItems: "center", justifyContent: "center" },
    saveBtnText: { color: "#FFF", fontSize: 17, fontWeight: "800" },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalContent: { backgroundColor: '#FFF', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, paddingBottom: 40 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    modalTitle: { fontSize: 18, fontWeight: '900', color: '#1E293B' },
    searchBar: { height: 50, backgroundColor: '#F8FAFC', borderRadius: 12, paddingHorizontal: 15, marginBottom: 15, borderWidth: 1, borderColor: '#E2E8F0' },
    modalItem: { padding: 18, flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#F8FAFC' },
    modalItemText: { fontSize: 15, color: '#475569', fontWeight: '600' },
    modalItemTextActive: { color: '#2D935C', fontWeight: '800' },
    customAddBtn: { padding: 18, alignItems: 'center', backgroundColor: '#F0FDF4', borderRadius: 12, marginTop: 10 }
});
