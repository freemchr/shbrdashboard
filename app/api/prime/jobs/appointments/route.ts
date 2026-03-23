import { NextResponse } from 'next/server';
import { getAllOpenJobs, getStatusNameMap } from '@/lib/prime-open-jobs';
import { getCached, setCached } from '@/lib/blob-cache';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * Returns counts for appointment-related statuses:
 * - "Appointment Required" — jobs waiting to have an appointment booked
 * - "Appt TBC" — appointment booked but date/time to be confirmed
 * These are matched case-insensitively against status names.
 */

export interface AppointmentCounts {
  appointmentRequired: number;
  apptTBC: number;
  total: number;
  fetchedAt: string;
}

export async function GET() {
  try {
    const cacheKey = 'appointments-v1';
    const cached = await getCached<AppointmentCounts>(cacheKey);
    if (cached) return NextResponse.json(cached);

    const [jobs, statusNames] = await Promise.all([
      getAllOpenJobs(),
      getStatusNameMap(),
    ]);

    type RawJob = { attributes?: { statusId?: string } };

    let appointmentRequired = 0;
    let apptTBC = 0;

    for (const job of jobs as RawJob[]) {
      const statusId = job.attributes?.statusId ?? '';
      const statusName = (statusNames[statusId] || statusId).toLowerCase().trim();

      if (
        statusName === 'appointment required' ||
        statusName === 'appt required'
      ) {
        appointmentRequired++;
      } else if (
        statusName === 'appt tbc' ||
        statusName === 'appointment tbc'
      ) {
        apptTBC++;
      }
    }

    const result: AppointmentCounts = {
      appointmentRequired,
      apptTBC,
      total: appointmentRequired + apptTBC,
      fetchedAt: new Date().toISOString(),
    };

    await setCached(cacheKey, result, 4 * 60 * 60 * 1000);
    return NextResponse.json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
