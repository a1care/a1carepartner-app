import { useState, useEffect, useRef } from "react";
import { Toast } from "../../components/CustomToast";
import {
    View, Text, TextInput, TouchableOpacity, StyleSheet,
    ScrollView, KeyboardAvoidingView, Platform, Alert, ActivityIndicator, Image,
    Animated, Modal, Dimensions, Keyboard
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter, useLocalSearchParams } from "expo-router";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { api } from "../../lib/api";
import { useAuthStore, PartnerRole } from "../../stores/auth";
import { missingRequiredDocuments, PARTNER_ROLE_IDS, REQUIRED_DOCUMENTS } from "../../lib/partnerOnboarding";
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
const WORKING_HOUR_OPTIONS = [
    "06:00 - 12:00",
    "08:00 - 14:00",
    "09:00 - 18:00",
    "10:00 - 19:00",
    "12:00 - 20:00",
    "18:00 - 06:00",
    "24 Hours",
];

const roleConfigs: Record<string, { label: string; fields: string[], docs: string[] }> = {
    doctor: { label: "Doctor", fields: ["name", "email", "gender", "specialization", "experience", "about", "workingHours", "serviceRadius", "homeConsultationFee", "onlineConsultationFee"], docs: REQUIRED_DOCUMENTS.doctor },
    nurse: { label: "Nurse", fields: ["name", "email", "gender", "experience", "about", "workingHours", "serviceRadius", "homeConsultationFee", "onlineConsultationFee"], docs: REQUIRED_DOCUMENTS.nurse },
    ambulance: { label: "Ambulance", fields: ["name", "email", "gender", "vehicleNumber", "vehicleType", "experience", "serviceRadius"], docs: REQUIRED_DOCUMENTS.ambulance },
    rental: { label: "Medical Rental", fields: ["name", "email", "gender", "businessName", "gstNumber", "workingHours", "serviceRadius", "about"], docs: REQUIRED_DOCUMENTS.rental },
};

const fieldLabels: Record<string, string> = {
    name: "Full Name", email: "Email Address", gender: "Gender",
    specialization: "Specialization", experience: "Experience (Years)", about: "Bio / About You",
    workingHours: "Working Hours (e.g. 09:00 - 18:00)", serviceRadius: "Service Radius (in km)",
    homeConsultationFee: "Home Consultancy Fee (₹)", onlineConsultationFee: "Online Consultancy Fee (₹)",
    vehicleNumber: "Vehicle Number", vehicleType: "Vehicle Type (BLS/ALS)",
    businessName: "Business Name", gstNumber: "GST Number",
};

