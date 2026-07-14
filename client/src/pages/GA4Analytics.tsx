import { useState, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend
} from "recharts";
import {
  Users, TrendingUp, Globe, Monitor, Smartphone, Tablet,
  ExternalLink, RefreshCw, CheckCircle2, AlertCircle
} from "lucide-react";

const DATE_RANGES = [
  { value: "7daysAgo", label: "Last 7 days" },
  { value: "14daysAgo", label: "Last 14 days" },
  { value: "30daysAgo", label: "Last 30 days" },
  { value: "90daysAgo", label: "Last 90 days" },
];

const CHANNEL_COLORS: Record<string, string> = {
  "Organic Search": "#16a34a",
  "Direct": "#2563eb",
  "Organic Social": "#9333ea",
  "Referral": "#ea580c",
  "Email": "#0891b2",
  "Paid Search": "#dc2626",
  "Paid Social": "#d97706",
  "Unassigned": "#6b7280",
};

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}m ${s}s`;
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

export default function GA4Analytics() {
  const [propertyKey, setPropertyKey] = useState<"main" | "academy">("main");
  const [dateRange, setDateRange] = useState("30daysAgo");

  const { data: statusData } = trpc.ga4.getStatus.useQuery();
  const { data: authUrlData } = trpc.ga4.getAuthUrl.useQuery();

  const {
    data: report,
    isLoading,
    error,
    refetch,
  } = trpc.ga4.fetchReport.useQuery(
    { propertyKey, startDate: dateRange, endDate: "today" },
    { enabled: !!statusData?.connected, retry: false }
  );

  const handleConnect = useCallback(() => {
    if (!authUrlData?.url) {
      toast.error("Could not generate authorization URL. Check Google OAuth credentials.");
      return;
    }
    const popup = window.open(authUrlData.url, "ga4auth", "width=600,height=700");
    const handler = (e: MessageEvent) => {
      if (e.data?.type === "GA4_AUTH_SUCCESS") {
        window.removeEventListener("message", handler);
        popup?.close();
        toast.success("Google Analytics 4 connected!");
        refetch();
      }
    };
    window.addEventListener("message", handler);
  }, [authUrlData, refetch]);

  const isConnected = statusData?.connected;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Google Analytics 4</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Site analytics across your main site and Academy
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {isConnected ? (
            <Badge variant="outline" className="text-green-600 border-green-300 bg-green-50 gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> Connected
            </Badge>
          ) : (
            <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50 gap-1">
              <AlertCircle className="w-3.5 h-3.5" /> Not connected
            </Badge>
          )}
          {!isConnected && (
            <Button size="sm" onClick={handleConnect} className="gap-2">
              <ExternalLink className="w-4 h-4" />
              Connect Google Analytics
            </Button>
          )}
          {isConnected && (
            <Button size="sm" variant="outline" onClick={() => refetch()} className="gap-2">
              <RefreshCw className="w-4 h-4" />
              Refresh
            </Button>
          )}
        </div>
      </div>

      {/* Not connected state */}
      {!isConnected && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <AlertCircle className="w-6 h-6 text-amber-600 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-amber-800">Google Analytics 4 not connected</p>
                <p className="text-sm text-amber-700 mt-1">
                  Click "Connect Google Analytics" above to authorize access. You'll be redirected to
                  Google to grant read-only access to your Analytics data. Both properties
                  (theurbanmonk.com and the Kajabi Academy) will be accessible after connecting.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {isConnected && (
        <>
          {/* Property + Date Range selectors */}
          <div className="flex gap-3 flex-wrap">
            <Select value={propertyKey} onValueChange={(v) => setPropertyKey(v as "main" | "academy")}>
              <SelectTrigger className="w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="main">Main Site (theurbanmonk.com)</SelectItem>
                <SelectItem value="academy">Kajabi Academy</SelectItem>
              </SelectContent>
            </Select>
            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DATE_RANGES.map((r) => (
                  <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Loading */}
          {isLoading && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <Card key={i}>
                  <CardContent className="pt-6">
                    <div className="h-8 bg-muted animate-pulse rounded mb-2" />
                    <div className="h-4 bg-muted animate-pulse rounded w-2/3" />
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Error */}
          {error && (
            <Card className="border-red-200 bg-red-50">
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-medium text-red-800">Failed to load analytics data</p>
                    <p className="text-sm text-red-700 mt-1">{error.message}</p>
                    <p className="text-xs text-red-600 mt-2">
                      Make sure the GA4 property has data for the selected date range, and that
                      the authorized Google account has access to both properties.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Report data */}
          {report && !isLoading && (
            <div className="space-y-6">
              {/* Summary metric cards */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <Card>
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-center gap-2 mb-1">
                      <TrendingUp className="w-4 h-4 text-primary" />
                      <span className="text-xs text-muted-foreground">Sessions</span>
                    </div>
                    <p className="text-2xl font-bold">{formatNumber(report.summary.totalSessions)}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-center gap-2 mb-1">
                      <Users className="w-4 h-4 text-primary" />
                      <span className="text-xs text-muted-foreground">Users</span>
                    </div>
                    <p className="text-2xl font-bold">{formatNumber(report.summary.totalUsers)}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-center gap-2 mb-1">
                      <Users className="w-4 h-4 text-green-600" />
                      <span className="text-xs text-muted-foreground">New Users</span>
                    </div>
                    <p className="text-2xl font-bold">{formatNumber(report.summary.totalNewUsers)}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-center gap-2 mb-1">
                      <Globe className="w-4 h-4 text-primary" />
                      <span className="text-xs text-muted-foreground">Bounce Rate</span>
                    </div>
                    <p className="text-2xl font-bold">{report.summary.avgBounceRate.toFixed(1)}%</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-center gap-2 mb-1">
                      <Monitor className="w-4 h-4 text-primary" />
                      <span className="text-xs text-muted-foreground">Avg Duration</span>
                    </div>
                    <p className="text-2xl font-bold">{formatDuration(report.summary.avgSessionDurationSec)}</p>
                  </CardContent>
                </Card>
              </div>

              {/* Daily trend chart */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Sessions & Users Over Time</CardTitle>
                </CardHeader>
                <CardContent>
                  <div style={{ height: 240 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={report.dailyTrend.slice(-30)}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                        <XAxis
                          dataKey="date"
                          tick={{ fontSize: 11 }}
                          tickFormatter={(v) => `${v.slice(4, 6)}/${v.slice(6, 8)}`}
                        />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip
                          formatter={(val: number, name: string) => [formatNumber(val), name]}
                          labelFormatter={(l) => `${l.slice(0, 4)}-${l.slice(4, 6)}-${l.slice(6, 8)}`}
                        />
                        <Line type="monotone" dataKey="sessions" stroke="#2563eb" strokeWidth={2} dot={false} name="Sessions" />
                        <Line type="monotone" dataKey="users" stroke="#16a34a" strokeWidth={2} dot={false} name="Users" />
                        <Line type="monotone" dataKey="newUsers" stroke="#9333ea" strokeWidth={1.5} dot={false} name="New Users" strokeDasharray="4 2" />
                        <Legend />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Traffic sources + Devices row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Traffic sources bar chart */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Traffic Sources</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div style={{ height: 220 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={report.trafficSources} layout="vertical" margin={{ left: 8, right: 16 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                          <XAxis type="number" tick={{ fontSize: 11 }} />
                          <YAxis type="category" dataKey="channel" tick={{ fontSize: 11 }} width={100} />
                          <Tooltip formatter={(val: number) => [formatNumber(val), "Sessions"]} />
                          <Bar dataKey="sessions" radius={[0, 4, 4, 0]}>
                            {report.trafficSources.map((entry, i) => (
                              <Cell
                                key={i}
                                fill={CHANNEL_COLORS[entry.channel] ?? "#6b7280"}
                              />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                {/* Device breakdown pie */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Device Breakdown</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div style={{ height: 220 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={report.devices}
                            dataKey="sessions"
                            nameKey="device"
                            cx="50%"
                            cy="50%"
                            outerRadius={80}
                            label={({ device, percent }) =>
                              `${device} ${(percent * 100).toFixed(0)}%`
                            }
                            labelLine={false}
                          >
                            {report.devices.map((_, i) => (
                              <Cell
                                key={i}
                                fill={["#2563eb", "#16a34a", "#9333ea"][i % 3]}
                              />
                            ))}
                          </Pie>
                          <Tooltip formatter={(val: number) => [formatNumber(val), "Sessions"]} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="flex justify-center gap-4 mt-2 text-xs text-muted-foreground">
                      {report.devices.map((d, i) => (
                        <div key={i} className="flex items-center gap-1">
                          {d.device === "desktop" && <Monitor className="w-3 h-3" />}
                          {d.device === "mobile" && <Smartphone className="w-3 h-3" />}
                          {d.device === "tablet" && <Tablet className="w-3 h-3" />}
                          <span className="capitalize">{d.device}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Top pages table */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Top Pages</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Page</th>
                          <th className="text-right py-2 px-3 font-medium text-muted-foreground">Views</th>
                          <th className="text-right py-2 px-3 font-medium text-muted-foreground">Sessions</th>
                          <th className="text-right py-2 px-3 font-medium text-muted-foreground">Bounce</th>
                          <th className="text-right py-2 pl-3 font-medium text-muted-foreground">Avg Time</th>
                        </tr>
                      </thead>
                      <tbody>
                        {report.topPages.map((page, i) => (
                          <tr key={i} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                            <td className="py-2 pr-4">
                              <div className="font-medium truncate max-w-xs" title={page.title || page.path}>
                                {page.title && page.title !== "(not set)" ? page.title : page.path}
                              </div>
                              <div className="text-xs text-muted-foreground truncate max-w-xs">{page.path}</div>
                            </td>
                            <td className="text-right py-2 px-3 tabular-nums">{formatNumber(page.views)}</td>
                            <td className="text-right py-2 px-3 tabular-nums">{formatNumber(page.sessions)}</td>
                            <td className="text-right py-2 px-3 tabular-nums">
                              <span className={page.bounceRate > 70 ? "text-red-600" : page.bounceRate > 50 ? "text-amber-600" : "text-green-600"}>
                                {page.bounceRate.toFixed(1)}%
                              </span>
                            </td>
                            <td className="text-right py-2 pl-3 tabular-nums">{formatDuration(page.avgDurationSec)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>

              {/* Top countries */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Top Countries</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    {report.countries.map((c, i) => (
                      <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-muted/40">
                        <div>
                          <p className="font-medium text-sm">{c.country}</p>
                          <p className="text-xs text-muted-foreground">{formatNumber(c.users)} users</p>
                        </div>
                        <span className="text-sm font-semibold text-primary">{formatNumber(c.sessions)}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </>
      )}
    </div>
  );
}
