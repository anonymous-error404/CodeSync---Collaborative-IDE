import { Loader2 } from 'lucide-react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'ghost' | 'danger' | 'subtle';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  fullWidth?: boolean;
  children: ReactNode;
}

export function Button({ variant = 'primary', size = 'md', isLoading = false, fullWidth = false, children, disabled, className = '', ...props }: ButtonProps) {
  const base = 'inline-flex items-center justify-center gap-2 rounded font-medium transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer select-none whitespace-nowrap border-none';
  const vs: Record<string, string> = {
    primary: 'text-white active:scale-[0.98]',
    ghost: 'bg-transparent active:scale-[0.98]',
    danger: 'text-white active:scale-[0.98]',
    subtle: 'active:scale-[0.98]',
  };
  const ss: Record<string, string> = { sm: 'text-xs px-3 py-1.5 h-7', md: 'text-sm px-4 py-2 h-9', lg: 'text-sm px-5 py-2.5 h-10' };
  const styles: Record<string, React.CSSProperties> = {
    primary: { background: 'var(--accent)', color: 'var(--accent-fg)' },
    ghost: { background: 'transparent', color: 'var(--text)', border: '1px solid var(--border)' },
    danger: { background: 'var(--error)', color: 'white' },
    subtle: { background: 'var(--surface-2)', color: 'var(--text)' },
  };
  return (
    <button disabled={disabled ?? isLoading} className={`${base} ${vs[variant]} ${ss[size]} ${fullWidth ? 'w-full' : ''} ${className}`}
      style={styles[variant]}
      onMouseEnter={e => { if (variant === 'primary') (e.currentTarget as HTMLButtonElement).style.background = 'var(--accent-hover)'; }}
      onMouseLeave={e => { if (variant === 'primary') (e.currentTarget as HTMLButtonElement).style.background = 'var(--accent)'; }}
      {...props}>
      {isLoading && <Loader2 size={14} className="animate-spin" />}
      {children}
    </button>
  );
}
