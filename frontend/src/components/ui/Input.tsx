import type { InputHTMLAttributes, ReactNode } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: ReactNode;
  rightElement?: ReactNode;
}

export function Input({ label, error, hint, leftIcon, rightElement, className = '', id, ...props }: InputProps) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');
  return (
    <div className="flex flex-col gap-1.5">
      {label && <label htmlFor={inputId} className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>{label}</label>}
      <div className="relative flex items-center">
        {leftIcon && <span className="absolute left-3 pointer-events-none flex items-center" style={{ color: 'var(--muted)' }}>{leftIcon}</span>}
        <input id={inputId}
          className={`w-full h-9 rounded text-sm transition-colors duration-150 focus:outline-none ${leftIcon ? 'pl-9' : 'pl-3'} ${rightElement ? 'pr-10' : 'pr-3'} ${className}`}
          style={{ background: 'var(--bg)', color: 'var(--text)', border: error ? '1px solid var(--error)' : '1px solid var(--border)' }}
          onFocus={e => { if (!error) { e.currentTarget.style.border = '1px solid var(--accent)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(47,129,247,0.15)'; } }}
          onBlur={e => { if (!error) { e.currentTarget.style.border = '1px solid var(--border)'; e.currentTarget.style.boxShadow = 'none'; } }}
          {...props} />
        {rightElement && <span className="absolute right-3 flex items-center" style={{ color: 'var(--muted)' }}>{rightElement}</span>}
      </div>
      {error && <p className="text-xs" style={{ color: 'var(--error)' }}>{error}</p>}
      {hint && !error && <p className="text-xs" style={{ color: 'var(--muted)' }}>{hint}</p>}
    </div>
  );
}
