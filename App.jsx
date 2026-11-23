import React, { useState, useEffect, useMemo } from 'react';
import {
  fetchTenants,
  fetchStats,
  fetchDisagreements,
  runImport,
  runReconciliation,
  runTestSuite
} from './services/api';

export default function App() {
  const [tenants, setTenants] = useState([]);
  const [selectedTenant, setSelectedTenant] = useState('ALL');
  const [disagreements, setDisagreements] = useState([]);
  const [selectedReason, setSelectedReason] = useState('ALL');
  const [sortOrder, setSortOrder] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState(null);
  const [selectedDisagreement, setSelectedDisagreement] = useState(null);
  const [testResults, setTestResults] = useState(null);
  const [showTestModal, setShowTestModal] = useState(false);

  useEffect(() => {
    loadTenants();
  }, []);

  useEffect(() => {
    loadStats();
    loadDisagreements();
  }, [selectedTenant, selectedReason, sortOrder]);

  const loadTenants = async () => {
    try {
      const data = await fetchTenants();
      setTenants(data.tenants || []);
    } catch (err) {
      console.error(err);
    }
  };

  const loadStats = async () => {
    try {
      const data = await fetchStats(selectedTenant);
      setStats(data);
    } catch (err) {
      console.error(err);
    }
  };

  const loadDisagreements = async () => {
    setLoading(true);
    try {
      const data = await fetchDisagreements({
        tenant: selectedTenant,
        reason: selectedReason,
        sortOrder,
        search: searchQuery
      });
      setDisagreements(data.disagreements || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    setLoading(true);
    setActionMessage({ type: 'info', text: 'Importing CSV files into database...' });
    try {
      const data = await runImport();
      setActionMessage({ type: 'success', text: `Import complete! Batch ID: ${data.summary.batch_id}` });
      loadStats();
      loadDisagreements();
    } catch (err) {
      setActionMessage({ type: 'error', text: 'Import failed: ' + err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleReconcile = async () => {
    setLoading(true);
    setActionMessage({ type: 'info', text: 'Running comparison engine...' });
    try {
      const data = await runReconciliation();
      setActionMessage({
        type: 'success',
        text: `Reconciliation finished! Discovered ${data.total_disagreements} discrepancies.`
      });
      loadStats();
      loadDisagreements();
    } catch (err) {
      setActionMessage({ type: 'error', text: 'Reconciliation failed: ' + err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleRunTests = async () => {
    setLoading(true);
    try {
      const data = await runTestSuite();
      setTestResults(data);
      setShowTestModal(true);
    } catch (err) {
      setActionMessage({ type: 'error', text: 'Failed running tests: ' + err.message });
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    if (!searchQuery) return disagreements;
    const q = searchQuery.toLowerCase();
    return disagreements.filter(d =>
      (d.record_id && d.record_id.toLowerCase().includes(q)) ||
      (d.location_id && d.location_id.toLowerCase().includes(q)) ||
      (d.explanation && d.explanation.toLowerCase().includes(q))
    );
  }, [disagreements, searchQuery]);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 font-sans">
      <header className="flex justify-between items-center border-b pb-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">AdosX Reconciliation Engine</h1>
          <p className="text-sm text-slate-500">Multi-tenant event discrepancy reconciliation</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-slate-600">Tenant:</label>
          <select
            value={selectedTenant}
            onChange={(e) => setSelectedTenant(e.target.value)}
            className="border rounded p-1.5 text-sm"
          >
            <option value="ALL">All Tenants</option>
            {tenants.map(t => (
              <option key={t.org_id} value={t.org_id}>{t.name} ({t.org_id})</option>
            ))}
          </select>
        </div>
      </header>

      {actionMessage && (
        <div className={`p-3 mb-4 rounded text-sm ${actionMessage.type === 'success' ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'}`}>
          {actionMessage.text}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <div className="p-4 bg-white border rounded shadow-sm">
          <div className="text-xs text-slate-500">Total Discrepancies</div>
          <div className="text-2xl font-bold text-slate-900">{stats?.total_disagreements || 0}</div>
        </div>
        <div className="p-4 bg-white border rounded shadow-sm">
          <div className="text-xs text-slate-500">Missing in B</div>
          <div className="text-2xl font-bold text-red-600">{stats?.counts_by_type?.MISSING_IN_SYSTEM_B || 0}</div>
        </div>
        <div className="p-4 bg-white border rounded shadow-sm">
          <div className="text-xs text-slate-500">Value Mismatches</div>
          <div className="text-2xl font-bold text-amber-600">{stats?.counts_by_type?.VALUE_MISMATCH || 0}</div>
        </div>
        <div className="p-4 bg-white border rounded shadow-sm">
          <div className="text-xs text-slate-500">Duplicate in B</div>
          <div className="text-2xl font-bold text-indigo-600">{stats?.counts_by_type?.DUPLICATE_SYSTEM_B_ENTRY || 0}</div>
        </div>
        <div className="p-4 bg-white border rounded shadow-sm">
          <div className="text-xs text-slate-500">Orphan in B</div>
          <div className="text-2xl font-bold text-purple-600">{stats?.counts_by_type?.ORPHAN_SYSTEM_B_ENTRY || 0}</div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-3 mb-6">
        <button onClick={handleImport} className="bg-slate-800 text-white px-4 py-2 rounded text-sm">
          Import CSVs
        </button>
        <button onClick={handleReconcile} className="bg-indigo-600 text-white px-4 py-2 rounded text-sm">
          Run Reconciliation
        </button>
        <button onClick={handleRunTests} className="bg-emerald-600 text-white px-4 py-2 rounded text-sm">
          Run Tests
        </button>
      </div>

      {/* Table */}
      <div className="bg-white border rounded shadow-sm overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-100 border-b text-xs font-semibold uppercase text-slate-600">
            <tr>
              <th className="p-3">Record ID</th>
              <th className="p-3">Reason</th>
              <th className="p-3">A Value</th>
              <th className="p-3">B Value</th>
              <th className="p-3">Location</th>
              <th className="p-3">Tenant</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filtered.map(item => (
              <tr key={item.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => setSelectedDisagreement(item)}>
                <td className="p-3 font-mono font-bold">{item.record_id}</td>
                <td className="p-3"><span className="px-2 py-0.5 rounded text-xs border">{item.disagreement_type}</span></td>
                <td className="p-3 font-mono">{item.system_a_value}</td>
                <td className="p-3 font-mono">{item.system_b_value}</td>
                <td className="p-3">{item.location_id}</td>
                <td className="p-3">{item.org_id}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
