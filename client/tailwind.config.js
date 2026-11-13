/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  corePlugins: {
    // Avoid resetting existing elements so custom CSS classes keep their appearance
    preflight: false,
  },
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#0284c7",
          hover: "#0369a1",
          light: "#f0f9ff",
        },
        teal: {
          DEFAULT: "#0d9488",
          hover: "#0f766e",
          light: "#f0fdfa",
        },
      },
    },
  },
  plugins: [],
}



