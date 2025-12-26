
'use client';
import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { TriangleAlert, Copy, Thermometer, Droplets, CloudRain, Pin, Search, Plus, Loader2, MapPin, ArrowRight } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useUser } from '@/hooks/use-user';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn, formatToBDTime } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { AddDeviceDialog } from '@/components/add-device-dialog';
import { Badge } from '@/components/ui/badge';


const API_BASE_URL = (typeof window !== 'undefined' && window.location.hostname === 'localhost')
    ? 'http://localhost:3002'
    : 'https://emspartner.espserver.site';
const API_URL = `${API_BASE_URL}/api/protected/devices`;


interface DeviceInfo {
  uid: string;
  name: string | null;
  location: string | null;
  latitude?: number | null;
  longitude?: number | null;
  status: 'online' | 'offline' | 'unknown';
  lastSeen: string | null;
  data?: {
    temperature: number | null;
    water_level: number;
    rainfall: number;
  }
}

export default function DeviceListPage() {
  const [devices, setDevices] = useState<DeviceInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pinnedDevices, setPinnedDevices] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const { toast } = useToast();
  const { user, token, isAdmin, fetchUserProfile } = useUser();
  const router = useRouter();
  const [isAddDeviceOpen, setIsAddDeviceOpen] = useState(false);
  
  useEffect(() => {
    if (isAdmin) {
      router.replace('/dashboard/admin/devices');
    }
  }, [isAdmin, router]);


  useEffect(() => {
    const storedPins = localStorage.getItem('pinnedDevices');
    if (storedPins) {
      try {
        const parsedPins = JSON.parse(storedPins);
        if (Array.isArray(parsedPins)) {
            setPinnedDevices(new Set(parsedPins));
        }
      } catch (e) {
        localStorage.removeItem('pinnedDevices');
      }
    }
  }, []);

  const togglePin = (e: React.MouseEvent, uid: string) => {
    e.stopPropagation();
    e.preventDefault();
    const newPinnedDevices = new Set(pinnedDevices);
    if (newPinnedDevices.has(uid)) {
      newPinnedDevices.delete(uid);
      toast({ title: 'Device unpinned.' });
    } else {
      newPinnedDevices.add(uid);
      toast({ title: 'Device pinned!' });
    }
    setPinnedDevices(newPinnedDevices);
    localStorage.setItem('pinnedDevices', JSON.stringify(Array.from(newPinnedDevices)));
  };

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
    if (!token || isAdmin) { 
        setLoading(false);
        return;
    }
    try {
      const headers = { 'Authorization': `Bearer ${token}` };
      const response = await fetch(API_URL, { headers, cache: 'no-cache' });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch device list. Status: ${response.status}`);
      }
      
      const deviceList: DeviceInfo[] = await response.json();
      
      setDevices(deviceList);
      setError(null);

    } catch (e: any) {
      setError('Failed to fetch your devices. The server might be offline or an error occurred. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token && !isAdmin) {
        fetchData();
        const interval = setInterval(fetchData, 30000); // Poll every 30 seconds
        return () => clearInterval(interval);
    }
  }, [token, isAdmin]);
  
  const sortedDevices = useMemo(() => {
      return [...devices]
        .filter(device => {
            if (!searchQuery) return true;
            const searchLower = searchQuery.toLowerCase();
            const nameMatch = device.name?.toLowerCase().includes(searchLower);
            const uidMatch = device.uid.toLowerCase().includes(searchLower);
            const locationMatch = device.location?.toLowerCase().includes(searchLower);
            return nameMatch || uidMatch || locationMatch;
        })
        .sort((a, b) => {
            const aIsPinned = pinnedDevices.has(a.uid);
            const bIsPinned = pinnedDevices.has(b.uid);

            if (aIsPinned && !bIsPinned) return -1;
            if (!aIsPinned && bIsPinned) return 1;

            if (b.lastSeen && a.lastSeen) {
                return new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime();
            }
             if (b.lastSeen) return 1;
             if (a.lastSeen) return -1;
            return 0;
        });
  }, [devices, pinnedDevices, searchQuery]);

  const onDeviceAdded = () => {
      fetchUserProfile(); 
      fetchData(); 
  };

  const onlineDevicesCount = devices.filter(device => device.status === 'online').length;
  
  const renderSkeletons = () => (
    Array.from({ length: 4 }).map((_, index) => (
      <Card key={index}>
        <CardHeader>
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </CardHeader>
        <CardContent className="space-y-4 pt-6">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    ))
  );

  if (isAdmin) {
    return (
      <div className="flex min-h-[calc(100vh-10rem)] w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
        <p className="ml-2">Redirecting to Admin Device Management...</p>
      </div>
    )
  }


  return (
    <div className="flex flex-col gap-6">
        <AddDeviceDialog open={isAddDeviceOpen} onOpenChange={setIsAddDeviceOpen} onDeviceAdded={onDeviceAdded} />
        <div className="flex flex-col md:flex-row justify-between items-start gap-4">
            <div>
              <h1 className="text-3xl font-bold">Device List</h1>
              <p className="text-muted-foreground">All registered environmental monitoring devices.</p>
            </div>
             <div className="flex w-full md:w-auto items-center gap-2">
                <div className="relative w-full md:max-w-xs">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search by name or UID..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10"
                    />
                </div>
                 <Button onClick={() => setIsAddDeviceOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Device
                </Button>
            </div>
        </div>
        
        {!loading && !error && (
             <div className="flex items-center gap-3 bg-muted/50 px-3 py-1.5 rounded-full self-start text-sm">
                <div className="flex items-center gap-2 text-green-500 font-semibold">
                    <span className="h-2 w-2 rounded-full bg-green-500"></span>
                    <span>{onlineDevicesCount} Online</span>
                </div>
                <span className="text-muted-foreground">/</span>
                <div className="text-muted-foreground font-semibold">
                    <span>{devices.length} Total</span>
                </div>
            </div>
        )}
      
      {error && (
        <Alert variant="destructive">
          <TriangleAlert className="h-4 w-4" />
          <AlertTitle>Connection Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <TooltipProvider>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {loading && devices.length === 0 ? renderSkeletons() : 
            sortedDevices.length > 0 ? (
              sortedDevices.map((device) => {
                const isPinned = pinnedDevices.has(device.uid);
                const hasLocation = device.latitude && device.longitude;
                return (
                <Link href={`/dashboard/device/${device.uid}`} key={device.uid} className="block group">
                  <Card className="h-full flex flex-col transition-all duration-300 ease-in-out group-hover:shadow-primary/20 group-hover:shadow-lg group-hover:-translate-y-1">
                    <CardHeader className="relative pb-4">
                        <div className="absolute top-4 right-4 flex items-center gap-2">
                            {hasLocation && (
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            size="icon" variant="ghost"
                                            className="h-7 w-7 rounded-full text-muted-foreground hover:text-primary"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                e.preventDefault();
                                                window.open(`https://www.google.com/maps?q=${device.latitude},${device.longitude}`, '_blank');
                                            }}
                                        >
                                            <MapPin className="h-4 w-4" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent><p>View on Map</p></TooltipContent>
                                </Tooltip>
                            )}
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button size="icon" variant="ghost" className={cn("h-7 w-7 rounded-full", isPinned ? 'text-primary' : 'text-muted-foreground/50')} onClick={(e) => togglePin(e, device.uid)}>
                                        <Pin className={cn("h-4 w-4", isPinned && 'fill-primary')} />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent><p>{isPinned ? 'Unpin Device' : 'Pin Device'}</p></TooltipContent>
                            </Tooltip>
                             <div className={cn('flex items-center gap-1.5 text-xs font-semibold', 
                                device.status === 'online' ? 'text-green-500' : 'text-muted-foreground'
                             )}>
                                <span className={cn('h-2 w-2 rounded-full', 
                                    device.status === 'online' ? 'bg-green-500' : 'bg-muted-foreground'
                                )}></span>
                                {device.status}
                            </div>
                        </div>
                        <CardTitle className="text-xl font-bold text-primary">{device.name || 'Unnamed Device'}</CardTitle>
                        <div className="flex items-center gap-2">
                            <CardDescription className="font-mono text-xs">{device.uid}</CardDescription>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                <button onClick={(e) => handleCopy(e, device.uid)} className='text-muted-foreground hover:text-foreground'>
                                    <Copy className="h-3 w-3" />
                                </button>
                                </TooltipTrigger>
                                <TooltipContent><p>Copy UID</p></TooltipContent>
                            </Tooltip>
                        </div>
                       {device.location && <CardDescription className="text-sm pt-1">{device.location}</CardDescription>}
                       {hasLocation && !device.location && <Badge variant="outline" className="w-fit mt-1">Location set</Badge>}
                    </CardHeader>
                    <CardContent className="space-y-3 flex-1 flex flex-col justify-end">
                       <div className="flex justify-between items-center text-base">
                        <div className="flex items-center gap-2 font-medium text-sm text-muted-foreground"><Thermometer className="h-4 w-4 text-amber-500"/>Temperature</div>
                        <span className="font-bold text-amber-500">
                          {device.data?.temperature !== null && device.data?.temperature !== undefined ? `${device.data.temperature.toFixed(1)} °C` : 'N/A'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-base">
                        <div className="flex items-center gap-2 font-medium text-sm text-muted-foreground"><Droplets className="h-4 w-4 text-sky-500"/>Water Level</div>
                        <span className="font-bold text-sky-500">
                          {device.data?.water_level !== undefined ? `${device.data.water_level.toFixed(2)} m` : 'N/A'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-base">
                         <div className="flex items-center gap-2 font-medium text-sm text-muted-foreground"><CloudRain className="h-4 w-4 text-emerald-500"/>Rainfall</div>
                        <span className="font-bold text-emerald-500">
                          {device.data?.rainfall !== undefined ? `${device.data.rainfall.toFixed(2)} mm` : 'N/A'}
                        </span>
                      </div>
                    </CardContent>
                     <div className="p-4 pt-4 border-t flex items-center justify-between">
                        <p className="text-xs text-muted-foreground">
                            Last seen: {device.lastSeen ? formatToBDTime(device.lastSeen) : 'Never'}
                        </p>
                         <Button variant="outline" size="icon" className="h-8 w-8">
                           <ArrowRight className="h-4 w-4" />
                        </Button>
                     </div>
                  </Card>
                </Link>
              )})
            ) : (
              !error && <div className="col-span-full text-center text-muted-foreground h-40 flex items-center justify-center">
                <p>{searchQuery ? `No devices found for "${searchQuery}".` : "You have no devices registered to your account yet. Click 'Add Device' to get started."}</p>
              </div>
            )}
        </div>
      </TooltipProvider>
    </div>
  );
}

    