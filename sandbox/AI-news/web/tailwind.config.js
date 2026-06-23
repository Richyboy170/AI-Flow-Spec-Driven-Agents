/** @type {import('tailwindcss').Config} */
export default {
  // Dark-only product: force the dark variant on at the root.
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          'Inter',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
        mono: [
          'ui-monospace',
          'SFMono-Regular',
          'Menlo',
          'Consolas',
          'Liberation Mono',
          'monospace',
        ],
      },
      colors: {
        // Slate-based OLED-friendly palette (matches the contract's dark aesthetic).
        ink: {
          950: '#0b1120',
          900: '#0f172a',
          850: '#131c31',
          800: '#1e293b',
          700: '#334155',
          600: '#475569',
        },
        accent: {
          // "code dark + run green"
          DEFAULT: '#22c55e',
          soft: 'rgba(34, 197, 94, 0.12)',
        },
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '-468px 0' },
          '100%': { backgroundPosition: '468px 0' },
        },
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        shimmer: 'shimmer 1.4s ease infinite linear',
        'fade-in': 'fade-in 0.25s ease-out both',
      },
    },
  },
  plugins: [],
}
