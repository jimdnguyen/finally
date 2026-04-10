import type { Config } from 'tailwindcss';

export default {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'dark-bg': '#0d1117',
        'dark-panel': '#161b22',
        'dark-border': '#30363d',
        'accent-yellow': '#ecad0a',
        'accent-blue': '#209dd7',
        'accent-purple': '#753991',
        'profit-green': '#3fb950',
        'loss-red': '#f85149',
      },
      fontFamily: {
        mono: ['Courier New', 'monospace'],
      },
    },
  },
} satisfies Config;
