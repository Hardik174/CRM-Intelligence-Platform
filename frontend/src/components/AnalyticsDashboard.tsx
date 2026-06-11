import React, { useState, useEffect } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from "recharts";
import { TrendingUp, AlertTriangle, Clock, Smile, Inbox } from "lucide-react";

interface AnalyticsDashboardProps {
  backendUrl: string;
}

export const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({ backendUrl }) => {
  const [sentimentData, setSentimentData] = useState<any[]>([]);
  const [categoryData, setCategoryData] = useState<any[]>([]);
  const [atRiskSenders, setAtRiskSenders] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Mock static values for agent performance counters & heatmap
  const performanceStats = {
    autoReplyRate: 68,
    escalationRate: 32,
    avgConfidence: 89.2,
    avgResponseTimeMinutes: 14.5
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      // 1. Fetch sentiment trend
      const sentRes = await fetch(`${backendUrl}/analytics/sentiment-trend?days=30`);
      if (sentRes.ok) {
        const d = await sentRes.json();
        setSentimentData(d.trend || []);
      }

      // 2. Fetch category breakdown
      const catRes = await fetch(`${backendUrl}/analytics/category-breakdown?days=30`);
      if (catRes.ok) {
        const d = await catRes.json();
        const formatted = Object.entries(d.breakdown || {}).map(([name, value]) => ({
          name,
          value
        }));
        setCategoryData(formatted);
      }

      // 3. Fetch all contacts to determine churn risk / at-risk accounts
      const contactRes = await fetch(`${backendUrl}/contacts`);
      if (contactRes.ok) {
        const contacts = await contactRes.json();
        // filter contacts with high churn risk (> 0.6) or blocked
        const atRisk = contacts.filter((c: any) => c.churn_risk_score > 0.5 || c.status === "Churned" || c.status === "Blocked");
        setAtRiskSenders(atRisk);
      }
    } catch (e) {
      console.error("Failed to load analytics charts:", e);
    } finally {
      setLoading(false);
    }
  };

  const COLORS = ["#7c3aed", "#0d9488", "#2563eb", "#ea580c", "#e11d48", "#16a34a", "#ca8a04"];

  // Heatmap generation: Hours 0-23 (divided in 6 block groups of 4 hours), Days Mon-Sun
  const daysOfWeek = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const hourBlocks = ["00-04", "04-08", "08-12", "12-16", "16-20", "20-24"];
  // Heatmap values representation (volume density index)
  const heatmapData = [
    [12, 18, 45, 85, 62, 22], // Mon
    [14, 22, 60, 95, 70, 18], // Tue
    [10, 15, 55, 80, 58, 25], // Wed
    [15, 20, 65, 90, 75, 30], // Thu
    [18, 25, 50, 75, 85, 40], // Fri
    [5, 8, 12, 15, 10, 8],    // Sat
    [3, 5, 8, 10, 12, 5]      // Sun
  ];

  const getHeatmapColor = (val: number) => {
    if (val > 80) return "bg-primary text-primary-foreground"; // super dense purple
    if (val > 50) return "bg-primary/70 text-white";
    if (val > 20) return "bg-primary/45 text-muted-foreground";
    return "bg-secondary/60 text-muted-foreground";
  };

  if (loading) {
    return (
      <div className="flex-grow flex justify-center items-center h-full bg-card rounded-xl border border-border p-8">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
          <span className="text-sm text-muted-foreground">Aggregating Business Intelligence...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col gap-6 overflow-y-auto p-2">
      
      {/* KPI Stats Counter Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-xl p-4 flex items-center justify-between">
          <div>
            <span className="text-xs text-muted-foreground block">Auto-Reply Rate</span>
            <span className="text-2xl font-extrabold title-font text-white">
              {performanceStats.autoReplyRate}%
            </span>
          </div>
          <Smile className="w-8 h-8 text-emerald-400 opacity-80 bg-emerald-500/10 p-1.5 rounded-lg border border-emerald-500/20" />
        </div>

        <div className="bg-card border border-border rounded-xl p-4 flex items-center justify-between">
          <div>
            <span className="text-xs text-muted-foreground block">Escalation Rate</span>
            <span className="text-2xl font-extrabold title-font text-white">
              {performanceStats.escalationRate}%
            </span>
          </div>
          <AlertTriangle className="w-8 h-8 text-rose-400 opacity-80 bg-rose-500/10 p-1.5 rounded-lg border border-rose-500/20" />
        </div>

        <div className="bg-card border border-border rounded-xl p-4 flex items-center justify-between">
          <div>
            <span className="text-xs text-muted-foreground block">Avg Confidence</span>
            <span className="text-2xl font-extrabold title-font text-white">
              {performanceStats.avgConfidence}%
            </span>
          </div>
          <TrendingUp className="w-8 h-8 text-accent opacity-80 bg-accent/10 p-1.5 rounded-lg border border-accent/20" />
        </div>

        <div className="bg-card border border-border rounded-xl p-4 flex items-center justify-between">
          <div>
            <span className="text-xs text-muted-foreground block">Mean Triage Speed</span>
            <span className="text-2xl font-extrabold title-font text-white">
              {performanceStats.avgResponseTimeMinutes}s
            </span>
          </div>
          <Clock className="w-8 h-8 text-blue-400 opacity-80 bg-blue-500/10 p-1.5 rounded-lg border border-blue-500/20" />
        </div>
      </div>

      {/* Main Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Sentiment Trend Chart */}
        <div className="bg-card border border-border rounded-xl p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <h3 className="title-font font-bold text-white text-base">Sentiment Trend (30 Days)</h3>
            <span className="text-xs text-emerald-400 font-semibold bg-emerald-500/10 px-2 py-0.5 rounded">
              Moving Avg
            </span>
          </div>
          <div className="h-64 w-full">
            {sentimentData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-muted-foreground text-xs">
                No sentiment data points available. Ingest emails to generate trend.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={sentimentData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                  <XAxis dataKey="date" stroke="#4b5563" fontSize={10} />
                  <YAxis domain={[-1, 1]} stroke="#4b5563" fontSize={10} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#1e293b", borderColor: "#334155", borderRadius: "8px" }}
                    labelStyle={{ color: "#94a3b8", fontWeight: "bold" }}
                  />
                  <Line type="monotone" dataKey="sentiment_score" stroke="#7c3aed" strokeWidth={3} dot={{ fill: "#7c3aed", r: 4 }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Category Breakdown Bar Chart */}
        <div className="bg-card border border-border rounded-xl p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <h3 className="title-font font-bold text-white text-base">Triage Category Distribution</h3>
            <span className="text-xs text-primary font-semibold bg-primary/10 px-2 py-0.5 rounded">
              Incoming Volume
            </span>
          </div>
          <div className="h-64 w-full">
            {categoryData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-muted-foreground text-xs">
                No categorical distributions logged yet.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categoryData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                  <XAxis dataKey="name" stroke="#4b5563" fontSize={10} />
                  <YAxis stroke="#4b5563" fontSize={10} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#1e293b", borderColor: "#334155", borderRadius: "8px" }}
                  />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {categoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Response Density Heatmap & At-Risk Accounts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Heatmap Section */}
        <div className="bg-card border border-border rounded-xl p-5 lg:col-span-2 flex flex-col gap-4">
          <div className="border-b border-border pb-3 flex justify-between items-center">
            <h3 className="title-font font-bold text-white text-base">Inbound Volume Heatmap (Hour vs Day)</h3>
            <span className="text-[10px] text-muted-foreground italic">Downtime density indicators</span>
          </div>
          <div className="flex flex-col gap-2">
            {/* Header Hour blocks */}
            <div className="flex text-[10px] font-bold text-muted-foreground pl-10">
              {hourBlocks.map((block) => (
                <div key={block} className="flex-1 text-center">{block}</div>
              ))}
            </div>
            
            {/* Heatmap Grid Row */}
            <div className="flex flex-col gap-1.5">
              {daysOfWeek.map((day, dIdx) => (
                <div key={day} className="flex items-center gap-1.5">
                  <div className="w-8 text-xs font-bold text-muted-foreground">{day}</div>
                  <div className="flex-1 flex gap-1.5">
                    {heatmapData[dIdx].map((val, hIdx) => (
                      <div
                        key={hIdx}
                        className={`flex-1 aspect-video rounded flex items-center justify-center text-xs font-bold transition-all hover:scale-105 ${getHeatmapColor(val)}`}
                        title={`Volume index: ${val}`}
                      >
                        {val}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* At-Risk Accounts ledger */}
        <div className="bg-card border border-border rounded-xl p-5 flex flex-col gap-4">
          <div className="border-b border-border pb-3 flex items-center justify-between">
            <h3 className="title-font font-bold text-white text-base">At-Risk CRM Accounts</h3>
            <span className="bg-rose-500/20 text-rose-400 text-[10px] px-2 py-0.5 rounded font-bold">ALERT</span>
          </div>
          
          <div className="flex-1 overflow-y-auto max-h-60 flex flex-col gap-3">
            {atRiskSenders.length === 0 ? (
              <div className="text-center text-xs text-muted-foreground py-8">
                No accounts identified as high-risk at this moment.
              </div>
            ) : (
              atRiskSenders.map((c) => (
                <div key={c.id} className="p-3 bg-secondary/30 rounded-lg border border-border flex flex-col gap-1">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-xs text-white truncate max-w-[120px]">{c.email}</span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                      c.status === "Blocked" || c.status === "Churned" ? "bg-rose-500/10 text-rose-400" : "bg-amber-500/10 text-amber-400"
                    }`}>
                      {c.status}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-[10px] text-muted-foreground mt-1">
                    <span>Val: <b className="text-emerald-400">${c.account_value.toLocaleString()}</b></span>
                    <span>Churn Risk: <b className="text-rose-400">{(c.churn_risk_score * 100).toFixed(0)}%</b></span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
