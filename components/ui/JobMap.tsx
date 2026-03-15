'use client';

/**
 * JobMap — renders open jobs as red pins on an OpenStreetMap tile layer.
 * - Dynamically imports Leaflet (SSR-safe, client-only)
 * - Leaflet CSS loaded via next/head to avoid raw <link> in JSX
 * - Re-renders the pin layer when the jobs array changes without destroying the map
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
  lat: number | null;
  lng: number | null;
}

interface JobMapProps {
  jobs: GeocodedJob[];
  height?: number;
}

const AU_CENTRE: [number, number] = [-33.86, 151.21]; // Sydney default
const DEFAULT_ZOOM = 9;

function formatAUD(n: number): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    maximumFractionDigits: 0,
  }).format(n);
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

    // Leaflet CSS — inject once
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

      // Fix default icon paths broken by webpack
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });

      const map = L.map(containerRef.current!).setView(AU_CENTRE, DEFAULT_ZOOM);
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

  // Re-render pins whenever jobs change
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

        const total = job.authorisedTotal ? formatAUD(job.authorisedTotal) : '—';
        const popup = `
          <div style="min-width:210px;font-family:system-ui,sans-serif;font-size:12px;">
            <div style="font-weight:700;font-size:14px;color:#dc2626;margin-bottom:4px;">${job.jobNumber}</div>
            <div style="color:#666;margin-bottom:8px;line-height:1.4;">${job.address}</div>
            <table style="width:100%;border-collapse:collapse;">
              <tr><td style="color:#888;padding:2px 6px 2px 0;white-space:nowrap;">Status</td><td style="font-weight:600;">${job.status}</td></tr>
              <tr><td style="color:#888;padding:2px 6px 2px 0;">Type</td><td>${job.jobType}</td></tr>
              <tr><td style="color:#888;padding:2px 6px 2px 0;">Region</td><td>${job.region}</td></tr>
              <tr><td style="color:#888;padding:2px 6px 2px 0;">Auth Total</td><td style="font-weight:600;">${total}</td></tr>
            </table>
            ${job.primeUrl
              ? `<a href="${job.primeUrl}" target="_blank" rel="noopener noreferrer"
                   style="display:inline-block;margin-top:10px;font-size:11px;color:#dc2626;text-decoration:underline;font-weight:600;">
                   Open in Prime →
                 </a>`
              : ''}
          </div>
        `;

        L.marker([lat, lng], { icon: redIcon })
          .bindPopup(popup, { maxWidth: 300 })
          .addTo(layerRef.current!);
      }

      // Fit bounds on first paint only (when we have ≥2 pins)
      if (bounds.length >= 2) {
        try {
          mapRef.current?.fitBounds(bounds, { padding: [40, 40], maxZoom: 13, animate: false });
        } catch {
          // fitBounds can throw if map is not ready yet
        }
      } else if (bounds.length === 1) {
        mapRef.current?.setView(bounds[0], 13, { animate: false });
      }
    });
  }, [jobs]);

  return (
    <div
      ref={containerRef}
      style={{ height, width: '100%' }}
      className="rounded-xl"
    />
  );
}
