// Harness replacement for Grafana font URLs. All Inter faces stay inside the bundle.
import font300normal from '@fontsource/inter/files/inter-latin-300-normal.woff2';
import font300italic from '@fontsource/inter/files/inter-latin-300-italic.woff2';
import font400normal from '@fontsource/inter/files/inter-latin-400-normal.woff2';
import font400italic from '@fontsource/inter/files/inter-latin-400-italic.woff2';
import font500normal from '@fontsource/inter/files/inter-latin-500-normal.woff2';
import font500italic from '@fontsource/inter/files/inter-latin-500-italic.woff2';
import font600normal from '@fontsource/inter/files/inter-latin-600-normal.woff2';
import font600italic from '@fontsource/inter/files/inter-latin-600-italic.woff2';

export const getFontStyles = () => [
  {
    '@font-face': {
      fontFamily: 'Inter',
      fontStyle: 'normal',
      fontWeight: 300,
      fontDisplay: 'swap',
      src: `url(${font300normal}) format('woff2')`,
    },
  },
  {
    '@font-face': {
      fontFamily: 'Inter',
      fontStyle: 'italic',
      fontWeight: 300,
      fontDisplay: 'swap',
      src: `url(${font300italic}) format('woff2')`,
    },
  },
  {
    '@font-face': {
      fontFamily: 'Inter',
      fontStyle: 'normal',
      fontWeight: 400,
      fontDisplay: 'swap',
      src: `url(${font400normal}) format('woff2')`,
    },
  },
  {
    '@font-face': {
      fontFamily: 'Inter',
      fontStyle: 'italic',
      fontWeight: 400,
      fontDisplay: 'swap',
      src: `url(${font400italic}) format('woff2')`,
    },
  },
  {
    '@font-face': {
      fontFamily: 'Inter',
      fontStyle: 'normal',
      fontWeight: 500,
      fontDisplay: 'swap',
      src: `url(${font500normal}) format('woff2')`,
    },
  },
  {
    '@font-face': {
      fontFamily: 'Inter',
      fontStyle: 'italic',
      fontWeight: 500,
      fontDisplay: 'swap',
      src: `url(${font500italic}) format('woff2')`,
    },
  },
  {
    '@font-face': {
      fontFamily: 'Inter',
      fontStyle: 'normal',
      fontWeight: 600,
      fontDisplay: 'swap',
      src: `url(${font600normal}) format('woff2')`,
    },
  },
  {
    '@font-face': {
      fontFamily: 'Inter',
      fontStyle: 'italic',
      fontWeight: 600,
      fontDisplay: 'swap',
      src: `url(${font600italic}) format('woff2')`,
    },
  },
];
