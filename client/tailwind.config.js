/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: '#A02929',
        'brand-dark': '#802121',
        accent: '#ED1C24',
        canvas: '#F5F5F5',
        surface: '#FFFFFF',
        ink: '#212121',
        muted: '#857A7A',
        line: '#D3D3D3',
        success: '#288B08',
        danger: '#B7202E',
        link: '#094F9F',
        footer: '#00397A',
        'footer-text': '#E7F0FA',
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
