/**
 * DigitalOcean Spaces storage (S3-compatible).
 * Uploads files to DO Spaces and returns the public URL.
 * Only the file URL is stored in MongoDB.
 * Uses concurrent multipart upload for large files and streams for speed.
 */

const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const { Upload } = require("@aws-sdk/lib-storage");

const region = process.env.DO_SPACES_REGION || "nyc3";
const bucket = process.env.DO_SPACES_BUCKET;
const endpoint = process.env.DO_SPACES_ENDPOINT || `https://${region}.digitaloceanspaces.com`;
const useCdn = process.env.DO_SPACES_CDN_URL || ""; // e.g. https://your-bucket.nyc3.cdn.digitaloceanspaces.com

let s3Client = null;

const getClient = () => {
  if (!s3Client) {
    const key = process.env.DO_SPACES_KEY;
    const secret = process.env.DO_SPACES_SECRET;
    if (!key || !secret || !bucket) {
      throw new Error("DO_SPACES_KEY, DO_SPACES_SECRET, and DO_SPACES_BUCKET must be set");
    }
    s3Client = new S3Client({
      region,
      endpoint,
      credentials: {
        accessKeyId: key,
        secretAccessKey: secret,
      },
      forcePathStyle: false,
    });
  }
  return s3Client;
};

/**
 * Get public URL for an object. Prefer CDN URL if configured.
 * DO Spaces public URL format: https://<bucket>.<region>.digitaloceanspaces.com/<key>
 */
const getPublicUrl = (key) => {
  if (useCdn && useCdn.length > 0) {
    const base = useCdn.endsWith("/") ? useCdn.slice(0, -1) : useCdn;
    return `${base}/${key}`;
  }
  return `https://${bucket}.${region}.digitaloceanspaces.com/${key}`;
};

/** Folder prefixes (similar to Cloudinary folders) */
const FOLDERS = {
  QUIZ_QUESTIONS: "quiz/question-images",
  COURSE_THUMBNAILS: "courses/thumbnails",
  LESSON_IMAGES: "lessons/images",
  TEST_IMAGES: "tests/images",
  USER_AVATARS: "users/avatars",
  LIBRARY_DOCS: "library/documents",
};

/** Max file size 100MB (configurable via env) */
const MAX_FILE_BYTES = parseInt(process.env.DO_SPACES_MAX_FILE_BYTES, 10) || 100 * 1024 * 1024;

/** Use concurrent multipart for buffers larger than this */
const MULTIPART_THRESHOLD = 5 * 1024 * 1024; // 5MB

/** Tuned for fast 50MB+ uploads: larger parts = fewer round-trips, more concurrency = better throughput */
const PART_SIZE = parseInt(process.env.DO_SPACES_PART_SIZE, 10) || 10 * 1024 * 1024; // 10MB (50MB = 5 parts)
const QUEUE_SIZE = parseInt(process.env.DO_SPACES_QUEUE_SIZE, 10) || 8; // 8 concurrent parts

const buildKey = (folder, originalName = "file") => {
  const ext = originalName.includes(".") ? originalName.slice(originalName.lastIndexOf(".")) : "";
  return `${folder}/${Date.now()}-${Math.round(Math.random() * 1e9)}${ext || ""}`;
};

const uploadParams = (key, body, mimetype) => ({
  Bucket: bucket,
  Key: key,
  Body: body,
  ContentType: mimetype || "application/octet-stream",
  ACL: "public-read",
});

/**
 * Upload a buffer to DigitalOcean Spaces.
 * Uses concurrent multipart upload for buffers > 5MB (faster).
 * @param {Buffer} buffer - File buffer
 * @param {string} mimetype - e.g. 'application/pdf', 'image/png'
 * @param {string} folder - Folder prefix (e.g. FOLDERS.LIBRARY_DOCS)
 * @param {string} originalName - Original filename (used for extension)
 * @returns {{ url: string, key: string, bytes: number }}
 */
const uploadBuffer = async (buffer, mimetype, folder, originalName = "file") => {
  const key = buildKey(folder, originalName);
  const client = getClient();

  if (buffer.length >= MULTIPART_THRESHOLD) {
    const upload = new Upload({
      client,
      params: uploadParams(key, buffer, mimetype),
      partSize: PART_SIZE,
      queueSize: QUEUE_SIZE,
    });
    await upload.done();
    const url = getPublicUrl(key);
    return { url, key, bytes: buffer.length };
  }

  await client.send(new PutObjectCommand(uploadParams(key, buffer, mimetype)));
  const url = getPublicUrl(key);
  return { url, key, bytes: buffer.length };
};

/**
 * Stream upload to Spaces (client → Spaces in parallel with receive).
 * Uses concurrent multipart upload for much faster large file uploads.
 * @param {ReadableStream} stream - File stream (e.g. from busboy)
 * @param {string} mimetype - e.g. 'application/pdf'
 * @param {string} folder - Folder prefix
 * @param {string} originalName - Original filename
 * @returns {{ url: string, key: string, bytes: number }}
 */
const uploadStream = async (stream, mimetype, folder, originalName = "file") => {
  const key = buildKey(folder, originalName);
  const client = getClient();
  const upload = new Upload({
    client,
    params: uploadParams(key, stream, mimetype),
    partSize: PART_SIZE,
    queueSize: QUEUE_SIZE,
  });
  await upload.done();
  const url = getPublicUrl(key);
  return { url, key, bytes: null };
};

const isConfigured = () => {
  return !!(
    process.env.DO_SPACES_KEY &&
    process.env.DO_SPACES_SECRET &&
    process.env.DO_SPACES_BUCKET
  );
};

module.exports = {
  uploadBuffer,
  uploadStream,
  getPublicUrl,
  FOLDERS,
  MAX_FILE_BYTES,
  isConfigured,
};
