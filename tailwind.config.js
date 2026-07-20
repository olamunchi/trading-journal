/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        bg:          '#0b0d16',
        surface:     '#10131f',
        card:        '#161a2b',
        border:      '#262b41',
        profit:      '#34d399',
        loss:        '#dc3d51',
        warn:        '#e8a33d',
        accent:      '#7c5cfa',
        accentHover: '#8f73ff',
        muted:       '#8b93b0',
        subtle:      '#5e6584',
      },
      fontFamily: {
        sans: ['"Inter Variable"', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(0,0,0,0.3), 0 4px 16px -8px rgba(0,0,0,0.4)',
      },
    },
  },
  plugins: [],
}
