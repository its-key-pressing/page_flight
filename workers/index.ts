/**
 * PageFlight Scanner Worker
 *
 * This is the Railway persistent process entry point.
 * It consumes jobs from the BullMQ 'scans' queue and
 * runs Playwright checks against submitted URLs.
 *
 * NEVER import this file into the Next.js app.
 * It runs as a completely separate Node.js process on Railway.
 *
 * Start command (Railway): tsx workers/index.ts
 * Local dev:                npm run worker
 */

import { Worker } from 'bullmq'
import IORedis from 'ioredis'
import type { ScanJobPayload } from '../lib/types'
import { processJob } from './processor'

const host = process.env.UPSTASH_REDIS_REST_URL!
  .replace('https://', '')
  .replace('http://', '')
const token = process.env.UPSTASH_REDIS_REST_TOKEN!

const connection = new IORedis(`rediss://:${token}@${host}:6379`, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
})

const worker = new Worker<ScanJobPayload>(
  'scans',
  async (job) => {
    console.log(`[worker] Starting job ${job.id} — ${job.data.url}`)
    await processJob(job.data)
    console.log(`[worker] Completed job ${job.id}`)
  },
  {
    connection,
    concurrency: 2,
  }
)

worker.on('completed', (job) => {
  console.log(`[worker] ✓ Job ${job.id} completed`)
})

worker.on('failed', (job, err) => {
  console.error(`[worker] ✗ Job ${job?.id} failed:`, err.message)
})

worker.on('error', (err) => {
  console.error('[worker] Worker error:', err)
})

console.log('[worker] PageFlight scanner worker started. Waiting for jobs…')

process.on('SIGTERM', async () => {
  console.log('[worker] SIGTERM received — draining queue and shutting down…')
  await worker.close()
  process.exit(0)
})
