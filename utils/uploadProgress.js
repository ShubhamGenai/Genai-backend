/**
 * In-memory upload progress store for library document uploads.
 * Backend reports progress (receiving file → uploading to Spaces → done);
 * frontend subscribes via SSE to show exact progress.
 */

const store = new Map(); // uploadId -> { percent, stage, at }
const TTL_MS = 10 * 60 * 1000; // 10 min then clean up

function setProgress(uploadId, percent, stage = "receiving") {
  if (!uploadId) return;
  store.set(uploadId, {
    percent: Math.min(100, Math.max(0, percent)),
    stage: stage || "receiving",
    at: Date.now(),
  });
}

function getProgress(uploadId) {
  if (!uploadId) return null;
  const entry = store.get(uploadId);
  if (!entry) return null;
  if (Date.now() - entry.at > TTL_MS) {
    store.delete(uploadId);
    return null;
  }
  return { percent: entry.percent, stage: entry.stage };
}

function clearProgress(uploadId) {
  if (uploadId) store.delete(uploadId);
}

module.exports = {
  setProgress,
  getProgress,
  clearProgress,
};
