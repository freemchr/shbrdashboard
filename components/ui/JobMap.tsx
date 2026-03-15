'use client';

import { useEffect, useRef } from 'react';

interface GeocodedJob {
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

export function JobMap({ jobs, height = 600 }: JobMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<ReturnType<typeof import('leaflet')['map']> | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    // Dynamically import leaflet (SSR-safe)
    import('leaflet').then((L) => {
      // Fix default marker icons (webpack/Next.js issue)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });

      // Centre on Australia
      const map = L.map(containerRef.current!).setView([-33.8, 151.0], 9);
      mapRef.current = map;

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map);

      const plotted = jobs.filter(j => j.lat !== null && j.lng !== null);

      // Custom red marker icon to match SHBR brand
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

        const totalStr = job.authorisedTotal
          ? new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 }).format(job.authorisedTotal)
          : '—';

        const popup = `
          <div style="min-width:200px; font-family: sans-serif;">
            <div style="font-weight:700; font-size:13px; margin-bottom:4px; color:#dc2626;">
              ${job.jobNumber}
            </div>
            <div style="font-size:11px; color:#555; margin-bottom:6px;">${job.address}</div>
            <table style="font-size:11px; width:100%; border-collapse:collapse;">
              <tr><td style="color:#888; padding:1px 4px 1px 0;">Status</td><td style="font-weight:600;">${job.status}</td></tr>
              <tr><td style="color:#888; padding:1px 4px 1px 0;">Type</td><td>${job.jobType}</td></tr>
              <tr><td style="color:#888; padding:1px 4px 1px 0;">Region</td><td>${job.region}</td></tr>
              <tr><td style="color:#888; padding:1px 4px 1px 0;">Auth Total</td><td>${totalStr}</td></tr>
            </table>
            ${job.primeUrl ? `<a href="${job.primeUrl}" target="_blank" rel="noopener noreferrer" style="display:inline-block; margin-top:8px; font-size:11px; color:#dc2626; text-decoration:underline;">Open in Prime →</a>` : ''}
          </div>
        `;

        L.marker([lat, lng], { icon: redIcon })
          .bindPopup(popup, { maxWidth: 280 })
          .addTo(map);
      }

      // Fit map to all plotted pins
      if (bounds.length > 0) {
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 13 });
      }
    });

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [jobs]);

  return (
    <div
      ref={containerRef}
      style={{ height, width: '100%', borderRadius: '12px', overflow: 'hidden' }}
    />
  );
}
