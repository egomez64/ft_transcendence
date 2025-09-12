//const { transform } = require('typescript');

/** @type {import('tailwindcss').Config} */
//module.exports = {
//  content: [
//    './index.html',
//    './src/**/*.{html,ts,js}',
//    './src/pages/**/*.html',
/*  ],
  theme: {
    extend: {
        keyframes: {
          float: {
            '0%, 100%': {transform: 'translateY(0)'},
            '50%': { transform: 'translateY(-10px)'}, 
          },
        },
        animation: {
          'slow-float': 'float 12s ease-in-out infinite',
        },
    },
  },
  plugins: [],
  safelist: [
    'blur-3xl',
    'mix-blend-screen',
    'shadow-[0_0_100px_30px_ff#1493',
    'bg-gradient-to-b',
    'from-[#ff6b00]',
    'via-[#ff1493]',
    'to-[#8b008b]',
    'animate-slow-float'
  ]
}*/

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './index.html',
    './src/**/*.{html,ts,js}',
    './src/pages/**/*.html',
  ],
  safelist: [
    'blur-3xl',
    'mix-blend-screen',
    'shadow-[0_0_100px_30px_#ff1493]',
    'bg-gradient-to-b',
    'from-[#ff6b00]',
    'via-[#ff1493]',
    'to-[#8b008b]',
    'animate-slow-float',
    'bg-[linear-gradient(to_right,#ff149333_1px,transparent_1px),linear-gradient(to_bottom,#ff149333_1px,transparent_1px)]'
  ],
  theme: {
    extend: {
      colors: {
        synthPink: '#ff00cc',
        synthCyan: '#00ffff',
        },
      boxShadow: {
        neon: '0 0 10px #ff00cc, 0 0 20px #00ffff',
        },
      keyframes: {
        'pulse-neon' : {
          '0%, 100%': { opacity : '1', filter: 'drop-shadow(0 0 8px #ff00c8)' },
          '50%': {opacity: '0.7', filter: 'drop-shadow(0 0 15px #00ffd5)' },    
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
      },
      animation: {
        'slow-float': 'float 12s ease-in-out infinite',
        'pulse-neon': 'pulse-neon 2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
