import type { ButtonHTMLAttributes } from 'react';

// primary/ghost/outline: dùng cho Reader (theo data-theme).
// solid/hairline: editorial, palette cố định cho browse/chrome.
type Variant = 'primary' | 'ghost' | 'outline' | 'solid' | 'hairline';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

const base =
  'inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium transition-[background-color,transform,opacity,border-color] duration-150 disabled:opacity-50 disabled:pointer-events-none';

const variants: Record<Variant, string> = {
  primary: 'rounded-lg bg-accent text-[var(--bg)] hover:opacity-90',
  ghost: 'rounded-lg text-text hover:bg-surface',
  outline: 'rounded-lg border border-border text-text hover:bg-surface',
  solid: 'rounded-md bg-ink-strong text-white hover:bg-[#333333] active:scale-[0.98]',
  hairline:
    'rounded-md border border-hairline text-ink hover:bg-canvas active:scale-[0.98]',
};

export function Button({
  variant = 'primary',
  className = '',
  ...props
}: ButtonProps) {
  return (
    <button
      className={`${base} ${variants[variant]} ${className}`}
      {...props}
    />
  );
}
