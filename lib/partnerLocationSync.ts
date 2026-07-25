import * as Location from "expo-location";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { api } from "./api";

/** Sync partner GPS to the server so broadcast feed geo-filtering works in APK. */
export async function syncPartnerLocation(isOnline = true) {
    try {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status !== "granted") return null;

        let loc = await Location.getLastKnownPositionAsync();
        if (!loc) {
            loc = await Promise.race([
                Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
                new Promise<null>((resolve) => setTimeout(() => resolve(null), 4000)),
            ]);
        }
        if (!loc) return null;

        const coords = {
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
            heading: loc.coords.heading,
            speed: loc.coords.speed,
        };

        await AsyncStorage.setItem("last_location", JSON.stringify(coords));
        await api.post("/appointment/location/update", { ...coords, isOnline });
        return coords;
    } catch (err) {
        console.log("[Location] Global sync failed:", err);
        return null;
    }
}
