import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        stocklana: {
          bg: "#09131F",
          card: "#111D2B",
          border: "#2B3A4B",
          accent: "#7DA2F8",
          purple: "#E0B96A",
          blue: "#6BAED6",
          muted: "#A8B3C2",
        },
        discovery: {
          accent: "#B28CFF",
          light: "#C9B2FF",
          surface: "#171C31",
          border: "#4A3D68",
        },
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-jetbrains)", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      boxShadow: {
        terminal:
          "0 18px 60px rgba(2, 8, 16, 0.22), inset 0 1px 0 rgba(255, 255, 255, 0.035)",
        brand:
          "0 24px 80px rgba(2, 8, 16, 0.34), inset 0 1px 0 rgba(255, 255, 255, 0.05)",
      },
    },
  },
  plugins: [],
};
export default config;
