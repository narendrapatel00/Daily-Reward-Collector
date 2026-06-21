import React, { useState, useEffect } from 'react';
import { LayoutDashboard, Users, History, Activity, AlertCircle, CheckCircle, Info, RefreshCw, LogOut } from 'lucide-react';
import Dashboard from './pages/Dashboard';
import Accounts from './pages/Accounts';
import Logs from './pages/Logs';
import { socket } from './services/api';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isConnected, setIsConnected] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [consoleLogs, setConsoleLogs] = useState([]);

  // Toast notification helper
  const showToast = (message, type = 'info') => {
    const id = Date.now() + Math.random().toString(36).substr(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
    
    // Auto-remove after 4 seconds
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  useEffect(() => {
    // Handle socket connection states
    socket.on('connect', () => {
      setIsConnected(true);
      showToast('Connected to Python WebSocket Server', 'success');
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
      showToast('Disconnected from Python Backend', 'error');
    });

    // Listen to real-time bot log updates
    socket.on('bot_log', (data) => {
      // Append to local console history
      setConsoleLogs((prev) => [data, ...prev].slice(0, 100));
      
      // Trigger user-facing toasts for key events
      if (data.status === 'success') {
        showToast(`[${data.account_name}] Reward claimed: ${data.message}`, 'success');
      } else if (data.status === 'error') {
        showToast(`[${data.account_name}] Failed: ${data.message}`, 'error');
      } else if (data.status === 'warning') {
        showToast(`[${data.account_name}] ${data.message}`, 'warning');
      }
    });

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('bot_log');
    };
  }, []);

  const clearConsole = () => setConsoleLogs([]);

  return (
    <div className="flex h-screen overflow-hidden text-gray-100 font-sans relative">
      {/* Background glow effects */}
      <div className="glow-orb-purple top-10 left-10"></div>
      <div className="glow-orb-cyan bottom-10 right-10"></div>

      {/* Sidebar Navigation */}
      <aside className="w-64 bg-black/40 border-r border-white/5 backdrop-blur-md flex flex-col justify-between shrink-0">
        <div>
          {/* Logo Header */}
          <div className="px-6 py-6 border-b border-white/5 flex items-center gap-3">
            <div className="p-2 bg-purple-500/10 rounded-xl border border-purple-500/20 shadow-inner">
              <Activity className="h-6 w-6 text-purple-400 animate-pulse" />
            </div>
            <div>
              <h1 className="font-extrabold text-base tracking-wide bg-gradient-to-r from-purple-400 to-indigo-400 bg-clip-text text-transparent">
                Daily Collector
              </h1>
              <span className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">
                Automation Bot
              </span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="mt-8 px-4 space-y-1.5">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                activeTab === 'dashboard'
                  ? 'bg-purple-600/10 text-purple-400 border border-purple-500/20 font-semibold shadow-inner'
                  : 'text-gray-400 hover:text-white hover:bg-white/[0.03]'
              }`}
            >
              <LayoutDashboard className="h-5 w-5" />
              Dashboard
            </button>

            <button
              onClick={() => setActiveTab('accounts')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                activeTab === 'accounts'
                  ? 'bg-purple-600/10 text-purple-400 border border-purple-500/20 font-semibold shadow-inner'
                  : 'text-gray-400 hover:text-white hover:bg-white/[0.03]'
              }`}
            >
              <Users className="h-5 w-5" />
              Accounts
            </button>

            <button
              onClick={() => setActiveTab('logs')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                activeTab === 'logs'
                  ? 'bg-purple-600/10 text-purple-400 border border-purple-500/20 font-semibold shadow-inner'
                  : 'text-gray-400 hover:text-white hover:bg-white/[0.03]'
              }`}
            >
              <History className="h-5 w-5" />
              Logs Archive
            </button>
          </nav>
        </div>

        {/* Footer Status Display */}
        <div className="p-4 border-t border-white/5 bg-black/20">
          <div className="flex items-center justify-between text-xs text-gray-400 px-2 py-1">
            <div className="flex items-center gap-2">
              <span className={`h-2.5 w-2.5 rounded-full inline-block ${isConnected ? 'bg-emerald-500 animate-ping' : 'bg-red-500 animate-pulse'}`}></span>
              <span>{isConnected ? 'Socket Connected' : 'Connecting Backend...'}</span>
            </div>
            <a
              href="http://localhost:5000/mock-site/login"
              target="_blank"
              rel="noreferrer"
              className="hover:text-purple-400 transition"
              title="Open Target Mock Site"
            >
              <LogOut className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto p-8 relative">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Active Tab Screen Routing */}
          {activeTab === 'dashboard' && (
            <Dashboard 
              consoleLogs={consoleLogs} 
              clearConsole={clearConsole} 
              showToast={showToast} 
            />
          )}
          {activeTab === 'accounts' && (
            <Accounts 
              showToast={showToast} 
            />
          )}
          {activeTab === 'logs' && (
            <Logs 
              showToast={showToast} 
            />
          )}
        </div>
      </main>

      {/* Custom Toast Notifications Container */}
      <div className="fixed top-6 right-6 z-50 flex flex-col gap-3 w-80 max-w-full">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`p-4 rounded-xl backdrop-blur-md border shadow-lg flex items-start gap-3 transition-all duration-300 transform translate-y-0 scale-100 ${
              toast.type === 'success'
                ? 'bg-emerald-950/70 border-emerald-500/20 text-emerald-300'
                : toast.type === 'error'
                ? 'bg-red-950/70 border-red-500/20 text-red-300'
                : toast.type === 'warning'
                ? 'bg-amber-950/70 border-amber-500/20 text-amber-300'
                : 'bg-zinc-900/80 border-zinc-700/30 text-gray-300'
            }`}
          >
            {toast.type === 'success' && <CheckCircle className="h-5 w-5 shrink-0 text-emerald-400 mt-0.5" />}
            {toast.type === 'error' && <AlertCircle className="h-5 w-5 shrink-0 text-red-400 mt-0.5" />}
            {toast.type === 'warning' && <AlertCircle className="h-5 w-5 shrink-0 text-amber-400 mt-0.5" />}
            {toast.type === 'info' && <Info className="h-5 w-5 shrink-0 text-purple-400 mt-0.5" />}
            <div className="text-xs leading-normal font-medium">{toast.message}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
