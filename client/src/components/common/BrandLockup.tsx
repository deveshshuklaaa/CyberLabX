import React from 'react';
import { Link } from 'react-router-dom';

interface BrandLockupProps {
  size?: 'sm' | 'md' | 'lg';
  variant?: 'light' | 'dark';
  clickable?: boolean;
}

export const BrandLockup: React.FC<BrandLockupProps> = ({
  size = 'md',
  variant = 'light',
  clickable = true,
}) => {
  const logoHeight =
    size === 'sm' ? 'h-9 sm:h-10' : size === 'lg' ? 'h-14 sm:h-16' : 'h-11 sm:h-12';
  const titleSize =
    size === 'sm' ? 'text-sm sm:text-base' : size === 'lg' ? 'text-xl sm:text-2xl' : 'text-base sm:text-lg';
  const subtitleSize =
    size === 'sm' ? 'text-[10px]' : size === 'lg' ? 'text-xs' : 'text-[11px] sm:text-xs';

  const isDark = variant === 'dark';

  const content = (
    <div className="flex min-w-0 items-center gap-3 group">
      <img
        src="/assets/somaiya-emblem.png"
        alt="Somaiya Vidyavihar University"
        className={`${logoHeight} w-auto object-contain shrink-0`}
      />
      <div className="flex min-w-0 flex-col justify-center leading-tight">
        <span
          className={`font-black tracking-wider uppercase font-sans ${
            isDark ? 'text-white' : 'text-[#A8002C]'
          } ${titleSize}`}
        >
          SOMAIYA <span className={isDark ? 'text-white/90' : 'text-[#222222]'}>VIRTUAL LABS</span>
        </span>
        <span
          className={`font-medium tracking-wide uppercase ${
            isDark ? 'text-white/70' : 'text-[#666666]'
          } ${subtitleSize}`}
        >
          Somaiya Vidyavihar University
        </span>
      </div>
    </div>
  );

  if (clickable) {
    return (
      <Link to="/" className="inline-flex min-w-0 items-center focus:outline-none focus:ring-2 focus:ring-brand/40 rounded-sm">
        {content}
      </Link>
    );
  }

  return content;
};
