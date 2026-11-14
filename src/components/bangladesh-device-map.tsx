'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { apiFetch } from '@/lib/api';
import { formatToBDTime } from '@/lib/utils';
import { 
  MapPin, 
  Search, 
  Edit3, 
  Save, 
  Compass, 
  Layers,
  Loader2,
  Globe
} from 'lucide-react';
import 'leaflet/dist/leaflet.css';

export interface DeviceMapData {
  uid: string;
  name: string | null;
  location: string | null;
  institution?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  status: 'online' | 'offline' | 'unknown';
  lastSeen: string | null;
  data?: {
    temperature?: number | null;
    humidity?: number | null;
    water_level?: number | null;
    rainfall?: number | null;
  };
}

// Free Map Layer Services (Google Maps Free Tiles, OpenStreetMap, CartoDB, Esri)
export const MAP_LAYERS = [
  {
    id: 'google-hybrid',
    name: 'Google Satellite (Hybrid)',
    icon: '🛰️',
    url: 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
    subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
    maxZoom: 20,
    attribution: '&copy; Google Maps'
  },
  {
    id: 'google-streets',
    name: 'Google Roads / Streets',
    icon: '🗺️',
    url: 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
    subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
    maxZoom: 20,
    attribution: '&copy; Google Maps'
  },
  {
    id: 'google-terrain',
    name: 'Google Terrain',
    icon: '⛰️',
    url: 'https://mt1.google.com/vt/lyrs=p&x={x}&y={y}&z={z}',
    subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
    maxZoom: 20,
    attribution: '&copy; Google Maps'
  },
  {
    id: 'carto-voyager',
    name: 'Carto Voyager (Light)',
    icon: '🏙️',
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    subdomains: 'abcd',
    maxZoom: 19,
    attribution: '&copy; CARTO'
  },
  {
    id: 'osm-standard',
    name: 'OpenStreetMap',
    icon: '🌐',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    subdomains: 'abc',
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors'
  },
  {
    id: 'esri-satellite',
    name: 'Esri Satellite',
    icon: '🌍',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    subdomains: '',
    maxZoom: 19,
    attribution: '&copy; Esri World Imagery'
  }
];

interface BangladeshDeviceMapProps {
  devices: DeviceMapData[];
  isAdmin?: boolean;
  onDeviceUpdated?: (updatedDevice: DeviceMapData) => void;
  title?: string;
  description?: string;
}

