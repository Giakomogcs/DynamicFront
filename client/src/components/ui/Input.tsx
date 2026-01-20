/**
 * Input Component
 * Professional text input with label and error states
 */

import { InputHTMLAttributes, ReactNode } from 'react';
import { clsx } from 'clsx';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

export function Input({
  label,
  error,
  helperText,
  leftIcon,
  rightIcon,
  className,
  ...props
}: InputProps) {
  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-slate-700 mb-1.5">
          {label}
        </label>
      )}

      <div className="relative">
        {leftIcon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
            {leftIcon}
          </div>
        )}

        <input
          className={clsx(
            'w-full px-4 py-2 text-base',
            'bg-white border border-slate-300 rounded-lg',
            'placeholder:text-slate-400',
            'focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent',
            'disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed',
            'transition-all duration-200',
            error && 'border-red-500 focus:ring-red-500',
            leftIcon && 'pl-10',
            rightIcon && 'pr-10',
            className
          )}
          {...props}
        />

        {rightIcon && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
            {rightIcon}
          </div>
        )}
      </div>

      {error && (
        <p className="mt-1.5 text-sm text-red-600">{error}</p>
      )}

      {helperText && !error && (
        <p className="mt-1.5 text-sm text-slate-500">{helperText}</p>
      )}
    </div>
  );
}
