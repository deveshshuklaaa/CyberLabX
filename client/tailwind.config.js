/** @type {import('tailwindcss').Config} */
export default { content: ['./index.html', './src/**/*.{ts,tsx}'], theme: { extend: { colors: { ink: '#0F172A', card: '#1E293B', line: '#334155', cyber: '#2563EB', cyan: '#06B6D4', success: '#10B981', danger: '#EF4444', warning: '#F59E0B', terminal: '#0B0F19' }, fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'], mono: ['JetBrains Mono', 'monospace'] } } }, plugins: [] };

