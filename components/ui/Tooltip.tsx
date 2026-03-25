'use client';
import { ReactNode } from 'react';

interface TooltipProps {
  content: string;
  children: ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

export function Tooltip({ content, children, position = 'top' }: TooltipProps) {
  const base =
    'absolute z-50 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 ' +
    'bg-gray-900 border border-gray-700 text-gray-200 text-xs rounded-lg px-2.5 py-1.5 whitespace-nowrap shadow-xl';

  // Arrow element classes and tooltip position classes
  let tooltipPos = '';
  let arrowPos = '';

  switch (position) {
    case 'bottom':
      tooltipPos = 'top-full mt-2 left-1/2 -translate-x-1/2';
      arrowPos =
        'absolute -top-1 left-1/2 -translate-x-1/2 w-0 h-0 ' +
        'border-l-[5px] border-l-transparent ' +
        'border-r-[5px] border-r-transparent ' +
        'border-b-[5px] border-b-gray-700';
      break;
    case 'left':
      tooltipPos = 'right-full mr-2 top-1/2 -translate-y-1/2';
      arrowPos =
        'absolute -right-1 top-1/2 -translate-y-1/2 w-0 h-0 ' +
        'border-t-[5px] border-t-transparent ' +
        'border-b-[5px] border-b-transparent ' +
        'border-l-[5px] border-l-gray-700';
      break;
    case 'right':
      tooltipPos = 'left-full ml-2 top-1/2 -translate-y-1/2';
      arrowPos =
        'absolute -left-1 top-1/2 -translate-y-1/2 w-0 h-0 ' +
        'border-t-[5px] border-t-transparent ' +
        'border-b-[5px] border-b-transparent ' +
        'border-r-[5px] border-r-gray-700';
      break;
    case 'top':
    default:
      tooltipPos = 'bottom-full mb-2 left-1/2 -translate-x-1/2';
      arrowPos =
        'absolute -bottom-1 left-1/2 -translate-x-1/2 w-0 h-0 ' +
        'border-l-[5px] border-l-transparent ' +
        'border-r-[5px] border-r-transparent ' +
        'border-t-[5px] border-t-gray-700';
      break;
  }

  return (
    <span className="relative inline-flex group">
      {children}
      <span className={`${base} ${tooltipPos}`}>
        <span className={arrowPos} />
        {content}
      </span>
    </span>
  );
}
