/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // HF One brand burgundy — see /Users/nut/HF-erp/design/HF-ONE.md.
        // 50/100/300/500/600/700/800 are exact spec tokens; 200/400/900/950
        // are interpolated to keep the full Tailwind 11-step scale usable.
        primary: {
          50: '#FBEAEA',
          100: '#F5C9C9',
          200: '#E39898',
          300: '#C76060',
          400: '#A83333',
          500: '#8B0000',
          600: '#7A0000',
          700: '#6B1212',
          800: '#4F0E0E',
          900: '#3A0A0A',
          950: '#240606',
        },
        // Alias of `primary` under the spec's own name, so hardcoded
        // `blue-*` classes can be retinted to `brand-*` directly.
        brand: {
          50: '#FBEAEA',
          100: '#F5C9C9',
          200: '#E39898',
          300: '#C76060',
          400: '#A83333',
          500: '#8B0000',
          600: '#7A0000',
          700: '#6B1212',
          800: '#4F0E0E',
          900: '#3A0A0A',
          950: '#240606',
        },
        // HF One gold — 100/300/500/600/700 are exact spec tokens;
        // 50/200/400/800/900 are interpolated for scale completeness.
        gold: {
          50: '#FCF4E3',
          100: '#F6EACB',
          200: '#EEDBAA',
          300: '#E7C97F',
          400: '#DFB863',
          500: '#D9A441',
          600: '#B98730',
          700: '#93691F',
          800: '#6E4E17',
          900: '#4A340F',
        },
      },
      fontFamily: {
        sans: ['Sarabun', '"Noto Sans Thai"', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
  ],
}