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
    },
  },
  plugins: [],
};
