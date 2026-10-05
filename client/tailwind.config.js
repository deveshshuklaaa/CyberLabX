/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: '#A8002C',
        'brand-dark': '#7F0022',
        'brand-light': '#C8102E',
        accent: '#C8102E',
        canvas: '#F7F7F7',
        surface: '#FFFFFF',
        ink: '#222222',
        muted: '#666666',
        line: '#E1E1E1',
        success: '#288B08',
        danger: '#B7202E',
        link: '#094F9F',
        footer: '#4A0013',
        'footer-dark': '#38000E',
        'footer-text': '#F3ECEE',
        terminal: '#0B0F19',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
};
