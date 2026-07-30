import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Alert, Modal, Platform } from "react-native";
import { Toast } from '../components/CustomToast';
import { WebView } from "react-native-webview";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useState, useEffect } from "react";
import { BackHandler } from "react-native";
import { useAuthStore } from "../stores/auth";

let RazorpayCheckout: any = null;
try {
    RazorpayCheckout = require("react-native-razorpay").default;
} catch {
    RazorpayCheckout = null;
}

export default function SubscriptionsScreen() {
    const router = useRouter();
    const queryClient = useQueryClient();
    const [activeTab, setActiveTab] = useState<"Plans" | "History">("Plans");
    const [selectedPlanForFeatures, setSelectedPlanForFeatures] = useState<any>(null);
    const [paymentSelectionPlan, setPaymentSelectionPlan] = useState<any>(null);
    const [paymentUrl, setPaymentUrl] = useState<string | null>(null);

    const { user } = useAuthStore() as any;
    const role = user?.role || "doctor";

    useEffect(() => {
        const onBack = () => {
            router.replace("/(tabs)/profile");
            return true;
        };

        const subscription = BackHandler.addEventListener("hardwareBackPress", onBack);
        return () => subscription.remove();
    }, [router]);

    const formatValidity = (days: number) => {
        if (!days) return "N/A";
        if (days >= 36500) return "Lifetime";
        if (days % 365 === 0) return `${days / 365} Year${days / 365 > 1 ? 's' : ''}`;
        if (days % 30 === 0) return `${days / 30} Month${days / 30 > 1 ? 's' : ''}`;
        return `${days} Days`;
    };

    const getPlanFeatures = (plan: any) => {
        if (plan?.features && plan.features.length > 0) {
            return plan.features;
        }
        if (plan?.tier === "Premium") {
            return [
                "Featured profile placement (Higher search ranking)",
                "Verified Partner Digital Badge on Patient App",
                "Direct bookings queue & 24/7 client match",
                "Advanced scheduling & calendar management",
                "Dedicated manager & priority payouts"
            ];
        }
        return [
            "Standard profile listing visible to patients",
            "Access to patient booking requests queue",
            "Direct digital wallet payments & tracking",
            "Basic chat and call support",
            "Standard 100 Days validity"
        ];
    };

    // Fetch Available Plans for this category
    const { data: plansData, isLoading: loadingPlans } = useQuery({
        queryKey: ["subscriptionPlans", role],
        queryFn: async () => {
            const res = await api.get(`/subscription/plans?category=${role}`);
            return res.data.data;
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

    // Fetch History
    const { data: historyData, isLoading: loadingHistory } = useQuery({
        queryKey: ["subscriptionHistory"],
        queryFn: async () => {
            const res = await api.get("/subscription/history");
            return res.data.data;
        },
        enabled: activeTab === "History"
    });

    const buySubscription = useMutation({
        mutationFn: async (args: { planId: string, mode: "WALLET" | "ONLINE" }) => {
            const res = await api.post("/subscription/subscribe", { planId: args.planId, paymentMode: args.mode });
            return res.data;
        },
        onSuccess: async (data, variables) => {
            if (variables.mode === "WALLET") {
                if (Platform.OS === 'web') window.alert("Subscription activated successfully via Wallet.");
                else Alert.alert("Success", "Subscription activated successfully via Wallet.");
                queryClient.invalidateQueries({ queryKey: ["myActiveSubscription"] });
                queryClient.invalidateQueries({ queryKey: ["subscriptionHistory"] });
                queryClient.invalidateQueries({ queryKey: ["partner-wallet"] });
                router.replace("/(tabs)/profile");
            } else {
                if (data.data?.order?._id) {
                    try {
                        if (!RazorpayCheckout || typeof RazorpayCheckout.open !== "function") {
                            throw new Error("Online payment is currently unavailable. Please contact support.");
                        }
                        const orderId = data.data.order._id;
                        const razorRes = await api.post("/payments/razorpay/initiate", { orderId });
                        const razorData = razorRes.data?.data;
                        const paymentData: any = await RazorpayCheckout.open({
                            key: razorData.key,
                            amount: razorData.razorOrder.amount,
                            currency: 'INR',
                            name: 'A1Care 24/7',
                            description: `Subscription Payment`,
                            order_id: razorData.razorOrder.id,
                            prefill: {
                                email: razorData.customer.email || '',
                                contact: razorData.customer.contact || '',
                                name: razorData.customer.name || '',
                            },
                            theme: { color: '#0F172A' },
                        });
                        await api.post("/payments/razorpay/verify", {
                            razorpay_order_id: paymentData.razorpay_order_id,
                            razorpay_payment_id: paymentData.razorpay_payment_id,
                            razorpay_signature: paymentData.razorpay_signature,
                            orderId: orderId,
                        });
                        queryClient.invalidateQueries({ queryKey: ["myActiveSubscription"] });
                        queryClient.invalidateQueries({ queryKey: ["subscriptionHistory"] });
                        router.replace({
                            pathname: "/checkout_status" as any,
                            params: {
                                status: "success",
                                type: "SUBSCRIPTION"
                            }
                        });
                    } catch (e: any) {
                        if (e.code === 2 || e.code === "2") {
                            if (Platform.OS === 'web') window.alert("Payment Cancelled");
                            else Alert.alert("Payment Cancelled", "You cancelled the payment.");
                        } else {
                            router.replace({
                                pathname: "/checkout_status" as any,
                                params: {
                                    status: "failure",
                                    type: "SUBSCRIPTION"
                                }
                            });
                        }
                    }
                } else {
                    if (Platform.OS === 'web') window.alert("Payment integration is pending or failed to generate order.");
                    else Alert.alert("Payment Pending", "Online payment integration will be handled next.");
                }
            }
        },
        onError: (error: any) => {
            if (Platform.OS === 'web') window.alert(error.response?.data?.message || "Failed to request subscription");
            else Alert.alert("Error", error.response?.data?.message || "Failed to request subscription");
        }
    });

    const handleBuyClick = (plan: any) => {
        if (plan.price === 0) {
            buySubscription.mutate({ planId: plan._id, mode: "WALLET" });
        } else {
            setPaymentSelectionPlan(plan);
        }
    };

    const handleBack = () => {
        router.replace("/(tabs)/profile");
    };

    // Default back behavior (OS handles stack); no manual override.

    return (
        <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={handleBack} style={styles.backButton} hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}>
                    <Ionicons name="arrow-back" size={26} color="#1E293B" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>My Subscription</Text>
            </View>

            {/* Tabs */}
            <View style={styles.tabWrapper}>
                <View style={styles.tabContainer}>
                    <TouchableOpacity
                        style={[styles.tab, activeTab === "Plans" && styles.activeTab]}
                        onPress={() => setActiveTab("Plans")}
                    >
                        <Text style={[styles.tabText, activeTab === "Plans" && styles.activeTabText]}>Plans</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.tab, activeTab === "History" && styles.activeTab]}
                        onPress={() => setActiveTab("History")}
                    >
                        <Text style={[styles.tabText, activeTab === "History" && styles.activeTabText]}>History</Text>
                    </TouchableOpacity>
                </View>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                {activeTab === "Plans" ? (
                    <View style={styles.plansList}>

                        {loadingPlans ? (
                            <ActivityIndicator size="large" color="#2D935C" style={{ marginTop: 40 }} />
                        ) : plansData?.filter((p: any) => !p.isFree)?.length > 0 ? (
                            plansData.filter((p: any) => !p.isFree).map((plan: any) => (
                                <View key={plan._id} style={[
                                    styles.planCard,
                                    plan.tier === "Premium" && styles.premiumCard
                                ]}>
                                    {plan.tier === "Premium" && (
                                        <View style={styles.premiumBadge}>
                                            <Ionicons name="sparkles" size={14} color="#FFF" />
                                            <Text style={styles.premiumBadgeText}>BEST VALUE</Text>
                                        </View>
                                    )}

                                    <View style={styles.planHeader}>
                                        <Text style={[styles.planCategory, plan.tier === "Premium" && { color: "#FFF" }]}>
                                            {plan.category?.toUpperCase()} • {plan.tier.toUpperCase()}
                                        </Text>
                                        <Text style={[styles.planTitle, plan.tier === "Premium" && { color: "#FFF" }]}>{plan.name}</Text>
                                        <Text style={[styles.planCommission, plan.tier === "Premium" ? { color: "rgba(255,255,255,0.8)" } : { color: "#059669" }]}>
                                            Commission: {plan.commissionPercentage}% per booking
                                        </Text>
                                    </View>

                                    {/* Inline benefits list */}
                                    <View style={styles.featuresListInline}>
                                        {getPlanFeatures(plan).map((feature: string, idx: number) => (
                                            <View key={idx} style={styles.featureItemInline}>
                                                <Ionicons name="checkmark-circle" size={16} color={plan.tier === "Premium" ? "#FFF" : "#2D935C"} style={{ marginRight: 6 }} />
                                                <Text style={[styles.featureTextInline, plan.tier === "Premium" && { color: "#FFF" }]}>{feature}</Text>
                                            </View>
                                        ))}
                                    </View>

                                    <View style={styles.planBody}>
                                        <View>
                                            <Text style={[styles.planPriceLabel, plan.tier === "Premium" && { color: "rgba(255,255,255,0.7)" }]}>Price</Text>
                                            <Text style={[styles.planPrice, plan.tier === "Premium" && { color: "#FFF" }]}>₹{plan.price}</Text>
                                        </View>
                                        <View style={[styles.validityBox, plan.tier === "Premium" && { backgroundColor: "rgba(255,255,255,0.1)" }]}>
                                            <Text style={[styles.validityText, plan.tier === "Premium" && { color: "#FFF" }]}>
                                                {formatValidity(plan.validityDays)} Validity
                                            </Text>
                                        </View>
                                    </View>

                                    <View style={styles.buttonRow}>
                                        <TouchableOpacity
                                            style={[
                                                styles.buyButton,
                                                plan.tier === "Premium" && styles.premiumBuyButton,
                                                mySub?.planId?._id === plan._id && styles.activePlanButton
                                            ]}
                                            onPress={() => handleBuyClick(plan)}
                                            disabled={buySubscription.isPending || mySub?.planId?._id === plan._id}
                                        >
                                            {buySubscription.isPending ? (
                                                <ActivityIndicator size="small" color="#FFF" />
                                            ) : (
                                                <Text style={[styles.buyButtonText, plan.tier === "Premium" && { color: "#000" }]}>
                                                    {mySub?.planId?._id === plan._id && mySub?.status === "Pending"
                                                        ? "Pending Approval"
                                                        : mySub?.planId?._id === plan._id
                                                            ? "Current Plan"
                                                            : plan.price === 0
                                                                ? "Activate for Free"
                                                                : "Choose Plan"}
                                                </Text>
                                            )}
                                        </TouchableOpacity>

                                        <TouchableOpacity
                                            style={[styles.infoButton, plan.tier === "Premium" && styles.premiumInfoButton]}
                                            onPress={() => setSelectedPlanForFeatures(plan)}
                                        >
                                            <Ionicons
                                                name="eye-outline"
                                                size={24}
                                                color={plan.tier === "Premium" ? "#FFF" : "#2D935C"}
                                            />
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            ))
                        ) : (
                            <View style={styles.emptyState}>
                                <Ionicons name="ribbon-outline" size={60} color="#CBD5E1" />
                                <Text style={styles.emptyTitle}>No Plans Available</Text>
                                <Text style={styles.emptySub}>Check back later for new {role} subscription plans</Text>
                            </View>
                        )}
                    </View>
                ) : (
                    <View style={styles.historyList}>
                        {loadingHistory ? (
                            <ActivityIndicator size="large" color="#2D935C" style={{ marginTop: 40 }} />
                        ) : historyData?.length > 0 ? (
                            historyData.map((item: any) => (
                                <TouchableOpacity 
                                    key={item._id} 
                                    style={[
                                        styles.planCard,
                                        item.planId?.tier === "Premium" && styles.premiumCard,
                                        { opacity: item.status === "Active" ? 1 : 0.8 }
                                    ]}
                                    onPress={() => setSelectedPlanForFeatures(item.planId)}
                                    activeOpacity={0.8}
                                >
                                    <View style={styles.planHeader}>
                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <Text style={[styles.planCategory, item.planId?.tier === "Premium" && { color: "#FFF" }]}>
                                                {item.planId?.tier?.toUpperCase()} PLAN
                                            </Text>
                                            <View style={[styles.statusTag, { backgroundColor: item.status === "Active" ? "#DCFCE7" : item.status === "Pending" ? "#FEF3C7" : "#F1F5F9" }]}>
                                                <Text style={[styles.statusTagText, { color: item.status === "Active" ? "#166534" : item.status === "Pending" ? "#D97706" : "#64748B" }]}>
                                                    {item.status}
                                                </Text>
                                            </View>
                                        </View>
                                        <Text style={[styles.planTitle, item.planId?.tier === "Premium" && { color: "#FFF" }]}>{item.planId?.name || "Premium Plan"}</Text>
                                        <Text style={[styles.historyDates, item.planId?.tier === "Premium" ? { color: "rgba(255,255,255,0.6)" } : { color: "#64748B" }]}>
                                            {new Date(item.startDate).toLocaleDateString()} - {new Date(item.endDate).toLocaleDateString()}
                                        </Text>
                                    </View>

                                    {/* Inline benefits list */}
                                    <View style={styles.featuresListInline}>
                                        {getPlanFeatures(item.planId).map((feature: string, idx: number) => (
                                            <View key={idx} style={styles.featureItemInline}>
                                                <Ionicons name="checkmark-circle" size={16} color={item.planId?.tier === "Premium" ? "#FFF" : "#2D935C"} style={{ marginRight: 6 }} />
                                                <Text style={[styles.featureTextInline, item.planId?.tier === "Premium" && { color: "#FFF" }]}>{feature}</Text>
                                            </View>
                                        ))}
                                    </View>

                                    <View style={styles.planBody}>
                                        <View>
                                            <Text style={[styles.planPriceLabel, item.planId?.tier === "Premium" && { color: "rgba(255,255,255,0.7)" }]}>Paid Amount</Text>
                                            <Text style={[styles.planPrice, { fontSize: 20 }, item.planId?.tier === "Premium" && { color: "#FFF" }]}>₹{item.planId?.price || 0}</Text>
                                        </View>
                                        <View style={[styles.validityBox, item.planId?.tier === "Premium" && { backgroundColor: "rgba(255,255,255,0.1)" }]}>
                                            <Text style={[styles.validityText, item.planId?.tier === "Premium" && { color: "#FFF" }]}>
                                                {formatValidity(item.planId?.validityDays)}
                                            </Text>
                                        </View>
                                    </View>
                                </TouchableOpacity>
                            ))
                        ) : (
                            <View style={styles.emptyState}>
                                <Ionicons name="receipt-outline" size={60} color="#CBD5E1" />
                                <Text style={styles.emptyTitle}>No History</Text>
                                <Text style={styles.emptySub}>You haven't subscribed to any plans yet</Text>
                            </View>
                        )}
                    </View>
                )}
            </ScrollView>

            {/* Features Modal */}
            <Modal
                visible={!!selectedPlanForFeatures}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setSelectedPlanForFeatures(null)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={[styles.modalHeader, selectedPlanForFeatures?.tier === "Premium" && styles.premiumModalHeader]}>
                            <View>
                                <Text style={[styles.modalTierText, selectedPlanForFeatures?.tier === "Premium" && { color: "rgba(255,255,255,0.8)" }]}>
                                    {selectedPlanForFeatures?.tier} Benefits
                                </Text>
                                <Text style={[styles.modalTitle, selectedPlanForFeatures?.tier === "Premium" && { color: "#FFF" }]}>
                                    {selectedPlanForFeatures?.name}
                                </Text>
                            </View>
                            <TouchableOpacity onPress={() => setSelectedPlanForFeatures(null)}>
                                <Ionicons name="close-circle" size={32} color={selectedPlanForFeatures?.tier === "Premium" ? "#FFF" : "#64748B"} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                            <Text style={styles.modalBodyTitle}>What's included in this plan?</Text>
                            {getPlanFeatures(selectedPlanForFeatures).map((feature: string, idx: number) => (
                                <View key={idx} style={styles.modalFeatureItem}>
                                    <View style={styles.checkIconBox}>
                                        <Ionicons name="checkmark" size={16} color="#FFF" />
                                    </View>
                                    <Text style={styles.modalFeatureText}>{feature}</Text>
                                </View>
                            ))}
                            <View style={styles.commissionBrief}>
                                <Ionicons name="trending-down" size={20} color="#2D935C" />
                                <Text style={styles.commissionBriefText}>
                                    Flat {selectedPlanForFeatures?.commissionPercentage}% service commission on all bookings.
                                </Text>
                            </View>
                        </ScrollView>

                        <TouchableOpacity
                            style={styles.modalCloseButton}
                            onPress={() => setSelectedPlanForFeatures(null)}
                        >
                            <Text style={styles.modalCloseButtonText}>Got it</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* Payment Method Selection Modal */}
            <Modal
                visible={!!paymentSelectionPlan}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setPaymentSelectionPlan(null)}
            >
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { padding: 24 }]}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                            <Text style={{ fontSize: 20, fontWeight: '900', color: '#1E293B' }}>Select Payment Method</Text>
                            <TouchableOpacity onPress={() => setPaymentSelectionPlan(null)}>
                                <Ionicons name="close-circle" size={28} color="#94A3B8" />
                            </TouchableOpacity>
                        </View>
                        
                        <Text style={{ fontSize: 15, color: '#475569', marginBottom: 24, lineHeight: 22 }}>
                            How would you like to pay <Text style={{ fontWeight: '900', color: '#1E293B' }}>₹{paymentSelectionPlan?.price}</Text> for the <Text style={{ fontWeight: '900', color: '#1E293B' }}>{paymentSelectionPlan?.name}</Text> plan?
                        </Text>

                        <TouchableOpacity
                            style={{ backgroundColor: '#2D935C', borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}
                            onPress={() => {
                                buySubscription.mutate({ planId: paymentSelectionPlan._id, mode: "WALLET" });
                                setPaymentSelectionPlan(null);
                            }}
                        >
                            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                                <Ionicons name="wallet" size={20} color="#FFF" />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={{ color: '#FFF', fontSize: 16, fontWeight: '800' }}>Pay via Partner Wallet</Text>
                                <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 2 }}>Instant activation from your earnings</Text>
                            </View>
                            <Ionicons name="chevron-forward" size={20} color="#FFF" />
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={{ backgroundColor: '#3B82F6', borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center' }}
                            onPress={() => {
                                buySubscription.mutate({ planId: paymentSelectionPlan._id, mode: "ONLINE" });
                                setPaymentSelectionPlan(null);
                            }}
                        >
                            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                                <Ionicons name="card" size={20} color="#FFF" />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={{ color: '#FFF', fontSize: 16, fontWeight: '800' }}>Pay Online</Text>
                                <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 2 }}>UPI, Credit/Debit Card, Netbanking</Text>
                            </View>
                            <Ionicons name="chevron-forward" size={20} color="#FFF" />
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* Easebuzz Payment WebView Modal */}
            <Modal
                visible={!!paymentUrl}
                animationType="slide"
                onRequestClose={() => setPaymentUrl(null)}
            >
                <SafeAreaView style={{ flex: 1, backgroundColor: "#FFF" }}>
                    <View style={styles.paymentHeader}>
                        <Text style={styles.paymentHeaderTitle}>Complete Payment</Text>
                        <TouchableOpacity onPress={() => setPaymentUrl(null)}>
                            <Ionicons name="close" size={28} color="#1E293B" />
                        </TouchableOpacity>
                    </View>
                    <WebView 
                        source={{ uri: paymentUrl || "" }}
                        style={{ flex: 1 }}
                        onNavigationStateChange={(navState) => {
                            if (navState.url.includes("status=success")) {
                                setPaymentUrl(null);
                                queryClient.invalidateQueries({ queryKey: ["myActiveSubscription"] });
                                queryClient.invalidateQueries({ queryKey: ["subscriptionHistory"] });
                                router.replace({ pathname: "/checkout_status" as any, params: { status: "success", context: "subscription" } });
                            } else if (navState.url.includes("status=failure")) {
                                setPaymentUrl(null);
                                router.replace({ pathname: "/checkout_status" as any, params: { status: "failure", context: "subscription" } });
                            }
                        }}
                    />
                </SafeAreaView>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#F3F4F9",
    },
    featuresListInline: {
        marginTop: 10,
        marginBottom: 16,
        paddingHorizontal: 4,
        gap: 8,
    },
    featureItemInline: {
        flexDirection: "row",
        alignItems: "center",
    },
    featureTextInline: {
        fontSize: 13,
        fontWeight: "600",
        color: "#475569",
        flex: 1,
    },
    currentPlanContainer: {
        marginBottom: 20,
        backgroundColor: "#FFFFFF",
        borderRadius: 16,
        padding: 16,
        borderWidth: 1.5,
        borderColor: "#E2E8F0",
        shadowColor: "#000",
        shadowOpacity: 0.05,
        shadowOffset: { width: 0, height: 2 },
        shadowRadius: 8,
        elevation: 2,
    },
    sectionHeaderTitle: {
        fontSize: 14,
        fontWeight: "800",
        color: "#1E293B",
        marginBottom: 12,
        textTransform: "uppercase",
        letterSpacing: 0.5,
    },
    currentPlanTable: {
        backgroundColor: "#F8FAFC",
        borderRadius: 12,
        overflow: "hidden",
        borderWidth: 1,
        borderColor: "#E2E8F0",
    },
    tableHeaderRow: {
        flexDirection: "row",
        backgroundColor: "#F1F5F9",
        paddingVertical: 10,
        paddingHorizontal: 8,
        borderBottomWidth: 1,
        borderBottomColor: "#E2E8F0",
    },
    tableBodyRow: {
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 14,
        paddingHorizontal: 8,
    },
    headerCell: {
        fontSize: 10,
        fontWeight: "800",
        color: "#64748B",
        letterSpacing: 0.5,
    },
    bodyCell: {
        fontSize: 12,
        fontWeight: "600",
        color: "#475569",
    },
    tierBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
    },
    tierBadgeText: {
        fontSize: 10,
        fontWeight: "800",
        letterSpacing: 0.5,
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: "#FFFFFF",
        borderBottomWidth: 1,
        borderBottomColor: "#E2E8F0",
    },
    backButton: {
        marginRight: 16,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: "700",
        color: "#1E293B",
    },
    tabWrapper: {
        backgroundColor: "#FFF",
        paddingVertical: 15,
        paddingHorizontal: 20,
    },
    tabContainer: {
        flexDirection: "row",
        backgroundColor: "#F1F5F9",
        borderRadius: 12,
        padding: 4,
    },
    tab: {
        flex: 1,
        paddingVertical: 12,
        alignItems: "center",
        borderRadius: 8,
    },
    activeTab: {
        backgroundColor: "#2D935C",
    },
    tabText: {
        fontSize: 14,
        fontWeight: "600",
        color: "#64748B",
    },
    activeTabText: {
        color: "#FFFFFF",
    },
    scrollContent: {
        padding: 20,
        flexGrow: 1,
    },
    plansList: {
        gap: 12,
    },
    planCard: {
        backgroundColor: "#FFF",
        borderRadius: 16,
        padding: 15,
        elevation: 4,
        shadowColor: "#000",
        shadowOpacity: 0.05,
        shadowRadius: 10,
        borderWidth: 1,
        borderColor: "#F1F5F9",
        overflow: 'hidden',
    },
    premiumCard: {
        backgroundColor: "#1E293B",
        borderColor: "#334155",
    },
    premiumBadge: {
        position: 'absolute',
        top: 0,
        right: 0,
        backgroundColor: "#F59E0B",
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderBottomLeftRadius: 16,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    premiumBadgeText: {
        color: "#FFF",
        fontSize: 10,
        fontWeight: "900",
    },
    planHeader: {
        marginBottom: 10,
    },
    planCategory: {
        fontSize: 12,
        fontWeight: "800",
        color: "#2D935C",
        letterSpacing: 0.5,
        marginBottom: 8,
    },
    planTitle: {
        fontSize: 18,
        fontWeight: "900",
        color: "#1E293B",
        marginBottom: 2,
    },
    planCommission: {
        fontSize: 14,
        fontWeight: "700",
    },
    planFeatures: {
        gap: 12,
        marginBottom: 25,
        borderTopWidth: 1,
        borderTopColor: "rgba(0,0,0,0.05)",
        paddingTop: 15,
    },
    featureItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    featureText: {
        fontSize: 14,
        color: "#475569",
        fontWeight: "500",
    },
    planBody: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 12,
    },
    planPriceLabel: {
        fontSize: 12,
        color: "#64748B",
        marginBottom: 4,
    },
    planPrice: {
        fontSize: 24,
        fontWeight: "900",
        color: "#1E293B",
    },
    validityBox: {
        backgroundColor: "#F8FAFC",
        paddingHorizontal: 15,
        paddingVertical: 8,
        borderRadius: 10,
    },
    validityText: {
        fontSize: 14,
        fontWeight: "700",
        color: "#64748B",
    },
    activePlanButton: {
        backgroundColor: "#94A3B8",
        opacity: 0.7,
    },
    premiumBuyButton: {
        backgroundColor: "#FFF",
    },
    buyButtonText: {
        color: "#FFFFFF",
        fontSize: 16,
        fontWeight: "900",
    },
    buttonRow: {
        flexDirection: 'row',
        gap: 12,
        alignItems: 'center',
    },
    buyButton: {
        flex: 1,
        backgroundColor: "#2D935C",
        borderRadius: 10,
        paddingVertical: 12,
        alignItems: "center",
    },
    infoButton: {
        width: 44,
        height: 44,
        borderRadius: 10,
        backgroundColor: "#F0FDF4",
        justifyContent: "center",
        alignItems: "center",
        borderWidth: 1,
        borderColor: "#DCFCE7",
    },
    premiumInfoButton: {
        backgroundColor: "rgba(255,255,255,0.1)",
        borderColor: "rgba(255,255,255,0.2)",
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.6)",
        justifyContent: "center",
        alignItems: "center",
        padding: 20,
    },
    modalContent: {
        width: "100%",
        backgroundColor: "#FFF",
        borderRadius: 32,
        overflow: "hidden",
        maxHeight: "80%",
    },
    modalHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        padding: 24,
        backgroundColor: "#F8FAFC",
        borderBottomWidth: 1,
        borderBottomColor: "#F1F5F9",
    },
    premiumModalHeader: {
        backgroundColor: "#1E293B",
    },
    modalTierText: {
        fontSize: 12,
        fontWeight: "800",
        color: "#2D935C",
        textTransform: "uppercase",
        letterSpacing: 1,
        marginBottom: 4,
    },
    modalTitle: {
        fontSize: 22,
        fontWeight: "900",
        color: "#1E293B",
    },
    modalBody: {
        padding: 24,
    },
    modalBodyTitle: {
        fontSize: 16,
        fontWeight: "800",
        color: "#1E293B",
        marginBottom: 20,
    },
    modalFeatureItem: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 16,
        gap: 12,
    },
    checkIconBox: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: "#2D935C",
        justifyContent: "center",
        alignItems: "center",
    },
    modalFeatureText: {
        fontSize: 15,
        color: "#475569",
        fontWeight: "600",
        flex: 1,
    },
    commissionBrief: {
        marginTop: 10,
        backgroundColor: "#F0FDF4",
        padding: 16,
        borderRadius: 16,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
    },
    commissionBriefText: {
        fontSize: 14,
        color: "#166534",
        fontWeight: "700",
        flex: 1,
    },
    modalCloseButton: {
        margin: 24,
        backgroundColor: "#1E293B",
        paddingVertical: 16,
        borderRadius: 16,
        alignItems: "center",
    },
    modalCloseButtonText: {
        color: "#FFF",
        fontSize: 16,
        fontWeight: "800",
    },
    historyDates: {
        fontSize: 12,
        fontWeight: "600",
        marginTop: 2,
    },
    historyList: {
        gap: 12,
    },
    statusTag: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
    },
    statusTagText: {
        fontSize: 11,
        fontWeight: "700",
    },
    emptyState: {
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 60,
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: "700",
        color: "#475569",
        marginTop: 16,
    },
    emptySub: {
        fontSize: 14,
        color: "#94A3B8",
        marginTop: 8,
        textAlign: "center",
        maxWidth: "80%",
    },
    paymentHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: "#F1F5F9",
    },
    paymentHeaderTitle: {
        fontSize: 18,
        fontWeight: "800",
        color: "#1E293B",
    },
});
