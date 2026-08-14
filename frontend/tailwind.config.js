/** @type {import('tailwindcss').Config} */

// Los colores viven en variables CSS (tripletas "R G B") definidas en index.css.
// El modo noche solo reasigna esas variables: las clases `bg-ios-card`,
// `text-ios-label`, etc. no cambian en ninguna página.
const withVar = (name) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Acento de marca (índigo VestaApp), aclarado en modo noche.
        brand: {
          50: withVar("brand-50"),
          100: withVar("brand-100"),
          200: withVar("brand-200"),
          500: withVar("brand-500"),
          600: withVar("brand-600"),
          700: withVar("brand-700"),
        },
        // Paleta de sistema iOS: fondos agrupados, separadores y semánticos.
        ios: {
          bg: withVar("ios-bg"),               // systemGroupedBackground
          card: withVar("ios-card"),           // celda / tarjeta
          fill: withVar("ios-fill"),           // relleno de campos
          separator: withVar("ios-separator"), // hairline
          label: withVar("ios-label"),         // texto principal
          secondary: withVar("ios-secondary"), // texto secundario
          tertiary: withVar("ios-tertiary"),   // deshabilitado / chevrons
          blue: withVar("ios-blue"),
          green: withVar("ios-green"),
          red: withVar("ios-red"),
          orange: withVar("ios-orange"),
          yellow: withVar("ios-yellow"),
          purple: withVar("ios-purple"),
        },
      },
      fontFamily: {
        // SF Pro en dispositivos Apple; Inter como respaldo en el resto.
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "SF Pro Text",
          "SF Pro Display",
          "Segoe UI",
          "Inter",
          "system-ui",
          "sans-serif",
        ],
      },
      boxShadow: {
        // Sombras iOS: casi imperceptibles en tarjetas, profundas en overlays.
        ios: "0 1px 2px rgba(0,0,0,0.04), 0 1px 1px rgba(0,0,0,0.03)",
        "ios-md": "0 4px 16px rgba(0,0,0,0.06)",
        "ios-lg": "0 12px 40px rgba(0,0,0,0.14)",
      },
      keyframes: {
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
      },
      animation: {
        shimmer: "shimmer 1.5s infinite",
      },
    },
  },
  plugins: [],
};
