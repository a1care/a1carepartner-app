import { useState, useEffect, useRef } from "react";
import {
    View, Text, TextInput, TouchableOpacity, StyleSheet,
    ScrollView, KeyboardAvoidingView, Platform, Alert, ActivityIndicator, Image,
    Animated, Modal, Dimensions
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter, useLocalSearchParams } from "expo-router";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { api } from "../../lib/api";
import { useAuthStore, PartnerRole } from "../../stores/auth";
import { Ionicons, FontAwesome5, MaterialCommunityIcons } from "@expo/vector-icons";

const { width } = Dimensions.get("window");

const COMMON_BANKS = [
    "State Bank of India (SBI)", "HDFC Bank", "ICICI Bank", "Axis Bank", 
    "Kotak Mahindra Bank", "Punjab National Bank (PNB)", "Canara Bank", 
    "Bank of Baroda (BoB)", "IDFC First Bank", "IndusInd Bank", 
    "Federal Bank", "YES Bank", "Union Bank of India", "IDBI Bank", "RBL Bank"
].sort();

const SPECIALIZATIONS = [
    "Cardiologist", "General Physician", "Neurologist", "Pediatrician",
    "Dermatologist", "Orthopedic", "Gynecologist", "Psychiatrist",
    "Dentist", "Ophthalmologist", "ENT Specialist", "General Surgeon",
    "Urologist", "Oncologist", "Radiologist", "Gastroenterologist"
].sort();

const GENDERS = ["Male", "Female", "Other"];

const roleConfigs: Record<string, { label: string; fields: string[], docs: string[] }> = {
    doctor: { label: "Doctor", fields: ["name", "email", "gender", "specialization", "experience", "about", "workingHours", "serviceRadius", "homeConsultationFee", "onlineConsultationFee"], docs: ["Selfie", "Aadhar Card", "PAN Card", "Medical Degree Certificate", "MCI/State Registration"] },
    nurse: { label: "Nurse", fields: ["name", "email", "gender", "experience", "about", "workingHours", "serviceRadius", "homeConsultationFee", "onlineConsultationFee"], docs: ["Selfie", "Aadhar Card", "PAN Card", "Nursing Certificate", "Registration Document"] },
    ambulance: { label: "Ambulance", fields: ["name", "email", "gender", "vehicleNumber", "vehicleType", "experience", "serviceRadius"], docs: ["Selfie", "Aadhar Card", "PAN Card", "Vehicle RC", "Commercial DL", "Fitness Certificate"] },
    rental: { label: "Medical Rental", fields: ["name", "email", "gender", "businessName", "gstNumber", "workingHours", "serviceRadius", "about"], docs: ["Selfie", "Aadhar Card", "PAN Card", "Business License", "GST Registration", "Shop Certificate"] },
};

const fieldLabels: Record<string, string> = {
    name: "Full Name", email: "Email Address", gender: "Gender",
    specialization: "Specialization", experience: "Experience (Years)", about: "Bio / About You",
    workingHours: "Working Hours (e.g. 09:00 - 18:00)", serviceRadius: "Service Radius (in km)",
    homeConsultationFee: "Home Consultancy Fee (₹)", onlineConsultationFee: "Online Consultancy Fee (₹)",
    vehicleNumber: "Vehicle Number", vehicleType: "Vehicle Type (BLS/ALS)",
    businessName: "Business Name", gstNumber: "GST Number",
};

const ROLE_IDS: Record<string, string> = {
    doctor: "692c582d17fa4521fcd5a940",
    nurse: "6968b066a32d6eb67e8b7c74",
    ambulance: "699946a786e3fd517d046316",
    rental: "699946a786e3fd517d04631a",
};

