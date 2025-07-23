module.exports = {
  content: [
    "./popup.tsx",
    "./components/**/*.{ts,tsx}",
    "./styles/**/*.css"
  ],
  theme: {
    extend: {
      colors: {
        'white': {
          DEFAULT: '#edf1f5',
          100: '#ffffff',
        },
        'blue': '#3db4f2',
        'purple': '#b368e6',
        'green': '#4abd4e',
        'orange': '#ef881a',
        'red': '#e13333',
        'pink': '#e85fb2',
        'gray': '#677b94',
      },
    },
  },
  plugins: [],
}