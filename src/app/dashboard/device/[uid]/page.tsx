
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, Sector } from 'recharts';
import { ArrowLeft, Download, QrCode, Loader2, TriangleAlert, Edit, Save, Filter, MapPin, Wind, ArrowUp, ArrowDown, Sparkles, FileText } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import QRCode from 'qrcode';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import html2canvas from 'html2canvas';
import { useUser } from '@/hooks/use-user';
import { useToast } from '@/hooks/use-toast';
import { Label } from '@/components/ui/label';
import { formatToBDTime, formatToBDDate, formatToBDTimeWithMonth } from '@/lib/utils';
import { apiFetch } from '@/lib/api';
import { DeviceAiChat } from '@/components/device-ai-chat';
import { useIsMobile } from '@/hooks/use-mobile';

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
    receivedAt?: string | Date;
    temperature?: number;
    humidity?: number;
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
        <p className="label text-sm font-bold">
          {typeof label === 'string' && label.includes('T') ? formatToBDTime(label) : (label || payload[0].name)}
        </p>
        {payload.map((pld: any) => {
          let unit = pld.payload.unit;
          if (!unit) {
            if (pld.dataKey === 'temperature') unit = ' °C';
            else if (pld.dataKey === 'humidity') unit = ' %';
            else if (pld.dataKey === 'water_level') unit = ' Ft';
            else if (pld.dataKey === 'rainfall') unit = ' mm';
            else unit = '%';
          }
          return (
            <p key={pld.dataKey || pld.name} style={{ color: pld.fill || pld.color }} className="text-sm">
              {pld.name.includes('(') ? `${pld.name}: ` : `${pld.name}: `}
              {pld.value.toFixed(2)}{unit}
            </p>
          );
        })}
      </div>
    );
  }
  return null;
};

