
'use client';
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert';
import { TriangleAlert, HardDrive, List, Users, Cloud, BarChart, Download, User } from 'lucide-react';
import Link from 'next/link';
import { useUser } from '@/hooks/use-user';

const API_URL = 'https://emspartner.espserver.site';

interface AdminStats {
  totalDevices: number;
  onlineDevices: number;
  offlineDevices: number;
  totalDataPoints: number;
  dataToday: number;
  totalUsers: number;
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { token } = useUser();

  useEffect(() => {
    const fetchStats = async () => {
      if (!token) {
        setLoading(false);
        setError("Authentication token not available.");
        return;
      }
      try {
        const response = await fetch(`${API_URL}/api/admin/stats`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) {
           if (response.status === 403) throw new Error('Admin access required.');
           const errorData = await response.json();
           throw new Error(errorData.message || `Failed to fetch stats. Status: ${response.status}`);
        }
        const data = await response.json();
        setStats(data);
      } catch (e: any) {
        setError(e.message || 'An unexpected error occurred.');
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, [token]);

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
      <h1 className="text-3xl font-bold">Admin Dashboard</h1>
      
      {error && (
        <Alert variant="destructive">
          <TriangleAlert className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {loading ? renderSkeletons() : stats ? (
          <>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Devices</CardTitle>
                <HardDrive className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalDevices || 0}</div>
                <p className="text-xs text-muted-foreground">{stats.onlineDevices || 0} Online</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Users</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalUsers || 0}</div>
                 <Link href="/dashboard/admin/users" className="text-xs text-primary hover:underline">Manage Users</Link>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">System Status</CardTitle>
                <Cloud className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-500">Online</div>
                <p className="text-xs text-muted-foreground">All systems operational</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Data Backups</CardTitle>
                <Download className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">Manage</div>
                 <Link href="/dashboard/admin/backup" className="text-xs text-primary hover:underline">Go to Backups</Link>
              </CardContent>
            </Card>
          </>
        ) : !error ? <p>No stats available.</p> : null}
      </div>

       <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
                <CardHeader>
                    <CardTitle>Admin Tools</CardTitle>
                    <CardDescription>Manage devices, users, and system settings.</CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                    <Link href="/dashboard/admin/devices" className="flex flex-col items-center justify-center p-4 bg-muted/50 rounded-lg hover:bg-muted transition-colors">
                        <List className="h-8 w-8 text-primary" />
                        <p className="mt-2 text-sm font-semibold">Manage Devices</p>
                    </Link>
                     <Link href="/dashboard/admin/users" className="flex flex-col items-center justify-center p-4 bg-muted/50 rounded-lg hover:bg-muted transition-colors">
                        <User className="h-8 w-8 text-primary" />
                        <p className="mt-2 text-sm font-semibold">Manage Users</p>
                    </Link>
                    <Link href="/dashboard/admin/reports" className="flex flex-col items-center justify-center p-4 bg-muted/50 rounded-lg hover:bg-muted transition-colors">
                        <BarChart className="h-8 w-8 text-primary" />
                        <p className="mt-2 text-sm font-semibold">Data Reports</p>
                    </Link>
                </CardContent>
            </Card>
             <Card>
                <CardHeader>
                    <CardTitle>System Status</CardTitle>
                    <CardDescription>Health and operational status of the system.</CardDescription>
                </CardHeader>
                <CardContent>
                   <div className="space-y-4">
                        <div className="flex items-center">
                            <div className="h-2.5 w-2.5 rounded-full mr-3 bg-green-500"></div>
                            <p className="text-sm font-medium">API Server</p>
                            <div className="ml-auto font-medium text-sm text-green-500">Online</div>
                        </div>
                        <div className="flex items-center">
                            <div className="h-2.5 w-2.5 rounded-full mr-3 bg-green-500"></div>
                            <p className="text-sm font-medium">Database Connection</p>
                            <div className="ml-auto font-medium text-sm text-green-500">Connected</div>
                        </div>
                         <div className="flex items-center">
                            <div className="h-2.5 w-2.5 rounded-full mr-3 bg-green-500"></div>
                            <p className="text-sm font-medium">Data Ingestion</p>
                            <div className="ml-auto font-medium text-sm text-muted-foreground">Active</div>
                        </div>
                   </div>
                </CardContent>
            </Card>
        </div>
