/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
    '../../packages/ui-native/src/**/*.{ts,tsx}'
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        bg: '#FBF7F1',
        surface: '#FFFFFF',
        surface2: '#F4EFE6',
        ink: '#1F1B16',
        ink2: '#4A4239',
        muted: '#7A6F62',
        faint: '#A89E91',
        sage: '#6E8C5A',
        sageSoft: '#E7EFDD',
        sageInk: '#3F5733',
        amber: '#C8761F',
        amberSoft: '#F8E9D2',
        amberInk: '#8A4F12',
        terra: '#B5482F',
        terraSoft: '#F4D9CF',
        terraInk: '#7E2D1A',
        blue: '#3F6E89',
        blueSoft: '#DDE8EF',
        blueInk: '#2A4D63',
        plum: '#7A4E6B',
        plumSoft: '#EEDDE7',
        plumInk: '#5C3550'
      }
    }
  },
  plugins: []
};
