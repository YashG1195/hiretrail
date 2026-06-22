# Workers Directory

BullMQ background workers — each runs as a separate process subscriber to a queue.

| File | Phase | Description |
|------|-------|-------------|
| `resumeParserWorker.js` | Phase 4 | Parses uploaded PDF resumes via pdf-parse |
| `atsScoreWorker.js` | Phase 5 | Runs TF-IDF + cosine similarity ATS scoring |
| `reminderWorker.js` | Phase 6 | Cron-based follow-up email reminders |
