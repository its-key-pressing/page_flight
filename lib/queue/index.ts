import { Queue } from 'bullmq'
import IORedis from 'ioredis'
import type { ScanJobPayload } from '@/lib/types'

/**
 * Upstash Redis connection for BullMQ.
 *
 * Uses the rediss:// URL format (TLS, port 6380) to avoid platform-specific
 * issues with the tls:{} object format on Windows.
 * Host and password are derived from the existing UPSTASH env vars.
 */
function createRedisConnection() {
  const host = process.env.UPSTASH_REDIS_REST_URL!
    .replace('https://', '')
    .replace('http://', '')
  const token = process.env.UPSTASH_REDIS_REST_TOKEN!

  return new IORedis(`rediss://:${token}@${host}:6379`, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  })
}

export const scanQueue = new Queue<ScanJobPayload>('scans', {
  connection: createRedisConnection(),
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 50 },
  },
})

/**
 * Add a scan job to the queue.
 */
export async function enqueueScan(payload: ScanJobPayload): Promise<string> {
  const job = await scanQueue.add('scan', payload, {
    jobId: payload.jobId,
  })
  return job.id!
}
