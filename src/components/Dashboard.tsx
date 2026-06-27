"use client";

import { useEffect, useState } from "react";
import {
  Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer,
  Tooltip, XAxis, YAxis, Area, AreaChart,
} from "recharts";

type Stats = {
  catalogVersion: string;
  total: number;
  ransomware: number;
  ransomwarePct: number;
  uniqueVendors: number;
  topVendors: { name: string; count: number }[];
  topCwes: { name: string; count: number }[];
  timeline: { month: string; count: number }[];
};

const PIE_COLORS = ["#6366f1", "#3b82f6", "#06b6d4", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/kev-stats")
      .then((r) => r.json())
      .then(setStats)
      .catch((e) => setErr(String(e)));
  }, []);

  if (err) return <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-base text-red-700">{err}</div>;
  if (!stats) return <div className="p-8 text-center text-base text-slate-400">Loading threat landscape…</div>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="KEV entries" value={stats.total.toLocaleString()} accent="text-indigo-600" />
        <Stat label="Exploited in the wild" value="100%" accent="text-red-600" sub="every KEV entry" />
        <Stat label="Ransomware-linked" value={`${stats.ransomware}`} accent="text-rose-600" sub={`${stats.ransomwarePct}% of catalog`} />
        <Stat label="Affected vendors" value={stats.uniqueVendors.toLocaleString()} accent="text-blue-600" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Top affected vendors (CISA KEV)">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={stats.topVendors} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis type="number" tick={{ fontSize: 11, fill: "#64748b" }} />
              <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 11, fill: "#64748b" }} />
              <Tooltip />
              <Bar dataKey="count" fill="#6366f1" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Weakness classes (CWE distribution)">
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={stats.topCwes} dataKey="count" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={(p: any) => p.name}>
                {stats.topCwes.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </Card>

        <Card title="New KEV additions over time" full>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={stats.timeline}>
              <defs>
                <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.6} />
                  <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#64748b" }} />
              <YAxis tick={{ fontSize: 11, fill: "#64748b" }} />
              <Tooltip />
              <Area type="monotone" dataKey="count" stroke="#06b6d4" strokeWidth={2} fill="url(#g1)" />
            </AreaChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <p className="text-center text-sm text-slate-400">
        Source: CISA Known Exploited Vulnerabilities catalog · version {stats.catalogVersion}
      </p>
    </div>
  );
}

function Stat({ label, value, accent, sub }: { label: string; value: string; accent: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-sm font-medium uppercase tracking-wide text-slate-400">{label}</div>
      <div className={`mt-1 text-4xl font-bold ${accent}`}>{value}</div>
      {sub && <div className="text-sm text-slate-400">{sub}</div>}
    </div>
  );
}
function Card({ title, children, full }: { title: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={`rounded-2xl border border-slate-200 bg-white p-4 shadow-sm ${full ? "lg:col-span-2" : ""}`}>
      <h3 className="mb-3 text-base font-semibold text-slate-700">{title}</h3>
      {children}
    </div>
  );
}
