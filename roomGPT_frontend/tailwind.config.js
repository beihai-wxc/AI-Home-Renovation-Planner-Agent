/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./app/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      screens: {
        xs: "330px",
      },
      fontFamily: {
        sf: [
          "-apple-system",
          "BlinkMacSystemFont",
          "SF Pro Display",
          "SF Pro Text",
          "Helvetica Neue",
          "Helvetica",
          "Arial",
          "PingFang SC",
          "Hiragino Sans GB",
          "Microsoft YaHei",
          "sans-serif",
        ],
        "sf-rounded": [
          "ui-rounded",
          "-apple-system",
          "BlinkMacSystemFont",
          "SF Pro Rounded",
          "Helvetica Neue",
          "sans-serif",
        ],
      },
      colors: {
        apple: {
          black: "#1d1d1f",
          gray: {
            100: "#f5f5f7",
            200: "#e8e8ed",
            300: "#d2d2d7",
            400: "#86868b",
            500: "#6e6e73",
            600: "#424245",
          },
          blue: "#0071e3",
          "blue-hover": "#0077ed",
        },
      },
      fontSize: {
        "hero-xl": ["clamp(2.5rem, 8vw, 5rem)", { lineHeight: "1.05", letterSpacing: "-0.02em" }],
        "hero-lg": ["clamp(2rem, 5vw, 3.5rem)", { lineHeight: "1.1", letterSpacing: "-0.015em" }],
        "hero-md": ["clamp(1.5rem, 3vw, 2.5rem)", { lineHeight: "1.15", letterSpacing: "-0.01em" }],
      },
      spacing: {
        "section-sm": "4rem",
        "section-md": "6rem",
        "section-lg": "8rem",
        "section-xl": "10rem",
      },
      animation: {
        "fade-in": "fadeIn 0.8s ease-out forwards",
        "fade-in-up": "fadeInUp 0.8s ease-out forwards",
        "fade-in-down": "fadeInDown 0.8s ease-out forwards",
        "scale-in": "scaleIn 0.6s ease-out forwards",
        "slide-in-left": "slideInLeft 0.8s ease-out forwards",
        "slide-in-right": "slideInRight 0.8s ease-out forwards",
        float: "float 6s ease-in-out infinite",
        "pulse-soft": "pulseSoft 4s ease-in-out infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        fadeInUp: {
          "0%": { opacity: "0", transform: "translateY(30px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        fadeInDown: {
          "0%": { opacity: "0", transform: "translateY(-30px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        scaleIn: {
          "0%": { opacity: "0", transform: "scale(0.95)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        slideInLeft: {
          "0%": { opacity: "0", transform: "translateX(-50px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        slideInRight: {
          "0%": { opacity: "0", transform: "translateX(50px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-10px)" },
        },
        pulseSoft: {
          "0%, 100%": { opacity: "0.4" },
          "50%": { opacity: "0.8" },
        },
      },
      backdropBlur: {
        apple: "20px",
      },
      boxShadow: {
        apple: "0 4px 30px rgba(0, 0, 0, 0.1)",
        "apple-lg": "0 10px 60px rgba(0, 0, 0, 0.12)",
        "apple-xl": "0 20px 80px rgba(0, 0, 0, 0.15)",
      },
      borderRadius: {
        apple: "18px",
        "apple-lg": "24px",
        "apple-xl": "30px",
      },
    },
  },
  plugins: [require("@tailwindcss/forms"), require("@headlessui/tailwindcss")],
};