export default function RegisterScreen() {
    const router = useRouter();
    const { role: rawRole, token, specialization } = useLocalSearchParams<{ role: string, token: string, specialization?: string }>();
    const { setAuth, token: storedToken, user } = useAuthStore();
    const scrollRef = useRef<ScrollView>(null);
    const fieldOffsets = useRef<Record<string, number>>({});
    const role = (rawRole?.toLowerCase() || "doctor");
    const config = roleConfigs[role] || roleConfigs.doctor;
    const roleApiPrefix = role.includes('nurse') ? 'nurse' : role.includes('ambulance') ? 'ambulance' : role.includes('rental') ? 'rental' : 'doctor';
    const authToken = (token as string) || storedToken;

    const [step, setStep] = useState(1);
    const [form, setForm] = useState<Record<string, any>>({ 
        gender: "Male", 
        specialization: specialization ? [specialization] : [], 
        bankDetails: { accountHolderName: "", accountNumber: "", ifscCode: "", bankName: "" }, 
        referredByCode: "" 
    });
    const [documents, setDocuments] = useState<{ type: string; url: string; uploading?: boolean }[]>([]);
    const [showSpecDropdown, setShowSpecDropdown] = useState(false);
    const [showGenderDropdown, setShowGenderDropdown] = useState(false);
    const [showWorkingHoursDropdown, setShowWorkingHoursDropdown] = useState(false);
    const [showBankDropdown, setShowBankDropdown] = useState(false);
    const [bankSearch, setBankSearch] = useState("");
    const [specSearch, setSpecSearch] = useState("");
    const [showThinking, setShowThinking] = useState(false);
    const [showSourceModal, setShowSourceModal] = useState(false);
    const [pickingDocType, setPickingDocType] = useState<string | null>(null);
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
    const [keyboardHeight, setKeyboardHeight] = useState(0);

    const filteredBanks = COMMON_BANKS.filter(b => b.toLowerCase().includes(bankSearch.toLowerCase()));

    useEffect(() => {
        const showSub = Keyboard.addListener("keyboardDidShow", (event) => {
            setKeyboardHeight(event.endCoordinates.height);
        });
        const hideSub = Keyboard.addListener("keyboardDidHide", () => {
            setKeyboardHeight(0);
        });

        return () => {
            showSub.remove();
            hideSub.remove();
        };
    }, []);

    useEffect(() => {
        const hydrateExistingProfile = async () => {
            if (!authToken) return;
            try {
                const res = await api.get(`/${roleApiPrefix}/auth/details`, { headers: { Authorization: `Bearer ${authToken}` } });
                const staff = res.data?.data;
                if (!staff) return;

                const startExperience = staff.startExperience ? new Date(staff.startExperience) : null;
                const experience = startExperience && !Number.isNaN(startExperience.getTime())
                    ? String(Math.max(0, new Date().getFullYear() - startExperience.getFullYear()))
                    : "";

                setForm(prev => ({
                    ...prev,
                    name: staff.name || prev.name,
                    email: staff.email || prev.email,
                    gender: staff.gender || prev.gender || "Male",
                    specialization: Array.isArray(staff.specialization) ? staff.specialization : prev.specialization,
                    experience: experience || prev.experience,
                    about: staff.about || prev.about,
                    workingHours: staff.workingHours || prev.workingHours,
                    serviceRadius: staff.serviceRadius !== undefined ? String(staff.serviceRadius) : prev.serviceRadius,
                    homeConsultationFee: staff.homeConsultationFee !== undefined ? String(staff.homeConsultationFee) : prev.homeConsultationFee,
                    onlineConsultationFee: staff.onlineConsultationFee !== undefined ? String(staff.onlineConsultationFee) : prev.onlineConsultationFee,
                    bankDetails: {
                        accountHolderName: staff.bankDetails?.accountHolderName || prev.bankDetails.accountHolderName,
                        accountNumber: staff.bankDetails?.accountNumber || prev.bankDetails.accountNumber,
                        ifscCode: staff.bankDetails?.ifscCode || prev.bankDetails.ifscCode,
                        bankName: staff.bankDetails?.bankName || prev.bankDetails.bankName,
                    }
                }));

                setDocuments(Array.isArray(staff.documents) ? staff.documents : []);

                if (staff.isRegistered && missingRequiredDocuments(staff, role).length > 0) {
                    setStep(2);
                }
            } catch (err) {
                console.log("[Register] Could not hydrate existing profile", err);
            }
        };

        hydrateExistingProfile();
    }, [authToken, role]);

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
            
            if (pickingDocType === 'Selfie') {
                Alert.alert(
                    "Profile Photo Guidelines", 
                    "For the best professional profile, please ensure your face is well-lit and centered in the square.",
                    [{
                        text: "Take Photo",
                        onPress: async () => {
                            const result = await ImagePicker.launchCameraAsync({ 
                                allowsEditing: true, 
                                quality: 0.6,
                                aspect: [1, 1] // Forces a square crop for selfies
                            });
                            if (!result.canceled) {
                                const asset = result.assets[0];
                                await uploadFile(pickingDocType, { uri: asset.uri, name: `selfie_${Date.now()}.jpg`, mimeType: 'image/jpeg' });
                            }
                            setPickingDocType(null);
                        }
                    }]
                );
                return; // Early return because the camera launches in the callback
            }

            // Normal flow for non-selfies
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
            
            const pickerOptions: ImagePicker.ImagePickerOptions = { 
                allowsEditing: true, 
                quality: 0.6,
                aspect: pickingDocType === 'Selfie' ? [1, 1] : undefined
            };

            const result = await ImagePicker.launchImageLibraryAsync(pickerOptions);
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
            
            // Ensure filename has a valid extension for the backend's strict checking
            let filename = file.name || `upload_${Date.now()}`;
            if (!filename.includes('.')) {
                if (file.mimeType?.includes('png')) filename += '.png';
                else if (file.mimeType?.includes('pdf')) filename += '.pdf';
                else if (file.mimeType?.includes('webp')) filename += '.webp';
                else filename += '.jpg'; // Default to jpg for images
            }
            
            if (Platform.OS === 'web') {
                const fetchRes = await fetch(file.uri);
                const blob = await fetchRes.blob();
                fd.append('document', blob, filename);
            } else {
                fd.append('document', { uri: file.uri, name: filename, type: file.mimeType } as any);
            }
            
            const res = await api.post(`/${roleApiPrefix}/auth/upload-document`, fd, { headers: { 'Content-Type': 'multipart/form-data', Authorization: `Bearer ${authToken}` } });
            setDocuments(prev => [...prev.filter(d => d.type !== docType), { type: docType, url: res.data.data.url, uploading: false }]);
        } catch (err: any) {
            setDocuments(prev => prev.filter(d => d.type !== docType));
            const msg = err?.response?.data?.message || err?.message || 'Upload failed. Please try again.';
            Toast.show({ type: 'error', text1: 'Upload Failed', text2: msg });
        }
    };

    const handleRegister = async () => {
        if (!authToken) return router.replace("/(auth)/login");
        if (!isStep2Valid()) return Alert.alert("Notice", "Upload all documents.");

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
                roleId: PARTNER_ROLE_IDS[role as keyof typeof PARTNER_ROLE_IDS] || PARTNER_ROLE_IDS.doctor,
                documents: documents.map(d => ({ type: d.type, url: d.url })),
                profileImage: documents.find(d => d.type === 'Selfie' || d.type === 'Profile Photo')?.url || undefined,
                status: "Pending",
                isRegistered: true,
                experience: form.experience ? Number(form.experience) : undefined,
                serviceRadius: form.serviceRadius ? Number(form.serviceRadius) : undefined,
                consultationFee: form.consultationFee ? Number(form.consultationFee) : undefined,
                homeConsultationFee: form.homeConsultationFee ? Number(form.homeConsultationFee) : undefined,
                onlineConsultationFee: form.onlineConsultationFee ? Number(form.onlineConsultationFee) : undefined,
            };
            const res = await api.put(`/${roleApiPrefix}/auth/register`, payload, { headers: { Authorization: `Bearer ${authToken}` } });
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
    const rememberFieldOffset = (key: string, y: number) => {
        fieldOffsets.current[key] = y;
    };
    const scrollToField = (key: string) => {
        setTimeout(() => {
            const y = fieldOffsets.current[key] ?? 0;
            scrollRef.current?.scrollTo({ y: Math.max(0, y - 80), animated: true });
        }, 120);
    };

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
                return;
            }

            if (field === "name") {
                if (/^\d+$/.test(String(value).trim())) {
                    nextErrors[field] = "Full name cannot be numbers only.";
                }
                return;
            }

            if (field === "email") {
                if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value).trim())) {
                    nextErrors[field] = "Enter a valid email address.";
                }
                return;
            }

            if (["serviceRadius", "homeConsultationFee", "onlineConsultationFee"].includes(field)) {
                if (Number(value) <= 0) {
                    nextErrors[field] = `${fieldLabels[field]} must be greater than 0.`;
                }
                return;
            }
        });
        setFieldErrors(prev => ({ ...prev, ...nextErrors }));
        return Object.keys(nextErrors).length === 0;
    };

    const isStep2Valid = () => config.docs.every(docType => documents.some(d => d.type === docType && d.url));

    return (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
            <LinearGradient colors={["#064E3B", "#059669"]} style={StyleSheet.absoluteFill} />
            
            <View style={styles.headerArea}>
                <TouchableOpacity onPress={() => step > 1 ? setStep(step - 1) : router.back()} style={styles.backBtnHeader}>
                    <Ionicons name="chevron-back" size={24} color="#FFF" />
                </TouchableOpacity>
                <View style={styles.progressContainerHeader}>
                    <View style={[styles.progressIndicatorHeader, { width: `${(step / 3) * 100}%` }]} />
                </View>
                <Text style={styles.stepTextHeader}>{step}/3</Text>
            </View>

            <ScrollView
                ref={scrollRef}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
                contentContainerStyle={[styles.scrollContent, { paddingBottom: keyboardHeight > 0 ? keyboardHeight + 24 : 100 }]}
            >
                <View style={styles.sheetContainer}>
                    {step === 1 && (
                        <View style={styles.stepWrapper}>
                            <Text style={styles.stepTitle}>Let's build your profile</Text>
                            <Text style={styles.stepSub}>Join A1Care as a {config.label}</Text>
                            <View style={styles.formGroup}>
                                {config.fields.map(f => {
                                    if (f === "specialization" && role !== "doctor") return null;
                                    if (f === "gender") return (
                                        <View key={f} style={styles.fieldItem} onLayout={(event) => rememberFieldOffset(f, event.nativeEvent.layout.y)}>
                                            <Text style={styles.fieldLabel}>Gender <Text style={styles.asterisk}>*</Text></Text>
                                            <TouchableOpacity style={[styles.dropdownToggle, fieldErrors.gender && styles.fieldInputError]} onPress={() => { Keyboard.dismiss(); setShowGenderDropdown(true); }}>
                                                <MaterialCommunityIcons name={form.gender === "Male" ? "gender-male" : "gender-female"} size={20} color="#10B981" />
                                                <Text style={styles.dropdownValue}>{form.gender}</Text>
                                                <Ionicons name="chevron-down" size={18} color="#94A3B8" />
                                            </TouchableOpacity>
                                            {!!fieldErrors.gender && <Text style={styles.fieldErrorText}>{fieldErrors.gender}</Text>}
                                            <Modal visible={showGenderDropdown} transparent animationType="fade">
                                                <View style={styles.modalOverlay}><TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setShowGenderDropdown(false)} /><View style={styles.modalContentCompact}><Text style={styles.modalTitle}>Select Gender</Text>{GENDERS.map(g => (<TouchableOpacity key={g} style={styles.modalItem} onPress={() => { update("gender", g); setFieldErrors(prev => ({ ...prev, gender: "" })); setShowGenderDropdown(false); }}><Text style={[styles.modalItemText, form.gender === g && styles.modalItemSelected]}>{g}</Text>{form.gender === g && <Ionicons name="checkmark-circle" size={20} color="#10B981" />}</TouchableOpacity>))}</View></View>
                                            </Modal>
                                        </View>
                                    );
                                    if (f === "specialization") return (
                                        <View key={f} style={styles.fieldItem} onLayout={(event) => rememberFieldOffset(f, event.nativeEvent.layout.y)}>
                                            <Text style={styles.fieldLabel}>Specializations <Text style={styles.asterisk}>*</Text></Text>
                                            <View style={styles.specContainer}>{form.specialization.map((s: string) => (<TouchableOpacity key={s} style={styles.specChip} onPress={() => { update("specialization", form.specialization.filter((x: string) => x !== s)); setFieldErrors(prev => ({ ...prev, specialization: "" })); }}><Text style={styles.specChipText}>{s}</Text><Ionicons name="close-circle" size={14} color="#FFF" /></TouchableOpacity>))}<TouchableOpacity style={[styles.addSpecBtn, fieldErrors.specialization && styles.specAddError]} onPress={() => { Keyboard.dismiss(); setShowSpecDropdown(true); }}><Ionicons name="add-circle" size={18} color="#10B981" /><Text style={styles.addSpecText}>Add</Text></TouchableOpacity></View>
                                            {!!fieldErrors.specialization && <Text style={styles.fieldErrorText}>{fieldErrors.specialization}</Text>}
                                            <Modal transparent visible={showSpecDropdown} animationType="slide"><View style={styles.modalOverlay}><TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setShowSpecDropdown(false)} /><View style={[styles.modalContentFull, keyboardHeight > 0 && { marginBottom: keyboardHeight, maxHeight: '52%' }]}><View style={styles.searchInputWrap}><Ionicons name="search" size={18} color="#64748B" /><TextInput style={styles.searchBar} placeholder="Search specialization" placeholderTextColor="#94A3B8" value={specSearch} onChangeText={setSpecSearch} /></View><ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 300 }}>{SPECIALIZATIONS.filter(s => s.toLowerCase().includes(specSearch.toLowerCase())).map(s => (<TouchableOpacity key={s} style={styles.modalItem} onPress={() => { if (!form.specialization.includes(s)) update("specialization", [...form.specialization, s]); setFieldErrors(prev => ({ ...prev, specialization: "" })); setShowSpecDropdown(false); }}><Text style={styles.modalItemText}>{s}</Text></TouchableOpacity>))}</ScrollView></View></View></Modal>
                                        </View>
                                    );
                                    if (f === "workingHours") return (
                                        <View key={f} style={styles.fieldItem} onLayout={(event) => rememberFieldOffset(f, event.nativeEvent.layout.y)}>
                                            <Text style={styles.fieldLabel}>Working Hours <Text style={styles.asterisk}>*</Text></Text>
                                            <TouchableOpacity style={[styles.dropdownToggle, fieldErrors.workingHours && styles.fieldInputError]} onPress={() => { Keyboard.dismiss(); setShowWorkingHoursDropdown(true); }}>
                                                <Ionicons name="time-outline" size={20} color="#10B981" />
                                                <Text style={[styles.dropdownValue, !form.workingHours && { color: "#A0AABB" }]}>{form.workingHours || "Select working hours"}</Text>
                                                <Ionicons name="chevron-down" size={18} color="#94A3B8" />
                                            </TouchableOpacity>
                                            {!!fieldErrors.workingHours && <Text style={styles.fieldErrorText}>{fieldErrors.workingHours}</Text>}
                                            <Modal visible={showWorkingHoursDropdown} transparent animationType="slide">
                                                <View style={styles.modalOverlay}>
                                                    <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setShowWorkingHoursDropdown(false)} />
                                                    <View style={styles.modalContentCompact}>
                                                        <Text style={styles.modalTitle}>Select Working Hours</Text>
                                                        {WORKING_HOUR_OPTIONS.map(hours => (
                                                            <TouchableOpacity key={hours} style={styles.modalItem} onPress={() => { update("workingHours", hours); setFieldErrors(prev => ({ ...prev, workingHours: "" })); setShowWorkingHoursDropdown(false); }}>
                                                                <Text style={[styles.modalItemText, form.workingHours === hours && styles.modalItemSelected]}>{hours}</Text>
                                                                {form.workingHours === hours && <Ionicons name="checkmark-circle" size={20} color="#10B981" />}
                                                            </TouchableOpacity>
                                                        ))}
                                                    </View>
                                                </View>
                                            </Modal>
                                        </View>
                                    );
                                    return (
                                        <View key={f} style={styles.fieldItem} onLayout={(event) => rememberFieldOffset(f, event.nativeEvent.layout.y)}>
                                            <Text style={styles.fieldLabel}>{fieldLabels[f]} <Text style={styles.asterisk}>*</Text></Text>
                                            <TextInput
                                                style={[styles.fieldInput, f === "about" && styles.fieldArea, fieldErrors[f] && styles.fieldInputError]}
                                                placeholder={`Enter ${fieldLabels[f].toLowerCase()}`}
                                                placeholderTextColor="#94A3B8"
                                                value={form[f]}
                                                onChangeText={v => updateField(f, v)}
                                                onFocus={() => scrollToField(f)}
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
                            <Text style={styles.stepSub}>Please upload the required verification documents.</Text>
                            <View style={styles.docList}>{config.docs.map(doc => { const uploaded = documents.find(d => d.type === doc); return (<TouchableOpacity key={doc} onPress={() => handlePickDocument(doc)} style={[styles.docItem, uploaded && styles.docItemDone]}>
                                <View><Text style={styles.docLabelTitle}>{doc}</Text><Text style={{fontSize:12, color: uploaded ? '#059669' : '#94A3B8', marginTop: 2}}>{uploaded ? "Successfully Uploaded" : "Tap to upload document"}</Text></View>
                                <View style={[styles.docIconBox, uploaded && { backgroundColor: '#D1FAE5' }]}>
                                    <Ionicons name={uploaded ? "checkmark-circle" : "cloud-upload"} size={22} color={uploaded ? "#059669" : "#64748B"} />
                                </View>
                            </TouchableOpacity>); })}</View>
                            <TouchableOpacity onPress={() => isStep2Valid() ? setStep(3) : Alert.alert("Notice", "Upload all documents.")} style={[styles.mainActionBtn, !isStep2Valid() && { opacity: 0.5 }]}><Text style={styles.mainActionText}>Next: Bank Details</Text></TouchableOpacity>
                        </View>
                    )}

                    {step === 3 && (
                        <View style={styles.stepWrapper}>
                            <Text style={styles.stepTitle}>Settlement Details</Text>
                            <Text style={styles.stepSub}>Where should we send your earnings?</Text>
                            <View style={styles.formGroup}>
                                <View style={styles.fieldItem} onLayout={(event) => rememberFieldOffset("accountNumber", event.nativeEvent.layout.y)}><Text style={styles.fieldLabel}>Account Number <Text style={styles.asterisk}>*</Text></Text><TextInput style={[styles.fieldInput, fieldErrors.accountNumber && styles.fieldInputError]} placeholder="9-18 digit account number" placeholderTextColor="#94A3B8" value={form.bankDetails.accountNumber} onFocus={() => scrollToField("accountNumber")} onChangeText={v => { updateBank("accountNumber", v.replace(/\D/g, "").slice(0, 18)); setFieldErrors(prev => ({ ...prev, accountNumber: "" })); }} keyboardType="number-pad" />{!!fieldErrors.accountNumber && <Text style={styles.fieldErrorText}>{fieldErrors.accountNumber}</Text>}</View>
                                <View style={styles.fieldItem} onLayout={(event) => rememberFieldOffset("ifscCode", event.nativeEvent.layout.y)}><Text style={styles.fieldLabel}>IFSC Code <Text style={styles.asterisk}>*</Text></Text><TextInput style={[styles.fieldInput, fieldErrors.ifscCode && styles.fieldInputError]} placeholder="e.g. SBIN0001234" placeholderTextColor="#94A3B8" value={form.bankDetails.ifscCode} onFocus={() => scrollToField("ifscCode")} onChangeText={v => { updateBank("ifscCode", v.toUpperCase().slice(0, 11)); setFieldErrors(prev => ({ ...prev, ifscCode: "" })); }} autoCapitalize="characters" />{!!fieldErrors.ifscCode && <Text style={styles.fieldErrorText}>{fieldErrors.ifscCode}</Text>}</View>
                                <View style={styles.fieldItem} onLayout={(event) => rememberFieldOffset("bankName", event.nativeEvent.layout.y)}>
                                    <Text style={styles.fieldLabel}>Bank Name <Text style={styles.asterisk}>*</Text></Text>
                                    <TouchableOpacity style={[styles.dropdownToggle, fieldErrors.bankName && styles.fieldInputError]} onPress={() => { Keyboard.dismiss(); setShowBankDropdown(true); }}>
                                        <Text style={[styles.dropdownValue, !form.bankDetails.bankName && { color: "#A0AABB" }]}>{form.bankDetails.bankName || "Select Bank"}</Text>
                                        <Ionicons name="chevron-down" size={18} color="#94A3B8" />
                                    </TouchableOpacity>
                                    {!!fieldErrors.bankName && <Text style={styles.fieldErrorText}>{fieldErrors.bankName}</Text>}
                                    <Modal visible={showBankDropdown} transparent animationType="slide">
                                        <View style={styles.modalOverlay}><TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setShowBankDropdown(false)} />
                                        <View style={[styles.modalContentFull, keyboardHeight > 0 && { marginBottom: keyboardHeight, maxHeight: '52%' }]}><View style={styles.searchInputWrap}><Ionicons name="search" size={18} color="#64748B" /><TextInput style={styles.searchBar} placeholder="Search bank" placeholderTextColor="#94A3B8" value={bankSearch} onChangeText={setBankSearch} /></View><ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 300 }}>{filteredBanks.map(b => (<TouchableOpacity key={b} style={styles.modalItem} onPress={() => { updateBank("bankName", b); setFieldErrors(prev => ({ ...prev, bankName: "" })); setShowBankDropdown(false); }}><Text style={styles.modalItemText}>{b}</Text></TouchableOpacity>))}</ScrollView></View></View>
                                    </Modal>
                                </View>
                                <View style={styles.fieldItem} onLayout={(event) => rememberFieldOffset("accountHolderName", event.nativeEvent.layout.y)}><Text style={styles.fieldLabel}>Account Holder Name <Text style={styles.asterisk}>*</Text></Text><TextInput style={[styles.fieldInput, fieldErrors.accountHolderName && styles.fieldInputError]} placeholder="As per bank records" placeholderTextColor="#94A3B8" value={form.bankDetails.accountHolderName} onFocus={() => scrollToField("accountHolderName")} onChangeText={v => { updateBank("accountHolderName", v.replace(/[^a-zA-Z\s]/g, "")); setFieldErrors(prev => ({ ...prev, accountHolderName: "" })); }} />{!!fieldErrors.accountHolderName && <Text style={styles.fieldErrorText}>{fieldErrors.accountHolderName}</Text>}</View>
                                <View style={styles.fieldItem} onLayout={(event) => rememberFieldOffset("referredByCode", event.nativeEvent.layout.y)}>
                                    <Text style={styles.fieldLabel}>Referral Code <Text style={{ color: '#94A3B8', fontWeight: '500' }}>(optional)</Text></Text>
                                    <TextInput style={styles.fieldInput} placeholder="Friend's referral code" placeholderTextColor="#94A3B8" value={form.referredByCode} onFocus={() => scrollToField("referredByCode")} onChangeText={v => update("referredByCode", v.toUpperCase().replace(/[^A-Z0-9]/g, ''))} autoCapitalize="characters" maxLength={10} />
                                </View>
                            </View>
                            <TouchableOpacity onPress={handleRegister} style={styles.mainActionBtn}>{showThinking ? <ActivityIndicator color="#FFF" /> : <Text style={styles.mainActionText}>Confirm & Finish</Text>}</TouchableOpacity>
                        </View>
                    )}
                </View>
            </ScrollView>

            {/* Image Source Selection Modal */}
            <Modal visible={showSourceModal} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setShowSourceModal(false)} />
                    <View style={styles.modalContentCompact}>
                        <Text style={styles.modalTitle}>Choose {pickingDocType} Source</Text>
                        <View style={styles.sourceRow}>
                            <TouchableOpacity style={styles.sourceBtn} onPress={handleLaunchCamera}>
                                <View style={[styles.sourceIconBox, { backgroundColor: '#ECFDF5' }]}><Ionicons name="camera" size={28} color="#059669" /></View>
                                <Text style={styles.sourceText}>Camera</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.sourceBtn} onPress={handleLaunchGallery}>
                                <View style={[styles.sourceIconBox, { backgroundColor: '#F0F9FF' }]}><Ionicons name="images" size={28} color="#0EA5E9" /></View>
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
    headerArea: { flexDirection: 'row', alignItems: 'center', paddingTop: Platform.OS === 'ios' ? 60 : 40, paddingHorizontal: 24, paddingBottom: 20 },
    backBtnHeader: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
    progressContainerHeader: { flex: 1, height: 6, backgroundColor: 'rgba(255,255,255,0.3)', borderRadius: 3, overflow: 'hidden', marginHorizontal: 16 },
    progressIndicatorHeader: { height: '100%', backgroundColor: '#FFF', borderRadius: 3 },
    stepTextHeader: { fontSize: 13, fontWeight: '800', color: '#FFF' },
    
    scrollContent: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 100 },
    sheetContainer: { backgroundColor: '#FFF', borderRadius: 32, padding: 24, paddingVertical: 32, shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 20, elevation: 10, minHeight: Dimensions.get("window").height * 0.75 },
    
    stepWrapper: { flex: 1 },
    stepTitle: { fontSize: 28, fontWeight: '900', color: '#064E3B', marginBottom: 6 },
    stepSub: { fontSize: 14, color: '#64748B', marginBottom: 28, lineHeight: 20 },
    
    formGroup: { gap: 18 },
    fieldItem: { gap: 8 },
    fieldLabel: { fontSize: 14, fontWeight: '700', color: '#334155', marginLeft: 4 },
    asterisk: { color: "#EF4444" },
    fieldInput: { height: 58, backgroundColor: '#F8FAFC', borderRadius: 16, paddingHorizontal: 16, fontSize: 15, color: '#0F172A', borderWidth: 1.5, borderColor: '#E2E8F0' },
    fieldInputError: { borderColor: '#EF4444', backgroundColor: '#FEF2F2' },
    fieldErrorText: { color: '#DC2626', fontSize: 12, fontWeight: '600', marginLeft: 4 },
    fieldArea: { height: 110, textAlignVertical: 'top', paddingTop: 16 },
    dropdownToggle: { height: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#F8FAFC', borderRadius: 16, paddingHorizontal: 16, borderWidth: 1.5, borderColor: '#E2E8F0' },
    dropdownValue: { fontSize: 15, fontWeight: '600', color: '#0F172A' },
    
    specContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    specChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#059669', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 12, gap: 6 },
    specChipText: { color: '#FFF', fontSize: 13, fontWeight: '700' },
    addSpecBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ECFDF5', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1.5, borderColor: '#059669', borderStyle: 'dashed', gap: 4 },
    specAddError: { borderColor: '#EF4444', backgroundColor: '#FEF2F2' },
    addSpecText: { color: '#059669', fontSize: 13, fontWeight: '700' },
    
    mainActionBtn: { height: 60, backgroundColor: '#059669', borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginTop: 32, shadowColor: "#059669", shadowOpacity: 0.3, shadowRadius: 10, elevation: 6, shadowOffset: { width: 0, height: 4 } },
    mainActionText: { color: '#FFF', fontSize: 16, fontWeight: '800' },
    
    docList: { gap: 14 },
    docItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F8FAFC', padding: 20, borderRadius: 20, borderWidth: 1.5, borderColor: '#E2E8F0' },
    docItemDone: { borderColor: '#10B981', backgroundColor: '#F0FDF4' },
    docLabelTitle: { fontSize: 16, fontWeight: '800', color: '#0F172A' },
    docIconBox: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#E2E8F0', justifyContent: 'center', alignItems: 'center' },
    
    modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.6)', justifyContent: 'flex-end' },
    modalContentCompact: { backgroundColor: '#FFF', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, paddingBottom: Platform.OS === 'ios' ? 40 : 24 },
    modalContentFull: { backgroundColor: '#FFF', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, paddingBottom: Platform.OS === 'ios' ? 40 : 24, maxHeight: '85%' },
    modalTitle: { fontSize: 20, fontWeight: '900', color: '#0F172A', marginBottom: 20 },
    modalItem: { padding: 18, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
    modalItemText: { fontSize: 16, color: '#475569', fontWeight: '600' },
    modalItemSelected: { color: '#059669', fontWeight: '800' },
    
    searchInputWrap: { height: 54, flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', borderRadius: 16, paddingHorizontal: 16, marginBottom: 16, borderWidth: 1.5, borderColor: '#E2E8F0', gap: 10 },
    searchBar: { flex: 1, height: '100%', padding: 0, fontSize: 16, fontWeight: '600', color: '#0F172A' },
    
    sourceRow: { flexDirection: 'row', justifyContent: 'space-around', marginVertical: 20 },
    sourceBtn: { alignItems: 'center', gap: 12 },
    sourceIconBox: { width: 72, height: 72, borderRadius: 24, justifyContent: 'center', alignItems: 'center' },
    sourceText: { fontSize: 15, fontWeight: '700', color: '#334155' },
    cancelBtn: { marginTop: 12, paddingVertical: 16, alignItems: 'center', backgroundColor: '#F8FAFC', borderRadius: 16 },
    cancelBtnText: { fontSize: 16, color: '#EF4444', fontWeight: '800' },
});
