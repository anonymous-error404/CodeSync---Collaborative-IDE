import { useState } from 'react';
import {
  Database,
  Play,
  Key,
  Clock,
  Layers,
  Plus,
} from 'lucide-react';
import type { PreviewAnnotation } from '../../../types';

interface Props {
  annotations: PreviewAnnotation[];
  onAddTechnicalAnnotation: (payload: Partial<PreviewAnnotation>) => void;
}

export function DatabasePreviewSurface({
  onAddTechnicalAnnotation,
}: Props) {
  const [activeTab, setActiveTab] = useState<'schema' | 'query' | 'migrations'>('schema');
  const [selectedTable, setSelectedTable] = useState('transactions');
  const [sqlQuery, setSqlQuery] = useState(
    'SELECT id, user_id, amount, currency, status, created_at\nFROM transactions\nWHERE amount <= 0\nORDER BY created_at DESC\nLIMIT 10;'
  );
  const [isExecuting, setIsExecuting] = useState(false);
  const [queryResults, setQueryResults] = useState<{
    columns: string[];
    rows: any[][];
    executionTimeMs: number;
    rowCount: number;
  }>({
    columns: ['id', 'user_id', 'amount', 'currency', 'status', 'created_at'],
    rows: [
      ['tx_98104', 'usr_882', 0.0, 'USD', 'completed', '2026-11-24 03:14:02'],
      ['tx_98101', 'usr_319', -5.5, 'USD', 'pending', '2026-11-24 03:12:44'],
      ['tx_98094', 'usr_102', 0.0, 'EUR', 'completed', '2026-11-24 03:09:12'],
    ],
    executionTimeMs: 4.2,
    rowCount: 3,
  });

  const schemaTables: Record<string, Array<{ name: string; type: string; nullable: boolean; isPk?: boolean; isFk?: boolean }>> = {
    transactions: [
      { name: 'id', type: 'VARCHAR(64)', nullable: false, isPk: true },
      { name: 'user_id', type: 'VARCHAR(64)', nullable: false, isFk: true },
      { name: 'amount', type: 'DECIMAL(12,2)', nullable: false },
      { name: 'currency', type: 'VARCHAR(3)', nullable: false },
      { name: 'status', type: 'VARCHAR(32)', nullable: false },
      { name: 'created_at', type: 'TIMESTAMP', nullable: false },
    ],
    users: [
      { name: 'id', type: 'VARCHAR(64)', nullable: false, isPk: true },
      { name: 'email', type: 'VARCHAR(255)', nullable: false },
      { name: 'role', type: 'VARCHAR(32)', nullable: false },
      { name: 'created_at', type: 'TIMESTAMP', nullable: false },
    ],
    accounts: [
      { name: 'id', type: 'VARCHAR(64)', nullable: false, isPk: true },
      { name: 'balance', type: 'DECIMAL(14,2)', nullable: false },
      { name: 'is_frozen', type: 'BOOLEAN', nullable: false },
    ],
  };

  const migrations = [
    { id: '20261120_001', name: '001_initial_schema.sql', status: 'applied', duration: '24ms', appliedAt: '2026-11-20 14:00' },
    { id: '20261122_002', name: '002_add_fraud_check_index.sql', status: 'applied', duration: '18ms', appliedAt: '2026-11-22 09:30' },
    { id: '20261124_003', name: '003_amount_non_negative_check.sql', status: 'pending', duration: '-', appliedAt: '-' },
  ];

  const handleRunQuery = () => {
    setIsExecuting(true);
    setTimeout(() => {
      setIsExecuting(false);
      setQueryResults({
        columns: ['id', 'user_id', 'amount', 'currency', 'status', 'created_at'],
        rows: [
          ['tx_98104', 'usr_882', 0.0, 'USD', 'completed', '2026-11-24 03:14:02'],
          ['tx_98101', 'usr_319', -5.5, 'USD', 'pending', '2026-11-24 03:12:44'],
          ['tx_98094', 'usr_102', 0.0, 'EUR', 'completed', '2026-11-24 03:09:12'],
        ],
        executionTimeMs: 3.8,
        rowCount: 3,
      });
    }, 200);
  };

  const handlePinDatabase = () => {
    onAddTechnicalAnnotation({
      surface: 'database',
      type: 'bug',
      title: `Database Integrity Bug: Missing Check Constraint on ${selectedTable}`,
      comment: `Query verification returned 3 transactions with zero or negative amounts. Missing CHECK (amount > 0) constraint on column amount.`,
      severity: 'critical',
      priority: 'urgent',
      technicalContext: {
        dbTable: selectedTable,
        query: sqlQuery,
        returnedRows: queryResults.rowCount,
      },
    });
  };

  return (
    <div className="flex flex-col h-full w-full bg-[var(--surface-1,#0d1117)] text-[var(--foreground,#c9d1d9)] overflow-hidden">
      {/* Top Database Nav */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--border,#30363d)] bg-[var(--surface-2,#161b22)] shrink-0">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setActiveTab('schema')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'schema'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
            }`}
          >
            <Database size={13} />
            <span>Schema Explorer</span>
          </button>

          <button
            onClick={() => setActiveTab('query')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'query'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
            }`}
          >
            <Play size={13} />
            <span>SQL Query Runner</span>
          </button>

          <button
            onClick={() => setActiveTab('migrations')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'migrations'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
            }`}
          >
            <Layers size={13} />
            <span>Migrations & DDL</span>
          </button>
        </div>

        <button
          onClick={handlePinDatabase}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-600/20 hover:bg-red-600/30 text-red-300 border border-red-500/40 text-xs font-bold transition-all cursor-pointer"
        >
          <Plus size={13} />
          <span>Pin Database Defect</span>
        </button>
      </div>

      {/* Main DB Content */}
      <div className="flex-1 overflow-hidden p-4">
        {activeTab === 'schema' && (
          <div className="h-full grid grid-cols-4 gap-4">
            {/* Tables List */}
            <div className="rounded-2xl border p-3 overflow-y-auto"
                 style={{ background: 'var(--surface-2)', borderColor: 'var(--border)' }}>
              <span className="text-[10px] font-bold uppercase tracking-wider block mb-2" style={{ color: 'var(--muted)' }}>
                Tables in Sandbox DB
              </span>
              <div className="space-y-1">
                {Object.keys(schemaTables).map((table) => (
                  <button
                    key={table}
                    onClick={() => setSelectedTable(table)}
                    className="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold font-mono flex items-center justify-between transition-all cursor-pointer"
                    style={{
                      background: selectedTable === table ? 'var(--accent)' : 'transparent',
                      color: selectedTable === table ? 'var(--accent-fg)' : 'var(--text)',
                    }}
                  >
                    <span>{table}</span>
                    <span className="text-[10px] opacity-75">{schemaTables[table].length} cols</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Column Schema Details */}
            <div className="col-span-3 rounded-2xl border p-4 flex flex-col overflow-hidden"
                 style={{ background: 'var(--surface-2)', borderColor: 'var(--border)' }}>
              <div className="flex items-center justify-between pb-3 border-b mb-3"
                   style={{ borderColor: 'var(--border)' }}>
                <div className="flex items-center gap-2 font-mono">
                  <Database size={16} style={{ color: 'var(--accent)' }} />
                  <span className="font-bold text-sm" style={{ color: 'var(--text)' }}>public.{selectedTable}</span>
                </div>
                <span className="text-xs font-mono" style={{ color: 'var(--muted)' }}>PostgreSQL 16 Dialect</span>
              </div>

              <div className="flex-1 overflow-y-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b pb-2" style={{ color: 'var(--muted)', borderColor: 'var(--border)' }}>
                      <th className="py-2 px-3 font-semibold">Column</th>
                      <th className="py-2 px-3 font-semibold">Type</th>
                      <th className="py-2 px-3 font-semibold">Nullable</th>
                      <th className="py-2 px-3 font-semibold">Key</th>
                    </tr>
                  </thead>
                  <tbody>
                    {schemaTables[selectedTable]?.map((col) => (
                      <tr key={col.name} className="border-b hover:bg-[var(--surface)]" style={{ borderColor: 'var(--border)' }}>
                        <td className="py-2 px-3 font-mono font-bold flex items-center gap-1.5" style={{ color: 'var(--text)' }}>
                          {col.isPk && <Key size={12} className="text-amber-400" />}
                          {col.name}
                        </td>
                        <td className="py-2 px-3 font-mono" style={{ color: 'var(--accent)' }}>{col.type}</td>
                        <td className="py-2 px-3" style={{ color: 'var(--muted)' }}>{col.nullable ? 'YES' : 'NO'}</td>
                        <td className="py-2 px-3">
                          {col.isPk ? (
                            <span className="px-1.5 py-0.5 rounded bg-amber-950 text-amber-400 text-[10px] font-bold">
                              PRIMARY KEY
                            </span>
                          ) : col.isFk ? (
                            <span className="px-1.5 py-0.5 rounded bg-blue-950 text-blue-400 text-[10px] font-bold">
                              FOREIGN KEY
                            </span>
                          ) : (
                            <span style={{ color: 'var(--muted)' }}>-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'query' && (
          <div className="h-full flex flex-col gap-4">
            {/* Query Input */}
            <div className="h-44 rounded-2xl border p-3 flex flex-col"
                 style={{ background: 'var(--surface-2)', borderColor: 'var(--border)' }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>
                  Interactive SQL Query Console
                </span>
                <button
                  onClick={handleRunQuery}
                  disabled={isExecuting}
                  className="flex items-center gap-1.5 px-3.5 py-1 rounded-xl text-xs font-bold shadow cursor-pointer transition-all disabled:opacity-50"
                  style={{ background: 'var(--accent)', color: 'var(--accent-fg)' }}
                >
                  <Play size={12} />
                  <span>{isExecuting ? 'Running...' : 'Execute Query'}</span>
                </button>
              </div>

              <textarea
                value={sqlQuery}
                onChange={(e) => setSqlQuery(e.target.value)}
                className="flex-1 w-full p-2.5 rounded-xl border text-xs font-mono resize-none outline-none"
                style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: '#34d399' }}
                spellCheck={false}
              />
            </div>

            {/* Query Results Grid */}
            <div className="flex-1 rounded-2xl border p-3 flex flex-col overflow-hidden"
                 style={{ background: 'var(--surface-2)', borderColor: 'var(--border)' }}>
              <div className="flex items-center justify-between pb-2 border-b mb-2 text-xs"
                   style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}>
                <div className="flex items-center gap-2">
                  <span className="font-bold" style={{ color: 'var(--text)' }}>Query Results</span>
                  <span>({queryResults.rowCount} rows returned)</span>
                </div>
                <div className="flex items-center gap-1 font-mono">
                  <Clock size={12} />
                  <span>{queryResults.executionTimeMs} ms</span>
                </div>
              </div>

              <div className="flex-1 overflow-auto">
                <table className="w-full text-left border-collapse text-xs font-mono">
                  <thead>
                    <tr className="border-b" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
                      {queryResults.columns.map((c) => (
                        <th key={c} className="py-1.5 px-3 font-semibold" style={{ color: 'var(--text)' }}>{c}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {queryResults.rows.map((row, idx) => (
                      <tr key={idx} className="border-b hover:bg-[var(--surface)]" style={{ borderColor: 'var(--border)' }}>
                        {row.map((val, cIdx) => (
                          <td key={cIdx} className="py-1.5 px-3" style={{ color: 'var(--text)' }}>{String(val)}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'migrations' && (
          <div className="h-full rounded-2xl border p-4 overflow-y-auto"
               style={{ background: 'var(--surface-2)', borderColor: 'var(--border)' }}>
            <h4 className="font-bold text-xs mb-3" style={{ color: 'var(--text)' }}>Database Migration History & Verification</h4>
            <div className="space-y-2">
              {migrations.map((m) => (
                <div key={m.id} className="p-3 rounded-xl border flex items-center justify-between"
                     style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono font-bold" style={{ color: 'var(--text)' }}>{m.name}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${m.status === 'applied' ? 'bg-emerald-950 text-emerald-400' : 'bg-amber-950 text-amber-400'}`}>
                      {m.status.toUpperCase()}
                    </span>
                  </div>
                  <div className="text-xs font-mono flex items-center gap-3" style={{ color: 'var(--muted)' }}>
                    <span>Applied: {m.appliedAt}</span>
                    <span>Duration: {m.duration}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
