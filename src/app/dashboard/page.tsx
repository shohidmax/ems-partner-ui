'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { TriangleAlert } from 'lucide-react';

const API_URL = 'https://esp-web-server2.onrender.com/api/device/data';

interface DeviceData {
  uid: string;
  temperature: number | null;
  water_level: number;
  rainfall: number;
  timestamp: string;
}

export default function DashboardPage() {
  const [data, setData] = useState<DeviceData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      const response = await fetch(API_URL, { mode: 'cors', cache: 'no-cache' });
      if (!response.ok) {
        throw new Error(`Network response was not ok. Status: ${response.status}`);
      }
      const jsonData = await response.json();
      const processedData = jsonData.map((d: any) => ({
        ...d,
        temperature: (d.temperature === 85 || typeof d.temperature !== 'number') ? null : d.temperature,
        water_level: (typeof d.water_level !== 'number') ? 0 : d.water_level,
        rainfall: (typeof d.rainfall !== 'number') ? 0 : d.rainfall,
        timestamp: d.timestamp && !d.timestamp.startsWith('1970-') ? d.timestamp : null
      })).filter((d: any) => d.timestamp);
      
      setData(processedData);
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
    const interval = setInterval(fetchData, 60000); // Poll every 60 seconds
    return () => clearInterval(interval);
  }, []);

  const getLatestDataForDevices = (): DeviceData[] => {
    const latestDataMap = new Map<string, DeviceData>();
    data.forEach(device => {
      if (!device.uid || !device.timestamp) return;
      const existing = latestDataMap.get(device.uid);
      if (!existing || new Date(device.timestamp) > new Date(existing.timestamp)) {
        latestDataMap.set(device.uid, device);
      }
    });
    return Array.from(latestDataMap.values()).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  };

  const isDeviceOnline = (timestamp: string) => {
    if (!timestamp) return false;
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
    return new Date(timestamp) > twoMinutesAgo;
  };

  const latestUniqueDevices = getLatestDataForDevices();
  const onlineDevicesCount = latestUniqueDevices.filter(device => isDeviceOnline(device.timestamp)).length;
  
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
          <h1 className="text-3xl font-bold">Live Environmental Dashboard</h1>
          <p className="text-muted-foreground">Real-time sensor data from all active devices.</p>
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
                    <span>{latestUniqueDevices.length} Total</span>
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

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {loading ? renderSkeletons() : 
          latestUniqueDevices.length > 0 ? (
            latestUniqueDevices.map((device) => (
              <Link href={`/dashboard/device/${device.uid}`} key={device.uid} className="block group">
                <Card className="h-full transition-all duration-300 ease-in-out group-hover:shadow-primary/20 group-hover:shadow-lg group-hover:-translate-y-1">
                  <CardHeader className="relative">
                    <div className={`absolute top-4 right-4 flex items-center gap-2 text-xs font-semibold ${isDeviceOnline(device.timestamp) ? 'text-green-500' : 'text-muted-foreground'}`}>
                      <span className={`h-2 w-2 rounded-full ${isDeviceOnline(device.timestamp) ? 'bg-green-500 animate-pulse' : 'bg-muted-foreground'}`}></span>
                      {isDeviceOnline(device.timestamp) ? 'Online' : 'Offline'}
                    </div>
                    <CardTitle className="text-primary pr-16">Device</CardTitle>
                    <CardDescription className="font-mono text-xs">{device.uid}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between items-center bg-muted/50 p-3 rounded-lg">
                      <span className="font-medium text-sm">Temperature</span>
                      <span className="text-xl font-bold text-amber-500">
                        {device.temperature !== null ? `${device.temperature.toFixed(1)} °C` : 'N/A'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center bg-muted/50 p-3 rounded-lg">
                      <span className="font-medium text-sm">Water Level</span>
                      <span className="text-xl font-bold text-sky-500">
                        {device.water_level.toFixed(2)} m
                      </span>
                    </div>
                    <div className="flex justify-between items-center bg-muted/50 p-3 rounded-lg">
                      <span className="font-medium text-sm">Daily Rainfall</span>
                      <span className="text-xl font-bold text-emerald-500">
                        {device.rainfall.toFixed(2)} mm
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground pt-2">Last updated: {new Date(device.timestamp).toLocaleString()}</p>
                  </CardContent>
                </Card>
              </Link>
            ))
          ) : (
             !error && <p className="col-span-full text-center text-muted-foreground">No device data found.</p>
          )}
      </div>
    </div>
  );
}
