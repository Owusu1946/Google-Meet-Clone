import React from 'react';

const Undo = ({ width = 18, height = 18 }: { width?: number; height?: number }) => (
  <svg width={width} height={height} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 5V2L6 8l6 6V9c3.31 0 6 2.69 6 6 0 3.31-2.69 6-6 6H6v2h6c4.42 0 8-3.58 8-8s-3.58-8-8-8z"/>
  </svg>
);

export default Undo;
