/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'bg-deep': '#071226',
        'editor-bg': '#0b1116',
        'panel-fill': 'rgba(15, 23, 32, 0.6)', // #0f1720 with some transparency
        'glass-border': 'rgba(255, 255, 255, 0.03)',
        'accent': {
          DEFAULT: '#19A7F9',
          'darker': '#0ea5d9',
        },
        'muted': '#94A3B8',
        'success': '#16A34A',
        'error': '#EF4444',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'Menlo', 'monospace'],
      },
      borderRadius: {
        'lg': '12px',
        'md': '8px',
      },
      boxShadow: {
        'card': '0 10px 30px rgba(2,6,23,0.6)',
        'editor-inner': 'inset 0 10px 30px rgba(0,0,0,0.55)',
      },
      keyframes: {
        'pulse-ring': {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(25, 167, 249, 0.3)' },
          '70%': { boxShadow: '0 0 0 10px rgba(25, 167, 249, 0)' },
        }
      },
      animation: {
        'pulse-ring': 'pulse-ring 2s cubic-bezier(0.2, 0.9, 0.3, 1) infinite',
      }
    },
  },
  plugins: [],
}