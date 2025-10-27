import React from 'react';

const Highlighter = ({ width = 24, height = 24 }: { width?: number; height?: number }) => (
  <svg width={width} height={height} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M3 16l5-5 5 5-5 5H3v-5zm13.71-9.71l1.29-1.29 3 3-1.29 1.29L16.71 6.29z"/>
  </svg>
);

export default Highlighter;
