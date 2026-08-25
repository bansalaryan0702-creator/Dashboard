import React from 'react';

interface PrintFieldLogoProps {
  className?: string;
  iconSize?: 'sm' | 'md' | 'lg' | 'xl';
  layout?: 'horizontal' | 'vertical' | 'icon-only';
  textColor?: string;
  variant?: 'light' | 'dark';
}

export default function PrintFieldLogo({
  className = '',
  iconSize = 'md',
  layout = 'horizontal',
  textColor,
  variant = 'light'
}: PrintFieldLogoProps) {
  const sizeClasses = {
    sm: 'max-h-8 h-8',
    md: 'max-h-12 h-12',
    lg: 'max-h-20 h-20',
    xl: 'max-h-28 h-28'
  };
  const selectedSizeClass = sizeClasses[iconSize];
  
  const isDark = variant === 'dark';
  const filterClass = isDark ? 'brightness-0 invert' : '';

  return (
    <div className={`flex items-center justify-center ${className}`}>
      <img
        src="/logo.png"
        alt="PrintField Logo"
        className={`${selectedSizeClass} w-auto object-contain flex-shrink-0 ${filterClass}`}
      />
    </div>
  );
}