export default function BangladeshDeviceMap({
  devices,
  isAdmin = false,
  onDeviceUpdated,
  title = "Device Geo Map (Bangladesh)",
  description = "Geographic distribution of monitoring stations with live telemetry"
}: BangladeshDeviceMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const tileLayerRef = useRef<any>(null);
  const markersRef = useRef<{ [uid: string]: any }>({});
  const { toast } = useToast();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'online' | 'offline'>('all');
  const [selectedLayerId, setSelectedLayerId] = useState<string>('google-hybrid');
  const [isEditMode, setIsEditMode] = useState(false);
  
  // Selected device for edit modal
  const [editingDevice, setEditingDevice] = useState<DeviceMapData | null>(null);
  const [editName, setEditName] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editInstitution, setEditInstitution] = useState('');
  const [editLat, setEditLat] = useState<number | ''>('');
  const [editLng, setEditLng] = useState<number | ''>('');
  const [isSaving, setIsSaving] = useState(false);

  // Filter devices with valid geo-coordinates
  const geoDevices = useMemo(() => {
    return devices.filter(d => {
      const hasGeo = typeof d.latitude === 'number' && !isNaN(d.latitude) &&
                     typeof d.longitude === 'number' && !isNaN(d.longitude) &&
                     d.latitude >= 20 && d.latitude <= 27 &&
                     d.longitude >= 87 && d.longitude <= 93;
      if (!hasGeo) return false;

      if (statusFilter === 'online') return d.status === 'online';
      if (statusFilter === 'offline') return d.status !== 'online';
      return true;
    });
  }, [devices, statusFilter]);

  const searchedDevices = useMemo(() => {
    if (!searchQuery.trim()) return geoDevices;
    const q = searchQuery.toLowerCase().trim();
    return geoDevices.filter(d => 
      (d.name && d.name.toLowerCase().includes(q)) ||
      (d.uid && d.uid.toLowerCase().includes(q)) ||
      (d.location && d.location.toLowerCase().includes(q)) ||
      (d.institution && d.institution.toLowerCase().includes(q))
    );
  }, [geoDevices, searchQuery]);

  // Counts
  const totalCount = devices.length;
  const mappedCount = geoDevices.length;
  const onlineCount = devices.filter(d => d.status === 'online').length;
  const offlineCount = totalCount - onlineCount;

  // Initialize Leaflet Map
  useEffect(() => {
    if (typeof window === 'undefined' || !mapContainerRef.current) return;
    let isMounted = true;

    async function initMap() {
      const L = (await import('leaflet')).default;

      if (!isMounted || !mapContainerRef.current) return;

      // Destroy old instance if exists
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }

      // Default center: Central Bangladesh
      const bangladeshCenter: [number, number] = [23.8103, 90.4125];
      
      const map = L.map(mapContainerRef.current, {
        center: bangladeshCenter,
        zoom: 7,
        minZoom: 6,
        maxZoom: 20,
        maxBounds: [
          [19.8, 87.0], // South-West
          [27.5, 93.5], // North-East
        ],
        maxBoundsViscosity: 0.8,
        scrollWheelZoom: true,
      });

      // Selected Tile Layer (Default: Google Satellite Hybrid)
      const targetLayer = MAP_LAYERS.find(l => l.id === selectedLayerId) || MAP_LAYERS[0];
      const tileLayer = L.tileLayer(targetLayer.url, {
        subdomains: targetLayer.subdomains,
        maxZoom: targetLayer.maxZoom,
        attribution: targetLayer.attribution,
      }).addTo(map);

      tileLayerRef.current = tileLayer;
      mapInstanceRef.current = map;
      renderMarkers(L, map);
    }

    initMap();

    return () => {
      isMounted = false;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Switch Tile Layer dynamically
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    import('leaflet').then(LModule => {
      const L = LModule.default;
      const targetLayer = MAP_LAYERS.find(l => l.id === selectedLayerId) || MAP_LAYERS[0];

      if (tileLayerRef.current) {
        mapInstanceRef.current.removeLayer(tileLayerRef.current);
      }

      tileLayerRef.current = L.tileLayer(targetLayer.url, {
        subdomains: targetLayer.subdomains,
        maxZoom: targetLayer.maxZoom,
        attribution: targetLayer.attribution,
      }).addTo(mapInstanceRef.current);
    });
  }, [selectedLayerId]);

  // Update Markers when devices, filter, or edit mode changes
  useEffect(() => {
    if (typeof window === 'undefined' || !mapInstanceRef.current) return;
    import('leaflet').then(LModule => {
      renderMarkers(LModule.default, mapInstanceRef.current);
    });
  }, [searchedDevices, isEditMode]);

  const renderMarkers = (L: any, map: any) => {
    // Clear old markers
    Object.values(markersRef.current).forEach((marker: any) => {
      marker.remove();
    });
    markersRef.current = {};

    if (!map || searchedDevices.length === 0) return;

    const bounds = L.latLngBounds([]);

    searchedDevices.forEach(device => {
      const lat = device.latitude!;
      const lng = device.longitude!;
      const isOnline = device.status === 'online';

      // Custom pulse HTML marker icon
      const iconHtml = `
        <div class="relative flex items-center justify-center cursor-pointer group">
          <span class="absolute inline-flex h-8 w-8 rounded-full ${isOnline ? 'bg-emerald-500/40 animate-ping' : 'bg-rose-500/25'}"></span>
          <div class="relative flex items-center justify-center w-7 h-7 rounded-full shadow-lg border-2 ${
            isOnline 
              ? 'bg-emerald-600 border-white text-white shadow-emerald-500/50' 
              : 'bg-rose-600 border-white text-white shadow-rose-500/50'
          } transition-transform transform group-hover:scale-125">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
              <circle cx="12" cy="10" r="3"/>
            </svg>
          </div>
          ${isEditMode ? '<div class="absolute -top-2 -right-2 bg-amber-500 text-white rounded-full p-0.5 shadow ring-2 ring-white"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M12 5v14M5 12h14"/></svg></div>' : ''}
        </div>
      `;

      const customIcon = L.divIcon({
        html: iconHtml,
        className: 'custom-map-pin',
        iconSize: [28, 28],
        iconAnchor: [14, 28],
        popupAnchor: [0, -28],
      });

      const marker = L.marker([lat, lng], {
        icon: customIcon,
        draggable: isEditMode && isAdmin,
        title: device.name || device.uid,
      }).addTo(map);

      // Popup Content
      const tempVal = device.data?.temperature !== null && device.data?.temperature !== undefined ? `${device.data.temperature.toFixed(1)}°C` : 'N/A';
      const humVal = device.data?.humidity !== null && device.data?.humidity !== undefined ? `${device.data.humidity.toFixed(1)}%` : 'N/A';
      const waterVal = device.data?.water_level !== null && device.data?.water_level !== undefined ? `${device.data.water_level.toFixed(2)} ft` : '0 ft';
      const rainVal = device.data?.rainfall !== null && device.data?.rainfall !== undefined ? `${device.data.rainfall.toFixed(2)} mm` : '0 mm';
      const lastSeenStr = device.lastSeen ? formatToBDTime(device.lastSeen) : 'Never';

      const popupHtml = `
        <div class="p-1 min-w-[270px] max-w-[330px] font-sans text-slate-900">
          <div class="flex items-start justify-between gap-2 border-b pb-2 mb-2">
            <div>
              <h4 class="font-bold text-base leading-tight text-slate-900">${device.name || 'Unnamed Station'}</h4>
              <p class="text-xs font-mono text-slate-500 mt-0.5">${device.uid}</p>
            </div>
            <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
              isOnline ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-rose-100 text-rose-800 border border-rose-300'
            }">
              <span class="w-1.5 h-1.5 rounded-full mr-1.5 ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}"></span>
              ${isOnline ? 'Online' : 'Offline'}
            </span>
          </div>

          ${device.location ? `<p class="text-xs text-slate-600 mb-1 flex items-center gap-1">📍 <span>${device.location}</span></p>` : ''}
          ${device.institution ? `<p class="text-[11px] text-slate-500 mb-2 italic">🏢 ${device.institution}</p>` : ''}
          
          <div class="grid grid-cols-2 gap-1.5 bg-slate-50 p-2 rounded-lg border border-slate-200 text-xs mb-2.5">
            <div class="flex items-center gap-1.5">
              <span class="text-amber-500 font-bold">🌡️ Temp:</span>
              <span class="font-semibold text-slate-800">${tempVal}</span>
            </div>
            <div class="flex items-center gap-1.5">
              <span class="text-purple-600 font-bold">💧 Hum:</span>
              <span class="font-semibold text-slate-800">${humVal}</span>
            </div>
            <div class="flex items-center gap-1.5">
              <span class="text-sky-600 font-bold">📏 Water:</span>
              <span class="font-semibold text-slate-800">${waterVal}</span>
            </div>
            <div class="flex items-center gap-1.5">
              <span class="text-emerald-600 font-bold">🌧️ Rain:</span>
              <span class="font-semibold text-slate-800">${rainVal}</span>
            </div>
          </div>

          <div class="flex items-center justify-between text-[11px] text-slate-400 mb-3">
            <span>Last seen:</span>
            <span class="font-medium text-slate-600">${lastSeenStr}</span>
          </div>

          <div class="flex items-center gap-2 pt-1 border-t">
            <a href="/dashboard/device/${encodeURIComponent(device.uid)}" class="flex-1 text-center py-1.5 px-3 bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs rounded transition-colors shadow-sm">
              Device History
            </a>
            ${isAdmin ? `
              <button id="btn-edit-${device.uid.replace(/[^a-zA-Z0-9]/g, '-')}" class="py-1.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-xs rounded border border-slate-300 transition-colors">
                Edit Geo
              </button>
            ` : ''}
          </div>
        </div>
      `;

      marker.bindPopup(popupHtml, { maxWidth: 350 });

      // Handle popup open to wire edit button click
      marker.on('popupopen', () => {
        if (isAdmin) {
          const btnId = `btn-edit-${device.uid.replace(/[^a-zA-Z0-9]/g, '-')}`;
          const btn = document.getElementById(btnId);
          if (btn) {
            btn.onclick = (e) => {
              e.preventDefault();
              openEditModal(device);
            };
          }
        }
      });

      // Handle drag end in edit mode
      if (isEditMode && isAdmin) {
        marker.on('dragend', async (event: any) => {
          const newPos = event.target.getLatLng();
          handleDragUpdate(device, newPos.lat, newPos.lng);
        });
      }

      markersRef.current[device.uid] = marker;
      bounds.extend([lat, lng]);
    });

    // Fit map bounds if devices exist
    if (searchedDevices.length > 0 && bounds.isValid()) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
    }
  };

  // Drag Update Handler
  const handleDragUpdate = async (device: DeviceMapData, newLat: number, newLng: number) => {
    const formattedLat = parseFloat(newLat.toFixed(6));
    const formattedLng = parseFloat(newLng.toFixed(6));

    const confirmed = window.confirm(`Move "${device.name || device.uid}" to new position?\nLatitude: ${formattedLat}\nLongitude: ${formattedLng}`);
    
    if (!confirmed) {
      if (markersRef.current[device.uid]) {
        markersRef.current[device.uid].setLatLng([device.latitude!, device.longitude!]);
      }
      return;
    }

    try {
      await apiFetch(`/api/admin/device/${encodeURIComponent(device.uid)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          latitude: formattedLat,
          longitude: formattedLng
        })
      });

      const updated = { ...device, latitude: formattedLat, longitude: formattedLng };
      toast({
        title: 'Location Updated',
        description: `Device ${device.uid} position updated successfully to [${formattedLat}, ${formattedLng}].`,
      });

      if (onDeviceUpdated) {
        onDeviceUpdated(updated);
      }
    } catch (e: any) {
      toast({
        title: 'Update Failed',
        description: e.message || 'Failed to update location',
        variant: 'destructive',
      });
      if (markersRef.current[device.uid]) {
        markersRef.current[device.uid].setLatLng([device.latitude!, device.longitude!]);
      }
    }
  };

  // Open Edit Modal
  const openEditModal = (device: DeviceMapData) => {
    setEditingDevice(device);
    setEditName(device.name || '');
    setEditLocation(device.location || '');
    setEditInstitution(device.institution || '');
    setEditLat(typeof device.latitude === 'number' ? device.latitude : '');
    setEditLng(typeof device.longitude === 'number' ? device.longitude : '');
  };

  // Save Modal Edits
  const handleSaveModal = async () => {
    if (!editingDevice) return;
    setIsSaving(true);

    try {
      const latVal = editLat === '' ? null : parseFloat(String(editLat));
      const lngVal = editLng === '' ? null : parseFloat(String(editLng));

      await apiFetch(`/api/admin/device/${encodeURIComponent(editingDevice.uid)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName,
          location: editLocation,
          institution: editInstitution,
          latitude: latVal,
          longitude: lngVal
        })
      });

      const updated = {
        ...editingDevice,
        name: editName,
        location: editLocation,
        institution: editInstitution,
        latitude: latVal,
        longitude: lngVal
      };

      toast({
        title: 'Device Updated',
        description: `Settings and Geo-location for ${editingDevice.name || editingDevice.uid} saved successfully.`,
      });

      if (onDeviceUpdated) {
        onDeviceUpdated(updated);
      }
      setEditingDevice(null);
    } catch (e: any) {
      toast({
        title: 'Save Failed',
        description: e.message || 'An error occurred while saving',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Fly to device on search or click
  const flyToDevice = (device: DeviceMapData) => {
    if (!mapInstanceRef.current || !device.latitude || !device.longitude) return;
    mapInstanceRef.current.flyTo([device.latitude, device.longitude], 13, { duration: 1.5 });
    if (markersRef.current[device.uid]) {
      markersRef.current[device.uid].openPopup();
    }
  };

  // Reset View to fit Bangladesh
  const fitBangladesh = () => {
    if (!mapInstanceRef.current) return;
    mapInstanceRef.current.setView([23.8103, 90.4125], 7);
  };

  return (
    <Card className="w-full shadow-md border overflow-hidden">
      <CardHeader className="bg-card pb-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-primary" />
              <CardTitle className="text-xl font-bold">{title}</CardTitle>
            </div>
            <CardDescription className="text-sm mt-1">{description}</CardDescription>
          </div>

          {/* Quick Stats Badges */}
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="px-3 py-1 bg-muted/50 text-xs">
              <Layers className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
              {mappedCount} on map ({totalCount} total)
            </Badge>
            <Badge variant="outline" className="px-3 py-1 bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-500 mr-1.5 animate-pulse"></span>
              {onlineCount} Online
            </Badge>
            <Badge variant="outline" className="px-3 py-1 bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/30 dark:text-rose-400">
              <span className="w-2 h-2 rounded-full bg-rose-500 mr-1.5"></span>
              {offlineCount} Offline
            </Badge>
          </div>
        </div>

        {/* Toolbar & Filters */}
        <div className="mt-4 pt-4 border-t flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search station by name, UID, upazila, institution..."
              className="pl-9 h-9 text-sm"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Map Layer Selector & Controls */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Map Service Selector (Google Maps / Free Services) */}
            <div className="flex items-center gap-1.5">
              <Select value={selectedLayerId} onValueChange={setSelectedLayerId}>
                <SelectTrigger className="w-[200px] h-9 text-xs bg-background font-medium">
                  <Globe className="h-3.5 w-3.5 mr-1.5 text-primary" />
                  <SelectValue placeholder="Map Service" />
                </SelectTrigger>
                <SelectContent>
                  {MAP_LAYERS.map(layer => (
                    <SelectItem key={layer.id} value={layer.id} className="text-xs cursor-pointer">
                      <span className="mr-2">{layer.icon}</span>
                      <span>{layer.name}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Filter buttons */}
            <div className="inline-flex rounded-md shadow-sm border p-0.5 bg-muted/40">
              <button 
                onClick={() => setStatusFilter('all')} 
                className={`px-3 py-1 text-xs font-medium rounded transition-all ${statusFilter === 'all' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              >
                All
              </button>
              <button 
                onClick={() => setStatusFilter('online')} 
                className={`px-3 py-1 text-xs font-medium rounded transition-all ${statusFilter === 'online' ? 'bg-background shadow-sm text-emerald-600 font-semibold' : 'text-muted-foreground hover:text-foreground'}`}
              >
                Online
              </button>
              <button 
                onClick={() => setStatusFilter('offline')} 
                className={`px-3 py-1 text-xs font-medium rounded transition-all ${statusFilter === 'offline' ? 'bg-background shadow-sm text-rose-600 font-semibold' : 'text-muted-foreground hover:text-foreground'}`}
              >
                Offline
              </button>
            </div>

            <Button variant="outline" size="sm" onClick={fitBangladesh} className="h-9 text-xs">
              <Compass className="h-3.5 w-3.5 mr-1.5" />
              Reset View
            </Button>

            {/* Editable Mode toggle (Admin only) */}
            {isAdmin && (
              <div className="flex items-center space-x-2 pl-2 border-l border-border">
                <Switch 
                  id="map-edit-mode" 
                  checked={isEditMode} 
                  onCheckedChange={(checked) => {
                    setIsEditMode(checked);
                    toast({
                      title: checked ? 'Edit Mode Activated' : 'Edit Mode Deactivated',
                      description: checked ? 'You can now drag and drop markers on the map to update device coordinates.' : 'Marker positions are locked.',
                    });
                  }} 
                />
                <Label htmlFor="map-edit-mode" className="text-xs font-semibold cursor-pointer flex items-center gap-1">
                  <Edit3 className="h-3.5 w-3.5 text-amber-500" />
                  <span>Editable</span>
                </Label>
              </div>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0 relative">
        {/* Map Container */}
        <div 
          ref={mapContainerRef} 
          className="w-full h-[520px] md:h-[620px] bg-slate-100 dark:bg-slate-900 z-10"
        />

        {/* Edit mode active banner */}
        {isEditMode && isAdmin && (
          <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-20 bg-amber-500/90 text-white backdrop-blur-sm px-4 py-1.5 rounded-full shadow-lg text-xs font-medium flex items-center gap-2 animate-bounce">
            <Edit3 className="h-3.5 w-3.5" />
            <span>Edit Mode Active: Drag any marker to relocate, or click marker to edit details</span>
          </div>
        )}

        {/* Quick Station Drawer / List on bottom left */}
        {searchedDevices.length > 0 && searchQuery.trim() && (
          <div className="absolute bottom-4 left-4 z-20 max-w-sm w-full max-h-56 overflow-y-auto bg-background/95 backdrop-blur border rounded-lg shadow-xl p-2 space-y-1">
            <p className="text-[11px] font-semibold text-muted-foreground px-2 py-1 uppercase">Search Matches ({searchedDevices.length})</p>
            {searchedDevices.slice(0, 5).map(d => (
              <button
                key={d.uid}
                onClick={() => flyToDevice(d)}
                className="w-full text-left p-2 rounded hover:bg-muted text-xs flex items-center justify-between transition-colors"
              >
                <div>
                  <p className="font-semibold text-foreground truncate">{d.name || d.uid}</p>
                  <p className="text-muted-foreground text-[10px] truncate">{d.location || d.uid}</p>
                </div>
                <Badge variant={d.status === 'online' ? 'default' : 'secondary'} className="text-[10px] ml-2">
                  {d.status}
                </Badge>
              </button>
            ))}
          </div>
        )}
      </CardContent>

      {/* Edit Device Geo-Location Modal */}
      {isAdmin && (
        <Dialog open={!!editingDevice} onOpenChange={(open) => !open && setEditingDevice(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-primary" />
                <span>Edit Station Location & Details</span>
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="p-2.5 bg-muted/50 rounded-lg text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">UID:</span>
                  <span className="font-mono font-bold">{editingDevice?.uid}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Current Status:</span>
                  <Badge variant={editingDevice?.status === 'online' ? 'default' : 'secondary'} className="text-[10px]">
                    {editingDevice?.status}
                  </Badge>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-device-name">Station / Upazila Name</Label>
                <Input 
                  id="edit-device-name" 
                  value={editName} 
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="e.g. Godagari Office Zone" 
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-device-loc">Address / Specific Location</Label>
                <Input 
                  id="edit-device-loc" 
                  value={editLocation} 
                  onChange={(e) => setEditLocation(e.target.value)}
                  placeholder="e.g. Union.Godagari, Mouza.Amtuly" 
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-device-inst">Institution / Department</Label>
                <Input 
                  id="edit-device-inst" 
                  value={editInstitution} 
                  onChange={(e) => setEditInstitution(e.target.value)}
                  placeholder="e.g. Barind Multipurpose Development Authority(BMDA)" 
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="edit-device-lat">Latitude (N)</Label>
                  <Input 
                    id="edit-device-lat" 
                    type="number" 
                    step="any"
                    value={editLat} 
                    onChange={(e) => setEditLat(e.target.value === '' ? '' : parseFloat(e.target.value))}
                    placeholder="e.g. 24.4859" 
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit-device-lng">Longitude (E)</Label>
                  <Input 
                    id="edit-device-lng" 
                    type="number" 
                    step="any"
                    value={editLng} 
                    onChange={(e) => setEditLng(e.target.value === '' ? '' : parseFloat(e.target.value))}
                    placeholder="e.g. 88.3425" 
                  />
                </div>
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => setEditingDevice(null)} disabled={isSaving}>
                Cancel
              </Button>
              <Button onClick={handleSaveModal} disabled={isSaving}>
                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </Card>
  );
}
