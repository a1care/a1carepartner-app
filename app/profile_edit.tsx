import React, { useState, useEffect } from "react";
import {
    View, Text, StyleSheet, ScrollView, TextInput,
    TouchableOpacity, ActivityIndicator, KeyboardAvoidingView,
    Platform, Image, Dimensions, Modal, BackHandler, Alert
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { api } from "../lib/api";
import { useAuthStore } from "../stores/auth";
import { Toast } from "../components/CustomToast";

const SPECIALIZATIONS = [
    "Cardiologist", "General Physician", "Neurologist", "Pediatrician",
    "Dermatologist", "Orthopedic", "Gynecologist", "Psychiatrist",
    "Dentist", "Ophthalmologist", "ENT Specialist", "General Surgeon",
    "Urologist", "Oncologist", "Radiologist", "Gastroenterologist"
].sort();

const GENDERS = ["Male", "Female", "Other"];

const ROLE_LABELS: Record<string, string> = {
    doctor: "Doctor",
    nurse: "Nurse",
    ambulance: "Ambulance",
    rental: "Medical Rental",
};

const { width, height } = Dimensions.get("window");

export default function ProfileEditScreen() {
    const router = useRouter();
    const queryClient = useQueryClient();
    const { user, setUser } = useAuthStore() as any;

    const [formData, setFormData] = useState({
        name: "",
        about: "",
        gender: "Male",
        specialization: [] as string[],
        workingHours: "",
        serviceRadius: "",
        experience: "",
        consultationFee: "",
        homeConsultationFee: "",
        onlineConsultationFee: "",
        profileImage: "",
        city: "",
        address: "",
        location: { type: "Point", coordinates: [0, 0] } as any,
    });

    const [previewImage, setPreviewImage] = useState("");
    const [isUploading, setIsUploading] = useState(false);
    const [showSpecDropdown, setShowSpecDropdown] = useState(false);
    const [showGenderDropdown, setShowGenderDropdown] = useState(false);
    const [specSearch, setSpecSearch] = useState("");
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
    const [showSourceModal, setShowSourceModal] = useState(false);
    const [showFullImage, setShowFullImage] = useState(false);
    const [debugToken, setDebugToken] = useState("");
    const [showDebug, setShowDebug] = useState(false);

    useEffect(() => {
        const backAction = () => {
            router.navigate("/(tabs)/profile" as any);
            return true;
        };
        const backHandler = BackHandler.addEventListener("hardwareBackPress", backAction);
        return () => backHandler.remove();
    }, []);

    const filteredSpecs = SPECIALIZATIONS.filter(s =>
        s.toLowerCase().includes(specSearch.toLowerCase())
    );

    const { data: staffData, isLoading } = useQuery({
        queryKey: ["profileDetails"],
        queryFn: async () => {
            const res = await api.get("/doctor/auth/details");
            return res.data.data;
        }
    });

    useEffect(() => {
        if (staffData) {
            const initialImage = staffData.profileImage || "";
            setFormData({
                name: staffData.name || "",
                about: staffData.about || "",
                gender: staffData.gender || "Male",
                specialization: Array.isArray(staffData.specialization) ? staffData.specialization : [],
                workingHours: staffData.workingHours || "",
                serviceRadius: staffData.serviceRadius?.toString() || "",
                experience: staffData.experience?.toString() || (staffData.startExperience ? Math.max(0, new Date().getFullYear() - new Date(staffData.startExperience).getFullYear()).toString() : ""),
                consultationFee: staffData.consultationFee?.toString() || "",
                homeConsultationFee: staffData.homeConsultationFee?.toString() || "",
                onlineConsultationFee: staffData.onlineConsultationFee?.toString() || "",
                profileImage: initialImage,
                city: staffData.city || "",
                address: staffData.address || "",
                location: staffData.location || { type: "Point", coordinates: [0, 0] },
            });
            setPreviewImage(initialImage);
        }
    }, [staffData]);

    useEffect(() => {
        fetchToken();
    }, []);

    const fetchToken = async () => {
        try {
            const { NativeModules } = require('react-native');
            if (!NativeModules.RNFBAppModule) {
                setDebugToken("ERROR: Firebase Native Module not found in this build.");
                return;
            }

            const fbMessaging = require('@react-native-firebase/messaging');
            const messaging = fbMessaging.default || fbMessaging;
            
            const token = await messaging().getToken();
            if (token) {
                setDebugToken(token);
            } else {
                setDebugToken("TOKEN_EMPTY");
            }
        } catch (e: any) {
            setDebugToken("ERROR: " + (e.message || "Library Missing"));
            console.log("FCM debug fetch failed", e);
        }
    };

    const handleCopyToken = () => {
        if (!debugToken || debugToken.startsWith("ERROR") || debugToken === "Establishing secure connection...") {
            setDebugToken("Retrying connection...");
            fetchToken();
            return;
        }
        Alert.alert("FCM Device Token", debugToken);
        console.log("FCM_TOKEN:", debugToken);
    };

    const displayData = staffData || user || {};
    const detailsList = [
        { label: "Name", value: displayData.name },
        { label: "Mobile", value: displayData.mobileNumber },
        { label: "Email", value: displayData.email },
        { label: "Gender", value: displayData.gender },
        { label: "Role", value: ROLE_LABELS[String(displayData.role || "").toLowerCase()] || displayData.role?.name || displayData.role || "Partner" },
        { label: "Specialization", value: Array.isArray(displayData.specialization) ? displayData.specialization.join(", ") : displayData.specialization },
        { label: "Experience (yrs)", value: displayData.experience ?? (displayData.startExperience ? Math.max(0, new Date().getFullYear() - new Date(displayData.startExperience).getFullYear()) : undefined) },
        { label: "Consultation Fee", value: displayData.consultationFee ? `₹${displayData.consultationFee}` : undefined },
        { label: "Home Fee", value: displayData.homeConsultationFee ? `₹${displayData.homeConsultationFee}` : undefined },
        { label: "Online Fee", value: displayData.onlineConsultationFee ? `₹${displayData.onlineConsultationFee}` : undefined },
        { label: "City", value: displayData.city },
        { label: "Service Radius", value: displayData.serviceRadius ? `${displayData.serviceRadius} km` : undefined },
        { label: "Working Hours", value: displayData.workingHours },
        { label: "Rating", value: displayData.rating ? `${displayData.rating} ⭐` : "—" },
        { label: "Jobs Completed", value: displayData.completed ?? 0 },
    ].filter(item => item.value !== undefined && item.value !== null && String(item.value).trim() !== "" && String(item.value) !== "0");

    const handleUseMyLocation = async () => {
        try {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync(); // Just a dummy check for now
            const { status: locStatus } = await (await import('expo-location')).requestForegroundPermissionsAsync();
            if (locStatus !== 'granted') return Toast.show({ type: "error", text1: "Location Permission Denied" });
            
            const location = await (await import('expo-location')).getCurrentPositionAsync({});
            const reverse = await (await import('expo-location')).reverseGeocodeAsync({
                latitude: location.coords.latitude,
                longitude: location.coords.longitude
            });
            
            if (reverse[0]) {
                const city = reverse[0].city || reverse[0].district || reverse[0].subregion;
                const state = reverse[0].region;
                setFormData(prev => ({ 
                    ...prev, 
                    city: `${city}, ${state}`,
                    location: { type: "Point", coordinates: [location.coords.longitude, location.coords.latitude] }
                }));
                Toast.show({ type: "success", text1: "Location Detected" });
            }
        } catch (err) {
            Toast.show({ type: "error", text1: "Could not detect location" });
        }
    };

    const handlePickImage = () => {
        setShowSourceModal(true);
    };

    const handleCameraSelection = async () => {
        setShowSourceModal(false);
        try {
            const { status } = await ImagePicker.requestCameraPermissionsAsync();
            if (status !== 'granted') return Toast.show({ type: "error", text1: "Permission Denied" });
            const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.6 });
            if (!result.canceled) await uploadAndSyncImage(result.assets[0].uri);
        } catch (err) { console.error(err); }
    };

    const handleGallerySelection = async () => {
        setShowSourceModal(false);
        try {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') return Toast.show({ type: "error", text1: "Permission Denied" });
            const result = await ImagePicker.launchImageLibraryAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.6 });
            if (!result.canceled) await uploadAndSyncImage(result.assets[0].uri);
        } catch (err) { console.error(err); }
    };

    const uploadAndSyncImage = async (uri: string) => {
        try {
            setPreviewImage(uri);
            setIsUploading(true);
            const fd = new FormData();
            const fileName = uri.split('/').pop() || 'profile.jpg';
            fd.append('document', { uri, name: fileName, type: 'image/jpeg' } as any);
            const res = await api.post(`/doctor/auth/upload-document`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
            if (res.data.success && res.data.data?.url) {
                const imageUrl = res.data.data.url;
                setFormData(prev => ({ ...prev, profileImage: imageUrl }));
                setPreviewImage(imageUrl);
                const updateRes = await api.put("/doctor/auth/register", { profileImage: imageUrl });
                if (updateRes.data?.data) {
                    await setUser({ ...user, ...updateRes.data.data });
                    queryClient.invalidateQueries({ queryKey: ["profileDetails"] });
                }
                Toast.show({ type: "success", text1: "Profile Image Updated" });
            }
        } catch (err) {
            Toast.show({ type: "error", text1: "Upload Failed" });
        } finally {
            setIsUploading(false);
        }
    };

    const updateProfileMutation = useMutation({
        mutationFn: async (updatedData: any) => api.put("/doctor/auth/register", updatedData),
        onSuccess: (res) => {
            setUser({ ...user, ...res.data.data });
            queryClient.invalidateQueries({ queryKey: ["profileDetails"] });
            Toast.show({ type: "success", text1: "Profile Updated" });
            router.back();
        },
    });

    const handleSave = () => {
        const nextErrors: Record<string, string> = {};
        if (!formData.name.trim()) nextErrors.name = "Full name is required.";
        if (!formData.gender.trim()) nextErrors.gender = "Gender is required.";
        if (!formData.specialization.length) nextErrors.specialization = "Select at least one specialization.";
        if (!formData.workingHours.trim()) nextErrors.workingHours = "Working hours are required.";
        if (!formData.experience.trim()) nextErrors.experience = "Experience is required.";
        if (!formData.homeConsultationFee.trim()) nextErrors.homeConsultationFee = "Home consultation fee is required.";
        if (!formData.onlineConsultationFee.trim()) nextErrors.onlineConsultationFee = "Online consultation fee is required.";
        if (!formData.serviceRadius.trim()) nextErrors.serviceRadius = "Service radius is required.";

        setFieldErrors(nextErrors);
        if (Object.keys(nextErrors).length > 0) return;

        updateProfileMutation.mutate({ 
            ...formData, 
            serviceRadius: Number(formData.serviceRadius) || 0,
            experience: Number(formData.experience) || 0,
            consultationFee: Number(formData.consultationFee) || 0,
            homeConsultationFee: Number(formData.homeConsultationFee) || 0,
            onlineConsultationFee: Number(formData.onlineConsultationFee) || 0,
            city: formData.city,
            address: formData.address,
            location: formData.location
        });
    };

    const toggleSpecialization = (spec: string) => {
        setFormData(prev => ({
            ...prev,
            specialization: prev.specialization.includes(spec) 
                ? prev.specialization.filter(s => s !== spec) 
                : [...prev.specialization, spec]
        }));
        setFieldErrors(prev => ({ ...prev, specialization: "" }));
    };

    if (isLoading) return <View style={styles.loadingContainer}><ActivityIndicator size="large" color="#2D935C" /></View>;

    return (
        <SafeAreaView style={styles.container}>
            <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.navigate("/(tabs)/profile" as any)} style={styles.backBtn}><Ionicons name="arrow-back" size={24} color="#1E293B" /></TouchableOpacity>
                    <Text style={styles.headerTitle}>My Profile</Text>
                    <View style={{ width: 40 }} />
                </View>

                <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                    <View style={styles.avatarSection}>
                        <View style={styles.avatarContainer}>
                            <TouchableOpacity onPress={() => setShowFullImage(true)}>
                                {previewImage ? (
                                    <Image source={{ uri: previewImage }} style={styles.avatar} />
                                ) : (
                                    <View style={[styles.avatar, styles.avatarPlaceholder]}>
                                        <Ionicons name="person" size={40} color="#94A3B8" />
                                    </View>
                                )}
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.editBadge} onPress={handlePickImage}>
                                {isUploading ? (
                                    <ActivityIndicator size="small" color="#FFF" />
                                ) : (
                                    <Ionicons name="camera" size={18} color="#FFF" />
                                )}
                            </TouchableOpacity>
                        </View>
                        <Text style={styles.avatarLabel}>{isUploading ? "Uploading..." : "Tap to change photo"}</Text>
                    </View>

                    {/* Registration Details Grid */}
                    <Text style={styles.sectionTitle}>Profile Details</Text>
                    <View style={styles.detailsGrid}>
                        {detailsList.map((item, idx) => (
                            <View key={idx} style={styles.detailCard}>
                                <Text style={styles.detailLabel}>{item.label}</Text>
                                <Text style={styles.detailValue}>{String(item.value)}</Text>
                            </View>
                        ))}
                    </View>

                    <Text style={styles.sectionTitle}>Edit Professional Info</Text>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Full Name <Text style={styles.asterisk}>*</Text></Text>
                        <TextInput style={[styles.input, fieldErrors.name && styles.inputError]} value={formData.name} onChangeText={(v) => { setFormData({ ...formData, name: v }); setFieldErrors(prev => ({ ...prev, name: "" })); }} placeholder="Enter your name" />
                        {!!fieldErrors.name && <Text style={styles.errorText}>{fieldErrors.name}</Text>}
                    </View>

                    <View style={styles.inputGroup}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                            <Text style={[styles.label, { marginBottom: 0 }]}>City (Service Location) <Text style={styles.asterisk}>*</Text></Text>
                            <TouchableOpacity onPress={handleUseMyLocation} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                <Ionicons name="location" size={16} color="#2D935C" />
                                <Text style={{ color: '#2D935C', fontWeight: '700', fontSize: 13 }}>Detect</Text>
                            </TouchableOpacity>
                        </View>
                        <TextInput style={[styles.input, fieldErrors.city && styles.inputError]} value={formData.city} onChangeText={(v) => { setFormData({ ...formData, city: v }); setFieldErrors(prev => ({ ...prev, city: "" })); }} placeholder="e.g. Mumbai, Maharashtra" />
                        {!!fieldErrors.city && <Text style={styles.errorText}>{fieldErrors.city}</Text>}
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Detailed Address</Text>
                        <TextInput style={[styles.input, styles.textArea]} value={formData.address} onChangeText={(v) => setFormData({ ...formData, address: v })} placeholder="Enter your full clinic address or area details..." multiline />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Professional Bio (About)</Text>
                        <TextInput style={[styles.input, styles.textArea]} value={formData.about} onChangeText={(v) => setFormData({ ...formData, about: v })} placeholder="Tell patients about your expertise..." multiline />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Gender <Text style={styles.asterisk}>*</Text></Text>
                        <TouchableOpacity style={[styles.dropdownToggle, fieldErrors.gender && styles.inputError]} onPress={() => setShowGenderDropdown(true)}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                <MaterialCommunityIcons name={formData.gender === "Male" ? "gender-male" : formData.gender === "Female" ? "gender-female" : "gender-non-binary"} size={22} color="#2D935C" />
                                <Text style={styles.dropdownValue}>{formData.gender || "Select Gender"}</Text>
                            </View>
                            <Ionicons name="chevron-down" size={20} color="#94A3B8" />
                        </TouchableOpacity>
                        {!!fieldErrors.gender && <Text style={styles.errorText}>{fieldErrors.gender}</Text>}
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Specializations <Text style={styles.asterisk}>*</Text></Text>
                        <View style={styles.specChipsContainer}>
                            {formData.specialization.map(s => (
                                <TouchableOpacity key={s} style={styles.specChip} onPress={() => toggleSpecialization(s)}>
                                    <Text style={styles.specChipText}>{s}</Text>
                                    <Ionicons name="close-circle" size={16} color="#FFF" />
                                </TouchableOpacity>
                            ))}
                            <TouchableOpacity onPress={() => setShowSpecDropdown(true)} style={styles.addSpecBtn}><Ionicons name="add-circle" size={22} color="#2D935C" /><Text style={styles.addSpecText}>Add Specialization</Text></TouchableOpacity>
                        </View>
                        {!!fieldErrors.specialization && <Text style={styles.errorText}>{fieldErrors.specialization}</Text>}
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Working Hours <Text style={styles.asterisk}>*</Text></Text>
                        <TextInput style={[styles.input, fieldErrors.workingHours && styles.inputError]} value={formData.workingHours} onChangeText={(v) => { setFormData({ ...formData, workingHours: v }); setFieldErrors(prev => ({ ...prev, workingHours: "" })); }} placeholder="e.g. 09:00 - 18:00" />
                        {!!fieldErrors.workingHours && <Text style={styles.errorText}>{fieldErrors.workingHours}</Text>}
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Years of Experience <Text style={styles.asterisk}>*</Text></Text>
                        <TextInput style={[styles.input, fieldErrors.experience && styles.inputError]} value={formData.experience} onChangeText={(v) => { setFormData({ ...formData, experience: v.replace(/\D/g, "") }); setFieldErrors(prev => ({ ...prev, experience: "" })); }} placeholder="e.g. 5" keyboardType="number-pad" />
                        {!!fieldErrors.experience && <Text style={styles.errorText}>{fieldErrors.experience}</Text>}
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Clinic Consultation Fee (₹) <Text style={styles.asterisk}>*</Text></Text>
                        <TextInput style={styles.input} value={formData.consultationFee} onChangeText={(v) => setFormData({ ...formData, consultationFee: v.replace(/\D/g, "") })} placeholder="e.g. 500" keyboardType="number-pad" />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Home Consultation Fee (₹) <Text style={styles.asterisk}>*</Text></Text>
                        <TextInput style={[styles.input, fieldErrors.homeConsultationFee && styles.inputError]} value={formData.homeConsultationFee} onChangeText={(v) => { setFormData({ ...formData, homeConsultationFee: v.replace(/\D/g, "") }); setFieldErrors(prev => ({ ...prev, homeConsultationFee: "" })); }} placeholder="e.g. 1000" keyboardType="number-pad" />
                        {!!fieldErrors.homeConsultationFee && <Text style={styles.errorText}>{fieldErrors.homeConsultationFee}</Text>}
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Online Consultation Fee (₹) <Text style={styles.asterisk}>*</Text></Text>
                        <TextInput style={[styles.input, fieldErrors.onlineConsultationFee && styles.inputError]} value={formData.onlineConsultationFee} onChangeText={(v) => { setFormData({ ...formData, onlineConsultationFee: v.replace(/\D/g, "") }); setFieldErrors(prev => ({ ...prev, onlineConsultationFee: "" })); }} placeholder="e.g. 400" keyboardType="number-pad" />
                        {!!fieldErrors.onlineConsultationFee && <Text style={styles.errorText}>{fieldErrors.onlineConsultationFee}</Text>}
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Service Radius (in km) <Text style={styles.asterisk}>*</Text></Text>
                        <TextInput style={[styles.input, fieldErrors.serviceRadius && styles.inputError]} value={formData.serviceRadius} onChangeText={(v) => { setFormData({ ...formData, serviceRadius: v.replace(/\D/g, "") }); setFieldErrors(prev => ({ ...prev, serviceRadius: "" })); }} placeholder="e.g. 15" keyboardType="number-pad" />
                        {!!fieldErrors.serviceRadius && <Text style={styles.errorText}>{fieldErrors.serviceRadius}</Text>}
                    </View>

                    <TouchableOpacity style={[styles.saveBtn, updateProfileMutation.isPending && styles.saveBtnDisabled]} onPress={handleSave} disabled={updateProfileMutation.isPending}>
                        {updateProfileMutation.isPending ? <ActivityIndicator color="#FFF" /> : <Text style={styles.saveBtnText}>Save Changes</Text>}
                    </TouchableOpacity>

                    {/* Debug Info */}
                    <TouchableOpacity 
                        onLongPress={() => setShowDebug(!showDebug)} 
                        style={{ marginVertical: 30, alignItems: 'center', opacity: 0.3 }}
                    >
                        <Text style={{ fontSize: 10, color: '#94A3B8' }}>Build v1.0.42 • Long press for debug</Text>
                    </TouchableOpacity>

                    {showDebug && (
                        <View style={{ padding: 20, backgroundColor: '#F1F5F9', borderRadius: 20, marginBottom: 40 }}>
                            <Text style={{ fontSize: 12, fontWeight: '800', color: '#475569', marginBottom: 10 }}>FCM DEVICE TOKEN</Text>
                            <TouchableOpacity onPress={handleCopyToken}>
                                <Text style={{ fontSize: 11, color: debugToken.startsWith("ERROR") ? '#EF4444' : '#64748B', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' }} numberOfLines={5}>
                                    {debugToken || "Establishing secure connection..."}
                                </Text>
                            </TouchableOpacity>
                            <Text style={{ fontSize: 10, color: '#2D935C', fontWeight: '700', marginTop: 10 }}>
                                {(!debugToken || debugToken.startsWith("ERROR")) ? "Tap to retry connection" : "Tap token to show full string"}
                            </Text>
                        </View>
                    )}
                </ScrollView>

                {/* Gender Dropdown */}
                <Modal visible={showGenderDropdown} transparent animationType="fade">
                    <View style={styles.dropdownOverlay}>
                        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setShowGenderDropdown(false)} />
                        <View style={styles.dropdownMenuCompact}>
                            <Text style={styles.dropdownTitle}>Select Gender</Text>
                            {GENDERS.map(g => (
                                <TouchableOpacity key={g} style={styles.dropdownItem} onPress={() => { setFormData({ ...formData, gender: g }); setShowGenderDropdown(false); }}>
                                    <Text style={[styles.dropdownText, formData.gender === g && styles.dropdownTextSelected]}>{g}</Text>
                                    {formData.gender === g && <Ionicons name="checkmark-circle" size={22} color="#2D935C" />}
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                </Modal>

                {/* Specialization Modal (Kept same logic) */}
                <Modal visible={showSpecDropdown} transparent animationType="slide">
                    <View style={styles.dropdownOverlay}>
                        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setShowSpecDropdown(false)} />
                        <View style={styles.dropdownMenuFull}>
                            <View style={styles.dropdownHeader}><Text style={styles.dropdownTitle}>Select Specializations</Text><TouchableOpacity onPress={() => setShowSpecDropdown(false)}><Ionicons name="close" size={24} color="#64748B" /></TouchableOpacity></View>
                            <TextInput style={styles.searchBar} placeholder="Search specialization..." value={specSearch} onChangeText={setSpecSearch} />
                            <ScrollView style={{ maxHeight: 400 }}>
                                {filteredSpecs.map(s => (
                                    <TouchableOpacity key={s} style={[styles.dropdownItem, formData.specialization.includes(s) && styles.dropdownItemSelected]} onPress={() => toggleSpecialization(s)}>
                                        <Text style={[styles.dropdownText, formData.specialization.includes(s) && styles.dropdownTextSelected]}>{s}</Text>
                                        <Ionicons name={formData.specialization.includes(s) ? "checkbox" : "square-outline"} size={22} color={formData.specialization.includes(s) ? "#2D935C" : "#CBD5E1"} />
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        </View>
                    </View>
                </Modal>

                {/* Image Source Selection Modal */}
                <Modal visible={showSourceModal} transparent animationType="fade">
                    <View style={styles.dropdownOverlay}>
                        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setShowSourceModal(false)} />
                        <View style={styles.dropdownMenuCompact}>
                            <Text style={styles.dropdownTitle}>Update Profile Photo</Text>
                            <View style={styles.sourceRow}>
                                <TouchableOpacity style={styles.sourceBtn} onPress={handleCameraSelection}>
                                    <View style={[styles.sourceIconBox, { backgroundColor: '#F0F9FF' }]}><Ionicons name="camera" size={32} color="#1A7FD3" /></View>
                                    <Text style={styles.sourceText}>Camera</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.sourceBtn} onPress={handleGallerySelection}>
                                    <View style={[styles.sourceIconBox, { backgroundColor: '#F0FDF4' }]}><Ionicons name="images" size={32} color="#2D935C" /></View>
                                    <Text style={styles.sourceText}>Gallery</Text>
                                </TouchableOpacity>
                            </View>
                            <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowSourceModal(false)}>
                                <Text style={styles.cancelBtnText}>Cancel</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </Modal>

                {/* Full Image Viewer */}
                <Modal visible={showFullImage} transparent animationType="fade">
                    <View style={styles.fullImageOverlay}>
                        <TouchableOpacity style={styles.closeFullImage} onPress={() => setShowFullImage(false)}>
                            <Ionicons name="close" size={30} color="#FFF" />
                        </TouchableOpacity>
                        {previewImage ? (
                            <Image source={{ uri: previewImage }} style={styles.fullImage} resizeMode="contain" />
                        ) : (
                            <Ionicons name="person" size={150} color="#94A3B8" />
                        )}
                    </View>
                </Modal>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#F8FAFC" },
    loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 15, backgroundColor: "#FFF", borderBottomWidth: 1, borderBottomColor: "#E2E8F0" },
    backBtn: { padding: 5 },
    headerTitle: { fontSize: 18, fontWeight: "800", color: "#1E293B" },
    scrollContent: { padding: 20, paddingBottom: 60 },
    avatarSection: { alignItems: "center", marginBottom: 30 },
    avatarContainer: { position: "relative" },
    avatar: { width: 110, height: 110, borderRadius: 55, borderWidth: 4, borderColor: "#FFF" },
    avatarPlaceholder: { backgroundColor: "#F1F5F9", justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: "#E2E8F0" },
    editBadge: { position: "absolute", bottom: 4, right: 4, backgroundColor: "#2D935C", width: 34, height: 34, borderRadius: 17, justifyContent: "center", alignItems: "center", borderWidth: 3, borderColor: "#FFF", elevation: 4 },
    avatarLabel: { marginTop: 12, fontSize: 13, fontWeight: "700", color: "#64748B" },
    inputGroup: { marginBottom: 24 },
    label: { fontSize: 14, fontWeight: "800", color: "#1E293B", marginBottom: 10, marginLeft: 2 },
    asterisk: { color: "#EF4444" },
    input: { backgroundColor: "#FFF", borderRadius: 16, paddingHorizontal: 18, paddingVertical: 16, fontSize: 15, color: "#1E293B", borderWidth: 1.5, borderColor: "#F1F5F9", elevation: 1 },
    inputError: { borderColor: "#EF4444" },
    errorText: { color: "#DC2626", fontSize: 12, fontWeight: "600", marginTop: 8, marginLeft: 2 },
    textArea: { height: 100, textAlignVertical: "top" },
    dropdownToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#FFF', borderRadius: 16, paddingHorizontal: 18, paddingVertical: 16, borderWidth: 1.5, borderColor: '#F1F5F9', elevation: 1 },
    dropdownValue: { fontSize: 15, color: '#1E293B', fontWeight: '600' },
    specChipsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 4 },
    specChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#2D935C', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 12, gap: 6 },
    specChipText: { color: '#FFF', fontSize: 13, fontWeight: '700' },
    addSpecBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1.5, borderColor: '#2D935C', borderStyle: 'dashed', gap: 6 },
    addSpecText: { color: '#2D935C', fontSize: 13, fontWeight: '700' },
    dropdownOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    dropdownMenuCompact: { backgroundColor: '#FFF', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, paddingBottom: 40 },
    dropdownMenuFull: { backgroundColor: '#FFF', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, paddingBottom: 40, maxHeight: '80%' },
    dropdownHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    dropdownTitle: { fontSize: 18, fontWeight: '900', color: '#1E293B', marginBottom: 15 },
    searchBar: { height: 50, backgroundColor: '#F8FAFC', borderRadius: 12, paddingHorizontal: 15, marginBottom: 15, borderWidth: 1, borderColor: '#E2E8F0' },
    dropdownItem: { padding: 18, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#F8FAFC' },
    dropdownItemSelected: { backgroundColor: '#F0FDF4' },
    dropdownText: { fontSize: 15, color: '#475569', fontWeight: '600' },
    dropdownTextSelected: { color: '#2D935C', fontWeight: '800' },
    saveBtn: { backgroundColor: "#2D935C", borderRadius: 20, height: 60, justifyContent: "center", alignItems: "center", marginTop: 20, elevation: 5 },
    saveBtnDisabled: { opacity: 0.6 },
    saveBtnText: { color: "#FFF", fontSize: 17, fontWeight: "800" },
    sectionTitle: { fontSize: 18, fontWeight: '800', color: "#334155", marginBottom: 16, marginTop: 10 },
    detailsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 28 },
    detailCard: { width: "47%", backgroundColor: "#FFF", borderRadius: 18, padding: 14, borderWidth: 1, borderColor: '#F1F5F9', elevation: 1 },
    detailLabel: { fontSize: 12, color: "#94A3B8", fontWeight: "700", marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
    detailValue: { fontSize: 14, fontWeight: "800", color: "#1E293B" },
    sourceRow: { flexDirection: 'row', justifyContent: 'space-around', marginVertical: 24 },
    sourceBtn: { alignItems: 'center', gap: 12 },
    sourceIconBox: { width: 70, height: 70, borderRadius: 24, justifyContent: 'center', alignItems: 'center', elevation: 4, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10 },
    sourceText: { fontSize: 14, fontWeight: '700', color: '#64748B' },
    cancelBtn: { alignItems: 'center', paddingVertical: 10 },
    cancelBtnText: { fontSize: 16, color: '#EF4444', fontWeight: '700' },
    fullImageOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center' },
    fullImage: { width: '100%', height: '80%' },
    closeFullImage: { position: 'absolute', top: 50, right: 20, zIndex: 10, padding: 10 },
});
