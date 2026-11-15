
'use client';
import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { TriangleAlert, Edit, Save, X, User, Search, Copy, Pin, ArrowRight, MapPin, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useUser } from '@/hooks/use-user';
import { cn, formatToBDTime } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { apiFetch } from '@/lib/api';

const API_PATH = '/api/admin';

interface DeviceOwner {
    _id: string;
    name: string;
    email: string;
}
interface AdminDevice {
  uid: string;
  name: string | null;
  location: string | null;
  latitude?: number | null;
  longitude?: number | null;
  status: 'online' | 'offline' | 'unknown';
  lastSeen: string | null;
  addedAt: string;
  owners: DeviceOwner[];
  institution?: string | null;
}

export default function AdminDeviceManagerPage() {
  const [devices, setDevices] = useState<AdminDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingDevice, setEditingDevice] = useState<AdminDevice | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const { toast } = useToast();
  const { token } = useUser();

  const fetchDevices = async () => {
    if (!token) {
        setLoading(false);
        setError('Authentication token not found.');
        return;
    }
    setLoading(true);
    try {
      const { data } = await apiFetch<AdminDevice[]>(`${API_PATH}/devices`);
      setDevices(data.sort((a: AdminDevice, b: AdminDevice) => {
        if (b.lastSeen && a.lastSeen) {
            return new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime();
        }
        if (b.lastSeen) return 1;
        if (a.lastSeen) return -1;
        return 0;
      }));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
        fetchDevices();
    }
  }, [token]);

  const handleEdit = (device: AdminDevice) => {
    setEditingDevice({ ...device });
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

  const handleSave = async () => {
    if (!editingDevice || !token) return;
    setIsSaving(true);
    try {
      const { uid, name, location, latitude, longitude, institution } = editingDevice;
      const body: any = { name, location, institution };
      if (latitude !== undefined) body.latitude = latitude;
      if (longitude !== undefined) body.longitude = longitude;

      await apiFetch(`${API_PATH}/device/${uid}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      
      toast({ title: 'Success', description: 'Device updated successfully.' });
      
      // Update local state instead of re-fetching
      setDevices(prevDevices => 
        prevDevices.map(d => d.uid === uid ? editingDevice : d)
      );
      
      setEditingDevice(null);

    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
        setIsSaving(false);
    }
  };
  
  const filteredDevices = useMemo(() => {
      return devices.filter(device => {
            if (!searchQuery) return true;
            const searchLower = searchQuery.toLowerCase();
            const nameMatch = device.name?.toLowerCase().includes(searchLower);
            const uidMatch = device.uid.toLowerCase().includes(searchLower);
            const locationMatch = device.location?.toLowerCase().includes(searchLower);
            const institutionMatch = device.institution?.toLowerCase().includes(searchLower);
            const ownerMatch = device.owners.some(o => o.name?.toLowerCase().includes(searchLower) || o.email?.toLowerCase().includes(searchLower));
            return nameMatch || uidMatch || locationMatch || ownerMatch || institutionMatch;
        });
  }, [devices, searchQuery]);

  if (loading) {
    return <div className="space-y-4">
      <Skeleton className="h-10 w-1/3" />
      <Skeleton className="h-8 w-1/2" />
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, index) => (
             <Card key={index}><CardContent className="p-6"><Skeleton className="h-48 w-full" /></CardContent></Card>
        ))}
      </div>
    </div>;
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <TriangleAlert className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
        <Dialog open={!!editingDevice} onOpenChange={(isOpen) => !isOpen && setEditingDevice(null)}>
            <DialogContent className="max-w-[95vw] sm:max-w-lg max-h-[90vh] overflow-y-auto">
                 <DialogHeader>
                    <DialogTitle>Edit Device: {editingDevice?.name || editingDevice?.uid}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="flex flex-col sm:grid sm:grid-cols-4 sm:items-center gap-1.5 sm:gap-4">
                        <Label htmlFor="institution" className="text-left sm:text-right text-xs sm:text-sm font-medium">Institution</Label>
                        <Input id="institution" value={editingDevice?.institution || ''} onChange={(e) => setEditingDevice(d => d ? {...d, institution: e.target.value} : null)} className="sm:col-span-3" />
                    </div>
                     <div className="flex flex-col sm:grid sm:grid-cols-4 sm:items-center gap-1.5 sm:gap-4">
                        <Label htmlFor="name" className="text-left sm:text-right text-xs sm:text-sm font-medium">Name</Label>
                        <Input id="name" value={editingDevice?.name || ''} onChange={(e) => setEditingDevice(d => d ? {...d, name: e.target.value} : null)} className="sm:col-span-3" />
                    </div>
                    <div className="flex flex-col sm:grid sm:grid-cols-4 sm:items-center gap-1.5 sm:gap-4">
                        <Label htmlFor="location" className="text-left sm:text-right text-xs sm:text-sm font-medium">Location</Label>
                        <Input id="location" value={editingDevice?.location || ''} onChange={(e) => setEditingDevice(d => d ? {...d, location: e.target.value} : null)} className="sm:col-span-3" />
                    </div>
                     <div className="flex flex-col sm:grid sm:grid-cols-4 sm:items-center gap-1.5 sm:gap-4">
                        <Label htmlFor="latitude" className="text-left sm:text-right text-xs sm:text-sm font-medium">Latitude</Label>
                        <Input id="latitude" type="number" value={editingDevice?.latitude ?? ''} onChange={(e) => setEditingDevice(d => d ? {...d, latitude: e.target.value === '' ? null : parseFloat(e.target.value)} : null)} className="sm:col-span-3" />
                    </div>
                     <div className="flex flex-col sm:grid sm:grid-cols-4 sm:items-center gap-1.5 sm:gap-4">
                        <Label htmlFor="longitude" className="text-left sm:text-right text-xs sm:text-sm font-medium">Longitude</Label>
                        <Input id="longitude" type="number" value={editingDevice?.longitude ?? ''} onChange={(e) => setEditingDevice(d => d ? {...d, longitude: e.target.value === '' ? null : parseFloat(e.target.value)} : null)} className="sm:col-span-3" />
                    </div>
                </div>
                 <DialogFooter className="gap-2 sm:gap-0">
                    <DialogClose asChild><Button variant="ghost">Cancel</Button></DialogClose>
                    <Button onClick={handleSave} disabled={isSaving}>
                        {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Save Changes
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
        
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Device Management</h1>
                <p className="text-muted-foreground text-xs sm:text-sm mt-0.5">View, edit, and manage all registered devices and their owners.</p>
            </div>
             <div className="relative w-full sm:max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="Search devices..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 w-full"
                />
            </div>
        </div>

        <TooltipProvider>
            <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {filteredDevices.map(device => (
                  <Link key={device.uid} href={`/dashboard/device/${device.uid}`} className="block group">
                    <Card className="h-full flex flex-col transition-all duration-300 ease-in-out group-hover:shadow-primary/20 group-hover:shadow-lg group-hover:-translate-y-1 overflow-hidden">
                        <CardHeader className="relative pb-3 sm:pb-4 p-4 sm:p-6">
                             <div className="absolute top-3 sm:top-4 right-3 sm:right-4 flex items-center gap-1.5">
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button size="icon" variant="ghost" className="h-7 w-7 rounded-full" onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleEdit(device);}}>
                                            <Edit className="h-3.5 w-3.5" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent><p>Edit Device</p></TooltipContent>
                                </Tooltip>
                                <div className={cn('flex items-center gap-1 text-[11px] sm:text-xs font-semibold px-2 py-0.5 rounded-full bg-muted/40', 
                                    device.status === 'online' ? 'text-green-500' : 'text-muted-foreground'
                                )}>
                                    <span className={cn('h-1.5 w-1.5 rounded-full', 
                                        device.status === 'online' ? 'bg-green-500 animate-pulse' : 'bg-muted-foreground'
                                    )}></span>
                                    {device.status}
                                </div>
                            </div>

                            <CardTitle className="text-lg sm:text-xl font-bold text-primary pr-24 truncate">{device.name || 'Unnamed Device'}</CardTitle>
                             <div className="flex items-center gap-2">
                                <CardDescription className="font-mono text-xs truncate max-w-[170px] sm:max-w-none">{device.uid}</CardDescription>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                    <button onClick={(e) => handleCopy(e, device.uid)} className='text-muted-foreground hover:text-foreground p-1'>
                                        <Copy className="h-3 w-3" />
                                    </button>
                                    </TooltipTrigger>
                                    <TooltipContent><p>Copy UID</p></TooltipContent>
                                </Tooltip>
                            </div>
                            {device.location && (
                                <div className="flex items-center gap-1.5 pt-1 text-xs sm:text-sm text-muted-foreground">
                                    <MapPin className="h-3.5 w-3.5 shrink-0" />
                                    <span className="truncate">{device.location}</span>
                                     {device.latitude && device.longitude && (
                                        <Button
                                            variant="link"
                                            className="p-0 h-auto text-xs shrink-0"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                window.open(`https://www.google.com/maps?q=${device.latitude},${device.longitude}`, '_blank');
                                            }}
                                        >
                                            (Map)
                                        </Button>
                                     )}
                                </div>
                            )}
                        </CardHeader>
                        <CardContent className="space-y-3 flex-1 flex flex-col justify-end p-4 sm:p-6 pt-0">
                             <div>
                                <h4 className="text-xs sm:text-sm font-medium mb-1.5">Owners</h4>
                                {device.owners.length > 0 ? (
                                    <div className="space-y-1.5 max-h-32 overflow-y-auto">
                                        {device.owners.map((owner, index) => (
                                            <Tooltip key={`${owner._id}-${index}`}>
                                                <TooltipTrigger asChild>
                                                    <div className="flex items-center gap-2 p-1.5 bg-muted/50 rounded-md text-xs">
                                                        <User className="h-3 w-3 shrink-0" />
                                                        <span className="flex-1 truncate">{owner.name}</span>
                                                    </div>
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                    <p>{owner.name}</p>
                                                    <p className="text-muted-foreground">{owner.email}</p>
                                                </TooltipContent>
                                            </Tooltip>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-xs text-muted-foreground">No owners assigned.</p>
                                )}
                            </div>
                        </CardContent>
                         <div className="p-3 sm:p-4 border-t flex items-center justify-between text-xs text-muted-foreground">
                            <span className="truncate pr-2">
                                {device.lastSeen ? `Last seen: ${formatToBDTime(device.lastSeen)}` : 'Never seen'}
                            </span>
                             <Button variant="outline" size="icon" className="h-7 w-7 sm:h-8 sm:w-8 shrink-0">
                                <ArrowRight className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                            </Button>
                         </div>
                    </Card>
                  </Link>
                ))}
                {filteredDevices.length === 0 && (
                     <div className="col-span-full text-center text-muted-foreground h-40 flex items-center justify-center">
                        <p>{searchQuery ? `No devices found for "${searchQuery}".` : "No devices found."}</p>
                    </div>
                )}
            </div>
        </TooltipProvider>
    </div>
  );
}

    