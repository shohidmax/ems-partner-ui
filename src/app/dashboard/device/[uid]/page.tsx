
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, Sector } from 'recharts';
import { ArrowLeft, Download, QrCode, Loader2, TriangleAlert, Edit, Save, Filter, MapPin, Wind } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import QRCode from 'qrcode';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import html2canvas from 'html2canvas';
import { useUser } from '@/hooks/use-user';
import { useToast } from '@/hooks/use-toast';
import { Label } from '@/components/ui/label';
import { formatToBDTime, formatToBDDate } from '@/lib/utils';


const API_URL_BASE = (typeof window !== 'undefined' && window.location.hostname === 'localhost')
    ? 'http://localhost:3002'
    : 'https://emspartner.espserver.site';

interface DeviceInfo {
  uid: string;
  name: string | null;
  location: string | null;
  latitude?: number | null;
  longitude?: number | null;
  status: 'online' | 'offline' | 'unknown';
  lastSeen: string | null;
  institution?: string | null;
}

interface DeviceDataPoint {
    uid: string;
    timestamp: string; 
    pssensor?: { cable?: number, mpa?: number, avg_mpa?: number, depth_ft?: number };
    environment?: { temp?: number, hum?: number };
    rain?: { count?: number, mm?: number };
    dateTime?: string; 
    temperature?: number;
    water_level?: number;
    rainfall?: number;
}

interface ProcessedData {
  uid: string;
  timestamp: string; 
  temperature: number | null;
  water_level: number;
  rainfall: number;
  humidity: number | null;
  dateTime?: string;
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
            {pld.payload.unit || '%'}
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
    const name = payload.name.split('(')[0];

    return (
        <g>
            <text x={cx} y={cy} dy={-10} textAnchor="middle" fill={fill} className="text-sm font-semibold">
                {name}
            </text>
             <text x={cx} y={cy} dy={10} textAnchor="middle" fill="hsl(var(--foreground))" className="text-xl font-bold">
                 {`${value.toFixed(1)}${payload.unit}`}
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
            <text x={ex + (cos >= 0 ? 1 : -1) * 12} y={ey} textAnchor={textAnchor} fill="hsl(var(--foreground))" className="font-semibold">{`${value.toFixed(1)}${payload.unit}`}</text>
            <text x={ex + (cos >= 0 ? 1 : -1) * 12} y={ey} dy={18} textAnchor={textAnchor} fill="hsl(var(--muted-foreground))" className="text-sm">
                {`(${(percent * 100).toFixed(2)}%)`}
            </text>
        </g>
    );
};


