'use client';
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { TriangleAlert, Edit, Save, X, User } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const API_URL = 'http://localhost:3005/api';

interface DeviceOwner {
    name: string;
    email: string;
}
interface AdminDevice {
  uid: string;
  name: string | null;
  location: string | null;
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
  const { toast } = useToast();

  const fetchDevices = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('No auth token found.');

      const response = await fetch(`${API_URL}/admin/devices`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) {
        if (response.status === 403) throw new Error('Admin access required to view this page.');
        throw new Error(`Failed to fetch devices: ${response.statusText}`);
      }
      const data = await response.json();
      setDevices(data.sort((a: AdminDevice, b: AdminDevice) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime()));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDevices();
  }, []);

  const handleEdit = (device: AdminDevice) => {
    setEditingDevice({ ...device });
  };

  const handleCancel = () => {
    setEditingDevice(null);
  };

  const handleSave = async () => {
    if (!editingDevice) return;
    try {
      const token = localStorage.getItem('token');
      const { uid, name, location } = editingDevice;
      const response = await fetch(`${API_URL}/device/${uid}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name, location })
      });
      if (!response.ok) throw new Error('Failed to save device.');
      toast({ title: 'Success', description: 'Device updated successfully.' });
      setEditingDevice(null);
      fetchDevices(); // Refresh list
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  };

  if (loading) {
    return <div className="space-y-4">
      <Skeleton className="h-10 w-1/3" />
      <Skeleton className="h-8 w-1/2" />
      <Card><CardContent className="p-6"><Skeleton className="h-64 w-full" /></CardContent></Card>
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
      <div>
        <h1 className="text-3xl font-bold">Device Management</h1>
        <p className="text-muted-foreground">View, edit, and manage all registered devices and their owners.</p>
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>UID</TableHead>
                <TableHead>Device Name</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Owners</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {devices.map(device => (
                <TableRow key={device.uid}>
                  <TableCell className="font-mono text-xs">{device.uid}</TableCell>
                  <TableCell>
                    {editingDevice?.uid === device.uid ? (
                      <Input
                        value={editingDevice.name || ''}
                        onChange={e => setEditingDevice({ ...editingDevice, name: e.target.value })}
                        className="h-8"
                      />
                    ) : (
                      device.name || <span className="text-muted-foreground">Not set</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {editingDevice?.uid === device.uid ? (
                      <Input
                        value={editingDevice.location || ''}
                        onChange={e => setEditingDevice({ ...editingDevice, location: e.target.value })}
                        className="h-8"
                      />
                    ) : (
                      device.location || <span className="text-muted-foreground">Not set</span>
                    )}
                  </TableCell>
                  <TableCell>
                     <Badge variant={device.status === 'online' ? 'default' : 'secondary'} className={device.status === 'online' ? 'bg-green-500' : ''}>
                        {device.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {device.owners.length > 0 ? (
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <div className="flex items-center gap-2">
                                        <User className="h-4 w-4"/>
                                        <span>{device.owners.length}</span>
                                    </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <ul className="text-sm">
                                        {device.owners.map(o => <li key={o.email}>{o.name} ({o.email})</li>)}
                                    </ul>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    ) : (
                        <span className="text-muted-foreground">None</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {editingDevice?.uid === device.uid ? (
                      <div className="flex gap-2">
                        <Button size="sm" onClick={handleSave}><Save className="h-4 w-4" /></Button>
                        <Button size="sm" variant="ghost" onClick={handleCancel}><X className="h-4 w-4" /></Button>
                      </div>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => handleEdit(device)}><Edit className="h-4 w-4" /></Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
