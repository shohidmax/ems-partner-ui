'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { TriangleAlert, List, BarChart, Thermometer, Droplets, CloudRain } from 'lucide-react';
import { useUser } from '@/hooks/use-user';

const API_URL = 'https://espserver3.onrender.com/api/device/list';

interface DeviceInfo {
  uid: string;
  name: string | null;
  location: string | null;
  status: 'online' | 'offline' | 'unknown';
  lastSeen: string | null;
  latestData?: {
    temperature: number | null;
    water_level: number;
    rainfall: number;
  }
}

export default function DashboardPage() {
  const [devices, setDevices] = useState<DeviceInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { token } = useUser();

  const fetchData = async () => {
     if (!token) {
        setLoading(false);
        return;
    }
    setLoading(true);
    try {
      const headers = { 'Authorization': `Bearer ${token}` };
      const response = await fetch(API_URL, { headers, cache: 'no-cache' });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch device list. Status: ${response.status}`);
      }
      
      const deviceList: DeviceInfo[] = await response.json();
      
      setDevices(deviceList.sort((a,b) => (b.lastSeen && a.lastSeen) ? new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime() : 0));
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

  const onlineDevices = devices.filter(d => d.status === 'online');
  const onlineDevicesCount = onlineDevices.length;
  
  const summaryStats = () => {
    if (onlineDevices.length === 0) {
      return { avgTemp: null, avgWater: 0, avgRain: 0 };
    }
    const validTemps = onlineDevices.map(d => d.latestData?.temperature).filter(t => t !== null && t !== undefined) as number[];
    const avgTemp = validTemps.length > 0 ? validTemps.reduce((a, b) => a + b, 0) / validTemps.length : null;
    const avgWater = onlineDevices.reduce((a, b) => a + (b.latestData?.water_level || 0), 0) / onlineDevices.length;
    const avgRain = onlineDevices.reduce((a, b) => a + (b.latestData?.rainfall || 0), 0) / onlineDevices.length;
    return { avgTemp, avgWater, avgRain };
  }

  const { avgTemp, avgWater, avgRain } = summaryStats();

  
  const renderSkeletons = () => (
    Array.from({ length: 4 }).map((_, index) => (
      <Card key={index}>
        <CardHeader>
          <Skeleton className="h-6 w-3/4" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    ))
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold">Dashboard Overview</h1>
          <p className="text-muted-foreground">A quick summary of all online devices.</p>
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
      
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {loading ? renderSkeletons() : (
            <>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Avg. Temperature</CardTitle>
                        <Thermometer className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-amber-500">{avgTemp !== null ? `${avgTemp.toFixed(1)}°C` : 'N/A'}</div>
                        <p className="text-xs text-muted-foreground">Across all online devices</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Avg. Water Level</CardTitle>
                        <Droplets className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-sky-500">{avgWater.toFixed(2)} m</div>
                        <p className="text-xs text-muted-foreground">Across all online devices</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Avg. Daily Rainfall</CardTitle>
                        <CloudRain className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-emerald-500">{avgRain.toFixed(2)} mm</div>
                        <p className="text-xs text-muted-foreground">Across all online devices</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Devices</CardTitle>
                        <List className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{devices.length}</div>
                        <p className="text-xs text-muted-foreground">{onlineDevicesCount} currently online</p>
                    </CardContent>
                </Card>
            </>
        )}
      </div>

       <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
                <CardHeader>
                    <CardTitle>Recent Activity</CardTitle>
                    <CardDescription>A log of the most recently updated devices.</CardDescription>
                </CardHeader>
                <CardContent>
                   <div className="space-y-4">
                     {loading ? Array.from({length: 3}).map((_, i) => <Skeleton key={i} className="h-10 w-full" />) :
                      devices.slice(0, 5).map(device => (
                        <div key={device.uid} className="flex items-center">
                            <div className={`h-2.5 w-2.5 rounded-full mr-3 ${device.status === 'online' ? 'bg-green-500' : 'bg-muted-foreground'}`}></div>
                            <div className="flex-1">
                                <p className="text-sm font-medium leading-none">Device <Link href={`/dashboard/device/${device.uid}`} className="font-mono text-primary text-xs hover:underline">{device.uid.substring(0, 12)}...</Link></p>
                                <p className="text-sm text-muted-foreground">
                                    {`Temp: ${device.latestData?.temperature !== null && device.latestData?.temperature !== undefined ? device.latestData.temperature.toFixed(1) + '°C' : 'N/A'}`}
                                </p>
                            </div>
                            <div className="ml-auto font-medium text-sm">{device.lastSeen ? new Date(device.lastSeen).toLocaleTimeString() : 'N/A'}</div>
                        </div>
                      ))
                     }
                   </div>
                </CardContent>
            </Card>
             <Card>
                <CardHeader>
                    <CardTitle>Quick Links</CardTitle>
                     <CardDescription>Navigate to other sections of the application.</CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-4">
                    <Link href="/dashboard/devices" className="flex flex-col items-center justify-center p-4 bg-muted/50 rounded-lg hover:bg-muted transition-colors">
                        <List className="h-8 w-8 text-primary" />
                        <p className="mt-2 text-sm font-semibold">View All Devices</p>
                    </Link>
                    <Link href="/dashboard/admin/reports" className="flex flex-col items-center justify-center p-4 bg-muted/50 rounded-lg hover:bg-muted transition-colors">
                        <BarChart className="h-8 w-8 text-primary" />
                        <p className="mt-2 text-sm font-semibold">Reports & Analytics</p>
                    </Link>
                </CardContent>
            </Card>
        </div>

    </div>
  );
}
