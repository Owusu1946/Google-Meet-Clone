import React from 'react';

const Eraser = ({ width = 24, height = 24 }: { width?: number; height?: number }) => (
  <svg width={width} height={height} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M16.24 3.56a3 3 0 0 1 4.24 4.24l-8.49 8.49H7.05l-4.24-4.24L16.24 3.56zM3.53 14.12l3.54 3.54H2v-2h1.53z"/>
  </svg>
);

export default Eraser;
