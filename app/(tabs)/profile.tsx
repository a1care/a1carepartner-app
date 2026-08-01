import { useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, RefreshControl, Modal, Dimensions, Platform } from "react-native";
import { Image } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
const { width, height } = Dimensions.get("window");
import { useAuthStore } from "../../stores/auth";
import { getRolePath } from "../../lib/roleApi";
import { useRouter } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from "@expo/vector-icons";

const API_ORIGIN = (process.env.EXPO_PUBLIC_API_URL ?? 'https://api.a1carehospital.in/api').replace(/\/api\/?$/, '');
const resolvePhoto = (url?: string | null): string | undefined => {
    if (!url) return undefined;
    if (url.startsWith('http')) return url;
    return `${API_ORIGIN}${url.startsWith('/') ? url : `/${url}`}`;
};

export default function ProfileScreen() {
    const { user, logout } = useAuthStore() as any;
    const router = useRouter();
    const queryClient = useQueryClient();

    const { data: staffData, isLoading: loadingStaff } = useQuery({
        queryKey: ["profileStaffDetails"],
        queryFn: async () => {
            const res = await api.get(`/${getRolePath()}/auth/details`);
            return res.data.data;
        }
    });

    const { data: bookings = [], refetch: refetchBookings } = useQuery({
        queryKey: ["profileBookings"],
        queryFn: async () => {
            const res = await api.get("/appointment/provider/feed", { params: { status: 'all' } });
            return res.data.data || [];
        }
    });

    // Fetch Active Subscription
    const { data: mySub, isLoading: loadingMySub } = useQuery({
        queryKey: ["myActiveSubscription"],
        queryFn: async () => {
            const res = await api.get("/subscription/my-active");
            return res.data.data;
        }
    });

    // Fetch real wallet balance from earnings summary
    const { data: earningsSummary } = useQuery({
        queryKey: ["staff_earnings"],
        queryFn: async () => {
            const res = await api.get(`/${getRolePath()}/earnings/summary`);
            return res.data.data;
        }
    });
    const walletBalance = earningsSummary?.balance ?? staffData?.walletBalance ?? 0;

    const pendingCount = bookings.filter((b: any) => b.status === "Pending" || b.status === "PARTNER_ASSIGNED" || b.status === "BROADCASTED").length;
    const confirmedCount = bookings.filter((b: any) => ["Confirmed", "Active", "ACCEPTED", "IN_PROGRESS"].includes(b.status)).length;
    const upcomingCount = bookings.filter((b: any) => ["Pending", "Confirmed", "Active", "ACCEPTED", "IN_PROGRESS", "PARTNER_ASSIGNED", "BROADCASTED"].includes(b.status)).length;

    const daysLeft = mySub ? Math.ceil((new Date(mySub.endDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) : 0;
    
    const [isDeleting, setIsDeleting] = useState(false);

    const handleLogout = () => {
        const performLogout = () => {
            queryClient.clear();
            logout(); 
            router.replace("/onboarding"); 
        };
        if (Platform.OS === 'web') {
            if (window.confirm("Are you sure you want to log out?")) {
                performLogout();
            }
        } else {
            Alert.alert("Logout", "Are you sure you want to log out?", [
                { text: "Cancel", style: "cancel" },
                { text: "Logout", style: "destructive", onPress: performLogout },
            ]);
        }
    };

    const handleDeleteAccount = () => {
        const performDeletion = async () => {
            setIsDeleting(true);
            try {
                const res = await api.post(`/${getRolePath()}/auth/request-deletion`);
                const msg = res.data.message || "Deletion request submitted. You have been logged out.";
                if (Platform.OS === 'web') window.alert(msg);
                else Alert.alert("Success", msg);
                queryClient.clear();
                await logout();
                router.replace("/onboarding");
            } catch (err: any) {
                setIsDeleting(false);
                const msg = err.response?.data?.message || "Failed to submit request.";
                if (Platform.OS === 'web') window.alert(msg);
                else Alert.alert("Error", msg);
            } finally {
                setIsDeleting(false);
            }
        };

        const msg = "Your account data will be preserved as per legal requirements, but you will no longer have access to this account. Admin needs to approve your request. Are you sure?";
        if (Platform.OS === 'web') {
            if (window.confirm(msg)) performDeletion();
        } else {
            Alert.alert("Delete Account", msg, [
                { text: "Cancel", style: "cancel" },
                { text: "Request Deletion", style: "destructive", onPress: performDeletion }
            ]);
        }
    };

    const handleNavigation = (path: string) => {
        if (path === "view-profile") {
            router.push("/view_profile");
        } else if (path === "profile") {
            router.push("/profile_edit");
        } else if (path === "subscriptions") {
            router.push("/subscriptions");
        } else if (path === "bank") {
            router.push("/bank_details");
        } else if (path === "raise-ticket") {
            router.push("/raise_ticket");
        } else if (path === "my-tickets") {
            router.push("/my_tickets");
        } else if (path === "knowledge-base") {
            router.push("/knowledge_base");
        } else if (path === "faq") {
            router.push("/faq");
        } else if (path === "privacy") {
            router.push("/privacy");
        } else if (path === "terms") {
            router.push("/terms");
        } else if (path === "referral") {
            router.push("/referral");
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                {/* User Info Section - Removed Card Background */}
                <View style={styles.userInfoRow}>
                    <View style={styles.userInfoText}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                            <Text style={[styles.greetingText, { marginBottom: 0, marginRight: 8 }]}>Hello, {user?.name ?? "Partner"}</Text>
                            {staffData && (
                                <View style={{ backgroundColor: '#DCFCE7', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, flexDirection: 'row', alignItems: 'center' }}>
                                    <Ionicons name="checkmark-circle" size={12} color="#15803D" style={{ marginRight: 4 }} />
                                    <Text style={{ fontSize: 10, color: '#15803D', fontWeight: '800' }}>VERIFIED</Text>
                                </View>
                            )}
                        </View>
                        <Text style={styles.infoSubText}>Mobile: {user?.mobileNumber ?? "—"}</Text>
                        <Text style={styles.infoSubText}>{user?.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) + " A1care Partner" : "A1care Partner"}</Text>
                    </View>
                    <View style={styles.avatarPlaceholder}>
                        {resolvePhoto(staffData?.profileImage || user?.profileImage) ? (
                            <Image
                                source={{ uri: resolvePhoto(staffData?.profileImage || user?.profileImage)! }}
                                style={{ width: "100%", height: "100%", borderRadius: 40 }}
                            />
                        ) : (
                            <Ionicons name="person" size={40} color="#CBD5E1" />
                        )}
                    </View>
                </View>

                {/* Subscription Status Banner */}
                {loadingMySub ? null : (!mySub || daysLeft <= 0) ? (
                    <TouchableOpacity style={styles.warningBanner} onPress={() => handleNavigation("subscriptions")}>
                        <Ionicons name="alert-circle" size={20} color="#991B1B" />
                        <Text style={styles.warningText}>Subscription Expired. Re-activate to accept jobs.</Text>
                        <Ionicons name="chevron-forward" size={16} color="#991B1B" />
                    </TouchableOpacity>
                ) : daysLeft < 7 ? (
                    <TouchableOpacity style={[styles.warningBanner, { backgroundColor: '#FEF3C7', borderColor: '#F59E0B' }]} onPress={() => handleNavigation("subscriptions")}>
                        <Ionicons name="time" size={20} color="#92400E" />
                        <Text style={[styles.warningText, { color: '#92400E' }]}>Plan expires in {daysLeft} days. Renew now.</Text>
                    </TouchableOpacity>
                ) : null}

                {/* Wallet Card - Matched Gradient to Mockup */}
                <TouchableOpacity onPress={() => router.push("/wallet")}>
                    <LinearGradient
                        colors={["#417D77", "#9EBB58"]}
                        start={{ x: 0, y: 0.5 }}
                        end={{ x: 1, y: 0.5 }}
                        style={styles.walletCard}
                    >
                        <View>
                        <Text style={styles.walletTitle}>A1Care Wallet</Text>
                        <Text style={styles.balanceLabel}>Balance</Text>
                        <Text style={styles.balanceAmount}>₹{walletBalance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
                        </View>
                        <View style={styles.walletFooter}>
                            <View>
                                <Text style={styles.walletId}>WLT-{(staffData?._id || user?._id || user?.id || "").slice(-12).toUpperCase() || "XXXXXXXXXXXX"}</Text>
                                <Text style={styles.walletUserName}>{staffData?.name || user?.name || "A1Care Partner"}</Text>
                            </View>
                            <Text style={styles.disaText}>A1CARE</Text>
                        </View>
                    </LinearGradient>
                </TouchableOpacity>

                {/* Quick Access - Matched Mockup */}
                <Text style={styles.sectionTitle}>Quick Actions</Text>
                <View style={styles.quickActionsGrid}>
                    <TouchableOpacity style={styles.actionCard} onPress={() => router.push({ pathname: "/(tabs)/bookings", params: { status: "Pending" } })}>
                        <View style={styles.actionIconBg}>
                            <Ionicons name="calendar-outline" size={24} color="#15803D" />
                        </View>
                        <Text style={styles.actionLabel}>Upcoming Bookings</Text>
                        <Ionicons name="chevron-forward" size={20} color="#CBD5E1" style={styles.actionArrow} />
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.actionCard} onPress={() => handleNavigation("subscriptions")}>
                        <View style={styles.actionIconBg}>
                            <Ionicons name="ribbon-outline" size={24} color="#15803D" />
                        </View>
                        <Text style={styles.actionLabel}>Manage Subscriptions</Text>
                        <Ionicons name="chevron-forward" size={20} color="#CBD5E1" style={styles.actionArrow} />
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.actionCard} onPress={() => handleNavigation("referral")}>
                        <View style={styles.actionIconBg}>
                            <Ionicons name="gift-outline" size={24} color="#15803D" />
                        </View>
                        <Text style={styles.actionLabel}>Refer & Earn</Text>
                        <Ionicons name="chevron-forward" size={20} color="#CBD5E1" style={styles.actionArrow} />
                    </TouchableOpacity>
                </View>

                {/* Main Menu */}

                {/* Main Menu - Updated with Subscription Management */}
                <Text style={styles.sectionTitle}>Account & Settings</Text>
                <View style={styles.menuContainer}>
                    <MenuLink
                        icon={<Ionicons name="person-outline" size={22} color="#15803D" />}
                        title="My Profile"
                        subtitle="View and manage personal information"
                        onPress={() => router.push("/view_profile")}
                    />
                    <MenuLink
                        icon={<Ionicons name="ribbon-outline" size={22} color="#15803D" />}
                        title="Subscription Management"
                        subtitle="Manage your platform plans"
                        onPress={() => handleNavigation("subscriptions")}
                    />
                    <MenuLink
                        icon={<Ionicons name="star-outline" size={22} color="#15803D" />}
                        title="My Reviews"
                        subtitle="See what customers are saying"
                        onPress={() => router.push("/reviews" as any)}
                    />
                    <MenuLink
                        icon={<Ionicons name="card-outline" size={22} color="#15803D" />}
                        title="Bank Details"
                        subtitle="Configure your payout method"
                        onPress={() => handleNavigation("bank")}
                    />
                </View>

                {/* Support Section - Matched Request */}
                <Text style={styles.sectionTitle}>Support & Help</Text>
                <View style={styles.menuContainer}>
                    <MenuLink
                        icon={<MaterialCommunityIcons name="ticket-confirmation-outline" size={22} color="#15803D" />}
                        title="Raise Ticket"
                        subtitle="Report an issue or get assistance"
                        onPress={() => handleNavigation("raise-ticket")}
                    />

                    <MenuLink
                        icon={<MaterialCommunityIcons name="book-open-variant" size={22} color="#15803D" />}
                        title="Knowledge Base"
                        subtitle="Guides and how-tos"
                        onPress={() => handleNavigation("knowledge-base")}
                    />

                    <MenuLink
                        icon={<Ionicons name="help-circle-outline" size={22} color="#15803D" />}
                        title="FAQ"
                        subtitle="Frequently asked questions"
                        onPress={() => handleNavigation("faq")}
                    />
                </View>

                {/* Legal Section - Added per Request */}
                <Text style={styles.sectionTitle}>Legal</Text>
                <View style={styles.menuContainer}>
                    <MenuLink
                        icon={<Ionicons name="shield-checkmark-outline" size={22} color="#15803D" />}
                        title="Privacy Policy"
                        subtitle="How we protect your data"
                        onPress={() => handleNavigation("privacy")}
                    />
                    <MenuLink
                        icon={<Ionicons name="document-text-outline" size={22} color="#15803D" />}
                        title="Terms & Conditions"
                        subtitle="Platform usage agreement"
                        onPress={() => handleNavigation("terms")}
                    />
                </View>

                <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
                    <Ionicons name="log-out-outline" size={20} color="#EF4444" />
                    <Text style={styles.logoutText}>Logout</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                    style={[styles.logoutBtn, { borderColor: '#FCA5A5', marginTop: 12 }]} 
                    onPress={handleDeleteAccount}
                    disabled={isDeleting}
                >
                    {isDeleting ? (
                        <ActivityIndicator size="small" color="#EF4444" />
                    ) : (
                        <>
                            <Ionicons name="trash-outline" size={20} color="#B91C1C" />
                            <Text style={[styles.logoutText, { color: '#B91C1C' }]}>Delete Account</Text>
                        </>
                    )}
                </TouchableOpacity>

                <View style={{ height: 60 }} />
            </ScrollView>

        </SafeAreaView>
    );
}

function MenuLink({ icon, title, subtitle, onPress, hideArrow = false }: { icon: any, title: string, subtitle: string, onPress: () => void, hideArrow?: boolean }) {
    return (
        <TouchableOpacity style={styles.menuItem} onPress={onPress}>
            <View style={styles.menuIconBox}>
                {icon}
            </View>
            <View style={styles.menuTextContainer}>
                <Text style={styles.menuTitle}>{title}</Text>
                <Text style={styles.menuSubtitle}>{subtitle}</Text>
            </View>
            {!hideArrow && <Ionicons name="chevron-forward" size={18} color="#94A3B8" />}
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#EBF1F5",
    },
    scrollContent: {
        paddingHorizontal: 20,
        paddingTop: 10,
        paddingBottom: 100,
    },
    userInfoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
        paddingVertical: 10,
    },
    userInfoText: {
        flex: 1,
    },
    greetingText: {
        fontSize: 22,
        fontWeight: '800',
        color: "#1E293B",
        marginBottom: 2,
    },
    infoSubText: {
        fontSize: 14,
        color: "#64748B",
        marginBottom: 2,
    },
    avatarPlaceholder: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: "#F1F5F9",
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    walletCard: {
        borderRadius: 28,
        padding: 24,
        height: 190,
        marginBottom: 30,
        elevation: 10,
        shadowColor: "#417D77",
        shadowOpacity: 0.3,
        shadowRadius: 20,
        flexDirection: 'column',
        justifyContent: 'space-between',
    },
    walletTitle: {
        color: 'rgba(255,255,255,0.9)',
        fontSize: 16,
        fontWeight: '700',
    },
    balanceLabel: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: 13,
        marginTop: 18,
    },
    balanceAmount: {
        color: '#FFF',
        fontSize: 48,
        fontWeight: '900',
        lineHeight: 56,
        letterSpacing: -1,
    },
    walletFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
    },
    walletId: {
        color: 'rgba(255,255,255,0.8)',
        fontSize: 11,
        fontWeight: '500',
    },
    walletUserName: {
        color: '#FFF',
        fontSize: 15,
        fontWeight: '700',
        marginTop: 2,
    },
    disaText: {
        color: 'rgba(255,255,255,0.25)',
        fontSize: 36,
        fontWeight: '900',
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: "#334155",
        marginBottom: 16,
        marginTop: 10,
    },
    quickActionsGrid: {
        flexDirection: 'column',
        gap: 12,
        marginBottom: 30,
    },
    actionCard: {
        flexDirection: 'row',
        backgroundColor: '#FFF',
        borderRadius: 20,
        padding: 16,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#F1F5F9',
        elevation: 2,
    },
    actionIconBg: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: '#F0FDF4',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    actionLabel: {
        flex: 1,
        fontSize: 15,
        fontWeight: '700',
        color: '#334155',
    },
    actionArrow: {
        marginLeft: 10,
    },
    actionBadge: {
        backgroundColor: '#15803D',
        height: 24,
        minWidth: 24,
        paddingHorizontal: 8,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    actionBadgeText: {
        color: '#FFF',
        fontSize: 11,
        fontWeight: 'bold',
    },
    docsContainer: {
        marginBottom: 30,
        backgroundColor: '#FFF',
        padding: 16,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: '#F1F5F9',
    },
    docItem: {
        width: 100,
        alignItems: 'center',
    },
    docIconBox: {
        width: 54,
        height: 54,
        borderRadius: 16,
        backgroundColor: '#F0FDF4',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 8,
        overflow: 'hidden'
    },
    docPreview: {
        width: '100%',
        height: '100%',
    },
    docName: {
        fontSize: 12,
        fontWeight: '700',
        color: '#475569',
        textAlign: 'center',
        width: 100,
    },
    statusChip: {
        backgroundColor: '#DCFCE7',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 8,
        marginTop: 4,
    },
    docStatus: {
        fontSize: 9,
        color: '#15803D',
        fontWeight: '800',
        textTransform: 'uppercase',
    },
    emptyDocs: {
        padding: 20,
        alignItems: 'center',
    },
    emptyDocsText: {
        color: '#94A3B8',
        fontSize: 13,
    },
    menuContainer: {
        backgroundColor: '#FFF',
        borderRadius: 24,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#F1F5F9',
        marginBottom: 25,
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 18,
        borderBottomWidth: 1,
        borderBottomColor: '#F8FAFC',
    },
    menuIconBox: {
        width: 44,
        height: 44,
        borderRadius: 14,
        backgroundColor: '#F8FAFC',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    menuTextContainer: {
        flex: 1,
    },
    menuTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#1E293B',
    },
    menuSubtitle: {
        fontSize: 12,
        color: '#64748B',
        marginTop: 2,
    },
    logoutBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 18,
        backgroundColor: '#FFF',
        borderRadius: 24,
        borderWidth: 1,
        borderColor: '#FEE2E2',
        gap: 10,
    },
    logoutText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#EF4444',
    },
    warningBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FEE2E2',
        padding: 14,
        borderRadius: 20,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: '#FECACA',
        gap: 10,
    },
    warningText: {
        flex: 1,
        fontSize: 13,
        fontWeight: '700',
        color: '#991B1B',
    },
    docModalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.85)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    closeDocBtn: {
        position: 'absolute',
        top: 50,
        right: 25,
        zIndex: 10,
    },
    docContentBox: {
        width: width * 0.9,
        height: height * 0.7,
        backgroundColor: '#FFF',
        borderRadius: 24,
        padding: 20,
        alignItems: 'center',
    },
    docModalTitle: {
        fontSize: 18,
        fontWeight: '900',
        color: '#1E293B',
        marginBottom: 20,
    },
    fullDocImage: {
        width: '100%',
        height: '90%',
        borderRadius: 12,
    },
    noDocView: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 15,
    },
    noDocText: {
        color: '#64748B',
        fontSize: 15,
        fontWeight: '600',
    },
});
