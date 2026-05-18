/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: {
          primary: '#0b0b0d',
          secondary: '#101013',
          tertiary: '#16161a',
          panel: '#1a1a1f',
          elevated: '#1f1f25',
          paper: '#ffffff',
        },
        text: {
          primary: '#f4f4f5',
          secondary: 'rgba(244, 244, 245, 0.65)',
          muted: 'rgba(244, 244, 245, 0.45)',
          dim: 'rgba(244, 244, 245, 0.30)',
        },
        accent: {
          primary: '#7c5cff',
          secondary: '#9d7eff',
          glow: '#a18aff',
          subtle: 'rgba(124, 92, 255, 0.10)',
        },
        stroke: {
          drawing: '#ef4444',
          active: '#3b82f6',
          accepting: '#10b981',
          done: '#1f2937',
        },
        border: {
          subtle: 'rgba(255, 255, 255, 0.06)',
          default: 'rgba(255, 255, 255, 0.10)',
          strong: 'rgba(255, 255, 255, 0.16)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Menlo', 'monospace'],
      },
      borderRadius: {
        DEFAULT: '0.5rem',
      },
      backgroundImage: {
        'dot-grid':
          'radial-gradient(circle, rgba(255,255,255,0.035) 1px, transparent 1px)',
      },
      backgroundSize: {
        'dot-grid': '24px 24px',
      },
      boxShadow: {
        'glow-purple': 'none',
        'panel': 'none',
        'focus': '0 0 0 3px rgba(255, 255, 255, 0.08)',
      },
      transitionTimingFunction: {
        'out-quart': 'cubic-bezier(0.25, 1, 0.5, 1)',
      },
      transitionDuration: {
        DEFAULT: '150ms',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
    },
  },
  plugins: [],
};
