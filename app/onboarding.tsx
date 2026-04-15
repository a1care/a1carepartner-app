import React, { useRef, useState, useEffect } from "react";
import {
    View,
    Text,
    TouchableOpacity,
    Dimensions,
    FlatList,
    StyleSheet,
    Image,
    Animated,
} from "react-native";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";

const { width, height } = Dimensions.get("window");

const slides = [
    {
        id: "1",
        image: require("../assets/images/splash1.png"),
        cta: "Next"
    },
    /*
    {
        id: "2",
        image: require("../assets/images/splash2.png"),
        cta: "Next"
    },
    */
    {
        id: "3",
        image: require("../assets/images/splash3.png"),
        cta: "Get Started"
    },
];

export default function OnboardingScreen() {
    const router = useRouter();
    const flatListRef = useRef<FlatList>(null);
    const [currentIndex, setCurrentIndex] = useState(0);
    const scrollX = useRef(new Animated.Value(0)).current;

    // Pulse Animation Value
    const pulseAnim = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        // Continuous pulsing glow animation loop
        Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, {
                    toValue: 1.15, // Max scale and glow
                    duration: 1000,
                    useNativeDriver: true,
                }),
                Animated.timing(pulseAnim, {
                    toValue: 1, // Back to normal
                    duration: 1000,
                    useNativeDriver: true,
                }),
            ])
        ).start();
    }, [pulseAnim]);

    const handleNext = () => {
        if (currentIndex < slides.length - 1) {
            flatListRef.current?.scrollToIndex({ index: currentIndex + 1 });
        } else {
            router.replace("/(auth)/role-select");
        }
    };

    const renderSlide = ({ item, index }: { item: (typeof slides)[0], index: number }) => {
        // Create an animation range based on the index
        const inputRange = [(index - 1) * width, index * width, (index + 1) * width];

        // Fade effect
        const opacity = scrollX.interpolate({
            inputRange,
            outputRange: [0.4, 1, 0.4],
            extrapolate: "clamp",
        });

        // Slight scale zoom effect
        const scale = scrollX.interpolate({
            inputRange,
            outputRange: [0.9, 1, 0.9],
            extrapolate: "clamp",
        });

        return (
            <View style={{ width, height, backgroundColor: '#000' }}>
                <Animated.Image
                    source={item.image}
                    style={{
                        width: "100%",
                        height: "100%",
                        resizeMode: "cover", // Keeping cover as you requested!
                        opacity,
                        transform: [{ scale }]
                    }}
                />
            </View>
        );
    };

    return (
        <View style={{ flex: 1, backgroundColor: "white" }}>
            <StatusBar style="dark" />

            <Animated.FlatList
                ref={flatListRef as any}
                data={slides}
                renderItem={renderSlide}
                keyExtractor={(i) => i.id}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                bounces={false}
                scrollEventThrottle={16}
                onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], {
                    useNativeDriver: false,
                })}
                onMomentumScrollEnd={(e) => {
                    setCurrentIndex(Math.round(e.nativeEvent.contentOffset.x / width));
                }}
            />

            {/* Skip button at top right */}
            {currentIndex < slides.length - 1 && (
                <TouchableOpacity onPress={() => router.replace("/(auth)/role-select")} style={styles.skipButton}>
                    <Text style={styles.skipText}>Skip</Text>
                </TouchableOpacity>
            )}

            {/* Next / Get Started button at the bottom right with Glow */}
            <TouchableOpacity onPress={handleNext} activeOpacity={0.85} style={styles.nextButtonWrapper}>
                <Animated.View style={[
                    styles.nextButton,
                    {
                        transform: [{ scale: pulseAnim }],
                        // The opacity here interpolates perfectly so the glow expands smoothly
                        opacity: pulseAnim.interpolate({
                            inputRange: [1, 1.15],
                            outputRange: [1, 0.8],
                        }),
                        shadowRadius: pulseAnim.interpolate({
                            inputRange: [1, 1.15],
                            outputRange: [4, 15], // Expanding glow shadow
                        }),
                    }
                ]}>
                    <Text style={styles.buttonText}>{slides[currentIndex]?.cta}</Text>
                </Animated.View>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    skipButton: {
        position: "absolute",
        top: 60,
        right: 20,
        paddingVertical: 8,
        paddingHorizontal: 16,
        backgroundColor: "rgba(255, 255, 255, 0.8)",
        borderRadius: 20,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    nextButtonWrapper: {
        position: "absolute",
        bottom: 50,
        right: 20,
    },
    nextButton: {
        paddingVertical: 14,
        paddingHorizontal: 28,
        backgroundColor: "#1A7FD4", // Blue background
        borderRadius: 30,
        shadowColor: "#1A7FD4", // Blue glowing color
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        // shadowRadius is animated inline
        elevation: 8,
    },
    skipText: {
        color: "#1A7FD4",
        fontWeight: "800",
        fontSize: 16,
    },
    buttonText: {
        color: "#FFFFFF",
        fontWeight: "800",
        fontSize: 18,
    },
});
