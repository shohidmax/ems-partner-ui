'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { TriangleAlert, Copy } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useUser } from '@/hooks/use-user';

const API_URL = 'https://espserver3.onrender.com/api/device/list';
const API_DATA_URL = 'https://espserver3.onrender.com/api/device/data';


interface DeviceInfo {
  uid: string;
  name: string | null;
  location: string | null;
  status: 'online' | 'offline' | 'unknown';
  lastSeen: string | null;
}

// Data from the old endpoint, to be merged
interface DeviceData {
  uid: string;
  temperature: number | null;
  water_level: number;
  rainfall: number;
  timestamp: string;
}


export default function DeviceListPage() {
  const [devices, setDevices] = useState<DeviceInfo[]>([]);
  const [deviceData, setDeviceData] = useState<DeviceData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const { token } = useUser();

  const handleCopy = (e: React.MouseEvent, text: string) => {
    e.stopPropagation();
    e.preventDefault();
    navigator.clipboard.writeText(text);
    toast({
      title: 'Copied to clipboard!',
      description: `UID: ${text}`,
    });
  };

  const fetchData = async () => {
    if (!token) {
        // Don't fetch if token isn't ready. The useUser hook will redirect if needed.
        return;
    }
    try {
      const headers = {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
      };
      // Fetch device list from the new endpoint
      const listResponse = await fetch(API_URL, { headers });
      if (!listResponse.ok) {
        throw new Error(`Failed to fetch device list. Status: ${listResponse.status}`);
      }
      const deviceList: DeviceInfo[] = await listResponse.json();
      
      // Fetch latest data from the old endpoint to get sensor readings
      const dataResponse = await fetch(API_DATA_URL, { headers });
       if (!dataResponse.ok) {
        throw new Error(`Failed to fetch device sensor data. Status: ${dataResponse.status}`);
      }
      const rawDeviceData: DeviceData[] = await dataResponse.json();

      const processedData = rawDeviceData.map((d: any) => ({
        ...d,
        temperature: (d.temperature === 85 || typeof d.temperature !== 'number') ? null : d.temperature,
        water_level: (typeof d.water_level !== 'number') ? 0 : d.water_level,
        rainfall: (typeof d.rainfall !== 'number') ? 0 : d.rainfall,
        timestamp: d.timestamp && !d.timestamp.startsWith('1970-') ? d.timestamp : null
      })).filter((d: any) => d.timestamp);

      setDevices(deviceList);
      setDeviceData(processedData);
      setError(null);

    } catch (e: any) {
      console.error('Failed to fetch data:', e);
      setError('Failed to fetch live data. The server might be offline or an error occurred. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000); // Poll every 60 seconds
    return () => clearInterval(interval);
  }, [token]);

  const getLatestDataForDevice = (uid: string): Partial<DeviceData> => {
    const deviceHistory = deviceData
      .filter(d => d.uid === uid)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return deviceHistory.length > 0 ? deviceHistory[0] : {};
  }


  const onlineDevicesCount = devices.filter(device => device.status === 'online').length;
  
  const renderSkeletons = () => (
    Array.from({ length: 4 }).map((_, index) => (
      <Card key={index}>
        <CardHeader>
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    ))
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold">Device List</h1>
          <p className="text-muted-foreground">All registered environmental monitoring devices.</p>
        </div>
        {!loading && !error && (
            <div className="flex items-center gap-3 bg-muted/50 px-4 py-2 rounded-lg">
                <div className="flex items-center gap-2 text-green-500 font-semibold">
                    <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                    </span>
                    <span>{onlineDevicesCount} Online</span>
                </div>
                <span className="text-muted-foreground">/</span>
                <div className="text-muted-foreground font-semibold">
                    <span>{devices.length} Total</span>
                </div>
            </div>
        )}
      </div>
      
      {error && (
        <Alert variant="destructive">
          <TriangleAlert className="h-4 w-4" />
          <AlertTitle>Connection Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <TooltipProvider>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {loading ? renderSkeletons() : 
            devices.length > 0 ? (
              devices.map((device) => {
                const latestData = getLatestDataForDevice(device.uid);
                return (
                <Link href={`/dashboard/device/${device.uid}`} key={device.uid} className="block group">
                  <Card className="h-full transition-all duration-300 ease-in-out group-hover:shadow-primary/20 group-hover:shadow-lg group-hover:-translate-y-1">
                    <CardHeader className="relative">
                      <div className={`absolute top-4 right-4 flex items-center gap-2 text-xs font-semibold ${device.status === 'online' ? 'text-green-500' : 'text-muted-foreground'}`}>
                        <span className={`h-2 w-2 rounded-full ${device.status === 'online' ? 'bg-green-500 animate-pulse' : 'bg-muted-foreground'}`}></span>
                        {device.status}
                      </div>
                      <CardTitle className="text-primary pr-16">{device.name || 'Device'}</CardTitle>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div
                            onClick={(e) => handleCopy(e, device.uid)}
                            className="inline-flex items-center gap-2 cursor-pointer"
                          >
                            <CardDescription className="font-mono text-xs">{device.uid}</CardDescription>
                            <Copy className="h-3 w-3 text-muted-foreground" />
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Click to copy UID</p>
                        </TooltipContent>
                      </Tooltip>
                       {device.location && <CardDescription className="text-xs">{device.location}</CardDescription>}
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex justify-between items-center bg-muted/50 p-3 rounded-lg">
                        <span className="font-medium text-sm">Temperature</span>
                        <span className="text-xl font-bold text-amber-500">
                          {latestData.temperature !== null && latestData.temperature !== undefined ? `${latestData.temperature.toFixed(1)} °C` : 'N/A'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center bg-muted/50 p-3 rounded-lg">
                        <span className="font-medium text-sm">Water Level</span>
                        <span className="text-xl font-bold text-sky-500">
                          {latestData.water_level !== undefined ? `${latestData.water_level.toFixed(2)} m` : 'N/A'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center bg-muted/50 p-3 rounded-lg">
                        <span className="font-medium text-sm">Daily Rainfall</span>
                        <span className="text-xl font-bold text-emerald-500">
                          {latestData.rainfall !== undefined ? `${latestData.rainfall.toFixed(2)} mm` : 'N/A'}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground pt-2">Last updated: {device.lastSeen ? new Date(device.lastSeen).toLocaleString() : 'Never'}</p>
                    </CardContent>
                  </Card>
                </Link>
              )})
            ) : (
              !error && <p className="col-span-full text-center text-muted-foreground">No devices found.</p>
            )}
        </div>
      </TooltipProvider>
    </div>
  );
}
