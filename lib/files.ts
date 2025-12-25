import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const DATA_ROOT = path.join(process.cwd(), 'data');
export const UPLOADS_DIR = path.join(DATA_ROOT, 'uploads');
export const REPORTS_DIR = path.join(DATA_ROOT, 'reports');

/**
 * Ensures that the data directories exist.
 */
export function ensureDataDirs() {
    if (!fs.existsSync(DATA_ROOT)) fs.mkdirSync(DATA_ROOT);
    if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR);
    if (!fs.existsSync(REPORTS_DIR)) fs.mkdirSync(REPORTS_DIR);
}

/**
 * Saves a file buffer to the uploads directory.
 * Returns the relative stored path and the SHA256 hash.
 */
export async function saveUpload(file: File, uploadId: string): Promise<{ storedPath: string; fileHashSha256: string }> {
    ensureDataDirs();

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Compute SHA256
    const hashSum = crypto.createHash('sha256');
    hashSum.update(buffer);
    const hex = hashSum.digest('hex');

    // Create nested directory for uploadId
    const uploadPath = path.join(UPLOADS_DIR, uploadId);
    if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath);

    const filePath = path.join(uploadPath, file.name);
    fs.writeFileSync(filePath, buffer);

    // Return relative path for portability if needed, or absolute. 
    // BRD requested: ./data/uploads/{uploadId}/{originalFilename}
    // We store the relative path from project root to allow easy identifying
    const relativePath = path.relative(process.cwd(), filePath);

    return {
        storedPath: relativePath,
        fileHashSha256: hex
    };
}
