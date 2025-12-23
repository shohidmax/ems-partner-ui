
'use client';
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { TriangleAlert, Shield, User } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/hooks/use-user';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { formatToBDTime } from '@/lib/utils';

const API_BASE_URL = 'https://emspartner.espserver.site//api';

interface UserData {
  _id: string;
  name: string;
  email: string;
  isAdmin: boolean;
  createdAt: string;
}

export default function AdminUserManagerPage() {
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const { user: currentUser, token } = useUser();

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      if (!token) throw new Error('No auth token found.');

      const response = await fetch(`${API_BASE_URL}/admin/users`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) {
        if (response.status === 403) throw new Error('Admin access required to view this page.');
        
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.indexOf("application/json") !== -1) {
            const errorData = await response.json();
            throw new Error(errorData.message || `Failed to fetch users: ${response.statusText}`);
        } else {
            const errorText = await response.text();
            throw new Error(`Server returned a non-JSON response. Status: ${response.status} - ${errorText}`);
        }
      }
      
      const data = await response.json();
      setUsers(data.sort((a: UserData, b: UserData) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    } catch (e: any) {
      setError(e.message);
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if(token) {
        fetchUsers();
    }
  }, [token]);

  const handleRoleChange = async (targetUser: UserData, newIsAdmin: boolean) => {
    if (!token) return;
    
    const originalUsers = [...users];
    // Optimistically update UI
    setUsers(users.map(u => u._id === targetUser._id ? { ...u, isAdmin: newIsAdmin } : u));
    
    const endpoint = newIsAdmin ? 'make-admin' : 'remove-admin';

    try {
      const response = await fetch(`${API_BASE_URL}/admin/user/${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ email: targetUser.email })
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || 'Failed to update role.');
      }
      toast({ title: 'Success', description: `${targetUser.name}'s role has been updated.` });
      // Re-fetch to be sure of the state
      await fetchUsers();
      
    } catch (e: any) {
      // Revert UI on failure
      setUsers(originalUsers);
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
        <h1 className="text-3xl font-bold">User Management</h1>
        <p className="text-muted-foreground">View all users and manage their roles.</p>
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Joined On</TableHead>
                <TableHead className="text-right">Make Admin</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map(user => (
                <TableRow key={user._id}>
                  <TableCell className="font-medium">{user.name}</TableCell>
                  <TableCell>{user.email}</TableCell>
                   <TableCell>
                     <Badge variant={user.isAdmin ? 'default' : 'secondary'}>
                        {user.isAdmin ? <Shield className="mr-2 h-3 w-3" /> : <User className="mr-2 h-3 w-3" />}
                        {user.isAdmin ? 'Admin' : 'User'}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatToBDTime(user.createdAt)}</TableCell>
                  <TableCell className="text-right">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className='inline-block'>
                            <Switch
                              checked={user.isAdmin}
                              onCheckedChange={(checked) => handleRoleChange(user, checked)}
                              disabled={currentUser?.email === user.email}
                              aria-label={`Toggle admin status for ${user.name}`}
                            />
                          </div>
                        </TooltipTrigger>
                        {currentUser?.email === user.email && (
                          <TooltipContent>
                            <p>You cannot change your own role.</p>
                          </TooltipContent>
                        )}
                      </Tooltip>
                    </TooltipProvider>
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
