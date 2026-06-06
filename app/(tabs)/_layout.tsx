import { Tabs, useFocusEffect } from "expo-router";
import { StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuthStore } from "../../stores/auth";
import { api } from "../../lib/api";
import { useCallback, useRef } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";

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
                    const res = await api.get("/doctor/auth/details");
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
    const isExplicitlyUnapproved = user?.isVerified === false || user?.isRegistered === false;
    const tabsLocked = isLoading ? false : isExplicitlyUnapproved;

    return (
        <Tabs
            screenOptions={{
                headerShown: false,
                tabBarStyle: [
                    styles.tabBar,
                    {
                        height: 62 + bottomInset,
                        paddingBottom: bottomInset,
                    },
                ],
                tabBarShowLabel: true,
                tabBarLabelStyle: styles.label,
                tabBarIconStyle: styles.icon,
                tabBarItemStyle: styles.item,
                tabBarActiveTintColor: "#2D935C",
                tabBarInactiveTintColor: "#94A3B8",
            }}
        >
            <Tabs.Screen
                name="home"
                options={{
                    title: "Home",
                    tabBarIcon: ({ focused, color }) => (
                        <Ionicons name={focused ? "home" : "home-outline"} size={26} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="bookings"
                options={{
                    title: "Bookings",
                    tabBarIcon: ({ focused, color }) => (
                        <Ionicons name={focused ? "calendar" : "calendar-outline"} size={26} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="earnings"
                options={{
                    title: "Earnings",
                    tabBarIcon: ({ focused, color }) => (
                        <Ionicons name={focused ? "wallet" : "wallet-outline"} size={26} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="notifications"
                options={{
                    title: "Alerts",
                    tabBarIcon: ({ focused, color }) => (
                        <Ionicons name={focused ? "notifications" : "notifications-outline"} size={26} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="profile"
                options={{
                    title: "Menu",
                    tabBarIcon: ({ focused, color }) => (
                        <Ionicons name={focused ? "person" : "person-outline"} size={26} color={color} />
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
        paddingTop: 6,
        elevation: 12,
        shadowColor: "#0F172A",
        shadowOpacity: 0.08,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: -4 },
    },
    label: {
        fontSize: 11,
        fontWeight: "700",
        marginTop: 2,
        marginBottom: 0,
    },
    icon: {
        marginTop: 2,
        marginBottom: -2,
    },
    item: {
        paddingVertical: 6,
        alignItems: "center",
        justifyContent: "center",
    },

});
