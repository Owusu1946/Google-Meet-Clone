import React from 'react';

interface CheckProps {
  className?: string;
}

const Check = ({ className }: CheckProps) => {
  return (
    <i className={`material-symbols-outlined ${className || ''}`} aria-hidden="true">
      check
    </i>
  );
};

export default Check;
