import logoImg from '../../assets/logo.png';

interface LogoProps {
  size?: number;
  className?: string;
  showText?: boolean;
  textClassName?: string;
}

export function Logo({
  size = 36,
  className = '',
  showText = true,
  textClassName = 'text-xl font-bold tracking-tight',
}: LogoProps) {
  return (
    <div className={`flex items-center gap-3 select-none ${className}`}>
      <img
        src={logoImg}
        alt="CodeSync"
        width={size}
        height={size}
        className="rounded-xl object-contain shrink-0 shadow-sm transition-transform duration-200 hover:scale-105"
        style={{ width: size, height: size }}
      />
      {showText && (
        <span className={textClassName} style={{ color: 'var(--text)' }}>
          CodeSync
        </span>
      )}
    </div>
  );
}
