'use client';
import { ReactNode } from 'react';

interface TooltipProps {
  content: string;
  children: ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

export function Tooltip({ content, children, position = 'top' }: TooltipProps) {
  const tooltipBase =
    'absolute z-50 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 ' +
    'bg-gray-900 border border-gray-700 text-gray-200 text-xs rounded-lg px-2.5 py-1.5 whitespace-nowrap shadow-xl';

  let tooltipPos = '';

  switch (position) {
    case 'bottom':
      tooltipPos = 'top-full mt-2 left-1/2 -translate-x-1/2';
      break;
    case 'left':
      tooltipPos = 'right-full mr-2 top-1/2 -translate-y-1/2';
      break;
    case 'right':
      tooltipPos = 'left-full ml-2 top-1/2 -translate-y-1/2';
      break;
    case 'top':
    default:
      tooltipPos = 'bottom-full mb-2 left-1/2 -translate-x-1/2';
      break;
  }

  return (
    <span className="relative inline-block group leading-none">
      {children}
      <span className={`${tooltipBase} ${tooltipPos}`}>
        {content}
      </span>
    </span>
  );
}
