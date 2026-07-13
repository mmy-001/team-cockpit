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
        notion: {
          bg: '#ffffff',
          fg: '#37352f',
          gray: '#f7f6f3',
          border: '#e3e2e0',
          hover: '#efefef',
          blue: '#2383e2',
          green: '#057642',
          red: '#d44c47',
          yellow: '#f5c258',
        }
      }
    },
  },
  plugins: [],
};
export default config;
