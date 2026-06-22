# Queues Directory

BullMQ queue definitions — imported by both API routes (producers) and workers (consumers).

| File | Phase | Description |
|------|-------|-------------|
| `resumeQueue.js` | Phase 4 | Queue for async resume parsing jobs |
| `atsQueue.js` | Phase 5 | Queue for async ATS scoring jobs |
| `reminderQueue.js` | Phase 6 | Queue for scheduled reminder jobs |
