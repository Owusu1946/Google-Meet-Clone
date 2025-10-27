import React from 'react';

const Brush = ({ width = 24, height = 24 }: { width?: number; height?: number }) => (
  <svg
    width={width}
    height={height}
    viewBox="0 0 24 24"
    fill="currentColor"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M7 16c.55 0 1 .45 1 1 0 2.21-1.79 4-4 4-.55 0-1-.45-1-1 0-2.21 1.79-4 4-4zm13.71-12.29a.996.996 0 0 0-1.41 0l-7.34 7.34c-.2.2-.33.45-.38.73l-.3 1.52c-.06.33.22.61.55.55l1.52-.3c.28-.05.53-.18.73-.38l7.34-7.34c.39-.39.39-1.02-.01-1.41z"/>
  </svg>
);

export default Brush;
