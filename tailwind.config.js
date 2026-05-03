/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,jsx}',
    './public/assets/style.css',
  ],
  safelist: [
    'bg-yellow-300', 'bg-red-300', 'bg-green-300', 'bg-blue-300',
    'bg-purple-300', 'bg-pink-300', 'bg-orange-300', 'bg-teal-300',
    'bg-gray-300', 'bg-white', 'text-black',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
