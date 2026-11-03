import React, { useState, useEffect, useCallback } from 'react';
import { 
  Users, 
  Eye, 
  Smartphone, 
  Monitor, 
  Tablet, 
  TrendingUp, 
  Clock, 
  Globe2, 
  Activity, 
  RefreshCw, 
  ShieldCheck, 
  AlertTriangle, 
  Info, 
  ExternalLink, 
  Copy, 
  Check, 
  ArrowUpRight, 
  FileSpreadsheet, 
  Sparkles,
  Layers,
  MapPin,
  ChevronRight
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid, 
  PieChart, 
  Pie, 
  Cell, 
  BarChart, 
  Bar, 
  Legend 
} from 'recharts';
import { UserRole, CreatorProfile } from '../types';

interface AdminAnalyticsProps {
  currentRole: UserRole;
  creatorProfile?: CreatorProfile | null;
  onClose?: () => void;
}

interface GA4DataPayload {
  status: 'live' | 'demo_mode' | 'error';
  isConfigured: boolean;
  propertyId?: string;
  errorMessage?: string;
  dateRange: string;
  lastUpdated: string;
  data: {
    realtimeActiveUsers: number;
    summary: {
      totalVisitors: number;
      activeUsers: number;
      pageViews: number;
      sessions: number;
      newUsers: number;
      avgSessionDuration: string;
      bounceRate: string;
      engagementRate: string;
    };
    trend: Array<{
      date: string;
      formattedDate: string;
      visitors: number;
      pageviews: number;
      sessions: number;
    }>;
    deviceBreakdown: Array<{
      device: string;
      visitors: number;
      percentage: number;
      fill: string;
    }>;
    trafficChannels: Array<{
      channel: string;
      visitors: number;
      sessions: number;
      percentage: number;
    }>;
    topCities: Array<{
      city: string;
      country: string;
      visitors: number;
      pageviews: number;
    }>;
    topPages: Array<{
      path: string;
      title: string;
      views: number;
      uniqueVisitors: number;
    }>;
  };
}