export default function DeviceDetailsPage() {
  const params = useParams();
  const uidFromParams = params?.uid;
  const uid = uidFromParams ? decodeURIComponent(Array.isArray(uidFromParams) ? uidFromParams[0] : uidFromParams) : '';
  const { user, isAdmin, token } = useUser();
  const { toast } = useToast();

  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo | null>(null);
  const [deviceHistory, setDeviceHistory] = useState<ProcessedData[]>([]);
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
  const [editingLatitude, setEditingLatitude] = useState<number | null | undefined>(null);
  const [editingLongitude, setEditingLongitude] = useState<number | null | undefined>(null);
  const [editingInstitution, setEditingInstitution] = useState<string | null | undefined>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [activePieIndex, setActivePieIndex] = useState(0);

  const toLocalISOString = (date: Date) => {
    const tzoffset = date.getTimezoneOffset() * 60000;
    const localISOTime = new Date(date.getTime() - tzoffset).toISOString().slice(0, 16);
    return localISOTime;
  };
  
    const setDefaultTimeRange = useCallback(() => {
        const now = new Date();
        const twelveHoursAgo = new Date(now.getTime() - 12 * 60 * 60 * 1000);
        
        const endStr = toLocalISOString(now);
        const startStr = toLocalISOString(twelveHoursAgo);

        setStartDate(startStr);
        setEndDate(endStr);
        setAppliedStartDate(startStr);
        setAppliedEndDate(endStr);
    }, []);

  const fetchDeviceHistory = useCallback(async (start?: string, end?: string) => {
    if (!token || !uid) return;
    setLoading(true);
    setError(null);
    
    try {
        const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };
        
        let url = `${API_URL_BASE}/api/public/device/data-by-range`;
        const body: any = { uid };
        if (start) body.start = start;
        if (end) body.end = end;
        
        const historyResponse = await fetch(url, { 
            method: 'POST',
            headers: headers,
            body: JSON.stringify(body)
        });

        if (!historyResponse.ok) {
            if (historyResponse.status === 403) {
                 throw new Error('You do not have permission to view this device.');
            }
            throw new Error(`Failed to fetch device data. Status: ${historyResponse.status}`);
        }
        
        const jsonData: DeviceDataPoint[] = await historyResponse.json();

        const processedData = jsonData.map((d): ProcessedData | null => {
            const timeString = d.dateTime || d.timestamp;
            if (!timeString) return null;

            const temp = d.environment?.temp ?? d.temperature;
            const water = d.pssensor?.depth_ft ?? d.water_level;
            const rain = d.rain?.mm ?? d.rainfall;
            const humidity = d.environment?.hum ?? null;
            
            return {
                uid: d.uid,
                timestamp: timeString,
                dateTime: timeString,
                temperature: (temp === 85 || typeof temp !== 'number') ? null : temp,
                water_level: (typeof water !== 'number') ? 0 : water,
                rainfall: (typeof rain !== 'number') ? 0 : rain,
                humidity: (typeof humidity !== 'number') ? null : humidity,
            }
        }).filter((d): d is ProcessedData => d !== null && !d.timestamp.startsWith('1970-'));
        
        setDeviceHistory(processedData.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()));

    } catch (e: any) {
        setError(e.message || 'Failed to fetch device data. The server might be offline. Please try again later.');
    } finally {
        setLoading(false);
    }
  }, [token, uid]);

  const fetchDeviceInfo = useCallback(async () => {
    if (!token || !uid) return;
    try {
        const headers = { 'Authorization': `Bearer ${token}` };
        const infoUrl = isAdmin ? `${API_URL_BASE}/api/admin/devices` : `${API_URL_BASE}/api/user/devices`;
        const infoResponse = await fetch(infoUrl, { headers });

        if (!infoResponse.ok) {
            setError("Could not verify device ownership.");
            return;
        }

        const devices: DeviceInfo[] = await infoResponse.json();
        const currentDevice = devices.find(d => d.uid === uid);
        
        if (currentDevice) {
            setDeviceInfo(currentDevice);
            setEditingName(currentDevice.name || '');
            setEditingLocation(currentDevice.location || '');
            setEditingLatitude(currentDevice.latitude);
            setEditingLongitude(currentDevice.longitude);
            setEditingInstitution(currentDevice.institution);
        } else {
            setError(`Device with UID ${uid} not found or you don't have access.`);
        }

    } catch(e) {
        setError("An error occurred while fetching device details.");
    }
}, [token, uid, isAdmin]);

    useEffect(() => {
        setDefaultTimeRange();
    }, [setDefaultTimeRange]);

  useEffect(() => {
    if (token && uid) {
      fetchDeviceInfo();
      fetchDeviceHistory(appliedStartDate, appliedEndDate);
    }
  }, [uid, token, fetchDeviceInfo, fetchDeviceHistory, appliedStartDate, appliedEndDate]);

  const latestData = useMemo(() => {
    if (deviceHistory.length === 0) return null;
    return deviceHistory[deviceHistory.length - 1];
  }, [deviceHistory]);
  
  const mapLocation = useMemo(() => {
    if (deviceInfo?.latitude && deviceInfo?.longitude) {
      return { lat: deviceInfo.latitude, lng: deviceInfo.longitude };
    }
    return null;
  }, [deviceInfo]);

  const pieChartData = useMemo(() => {
    if (deviceHistory.length === 0) return [];
    
    const validTempHistory = deviceHistory.filter(d => d.temperature !== null);
    const validHumidityHistory = deviceHistory.filter(d => d.humidity !== null);

    const tempSum = validTempHistory.reduce((sum, d) => sum + (d.temperature ?? 0), 0);
    const humiditySum = validHumidityHistory.reduce((sum, d) => sum + (d.humidity ?? 0), 0);
    const waterSum = deviceHistory.reduce((sum, d) => sum + (d.water_level ?? 0), 0);
    const rainSum = deviceHistory.reduce((sum, d) => sum + (d.rainfall ?? 0), 0);

    const avgTemp = validTempHistory.length > 0 ? tempSum / validTempHistory.length : 0;
    const avgHumidity = validHumidityHistory.length > 0 ? humiditySum / validHumidityHistory.length : 0;
    const avgWater = deviceHistory.length > 0 ? waterSum / deviceHistory.length : 0;
    const avgRain = deviceHistory.length > 0 ? rainSum / deviceHistory.length : 0;

    return [
      { name: `Avg Temp`, value: Math.max(0.01, avgTemp), unit: '°C' },
      { name: `Avg Humidity`, value: Math.max(0.01, avgHumidity), unit: '%' },
      { name: `Avg Water`, value: Math.max(0.01, avgWater), unit: 'ft' },
      { name: `Avg Rain`, value: Math.max(0.01, avgRain), unit: 'mm' },
    ];
  }, [deviceHistory]);
  
  const PIE_COLORS = ['#fbbf24', '#a855f7', '#38bdf8', '#34d399'];

  
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

    const handleQuickFilter = (minutes: number) => {
        const now = new Date();
        const start = new Date(now.getTime() - minutes * 60 * 1000);

        const endStr = toLocalISOString(now);
        const startStr = toLocalISOString(start);
        
        setStartDate(startStr);
        setEndDate(endStr);
        setAppliedStartDate(startStr);
        setAppliedEndDate(endStr);
    };

  const resetFilters = () => {
    setStartDate('');
    setEndDate('');
    setAppliedStartDate('');
    setAppliedEndDate('');
  };

  const handleSave = async () => {
    if (!token || !isAdmin) return;
    setIsSaving(true);
    try {
      const response = await fetch(`${API_URL_BASE}/api/admin/device/${uid}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name: editingName, location: editingLocation, latitude: editingLatitude, longitude: editingLongitude, institution: editingInstitution })
      });
      if (!response.ok) throw new Error('Failed to save device.');
      
      toast({ title: 'Success', description: 'Device updated successfully.' });
      setIsEditDialogOpen(false);
      if(deviceInfo) {
        setDeviceInfo({
            ...deviceInfo,
            name: editingName,
            location: editingLocation,
            latitude: editingLatitude,
            longitude: editingLongitude,
            institution: editingInstitution
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
    const doc = new jsPDF('p', 'mm', 'a4');
    const pageMargin = 15;
    const pageWidth = doc.internal.pageSize.getWidth();
    let currentY = pageMargin;

    if (qrCodeUrl) {
        doc.addImage(qrCodeUrl, 'PNG', pageWidth - pageMargin - 30, currentY, 30, 30);
    }
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('Environmental Monitoring Report', pageMargin, currentY + 5);
    currentY += 15;

    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    if (deviceInfo?.institution) {
        doc.text(`Institution: ${deviceInfo.institution}`, pageMargin, currentY);
        currentY += 6;
    }
    if (deviceInfo?.name) {
        doc.text(`Device Name: ${deviceInfo.name}`, pageMargin, currentY);
        currentY += 6;
    }
    if (deviceInfo?.location) {
        doc.text(`Location: ${deviceInfo.location}`, pageMargin, currentY);
        currentY += 6;
    }
    doc.text(`Device UID: ${uid}`, pageMargin, currentY);
    currentY += 10;
    
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Summary', pageMargin, currentY);
    currentY += 8;

    const validTemps = deviceHistory.map(d => d.temperature).filter((t): t is number => t !== null);
    const validHumidity = deviceHistory.map(d => d.humidity).filter((h): h is number => h !== null);
    
    const avgTemp = validTemps.length > 0 ? (validTemps.reduce((a, b) => a + b, 0) / validTemps.length) : null;
    const avgHumidity = validHumidity.length > 0 ? (validHumidity.reduce((a, b) => a + b, 0) / validHumidity.length) : null;
    const avgWater = deviceHistory.length > 0 ? (deviceHistory.reduce((a, b) => a + b.water_level, 0) / deviceHistory.length) : 0;
    const totalRain = deviceHistory.reduce((a, b) => a + b.rainfall, 0);

    const summaryBody: (string | number)[][] = [
        ["Filter Start:", appliedStartDate ? formatToBDTime(new Date(appliedStartDate).toISOString()) : 'All Time'],
        ["Filter End:", appliedEndDate ? formatToBDTime(new Date(appliedEndDate).toISOString()) : 'All Time'],
        ["Latitude:", deviceInfo?.latitude ?? 'N/A'],
        ["Longitude:", deviceInfo?.longitude ?? 'N/A'],
        ["Average Temperature:", avgTemp !== null ? `${avgTemp.toFixed(1)} °C` : 'N/A'],
        ["Average Humidity:", avgHumidity !== null ? `${avgHumidity.toFixed(1)} %` : 'N/A'],
        ["Average Water Level:", `${avgWater.toFixed(2)} ft`],
        ["Total Rainfall:", `${totalRain.toFixed(2)} mm`],
    ];

    autoTable(doc, {
        body: summaryBody,
        startY: currentY,
        theme: 'plain',
        styles: { fontSize: 10, cellPadding: { top: 1.5, right: 2, bottom: 1.5, left: 0 } },
        columnStyles: { 0: { fontStyle: 'bold' } },
    });
    currentY = (doc as any).lastAutoTable.finalY + 15;

    const lineChartEl = document.querySelector<HTMLElement>('#line-chart-container');
    const pieChartEl = document.querySelector<HTMLElement>('#pie-chart-container');

    const chartOptions = { backgroundColor: '#ffffff', scale: 2 };
    
    const lineCanvas = lineChartEl ? await html2canvas(lineChartEl, chartOptions) : null;
    const pieCanvas = pieChartEl ? await html2canvas(pieChartEl, chartOptions) : null;

    const chartHeight = 80;
    const halfWidth = (pageWidth - pageMargin * 2 - 10) / 2;

    if (currentY + chartHeight > doc.internal.pageSize.getHeight() - pageMargin) {
        doc.addPage();
        currentY = pageMargin;
    }

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    
    const chartY = currentY;
    const chartTitleY = chartY - 2;

    if (lineCanvas) {
        doc.text('Sensor History', pageMargin, chartTitleY);
        const lineImgData = lineCanvas.toDataURL('image/png');
        const lineProps = doc.getImageProperties(lineImgData);
        const lineRatio = lineProps.height / lineProps.width;
        doc.addImage(lineImgData, 'PNG', pageMargin, chartY, halfWidth, halfWidth * lineRatio);
    }
    
    if (pieCanvas) {
        doc.text('Averages (Filtered)', pageMargin + halfWidth + 10, chartTitleY);
        const pieImgData = pieCanvas.toDataURL('image/png');
        const pieProps = doc.getImageProperties(pieImgData);
        const pieRatio = pieProps.height / pieProps.width;
        doc.addImage(pieImgData, 'PNG', pageMargin + halfWidth + 10, chartY, halfWidth, halfWidth * pieRatio);
    }
    
    doc.addPage();
    currentY = pageMargin;

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Filtered Data Points', pageMargin, currentY);
    currentY += 8;

    autoTable(doc, {
        head: [['Timestamp', 'Temp (°C)', 'Humidity (%)', 'Water (ft)', 'Rain (mm)']],
        body: deviceHistory.slice().reverse().map(d => [
            formatToBDTime(d.timestamp),
            d.temperature !== null ? d.temperature.toFixed(1) : 'N/A',
            d.humidity !== null ? d.humidity.toFixed(1) : 'N/A',
            d.water_level.toFixed(2),
            d.rainfall.toFixed(2)
        ]),
        startY: currentY,
        theme: 'grid',
        headStyles: { fillColor: [230, 230, 230], textColor: 20 },
        styles: { fontSize: 8 },
    });
    
    doc.save(`EMS_Report_${uid}_${new Date().toISOString().split('T')[0]}.pdf`);
    setIsPdfLoading(false);
  };
  
  if (loading && deviceHistory.length === 0 && !deviceInfo) {
    return <div className="flex h-full w-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  if (error) {
    return (
      <div className="m-auto">
        <Alert variant="destructive">
          <TriangleAlert className="h-4 w-4" />
          <AlertTitle>Access Denied or Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
         <Button onClick={() => window.history.back()} className="mt-4" variant="outline"><ArrowLeft className="mr-2 h-4 w-4" />Back</Button>
      </div>
    );
  }

  if (!loading && !deviceInfo) {
    return (
        <div className="m-auto text-center">
            <Alert>
              <TriangleAlert className="h-4 w-4" />
              <AlertTitle>No Device Found</AlertTitle>
              <AlertDescription>No device could be found for this UID: {uid}.</AlertDescription>
            </Alert>
            <Button onClick={() => window.history.back()} className="mt-4" variant="outline"><ArrowLeft className="mr-2 h-4 w-4" />Back</Button>
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
                    <Label htmlFor="institution" className="text-right">Institution</Label>
                    <Input id="institution" value={editingInstitution || ''} onChange={(e) => setEditingInstitution(e.target.value)} className="col-span-3" />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="name" className="text-right">Name</Label>
                    <Input id="name" value={editingName} onChange={(e) => setEditingName(e.target.value)} className="col-span-3" />
                </div>
                 <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="location" className="text-right">Location</Label>
                    <Input id="location" value={editingLocation} onChange={(e) => setEditingLocation(e.target.value)} className="col-span-3" />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="latitude" className="text-right">Latitude</Label>
                    <Input id="latitude" type="number" value={editingLatitude ?? ''} onChange={(e) => setEditingLatitude(e.target.value === '' ? null : parseFloat(e.target.value))} className="col-span-3" />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="longitude" className="text-right">Longitude</Label>
                    <Input id="longitude" type="number" value={editingLongitude ?? ''} onChange={(e) => setEditingLongitude(e.target.value === '' ? null : parseFloat(e.target.value))} className="col-span-3" />
                </div>
            </div>
            <DialogFooter>
                <DialogClose asChild>
                    <Button variant="ghost">Cancel</Button>
                </DialogClose>
                <Button onClick={handleSave} disabled={isSaving || !isAdmin}>
                    {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save Changes
                </Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>


      <div className="flex justify-between items-center">
        <Button onClick={() => window.history.back()} variant="outline"><ArrowLeft className="mr-2 h-4 w-4" />Back</Button>
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
        {deviceInfo?.location && (
            <p className="text-muted-foreground text-sm flex items-center gap-2">
                <MapPin className="h-4 w-4" /> 
                {deviceInfo.location}
            </p>
        )}
      </div>

      {error && !deviceInfo && (
         <Alert variant="destructive">
          <TriangleAlert className="h-4 w-4" />
          <AlertTitle>An Error Occurred</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      
       <Card>
          <CardHeader>
              <CardTitle>Device Last Data</CardTitle>
          </CardHeader>
        <CardContent className="p-4 grid grid-cols-2 lg:grid-cols-5 gap-4 text-center">
        <div>
            <p className="text-sm text-muted-foreground">Last Updated</p>
            {latestData ? (
                <div className="font-semibold text-lg">
                    {formatToBDDate(latestData.timestamp)}
                </div>
            ) : <p className="font-semibold text-lg">'N/A'</p>}
        </div>
          <div><p className="text-sm text-muted-foreground">Temperature</p><p className="font-bold text-2xl text-amber-500">{latestData?.temperature !== null && latestData?.temperature !== undefined ? `${latestData.temperature.toFixed(1)} °C` : 'N/A'}</p></div>
          <div><p className="text-sm text-muted-foreground">Humidity</p><p className="font-bold text-2xl text-purple-500">{latestData?.humidity !== null && latestData?.humidity !== undefined ? `${latestData.humidity.toFixed(1)} %` : 'N/A'}</p></div>
          <div><p className="text-sm text-muted-foreground">Water Level</p><p className="font-bold text-2xl text-sky-500">{latestData?.water_level !== undefined ? `${latestData.water_level.toFixed(2)} ft` : 'N/A'}</p></div>
          <div><p className="text-sm text-muted-foreground">Daily Rainfall</p><p className="font-bold text-2xl text-emerald-500">{latestData?.rainfall !== undefined ? `${latestData.rainfall.toFixed(2)} mm` : 'N/A'}</p></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Filter History</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
             <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => handleQuickFilter(10)}>10m</Button>
                <Button variant="outline" size="sm" onClick={() => handleQuickFilter(30)}>30m</Button>
                <Button variant="outline" size="sm" onClick={() => handleQuickFilter(60)}>1h</Button>
                <Button variant="outline" size="sm" onClick={() => handleQuickFilter(6 * 60)}>6h</Button>
                <Button variant="outline" size="sm" onClick={() => handleQuickFilter(12 * 60)}>12h</Button>
                <Button variant="outline" size="sm" onClick={() => handleQuickFilter(24 * 60)}>24h</Button>
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
            <div className="flex gap-2 w-full md:w-auto">
              <Button onClick={applyFilters} disabled={loading}><Filter className="mr-2 h-4 w-4"/>Filter</Button>
              <Button onClick={resetFilters} variant="ghost" className="w-full" disabled={loading}>Reset</Button>
            </div>
          </div>
        </CardContent>
      </Card>
      
       {deviceHistory.length === 0 && !loading && (
           <Alert>
              <TriangleAlert className="h-4 w-4" />
              <AlertTitle>No Data Available</AlertTitle>
              <AlertDescription>There is no historical data for this device in the selected range. It may be a new device or there is an issue with data transmission.</AlertDescription>
            </Alert>
       )}
      
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <Card className="lg:col-span-3 light" id="line-chart-container">
          <CardHeader><CardTitle>Sensor History</CardTitle></CardHeader>
          <CardContent className="h-[400px] p-0">
             {loading ? <div className="h-full flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div> : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={deviceHistory}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="dateTime" tickFormatter={(ts) => formatToBDTime(ts).split(',')[0] } stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis yAxisId="left" stroke="#fbbf24" label={{ value: '°C / %', angle: -90, position: 'insideLeft' }} />
                  <YAxis yAxisId="right" orientation="right" stroke="#38bdf8" label={{ value: 'ft / mm', angle: -90, position: 'insideRight' }}/>
                  <Tooltip content={<ChartTooltipContent />} />
                  <Legend />
                  <Line yAxisId="left" type="monotone" dataKey="temperature" name="Temperature" stroke="#fbbf24" dot={false} connectNulls />
                  <Line yAxisId="left" type="monotone" dataKey="humidity" name="Humidity" stroke="#a855f7" dot={false} connectNulls />
                  <Line yAxisId="right" type="monotone" dataKey="water_level" name="Water Level" stroke="#38bdf8" dot={false} />
                  <Line yAxisId="right" type="monotone" dataKey="rainfall" name="Rainfall" stroke="#34d399" dot={false} />
                </LineChart>
              </ResponsiveContainer>
             )}
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

       {mapLocation && (
        <Card>
          <CardHeader>
            <CardTitle>Device Location</CardTitle>
          </CardHeader>
          <CardContent>
            <iframe
              width="100%"
              height="450"
              style={{ border: 0 }}
              loading="lazy"
              allowFullScreen
              src={`https://www.openstreetmap.org/export/embed.html?bbox=${mapLocation.lng-0.05},${mapLocation.lat-0.05},${mapLocation.lng+0.05},${mapLocation.lat+0.05}&layer=mapnik&marker=${mapLocation.lat},${mapLocation.lng}`}>
            </iframe>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>Filtered Data Points</CardTitle></CardHeader>
        <CardContent>
          <div className="max-h-[400px] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead className="text-center">Temp (°C)</TableHead>
                  <TableHead className="text-center">Humidity (%)</TableHead>
                  <TableHead className="text-center">Water (ft)</TableHead>
                  <TableHead className="text-center">Rain (mm)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {deviceHistory.length > 0 ? (
                  deviceHistory.map((d, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        {formatToBDTime(d.timestamp)}
                      </TableCell>
                      <TableCell className="text-center font-semibold text-amber-500">{d.temperature !== null ? d.temperature.toFixed(1) : 'N/A'}</TableCell>
                      <TableCell className="text-center font-semibold text-purple-500">{d.humidity !== null ? d.humidity.toFixed(1) : 'N/A'}</TableCell>
                      <TableCell className="text-center font-semibold text-sky-500">{d.water_level.toFixed(2)}</TableCell>
                      <TableCell className="text-center font-semibold text-emerald-500">{d.rainfall.toFixed(2)}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">No data for the selected filter.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <div className="text-center">
        <Button onClick={downloadPDF} disabled={isPdfLoading || deviceHistory.length === 0}>
          {isPdfLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
          {isPdfLoading ? 'Generating Report...' : 'Download PDF Report'}
        </Button>
      </div>
    </div>
  );
}






    
