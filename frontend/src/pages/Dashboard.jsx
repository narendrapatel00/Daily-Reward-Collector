import React, { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Award, Calendar, AlertTriangle, CheckCircle2, Play, Terminal, Trash2 } from 'lucide-react';
import { statsApi, collectApi, socket } from '../services/api';

export default function Dashboard({ consoleLogs, clearConsole, showToast }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [triggeringAll, setTriggeringAll] = useState(false);

  const fetchStats = () => {
    statsApi.get()
      .then((data) => {
        setStats(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Error fetching dashboard stats:', err);
        showToast('Failed to load dashboard statistics', 'error');
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchStats();

    // Listen to real-time events that suggest stats need refreshing
    const handleStatsUpdate = () => {
      fetchStats();
    };

    const handleNewLog = () => {
      fetchStats();
    };

    // Note: socket will trigger these when a run finishes or starts
    socket.on('stats_update', handleStatsUpdate);
    socket.on('new_log', handleNewLog);

    return () => {
      socket.off('stats_update', handleStatsUpdate);
      socket.off('new_log', handleNewLog);
    };
  }, []);

  const handleCollectAll = () => {
    setTriggeringAll(true);
    showToast('Queuing automated collection for all active accounts...', 'info');
    collectApi.triggerAll()
      .then((res) => {
        showToast(res.message || 'Reward collection queued successfully!', 'success');
        setTriggeringAll(false);
      })
      .catch((err) => {
        console.error(err);
        showToast(err.response?.data?.error || 'Failed to queue collection jobs', 'error');
        setTriggeringAll(false);
      });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="relative flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
          <div className="absolute text-[10px] uppercase font-bold tracking-wider text-purple-400">Loading</div>
        </div>
      </div>
    );
  }

  const { total_collected, today_collected, failed_attempts, success_rate } = stats?.summary || {
    total_collected: 0,
    today_collected: 0,
    failed_attempts: 0,
    success_rate: 0
  };

  // Recharts custom tooltip to fit dark glass theme
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-black/80 backdrop-blur-md border border-white/10 p-3.5 rounded-xl shadow-xl">
          <p className="text-xs font-bold text-gray-400 mb-1.5">{label}</p>
          <p className="text-xs text-emerald-400 font-semibold flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-400 inline-block"></span>
            Success: {payload[0].value}
          </p>
          {payload[1] && (
            <p className="text-xs text-red-400 font-semibold flex items-center gap-1.5 mt-0.5">
              <span className="h-2 w-2 rounded-full bg-red-400 inline-block"></span>
              Failed: {payload[1].value}
            </p>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
            Overview Dashboard
          </h2>
          <p className="text-gray-400 text-sm mt-1">
            Real-time control and system status statistics.
          </p>
        </div>
        
        <button
          onClick={handleCollectAll}
          disabled={triggeringAll}
          className="btn-emerald w-full sm:w-auto"
        >
          <Play className={`h-4.5 w-4.5 ${triggeringAll ? 'animate-ping' : ''}`} />
          {triggeringAll ? 'Queuing Bot...' : 'Collect All Now'}
        </button>
      </div>

      {/* Grid of 4 gradient stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Card 1: Total Rewards */}
        <div className="glass-panel p-6 bg-gradient-to-br from-purple-950/20 via-darkCard to-purple-900/10 border-purple-500/10 hover:border-purple-500/20 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:opacity-[0.06] transition-opacity duration-300">
            <Award className="h-32 w-32 text-purple-400" />
          </div>
          <div className="flex justify-between items-start">
            <p className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Total Rewards</p>
            <div className="p-2 bg-purple-500/10 rounded-lg text-purple-400">
              <Award className="h-5 w-5" />
            </div>
          </div>
          <h3 className="text-3xl font-black mt-4 text-white tracking-tight">{total_collected}</h3>
          <p className="text-[11px] text-gray-500 mt-2 font-medium">Accumulated across all accounts</p>
        </div>

        {/* Card 2: Today's collection */}
        <div className="glass-panel p-6 bg-gradient-to-br from-emerald-950/20 via-darkCard to-emerald-900/10 border-emerald-500/10 hover:border-emerald-500/20 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:opacity-[0.06] transition-opacity duration-300">
            <Calendar className="h-32 w-32 text-emerald-400" />
          </div>
          <div className="flex justify-between items-start">
            <p className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Today's Claims</p>
            <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-400">
              <Calendar className="h-5 w-5" />
            </div>
          </div>
          <h3 className="text-3xl font-black mt-4 text-white tracking-tight">{today_collected}</h3>
          <p className="text-[11px] text-emerald-500/70 mt-2 font-semibold flex items-center gap-1">
            <span>●</span> Active collections today
          </p>
        </div>

        {/* Card 3: Failed claims */}
        <div className="glass-panel p-6 bg-gradient-to-br from-red-950/20 via-darkCard to-red-900/10 border-red-500/10 hover:border-red-500/20 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:opacity-[0.06] transition-opacity duration-300">
            <AlertTriangle className="h-32 w-32 text-red-400" />
          </div>
          <div className="flex justify-between items-start">
            <p className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Failed Attempts</p>
            <div className="p-2 bg-red-500/10 rounded-lg text-red-400">
              <AlertTriangle className="h-5 w-5" />
            </div>
          </div>
          <h3 className="text-3xl font-black mt-4 text-white tracking-tight">{failed_attempts}</h3>
          <p className="text-[11px] text-gray-500 mt-2 font-medium">Requires credential or locator checks</p>
        </div>

        {/* Card 4: Success Rate */}
        <div className="glass-panel p-6 bg-gradient-to-br from-cyan-950/20 via-darkCard to-cyan-900/10 border-cyan-500/10 hover:border-cyan-500/20 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:opacity-[0.06] transition-opacity duration-300">
            <CheckCircle2 className="h-32 w-32 text-cyan-400" />
          </div>
          <div className="flex justify-between items-start">
            <p className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Success Rate</p>
            <div className="p-2 bg-cyan-500/10 rounded-lg text-cyan-400">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </div>
          <h3 className="text-3xl font-black mt-4 text-white tracking-tight">{success_rate}%</h3>
          
          {/* Custom micro progress bar */}
          <div className="w-full bg-gray-800 rounded-full h-1.5 mt-3 overflow-hidden">
            <div 
              className="bg-gradient-to-r from-cyan-500 to-indigo-500 h-1.5 rounded-full transition-all duration-500" 
              style={{ width: `${success_rate}%` }}
            ></div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Success Rate area chart (2/3 columns) */}
        <div className="glass-panel p-6 lg:col-span-2 flex flex-col justify-between h-[400px]">
          <div>
            <h4 className="font-bold text-lg text-white">Daily Run History</h4>
            <p className="text-gray-400 text-xs mt-0.5">Successful vs failed attempts over the last week.</p>
          </div>
          
          <div className="w-full h-[280px] mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={stats?.chart_data || []}
                margin={{ top: 10, right: 10, left: -25, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="colorSuccess" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorFailed" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.15}/>
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#2d2d34" opacity={0.3} />
                <XAxis 
                  dataKey="date" 
                  stroke="#9ca3af" 
                  fontSize={10} 
                  tickLine={false} 
                />
                <YAxis 
                  stroke="#9ca3af" 
                  fontSize={10} 
                  tickLine={false} 
                  allowDecimals={false}
                />
                <Tooltip content={<CustomTooltip />} />
                <Area 
                  type="monotone" 
                  dataKey="success" 
                  stroke="#10b981" 
                  strokeWidth={2}
                  fillOpacity={1} 
                  fill="url(#colorSuccess)" 
                />
                <Area 
                  type="monotone" 
                  dataKey="failed" 
                  stroke="#ef4444" 
                  strokeWidth={1.5}
                  fillOpacity={1} 
                  fill="url(#colorFailed)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Real-time Selenium Log Console (1/3 columns) */}
        <div className="glass-panel p-6 flex flex-col h-[400px]">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h4 className="font-bold text-lg text-white flex items-center gap-2">
                <Terminal className="h-5 w-5 text-purple-400" />
                Live Bot Terminal
              </h4>
              <p className="text-gray-400 text-xs mt-0.5">Real-time automation logs.</p>
            </div>
            
            <button
              onClick={clearConsole}
              disabled={consoleLogs.length === 0}
              className="btn-icon p-1.5 text-gray-500 hover:text-red-400 disabled:opacity-30 disabled:pointer-events-none"
              title="Clear Terminal Feed"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>

          {/* Console feed container */}
          <div className="flex-1 bg-black/60 border border-white/5 rounded-xl p-4 font-mono text-[10.5px] overflow-y-auto leading-relaxed shadow-inner flex flex-col-reverse">
            {consoleLogs.length === 0 ? (
              <div className="text-gray-500 italic h-full flex flex-col justify-center items-center text-center gap-2">
                <div className="h-2 w-2 rounded-full bg-purple-500 animate-pulse"></div>
                Waiting for browser activities...
              </div>
            ) : (
              consoleLogs.map((log, index) => (
                <div 
                  key={index}
                  className={`border-b border-white/[0.02] py-1 ${
                    log.status === 'success' 
                      ? 'text-emerald-400 font-semibold' 
                      : log.status === 'error' 
                      ? 'text-red-400 font-semibold' 
                      : log.status === 'warning' 
                      ? 'text-amber-400' 
                      : 'text-gray-300'
                  }`}
                >
                  <span className="text-gray-600 font-normal mr-2">[{log.timestamp}]</span>
                  <span className="text-purple-400 font-semibold mr-1.5">[{log.account_name}]</span>
                  {log.message}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
