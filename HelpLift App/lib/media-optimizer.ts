// HelpLift App/lib/media-optimizer.ts
import imageCompression from 'browser-image-compression';

export interface FileValidationOptions {
  maxSizeMB?: number;
  allowedTypes?: ('image/jpeg' | 'image/png' | 'image/webp' | 'application/pdf')[];
}

const DEFAULT_ALLOWED_TYPES: ('image/jpeg' | 'image/png' | 'image/webp' | 'application/pdf')[] = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
];

/**
 * Validates the true binary magic numbers of the file to prevent extension spoofing.
 */
export async function validateFileIntegrity(file: File): Promise<{ valid: boolean; error?: string }> {
  try {
    const buffer = await file.slice(0, 8).arrayBuffer();
    const bytes = new Uint8Array(buffer);

    // PNG: 89 50 4E 47
    const isPng = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
    // JPEG: FF D8 FF
    const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    // WEBP: 52 49 46 46 (RIFF)
    const isWebp = bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46;
    // PDF: 25 50 44 46 (%PDF)
    const isPdf = bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46;

    if (!isPng && !isJpeg && !isWebp && !isPdf) {
      return { valid: false, error: 'Invalid or unsupported file format. Only JPEG, PNG, WebP, and PDF are allowed.' };
    }

    return { valid: true };
  } catch {
    return { valid: false, error: 'Unable to verify file structure.' };
  }
}

/**
 * Optimizes images (resizes and compresses) using browser web workers.
 * PDFs are returned untouched after size validation.
 */
export async function optimizeAndValidateFile(
  file: File,
  options: {
    maxSizeMB?: number;
    maxWidthOrHeight?: number;
    isAvatar?: boolean;
  } = {}
): Promise<File> {
  // 1. Verify binary magic bytes
  const integrity = await validateFileIntegrity(file);
  if (!integrity.valid) {
    throw new Error(integrity.error);
  }

  // 2. If it is a PDF, ensure it's under max file limit (e.g. 10MB)
  if (file.type === 'application/pdf') {
    const maxPdfSize = (options.maxSizeMB || 10) * 1024 * 1024;
    if (file.size > maxPdfSize) {
      throw new Error(`PDF exceeds the maximum allowed size of ${options.maxSizeMB || 10}MB.`);
    }
    return file;
  }

  // 3. Compress Image (JPEG/PNG/WebP)
  const compressionConfig = {
    maxSizeMB: options.maxSizeMB ?? (options.isAvatar ? 0.3 : 1.0),
    maxWidthOrHeight: options.maxWidthOrHeight ?? (options.isAvatar ? 512 : 1920),
    useWebWorker: true,
    fileType: file.type === 'image/png' ? 'image/png' : 'image/jpeg',
  };

  try {
    const compressedBlob = await imageCompression(file, compressionConfig);
    return new File([compressedBlob], file.name, {
      type: compressedBlob.type,
      lastModified: Date.now(),
    });
  } catch {
    // If client compression fails for an edge case, return original file
    return file;
  }
}