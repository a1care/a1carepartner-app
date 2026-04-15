/** @type {import('tailwindcss').Config} */
module.exports = {
    content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
    presets: [require("nativewind/preset")],
    theme: {
        extend: {
            colors: {
                brand: {
                    DEFAULT: "#1A7FD4",
                    light: "#4BA3E3",
                    dark: "#0D5FA0",
                },
                accent: "#27AE60",
                surface: "#EBF5FB",
                card: "#FFFFFF",
            },
            fontFamily: {
                sans: ["Inter_400Regular"],
                medium: ["Inter_500Medium"],
                semibold: ["Inter_600SemiBold"],
                bold: ["Inter_700Bold"],
                black: ["Inter_900Black"],
            },
        },
    },
    plugins: [],
};