export default function RegisterScreen() {
    const router = useRouter();
    const { role: rawRole, token } = useLocalSearchParams<{ role: string, token: string }>();
    const { setAuth, token: storedToken } = useAuthStore();
    const role = (rawRole?.toLowerCase() || "doctor");
    const config = roleConfigs[role] || roleConfigs.doctor;
    const authToken = (token as string) || storedToken;

    const [step, setStep] = useState(1);
    const [form, setForm] = useState<Record<string, any>>({ gender: "Male", specialization: [], bankDetails: { accountHolderName: "", accountNumber: "", ifscCode: "", bankName: "" } });
    const [documents, setDocuments] = useState<{ type: string; url: string; uploading?: boolean }[]>([]);
    const [showSpecDropdown, setShowSpecDropdown] = useState(false);
    const [showGenderDropdown, setShowGenderDropdown] = useState(false);
    const [showBankDropdown, setShowBankDropdown] = useState(false);
    const [bankSearch, setBankSearch] = useState("");
    const [specSearch, setSpecSearch] = useState("");
    const [showThinking, setShowThinking] = useState(false);
    const [showSourceModal, setShowSourceModal] = useState(false);
    const [pickingDocType, setPickingDocType] = useState<string | null>(null);
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

    const filteredBanks = COMMON_BANKS.filter(b => b.toLowerCase().includes(bankSearch.toLowerCase()));

    const handlePickDocument = async (docType: string) => {
        if (docType === "Selfie") {
            setPickingDocType(docType);
            setShowSourceModal(true);
            return;
        }
        try {
            const result = await DocumentPicker.getDocumentAsync({ type: ["image/*", "application/pdf"] });
            if (result.canceled) return;
            const asset = result.assets[0];
            await uploadFile(docType, { uri: asset.uri, name: asset.name, mimeType: asset.mimeType || 'image/jpeg' });
        } catch (err) { console.error(err); }
    };

    const handleLaunchCamera = async () => {
        if (!pickingDocType) return;
        setShowSourceModal(false);
        try {
            const { status } = await ImagePicker.requestCameraPermissionsAsync();
            if (status !== 'granted') return Alert.alert("Permission", "Camera permission is required.");
            const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, quality: 0.6 });
            if (!result.canceled) {
                const asset = result.assets[0];
                await uploadFile(pickingDocType, { uri: asset.uri, name: `selfie_${Date.now()}.jpg`, mimeType: 'image/jpeg' });
            }
        } catch (err) { console.error(err); }
        setPickingDocType(null);
    };

    const handleLaunchGallery = async () => {
        if (!pickingDocType) return;
        setShowSourceModal(false);
        try {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') return Alert.alert("Permission", "Gallery permission is required.");
            const result = await ImagePicker.launchImageLibraryAsync({ allowsEditing: true, quality: 0.6 });
            if (!result.canceled) {
                const asset = result.assets[0];
                await uploadFile(pickingDocType, { uri: asset.uri, name: asset.fileName || `selfie_${Date.now()}.jpg`, mimeType: 'image/jpeg' });
            }
        } catch (err) { console.error(err); }
        setPickingDocType(null);
    };

    const uploadFile = async (docType: string, file: any) => {
        if (!authToken) return Alert.alert("Session Missing");
        try {
            setDocuments(prev => [...prev.filter(d => d.type !== docType), { type: docType, url: "", uploading: true }]);
            const fd = new FormData();
            fd.append('document', { uri: file.uri, name: file.name, type: file.mimeType } as any);
            const res = await api.post("/doctor/auth/upload-document", fd, { headers: { 'Content-Type': 'multipart/form-data', Authorization: `Bearer ${authToken}` } });
            setDocuments(prev => [...prev.filter(d => d.type !== docType), { type: docType, url: res.data.data.url, uploading: false }]);
        } catch (err) { setDocuments(prev => prev.filter(d => d.type !== docType)); }
    };

    const handleRegister = async () => {
        if (!authToken) return router.replace("/(auth)/login");

        const step3Errors: Record<string, string> = {};
        if (!form.bankDetails.accountNumber || form.bankDetails.accountNumber.length < 9) step3Errors.accountNumber = "Enter a valid account number.";
        if (!form.bankDetails.ifscCode || !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(form.bankDetails.ifscCode)) step3Errors.ifscCode = "Enter a valid IFSC code.";
        if (!form.bankDetails.bankName) step3Errors.bankName = "Please select your bank.";
        if (!form.bankDetails.accountHolderName?.trim()) step3Errors.accountHolderName = "Account holder name is required.";
        setFieldErrors(prev => ({ ...prev, ...step3Errors }));
        if (Object.keys(step3Errors).length > 0) return;

        setShowThinking(true);
        try {
            const payload = {
                ...form,
                roleId: ROLE_IDS[role] || ROLE_IDS.doctor,
                documents: documents.map(d => ({ type: d.type, url: d.url })),
                status: "Pending",
                isRegistered: true,
                experience: form.experience ? Number(form.experience) : undefined,
                serviceRadius: form.serviceRadius ? Number(form.serviceRadius) : undefined,
                consultationFee: form.consultationFee ? Number(form.consultationFee) : undefined,
                homeConsultationFee: form.homeConsultationFee ? Number(form.homeConsultationFee) : undefined,
                onlineConsultationFee: form.onlineConsultationFee ? Number(form.onlineConsultationFee) : undefined,
            };
            const res = await api.put("/doctor/auth/register", payload, { headers: { Authorization: `Bearer ${authToken}` } });
            await setAuth(authToken, { ...res.data.data, role: role as PartnerRole });
            router.replace("/(tabs)/home");
        } catch (err: any) { 
            setShowThinking(false); 
            const msg = err?.response?.data?.message || "Registration failed. Please check your details.";
            Alert.alert("Error", msg); 
        }
    };

    const update = (key: string, val: any) => setForm(prev => ({ ...prev, [key]: val }));
    const updateField = (key: string, val: string) => {
        const numericFields = ["experience", "serviceRadius", "consultationFee", "homeConsultationFee", "onlineConsultationFee"];
        const nextValue = numericFields.includes(key) ? val.replace(/\D/g, "") : val;
        update(key, nextValue);
        setFieldErrors(prev => ({ ...prev, [key]: "" }));
    };
    const updateBank = (key: string, val: any) => setForm(prev => ({ ...prev, bankDetails: { ...prev.bankDetails, [key]: val } }));

    const validateStep1 = () => {
        const nextErrors: Record<string, string> = {};
        config.fields.forEach((field) => {
            if (field === "specialization") {
                if (role === "doctor" && (!Array.isArray(form.specialization) || form.specialization.length === 0)) {
                    nextErrors.specialization = "Select at least one specialization.";
                }
                return;
            }

            const value = form[field];
            if (value === undefined || value === null || String(value).trim().length === 0) {
                nextErrors[field] = `${fieldLabels[field] || field} is required.`;
            }
        });
        setFieldErrors(prev => ({ ...prev, ...nextErrors }));
        return Object.keys(nextErrors).length === 0;
    };

    const isStep2Valid = () => config.docs.every(docType => documents.some(d => d.type === docType && d.url));

    return (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
            <LinearGradient colors={["#F8FAFC", "#FFFFFF"]} style={StyleSheet.absoluteFill} />
            <ScrollView contentContainerStyle={styles.scrollContent}>
                <View style={styles.navBar}>
                    <TouchableOpacity onPress={() => step > 1 ? setStep(step - 1) : router.back()} style={styles.backBtn}><Ionicons name="chevron-back" size={24} color="#1E293B" /></TouchableOpacity>
                    <View style={styles.progressContainer}><View style={[styles.progressIndicator, { width: `${(step / 3) * 100}%` }]} /></View>
                    <Text style={styles.stepText}>{step}/3</Text>
                </View>

                {step === 1 && (
                    <View style={styles.stepWrapper}>
                        <Text style={styles.stepTitle}>Let's build your profile</Text>
                        <Text style={styles.stepSub}>Join A1Care as a {config.label}</Text>
                        <View style={styles.formGroup}>
                            {config.fields.map(f => {
                                if (f === "specialization" && role !== "doctor") return null;
                                if (f === "gender") return (
                                    <View key={f} style={styles.fieldItem}>
                                        <Text style={styles.fieldLabel}>Gender Required <Text style={styles.asterisk}>*</Text></Text>
                                        <TouchableOpacity style={[styles.dropdownToggle, fieldErrors.gender && styles.fieldInputError]} onPress={() => setShowGenderDropdown(true)}>
                                            <MaterialCommunityIcons name={form.gender === "Male" ? "gender-male" : "gender-female"} size={20} color="#2D935C" />
                                            <Text style={styles.dropdownValue}>{form.gender}</Text>
                                            <Ionicons name="chevron-down" size={18} color="#94A3B8" />
                                        </TouchableOpacity>
                                        {!!fieldErrors.gender && <Text style={styles.fieldErrorText}>{fieldErrors.gender}</Text>}
                                        <Modal visible={showGenderDropdown} transparent animationType="fade">
                                            <View style={styles.modalOverlay}><TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setShowGenderDropdown(false)} /><View style={styles.modalContentCompact}><Text style={styles.modalTitle}>Select Gender</Text>{GENDERS.map(g => (<TouchableOpacity key={g} style={styles.modalItem} onPress={() => { update("gender", g); setFieldErrors(prev => ({ ...prev, gender: "" })); setShowGenderDropdown(false); }}><Text style={[styles.modalItemText, form.gender === g && styles.modalItemSelected]}>{g}</Text>{form.gender === g && <Ionicons name="checkmark-circle" size={20} color="#2D935C" />}</TouchableOpacity>))}</View></View>
                                        </Modal>
                                    </View>
                                );
                                if (f === "specialization") return (
                                    <View key={f} style={styles.fieldItem}>
                                        <Text style={styles.fieldLabel}>Specializations Required <Text style={styles.asterisk}>*</Text></Text>
                                        <View style={styles.specContainer}>{form.specialization.map((s: string) => (<TouchableOpacity key={s} style={styles.specChip} onPress={() => { update("specialization", form.specialization.filter((x: string) => x !== s)); setFieldErrors(prev => ({ ...prev, specialization: "" })); }}><Text style={styles.specChipText}>{s}</Text><Ionicons name="close-circle" size={14} color="#FFF" /></TouchableOpacity>))}<TouchableOpacity style={[styles.addSpecBtn, fieldErrors.specialization && styles.specAddError]} onPress={() => setShowSpecDropdown(true)}><Ionicons name="add-circle" size={18} color="#2D935C" /><Text style={styles.addSpecText}>Add</Text></TouchableOpacity></View>
                                        {!!fieldErrors.specialization && <Text style={styles.fieldErrorText}>{fieldErrors.specialization}</Text>}
                                        <Modal transparent visible={showSpecDropdown} animationType="slide"><View style={styles.modalOverlay}><TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setShowSpecDropdown(false)} /><View style={styles.modalContentFull}><TextInput style={styles.searchBar} placeholder="Search..." value={specSearch} onChangeText={setSpecSearch} /><ScrollView style={{ maxHeight: 300 }}>{SPECIALIZATIONS.filter(s => s.toLowerCase().includes(specSearch.toLowerCase())).map(s => (<TouchableOpacity key={s} style={styles.modalItem} onPress={() => { if (!form.specialization.includes(s)) update("specialization", [...form.specialization, s]); setFieldErrors(prev => ({ ...prev, specialization: "" })); setShowSpecDropdown(false); }}><Text style={styles.modalItemText}>{s}</Text></TouchableOpacity>))}</ScrollView></View></View></Modal>
                                    </View>
                                );
                                return (
                                    <View key={f} style={styles.fieldItem}>
                                        <Text style={styles.fieldLabel}>{fieldLabels[f]} Required <Text style={styles.asterisk}>*</Text></Text>
                                        <TextInput
                                            style={[styles.fieldInput, f === "about" && styles.fieldArea, fieldErrors[f] && styles.fieldInputError]}
                                            placeholder={fieldLabels[f]}
                                            value={form[f]}
                                            onChangeText={v => updateField(f, v)}
                                            multiline={f === "about"}
                                            keyboardType={["experience", "serviceRadius", "consultationFee", "homeConsultationFee", "onlineConsultationFee"].includes(f) ? "number-pad" : "default"}
                                        />
                                        {!!fieldErrors[f] && <Text style={styles.fieldErrorText}>{fieldErrors[f]}</Text>}
                                    </View>
                                );
                            })}
                        </View>
                        <TouchableOpacity onPress={() => validateStep1() ? setStep(2) : null} style={styles.mainActionBtn}><Text style={styles.mainActionText}>Next: Documents</Text></TouchableOpacity>
                    </View>
                )}

                {step === 2 && (
                    <View style={styles.stepWrapper}>
                        <Text style={styles.stepTitle}>Documents</Text>
                        <View style={styles.docList}>{config.docs.map(doc => { const uploaded = documents.find(d => d.type === doc); return (<TouchableOpacity key={doc} onPress={() => handlePickDocument(doc)} style={[styles.docItem, uploaded && styles.docItemDone]}>
                            <View><Text style={styles.docLabelTitle}>{doc}</Text><Text style={{fontSize:11, color:'#94A3B8'}}>{uploaded ? "Uploaded" : "Tap to upload"}</Text></View>
                            <Ionicons name={uploaded ? "checkmark-circle" : "cloud-upload"} size={24} color={uploaded ? "#2D935C" : "#64748B"} />
                        </TouchableOpacity>); })}</View>
                        <TouchableOpacity onPress={() => isStep2Valid() ? setStep(3) : Alert.alert("Notice", "Upload all documents.")} style={[styles.mainActionBtn, !isStep2Valid() && { opacity: 0.6 }]}><Text style={styles.mainActionText}>Next: Bank Details</Text></TouchableOpacity>
                    </View>
                )}

                {step === 3 && (
                    <View style={styles.stepWrapper}>
                        <Text style={styles.stepTitle}>Settlement Details</Text>
                        <View style={styles.formGroup}>
                            <View style={styles.fieldItem}><Text style={styles.fieldLabel}>Account Number Required <Text style={styles.asterisk}>*</Text></Text><TextInput style={[styles.fieldInput, fieldErrors.accountNumber && styles.fieldInputError]} placeholder="9-18 digit account number" value={form.bankDetails.accountNumber} onChangeText={v => { updateBank("accountNumber", v.replace(/\D/g, "").slice(0, 18)); setFieldErrors(prev => ({ ...prev, accountNumber: "" })); }} keyboardType="number-pad" />{!!fieldErrors.accountNumber && <Text style={styles.fieldErrorText}>{fieldErrors.accountNumber}</Text>}</View>
                            <View style={styles.fieldItem}><Text style={styles.fieldLabel}>IFSC Code Required <Text style={styles.asterisk}>*</Text></Text><TextInput style={[styles.fieldInput, fieldErrors.ifscCode && styles.fieldInputError]} placeholder="e.g. SBIN0001234" value={form.bankDetails.ifscCode} onChangeText={v => { updateBank("ifscCode", v.toUpperCase().slice(0, 11)); setFieldErrors(prev => ({ ...prev, ifscCode: "" })); }} autoCapitalize="characters" />{!!fieldErrors.ifscCode && <Text style={styles.fieldErrorText}>{fieldErrors.ifscCode}</Text>}</View>
                            <View style={styles.fieldItem}>
                                <Text style={styles.fieldLabel}>Bank Name Required <Text style={styles.asterisk}>*</Text></Text>
                                <TouchableOpacity style={[styles.dropdownToggle, fieldErrors.bankName && styles.fieldInputError]} onPress={() => setShowBankDropdown(true)}>
                                    <Text style={[styles.dropdownValue, !form.bankDetails.bankName && { color: "#A0AABB" }]}>{form.bankDetails.bankName || "Select Bank"}</Text>
                                    <Ionicons name="chevron-down" size={18} color="#94A3B8" />
                                </TouchableOpacity>
                                {!!fieldErrors.bankName && <Text style={styles.fieldErrorText}>{fieldErrors.bankName}</Text>}
                                <Modal visible={showBankDropdown} transparent animationType="slide">
                                    <View style={styles.modalOverlay}><TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setShowBankDropdown(false)} />
                                    <View style={styles.modalContentFull}><TextInput style={styles.searchBar} placeholder="Search bank..." value={bankSearch} onChangeText={setBankSearch} /><ScrollView style={{ maxHeight: 300 }}>{filteredBanks.map(b => (<TouchableOpacity key={b} style={styles.modalItem} onPress={() => { updateBank("bankName", b); setFieldErrors(prev => ({ ...prev, bankName: "" })); setShowBankDropdown(false); }}><Text style={styles.modalItemText}>{b}</Text></TouchableOpacity>))}</ScrollView></View></View>
                                </Modal>
                            </View>
                            <View style={styles.fieldItem}><Text style={styles.fieldLabel}>Account Holder Name Required <Text style={styles.asterisk}>*</Text></Text><TextInput style={[styles.fieldInput, fieldErrors.accountHolderName && styles.fieldInputError]} placeholder="As per bank records" value={form.bankDetails.accountHolderName} onChangeText={v => { updateBank("accountHolderName", v.replace(/[^a-zA-Z\s]/g, "")); setFieldErrors(prev => ({ ...prev, accountHolderName: "" })); }} />{!!fieldErrors.accountHolderName && <Text style={styles.fieldErrorText}>{fieldErrors.accountHolderName}</Text>}</View>
                        </View>
                        <TouchableOpacity onPress={handleRegister} style={styles.mainActionBtn}>{showThinking ? <ActivityIndicator color="#FFF" /> : <Text style={styles.mainActionText}>Confirm & Finish</Text>}</TouchableOpacity>
                    </View>
                )}
            </ScrollView>

            {/* Image Source Selection Modal */}
            <Modal visible={showSourceModal} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setShowSourceModal(false)} />
                    <View style={styles.modalContentCompact}>
                        <Text style={styles.modalTitle}>Choose {pickingDocType} Source</Text>
                        <View style={styles.sourceRow}>
                            <TouchableOpacity style={styles.sourceBtn} onPress={handleLaunchCamera}>
                                <View style={[styles.sourceIconBox, { backgroundColor: '#ECFDF5' }]}><Ionicons name="camera" size={28} color="#2D935C" /></View>
                                <Text style={styles.sourceText}>Camera</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.sourceBtn} onPress={handleLaunchGallery}>
                                <View style={[styles.sourceIconBox, { backgroundColor: '#F0F9FF' }]}><Ionicons name="images" size={28} color="#1A7FD4" /></View>
                                <Text style={styles.sourceText}>Gallery</Text>
                            </TouchableOpacity>
                        </View>
                        <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowSourceModal(false)}>
                            <Text style={styles.cancelBtnText}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    scrollContent: { padding: 24, paddingTop: 60, paddingBottom: 100 },
    navBar: { flexDirection: 'row', alignItems: 'center', marginBottom: 25, gap: 12 },
    backBtn: { width: 42, height: 42, borderRadius: 12, backgroundColor: '#FFF', justifyContent: 'center', alignItems: 'center', elevation: 2 },
    progressContainer: { flex: 1, height: 6, backgroundColor: '#E2E8F0', borderRadius: 3, overflow: 'hidden' },
    progressIndicator: { height: '100%', backgroundColor: '#2D935C' },
    stepText: { fontSize: 13, fontWeight: '800', color: '#64748B' },
    stepWrapper: { flex: 1 },
    stepTitle: { fontSize: 26, fontWeight: '900', color: '#1E293B' },
    stepSub: { fontSize: 13, color: '#64748B', marginBottom: 25 },
    formGroup: { gap: 16 },
    fieldItem: { gap: 8 },
    fieldLabel: { fontSize: 13, fontWeight: '800', color: '#1E293B', marginLeft: 2 },
    asterisk: { color: "#EF4444" },
    fieldInput: { height: 56, backgroundColor: '#FFF', borderRadius: 16, paddingHorizontal: 16, fontSize: 15, color: '#1E293B', borderWidth: 1.5, borderColor: '#F1F5F9' },
    fieldInputError: { borderColor: '#EF4444' },
    fieldErrorText: { color: '#DC2626', fontSize: 12, fontWeight: '600', marginLeft: 4 },
    fieldArea: { height: 100, textAlignVertical: 'top' },
    dropdownToggle: { height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#FFF', borderRadius: 16, paddingHorizontal: 16, borderWidth: 1.5, borderColor: '#F1F5F9' },
    dropdownValue: { fontSize: 15, fontWeight: '600', color: '#1E293B' },
    specContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    specChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#2D935C', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 10, gap: 4 },
    specChipText: { color: '#FFF', fontSize: 12, fontWeight: '700' },
    addSpecBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', paddingVertical: 6, paddingHorizontal: 10, borderRadius: 10, borderWidth: 1.5, borderColor: '#2D935C', borderStyle: 'dashed', gap: 4 },
    specAddError: { borderColor: '#EF4444' },
    addSpecText: { color: '#2D935C', fontSize: 12, fontWeight: '700' },
    mainActionBtn: { height: 58, backgroundColor: '#2D935C', borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginTop: 30, elevation: 4 },
    mainActionText: { color: '#FFF', fontSize: 16, fontWeight: '800' },
    docList: { gap: 12 },
    docItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#FFF', padding: 20, borderRadius: 16, borderWidth: 1.5, borderColor: '#F1F5F9' },
    docItemDone: { borderColor: '#2D935C', backgroundColor: '#F0FDF4' },
    docLabelTitle: { fontSize: 15, fontWeight: '700', color: '#1E293B' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalContentCompact: { backgroundColor: '#FFF', borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 24, paddingBottom: 40 },
    modalContentFull: { backgroundColor: '#FFF', borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 24, paddingBottom: 40, maxHeight: '80%' },
    modalTitle: { fontSize: 18, fontWeight: '900', color: '#1E293B', marginBottom: 20 },
    modalItem: { padding: 18, flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#F8FAFC' },
    modalItemText: { fontSize: 15, color: '#475569', fontWeight: '600' },
    modalItemSelected: { color: '#2D935C', fontWeight: '800' },
    searchBar: { height: 50, backgroundColor: '#F8FAFC', borderRadius: 12, paddingHorizontal: 15, marginBottom: 15, borderWidth: 1, borderColor: '#E2E8F0' },
    sourceRow: { flexDirection: 'row', justifyContent: 'space-around', marginVertical: 20 },
    sourceBtn: { alignItems: 'center', gap: 10 },
    sourceIconBox: { width: 64, height: 64, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
    sourceText: { fontSize: 14, fontWeight: '700', color: '#1E293B' },
    cancelBtn: { marginTop: 10, paddingVertical: 15, alignItems: 'center' },
    cancelBtnText: { fontSize: 16, color: '#EF4444', fontWeight: '700' },
});
