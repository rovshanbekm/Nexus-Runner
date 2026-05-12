import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-space)", "Inter", "system-ui", "sans-serif"]
      },
      boxShadow: {
        glow: "0 0 36px rgba(45, 212, 191, 0.25)"
      }
    }
  },
  plugins: []
};

export default config;
