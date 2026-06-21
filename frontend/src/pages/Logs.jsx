import React, { useState, useEffect } from 'react';
import { Search, Download, ChevronLeft, ChevronRight, AlertCircle, CheckCircle, Info, RefreshCw, X } from 'lucide-react';
import { logsApi, accountsApi, socket } from '../services/api';

export default function Logs({ showToast }) {
  const [logs, setLogs] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [totalLogs, setTotalLogs] = useState(0);
  const [loading, setLoading] = useState(true);
  
  // Filters and Pagination
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [accountFilter, setAccountFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Error Message Inspection Modal
  const [activeErrorDetail, setActiveErrorDetail] = useState(null);

  // Debounce search input to avoid hitting backend API on every keystroke
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1); // Reset page on search
    }, 450);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchAccounts = () => {
    accountsApi.getAll()
      .then((data) => setAccounts(data))
      .catch((err) => console.error('Error fetching accounts for filter:', err));
  };

  const fetchLogs = () => {
    setLoading(true);
    const params = {
      page,
      per_page: 10,
      search: debouncedSearch,
      status: statusFilter,
      account_id: accountFilter
    };

    logsApi.get(params)
      .then((res) => {
        setLogs(res.logs);
        setTotalPages(res.pages);
        setTotalLogs(res.total);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        showToast('Failed to fetch logs archive', 'error');
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [page, debouncedSearch, statusFilter, accountFilter]);

  // Real-time socket integration to auto-refresh table
  useEffect(() => {
    const handleNewLog = () => {
      // If we are on page 1, refresh logs to show the new entry immediately
      if (page === 1) {
        fetchLogs();
      } else {
        // Optionally notify user
        fetchAccounts(); // Update filters list if relevant
      }
    };

    socket.on('new_log', handleNewLog);
    return () => {
      socket.off('new_log', handleNewLog);
    };
  }, [page]);

  const handleExportCSV = () => {
    const params = {
      search: debouncedSearch,
      status: statusFilter,
      account_id: accountFilter
    };
    const csvUrl = logsApi.getExportUrl(params);
    
    showToast('Exporting logs to CSV...', 'info');
    // Open in a new window/tab to trigger browser file download
    window.open(csvUrl, '_blank');
  };

  const formatDate = (isoString) => {
    const date = new Date(isoString);
    return date.toLocaleString();
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
            Collection Logs
          </h2>
          <p className="text-gray-400 text-sm mt-1">
            Historical trace logs and collection statuses.
          </p>
        </div>
        
        <button
          onClick={handleExportCSV}
          disabled={logs.length === 0}
          className="btn-secondary w-full sm:w-auto"
        >
          <Download className="h-4.5 w-4.5" />
          Export CSV
        </button>
      </div>

      {/* Interactive Filters Panel */}
      <div className="glass-panel p-4 grid grid-cols-1 md:grid-cols-4 gap-4 items-center bg-black/25">
        {/* Text Search */}
        <div className="relative md:col-span-2">
          <span className="absolute left-3.5 top-3.5 text-gray-500">
            <Search className="h-4.5 w-4.5" />
          </span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search account names, rewards or errors..."
            className="glass-input w-full pl-10"
          />
        </div>

        {/* Status Filter */}
        <div>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="glass-select w-full"
          >
            <option value="">Filter by Status</option>
            <option value="Success">Success Only</option>
            <option value="Failed">Failed Only</option>
          </select>
        </div>

        {/* Account Filter */}
        <div>
          <select
            value={accountFilter}
            onChange={(e) => {
              setAccountFilter(e.target.value);
              setPage(1);
            }}
            className="glass-select w-full"
          >
            <option value="">Filter by Account</option>
            {accounts.map((acc) => (
              <option key={acc.id} value={acc.id}>
                {acc.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Logs Table */}
      <div className="glass-panel overflow-hidden border border-white/5 shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/5 bg-white/[0.02] text-xs font-bold text-gray-400 uppercase tracking-wider">
                <th className="px-6 py-4.5">Timestamp</th>
                <th className="px-6 py-4.5">Account Profile</th>
                <th className="px-6 py-4.5">Status</th>
                <th className="px-6 py-4.5">Reward Collected</th>
                <th className="px-6 py-4.5 text-right">Details</th>
              </tr>
            </thead>
            
            <tbody className="divide-y divide-white/[0.03]">
              {loading ? (
                <tr>
                  <td colSpan="5" className="px-6 py-16 text-center">
                    <div className="flex justify-center items-center gap-3">
                      <RefreshCw className="h-5 w-5 text-purple-400 animate-spin" />
                      <span className="text-sm text-gray-400 font-medium">Fetching logs...</span>
                    </div>
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-12 text-center text-sm text-gray-500 italic">
                    No matching logs found in history database.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-white/[0.01] transition-colors duration-150 text-sm">
                    <td className="px-6 py-4 font-mono text-xs text-gray-400">
                      {formatDate(log.timestamp)}
                    </td>
                    <td className="px-6 py-4 font-semibold text-white">
                      {log.account_name}
                    </td>
                    <td className="px-6 py-4">
                      {log.status === 'Success' ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-950/50 border border-emerald-500/20 text-emerald-400">
                          <CheckCircle className="h-3 w-3" />
                          Success
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-950/50 border border-red-500/20 text-red-400">
                          <AlertCircle className="h-3 w-3" />
                          Failed
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 max-w-xs truncate font-medium text-gray-300">
                      {log.status === 'Success' ? (
                        <span className="text-yellow-500 font-semibold">{log.reward_name}</span>
                      ) : (
                        <span className="text-red-400/80 font-mono text-xs block truncate" title={log.error_message}>
                          {log.error_message}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {log.status === 'Failed' && (
                        <button
                          onClick={() => setActiveErrorDetail(log)}
                          className="btn-icon p-1.5 hover:text-red-400"
                          title="Inspect Error Details"
                        >
                          <Info className="h-4 w-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {!loading && logs.length > 0 && (
          <div className="px-6 py-4 border-t border-white/5 flex items-center justify-between bg-black/10 text-xs text-gray-400">
            <div>
              Showing <span className="font-semibold text-white">{logs.length}</span> of{' '}
              <span className="font-semibold text-white">{totalLogs}</span> entries
            </div>
            
            <div className="flex items-center gap-2.5">
              <button
                onClick={() => setPage((p) => Math.max(p - 1, 1))}
                disabled={page === 1}
                className="btn-icon p-1.5 disabled:opacity-30 disabled:pointer-events-none"
              >
                <ChevronLeft className="h-4.5 w-4.5" />
              </button>
              
              <span className="font-semibold text-gray-200">
                Page {page} of {totalPages}
              </span>
              
              <button
                onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                disabled={page === totalPages}
                className="btn-icon p-1.5 disabled:opacity-30 disabled:pointer-events-none"
              >
                <ChevronRight className="h-4.5 w-4.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Full Error Detail Overlay Modal */}
      {activeErrorDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="glass-panel w-full max-w-2xl p-6 bg-zinc-950/90 border-white/10 shadow-2xl relative">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-extrabold text-lg text-white flex items-center gap-2 text-red-400">
                <AlertCircle className="h-5 w-5" />
                Automation Failure Trace
              </h3>
              <button 
                onClick={() => setActiveErrorDetail(null)} 
                className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-xs bg-black/40 p-3 rounded-lg border border-white/5 font-mono">
                <div>
                  <span className="text-gray-500">Account Profile:</span>{' '}
                  <span className="text-white font-semibold">{activeErrorDetail.account_name}</span>
                </div>
                <div>
                  <span className="text-gray-500">Timestamp:</span>{' '}
                  <span className="text-white">{formatDate(activeErrorDetail.timestamp)}</span>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-1.5">
                  Error Message & Stack Trace
                </label>
                <div className="bg-red-950/20 border border-red-500/10 rounded-xl p-4 font-mono text-[11px] text-red-300 overflow-x-auto whitespace-pre-wrap leading-relaxed shadow-inner max-h-96">
                  {activeErrorDetail.error_message || 'No stack trace details provided.'}
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={() => setActiveErrorDetail(null)}
                  className="btn-secondary px-6 text-xs"
                >
                  Close Window
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
