
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, Sector } from 'recharts';
import { ArrowLeft, Download, QrCode, Loader2, TriangleAlert, Edit, Save, Filter } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import QRCode from 'qrcode';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import html2canvas from 'html2canvas';
import { useUser } from '@/hooks/use-user';
import { useToast } from '@/hooks/use-toast';
import { Label } from '@/components/ui/label';


const API_URL_BASE = 'https://espserver3.onrender.com/api/device';

interface DeviceInfo {
  uid: string;
  name: string | null;
  location: string | null;
  status: 'online' | 'offline' | 'unknown';
  lastSeen: string | null;
}

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
        <p className="label text-sm font-bold">{label || payload[0].name}</p>
        {payload.map((pld: any) => (
          <p key={pld.dataKey || pld.name} style={{ color: pld.fill || pld.color }} className="text-sm">
            {pld.name.includes('(') ? `${pld.name}: ` : `${pld.name}: `}
            {pld.value.toFixed(2)}
            {pld.payload.unit}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

const renderActiveShape = (props: any) => {
    const RADIAN = Math.PI / 180;
    const { cx, cy, midAngle, innerRadius, outerRadius, startAngle, endAngle, fill, payload, percent, value } = props;
    const sin = Math.sin(-RADIAN * midAngle);
    const cos = Math.cos(-RADIAN * midAngle);
    const sx = cx + (outerRadius + 10) * cos;
    const sy = cy + (outerRadius + 10) * sin;
    const mx = cx + (outerRadius + 30) * cos;
    const my = cy + (outerRadius + 30) * sin;
    const ex = mx + (cos >= 0 ? 1 : -1) * 22;
    const ey = my;
    const textAnchor = cos >= 0 ? 'start' : 'end';

    return (
        <g>
            <text x={cx} y={cy} dy={8} textAnchor="middle" fill={fill} className="font-bold text-lg">
                {payload.name.split('(')[0]}
            </text>
            <Sector
                cx={cx}
                cy={cy}
                innerRadius={innerRadius}
                outerRadius={outerRadius}
                startAngle={startAngle}
                endAngle={endAngle}
                fill={fill}
            />
            <Sector
                cx={cx}
                cy={cy}
                startAngle={startAngle}
                endAngle={endAngle}
                innerRadius={outerRadius + 6}
                outerRadius={outerRadius + 10}
                fill={fill}
            />
            <path d={`M${sx},${sy}L${mx},${my}L${ex},${ey}`} stroke={fill} fill="none" />
            <circle cx={ex} cy={ey} r={2} fill={fill} stroke="none" />
            <text x={ex + (cos >= 0 ? 1 : -1) * 12} y={ey} textAnchor={textAnchor} fill="hsl(var(--foreground))">{`${value.toFixed(1)}${payload.unit}`}</text>
            <text x={ex + (cos >= 0 ? 1 : -1) * 12} y={ey} dy={18} textAnchor={textAnchor} fill="hsl(var(--muted-foreground))">
                {`(${(percent * 100).toFixed(2)}%)`}
            </text>
        </g>
    );
};


export default function DeviceDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const uid = params.uid as string;
  const { isAdmin, token } = useUser();
  const { toast } = useToast();

  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo | null>(null);
  const [deviceHistory, setDeviceHistory] = useState<DeviceData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [appliedStartDate, setAppliedStartDate] = useState('');
  const [appliedEndDate, setAppliedEndDate] = useState('');

  const [isPdfLoading, setIsPdfLoading] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingName, setEditingName] = useState('');
  const [editingLocation, setEditingLocation] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [activePieIndex, setActivePieIndex] = useState(0);

  const filteredData = useMemo(() => {
    if (!appliedStartDate && !appliedEndDate) {
      return deviceHistory;
    }
    const start = appliedStartDate ? new Date(appliedStartDate).getTime() : -Infinity;
    const end = appliedEndDate ? new Date(appliedEndDate).getTime() : Infinity;
    
    return deviceHistory.filter(d => {
        const timestamp = new Date(d.timestamp).getTime();
        return timestamp >= start && timestamp <= end;
    });
  }, [deviceHistory, appliedStartDate, appliedEndDate]);

  const latestData = useMemo(() => {
    if (filteredData.length === 0) return null;
    return [...filteredData].sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
  }, [filteredData]);


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
      { name: `Avg Temp`, value: Math.max(0.01, avgTemp), unit: '°C' },
      { name: `Avg Water`, value: Math.max(0.01, avgWater), unit: 'm' },
      { name: `Avg Rain`, value: Math.max(0.01, avgRain), unit: 'mm' },
    ];
  }, [filteredData]);
  
  const PIE_COLORS = ['#fbbf24', '#38bdf8', '#34d399'];


  const fetchAllData = async () => {
    setLoading(true);
    setError(null);
    if (!token) {
        setLoading(false);
        setError("Authentication token not found. Please log in again.");
        return;
    }
    try {
        const headers = { 'Authorization': `Bearer ${token}` };

        // Fetch device info
        const infoResponse = await fetch(`${API_URL_BASE}/list`, { headers });
        if (infoResponse.ok) {
            const devices: DeviceInfo[] = await infoResponse.json();
            const currentDevice = devices.find(d => d.uid === uid);
            setDeviceInfo(currentDevice || null);
            setEditingName(currentDevice?.name || '');
            setEditingLocation(currentDevice?.location || '');
        } else {
            console.warn('Could not fetch device info');
        }

        // Fetch device history
        const historyResponse = await fetch(`${API_URL_BASE}/data?uid=${uid}&limit=1000`, { headers });
        if (!historyResponse.ok) throw new Error(`Failed to fetch device data. Status: ${historyResponse.status}`);
        
        const jsonData = await historyResponse.json();
        const processedData = jsonData.map((d: any) => ({
            ...d,
            temperature: (d.temperature === 85 || typeof d.temperature !== 'number') ? null : d.temperature,
            water_level: (typeof d.water_level !== 'number') ? 0 : d.water_level,
            rainfall: (typeof d.rainfall !== 'number') ? 0 : d.rainfall,
            timestamp: d.timestamp && !d.timestamp.startsWith('1970-') ? d.timestamp : null
        })).filter((d: any) => d.timestamp);
        
        setDeviceHistory(processedData);

    } catch (e: any) {
        console.error('Failed to fetch data:', e);
        setError('Failed to fetch device data. The server might be offline. Please try again later.');
    } finally {
        setLoading(false);
    }
  };


  useEffect(() => {
    if (token && uid) {
        fetchAllData();
    }
  }, [uid, token]);
  
  useEffect(() => {
    if (typeof window !== 'undefined') {
        QRCode.toDataURL(window.location.href)
        .then(url => setQrCodeUrl(url))
        .catch(err => console.error(err));
    }
  }, []);
  
  const applyFilters = () => {
    setAppliedStartDate(startDate);
    setAppliedEndDate(endDate);
  };

  const resetFilters = () => {
    setStartDate('');
    setEndDate('');
    setAppliedStartDate('');
    setAppliedEndDate('');
  };

  const handleSave = async () => {
    if (!token) return;
    setIsSaving(true);
    try {
      const response = await fetch(`${API_URL_BASE}/${uid}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name: editingName, location: editingLocation })
      });
      if (!response.ok) throw new Error('Failed to save device.');
      
      toast({ title: 'Success', description: 'Device updated successfully.' });
      setIsEditDialogOpen(false);
      if(deviceInfo) {
        setDeviceInfo({
            ...deviceInfo,
            name: editingName,
            location: editingLocation
        });
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const downloadPDF = async () => {
    setIsPdfLoading(true);
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageMargin = 15;
    let currentY = pageMargin;

    pdf.setFontSize(18);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Environmental Monitoring System Report', pdf.internal.pageSize.getWidth() / 2, currentY, { align: 'center' });
    currentY += 10;
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`Device UID: ${uid}`, pdf.internal.pageSize.getWidth() / 2, currentY, { align: 'center' });
     if (deviceInfo?.name) {
        currentY += 6;
        pdf.text(`Device Name: ${deviceInfo.name}`, pdf.internal.pageSize.getWidth() / 2, currentY, { align: 'center' });
    }
    if (deviceInfo?.location) {
        currentY += 6;
        pdf.text(`Location: ${deviceInfo.location}`, pdf.internal.pageSize.getWidth() / 2, currentY, { align: 'center' });
    }
    currentY += 15;

    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Summary', pageMargin, currentY);
    currentY += 8;
    
    (pdf as any).autoTable({
        body: [
            ["Last Updated:", latestData ? new Date(latestData.timestamp).toLocaleString() : 'N/A'],
            ["Latest Temperature:", latestData?.temperature !== null && latestData?.temperature !== undefined ? `${latestData?.temperature?.toFixed(1)} °C` : 'N/A'],
            ["Latest Water Level:", latestData?.water_level !== undefined ? `${latestData?.water_level?.toFixed(2)} m` : 'N/A'],
            ["Latest Rainfall:", latestData?.rainfall !== undefined ? `${latestData?.rainfall?.toFixed(2)} mm` : 'N/A'],
            ["Filter Start:", startDate ? new Date(startDate).toLocaleString() : 'All'],
            ["Filter End:", endDate ? new Date(endDate).toLocaleString() : 'All'],
        ],
        startY: currentY,
        theme: 'plain',
        styles: { fontSize: 10, cellPadding: { top: 1.5, right: 2, bottom: 1.5, left: 0 } },
        columnStyles: { 0: { fontStyle: 'bold' } },
    });
    
    currentY = (pdf as any).lastAutoTable.finalY + 15;

    const addChartToPdf = async (chartSelector: string, title: string) => {
        const chartEl = document.querySelector<HTMLElement>(chartSelector);
        if (chartEl) {
          const canvas = await html2canvas(chartEl, { backgroundColor: '#ffffff' });
          const imgData = canvas.toDataURL('image/png');
          const imgProps = pdf.getImageProperties(imgData);
          const aspectRatio = imgProps.height / imgProps.width;
          let imgWidth = pdf.internal.pageSize.getWidth() - 2 * pageMargin;
          let imgHeight = imgWidth * aspectRatio;
          
          if (imgHeight > 100) {
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
    
    if (currentY > pdf.internal.pageSize.getHeight() - 50) {
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

  if (!loading && deviceHistory.length === 0) {
    return (
        <div className="m-auto text-center">
            <Alert>
              <TriangleAlert className="h-4 w-4" />
              <AlertTitle>No Data Found</AlertTitle>
              <AlertDescription>No historical data could be found for this device (UID: {uid}).</AlertDescription>
            </Alert>
            <Button onClick={() => router.push('/dashboard/devices')} className="mt-4" variant="outline"><ArrowLeft className="mr-2 h-4 w-4" />Back to Device List</Button>
        </div>
    );
  }

  const onPieEnter = (_: any, index: number) => {
    setActivePieIndex(index);
  };


  return (
    <div className="space-y-6">
       <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Edit Device</DialogTitle>
                <CardDescription>Update the name and location for this device.</CardDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="name" className="text-right">Name</Label>
                    <Input id="name" value={editingName} onChange={(e) => setEditingName(e.target.value)} className="col-span-3" />
                </div>
                 <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="location" className="text-right">Location</Label>
                    <Input id="location" value={editingLocation} onChange={(e) => setEditingLocation(e.target.value)} className="col-span-3" />
                </div>
            </div>
            <DialogFooter>
                <DialogClose asChild>
                    <Button variant="ghost">Cancel</Button>
                </DialogClose>
                <Button onClick={handleSave} disabled={isSaving}>
                    {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save Changes
                </Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>


      <div className="flex justify-between items-center">
        <Button onClick={() => router.push('/dashboard/devices')} variant="outline"><ArrowLeft className="mr-2 h-4 w-4" />Back to Device List</Button>
        <div className="flex gap-2">
            {isAdmin && (
                <Button variant="outline" size="sm" onClick={() => setIsEditDialogOpen(true)}>
                    <Edit className="mr-2 h-4 w-4" /> Edit Device
                </Button>
            )}
            <Dialog>
                <DialogTrigger asChild>
                    <Button variant="outline" size="sm"><QrCode className="mr-2 h-4 w-4" />Share</Button>
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
      </div>

      <div>
        <h1 className="text-3xl font-bold">{deviceInfo?.name || 'Device Details'}</h1>
        <p className="text-muted-foreground font-mono">{uid}</p>
        {deviceInfo?.location && <p className="text-muted-foreground text-sm">{deviceInfo.location}</p>}
      </div>

      <Card>
        <CardContent className="p-4 grid grid-cols-2 lg:grid-cols-4 gap-4 text-center">
          <div><p className="text-sm text-muted-foreground">Last Updated</p><p className="font-semibold text-lg">{latestData ? new Date(latestData.timestamp).toLocaleString() : 'N/A'}</p></div>
          <div><p className="text-sm text-muted-foreground">Temperature</p><p className="font-bold text-2xl text-amber-500">{latestData?.temperature !== null && latestData?.temperature !== undefined ? `${latestData.temperature.toFixed(1)} °C` : 'N/A'}</p></div>
          <div><p className="text-sm text-muted-foreground">Water Level</p><p className="font-bold text-2xl text-sky-500">{latestData?.water_level !== undefined ? `${latestData.water_level.toFixed(2)} m` : 'N/A'}</p></div>
          <div><p className="text-sm text-muted-foreground">Daily Rainfall</p><p className="font-bold text-2xl text-emerald-500">{latestData?.rainfall !== undefined ? `${latestData.rainfall.toFixed(2)} mm` : 'N/A'}</p></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Filter History</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col md:flex-row gap-4 items-end">
            <div className="grid w-full gap-1.5">
                <label htmlFor="start-date" className="text-sm font-medium">Start Date/Time</label>
                <Input id="start-date" type="datetime-local" value={startDate} onChange={e => setStartDate(e.target.value)} />
            </div>
            <div className="grid w-full gap-1.5">
                <label htmlFor="end-date" className="text-sm font-medium">End Date/Time</label>
                <Input id="end-date" type="datetime-local" value={endDate} onChange={e => setEndDate(e.target.value)} />
            </div>
            <div className="flex gap-2 w-full md:w-auto">
              <Button onClick={applyFilters}><Filter className="mr-2 h-4 w-4"/>Filter</Button>
              <Button onClick={resetFilters} variant="ghost" className="w-full">Reset</Button>
            </div>
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
                <Line yAxisId="left" type="monotone" dataKey="temperature" name="Temperature" stroke="#fbbf24" dot={false} connectNulls />
                <Line yAxisId="right" type="monotone" dataKey="water_level" name="Water Level" stroke="#38bdf8" dot={false} />
                <Line yAxisId="right" type="monotone" dataKey="rainfall" name="Rainfall" stroke="#34d399" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card className="lg:col-span-2" id="pie-chart-container">
          <CardHeader><CardTitle>Averages (Filtered)</CardTitle></CardHeader>
          <CardContent className="h-[400px]">
             {pieChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie 
                            activeIndex={activePieIndex}
                            activeShape={renderActiveShape}
                            data={pieChartData}
                            cx="50%" 
                            cy="50%" 
                            innerRadius={80}
                            outerRadius={110} 
                            dataKey="value" 
                            onMouseEnter={onPieEnter}
                        >
                            {pieChartData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} className="stroke-background hover:opacity-80 focus:outline-none transition-opacity"/>
                            ))}
                        </Pie>
                        <Tooltip content={<ChartTooltipContent />} />
                        <Legend iconType="circle" />
                    </PieChart>
                </ResponsiveContainer>
             ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">No data for pie chart.</div>
             )}
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
