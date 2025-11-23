
'use client';
import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { TriangleAlert, Edit, Save, X, User, Search, Copy, Pin, ArrowRight, MapPin } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useUser } from '@/hooks/use-user';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

const API_BASE_URL = 'https://esp32server2.maxapi.esp32.site/api';

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
      const response = await fetch(`${API_BASE_URL}/admin/devices`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) {
        if (response.status === 403) throw new Error('Admin access required to view this page.');
        throw new Error(`Failed to fetch devices: ${response.statusText}`);
      }
      const data = await response.json();
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
      const { uid, name, location, latitude, longitude } = editingDevice;
      const body: any = { name, location };
      if (latitude !== undefined) body.latitude = latitude;
      if (longitude !== undefined) body.longitude = longitude;

      const response = await fetch(`${API_BASE_URL}/device/${uid}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(body)
      });
      if (!response.ok) throw new Error('Failed to save device.');
      toast({ title: 'Success', description: 'Device updated successfully.' });
      setEditingDevice(null);
      await fetchDevices(); // Refresh list
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
            const ownerMatch = device.owners.some(o => o.name?.toLowerCase().includes(searchLower) || o.email?.toLowerCase().includes(searchLower));
            return nameMatch || uidMatch || locationMatch || ownerMatch;
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
            <DialogContent>
                 <DialogHeader>
                    <DialogTitle>Edit Device: {editingDevice?.name || editingDevice?.uid}</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                     <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="name" className="text-right">Name</Label>
                        <Input id="name" value={editingDevice?.name || ''} onChange={(e) => setEditingDevice(d => d ? {...d, name: e.target.value} : null)} className="col-span-3" />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="location" className="text-right">Location</Label>
                        <Input id="location" value={editingDevice?.location || ''} onChange={(e) => setEditingDevice(d => d ? {...d, location: e.target.value} : null)} className="col-span-3" />
                    </div>
                     <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="latitude" className="text-right">Latitude</Label>
                        <Input id="latitude" type="number" value={editingDevice?.latitude || ''} onChange={(e) => setEditingDevice(d => d ? {...d, latitude: e.target.value === '' ? null : parseFloat(e.target.value)} : null)} className="col-span-3" />
                    </div>
                     <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="longitude" className="text-right">Longitude</Label>
                        <Input id="longitude" type="number" value={editingDevice?.longitude || ''} onChange={(e) => setEditingDevice(d => d ? {...d, longitude: e.target.value === '' ? null : parseFloat(e.target.value)} : null)} className="col-span-3" />
                    </div>
                </div>
                 <DialogFooter>
                    <DialogClose asChild><Button variant="ghost">Cancel</Button></DialogClose>
                    <Button onClick={handleSave} disabled={isSaving}>
                        {isSaving && <X className="mr-2 h-4 w-4 animate-spin" />}
                        Save Changes
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
        
        <div className="flex flex-col md:flex-row justify-between items-start gap-4">
            <div>
                <h1 className="text-3xl font-bold">Device Management</h1>
                <p className="text-muted-foreground">View, edit, and manage all registered devices and their owners.</p>
            </div>
             <div className="relative w-full md:max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="Search devices..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                />
            </div>
        </div>

        <TooltipProvider>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {filteredDevices.map(device => (
                    <Card key={device.uid} className="h-full flex flex-col transition-all duration-300 ease-in-out hover:shadow-primary/20 hover:shadow-lg hover:-translate-y-1">
                        <CardHeader className="relative pb-4">
                             <div className="absolute top-4 right-4 flex items-center gap-2">
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button size="icon" variant="ghost" className="h-7 w-7 rounded-full" onClick={() => handleEdit(device)}>
                                            <Edit className="h-4 w-4" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent><p>Edit Device</p></TooltipContent>
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

                            <CardTitle className="text-xl font-bold text-primary pr-20">{device.name || 'Unnamed Device'}</CardTitle>
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
                            {device.location && (
                                <div className="flex items-center gap-2 pt-1 text-sm text-muted-foreground">
                                    <MapPin className="h-4 w-4" />
                                    <span className="truncate">{device.location}</span>
                                     {device.latitude && device.longitude && (
                                        <a href={`https://www.google.com/maps?q=${device.latitude},${device.longitude}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline text-xs">(Map)</a>
                                     )}
                                </div>
                            )}
                        </CardHeader>
                        <CardContent className="space-y-3 flex-1 flex flex-col justify-end">
                             <div>
                                <h4 className="text-sm font-medium mb-2">Owners</h4>
                                {device.owners.length > 0 ? (
                                    <div className="space-y-2">
                                        {device.owners.map(owner => (
                                            <Tooltip key={owner._id}>
                                                <TooltipTrigger asChild>
                                                    <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-md text-xs">
                                                        <User className="h-3 w-3" />
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
                         <div className="p-4 pt-4 border-t flex items-center justify-between">
                            <p className="text-xs text-muted-foreground">
                                Last seen: {device.lastSeen ? new Date(device.lastSeen).toLocaleString('en-GB') : 'Never'}
                            </p>
                             <Button asChild variant="outline" size="icon" className="h-8 w-8">
                                <Link href={`/dashboard/device/${device.uid}`}>
                                    <ArrowRight className="h-4 w-4" />
                                </Link>
                            </Button>
                         </div>
                    </Card>
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
