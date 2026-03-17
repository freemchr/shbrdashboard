'use client';

import { useEffect, useRef, useState } from 'react';
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

function formatAUD(n: number): string {
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 }).format(n);
}

function formatDate(s?: string): string {
  if (!s) return '—';
  return new Date(s).toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function JobMap({ jobs }: { jobs: GeocodedJob[] }) {
  const containerRef  = useRef<HTMLDivElement>(null);
  const mapRef        = useRef<LeafletMap | null>(null);
  const layerRef      = useRef<LayerGroup | null>(null);
  const initRef       = useRef(false);
  const [mapReady, setMapReady] = useState(false); // triggers pin effect once map is live

  // ── Init map once ──────────────────────────────────────────────
  useEffect(() => {
    if (initRef.current || !containerRef.current) return;
    initRef.current = true;

    // Leaflet CSS
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link');
      link.id        = 'leaflet-css';
      link.rel       = 'stylesheet';
      link.href      = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      link.integrity = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';
      link.crossOrigin = '';
      document.head.appendChild(link);
    }

    import('leaflet').then((L) => {
      if (!containerRef.current || mapRef.current) return;

      const map = L.map(containerRef.current, { preferCanvas: true })
        .setView([-25.5, 134.0], 5); // default: whole of Australia
      mapRef.current = map;

      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, © <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 19,
      }).addTo(map);

      layerRef.current = L.layerGroup().addTo(map);
      setMapReady(true); // signal that pins can now be drawn
    });

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        layerRef.current = null;
        initRef.current = false;
        setMapReady(false);
      }
    };
  }, []);

  // ── Draw pins — runs when map becomes ready OR jobs change ─────
  useEffect(() => {
    if (!mapReady || !mapRef.current || !layerRef.current) return;

    import('leaflet').then((L) => {
      if (!layerRef.current) return;
      layerRef.current.clearLayers();

      const plotted = jobs.filter(j => j.lat !== null && j.lng !== null);
      if (plotted.length === 0) return;

      const redIcon = L.divIcon({
        className: '',
        html: `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="40" viewBox="0 0 28 40">
          <path d="M14 0C6.268 0 0 6.268 0 14c0 9.333 14 26 14 26S28 23.333 28 14C28 6.268 21.732 0 14 0z"
                fill="#DC2626" stroke="#fff" stroke-width="1.5"/>
          <circle cx="14" cy="14" r="5" fill="#fff"/>
        </svg>`,
        iconSize:     [28, 40],
        iconAnchor:   [14, 40],
        popupAnchor:  [0, -42],
      });

      const bounds: [number, number][] = [];

      for (const job of plotted) {
        const lat = job.lat as number;
        const lng = job.lng as number;
        bounds.push([lat, lng]);

        const total   = job.authorisedTotal > 0 ? formatAUD(job.authorisedTotal) : '—';
        const updated = job.updatedAt
          ? `${formatDate(job.updatedAt)}${job.updatedBy ? ' · ' + job.updatedBy : ''}`
          : '—';

        const popup = `
          <div style="min-width:220px;font-family:system-ui,sans-serif;font-size:12px;line-height:1.5;background:#fff;color:#111;border-radius:6px;padding:2px;">
            <div style="font-weight:700;font-size:14px;color:#dc2626;margin-bottom:2px;">${job.jobNumber}</div>
            <div style="color:#555;margin-bottom:8px;font-size:11px;">${job.address}</div>
            <table style="width:100%;border-collapse:collapse;font-size:11px;">
              <tr><td style="color:#888;padding:2px 8px 2px 0;white-space:nowrap;">Status</td><td style="font-weight:600;color:#111;">${job.status}</td></tr>
              <tr><td style="color:#888;padding:2px 8px 2px 0;">Type</td><td style="color:#333;">${job.jobType}</td></tr>
              <tr><td style="color:#888;padding:2px 8px 2px 0;">Region</td><td style="color:#333;">${job.region}</td></tr>
              <tr><td style="color:#888;padding:2px 8px 2px 0;">Auth Total</td><td style="font-weight:600;color:#111;">${total}</td></tr>
              <tr><td style="color:#888;padding:2px 8px 2px 0;">Updated</td><td style="color:#666;font-size:10px;">${updated}</td></tr>
            </table>
            ${job.primeUrl ? `
              <a href="${job.primeUrl}" target="_blank" rel="noopener noreferrer"
                 style="display:inline-flex;align-items:center;gap:4px;margin-top:10px;font-size:11px;
                        color:#dc2626;text-decoration:none;font-weight:600;
                        border:1px solid #dc2626;padding:3px 10px;border-radius:4px;">
                Open in Prime ↗
              </a>` : ''}
          </div>`;

        L.marker([lat, lng], { icon: redIcon })
          .bindPopup(popup, { maxWidth: 300, minWidth: 220 })
          .addTo(layerRef.current!);
      }

      if (bounds.length >= 2) {
        try { mapRef.current?.fitBounds(bounds, { padding: [50, 50], maxZoom: 14, animate: false }); }
        catch { /* map not ready */ }
      } else if (bounds.length === 1) {
        mapRef.current?.setView(bounds[0], 14, { animate: false });
      }
    });
  }, [mapReady, jobs]); // <-- both dependencies: fires when map ready OR jobs arrive

  return <div ref={containerRef} style={{ height: '100%', width: '100%' }} />;
}
