import { Loader2 } from 'lucide-react';
export function Spinner({ size = 20, fullScreen = false }: { size?: number; fullScreen?: boolean }) {
  if (fullScreen) return (
    <div className="flex items-center justify-center" style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <div className="flex flex-col items-center gap-3">
        <Loader2 size={28} className="animate-spin" style={{ color: 'var(--accent)' }} />
        <p className="text-sm" style={{ color: 'var(--muted)' }}>Loading...</p>
      </div>
    </div>
  );
  return <Loader2 size={size} className="animate-spin" style={{ color: 'var(--accent)' }} />;
}