export const AdminAnalytics: React.FC<AdminAnalyticsProps> = ({
  currentRole,
  onClose,
}) => {
  const [dateRange, setDateRange] = useState<'today' | '7d' | '30d' | '90d'>('30d');
  const [report, setReport] = useState<GA4DataPayload | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [showSetupModal, setShowSetupModal] = useState<boolean>(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [measurementIdInput, setMeasurementIdInput] = useState<string>(() => {
    try {
      return localStorage.getItem('ronpay_ga_measurement_id') || '';
    } catch {
      return '';
    }
  });
  const [isSavedMeasurementId, setIsSavedMeasurementId] = useState<boolean>(false);

  const handleSaveMeasurementId = () => {
    const clean = measurementIdInput.trim().toUpperCase();
    if (clean) {
      localStorage.setItem('ronpay_ga_measurement_id', clean);
      setIsSavedMeasurementId(true);
      setTimeout(() => setIsSavedMeasurementId(false), 3000);
      // Dynamically load Google Tag if not yet present
      if (typeof window !== 'undefined' && !document.querySelector(`script[src*="${clean}"]`)) {
        const s = document.createElement('script');
        s.async = true;
        s.src = `https://www.googletagmanager.com/gtag/js?id=${clean}`;
        document.head.appendChild(s);
        (window as any).dataLayer = (window as any).dataLayer || [];
        const gtag = (...args: any[]) => { (window as any).dataLayer.push(args); };
        (window as any).gtag = gtag;
        gtag('js', new Date());
        gtag('config', clean, { send_page_view: true });
      }
    }
  };

  // Security Check: strictly Admin or Super Admin only
  const isAuthorized = currentRole === 'ADMIN' || currentRole === 'SUPER_ADMIN';

  const fetchAnalytics = useCallback(async (range: string, silent: boolean = false) => {
    if (!silent) setIsLoading(true);
    else setIsRefreshing(true);

    try {
      const res = await fetch(`/api/analytics/ga4?range=${range}`);
      if (res.ok) {
        const json: GA4DataPayload = await res.json();
        setReport(json);
      } else {
        throw new Error(`Server returned HTTP ${res.status}`);
      }
    } catch (err: any) {
      console.warn('[AdminAnalytics] Fetch notice:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchAnalytics(dateRange);
  }, [dateRange, fetchAnalytics]);

  // Copy helper
  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(id);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  // CSV Export
  const handleExportCSV = () => {
    if (!report?.data) return;
    const rows = [
      ['Date', 'Formatted Date', 'Active Visitors', 'Pageviews', 'Sessions'],
      ...report.data.trend.map(t => [t.date, t.formattedDate, t.visitors, t.pageviews, t.sessions])
    ];
    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map(e => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `ronpay_analytics_${dateRange}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!isAuthorized) {
    return (
      <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 shadow-sm max-w-lg mx-auto my-12">
        <div className="w-14 h-14 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <ShieldCheck className="w-7 h-7" />
        </div>
        <h3 className="text-lg font-black text-slate-800">Permission Required</h3>
        <p className="text-sm text-slate-600 mt-2">
          He Visitors Statistic (GA4) hi Admin leh Super Admin te chiahin an en thei a ni.
        </p>
        {onClose && (
          <button
            onClick={onClose}
            className="mt-5 px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition cursor-pointer"
          >
            Kir Leh Rawh
          </button>
        )}
      </div>
    );
  }

  const summary = report?.data?.summary;
  const realtime = report?.data?.realtimeActiveUsers ?? 0;
  const isDemo = report?.status === 'demo_mode' || !report?.isConfigured;

  return (
    <div className="space-y-5 animate-fadeIn">
      {/* Demo Standby Warning Banner */}
      {isDemo && (
        <div className="bg-gradient-to-r from-amber-950 via-slate-900 to-amber-950 border-2 border-amber-500/70 text-amber-100 p-4 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-3 shadow-lg animate-fadeIn">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-400/40 text-amber-400 flex items-center justify-center shrink-0 mt-0.5 shadow-inner">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-black text-amber-300 uppercase tracking-wide flex items-center gap-2">
                <span>Google Analytics 4 Credentials In-Thlun A La Ni Lo (Demo Mode)</span>
              </h4>
              <p className="text-xs text-amber-100/90 mt-1 leading-relaxed">
                Tuna graphics leh numbers lang mek te hi <b>Sample Preview Data</b> (demo UI en chhinna) a ni e. Minutes 20 chhung leka tlawhtu dik tak endik tur chuan <b>Google Analytics 4 Property ID</b> leh <b>Service Account JSON Key</b> hi app environment variables (<code>.env</code>) ah thun tur a ni.
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowSetupModal(true)}
            className="px-4 py-2 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs rounded-xl transition shrink-0 cursor-pointer shadow-sm active:scale-95 flex items-center gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5 text-slate-900" />
            <span>GA4 Thlunzawm Dan (Guide)</span>
          </button>
        </div>
      )}

      {/* Top Header Banner & Controls */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-5 rounded-2xl border border-indigo-500/30 shadow-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-indigo-600/60 border border-indigo-400/40 text-amber-300 flex items-center justify-center font-black shadow-inner">
                <TrendingUp className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-black tracking-tight text-white flex items-center gap-2">
                  <span>Visitors & Web Traffic Statistics</span>
                  {isDemo ? (
                    <span 
                      onClick={() => setShowSetupModal(true)}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-400/30 cursor-pointer hover:bg-amber-500/30 transition"
                      title="Click to view Google Analytics 4 Setup Instructions"
                    >
                      <Sparkles className="w-3 h-3 text-amber-400" />
                      <span>Demo Mode (GA4 Standby)</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                      <ShieldCheck className="w-3 h-3 text-emerald-400" />
                      <span>GA4 Live Connected</span>
                    </span>
                  )}
                </h2>
                <p className="text-xs text-slate-300 mt-0.5">
                  Google Analytics 4 Data API hmangin live visitors leh devices endik a ni (Zero Supabase Egress).
                </p>
              </div>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Date Range Selector */}
            <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-0.5 flex text-xs font-bold shadow-inner">
              {[
                { id: 'today', label: 'Vawiin' },
                { id: '7d', label: '7 Ni' },
                { id: '30d', label: '30 Ni' },
                { id: '90d', label: '90 Ni' },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setDateRange(tab.id as any)}
                  className={`px-3 py-1 rounded-lg transition text-[11px] font-black cursor-pointer ${
                    dateRange === tab.id
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Refresh */}
            <button
              onClick={() => fetchAnalytics(dateRange, true)}
              disabled={isRefreshing}
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl border border-slate-700 transition cursor-pointer active:scale-95 disabled:opacity-50"
              title="Refresh Analytics"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-amber-300' : ''}`} />
            </button>

            {/* Export CSV */}
            <button
              onClick={handleExportCSV}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl border border-slate-700 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
              title="Download Report in CSV"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">Export</span>
            </button>

            {/* GA4 Setup Instructions Button */}
            <button
              onClick={() => setShowSetupModal(true)}
              className="px-3 py-1.5 bg-indigo-600/40 hover:bg-indigo-600 border border-indigo-400/40 text-amber-300 hover:text-white rounded-xl text-xs font-black flex items-center gap-1.5 transition cursor-pointer"
            >
              <Info className="w-3.5 h-3.5" />
              <span>GA4 Setup Guide</span>
            </button>
          </div>
        </div>

        {/* Live Active Pulse Badge */}
        <div className="mt-4 pt-3.5 border-t border-indigo-500/20 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <span className="text-slate-200 font-bold">
              Realtime Active Users (Last 30 mins):{' '}
              <b className="text-emerald-400 text-sm font-black">{realtime}</b>
            </span>
          </div>

          <div className="text-[11px] text-slate-400 flex items-center gap-2">
            <span>Last checked: {report ? new Date(report.lastUpdated).toLocaleTimeString() : 'Updating...'}</span>
            <span>•</span>
            <span className="text-indigo-300">Target: GA4 Property ID {report?.propertyId || 'Standby'}</span>
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Total Visitors */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs relative overflow-hidden group hover:border-indigo-300 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Visitors</span>
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5">
            <div className="text-2xl font-black text-slate-900 tracking-tight">
              {isLoading ? '...' : (summary?.totalVisitors || 0).toLocaleString('en-IN')}
            </div>
            <div className="flex items-center gap-1.5 mt-1 text-[11px] font-bold text-emerald-600">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Active on RonPay App</span>
            </div>
          </div>
        </div>

        {/* Pageviews */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs relative overflow-hidden group hover:border-cyan-300 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Pageviews</span>
            <div className="w-8 h-8 rounded-xl bg-cyan-50 text-cyan-600 flex items-center justify-center">
              <Eye className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5">
            <div className="text-2xl font-black text-slate-900 tracking-tight">
              {isLoading ? '...' : (summary?.pageViews || 0).toLocaleString('en-IN')}
            </div>
            <div className="flex items-center gap-1.5 mt-1 text-[11px] font-bold text-slate-500">
              <Layers className="w-3.5 h-3.5 text-cyan-500" />
              <span>{(summary?.sessions || 0).toLocaleString('en-IN')} Sessions</span>
            </div>
          </div>
        </div>

        {/* New Visitors */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs relative overflow-hidden group hover:border-amber-300 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">New Visitors</span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5">
            <div className="text-2xl font-black text-slate-900 tracking-tight">
              {isLoading ? '...' : (summary?.newUsers || 0).toLocaleString('en-IN')}
            </div>
            <div className="flex items-center gap-1.5 mt-1 text-[11px] font-bold text-slate-500">
              <span>Engagement: <b className="text-amber-600">{summary?.engagementRate || '75%'}</b></span>
            </div>
          </div>
        </div>

        {/* Avg Duration */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs relative overflow-hidden group hover:border-emerald-300 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Avg Session Time</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5">
            <div className="text-2xl font-black text-slate-900 tracking-tight">
              {isLoading ? '...' : (summary?.avgSessionDuration || '0m 0s')}
            </div>
            <div className="flex items-center gap-1.5 mt-1 text-[11px] font-bold text-slate-500">
              <span>Bounce: <b className="text-slate-700">{summary?.bounceRate || '25%'}</b></span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Charts: Trend Area Chart & Device Breakdown Pie Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Visitors & Pageviews Time-Series Chart (2 Columns) */}
        <div className="lg:col-span-2 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <span>Visitors & Pageviews Over Time</span>
                <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md">
                  {dateRange.toUpperCase()}
                </span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Daily active visitors (indigo) leh pageviews (cyan) in-thlauh dan.
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs font-bold">
              <span className="flex items-center gap-1.5 text-indigo-600">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-600" /> Visitors
              </span>
              <span className="flex items-center gap-1.5 text-cyan-500">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-500" /> Pageviews
              </span>
            </div>
          </div>

          <div className="h-64 sm:h-72 w-full">
            {report?.data?.trend && report.data.trend.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={report.data.trend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorVisitors" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="colorViews" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="formattedDate" 
                    tick={{ fontSize: 10, fill: '#64748b' }} 
                    axisLine={{ stroke: '#e2e8f0' }}
                    tickLine={false}
                  />
                  <YAxis 
                    tick={{ fontSize: 10, fill: '#64748b' }} 
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#0f172a', 
                      borderRadius: '12px', 
                      border: '1px solid #334155',
                      color: '#fff',
                      fontSize: '11px',
                      fontWeight: 'bold'
                    }} 
                  />
                  <Area 
                    type="monotone" 
                    dataKey="pageviews" 
                    stroke="#06b6d4" 
                    strokeWidth={2}
                    fillOpacity={1} 
                    fill="url(#colorViews)" 
                    name="Pageviews"
                  />
                  <Area 
                    type="monotone" 
                    dataKey="visitors" 
                    stroke="#6366f1" 
                    strokeWidth={2.5}
                    fillOpacity={1} 
                    fill="url(#colorVisitors)" 
                    name="Active Visitors"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                No trend data available for this range
              </div>
            )}
          </div>
        </div>

        {/* Device Breakdown Donut Chart (1 Column) */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
              <span>Device Breakdown</span>
              <Smartphone className="w-4 h-4 text-indigo-500" />
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Mobile, Desktop leh Tablet hmandan.
            </p>
          </div>

          <div className="h-48 w-full my-auto">
            {report?.data?.deviceBreakdown && (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={report.data.deviceBreakdown}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={75}
                    paddingAngle={4}
                    dataKey="visitors"
                  >
                    {report.data.deviceBreakdown.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#0f172a', 
                      borderRadius: '12px', 
                      border: '1px solid #334155',
                      color: '#fff',
                      fontSize: '11px',
                      fontWeight: 'bold'
                    }} 
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Device Badges */}
          <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-100 text-center">
            {report?.data?.deviceBreakdown?.map((d) => (
              <div key={d.device} className="p-2 bg-slate-50 rounded-xl border border-slate-100">
                <div className="flex items-center justify-center gap-1 text-[11px] font-black text-slate-700">
                  {d.device === 'Mobile' && <Smartphone className="w-3 h-3 text-indigo-600" />}
                  {d.device === 'Desktop' && <Monitor className="w-3 h-3 text-cyan-600" />}
                  {d.device === 'Tablet' && <Tablet className="w-3 h-3 text-amber-600" />}
                  <span>{d.device}</span>
                </div>
                <div className="text-sm font-black text-slate-900 mt-0.5">{d.percentage}%</div>
                <div className="text-[9.5px] text-slate-400 font-bold">{d.visitors.toLocaleString('en-IN')}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Traffic Channels & Top Cities Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Top Traffic Acquisition Channels */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-3.5">
            <div>
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <Globe2 className="w-4 h-4 text-indigo-500" />
                <span>Traffic Acquisition Channels</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Khawi hmun atangin nge visitors an rawn luh (Direct, WhatsApp, Search).
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {report?.data?.trafficChannels?.map((ch) => (
              <div key={ch.channel} className="space-y-1">
                <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                  <span>{ch.channel}</span>
                  <span>
                    <b className="text-slate-900">{ch.visitors.toLocaleString('en-IN')}</b> visitors ({ch.percentage}%)
                  </span>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-indigo-500 to-indigo-600 rounded-full transition-all duration-500"
                    style={{ width: `${ch.percentage}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top Cities / Localities (Mizoram & Beyond) */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-3.5">
            <div>
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-amber-500" />
                <span>Top Cities & Localities</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Mizoram khaw hrang hrang leh state dang atanga tlawhtute.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 font-bold uppercase text-[10px]">
                  <th className="pb-2">Khua / City</th>
                  <th className="pb-2 text-right">Visitors</th>
                  <th className="pb-2 text-right">Pageviews</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-bold">
                {report?.data?.topCities?.slice(0, 6).map((c) => (
                  <tr key={c.city} className="hover:bg-slate-50/80 transition">
                    <td className="py-2 flex items-center gap-1.5 text-slate-800">
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                      <span>{c.city}</span>
                      <span className="text-[10px] text-slate-400">({c.country})</span>
                    </td>
                    <td className="py-2 text-right text-slate-900">{c.visitors.toLocaleString('en-IN')}</td>
                    <td className="py-2 text-right text-slate-500">{c.pageviews.toLocaleString('en-IN')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Top Pages / Visited Screens */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <h3 className="text-sm font-black text-slate-900 mb-1 flex items-center gap-2">
          <Eye className="w-4 h-4 text-cyan-600" />
          <span>Top Screens & Pages Visited</span>
        </h3>
        <p className="text-xs text-slate-500 mb-4">
          RonPay app-a screen leh bawm hman lar ber ber te.
        </p>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 text-slate-400 font-bold uppercase text-[10px]">
                <th className="pb-2">Path / Screen Title</th>
                <th className="pb-2 text-right">Views</th>
                <th className="pb-2 text-right">Unique Visitors</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-bold">
              {report?.data?.topPages?.map((p) => (
                <tr key={p.path} className="hover:bg-slate-50/80 transition">
                  <td className="py-2.5">
                    <div className="text-slate-900 font-extrabold">{p.title}</div>
                    <div className="text-[10px] text-slate-400 font-mono">{p.path}</div>
                  </td>
                  <td className="py-2.5 text-right font-black text-indigo-700">
                    {p.views.toLocaleString('en-IN')}
                  </td>
                  <td className="py-2.5 text-right text-slate-600">
                    {p.uniqueVisitors.toLocaleString('en-IN')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* GA4 Setup Modal */}
      {showSetupModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200 p-6 space-y-5 animate-scaleUp">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-black">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">Google Analytics 4 (GA4) Setup Guide</h3>
                  <p className="text-xs text-slate-500">Service Account leh Property ID set dan kaihhruaina</p>
                </div>
              </div>
              <button
                onClick={() => setShowSetupModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs text-slate-600 leading-relaxed">
              {/* Step 0 - Measurement ID Web Tracker */}
              <div className="p-3.5 bg-indigo-50/80 rounded-2xl border border-indigo-200 space-y-2">
                <div className="font-black text-indigo-950 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-[11px] flex items-center justify-center">0</span>
                    <span>Website Tracking Tag (Measurement ID - Pawimawh Ber):</span>
                  </div>
                  <span className="text-[10px] bg-indigo-600 text-white px-2 py-0.5 rounded-full font-bold">Client Tracker</span>
                </div>
                <p className="pl-7 text-indigo-900 leading-relaxed">
                  Google Analytics-in <b>Web-a rawn luttute a chhinchhiah (track) theih nan</b> GA4 Measurement ID (<code>G-XXXXXXXXXX</code>) hi website-ah a in-thlun a ngai a ni. (analytics.google.com &gt; <b>Admin &gt; Data Streams &gt; Web</b> ah a awm).
                </p>
                <div className="pl-7 flex flex-col sm:flex-row items-center gap-2 pt-1">
                  <input
                    type="text"
                    value={measurementIdInput}
                    onChange={(e) => setMeasurementIdInput(e.target.value)}
                    placeholder="Entirnan: G-XXXXXXXXXX"
                    className="w-full sm:w-64 px-3 py-1.5 rounded-xl border border-indigo-300 bg-white text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={handleSaveMeasurementId}
                    className="w-full sm:w-auto px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-xs shrink-0"
                  >
                    {isSavedMeasurementId ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Sparkles className="w-3.5 h-3.5" />}
                    <span>{isSavedMeasurementId ? 'Tracking Tag Saved!' : 'Save & Activate Tracking'}</span>
                  </button>
                </div>
              </div>

              {/* Step 1 */}
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-1.5">
                <div className="font-black text-slate-900 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-[11px] flex items-center justify-center">1</span>
                  <span>Google Cloud Console-ah Service Account siam rawh:</span>
                </div>
                <p className="pl-7 text-slate-600">
                  Google Cloud Console (console.cloud.google.com) ah lut la, <b>IAM & Admin &gt; Service Accounts</b> ah <b>Create Service Account</b> hmet rawh (e.g. <code>ga4-stats-reader</code>). Role-ah <b>Viewer</b> pe rawh.
                </p>
                <div className="pl-7">
                  <b>APIs & Services &gt; Library</b> ah lut la, <b>Google Analytics Data API</b> kha <b>ENABLE</b> bawk rawh.
                </div>
              </div>

              {/* Step 2 */}
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-1.5">
                <div className="font-black text-slate-900 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-[11px] flex items-center justify-center">2</span>
                  <span>Service Account Key (JSON) download rawh:</span>
                </div>
                <p className="pl-7 text-slate-600">
                  I Service Account siam thar kha click la, <b>Keys &gt; Add Key &gt; Create new key (JSON)</b> thlang la, JSON file a in download ang.
                </p>
              </div>

              {/* Step 3 */}
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-1.5">
                <div className="font-black text-slate-900 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-[11px] flex items-center justify-center">3</span>
                  <span>Google Analytics 4 Property Access-ah Service Account Email kha thun rawh:</span>
                </div>
                <p className="pl-7 text-slate-600">
                  analytics.google.com ah lut la &gt; <b>Admin (Gear icon) &gt; Property Access Management &gt; (+) Add users</b>. 
                  Service Account Email (e.g. <code>ga4-reader@your-project.iam.gserviceaccount.com</code>) kha thun la, role-ah <b>Viewer</b> thlang rawh.
                </p>
              </div>

              {/* Step 4 */}
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2">
                <div className="font-black text-slate-900 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-[11px] flex items-center justify-center">4</span>
                  <span>Environment Variables (.env) ah dah rawh:</span>
                </div>
                <p className="pl-7 text-slate-600">
                  I GA4 Property ID (Admin &gt; Property Settings &gt; Property Details zawn a numeric ID, e.g. <code>429817263</code>) leh Service account credentials te hi <code>.env</code> file-ah dah tur a ni:
                </p>

                <div className="pl-7 relative">
                  <pre className="bg-slate-950 text-indigo-200 p-3 rounded-xl font-mono text-[11px] overflow-x-auto leading-normal">
{`# Google Analytics 4 Data API Credentials
GA4_PROPERTY_ID=123456789
GA4_CLIENT_EMAIL=ga4-reader@your-project.iam.gserviceaccount.com
GA4_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\\nMIIEvgIBADANBgk...\\n-----END PRIVATE KEY-----\\n"`}
                  </pre>
                  <button
                    onClick={() => handleCopy(`GA4_PROPERTY_ID=123456789\nGA4_CLIENT_EMAIL=your-sa@project.iam.gserviceaccount.com\nGA4_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\\n...\\n-----END PRIVATE KEY-----\\n"`, 'env_snippet')}
                    className="absolute top-2 right-2 px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                  >
                    {copiedKey === 'env_snippet' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedKey === 'env_snippet' ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end">
              <button
                onClick={() => setShowSetupModal(false)}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-black text-xs transition cursor-pointer active:scale-95"
              >
                Ka Hrethiam E (Close)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
