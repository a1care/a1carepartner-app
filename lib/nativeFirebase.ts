import { NativeModules } from "react-native";

export const getFirebaseMessaging = () => {
    try {
        if (!NativeModules.RNFBAppModule) return null;

        const appModule = require("@react-native-firebase/app").default;
        if (!appModule?.apps?.length) return null;

        return require("@react-native-firebase/messaging").default;
    } catch (error) {
        console.log("[Firebase] Messaging unavailable:", error);
        return null;
    }
};
