/** @type {import('tailwindcss').Config} */
/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  darkMode: 'class', // <-- Tambahkan ini
  theme: {
    extend: {
      colors: {
        canvas: "rgb(var(--color-canvas) / <alpha-value>)",
        surface: "rgb(var(--color-surface) / <alpha-value>)",
        "surface-alt": "rgb(var(--color-surface-alt) / <alpha-value>)",
        border: "rgb(var(--color-border) / <alpha-value>)",
        "border-strong": "rgb(var(--color-border-strong) / <alpha-value>)",
        ink: "rgb(var(--color-ink) / <alpha-value>)",
        "ink-soft": "rgb(var(--color-ink-soft) / <alpha-value>)",
        "ink-faint": "rgb(var(--color-ink-faint) / <alpha-value>)",
        lime: {
          DEFAULT: "rgb(var(--color-lime) / <alpha-value>)",
          dark: "rgb(var(--color-lime-dark) / <alpha-value>)",
          ink: "rgb(var(--color-lime-ink) / <alpha-value>)",
        },
        indigo: {
          DEFAULT: "rgb(var(--color-indigo) / <alpha-value>)",
          soft: "rgb(var(--color-indigo-soft) / <alpha-value>)",
        },
        up: "rgb(var(--color-up) / <alpha-value>)",
        down: "rgb(var(--color-down) / <alpha-value>)",
      },
      fontFamily: {
        display: ["'Space Grotesk'", "sans-serif"],
        sans: ["'Inter'", "sans-serif"],
        mono: ["'JetBrains Mono'", "monospace"],
      },
      borderRadius: {
        xl2: "1.25rem",
      },
      boxShadow: {
        card: "0 1px 2px rgba(19, 21, 26, 0.04), 0 8px 24px -12px rgba(19, 21, 26, 0.10)",
        popover: "0 12px 32px -8px rgba(19, 21, 26, 0.18)",
      },
    },
  },
  plugins: [],
};
