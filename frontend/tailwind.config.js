/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // DESIGN.md Tokens
        notion: {
          blue: '#0075de',
          paper: '#f6f5f4',
          white: '#ffffff',
          ink: '#000000',
          charcoal: '#111111',
          stone: '#757575',
          graphite: '#615d59',
          slate: '#696969',
          skyTint: '#e6f3fe',
          marigold: '#ffb110',
          coral: '#f64932',
          saffron: '#e89d01',
          signalBlue: '#097fe8',
          skyWash: '#62aef0',
          midnight: '#02093a',
          peach: '#f6d5b8',
        },
        zinc: {
          950: '#09090b',
          900: '#18181b',
          850: '#202023',
          800: '#27272a',
          700: '#3f3f46',
          600: '#52525b',
          500: '#71717a',
          400: '#a1a1aa',
          300: '#d4d4d8',
          200: '#e4e4e7',
          100: '#f4f4f5',
          50: '#fafafa',
        },
        adavya: {
          primary: '#0075de',
          primaryHover: '#0062be',
        },
      },
      boxShadow: {
        'notion-nav': '0px 0.7px 1.462px 0px rgba(0, 0, 0, 0.015), 0px 3px 9px 0px rgba(0, 0, 0, 0.03)',
        'notion-mockup': '0px 4px 12px rgba(0, 0, 0, 0.1)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      borderRadius: {
        'notion-card': '12px',
        'notion-btn': '8px',
        'notion-pill': '9999px',
        'notion-sm': '4px',
      },
    },
  },
  plugins: [],
}
