/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        bg:      '#0d1117',
        surface: '#161b22',
        card:    '#1c2128',
        border:  '#30363d',
        profit:  '#3fb950',
        loss:    '#f85149',
        warn:    '#d29922',
        accent:  '#388bfd',
        muted:   '#8b949e',
        subtle:  '#6e7681',
      },
    },
  },
  plugins: [],
}
