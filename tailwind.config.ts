import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#070a0d",
        panel: "#0d1117",
        line: "#2e3a46",
        mint: "#23f7b6",
        coral: "#ff5d72",
        amber: "#f6b94a",
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "Inter", "sans-serif"],
        mono: ["var(--font-geist-mono)", "JetBrains Mono", "monospace"],
      },
      boxShadow: {
        glow: "0 0 24px rgba(35,247,182,.10)",
      },
    },
  },
  plugins: [],
} satisfies Config;
