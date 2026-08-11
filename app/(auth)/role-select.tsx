import React, { useState, useMemo } from "react";
import {
    View, Text, TouchableOpacity, StyleSheet, ScrollView, Dimensions,
    TextInput, KeyboardAvoidingView, Platform, Keyboard, ActivityIndicator, SafeAreaView
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { PartnerRole } from "../../stores/auth";

const { width } = Dimensions.get("window");

// --- 1. DATA ARCHITECTURE ---

export type ProfessionalCategory = 
    | "Medical Professionals"
    | "Nursing & Patient Care"
    | "Diagnostics & Clinical"
    | "Emergency & Transport"
    | "Pharmacy & Equipment"
    | "Other";

export interface ProfessionalRole {
    id: string;
    name: string;
    description: string;
    icon: keyof typeof Ionicons.glyphMap;
    categoryId: ProfessionalCategory;
    baseRole: PartnerRole;
    requiresVerification: boolean;
    specializations?: string[];
}

const CATEGORIES: ProfessionalCategory[] = [
    "Medical Professionals",
    "Nursing & Patient Care",
    "Emergency & Transport",
    "Diagnostics & Clinical",
    "Pharmacy & Equipment",
    "Other"
];

const ROLES: ProfessionalRole[] = [
    // Medical
    { id: "doctor", name: "Doctor", description: "General & specialist consultation", icon: "medkit-outline", categoryId: "Medical Professionals", baseRole: "doctor", requiresVerification: true, specializations: ["General Physician", "Cardiologist", "Pediatrician", "Dermatologist", "Psychiatrist", "Orthopedic", "Gynecologist", "Other"] },
    { id: "dentist", name: "Dentist", description: "Dental care & surgery", icon: "scan-outline", categoryId: "Medical Professionals", baseRole: "doctor", requiresVerification: true },
    { id: "physio", name: "Physiotherapist", description: "Therapy & rehabilitation", icon: "body-outline", categoryId: "Medical Professionals", baseRole: "doctor", requiresVerification: true },
    
    // Nursing
    { id: "nurse", name: "Nurse", description: "Home nursing & care support", icon: "heart-outline", categoryId: "Nursing & Patient Care", baseRole: "nurse", requiresVerification: true },
    { id: "caregiver", name: "Caregiver", description: "Elderly & home healthcare", icon: "people-outline", categoryId: "Nursing & Patient Care", baseRole: "nurse", requiresVerification: false },
    
    // Emergency
    { id: "ambulance", name: "Ambulance", description: "Emergency & transport", icon: "car-outline", categoryId: "Emergency & Transport", baseRole: "ambulance", requiresVerification: true },
    { id: "paramedic", name: "Paramedic", description: "Emergency medical assistance", icon: "pulse-outline", categoryId: "Emergency & Transport", baseRole: "ambulance", requiresVerification: true },
    
    // Diagnostics
    { id: "phlebotomist", name: "Phlebotomist", description: "Blood sample collection", icon: "water-outline", categoryId: "Diagnostics & Clinical", baseRole: "nurse", requiresVerification: true },
    
    // Pharmacy/Equipment
    { id: "rental", name: "Medical Rental", description: "Equipment rental & delivery", icon: "bed-outline", categoryId: "Pharmacy & Equipment", baseRole: "rental", requiresVerification: true },
    { id: "pharmacist", name: "Pharmacist", description: "Medicine & pharmacy", icon: "flask-outline", categoryId: "Pharmacy & Equipment", baseRole: "rental", requiresVerification: true },
    
    // Other
    { id: "other", name: "Other Role", description: "Custom healthcare services", icon: "add-circle-outline", categoryId: "Other", baseRole: "doctor", requiresVerification: true },
];

export default function RoleSelectScreen() {
    const router = useRouter();
    
    const [selectedCategory, setSelectedCategory] = useState<ProfessionalCategory>("Medical Professionals");
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedRole, setSelectedRole] = useState<ProfessionalRole | null>(null);
    const [selectedSpecialization, setSelectedSpecialization] = useState<string | null>(null);
    const [otherRoleName, setOtherRoleName] = useState("");
    
    const [isSaving, setIsSaving] = useState(false);
    
    const filteredRoles = useMemo(() => {
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            return ROLES.filter(r => 
                r.name.toLowerCase().includes(q) || 
                r.description.toLowerCase().includes(q) ||
                (r.specializations && r.specializations.some(s => s.toLowerCase().includes(q)))
            );
        }
        return ROLES.filter(r => r.categoryId === selectedCategory);
    }, [selectedCategory, searchQuery]);

    const handleRoleSelect = (role: ProfessionalRole) => {
        Keyboard.dismiss();
        if (selectedRole?.id === role.id) return;
        
        setSelectedRole(role);
        setSelectedSpecialization(null);
        setOtherRoleName("");
    };

    const handleContinue = async () => {
        if (!selectedRole) return;
        
        if (selectedRole.specializations && !selectedSpecialization && !otherRoleName) return;
        if (selectedRole.id === "other" && !otherRoleName.trim()) return;

        setIsSaving(true);
        const finalBaseRole = selectedRole.baseRole;
        const finalSpec = selectedSpecialization === "Other" || selectedRole.id === "other" 
            ? otherRoleName.trim() 
            : (selectedSpecialization || selectedRole.name);
            
        await new Promise(r => setTimeout(r, 600));
        
        router.push({ 
            pathname: "/(auth)/login", 
            params: { role: finalBaseRole, specialization: finalSpec } 
        });
        setIsSaving(false);
    };

    const isContinueEnabled = selectedRole && 
        (!selectedRole.specializations || selectedSpecialization) &&
        (selectedRole.id !== "other" || otherRoleName.trim().length > 0) &&
        (selectedSpecialization !== "Other" || otherRoleName.trim().length > 0);

    return (
        <View style={styles.container}>
            <View style={[StyleSheet.absoluteFillObject, { backgroundColor: "#F8FAFC" }]} />

            <ScrollView 
                contentContainerStyle={styles.scrollContent}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                bounces={false}
            >
                {/* Hero Header Component */}
                <View style={styles.heroWrapper}>
                    <LinearGradient
                        colors={["#064E3B", "#059669"]}
                        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                        style={styles.heroBackground}
                    />
                    
                    <SafeAreaView>
                        <View style={styles.headerTop}>
                            <View style={styles.logoContainer}>
                                <Text style={styles.logoA1}>A1</Text>
                                <Text style={styles.logoCare}>Care</Text>
                                <Text style={styles.logoA1}>24/7</Text>
                            </View>
                            <TouchableOpacity style={styles.helpBtn} onPress={() => router.push("/faq")}>
                                <Ionicons name="help-circle-outline" size={24} color="#D1FAE5" />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.heroContent}>
                            <Text style={styles.heroTitle}>Join Our Network</Text>
                            <Text style={styles.heroSubtitle}>Empowering top healthcare professionals with seamless patient connectivity.</Text>
                        </View>
                        
                        {/* Premium Stepper */}
                        <View style={styles.stepperContainer}>
                            <View style={styles.stepItem}>
                                <View style={styles.stepDotActive}><Ionicons name="checkmark" size={10} color="#064E3B" /></View>
                                <Text style={styles.stepTextActive}>Role</Text>
                            </View>
                            <View style={styles.stepLine} />
                            <View style={styles.stepItem}>
                                <View style={styles.stepDotInactive} />
                                <Text style={styles.stepTextInactive}>Details</Text>
                            </View>
                            <View style={styles.stepLine} />
                            <View style={styles.stepItem}>
                                <View style={styles.stepDotInactive} />
                                <Text style={styles.stepTextInactive}>Verify</Text>
                            </View>
                        </View>
                    </SafeAreaView>
                </View>

                {/* Floating Search Bar */}
                <View style={styles.searchWrapper}>
                    <View style={styles.searchBox}>
                        <Ionicons name="search" size={20} color="#94A3B8" />
                        <TextInput
                            style={styles.searchInput}
                            placeholder="Search your profession..."
                            placeholderTextColor="#94A3B8"
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            returnKeyType="search"
                        />
                        {searchQuery.length > 0 && (
                            <TouchableOpacity onPress={() => setSearchQuery("")}>
                                <Ionicons name="close-circle" size={20} color="#CBD5E1" />
                            </TouchableOpacity>
                        )}
                    </View>
                </View>

                {/* Categories Scroll */}
                {!searchQuery && (
                    <ScrollView 
                        horizontal 
                        showsHorizontalScrollIndicator={false} 
                        style={styles.categoryScroll}
                        contentContainerStyle={styles.categoryScrollContent}
                    >
                        {CATEGORIES.map(cat => (
                            <TouchableOpacity
                                key={cat}
                                style={[styles.categoryChip, selectedCategory === cat && styles.categoryChipActive]}
                                onPress={() => { setSelectedCategory(cat); setSelectedRole(null); }}
                            >
                                <Text style={[styles.categoryChipText, selectedCategory === cat && styles.categoryChipTextActive]}>{cat}</Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                )}

                {/* Roles Grid */}
                <View style={styles.grid}>
                    {filteredRoles.length === 0 ? (
                        <View style={styles.emptyState}>
                            <View style={styles.emptyIconCircle}>
                                <Ionicons name="search" size={32} color="#94A3B8" />
                            </View>
                            <Text style={styles.emptyTitle}>No matches found</Text>
                            <Text style={styles.emptySub}>Try adjusting your search term.</Text>
                        </View>
                    ) : (
                        filteredRoles.map((r) => {
                            const isSelected = selectedRole?.id === r.id;
                            
                            return (
                                <TouchableOpacity
                                    key={r.id}
                                    onPress={() => handleRoleSelect(r)}
                                    activeOpacity={0.8}
                                    style={[styles.card, isSelected && styles.cardActive]}
                                >
                                    <View style={styles.cardHeader}>
                                        <View style={[styles.iconBox, isSelected && styles.iconBoxActive]}>
                                            <Ionicons name={r.icon} size={22} color={isSelected ? "#059669" : "#64748B"} />
                                        </View>
                                        
                                        <View style={[styles.radioOuter, isSelected && styles.radioOuterActive]}>
                                            {isSelected && <View style={styles.radioInner} />}
                                        </View>
                                    </View>
                                    
                                    <Text style={[styles.cardName, isSelected && styles.cardNameActive]} numberOfLines={1}>{r.name}</Text>
                                    <Text style={styles.cardDesc} numberOfLines={2}>{r.description}</Text>
                                </TouchableOpacity>
                            );
                        })
                    )}
                </View>

                {/* Inline Specialization Picker */}
                {selectedRole && selectedRole.specializations && (
                    <View style={styles.specializationBox}>
                        <View style={styles.specHeaderRow}>
                            <Ionicons name="git-network-outline" size={18} color="#059669" />
                            <Text style={styles.specTitle}>Select Specialization</Text>
                        </View>
                        <View style={styles.specGrid}>
                            {selectedRole.specializations.map(spec => (
                                <TouchableOpacity 
                                    key={spec}
                                    style={[styles.specChip, selectedSpecialization === spec && styles.specChipActive]}
                                    onPress={() => setSelectedSpecialization(spec)}
                                >
                                    <Text style={[styles.specChipText, selectedSpecialization === spec && styles.specChipTextActive]}>{spec}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                )}

                {/* Custom Input */}
                {((selectedRole?.id === "other") || (selectedSpecialization === "Other")) && (
                    <View style={styles.otherBox}>
                        <Text style={styles.specTitle}>Specify your role</Text>
                        <TextInput
                            style={styles.otherInput}
                            placeholder="e.g. Dietitian, Physiotherapist"
                            placeholderTextColor="#94A3B8"
                            value={otherRoleName}
                            onChangeText={setOtherRoleName}
                        />
                    </View>
                )}
            </ScrollView>

            {/* Premium Sticky Bottom Action Bar */}
            <KeyboardAvoidingView 
                behavior={Platform.OS === "ios" ? "padding" : undefined} 
                style={styles.bottomBarWrapper}
            >
                <View style={styles.bottomBarInner}>
                    <TouchableOpacity
                        onPress={handleContinue}
                        disabled={!isContinueEnabled || isSaving}
                        activeOpacity={0.85}
                        style={styles.ctaWrapper}
                    >
                        <LinearGradient
                            colors={isContinueEnabled ? ["#059669", "#047857"] : ["#E2E8F0", "#E2E8F0"]}
                            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                            style={[styles.cta, !isContinueEnabled && { shadowOpacity: 0 }]}
                        >
                            {isSaving ? (
                                <ActivityIndicator color="#FFF" />
                            ) : (
                                <View style={styles.ctaContent}>
                                    <Text style={[styles.ctaText, !isContinueEnabled && { color: "#94A3B8" }]}>
                                        Continue
                                    </Text>
                                    <Ionicons name="arrow-forward" size={20} color={isContinueEnabled ? "#FFF" : "#94A3B8"} />
                                </View>
                            )}
                        </LinearGradient>
                    </TouchableOpacity>
                    
                    <TouchableOpacity onPress={() => router.push("/(auth)/login")} style={styles.loginLinkWrap}>
                        <Text style={styles.loginLink}>Already have an account? <Text style={styles.loginLinkBold}>Log In</Text></Text>
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#F8FAFC" },
    scrollContent: { paddingBottom: 160 },
    
    // Hero Header
    heroWrapper: { paddingBottom: 40, borderBottomLeftRadius: 32, borderBottomRightRadius: 32, overflow: "hidden" },
    heroBackground: { ...StyleSheet.absoluteFillObject },
    headerTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 24, paddingTop: Platform.OS === 'ios' ? 10 : 40 },
    
    logoContainer: { flexDirection: "row", alignItems: "center" },
    logoA1: { fontSize: 24, fontWeight: "900", color: "#3B82F6", letterSpacing: -0.5 },
    logoCare: { fontSize: 24, fontWeight: "900", color: "#A7F3D0", letterSpacing: -0.5 },
    logoBadge: { backgroundColor: "#DBEAFE", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, marginLeft: 8 },
    logoBadgeText: { color: "#2563EB", fontSize: 10, fontWeight: "800" },
    helpBtn: { padding: 4 },
    
    heroContent: { paddingHorizontal: 24, marginTop: 28, marginBottom: 24 },
    heroTitle: { fontSize: 32, fontWeight: "800", color: "#FFFFFF", marginBottom: 8, letterSpacing: -0.5 },
    heroSubtitle: { fontSize: 15, color: "#D1FAE5", lineHeight: 22, fontWeight: "400", paddingRight: 20 },
    
    // Stepper
    stepperContainer: { flexDirection: "row", alignItems: "center", paddingHorizontal: 24, paddingBottom: 10 },
    stepItem: { flexDirection: "row", alignItems: "center", gap: 6 },
    stepDotActive: { width: 16, height: 16, borderRadius: 8, backgroundColor: "#A7F3D0", alignItems: "center", justifyContent: "center" },
    stepDotInactive: { width: 16, height: 16, borderRadius: 8, backgroundColor: "rgba(255,255,255,0.2)", borderWidth: 2, borderColor: "rgba(255,255,255,0.3)" },
    stepTextActive: { fontSize: 13, fontWeight: "700", color: "#FFFFFF" },
    stepTextInactive: { fontSize: 13, fontWeight: "600", color: "rgba(255,255,255,0.6)" },
    stepLine: { flex: 1, height: 2, backgroundColor: "rgba(255,255,255,0.15)", marginHorizontal: 12, borderRadius: 1 },
    
    // Floating Search
    searchWrapper: { marginTop: -28, paddingHorizontal: 24, zIndex: 10 },
    searchBox: { flexDirection: "row", alignItems: "center", backgroundColor: "#FFFFFF", borderRadius: 16, paddingHorizontal: 16, height: 56, shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 16, elevation: 8, shadowOffset: { width: 0, height: 8 } },
    searchInput: { flex: 1, height: "100%", marginLeft: 12, fontSize: 15, color: "#0F172A", fontWeight: "500" },
    
    // Categories
    categoryScroll: { flexGrow: 0, marginTop: 24, marginBottom: 16 },
    categoryScrollContent: { paddingHorizontal: 24, gap: 10 },
    categoryChip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E2E8F0" },
    categoryChipActive: { backgroundColor: "#0F172A", borderColor: "#0F172A" },
    categoryChipText: { fontSize: 14, fontWeight: "600", color: "#64748B" },
    categoryChipTextActive: { color: "#FFFFFF", fontWeight: "700" },
    
    // Grid
    grid: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 24, gap: 16, justifyContent: "space-between" },
    card: { width: (width - 64) / 2, backgroundColor: "#FFFFFF", borderRadius: 20, padding: 16, borderWidth: 1.5, borderColor: "#F1F5F9", shadowColor: "#64748B", shadowOpacity: 0.04, shadowRadius: 8, elevation: 2, shadowOffset: { width: 0, height: 4 } },
    cardActive: { borderColor: "#059669", backgroundColor: "#ECFDF5", shadowColor: "#059669", shadowOpacity: 0.1, elevation: 4 },
    
    cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 },
    iconBox: { width: 40, height: 40, borderRadius: 12, backgroundColor: "#F8FAFC", alignItems: "center", justifyContent: "center" },
    iconBoxActive: { backgroundColor: "#D1FAE5" },
    
    radioOuter: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: "#CBD5E1", alignItems: "center", justifyContent: "center" },
    radioOuterActive: { borderColor: "#059669" },
    radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#059669" },
    
    cardName: { fontSize: 16, fontWeight: "700", color: "#1E293B", marginBottom: 4 },
    cardNameActive: { color: "#064E3B" },
    cardDesc: { fontSize: 12, color: "#64748B", lineHeight: 18 },
    
    // Empty State
    emptyState: { width: "100%", alignItems: "center", paddingVertical: 40 },
    emptyIconCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: "#F1F5F9", alignItems: "center", justifyContent: "center", marginBottom: 16 },
    emptyTitle: { fontSize: 18, fontWeight: "700", color: "#0F172A", marginBottom: 8 },
    emptySub: { fontSize: 14, color: "#64748B", textAlign: "center" },
    
    // Specializations
    specializationBox: { marginHorizontal: 24, marginTop: 24, backgroundColor: "#FFFFFF", borderRadius: 20, padding: 20, borderWidth: 1, borderColor: "#F1F5F9", shadowColor: "#64748B", shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
    specHeaderRow: { flexDirection: "row", alignItems: "center", marginBottom: 16, gap: 8 },
    specTitle: { fontSize: 15, fontWeight: "700", color: "#0F172A" },
    specGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
    specChip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, backgroundColor: "#F8FAFC", borderWidth: 1, borderColor: "#E2E8F0" },
    specChipActive: { backgroundColor: "#ECFDF5", borderColor: "#059669" },
    specChipText: { fontSize: 14, fontWeight: "600", color: "#475569" },
    specChipTextActive: { color: "#064E3B" },
    
    // Other Input
    otherBox: { marginHorizontal: 24, marginTop: 24, backgroundColor: "#FFFFFF", borderRadius: 20, padding: 20, borderWidth: 1, borderColor: "#F1F5F9" },
    otherInput: { height: 52, borderRadius: 12, backgroundColor: "#F8FAFC", paddingHorizontal: 16, borderWidth: 1, borderColor: "#E2E8F0", fontSize: 15, color: "#0F172A" },
    
    // Bottom Bar
    bottomBarWrapper: { position: "absolute", bottom: 0, left: 0, right: 0 },
    bottomBarInner: { backgroundColor: "rgba(255,255,255,0.95)", paddingHorizontal: 24, paddingTop: 16, paddingBottom: Platform.OS === "ios" ? 34 : 24, borderTopWidth: 1, borderTopColor: "#F1F5F9" },
    ctaWrapper: { shadowColor: "#059669", shadowOpacity: 0.2, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 8 },
    cta: { height: 56, borderRadius: 16, justifyContent: "center", paddingHorizontal: 24 },
    ctaContent: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    ctaText: { fontSize: 17, fontWeight: "700", color: "#FFFFFF" },
    loginLinkWrap: { marginTop: 16, alignItems: "center" },
    loginLink: { fontSize: 14, color: "#64748B", fontWeight: "500" },
    loginLinkBold: { color: "#064E3B", fontWeight: "700" }
});
