/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Premium White Industrial Operations Palette
        industrial: {
          50: '#F8F9FA',  // subtle surface / table header
          100: '#F1F3F5', // secondary surface / card hover
          200: '#E2E5E9', // primary border
          300: '#CBD0D7', // stronger border / divider
          400: '#98A2B3', // muted text
          500: '#667085', // secondary text
          600: '#475467', // subheader text
          700: '#344054', // body text
          800: '#1D2939', // titles
          900: '#111827', // deepest text
        },
        // Petroleum Accents (Deep Amber & Steel Blue)
        petro: {
          amber: '#D97706',
          gold: '#B45309',
          lightGold: '#FEF3C7',
          steel: '#1E40AF',
          cyan: '#0284C7',
          darkCyan: '#0369A1',
        },
        // Semantic & compatibility mappings for existing oil-* classes
        oil: {
          50: '#F8F9FA',
          100: '#F1F3F5',
          200: '#E2E5E9',
          300: '#CBD0D7',
          500: '#667085',
          700: '#344054',
          800: '#1D2939',
          900: '#111827',
          accent: '#D97706',
          amber: '#B45309',
          green: '#16A34A',
          red: '#DC2626',
          blue: '#2563EB',
          cyan: '#0284C7',
          purple: '#7C3AED',
          warning: '#D97706',
          critical: '#DC2626',
          healthy: '#16A34A',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'Courier New', 'monospace'],
      },
      borderRadius: {
        'xs': '4px',
        'sm': '6px',
        'DEFAULT': '8px',
        'md': '10px',
        'lg': '12px',
        'xl': '14px',
      },
      boxShadow: {
        'card': '0 1px 3px 0 rgba(16, 24, 40, 0.05), 0 1px 2px -1px rgba(16, 24, 40, 0.05)',
        'panel': '0 4px 6px -1px rgba(16, 24, 40, 0.06), 0 2px 4px -2px rgba(16, 24, 40, 0.04)',
      },
      animation: {
        'pulse-subtle': 'pulse 2.5s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      }
    },
  },
  plugins: [],
}
