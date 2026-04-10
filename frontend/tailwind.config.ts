import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        base: '#0d1117',
        panel: '#161b22',
        'accent-yellow': '#ecad0a',
        'blue-primary': '#209dd7',
        'purple-submit': '#753991',
        'green-up': '#22c55e',
        'red-down': '#ef4444',
      },
    },
  },
  plugins: [],
}
export default config
