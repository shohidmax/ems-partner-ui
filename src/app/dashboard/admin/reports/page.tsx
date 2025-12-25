'use client';
import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { TriangleAlert, Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import html2canvas from 'html2canvas';

const API_URL = (typeof window !== 'undefined' && window.location.hostname === 'localhost')
    ? 'http://localhost:3002/api/admin/report'
    : 'https://emspartner.espserver.site/api/admin/report';

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
  const [isPdfLoading, setIsPdfLoading] = useState(false);
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

  const downloadReport = async () => {
    if (data.length === 0) {
      alert('No data available to generate a report.');
      return;
    }
    setIsPdfLoading(true);
    const pdf = new jsPDF('p', 'mm', 'a4');
    let currentY = 15;

    pdf.setFontSize(18);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Aggregated Data Report', pdf.internal.pageSize.getWidth() / 2, currentY, { align: 'center' });
    currentY += 10;
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`Period: ${period.charAt(0).toUpperCase() + period.slice(1)} | Year: ${year}`, pdf.internal.pageSize.getWidth() / 2, currentY, { align: 'center' });
    currentY += 15;

    const chartEl = document.querySelector<HTMLElement>('#report-chart-container');
    if (chartEl) {
        try {
            const canvas = await html2canvas(chartEl, { 
                backgroundColor: '#ffffff',
                scale: 2 // Increase scale for better resolution
            });
            const imgData = canvas.toDataURL('image/png');
            const imgProps = pdf.getImageProperties(imgData);
            const aspectRatio = imgProps.height / imgProps.width;
            let imgWidth = pdf.internal.pageSize.getWidth() - 30; // 15mm margin on each side
            let imgHeight = imgWidth * aspectRatio;

            pdf.addImage(imgData, 'PNG', 15, currentY, imgWidth, imgHeight);
            currentY += imgHeight + 10;
        } catch (error) {
            console.error("Error generating chart image:", error);
            pdf.text("Could not generate chart image.", 15, currentY);
            currentY += 10;
        }
    }

    if (currentY > pdf.internal.pageSize.getHeight() - 40) { // Check if space is left for table
        pdf.addPage();
        currentY = 15;
    }

    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Report Data Table', 15, currentY);
    currentY += 8;

    (pdf as any).autoTable({
      head: [['Period', 'Avg Temp (°C)', 'Avg Rain (mm)', 'Data Points']],
      body: data.map(d => [
        d.date || d.month || d.year?.toString(),
        d.avgTemp.toFixed(2),
        d.avgRain.toFixed(2),
        d.count.toLocaleString()
      ]),
      startY: currentY,
      theme: 'grid',
      headStyles: { fillColor: [37, 99, 235] }, // A blue header
      styles: { fontSize: 8 },
    });

    pdf.save(`EMS_Report_${period}_${year}.pdf`);
    setIsPdfLoading(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Data Reports</h1>
        <p className="text-muted-foreground">View aggregated data reports by different time periods.</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center flex-wrap gap-4">
            <CardTitle>Data Summary</CardTitle>
            <div className="flex gap-2 sm:gap-4 flex-wrap">
              <Select value={period} onValueChange={(v) => setPeriod(v as ReportPeriod)}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Select Period" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="yearly">Yearly</SelectItem>
                </SelectContent>
              </Select>
              <Select value={year} onValueChange={setYear}>
                <SelectTrigger className="w-full sm:w-[120px]">
                  <SelectValue placeholder="Select Year" />
                </SelectTrigger>
                <SelectContent>
                  {availableYears.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                </SelectContent>
              </Select>
               <Button onClick={fetchData} className="w-full sm:w-auto">Refresh</Button>
               <Button onClick={downloadReport} disabled={isPdfLoading || data.length === 0} className="w-full sm:w-auto">
                 {isPdfLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                 Download PDF
               </Button>
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
            <div id="report-chart-container">
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
            </div>
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
