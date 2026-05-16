/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["DM Sans", "system-ui", "sans-serif"],
        display: ["Instrument Serif", "Georgia", "serif"],
      },
      colors: {
        ink: {
          950: "#0c0f14",
          900: "#12171f",
          800: "#1a222d",
          700: "#243040",
        },
      },
      keyframes: {
        "pulse-ring": {
          "0%, 100%": { transform: "scale(1)", opacity: "0.45" },
          "50%": { transform: "scale(1.12)", opacity: "0.12" },
        },
        "pulse-ring-fast": {
          "0%, 100%": { transform: "scale(1)", opacity: "0.55" },
          "50%": { transform: "scale(1.18)", opacity: "0.08" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-8px)" },
        },
        "wave-bar": {
          "0%, 100%": { transform: "scaleY(0.3)" },
          "50%": { transform: "scaleY(1)" },
        },
        "wave-bar-fast": {
          "0%, 100%": { transform: "scaleY(0.2)" },
          "50%": { transform: "scaleY(1.15)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "200% center" },
          "100%": { backgroundPosition: "-200% center" },
        },
        "blob-drift": {
          "0%, 100%": { transform: "translate(0, 0) scale(1)" },
          "33%": { transform: "translate(24px, -18px) scale(1.05)" },
          "66%": { transform: "translate(-16px, 12px) scale(0.96)" },
        },
        "spin-slow": {
          from: { transform: "rotate(0deg)" },
          to: { transform: "rotate(360deg)" },
        },
        "fade-up": {
          from: { opacity: "0", transform: "translateY(24px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "glow-pulse": {
          "0%, 100%": { opacity: "0.5" },
          "50%": { opacity: "1" },
        },
        "wave-curve-1": {
          "0%, 100%": { transform: "translateX(0) translateY(0)" },
          "50%": { transform: "translateX(-2.5%) translateY(-8px)" },
        },
        "wave-curve-2": {
          "0%, 100%": { transform: "translateX(0) translateY(0)" },
          "50%": { transform: "translateX(2%) translateY(6px)" },
        },
        "wave-curve-3": {
          "0%, 100%": { transform: "translateX(0)" },
          "50%": { transform: "translateX(-1.5%)" },
        },
      },
      animation: {
        "pulse-ring": "pulse-ring 3s ease-in-out infinite",
        "pulse-ring-fast": "pulse-ring-fast 1.4s ease-in-out infinite",
        float: "float 4s ease-in-out infinite",
        "wave-bar": "wave-bar 1.2s ease-in-out infinite",
        "wave-bar-fast": "wave-bar-fast 0.65s ease-in-out infinite",
        shimmer: "shimmer 6s linear infinite",
        "blob-drift": "blob-drift 18s ease-in-out infinite",
        "spin-slow": "spin-slow 24s linear infinite",
        "fade-up": "fade-up 0.7s cubic-bezier(0.22, 1, 0.36, 1) forwards",
        "glow-pulse": "glow-pulse 2.5s ease-in-out infinite",
        "wave-curve-1": "wave-curve-1 14s ease-in-out infinite",
        "wave-curve-2": "wave-curve-2 18s ease-in-out infinite",
        "wave-curve-3": "wave-curve-3 22s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
