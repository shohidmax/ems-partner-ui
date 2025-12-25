
'use client';

import Link from 'next/link';
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarTrigger,
  SidebarInset,
  SidebarGroup,
} from '@/components/ui/sidebar';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Home, User, Settings, LogOut, PanelLeft, Loader2, Sun, Moon, List, Shield, Users, BarChart3, HardDrive, Download } from 'lucide-react';
import { useUser } from '@/hooks/use-user';
import { usePathname, useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { Logo } from '@/components/logo';

function ThemeToggle() {
    const { theme, setTheme } = useTheme();

    return (
        <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
        >
            <Sun className="h-6 w-6 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-6 w-6 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            <span className="sr-only">Toggle theme</span>
        </Button>
    )
}


export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading, isAdmin, logout } = useUser();
  const router = useRouter();
  const pathname = usePathname();

  const handleLogout = () => {
    logout();
  };

  if (isLoading || !user) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const displayName = user.name || user.email || 'User';
  const displayEmail = user.email || '';
  const avatarFallback = displayName.substring(0, 2).toUpperCase();

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <Sidebar>
          <SidebarHeader>
            <div className="flex items-center justify-between">
                <Logo />
            </div>
          </SidebarHeader>
          <SidebarContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip="Overview" isActive={pathname === '/dashboard' || pathname === '/dashboard/admin'}>
                  <Link href={isAdmin ? "/dashboard/admin" : "/dashboard"}>
                    <Home />
                    <span>Overview</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              
              {!isAdmin && (
                <>
                    <SidebarMenuItem>
                        <SidebarMenuButton asChild tooltip="My Devices" isActive={pathname.startsWith('/dashboard/devices') || pathname.startsWith('/dashboard/device/')}>
                        <Link href={"/dashboard/devices"}>
                            <List />
                            <span>My Devices</span>
                        </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                        <SidebarMenuButton asChild tooltip="Profile" isActive={pathname === '/dashboard/profile'}>
                        <Link href="/dashboard/profile">
                            <User />
                            <span>Profile</span>
                        </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </>
              )}
              
               <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip="Settings" isActive={pathname === '/dashboard/settings'}>
                  <Link href="/dashboard/settings">
                    <Settings />
                    <span>Settings</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              {isAdmin && (
                <SidebarGroup>
                    <SidebarGroupLabel>Admin Panel</SidebarGroupLabel>
                    <SidebarMenuItem>
                        <SidebarMenuButton asChild tooltip="Device List" isActive={pathname.startsWith('/dashboard/admin/devices')}>
                        <Link href="/dashboard/admin/devices">
                            <HardDrive />
                            <span>All Devices</span>
                        </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                        <SidebarMenuButton asChild tooltip="User Management" isActive={pathname.startsWith('/dashboard/admin/users')}>
                        <Link href="/dashboard/admin/users">
                            <Users />
                            <span>Manage Users</span>
                        </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                     <SidebarMenuItem>
                        <SidebarMenuButton asChild tooltip="Data Reports" isActive={pathname.startsWith('/dashboard/admin/reports')}>
                        <Link href="/dashboard/admin/reports">
                            <BarChart3 />
                            <span>Data Reports</span>
                        </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                     <SidebarMenuItem>
                        <SidebarMenuButton asChild tooltip="Backup" isActive={pathname.startsWith('/dashboard/admin/backup')}>
                        <Link href="/dashboard/admin/backup">
                            <Download />
                            <span>Backup</span>
                        </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarGroup>
              )}
            </SidebarMenu>
          </SidebarContent>
        </Sidebar>
        <SidebarInset>
          <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background/80 backdrop-blur-sm px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6">
            <SidebarTrigger className="md:hidden">
              <PanelLeft />
              <span className="sr-only">Toggle Menu</span>
            </SidebarTrigger>
            <div className="flex-1">
              {/* Optional: Add Breadcrumbs or Page Title here */}
            </div>
            <ThemeToggle />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="overflow-hidden rounded-full">
                  <Avatar>
                    <AvatarImage src={user.photoURL || undefined} alt={displayName} />
                    <AvatarFallback>{avatarFallback}</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">{displayName}</p>
                    <p className="text-xs leading-none text-muted-foreground">{displayEmail}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {!isAdmin && (
                  <DropdownMenuItem asChild>
                    <Link href="/dashboard/profile"><User className="mr-2 h-4 w-4" />Profile</Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem asChild>
                  <Link href="/dashboard/settings"><Settings className="mr-2 h-4 w-4" />Settings</Link>
                </DropdownMenuItem>
                {isAdmin && (
                    <DropdownMenuItem asChild>
                        <Link href="/dashboard/admin"><Shield className="mr-2 h-4 w-4" />Admin Dashboard</Link>
                    </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout}>
                   <LogOut className="mr-2 h-4 w-4" />Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </header>
          <main className="flex-1 p-4 md:p-6 container mx-auto">
            {children}
          </main>
        </SidebarInset>
      </div>