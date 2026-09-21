/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./preview.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          '"Plus Jakarta Sans"',
          "Inter",
          '"Segoe UI Variable"',
          "system-ui",
          '"Microsoft YaHei"',
          "-apple-system",
          "sans-serif",
        ],
        mono: [
          '"JetBrains Mono"',
          '"Fira Code"',
          "Consolas",
          "monospace",
        ],
      },
      colors: {
        brand: {
          50: "#eff6ff",
          100: "#dbeafe",
          200: "#bfdbfe",
          300: "#93c5fd",
          400: "#60a5fa",
          500: "#3b82f6",
          600: "#2563eb",
          700: "#1d4ed8",
        },
      },
      boxShadow: {
        "subtle-sm": "0 1px 2px rgba(0, 0, 0, 0.04)",
        "subtle-card": "0 1px 3px rgba(0, 0, 0, 0.03), 0 4px 12px -2px rgba(0, 0, 0, 0.04)",
        "subtle-hover": "0 6px 20px -3px rgba(37, 99, 235, 0.09), 0 2px 6px -1px rgba(0, 0, 0, 0.04)",
        "subtle-modal": "0 20px 48px -8px rgba(15, 23, 42, 0.16), 0 4px 12px -2px rgba(15, 23, 42, 0.06)",
        "glow-brand": "0 0 0 1px rgba(37, 99, 235, 0.18), 0 4px 16px -2px rgba(37, 99, 235, 0.15)",
        "inner-light": "inset 0 1px 0 rgba(255, 255, 255, 0.9)",
      },
      transitionTimingFunction: {
        "spring": "cubic-bezier(0.16, 1, 0.3, 1)",
        "apple": "cubic-bezier(0.25, 1, 0.5, 1)",
      },
    },
  },
  plugins: [],
};
