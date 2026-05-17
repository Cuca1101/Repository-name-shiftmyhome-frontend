/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      screens: {
        xxs: '360px',
        xs: '390px',
        ph: '414px',
        mb: '512px',
      },
      colors: {
        navy: {
          DEFAULT: '#000D26',
          800: '#001233',
          900: '#000D26',
        },
        surface: {
          muted: '#F4F6F9',
        },
        brand: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
          950: '#172554',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'Segoe UI', 'sans-serif'],
      },
      maxWidth: {
        site: '82rem',
      },
      boxShadow: {
        card: '0 2px 8px -2px rgb(0 13 38 / 0.08), 0 1px 3px rgb(0 13 38 / 0.06)',
        'card-hover':
          '0 12px 28px -8px rgb(37 99 235 / 0.18), 0 8px 16px -6px rgb(0 13 38 / 0.1)',
        premium: '0 4px 20px -4px rgb(0 13 38 / 0.1), 0 2px 8px -2px rgb(0 13 38 / 0.06)',
        nav: '0 4px 24px -4px rgb(0 0 0 / 0.35)',
      },
      backgroundImage: {
        'brand-gradient': 'linear-gradient(135deg, #1d4ed8 0%, #2563eb 45%, #3b82f6 100%)',
        'brand-gradient-hover': 'linear-gradient(135deg, #1e40af 0%, #1d4ed8 50%, #2563eb 100%)',
      },
      transitionTimingFunction: {
        premium: 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
    },
  },
  plugins: [],
}
