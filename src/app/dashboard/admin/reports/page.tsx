'use client';
import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';

const API_URL = 'http://localhost:3005/api/admin/report';

type ReportPeriod = 'daily' | 'monthly' | 'yearly';

interface ReportData {
  date?: string;
  month?: string;
  year?: number;
  avgTemp: number;
  avgRain: number;
  count: number;
}

const ChartTooltipContent = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="p-2 bg-background/80 backdrop-blur-sm border rounded-lg shadow-lg">
        <p className="label text-sm font-bold">{label}</p>
        {payload.map((pld: any) => (
          <p key={pld.dataKey} style={{ color: pld.fill }} className="text-sm">
            {pld.dataKey === 'avgTemp' ? `${pld.name}: ${pld.value.toFixed(2)}°C` :
             pld.dataKey === 'avgRain' ? `${pld.name}: ${pld.value.toFixed(2)}mm` :
             `${pld.name}: ${pld.value.toLocaleString()}`}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export default function AdminReportsPage() {
  const [data, setData] = useState<ReportData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<ReportPeriod>('monthly');
  const [year, setYear] = useState<string>(new Date().getFullYear().toString());
  const availableYears = Array.from({ length: 5 }, (_, i) => (new Date().getFullYear() - i).toString());

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('No auth token found.');
      const url = `${API_URL}?period=${period}&year=${year}`;
      const response = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });

      if (!response.ok) {
        if (response.status === 403) throw new Error('Admin access required.');
        throw new Error(`Failed to fetch report: ${response.statusText}`);
      }
      const result = await response.json();
      setData(result);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [period, year]);

  const chartData = data.map(d => ({
    name: d.date || d.month || d.year,
    ...d
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Data Reports</h1>
        <p className="text-muted-foreground">View aggregated data reports by different time periods.</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Data Summary</CardTitle>
            <div className="flex gap-4">
              <Select value={period} onValueChange={(v) => setPeriod(v as ReportPeriod)}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Select Period" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="yearly">Yearly</SelectItem>
                </SelectContent>
              </Select>
              <Select value={year} onValueChange={setYear}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue placeholder="Select Year" />
                </SelectTrigger>
                <SelectContent>
                  {availableYears.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                </SelectContent>
              </Select>
               <Button onClick={fetchData}>Refresh</Button>
            </div>
          </div>
          <CardDescription>Average temperature, rainfall, and data point counts.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? <Skeleton className="h-[400px] w-full" /> :
           error ? (
            <Alert variant="destructive">
              <TriangleAlert className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
           ) : chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis yAxisId="left" orientation="left" stroke="#fbbf24" label={{ value: 'Avg Temp (°C)', angle: -90, position: 'insideLeft' }} />
                <YAxis yAxisId="right" orientation="right" stroke="#34d399" label={{ value: 'Avg Rain (mm)', angle: -90, position: 'insideRight' }}/>
                <Tooltip content={<ChartTooltipContent />} />
                <Legend />
                <Bar yAxisId="left" dataKey="avgTemp" name="Avg Temp" fill="#fbbf24" />
                <Bar yAxisId="right" dataKey="avgRain" name="Avg Rain" fill="#34d399" />
                <Bar yAxisId="left" dataKey="count" name="Data Points" fill="#8884d8" hide={true} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[400px] text-muted-foreground">
              No data available for the selected period.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