const renderActiveShape = (props: any) => {
    const RADIAN = Math.PI / 180;
    const { cx, cy, midAngle, innerRadius, outerRadius, startAngle, endAngle, fill, payload, percent, value, isMobile } = props;
    const sin = Math.sin(-RADIAN * midAngle);
    const cos = Math.cos(-RADIAN * midAngle);
    const name = payload.name.split('(')[0];

    if (isMobile) {
        return (
            <g>
                <text x={cx} y={cy} dy={-12} textAnchor="middle" fill={fill} className="text-xs font-semibold">
                    {name}
                </text>
                <text x={cx} y={cy} dy={8} textAnchor="middle" fill="hsl(var(--foreground))" className="text-base font-bold">
                    {`${value.toFixed(1)}${payload.unit || ''}`}
                </text>
                <text x={cx} y={cy} dy={24} textAnchor="middle" fill="hsl(var(--muted-foreground))" className="text-[10px]">
                    {`(${(percent * 100).toFixed(1)}%)`}
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
                    innerRadius={outerRadius + 3}
                    outerRadius={outerRadius + 6}
                    fill={fill}
                />
            </g>
        );
    }

    const sx = cx + (outerRadius + 10) * cos;
    const sy = cy + (outerRadius + 10) * sin;
    const mx = cx + (outerRadius + 30) * cos;
    const my = cy + (outerRadius + 30) * sin;
    const ex = mx + (cos >= 0 ? 1 : -1) * 22;
    const ey = my;
    const textAnchor = cos >= 0 ? 'start' : 'end';

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
  const isMobile = useIsMobile();
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
  const [activeFilter, setActiveFilter] = useState<number | null>(null);

  const [isPdfLoading, setIsPdfLoading] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [isAiChatOpen, setIsAiChatOpen] = useState(false);
  
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
        setActiveFilter(12 * 60);
    }, []);

  const fetchDeviceHistory = useCallback(async (start?: string, end?: string) => {
    if (!token || !uid) return;
    setLoading(true);
    setError(null);
    
    try {
        let url = `/api/public/device/data-by-range`;
        const body: any = { uid };
        if (start) body.start = start;
        if (end) body.end = end;
        if (!start && !end) {
            body.limit = 5000;
        }
        
        const { data: jsonData } = await apiFetch<DeviceDataPoint[]>(url, { 
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        const processedData = jsonData.map((d): ProcessedData | null => {
            const timeString = d.dateTime || d.timestamp || (d.receivedAt ? new Date(d.receivedAt).toISOString() : null);
            if (!timeString) return null;

            const temp = d.environment?.temp ?? d.temperature;
            const water = d.pssensor?.depth_ft ?? d.water_level;
            const rain = d.rain?.mm ?? d.rainfall;
            const humidity = d.environment?.hum ?? d.humidity ?? null;
            
            return {
                uid: d.uid,
                timestamp: timeString,
                dateTime: timeString,
                temperature: (temp === 85 || typeof temp !== 'number') ? null : temp,
                water_level: (typeof water !== 'number') ? 0 : water,
                rainfall: (typeof rain !== 'number') ? 0 : rain,
                humidity: (typeof humidity !== 'number' || humidity > 100) ? null : humidity,
            }
        }).filter((d): d is ProcessedData => d !== null && !d.timestamp.startsWith('1970-'));
        
        setDeviceHistory(processedData.sort((a, b) => (new Date(a.timestamp).getTime() || 0) - (new Date(b.timestamp).getTime() || 0)));

    } catch (e: any) {
        setError(e.message || 'Failed to fetch device data. The server might be offline. Please try again later.');
    } finally {
        setLoading(false);
    }
  }, [token, uid]);

  const fetchDeviceInfo = useCallback(async () => {
    if (!token || !uid) return;
    try {
        const infoUrl = isAdmin ? `/api/admin/devices` : `/api/user/devices`;
        const { data: devices } = await apiFetch<DeviceInfo[]>(infoUrl);
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
    }
  }, [uid, token, fetchDeviceInfo]);

  useEffect(() => {
    if (token && uid) {
      fetchDeviceHistory(appliedStartDate, appliedEndDate);
    }
  }, [uid, token, fetchDeviceHistory, appliedStartDate, appliedEndDate]);

  const [tablePage, setTablePage] = useState(1);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const rowsPerPage = 50;
  const totalPages = Math.max(1, Math.ceil(deviceHistory.length / rowsPerPage));

  useEffect(() => {
    setTablePage(1);
  }, [deviceHistory, sortOrder]);

  const displayHistory = useMemo(() => {
    if (sortOrder === 'asc') {
      return [...deviceHistory].sort((a, b) => (new Date(a.timestamp).getTime() || 0) - (new Date(b.timestamp).getTime() || 0));
    }
    return [...deviceHistory].sort((a, b) => (new Date(b.timestamp).getTime() || 0) - (new Date(a.timestamp).getTime() || 0));
  }, [deviceHistory, sortOrder]);

  const paginatedData = useMemo(() => {
    const startIndex = (tablePage - 1) * rowsPerPage;
    return displayHistory.slice(startIndex, startIndex + rowsPerPage);
  }, [displayHistory, tablePage]);

  const chartData = useMemo(() => {
    if (deviceHistory.length <= 1500) return deviceHistory;
    const step = Math.ceil(deviceHistory.length / 1500);
    const sampled: ProcessedData[] = [];
    for (let i = 0; i < deviceHistory.length; i += step) {
      sampled.push(deviceHistory[i]);
    }
    if (sampled.length > 0 && sampled[sampled.length - 1] !== deviceHistory[deviceHistory.length - 1]) {
      sampled.push(deviceHistory[deviceHistory.length - 1]);
    }
    return sampled;
  }, [deviceHistory]);

  const downloadCSV = () => {
    if (deviceHistory.length === 0) return;
    const headers = ['SL,UID,Timestamp,Temperature (°C),Humidity (%),Water Level (ft),Rainfall (mm)'];
    const sorted = [...deviceHistory].sort((a, b) => (new Date(a.timestamp).getTime() || 0) - (new Date(b.timestamp).getTime() || 0));
    const rows = sorted.map((d, idx) => 
      `${idx + 1},"${d.uid}","${d.timestamp}",${d.temperature ?? ''},${d.humidity ?? ''},${d.water_level},${d.rainfall}`
    );
    const blob = new Blob([[headers, ...rows].join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `device_${uid}_data_${appliedStartDate || 'start'}_to_${appliedEndDate || 'end'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast({ title: 'CSV Downloaded', description: `Exported ${sorted.length.toLocaleString()} records.` });
  };

  const latestData = useMemo(() => {
    if (deviceHistory.length === 0) return null;
    return deviceHistory[deviceHistory.length - 1];
  }, [deviceHistory]);

    const summaryStats = useMemo(() => {
        if (deviceHistory.length === 0) return null;

        const getStats = (key: 'temperature' | 'humidity' | 'water_level' | 'rainfall') => {
            const values = deviceHistory
                .map(d => d[key])
                .filter((v): v is number => {
                    if (v === null || typeof v !== 'number') return false;
                    if (key === 'temperature' && v === 85) return false;
                    if (key === 'humidity' && v > 100) return false;
                    return true;
                });

            if (values.length === 0) return { avg: null, min: null, max: null };
            
            const sum = values.reduce((a, b) => a + b, 0);
            const avg = sum / values.length;
            const min = Math.min(...values);
            const max = Math.max(...values);
            return { avg, min, max };
        };
        
        const totalRainfall = deviceHistory.reduce((sum, d) => sum + d.rainfall, 0);

        return {
            temperature: getStats('temperature'),
            humidity: getStats('humidity'),
            water_level: getStats('water_level'),
            rainfall: { ...getStats('rainfall'), total: totalRainfall },
        };
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
    if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
      toast({
        title: 'Invalid Date Range',
        description: 'Start Date/Time cannot be later than End Date/Time.',
        variant: 'destructive',
      });
      return;
    }
    setActiveFilter(null);
    setAppliedStartDate(startDate);
    setAppliedEndDate(endDate);
    fetchDeviceHistory(startDate, endDate);
  };

  const handleQuickFilter = (minutes: number) => {
    const now = new Date();
    const start = new Date(now.getTime() - minutes * 60 * 1000);

    const endStr = toLocalISOString(now);
    const startStr = toLocalISOString(start);
    
    setStartDate(startStr);
    setEndDate(endStr);
    setActiveFilter(minutes);
    setAppliedStartDate(startStr);
    setAppliedEndDate(endStr);
    fetchDeviceHistory(startStr, endStr);
  };

  const resetFilters = () => {
    setStartDate('');
    setEndDate('');
    setAppliedStartDate('');
    setAppliedEndDate('');
    setActiveFilter(null);
    fetchDeviceHistory();
    toast({ title: 'Filter Reset', description: 'Showing latest records without date filter.' });
  };

  const handleSave = async () => {
    if (!token || !isAdmin) return;
    setIsSaving(true);
    try {
      await apiFetch(`/api/admin/device/${uid}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name: editingName, location: editingLocation, latitude: editingLatitude, longitude: editingLongitude, institution: editingInstitution })
      });
      
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
    if (deviceHistory.length === 0) {
      toast({ title: 'No Data', description: 'No filtered data available to generate PDF.', variant: 'destructive' });
      return;
    }
    setIsPdfLoading(true);
    try {
      const doc = new jsPDF('p', 'mm', 'a4');
      const pageMargin = 15;
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      let currentY = pageMargin;

      if (qrCodeUrl) {
          doc.addImage(qrCodeUrl, 'PNG', pageWidth - pageMargin - 28, currentY, 28, 28);
      }
      doc.setFontSize(20);
      doc.setTextColor(30, 41, 59); // Slate-800
      doc.setFont('helvetica', 'bold');
      doc.text('Environmental Monitoring Report', pageMargin, currentY + 6);
      
      currentY += 15;

      doc.setTextColor(71, 85, 105);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      if (deviceInfo?.institution) {
          doc.text(`Institution: ${deviceInfo.institution}`, pageMargin, currentY);
          currentY += 6;
      }
      if (deviceInfo?.name) {
          doc.text(`Upazila / Station: ${deviceInfo.name}`, pageMargin, currentY);
          currentY += 6;
      }
      if (deviceInfo?.location) {
          doc.text(`Location: ${deviceInfo.location}`, pageMargin, currentY);
          currentY += 6;
      }
      doc.text(`Device UID: ${uid}`, pageMargin, currentY);
      currentY += 6;
      doc.text(`Generated At: ${formatToBDTimeWithMonth(new Date().toISOString())}`, pageMargin, currentY);
      currentY += 7;
      
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.5);
      doc.line(pageMargin, currentY, pageWidth - pageMargin, currentY);
      currentY += 8;
      
      doc.setTextColor(15, 23, 42);
      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.text('Filter & Summary Statistics', pageMargin, currentY);
      currentY += 6;

      const validTemps = deviceHistory.map(d => d.temperature).filter((t): t is number => t !== null);
      const validHumidity = deviceHistory.map(d => d.humidity).filter((h): h is number => h !== null);
      
      const avgTemp = validTemps.length > 0 ? (validTemps.reduce((a, b) => a + b, 0) / validTemps.length) : null;
      const avgHumidity = validHumidity.length > 0 ? (validHumidity.reduce((a, b) => a + b, 0) / validHumidity.length) : null;
      const avgWater = deviceHistory.length > 0 ? (deviceHistory.reduce((a, b) => a + b.water_level, 0) / deviceHistory.length) : 0;
      const totalRain = deviceHistory.reduce((a, b) => a + b.rainfall, 0);

      const filterStartText = appliedStartDate ? formatToBDTimeWithMonth(appliedStartDate) : (deviceHistory.length > 0 ? formatToBDTimeWithMonth(deviceHistory[0].timestamp) : 'Beginning');
      const filterEndText = appliedEndDate ? formatToBDTimeWithMonth(appliedEndDate) : (deviceHistory.length > 0 ? formatToBDTimeWithMonth(deviceHistory[deviceHistory.length - 1].timestamp) : 'Now');

      const summaryBody: (string | number)[][] = [
          ["Filter Period:", `${filterStartText}  to  ${filterEndText}`],
          ["Total Filtered Records:", `${deviceHistory.length.toLocaleString()} data points`],
          ["Average Temperature:", avgTemp !== null ? `${avgTemp.toFixed(1)} °C` : 'N/A'],
          ["Average Humidity:", avgHumidity !== null ? `${avgHumidity.toFixed(1)} %` : 'N/A'],
          ["Average Water Level:", `${avgWater.toFixed(2)} ft`],
          ["Total Rainfall in Range:", `${totalRain.toFixed(2)} mm`],
      ];

      autoTable(doc, {
          body: summaryBody,
          startY: currentY,
          theme: 'plain',
          styles: { fontSize: 9, cellPadding: { top: 1.5, right: 2, bottom: 1.5, left: 0 } },
          columnStyles: { 0: { fontStyle: 'bold', cellWidth: 50 } },
      });
      currentY = (doc as any).lastAutoTable.finalY + 10;

      const lineChartEl = document.querySelector<HTMLElement>('#line-chart-container');
      const pieChartEl = document.querySelector<HTMLElement>('#pie-chart-container');

      const chartOptions = { backgroundColor: '#ffffff', scale: 1.5, logging: false };
      let lineCanvas: HTMLCanvasElement | null = null;
      let pieCanvas: HTMLCanvasElement | null = null;
      try {
        if (lineChartEl) lineCanvas = await html2canvas(lineChartEl, chartOptions);
      } catch (e) {
        console.warn('Could not capture line chart canvas:', e);
      }
      try {
        if (pieChartEl) pieCanvas = await html2canvas(pieChartEl, chartOptions);
      } catch (e) {
        console.warn('Could not capture pie chart canvas:', e);
      }

      const chartHeight = 70;
      const halfWidth = (pageWidth - pageMargin * 2 - 10) / 2;

      if (currentY + chartHeight > pageHeight - pageMargin - 15) {
          doc.addPage();
          currentY = pageMargin;
      }

      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      
      const chartY = currentY + 5;

      if (lineCanvas) {
          doc.text('Sensor History', pageMargin, currentY);
          const lineImgData = lineCanvas.toDataURL('image/png');
          const lineProps = doc.getImageProperties(lineImgData);
          const lineRatio = lineProps.height / lineProps.width;
          doc.addImage(lineImgData, 'PNG', pageMargin, chartY, halfWidth, halfWidth * lineRatio);
      }
      
      if (pieCanvas) {
          doc.text('Averages (Filtered)', pageMargin + halfWidth + 10, currentY);
          const pieImgData = pieCanvas.toDataURL('image/png');
          const pieProps = doc.getImageProperties(pieImgData);
          const pieRatio = pieProps.height / pieProps.width;
          doc.addImage(pieImgData, 'PNG', pageMargin + halfWidth + 10, chartY, halfWidth, halfWidth * pieRatio);
      }
      
      doc.addPage();
      currentY = pageMargin;

      // Sort data chronologically (Oldest to Newest, date to date in serial order)
      const sortedData = [...deviceHistory].sort((a, b) => (new Date(a.timestamp).getTime() || 0) - (new Date(b.timestamp).getTime() || 0));
      
      // Render ALL filtered records (supports full 1-year, 2-year, 3-year data without 3000 cap)
      const pdfSlice = sortedData;

      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.text(
          `Filtered Data Points (${pdfSlice.length.toLocaleString()} Records in Serial Order)`, 
          pageMargin, 
          currentY
      );
      currentY += 6;

      const pdfTableRows = pdfSlice.map((d, index) => [
          String(index + 1),
          formatToBDTimeWithMonth(d.timestamp),
          d.temperature !== null ? d.temperature.toFixed(1) : 'N/A',
          d.humidity !== null ? d.humidity.toFixed(1) : 'N/A',
          d.water_level.toFixed(2),
          d.rainfall.toFixed(2)
      ]);

      autoTable(doc, {
          head: [['SL', 'Date & Time (Timestamp)', 'Temp (°C)', 'Humidity (%)', 'Water (ft)', 'Rain (mm)']],
          body: pdfTableRows,
          startY: currentY,
          theme: 'grid',
          headStyles: { fillColor: [79, 70, 229], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center' },
          columnStyles: {
              0: { halign: 'center', cellWidth: 14 },
              1: { halign: 'left' },
              2: { halign: 'center' },
              3: { halign: 'center' },
              4: { halign: 'center' },
              5: { halign: 'center' },
          },
          styles: { fontSize: 8, cellPadding: 1.8 },
          alternateRowStyles: { fillColor: [248, 250, 252] },
      });

      const totalPages = (doc as any).internal.getNumberOfPages();
      for (let p = 1; p <= totalPages; p++) {
          doc.setPage(p);
          doc.setFontSize(8);
          doc.setTextColor(148, 163, 184);
          doc.text(
              `Page ${p} of ${totalPages} • EMS Environmental Monitoring System`,
              pageWidth / 2,
              pageHeight - 8,
              { align: 'center' }
          );
      }
      
      const fileStartDate = (appliedStartDate || '').slice(0, 10);
      const fileEndDate = (appliedEndDate || '').slice(0, 10);
      const fileNameRange = (fileStartDate && fileEndDate) ? `_${fileStartDate}_to_${fileEndDate}` : `_${new Date().toISOString().slice(0, 10)}`;
      doc.save(`EMS_Report_${uid}${fileNameRange}.pdf`);
      toast({ title: 'PDF Downloaded', description: `Report generated with ${pdfSlice.length.toLocaleString()} filtered records.` });
    } catch (err: any) {
      console.error('PDF generation error:', err);
      toast({ title: 'Error', description: 'Failed to generate PDF: ' + err.message, variant: 'destructive' });
    } finally {
      setIsPdfLoading(false);
    }
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
    <div className="space-y-4 sm:space-y-6 w-full max-w-full overflow-x-hidden p-1 sm:p-0">
       <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="w-[95vw] max-w-lg p-4 sm:p-6 max-h-[90vh] overflow-y-auto">
            <DialogHeader>
                <DialogTitle>Edit Device</DialogTitle>
                <CardDescription>Update the name and location for this device.</CardDescription>
            </DialogHeader>
            <div className="grid gap-3 sm:gap-4 py-2 sm:py-4">
                <div className="grid grid-cols-1 sm:grid-cols-4 items-start sm:items-center gap-1.5 sm:gap-4">
                    <Label htmlFor="institution" className="text-left sm:text-right font-medium text-xs sm:text-sm">Institution</Label>
                    <Input id="institution" value={editingInstitution || ''} onChange={(e) => setEditingInstitution(e.target.value)} className="col-span-1 sm:col-span-3 text-sm" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-4 items-start sm:items-center gap-1.5 sm:gap-4">
                    <Label htmlFor="name" className="text-left sm:text-right font-medium text-xs sm:text-sm">Upazila Name</Label>
                    <Input id="name" value={editingName} onChange={(e) => setEditingName(e.target.value)} className="col-span-1 sm:col-span-3 text-sm" />
                </div>
                 <div className="grid grid-cols-1 sm:grid-cols-4 items-start sm:items-center gap-1.5 sm:gap-4">
                    <Label htmlFor="location" className="text-left sm:text-right font-medium text-xs sm:text-sm">Location</Label>
                    <Input id="location" value={editingLocation} onChange={(e) => setEditingLocation(e.target.value)} className="col-span-1 sm:col-span-3 text-sm" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-4 items-start sm:items-center gap-1.5 sm:gap-4">
                    <Label htmlFor="latitude" className="text-left sm:text-right font-medium text-xs sm:text-sm">Latitude</Label>
                    <Input id="latitude" type="number" value={editingLatitude ?? ''} onChange={(e) => setEditingLatitude(e.target.value === '' ? null : parseFloat(e.target.value))} className="col-span-1 sm:col-span-3 text-sm" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-4 items-start sm:items-center gap-1.5 sm:gap-4">
                    <Label htmlFor="longitude" className="text-left sm:text-right font-medium text-xs sm:text-sm">Longitude</Label>
                    <Input id="longitude" type="number" value={editingLongitude ?? ''} onChange={(e) => setEditingLongitude(e.target.value === '' ? null : parseFloat(e.target.value))} className="col-span-1 sm:col-span-3 text-sm" />
                </div>
            </div>
            <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2">
                <DialogClose asChild>
                    <Button variant="ghost" className="w-full sm:w-auto">Cancel</Button>
                </DialogClose>
                <Button onClick={handleSave} disabled={isSaving || !isAdmin} className="w-full sm:w-auto">
                    {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save Changes
                </Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>


      <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
        <Button onClick={() => window.history.back()} variant="outline" size="sm" className="self-start sm:self-auto">
            <ArrowLeft className="mr-2 h-4 w-4" />Back
        </Button>
        <div className="grid grid-cols-3 sm:flex sm:flex-wrap gap-2 items-center w-full sm:w-auto">
            <Button 
                variant="default" 
                size="sm" 
                onClick={() => setIsAiChatOpen(true)}
                className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white shadow-md flex items-center gap-1.5 px-2 sm:px-3 text-xs sm:text-sm justify-center"
            >
                <Sparkles className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-amber-200 shrink-0" />
                <span className="font-semibold whitespace-nowrap">Ask AI</span>
            </Button>
            {isAdmin && (
                <Button variant="outline" size="sm" onClick={() => setIsEditDialogOpen(true)} className="px-2 sm:px-3 text-xs sm:text-sm justify-center">
                    <Edit className="mr-1.5 sm:mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" /> <span className="truncate">Edit</span>
                </Button>
            )}
            <Dialog>
                <DialogTrigger asChild>
                    <Button variant="outline" size="sm" className="px-2 sm:px-3 text-xs sm:text-sm justify-center">
                        <QrCode className="mr-1.5 sm:mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" /><span>Share</span>
                    </Button>
                </DialogTrigger>
                <DialogContent className="w-[95vw] max-w-[425px] p-4 sm:p-6">
                    <DialogHeader>
                    <DialogTitle className="text-base sm:text-lg">Scan to view this device</DialogTitle>
                    </DialogHeader>
                    <div className="flex flex-col items-center justify-center p-2 sm:p-4">
                    {qrCodeUrl && <img src={qrCodeUrl} alt="QR Code" className="w-52 h-52 sm:w-64 sm:h-64 object-contain" />}
                    <p className="text-xs text-muted-foreground mt-2 break-all text-center">{typeof window !== 'undefined' && window.location.href}</p>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
      </div>

      <div className="min-w-0">
        <h1 className="text-2xl sm:text-3xl font-bold truncate">{deviceInfo?.name || 'Device Details'}</h1>
        <p className="text-muted-foreground font-mono text-xs sm:text-sm break-all">{uid}</p>
        {deviceInfo?.location && (
            <p className="text-muted-foreground text-xs sm:text-sm flex items-start gap-1.5 mt-1 min-w-0">
                <MapPin className="h-4 w-4 shrink-0 text-muted-foreground mt-0.5" /> 
                <span className="break-all [overflow-wrap:anywhere] min-w-0">{deviceInfo.location}</span>
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
        <CardHeader className="p-4 sm:p-6 pb-2 sm:pb-3">
            <CardTitle className="text-lg sm:text-xl">Filtered Range Summary</CardTitle>
            <CardDescription className="text-xs sm:text-sm">
                Summary of data from {appliedStartDate ? formatToBDTime(appliedStartDate) : 'the beginning'} to {appliedEndDate ? formatToBDTime(appliedEndDate) : 'now'}.
                {latestData && (
                    <span className="block mt-1">Last Updated: <span className="font-semibold">{formatToBDTime(latestData.timestamp)}</span></span>
                )}
            </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4 p-3 sm:p-6 pt-0 sm:pt-0">
            {summaryStats ? (
                <>
                    <div className="p-3 sm:p-4 bg-muted/50 rounded-lg">
                        <h4 className="text-xs sm:text-sm font-medium text-amber-500">Temperature</h4>
                        <p className="text-lg sm:text-2xl font-bold mt-0.5">{summaryStats.temperature.avg?.toFixed(1) ?? 'N/A'} °C</p>
                        <div className="flex flex-col sm:flex-row sm:justify-between text-[11px] sm:text-xs text-muted-foreground mt-1 gap-0.5">
                            <span className="flex items-center gap-1"><ArrowDown className="h-3 w-3 text-blue-500 shrink-0"/>Min: {summaryStats.temperature.min?.toFixed(1) ?? 'N/A'}</span>
                            <span className="flex items-center gap-1"><ArrowUp className="h-3 w-3 text-red-500 shrink-0"/>Max: {summaryStats.temperature.max?.toFixed(1) ?? 'N/A'}</span>
                        </div>
                    </div>
                    <div className="p-3 sm:p-4 bg-muted/50 rounded-lg">
                        <h4 className="text-xs sm:text-sm font-medium text-purple-500">Humidity</h4>
                        <p className="text-lg sm:text-2xl font-bold mt-0.5">{summaryStats.humidity.avg?.toFixed(1) ?? 'N/A'} %</p>
                         <div className="flex flex-col sm:flex-row sm:justify-between text-[11px] sm:text-xs text-muted-foreground mt-1 gap-0.5">
                            <span className="flex items-center gap-1"><ArrowDown className="h-3 w-3 text-blue-500 shrink-0"/>Min: {summaryStats.humidity.min?.toFixed(1) ?? 'N/A'}</span>
                            <span className="flex items-center gap-1"><ArrowUp className="h-3 w-3 text-red-500 shrink-0"/>Max: {summaryStats.humidity.max?.toFixed(1) ?? 'N/A'}</span>
                        </div>
                    </div>
                    <div className="p-3 sm:p-4 bg-muted/50 rounded-lg">
                        <h4 className="text-xs sm:text-sm font-medium text-sky-500">Water Level</h4>
                        <p className="text-lg sm:text-2xl font-bold mt-0.5">{summaryStats.water_level.avg?.toFixed(2) ?? 'N/A'} ft</p>
                         <div className="flex flex-col sm:flex-row sm:justify-between text-[11px] sm:text-xs text-muted-foreground mt-1 gap-0.5">
                            <span className="flex items-center gap-1"><ArrowDown className="h-3 w-3 text-blue-500 shrink-0"/>Min: {summaryStats.water_level.min?.toFixed(2) ?? 'N/A'}</span>
                            <span className="flex items-center gap-1"><ArrowUp className="h-3 w-3 text-red-500 shrink-0"/>Max: {summaryStats.water_level.max?.toFixed(2) ?? 'N/A'}</span>
                        </div>
                    </div>
                    <div className="p-3 sm:p-4 bg-muted/50 rounded-lg">
                        <h4 className="text-xs sm:text-sm font-medium text-emerald-500">Rainfall</h4>
                        <p className="text-lg sm:text-2xl font-bold mt-0.5">{summaryStats.rainfall.total?.toFixed(2) ?? 'N/A'} mm</p>
                        <div className="flex justify-between text-[11px] sm:text-xs text-muted-foreground mt-1">
                            <span>Total in Range</span>
                        </div>
                    </div>
                </>
            ) : <p className="col-span-full text-center">No data to display summary.</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="p-4 sm:p-6 pb-2 sm:pb-3">
          <CardTitle className="text-lg sm:text-xl">Filter History</CardTitle>
        </CardHeader>
        <CardContent className="p-4 sm:p-6 pt-0 space-y-4">
             <div className="flex flex-wrap gap-1.5 sm:gap-2">
                <Button variant={activeFilter === 6 * 60 ? "default" : "outline"} size="sm" className="h-8 text-xs px-2.5 sm:px-3" onClick={() => handleQuickFilter(6 * 60)}>6 hour</Button>
                <Button variant={activeFilter === 12 * 60 ? "default" : "outline"} size="sm" className="h-8 text-xs px-2.5 sm:px-3" onClick={() => handleQuickFilter(12 * 60)}>12 hour</Button>
                <Button variant={activeFilter === 24 * 60 ? "default" : "outline"} size="sm" className="h-8 text-xs px-2.5 sm:px-3" onClick={() => handleQuickFilter(24 * 60)}>1 day</Button>
                <Button variant={activeFilter === 7 * 24 * 60 ? "default" : "outline"} size="sm" onClick={() => handleQuickFilter(7 * 24 * 60)} className="h-8 text-xs px-2.5 sm:px-3">7 day</Button>
                <Button variant={activeFilter === 15 * 24 * 60 ? "default" : "outline"} size="sm" onClick={() => handleQuickFilter(15 * 24 * 60)} className="h-8 text-xs px-2.5 sm:px-3">15 day</Button>
                <Button variant={activeFilter === 30 * 24 * 60 ? "default" : "outline"} size="sm" onClick={() => handleQuickFilter(30 * 24 * 60)} className="h-8 text-xs px-2.5 sm:px-3">30 day</Button>
                <Button variant={activeFilter === 365 * 24 * 60 ? "default" : "outline"} size="sm" onClick={() => handleQuickFilter(365 * 24 * 60)} className="h-8 text-xs px-2.5 sm:px-3">1 year</Button>
                <Button variant={activeFilter === 2 * 365 * 24 * 60 ? "default" : "outline"} size="sm" onClick={() => handleQuickFilter(2 * 365 * 24 * 60)} className="h-8 text-xs px-2.5 sm:px-3">2 year</Button>
                <Button variant={activeFilter === 3 * 365 * 24 * 60 ? "default" : "outline"} size="sm" onClick={() => handleQuickFilter(3 * 365 * 24 * 60)} className="h-8 text-xs px-2.5 sm:px-3">3 year</Button>
            </div>
          <div className="flex flex-col md:flex-row gap-3 sm:gap-4 items-stretch md:items-end">
            <div className="grid w-full gap-1.5">
                <label htmlFor="start-date" className="text-xs sm:text-sm font-medium">Start Date/Time</label>
                <Input id="start-date" type="datetime-local" className="text-xs sm:text-sm h-9 sm:h-10" value={startDate} onChange={e => { setStartDate(e.target.value); setActiveFilter(null); }} />
            </div>
            <div className="grid w-full gap-1.5">
                <label htmlFor="end-date" className="text-xs sm:text-sm font-medium">End Date/Time</label>
                <Input id="end-date" type="datetime-local" className="text-xs sm:text-sm h-9 sm:h-10" value={endDate} onChange={e => { setEndDate(e.target.value); setActiveFilter(null); }} />
            </div>
            <div className="flex flex-wrap gap-2 w-full md:w-auto shrink-0">
              <Button onClick={applyFilters} disabled={loading} className="flex-1 md:flex-none h-9 sm:h-10">
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Filter className="mr-2 h-4 w-4"/>}
                Filter
              </Button>
              <Button onClick={resetFilters} variant="outline" className="flex-1 md:flex-none h-9 sm:h-10" disabled={loading}>Reset</Button>
              <Button 
                onClick={downloadPDF} 
                disabled={isPdfLoading || deviceHistory.length === 0} 
                className="flex-1 md:flex-none h-9 sm:h-10 bg-indigo-600 hover:bg-indigo-700 text-white font-medium shadow-sm"
                title="Generate PDF report of filtered data points"
              >
                {isPdfLoading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <FileText className="mr-1.5 h-4 w-4" />}
                {isPdfLoading ? 'Generating...' : 'Generate PDF'}
              </Button>
            </div>
          </div>
          {appliedStartDate && (
            <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t flex-wrap gap-1">
              <span>
                Active Filter: <strong className="text-foreground">{deviceHistory.length.toLocaleString()}</strong> data points found
                ({formatToBDTime(appliedStartDate)} to {appliedEndDate ? formatToBDTime(appliedEndDate) : 'Now'})
              </span>
              <button 
                type="button" 
                onClick={() => document.getElementById('filtered-data-table')?.scrollIntoView({ behavior: 'smooth' })} 
                className="text-primary hover:underline font-medium flex items-center gap-1 cursor-pointer"
              >
                View in Filtered Table ↓
              </button>
            </div>
          )}
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
        <Card className="lg:col-span-3 light overflow-hidden" id="line-chart-container">
          <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-4 sm:p-6 pb-2">
            <div>
              <CardTitle className="text-lg sm:text-xl">Sensor History</CardTitle>
              <CardDescription className="text-xs mt-1">
                {deviceHistory.length > 0 ? (
                  <span>
                    Showing <strong>{deviceHistory.length.toLocaleString()}</strong> data points ({formatToBDDate(deviceHistory[0].timestamp)} to {formatToBDDate(deviceHistory[deviceHistory.length - 1].timestamp)})
                    {appliedStartDate && appliedEndDate && (
                      <span className="text-muted-foreground ml-2">
                        • Filter: {formatToBDDate(appliedStartDate)} to {formatToBDDate(appliedEndDate)}
                      </span>
                    )}
                  </span>
                ) : 'No data in selected range'}
              </CardDescription>
            </div>
            {deviceHistory.length > 0 && (
              <Button variant="outline" size="sm" className="h-8 text-xs self-start sm:self-auto" onClick={downloadCSV}>
                <Download className="mr-1.5 h-3.5 w-3.5" />
                CSV
              </Button>
            )}
          </CardHeader>
          <CardContent className="h-[300px] sm:h-[400px] p-0 sm:p-2">
             {loading ? <div className="h-full flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div> : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 10, right: isMobile ? 8 : 20, left: isMobile ? -22 : 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="dateTime" tickFormatter={(ts) => formatToBDTime(ts).split(',')[0] } stroke="hsl(var(--muted-foreground))" fontSize={isMobile ? 10 : 12} tickLine={false} />
                  <YAxis yAxisId="left" stroke="#fbbf24" width={isMobile ? 30 : 45} tick={{ fontSize: isMobile ? 10 : 12 }} label={isMobile ? undefined : { value: '°C / %', angle: -90, position: 'insideLeft' }} />
                  <YAxis yAxisId="right" orientation="right" stroke="#38bdf8" width={isMobile ? 30 : 45} tick={{ fontSize: isMobile ? 10 : 12 }} label={isMobile ? undefined : { value: 'ft / mm', angle: -90, position: 'insideRight' }}/>
                  <Tooltip content={<ChartTooltipContent />} />
                  <Legend wrapperStyle={{ fontSize: isMobile ? '11px' : '14px', paddingTop: '8px' }} />
                  <Line yAxisId="left" type="monotone" dataKey="temperature" name="Temperature" stroke="#fbbf24" dot={false} connectNulls />
                  <Line yAxisId="left" type="monotone" dataKey="humidity" name="Humidity" stroke="#a855f7" dot={false} connectNulls />
                  <Line yAxisId="right" type="monotone" dataKey="water_level" name="Water Level" stroke="#38bdf8" dot={false} />
                  <Line yAxisId="right" type="monotone" dataKey="rainfall" name="Rainfall" stroke="#34d399" dot={false} />
                </LineChart>
              </ResponsiveContainer>
             )}
          </CardContent>
        </Card>
        <Card className="lg:col-span-2 overflow-hidden" id="pie-chart-container">
          <CardHeader className="p-4 sm:p-6 pb-2"><CardTitle className="text-lg sm:text-xl">Averages (Filtered)</CardTitle></CardHeader>
          <CardContent className="h-[300px] sm:h-[400px] p-2 sm:p-6">
             {pieChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie 
                            activeIndex={activePieIndex}
                            activeShape={(props: any) => renderActiveShape({ ...props, isMobile })}
                            data={pieChartData}
                            cx="50%" 
                            cy="50%" 
                            innerRadius={isMobile ? 55 : 80}
                            outerRadius={isMobile ? 80 : 110} 
                            dataKey="value" 
                            onMouseEnter={onPieEnter}
                        >
                            {pieChartData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} className="stroke-background hover:opacity-80 focus:outline-none transition-opacity"/>
                            ))}
                        </Pie>
                        <Tooltip content={<ChartTooltipContent />} />
                        <Legend iconType="circle" wrapperStyle={{ fontSize: isMobile ? '11px' : '14px' }} />
                    </PieChart>
                </ResponsiveContainer>
             ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">No data for pie chart.</div>
             )}
          </CardContent>
        </Card>
      </div>

       {mapLocation && (
        <Card className="overflow-hidden">
          <CardHeader className="p-4 sm:p-6 pb-2 sm:pb-3">
            <CardTitle className="text-lg sm:text-xl">Device Location</CardTitle>
          </CardHeader>
          <CardContent className="p-2 sm:p-6 pt-0">
            <iframe
              width="100%"
              height={isMobile ? "280" : "450"}
              style={{ border: 0, borderRadius: "0.5rem" }}
              loading="lazy"
              allowFullScreen
              src={`https://www.openstreetmap.org/export/embed.html?bbox=${mapLocation.lng-0.05},${mapLocation.lat-0.05},${mapLocation.lng+0.05},${mapLocation.lat+0.05}&layer=mapnik&marker=${mapLocation.lat},${mapLocation.lng}`}>
            </iframe>
          </CardContent>
        </Card>
      )}

      <Card className="overflow-hidden" id="filtered-data-table">
        <CardHeader className="p-4 sm:p-6 pb-2 sm:pb-3">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
            <div>
              <CardTitle className="text-lg sm:text-xl">Filtered Data Points</CardTitle>
              <CardDescription className="text-xs mt-1">
                {deviceHistory.length > 0 
                  ? `Total ${deviceHistory.length.toLocaleString()} records found in selected range (Sorted: ${sortOrder === 'asc' ? 'Oldest to Newest' : 'Newest to Oldest'})` 
                  : (loading ? 'Loading records...' : 'No records found')}
              </CardDescription>
            </div>
            {deviceHistory.length > 0 && (
              <div className="flex items-center flex-wrap justify-between sm:justify-end gap-2 text-xs sm:text-sm text-muted-foreground">
                <Button 
                  size="sm" 
                  className="h-8 text-xs bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5 font-medium shadow-sm"
                  onClick={downloadPDF}
                  disabled={isPdfLoading || deviceHistory.length === 0}
                  title="Generate PDF report for these filtered data points"
                >
                  {isPdfLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin"/> : <FileText className="h-3.5 w-3.5"/>}
                  <span>PDF Report</span>
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="h-8 text-xs gap-1.5"
                  onClick={downloadCSV}
                  disabled={deviceHistory.length === 0}
                  title="Download CSV for these filtered data points"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>CSV</span>
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="h-8 text-xs"
                  onClick={() => setSortOrder(o => o === 'asc' ? 'desc' : 'asc')}
                  title="Toggle serial order between earliest-first and latest-first"
                >
                  Order: {sortOrder === 'asc' ? 'Oldest → Newest' : 'Newest → Oldest'}
                </Button>
                <div className="flex items-center gap-1.5">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="h-8 text-xs"
                    onClick={() => setTablePage(p => Math.max(1, p - 1))}
                    disabled={tablePage === 1}
                  >
                    Previous
                  </Button>
                  <span className="px-1 text-xs">Page {tablePage} of {totalPages}</span>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="h-8 text-xs"
                    onClick={() => setTablePage(p => Math.min(totalPages, p + 1))}
                    disabled={tablePage >= totalPages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0 sm:p-6 pt-0 sm:pt-0">
          <div className="max-h-[500px] overflow-y-auto overflow-x-auto w-full">
            <Table className="min-w-[540px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-14 text-center text-xs sm:text-sm font-bold">SL</TableHead>
                  <TableHead className="text-xs sm:text-sm">Timestamp (Date & Time)</TableHead>
                  <TableHead className="text-center text-xs sm:text-sm">Temp (°C)</TableHead>
                  <TableHead className="text-center text-xs sm:text-sm">Humidity (%)</TableHead>
                  <TableHead className="text-center text-xs sm:text-sm">Water (ft)</TableHead>
                  <TableHead className="text-center text-xs sm:text-sm">Rain (mm)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-10">
                      <div className="flex justify-center items-center gap-2 text-muted-foreground text-xs sm:text-sm">
                        <Loader2 className="h-5 w-5 animate-spin text-primary" />
                        <span>Loading filtered data points...</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : paginatedData.length > 0 ? (
                  paginatedData.map((d, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-center font-mono font-medium text-xs sm:text-sm text-muted-foreground">
                        {(tablePage - 1) * rowsPerPage + i + 1}
                      </TableCell>
                      <TableCell className="text-xs sm:text-sm whitespace-nowrap">
                        {formatToBDTimeWithMonth(d.timestamp)}
                      </TableCell>
                      <TableCell className="text-center font-semibold text-amber-500 text-xs sm:text-sm">{d.temperature !== null ? d.temperature.toFixed(1) : 'N/A'}</TableCell>
                      <TableCell className="text-center font-semibold text-purple-500 text-xs sm:text-sm">{d.humidity !== null ? d.humidity.toFixed(1) : 'N/A'}</TableCell>
                      <TableCell className="text-center font-semibold text-sky-500 text-xs sm:text-sm">{d.water_level.toFixed(2)}</TableCell>
                      <TableCell className="text-center font-semibold text-emerald-500 text-xs sm:text-sm">{d.rainfall.toFixed(2)}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground text-xs sm:text-sm">No data found for the selected filter range.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col sm:flex-row justify-center items-stretch sm:items-center gap-3">
        <Button onClick={downloadPDF} disabled={isPdfLoading || deviceHistory.length === 0} className="w-full sm:w-auto">
          {isPdfLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
          {isPdfLoading ? 'Generating Report...' : 'Download PDF Report'}
        </Button>
        <Button variant="outline" onClick={downloadCSV} disabled={deviceHistory.length === 0} className="w-full sm:w-auto">
          <Download className="mr-2 h-4 w-4" />
          Download CSV (All {deviceHistory.length.toLocaleString()} Records)
        </Button>
      </div>

      <DeviceAiChat 
        uid={uid} 
        deviceName={deviceInfo?.name} 
        location={deviceInfo?.location} 
        open={isAiChatOpen} 
        onOpenChange={setIsAiChatOpen} 
      />
    </div>
  );
}

    