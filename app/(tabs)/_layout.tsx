import { Tabs, useFocusEffect } from "expo-router";
import { StyleSheet, View, TouchableOpacity, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuthStore } from "../../stores/auth";
import { getRolePath } from "../../lib/roleApi";
import { api } from "../../lib/api";
import { useCallback, useRef } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";

export default function TabsLayout() {
    const { user, isLoading, setUser } = useAuthStore() as any;
    const hasRefetched = useRef(false);
    const insets = useSafeAreaInsets();
    const bottomInset = Math.max(insets.bottom, 12);

    // When coming to tabs, refresh auth details once so newly verified providers get unlocked immediately
    useFocusEffect(
        useCallback(() => {
            const refresh = async () => {
                if (!user?._id || hasRefetched.current) return;
                try {
                    const res = await api.get(`/${getRolePath()}/auth/details`);
                    if (res?.data?.data) {
                        await setUser(res.data.data);
                    }
                    hasRefetched.current = true;
                } catch (err) {
                    console.log("Auth refresh failed (non-blocking):", err instanceof Error ? err.message : err);
                }
            };
            refresh();
        }, [user?._id, setUser])
    );

    // Lock tabs only when we definitely know the user is unapproved.
    // While loading (or when flags are absent), keep tabs usable.
    const isExplicitlyUnapproved = user?.isVerified === false || user?.isRegistered === false
        || user?.status === 'Pending' || user?.status === 'Rejected';
    const tabsLocked = isLoading ? false : isExplicitlyUnapproved;

    // PA1: unread notifications badge
    const { data: unreadCount = 0 } = useQuery({
        queryKey: ["partner_notifications_unread"],
        queryFn: async () => {
            const res = await api.get("/notifications?unread=true&limit=1");
            return res.data?.data?.unreadCount || 0;
        },
        enabled: !!user?._id,
        refetchInterval: 30000,
    });

    return (
        <Tabs
            screenOptions={{
                headerShown: false,
                tabBarStyle: [
                    styles.tabBar,
                    {
                        height: 70 + bottomInset,
                        paddingBottom: bottomInset + 8,
                    },
                ],
                tabBarShowLabel: true,
                tabBarLabelStyle: styles.label,
                tabBarIconStyle: styles.icon,
                tabBarItemStyle: styles.item,
                tabBarActiveTintColor: "#1E3A8A", // Blue active style matching screenshot
                tabBarInactiveTintColor: "#94A3B8",
                freezeOnBlur: true, // Optimizes memory by freezing inactive tabs
            }}
        >
            <Tabs.Screen
                name="home"
                options={{
                    title: "Home",
                    tabBarIcon: ({ focused, color }) => (
                        <Ionicons name={focused ? "home" : "home-outline"} size={24} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="earnings"
                options={{
                    title: "Earnings",
                    tabBarIcon: ({ focused, color }) => (
                        <Ionicons name={focused ? "wallet" : "wallet-outline"} size={24} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="bookings"
                options={{
                    title: "Bookings",
                    tabBarIcon: ({ focused, color }) => (
                        <Ionicons name={focused ? "calendar" : "calendar-outline"} size={24} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="notifications"
                options={{
                    title: "Alerts", // Matching Alerts label
                    tabBarBadge: unreadCount > 0 ? unreadCount : undefined,
                    tabBarIcon: ({ focused, color }) => (
                        <Ionicons name={focused ? "notifications" : "notifications-outline"} size={24} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="profile"
                options={{
                    title: "Profile",
                    tabBarIcon: ({ focused, color }) => (
                        <Ionicons name={focused ? "person" : "person-outline"} size={24} color={color} />
                    ),
                }}
            />
        </Tabs>
    );
}

const styles = StyleSheet.create({
    tabBar: {
        backgroundColor: "#FFFFFF",
        borderTopWidth: 1,
        borderTopColor: '#F1F5F9',
        borderTopLeftRadius: 28, // Curved top boundaries matching screenshot
        borderTopRightRadius: 28,
        paddingTop: 8,
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        elevation: 16,
        shadowColor: "#0F172A",
        shadowOpacity: 0.08,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: -4 },
    },
    label: {
        fontSize: 10,
        fontWeight: "700",
        marginTop: 2,
        marginBottom: 0,
    },
    icon: {
        marginTop: 2,
        marginBottom: -2,
    },
    item: {
        alignItems: "center",
        justifyContent: "center",
    },
});
