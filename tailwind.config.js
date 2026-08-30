/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        floin: {
          bg: "#0a1018",
          bg2: "#0f1e2e",
          card: "#12233a",
          line: "#1e3a5a",
          accent: "#06b6d4",
          accent2: "#22d3ee",
        }
      }
    },
  },
  plugins: [],
}
