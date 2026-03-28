/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./app/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Playfair Display"', '"Noto Sans SC"', 'serif'],
        body: ['"Outfit"', '"Noto Sans SC"', 'system-ui', 'sans-serif'],
      },
      colors: {
        primary: {
          DEFAULT: '#fcf9f8', // 奶油色 - 页面背景
        },
        secondary: {
          DEFAULT: '#bdb3a5', // 莫兰迪棕 - 卡片/边框/中性文本
        },
        accent: {
          DEFAULT: '#4e3c30', // 深巧克力棕 - 导航栏/按钮/标题
          dark: '#3d2f26',
        },
        text: {
          primary: '#4e3c30', // 深色调 - 主体文本
          secondary: '#9f8370', // 辅助文本
          tertiary: '#bdb3a5',
        },
        surface: {
          1: '#fcf9f8',
          2: '#f7f3f0',
          3: '#f2ebe7',
        },
        border: {
          subtle: '#e8e4df',
          DEFAULT: '#d4cec5',
          strong: '#bdb3a5',
        },
      },
      borderRadius: {
        '4xl': '2rem',
        '5xl': '2.5rem',
      },
      boxShadow: {
        'soft': '0 4px 12px rgba(78, 60, 48, 0.08)',
        'soft-lg': '0 8px 24px rgba(78, 60, 48, 0.12)',
        'soft-xl': '0 16px 40px rgba(78, 60, 48, 0.16)',
      },
      screens: {
        xs: '330px',
      },
      spacing: {
        '18': '4.5rem',
        '22': '5.5rem',
        '128': '32rem',
      },
    },
  },
  plugins: [require('@tailwindcss/forms'), require('@headlessui/tailwindcss')],
};
