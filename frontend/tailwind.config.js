/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Colores de marca USC
        "usc-navy": "#0D2B5E",
        "usc-blue": "#1B6BB5",
        "usc-gold": "#C9A840",
        "usc-gold-light": "#F0D269",
        // Neutros
        "text-dark": "#1A2A4A",
        "gray-500": "#64748B",
        "gray-200": "#E2E8F0",
        "gray-50": "#F4F6FA",
        // Semánticos
        success: "#16A34A",
        warning: "#F59E0B",
        error: "#DC2626",
        info: "#0284C7",
        neutral: "#64748B",
      },
    },
  },
  plugins: [],
};
