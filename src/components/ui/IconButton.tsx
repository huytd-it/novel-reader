import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string; // bắt buộc — accessibility
  children: ReactNode;
}

export function IconButton({
  label,
  className = '',
  children,
  ...props
}: IconButtonProps) {
  return (
    <button
      aria-label={label}
      title={label}
      className={`inline-flex h-10 w-10 items-center justify-center rounded-full text-text transition-colors duration-150 hover:bg-surface disabled:opacity-40 ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
