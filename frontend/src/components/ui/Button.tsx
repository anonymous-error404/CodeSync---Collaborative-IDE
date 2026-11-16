import { Loader2 } from 'lucide-react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'ghost' | 'danger' | 'subtle';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  fullWidth?: boolean;
  children: ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  fullWidth = false,
  children,
  disabled,
  className = '',
  style,
  ...props
}: ButtonProps) {
  const base =
    'inline-flex items-center justify-center gap-2 font-semibold transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer select-none whitespace-nowrap border';

  const sizeClasses: Record<string, string> = {
    sm: 'text-xs px-3 py-1.5 h-7 rounded-md',
    md: 'text-sm px-4 py-2 h-9 rounded-lg',
    lg: 'text-sm px-5 py-2.5 h-11 rounded-xl',
  };

  const variantStyles: Record<string, React.CSSProperties> = {
    primary: {
      background: 'var(--accent)',
      color: 'var(--accent-fg)',
      borderColor: 'var(--accent)',
      boxShadow: '0 1px 4px rgba(232,66,12,0.25)',
    },
    ghost: {
      background: 'transparent',
      color: 'var(--text)',
      borderColor: 'var(--border)',
    },
    danger: {
      background: 'var(--error)',
      color: '#ffffff',
      borderColor: 'var(--error)',
    },
    subtle: {
      background: 'var(--surface-2)',
      color: 'var(--text)',
      borderColor: 'var(--border)',
    },
  };

  const hoverBg: Record<string, string> = {
    primary: 'var(--accent-hover)',
    ghost: 'var(--surface-2)',
    danger: '#b91c1c',
    subtle: 'var(--surface)',
  };

  return (
    <button
      disabled={disabled ?? isLoading}
      className={`${base} ${sizeClasses[size]} ${fullWidth ? 'w-full' : ''} ${className}`}
      style={{ ...variantStyles[variant], ...style }}
      onMouseEnter={e => {
        const btn = e.currentTarget as HTMLButtonElement;
        btn.style.background = hoverBg[variant];
        if (variant === 'primary') {
          btn.style.boxShadow = '0 2px 8px rgba(232,66,12,0.35)';
          btn.style.transform = 'translateY(-1px)';
        }
        if (variant === 'ghost' || variant === 'subtle') {
          btn.style.borderColor = 'var(--text-secondary)';
        }
      }}
      onMouseLeave={e => {
        const btn = e.currentTarget as HTMLButtonElement;
        Object.assign(btn.style, variantStyles[variant]);
        btn.style.transform = 'none';
      }}
      {...props}
    >
      {isLoading && <Loader2 size={14} className="animate-spin" />}
      {children}
    </button>
  );
}
