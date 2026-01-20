/**
 * Badge Component
 * Small status or category indicator
 */

import { HTMLAttributes, ReactNode } from 'react';
import { clsx } from 'clsx';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
  children: ReactNode;
}

const variantStyles = {
  default: 'bg-slate-100 text-slate-700 border-slate-200',
  success: 'bg-green-100 text-green-700 border-green-200',
  warning: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  danger: 'bg-red-100 text-red-700 border-red-200',
  info: 'bg-blue-100 text-blue-700 border-blue-200',
};

export function Badge({ variant = 'default', children, className, ...props }: BadgeProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center px-2.5 py-0.5',
        'text-xs font-medium rounded-full border',
        variantStyles[variant],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
