import React from 'react';

interface BrandLogoProps {
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
  className?: string;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({
  size = 'md',
  className = '',
}) => {
  const sizeClass =
    size === 'sm'
      ? 'h-9 w-auto'
      : size === 'lg'
        ? 'w-56 sm:w-64 h-auto'
        : 'h-11 w-auto';

  return (
    <div className={`inline-flex items-center select-none ${className}`}>
      <img
        src="/assets/inside-ecobag-logo.png"
        alt="Inside Ecobag"
        draggable={false}
        className={`${sizeClass} object-contain select-none pointer-events-none shrink-0`}
      />
    </div>
  );
};
