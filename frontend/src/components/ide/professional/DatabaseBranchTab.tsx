import { useState, useEffect } from 'react';
import { Database, ShieldCheck, RefreshCw, Play, Table2, AlertTriangle, Check } from 'lucide-react';
import type { DatabaseBranchStatus } from '../../../types';
import { professionalCollabService } from '../../../services/professionalCollabService';
import { Spinner } from '../../ui/Spinner';

interface Props {
  workspaceId: string;
  token: string | null;
}

export function DatabaseBranchTab({ workspaceId, token }: Props) {
  const [status, setStatus] = useState<DatabaseBranchStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [resetting, setResetting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  // SQL Sandbox state
  const [sqlQuery, setSqlQuery] = useState('SELECT * FROM users LIMIT 5;');
  const [queryExecuting, setQueryExecuting] = useState(false);
  const [queryResult, setQueryResult] = useState<any[] | null>(null);
  const [queryError, setQueryError] = useState('');

  const loadStatus = async () => {
    setLoading(true);
    setError('');
    try {
      let data = await professionalCollabService.getDatabaseStatus(workspaceId, token);
      if (!data.initialized) {
        data = await professionalCollabService.initDatabaseBranch(workspaceId, token);
      }
      setStatus(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load database branch');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStatus();
  }, [workspaceId, token]);

  const handleResetBranch = async () => {
    if (!confirm('Reset ephemeral database to fresh PII-masked seed data? Any destructive migrations will be reset.')) return;
    setResetting(true);
    setSuccessMsg('');
    setError('');
    try {
      const res = await professionalCollabService.resetDatabaseBranch(workspaceId, token);
      setStatus(res);
      setSuccessMsg('✓ Database branch restored to fresh, sanitized seed data.');
      setQueryResult(null);
      await loadStatus();
    } catch (err: any) {
      setError(err.message || 'Failed to reset database branch');
    } finally {
      setResetting(false);
    }
  };

  const handleExecuteQuery = async () => {
    if (!sqlQuery.trim()) return;
    setQueryExecuting(true);
    setQueryError('');
    setQueryResult(null);
    try {
      const res = await professionalCollabService.executeDatabaseQuery(workspaceId, sqlQuery.trim(), token);
      if (Array.isArray(res.result)) {
        setQueryResult(res.result);
      } else {
        setSuccessMsg(`✓ Query executed successfully.`);
      }
      loadStatus();
    } catch (err: any) {
      setQueryError(err.message || 'Query execution error');
    } finally {
      setQueryExecuting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-2 text-xs text-[var(--muted)]">
        <Spinner size={22} />
        <span>Connecting to isolated ephemeral database branch...</span>
      </div>
    );
  }

  return (
    <div className="space-y-5 text-xs">
      {error && (
        <div className="p-2.5 rounded text-xs bg-red-500/10 text-red-400 border border-red-500/30">
          {error}
        </div>
      )}

      {successMsg && (
        <div className="p-2.5 rounded text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5">
          <Check size={13} />
          <span>{successMsg}</span>
        </div>
      )}

      {/* ── Section: Branch Metadata Banner ── */}
      <div className="p-3.5 rounded-xl border space-y-2.5" style={{ background: 'var(--surface-2)', borderColor: 'var(--border)' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 font-semibold text-[var(--text)]">
            <Database size={15} className="text-emerald-400" />
            <span>Ephemeral Database Branch</span>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
            <ShieldCheck size={11} />
            PII Masked
          </span>
        </div>

        <p className="text-[11px] text-[var(--muted)] leading-relaxed">
          Dedicated, isolated database branch pre-populated with sanitized production seed data. Run destructive schema migrations or rollback scripts without affecting peers.
        </p>

        {status && (
          <div className="p-2 rounded bg-[var(--bg)] border font-mono text-[10px] text-emerald-400 select-all overflow-x-auto" style={{ borderColor: 'var(--border)' }}>
            DATABASE_URL={status.databaseUrl}
          </div>
        )}

        <div className="flex justify-end pt-1">
          <button
            onClick={handleResetBranch}
            disabled={resetting}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 transition-all cursor-pointer"
          >
            {resetting ? <RefreshCw size={12} className="animate-spin" /> : <RefreshCw size={12} />}
            Reset to Clean Seed
          </button>
        </div>
      </div>

      {/* ── Section: Branch Tables & Row Counts ── */}
      {status?.tables && (
        <div className="space-y-2">
          <span className="font-semibold text-xs uppercase tracking-wider text-[var(--muted)]">
            Branch Schema Tables ({status.tables.length})
          </span>
          <div className="grid grid-cols-2 gap-2">
            {status.tables.map(t => (
              <div
                key={t.table}
                className="p-2.5 rounded-lg border flex items-center justify-between"
                style={{ background: 'var(--surface-2)', borderColor: 'var(--border)' }}
              >
                <div className="flex items-center gap-1.5 font-mono text-[11px] text-[var(--text)]">
                  <Table2 size={12} className="text-blue-400" />
                  <span>{t.table}</span>
                </div>
                <span className="text-[10px] px-1.5 py-0.2 rounded font-mono bg-blue-500/10 text-blue-400">
                  {t.rows} rows
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Section: SQL Migration & Query Sandbox ── */}
      <div className="p-3.5 rounded-xl border space-y-3" style={{ background: 'var(--surface-2)', borderColor: 'var(--border)' }}>
        <div className="flex items-center justify-between">
          <span className="font-semibold text-[var(--text)]">SQL Migration & Query Sandbox</span>
          <span className="text-[10px] text-[var(--muted)]">Isolated from staging</span>
        </div>

        {queryError && (
          <div className="p-2 rounded bg-red-500/10 text-red-400 text-xs border border-red-500/30 flex items-center gap-1.5">
            <AlertTriangle size={13} className="shrink-0" />
            <span className="truncate">{queryError}</span>
          </div>
        )}

        <div className="space-y-2">
          <textarea
            rows={3}
            value={sqlQuery}
            onChange={e => setSqlQuery(e.target.value)}
            className="w-full p-2.5 rounded-lg text-xs font-mono bg-[var(--bg)] text-[var(--text)] border focus:outline-none resize-none"
            style={{ borderColor: 'var(--border)' }}
            placeholder="SELECT * FROM users; -- or ALTER TABLE / DROP TABLE"
          />

          <div className="flex justify-end">
            <button
              onClick={handleExecuteQuery}
              disabled={queryExecuting || !sqlQuery.trim()}
              className="px-3.5 py-1.5 rounded-lg font-semibold text-xs text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Play size={11} fill="white" />
              Run Query
            </button>
          </div>
        </div>

        {/* Query Results View */}
        {queryResult && queryResult.length > 0 && (
          <div className="pt-2 border-t overflow-x-auto max-h-48" style={{ borderColor: 'var(--border)' }}>
            <table className="w-full text-left font-mono text-[10px] border-collapse">
              <thead>
                <tr className="border-b" style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}>
                  {Object.keys(queryResult[0]).slice(0, 5).map(col => (
                    <th key={col} className="p-1 font-semibold">{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {queryResult.map((row, idx) => (
                  <tr key={idx} className="border-b hover:bg-white/5" style={{ borderColor: 'var(--border)' }}>
                    {Object.values(row).slice(0, 5).map((val: any, cidx) => (
                      <td key={cidx} className="p-1 truncate max-w-[120px] text-[var(--text)]">
                        {String(val)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
