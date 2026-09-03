/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Editorial Technical — light, near-monochrome ground with one cool accent.
        bg: {
          primary: '#fcfcfd',
          secondary: '#ffffff',
          tertiary: '#f8f9fb',
          panel: '#ffffff',
          elevated: '#ffffff',
          sunken: '#f4f5f7',
          paper: '#ffffff',
        },
        text: {
          primary: '#14171a',
          secondary: '#5a6069',
          muted: '#8b929b',
          dim: '#b0b6be',
        },
        accent: {
          primary: '#2b55c0',
          secondary: '#21449e',
          glow: '#5b7fd4',
          subtle: '#edf1fc',
        },
        // Overlay base. On a light ground surfaces darken rather than lighten,
        // so `bg-ink/[0.04]` replaces the old `bg-white/[0.04]`.
        ink: '#14171a',
        stroke: {
          drawing: '#2b55c0',
          active: '#2b55c0',
          accepting: '#177a4c',
          done: '#14171a',
        },
        border: {
          subtle: '#e5e7eb',
          default: '#d4d8de',
          strong: '#b9bfc8',
        },
      },
      fontFamily: {
        sans: ['IBM Plex Sans', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['IBM Plex Mono', 'ui-monospace', 'Menlo', 'monospace'],
        display: ['Newsreader', 'Georgia', 'Times New Roman', 'serif'],
      },
      borderRadius: {
        DEFAULT: '0.1875rem',
        md: '0.1875rem',
        lg: '0.25rem',
        xl: '0.25rem',
      },
      backgroundImage: {
        'dot-grid':
          'radial-gradient(circle, rgba(20,23,26,0.055) 1px, transparent 1px)',
      },
      backgroundSize: {
        'dot-grid': '24px 24px',
      },
      boxShadow: {
        'glow-purple': 'none',
        panel: 'none',
        sheet: '0 1px 2px rgba(20, 23, 26, 0.05)',
        focus: '0 0 0 3px #edf1fc',
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
