import React from 'react';

const Redo = ({ width = 18, height = 18 }: { width?: number; height?: number }) => (
  <svg width={width} height={height} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 5V2l6 6-6 6V9c-3.31 0-6 2.69-6 6 0 3.31 2.69 6 6 6h6v2h-6c-4.42 0-8-3.58-8-8s3.58-8 8-8z"/>
  </svg>
);

export default Redo;
