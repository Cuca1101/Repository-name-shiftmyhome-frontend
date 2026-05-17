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
      boxShadow: {
        card: '0 4px 6px -1px rgb(0 0 0 / 0.06), 0 2px 4px -2px rgb(0 0 0 / 0.06)',
        'card-hover': '0 10px 15px -3px rgb(0 0 0 / 0.08), 0 4px 6px -4px rgb(0 0 0 / 0.06)',
        premium: '0 8px 30px -8px rgb(0 13 38 / 0.12), 0 4px 12px -4px rgb(0 13 38 / 0.08)',
      },
      backgroundImage: {
        'brand-gradient': 'linear-gradient(135deg, #2563eb 0%, #3b82f6 50%, #60a5fa 100%)',
      },
    },
  },
  plugins: [],
}
