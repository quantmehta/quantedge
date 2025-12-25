import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { saveUpload } from '@/lib/files';
import { successResponse, errorResponse, ErrorCodes } from '@/lib/api-response';

// Allowed file extensions
const ALLOWED_EXTENSIONS = ['.csv', '.xlsx', '.xls'];

export async function POST(request: Request) {
    try {
        const formData = await request.formData();
        const file = formData.get('file') as File | null;
        const hasHeaderParam = formData.get('hasHeader');
        const hasHeader = hasHeaderParam !== null ? hasHeaderParam === 'true' : true;

        // Validate file presence
        if (!file) {
            return errorResponse(
                ErrorCodes.BAD_REQUEST,
                'No file provided',
                400
            );
        }

        // Validate file type
        const filename = file.name.toLowerCase();
        const ext = filename.substring(filename.lastIndexOf('.'));
        if (!ALLOWED_EXTENSIONS.includes(ext)) {
            return errorResponse(
                ErrorCodes.UNSUPPORTED_MEDIA_TYPE,
                `Unsupported file type: ${ext}. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`,
                415
            );
        }

        // Determine file type
        const fileType = ext === '.csv' ? 'CSV' : 'XLSX';

        // 1. Create placeholder record to get ID
        const upload = await prisma.portfolioUpload.create({
            data: {
                originalFilename: file.name,
                storedPath: '', // Placeholder
                fileHashSha256: '', // Placeholder
                fileType,
                status: 'UPLOADED',
                rowCount: 0
            }
        });

        // 2. Save file to disk
        let storedPath: string;
        let fileHashSha256: string;

        try {
            const saveResult = await saveUpload(file, upload.id);
            storedPath = saveResult.storedPath;
            fileHashSha256 = saveResult.fileHashSha256;
        } catch (ioError: any) {
            // Clean up the DB record if file save fails
            await prisma.portfolioUpload.delete({ where: { id: upload.id } });
            return errorResponse(
                ErrorCodes.FILE_IO_ERROR,
                `Failed to save file: ${ioError.message}`,
                500
            );
        }

        // 3. Update record with real path and hash
        const updatedUpload = await prisma.portfolioUpload.update({
            where: { id: upload.id },
            data: {
                storedPath,
                fileHashSha256
            }
        });

        // 4. Return standardized response
        return successResponse({
            uploadId: updatedUpload.id,
            originalFilename: updatedUpload.originalFilename,
            fileType: updatedUpload.fileType,
            storedPath: updatedUpload.storedPath,
            fileHashSha256: updatedUpload.fileHashSha256,
            createdAt: updatedUpload.createdAt.toISOString()
        }, 201);

    } catch (error: any) {
        console.error('Upload error:', error);
        return errorResponse(
            ErrorCodes.INTERNAL_ERROR,
            error.message || 'Internal Server Error',
            500
        );
    }
}
