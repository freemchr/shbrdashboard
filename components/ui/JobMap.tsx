'use client';

/**
 * JobMap — renders open jobs as red pins on OpenStreetMap.
 * - SSR-safe: Leaflet loaded dynamically
 * - CSS injected once into document.head
 * - Pin layer re-renders when jobs prop changes (map itself persists)
 */

import { useEffect, useRef } from 'react';
import type { Map as LeafletMap, LayerGroup } from 'leaflet';

export interface GeocodedJob {
  id: string;
  jobNumber: string;
  address: string;
  status: string;
  jobType: string;
  region: string;
  primeUrl: string;
  authorisedTotal: number;
  updatedAt?: string;
  updatedBy?: string;
  lat: number | null;
  lng: number | null;
}

interface JobMapProps {
  jobs: GeocodedJob[];
  height?: number; // deprecated — use CSS height on parent container
}

function formatAUD(n: number): string {
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 }).format(n);
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function JobMap({ jobs, height = 580 }: JobMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const layerRef = useRef<LayerGroup | null>(null);
  const initializedRef = useRef(false);

  // Init map once
  useEffect(() => {
    if (initializedRef.current || !containerRef.current) return;
    initializedRef.current = true;

    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      link.integrity = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';
      link.crossOrigin = '';
      document.head.appendChild(link);
    }

    import('leaflet').then((L) => {
      if (!containerRef.current || mapRef.current) return;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });

      const map = L.map(containerRef.current!, { preferCanvas: true })
        .setView([-33.86, 151.21], 9);
      mapRef.current = map;

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map);

      layerRef.current = L.layerGroup().addTo(map);
    });

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        layerRef.current = null;
        initializedRef.current = false;
      }
    };
  }, []);

  // Re-render pins whenever jobs changes
  useEffect(() => {
    if (!mapRef.current || !layerRef.current) return;

    import('leaflet').then((L) => {
      if (!layerRef.current) return;
      layerRef.current.clearLayers();

      const plotted = jobs.filter(j => j.lat !== null && j.lng !== null);
      if (plotted.length === 0) return;

      const redIcon = new L.Icon({
        iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41],
      });

      const bounds: [number, number][] = [];

      for (const job of plotted) {
        const lat = job.lat as number;
        const lng = job.lng as number;
        bounds.push([lat, lng]);

        const total = job.authorisedTotal > 0 ? formatAUD(job.authorisedTotal) : '—';
        const updated = job.updatedAt ? `${formatDate(job.updatedAt)}${job.updatedBy ? ' · ' + job.updatedBy : ''}` : '—';

        const popup = `
          <div style="min-width:220px;font-family:system-ui,sans-serif;font-size:12px;line-height:1.5;">
            <div style="font-weight:700;font-size:14px;color:#dc2626;margin-bottom:2px;">${job.jobNumber}</div>
            <div style="color:#555;margin-bottom:8px;font-size:11px;">${job.address}</div>
            <table style="width:100%;border-collapse:collapse;font-size:11px;">
              <tr><td style="color:#888;padding:2px 8px 2px 0;white-space:nowrap;vertical-align:top;">Status</td><td style="font-weight:600;color:#222;">${job.status}</td></tr>
              <tr><td style="color:#888;padding:2px 8px 2px 0;vertical-align:top;">Type</td><td style="color:#444;">${job.jobType}</td></tr>
              <tr><td style="color:#888;padding:2px 8px 2px 0;vertical-align:top;">Region</td><td style="color:#444;">${job.region}</td></tr>
              <tr><td style="color:#888;padding:2px 8px 2px 0;vertical-align:top;">Auth Total</td><td style="font-weight:600;color:#222;">${total}</td></tr>
              <tr><td style="color:#888;padding:2px 8px 2px 0;vertical-align:top;">Updated</td><td style="color:#666;font-size:10px;">${updated}</td></tr>
            </table>
            ${job.primeUrl
              ? `<a href="${job.primeUrl}" target="_blank" rel="noopener noreferrer"
                   style="display:inline-flex;align-items:center;gap:4px;margin-top:10px;font-size:11px;color:#dc2626;text-decoration:none;font-weight:600;border:1px solid #dc2626;padding:3px 10px;border-radius:4px;">
                   Open in Prime ↗
                 </a>`
              : ''}
          </div>
        `;

        L.marker([lat, lng], { icon: redIcon })
          .bindPopup(popup, { maxWidth: 300, minWidth: 220 })
          .addTo(layerRef.current!);
      }

      if (bounds.length >= 2) {
        try {
          mapRef.current?.fitBounds(bounds, { padding: [50, 50], maxZoom: 14, animate: false });
        } catch { /* map not ready */ }
      } else if (bounds.length === 1) {
        mapRef.current?.setView(bounds[0], 14, { animate: false });
      }
    });
  }, [jobs]);

  return (
    <div ref={containerRef} style={{ height: height ?? '100%', width: '100%' }} />
  );
}
