'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { ArrowLeft, Download, QrCode, Loader2, TriangleAlert } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import QRCode from 'qrcode';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

const API_URL = 'http://localhost:3005/api/device/data';

interface DeviceData {
  uid: string;
  temperature: number | null;
  water_level: number;
  rainfall: number;
  timestamp: string;
}

const ChartTooltipContent = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="p-2 bg-background/80 backdrop-blur-sm border rounded-lg shadow-lg">
        <p className="label text-sm font-bold">{new Date(label).toLocaleString()}</p>
        {payload.map((pld: any) => (
          <p key={pld.dataKey} style={{ color: pld.color }} className="text-sm">
            {`${pld.name}: ${pld.value.toFixed(2)}`}
          </p>
        ))}
      </div>
    );
  }
  return null;
};


export default function DeviceDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const uid = params.uid as string;

  const [allData, setAllData] = useState<DeviceData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isPdfLoading, setIsPdfLoading] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState('');

  const deviceHistory = useMemo(() => {
    return allData
      .filter(d => d.uid === uid && d.timestamp)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }, [allData, uid]);

  const latestData = useMemo(() => {
    return deviceHistory.length > 0 ? deviceHistory[deviceHistory.length - 1] : null;
  }, [deviceHistory]);

  const filteredData = useMemo(() => {
    let data = deviceHistory;
    if (startDate) {
      data = data.filter(d => new Date(d.timestamp) >= new Date(startDate));
    }
    if (endDate) {
      data = data.filter(d => new Date(d.timestamp) <= new Date(endDate));
    }
    return data;
  }, [deviceHistory, startDate, endDate]);

  const pieChartData = useMemo(() => {
    if (filteredData.length === 0) return [];
    const validTempHistory = filteredData.filter(d => d.temperature !== null);
    const tempSum = validTempHistory.reduce((sum, d) => sum + (d.temperature ?? 0), 0);
    const waterSum = filteredData.reduce((sum, d) => sum + (d.water_level ?? 0), 0);
    const rainSum = filteredData.reduce((sum, d) => sum + (d.rainfall ?? 0), 0);
    const avgTemp = validTempHistory.length > 0 ? tempSum / validTempHistory.length : 0;
    const avgWater = filteredData.length > 0 ? waterSum / filteredData.length : 0;
    const avgRain = filteredData.length > 0 ? rainSum / filteredData.length : 0;

    return [
      { name: `Avg Temp (${avgTemp.toFixed(1)}°C)`, value: Math.max(0.01, avgTemp) },
      { name: `Avg Water (${avgWater.toFixed(2)}m)`, value: Math.max(0.01, avgWater) },
      { name: `Avg Rain (${avgRain.toFixed(2)}mm)`, value: Math.max(0.01, avgRain) },
    ];
  }, [filteredData]);
  
  const PIE_COLORS = ['#fbbf24', '#38bdf8', '#34d399'];


  const fetchData = async () => {
    try {
      const response = await fetch(`${API_URL}?uid=${uid}`, { mode: 'cors', cache: 'no-cache' });
      if (!response.ok) throw new Error(`Network response was not ok. Status: ${response.status}`);
      const jsonData = await response.json();
      const processedData = jsonData.map((d: any) => ({
        ...d,
        temperature: (d.temperature === 85 || typeof d.temperature !== 'number') ? null : d.temperature,
        water_level: (typeof d.water_level !== 'number') ? 0 : d.water_level,
        rainfall: (typeof d.rainfall !== 'number') ? 0 : d.rainfall,
        timestamp: d.timestamp && !d.timestamp.startsWith('1970-') ? d.timestamp : null
      })).filter((d: any) => d.timestamp);
      setAllData(processedData);
      setError(null);
    } catch (e: any) {
      console.error('Failed to fetch data:', e);
      setError('Failed to fetch live data. The server might be offline. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, [uid]);
  
  useEffect(() => {
    QRCode.toDataURL(window.location.href)
      .then(url => setQrCodeUrl(url))
      .catch(err => console.error(err));
  }, []);
  
  const formatDateTimeLocal = (date: Date) => {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  const setQuickFilter = (minutes: number) => {
    const now = new Date();
    const startTime = new Date(now.getTime() - minutes * 60 * 1000);
    setStartDate(formatDateTimeLocal(startTime));
    setEndDate(formatDateTimeLocal(now));
  };
  
  const resetFilters = () => {
    setStartDate('');
    setEndDate('');
  };

  const downloadPDF = async () => {
    setIsPdfLoading(true);
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageMargin = 15;
    const pageWidth = pdf.internal.pageSize.getWidth() - 2 * pageMargin;
    let currentY = pageMargin;

    // Header
    pdf.setFontSize(18);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Environmental Monitoring System Report', pdf.internal.pageSize.getWidth() / 2, currentY, { align: 'center' });
    currentY += 10;
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`Device UID: ${uid}`, pdf.internal.pageSize.getWidth() / 2, currentY, { align: 'center' });
    currentY += 15;

    // Summary
    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Summary', pageMargin, currentY);
    currentY += 8;
    
    const summaryData = [
      ["Last Updated:", latestData ? new Date(latestData.timestamp).toLocaleString() : 'N/A'],
      ["Latest Temperature:", latestData?.temperature !== null ? `${latestData?.temperature?.toFixed(1)} °C` : 'N/A'],
      ["Latest Water Level:", `${latestData?.water_level?.toFixed(2)} m`],
      ["Latest Rainfall:", `${latestData?.rainfall?.toFixed(2)} mm`],
      ["Filter Start:", startDate ? new Date(startDate).toLocaleString() : 'All'],
      ["Filter End:", endDate ? new Date(endDate).toLocaleString() : 'All'],
    ];

    (pdf as any).autoTable({
        body: summaryData,
        startY: currentY,
        theme: 'plain',
        styles: { fontSize: 10, cellPadding: { top: 1.5, right: 2, bottom: 1.5, left: 0 } },
        columnStyles: { 0: { fontStyle: 'bold' } },
    });
    
    currentY = (pdf as any).lastAutoTable.finalY + 15;

    // Add Charts
    const addChartToPdf = async (chartSelector: string, title: string) => {
        const chartEl = document.querySelector<HTMLElement>(chartSelector);
        if (chartEl) {
          const { default: html2canvas } = await import('html2canvas');
          const canvas = await html2canvas(chartEl, { backgroundColor: '#ffffff' });
          const imgData = canvas.toDataURL('image/png');
          const imgProps = pdf.getImageProperties(imgData);
          const aspectRatio = imgProps.height / imgProps.width;
          let imgHeight = pageWidth * aspectRatio;
          let imgWidth = pageWidth;
          if (imgHeight > 100) { // Max height for chart
              imgHeight = 100;
              imgWidth = imgHeight / aspectRatio;
          }

          if (currentY + imgHeight > pdf.internal.pageSize.getHeight() - pageMargin) {
              pdf.addPage();
              currentY = pageMargin;
          }

          pdf.setFontSize(14);
          pdf.setFont('helvetica', 'bold');
          pdf.text(title, pageMargin, currentY);
          currentY += 8;
          const xOffset = (pdf.internal.pageSize.getWidth() - imgWidth) / 2;
          pdf.addImage(imgData, 'PNG', xOffset, currentY, imgWidth, imgHeight);
          currentY += imgHeight + 10;
        }
    };
    
    await addChartToPdf('#line-chart-container', 'Sensor History');
    await addChartToPdf('#pie-chart-container', 'Averages (Filtered)');
    
    // Data Table
    if (currentY > pdf.internal.pageSize.getHeight() - 50) { // Check if space for table header
        pdf.addPage();
        currentY = pageMargin;
    }
    
    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Filtered Data Points', pageMargin, currentY);
    currentY += 8;

    (pdf as any).autoTable({
        head: [['Timestamp', 'Temp (°C)', 'Water (m)', 'Rain (mm)']],
        body: filteredData.map(d => [
            new Date(d.timestamp).toLocaleString(),
            d.temperature !== null ? d.temperature.toFixed(1) : 'N/A',
            d.water_level.toFixed(2),
            d.rainfall.toFixed(2)
        ]),
        startY: currentY,
        theme: 'grid',
        headStyles: { fillColor: [230, 230, 230], textColor: 20 },
        styles: { fontSize: 8 },
    });
    
    pdf.save(`EMS_Report_${uid}_${new Date().toISOString().split('T')[0]}.pdf`);
    setIsPdfLoading(false);
  };
  
  if (loading) {
    return <div className="flex h-full w-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  if (error) {
    return (
      <div className="m-auto">
        <Alert variant="destructive">
          <TriangleAlert className="h-4 w-4" />
          <AlertTitle>Connection Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
         <Button onClick={() => router.push('/dashboard')} className="mt-4" variant="outline"><ArrowLeft className="mr-2 h-4 w-4" />Back to Dashboard</Button>
      </div>
    );
  }

  if (!latestData) {
    return (
        <div className="m-auto text-center">
            <Alert>
              <TriangleAlert className="h-4 w-4" />
              <AlertTitle>No Data Found</AlertTitle>
              <AlertDescription>No historical data could be found for this device (UID: {uid}).</AlertDescription>
            </Alert>
            <Button onClick={() => router.push('/dashboard')} className="mt-4" variant="outline"><ArrowLeft className="mr-2 h-4 w-4" />Back to Dashboard</Button>
        </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <Button onClick={() => router.push('/dashboard')} variant="outline"><ArrowLeft className="mr-2 h-4 w-4" />Back to Dashboard</Button>
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm"><QrCode className="mr-2 h-4 w-4" />Share / View on Phone</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Scan to view this device</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col items-center justify-center p-4">
              {qrCodeUrl && <img src={qrCodeUrl} alt="QR Code" className="w-64 h-64" />}
              <p className="text-xs text-muted-foreground mt-2 break-all">{typeof window !== 'undefined' && window.location.href}</p>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div>
        <h1 className="text-3xl font-bold">Device Details</h1>
        <p className="text-muted-foreground font-mono">{uid}</p>
      </div>

      <Card>
        <CardContent className="p-4 grid grid-cols-2 lg:grid-cols-4 gap-4 text-center">
          <div><p className="text-sm text-muted-foreground">Last Updated</p><p className="font-semibold text-lg">{new Date(latestData.timestamp).toLocaleString()}</p></div>
          <div><p className="text-sm text-muted-foreground">Temperature</p><p className="font-bold text-2xl text-amber-500">{latestData.temperature !== null ? `${latestData.temperature.toFixed(1)} °C` : 'N/A'}</p></div>
          <div><p className="text-sm text-muted-foreground">Water Level</p><p className="font-bold text-2xl text-sky-500">{latestData.water_level.toFixed(2)} m</p></div>
          <div><p className="text-sm text-muted-foreground">Daily Rainfall</p><p className="font-bold text-2xl text-emerald-500">{latestData.rainfall.toFixed(2)} mm</p></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Filter History</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap justify-center gap-2">
            {[5, 10, 30, 60, 12 * 60, 24 * 60].map(min => (
              <Button key={min} variant="outline" size="sm" onClick={() => setQuickFilter(min)}>Last {min >= 60 ? `${min/60}h` : `${min}m`}</Button>
            ))}
          </div>
          <div className="flex flex-col md:flex-row gap-4 items-end">
            <div className="grid w-full gap-1.5">
                <label htmlFor="start-date" className="text-sm font-medium">Start Date/Time</label>
                <Input id="start-date" type="datetime-local" value={startDate} onChange={e => setStartDate(e.target.value)} />
            </div>
            <div className="grid w-full gap-1.5">
                <label htmlFor="end-date" className="text-sm font-medium">End Date/Time</label>
                <Input id="end-date" type="datetime-local" value={endDate} onChange={e => setEndDate(e.target.value)} />
            </div>
            <Button onClick={resetFilters} variant="ghost">Reset</Button>
          </div>
        </CardContent>
      </Card>
      
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <Card className="lg:col-span-3" id="line-chart-container">
          <CardHeader><CardTitle>Sensor History</CardTitle></CardHeader>
          <CardContent className="h-[400px] p-0">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={filteredData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="timestamp" tickFormatter={(ts) => new Date(ts).toLocaleTimeString()} stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis yAxisId="left" stroke="#fbbf24" label={{ value: '°C', angle: -90, position: 'insideLeft' }} />
                <YAxis yAxisId="right" orientation="right" stroke="#38bdf8" label={{ value: 'm / mm', angle: -90, position: 'insideRight' }}/>
                <Tooltip content={<ChartTooltipContent />} />
                <Legend />
                <Line yAxisId="left" type="monotone" dataKey="temperature" name="Temperature" stroke="#fbbf24" dot={false} />
                <Line yAxisId="right" type="monotone" dataKey="water_level" name="Water Level" stroke="#38bdf8" dot={false} />
                <Line yAxisId="right" type="monotone" dataKey="rainfall" name="Rainfall" stroke="#34d399" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card className="lg:col-span-2" id="pie-chart-container">
          <CardHeader><CardTitle>Averages (Filtered)</CardTitle></CardHeader>
          <CardContent className="h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                    <Pie data={pieChartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={120} label>
                        {pieChartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                        ))}
                    </Pie>
                    <Tooltip content={<ChartTooltipContent />} />
                    <Legend />
                </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Filtered Data Points</CardTitle></CardHeader>
        <CardContent>
          <div className="max-h-[400px] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead className="text-center">Temp (°C)</TableHead>
                  <TableHead className="text-center">Water (m)</TableHead>
                  <TableHead className="text-center">Rain (mm)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredData.length > 0 ? (
                  filteredData.map((d, i) => (
                    <TableRow key={i}>
                      <TableCell>{new Date(d.timestamp).toLocaleString()}</TableCell>
                      <TableCell className="text-center font-semibold text-amber-500">{d.temperature !== null ? d.temperature.toFixed(1) : 'N/A'}</TableCell>
                      <TableCell className="text-center font-semibold text-sky-500">{d.water_level.toFixed(2)}</TableCell>
                      <TableCell className="text-center font-semibold text-emerald-500">{d.rainfall.toFixed(2)}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">No data for the selected filter.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <div className="text-center">
        <Button onClick={downloadPDF} disabled={isPdfLoading}>
          {isPdfLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
          {isPdfLoading ? 'Generating Report...' : 'Download PDF Report'}
        </Button>
      </div>

    </div>
  );
}
