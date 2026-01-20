/**
 * Spinner Component
 * Loading indicator
 */

import { HTMLAttributes } from 'react';
import { clsx } from 'clsx';
import { Loader2 } from 'lucide-react';

interface SpinnerProps extends HTMLAttributes<HTMLDivElement> {
  size?: 'sm' | 'md' | 'lg';
}

const sizeStyles = {
  sm: 'w-4 h-4',
  md: 'w-6 h-6',
  lg: 'w-8 h-8',
};

export function Spinner({ size = 'md', className, ...props }: SpinnerProps) {
  return (
    <div className={clsx('flex items-center justify-center', className)} {...props}>
      <Loader2 className={clsx('animate-spin text-indigo-600', sizeStyles[size])} />
    </div>
  );
}
