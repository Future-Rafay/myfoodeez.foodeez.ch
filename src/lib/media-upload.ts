import {
  ALLOWED_IMAGE_TYPES,
  MAX_UPLOAD_SIZE_BYTES,
} from "@/lib/media";

export interface UploadResult {
  key: string;
  url: string;
}

function validateFile(file: File) {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type as (typeof ALLOWED_IMAGE_TYPES)[number])) {
    throw new Error("Only PNG, JPEG, WebP, and GIF images are allowed.");
  }
  if (file.size > MAX_UPLOAD_SIZE_BYTES) {
    throw new Error("Image must be 10 MB or smaller.");
  }
}

export async function uploadFileToS3(file: File): Promise<UploadResult> {
  validateFile(file);

  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch("/api/upload", {
    method: "POST",
    body: formData,
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || "Upload failed");
  }

  if (!data?.url) {
    throw new Error("Upload did not return a URL");
  }

  return { key: data.key, url: data.url };
}

export async function uploadImagesToS3(images: File[]): Promise<string[]> {
  const urls: string[] = [];
  for (const file of images) {
    const result = await uploadFileToS3(file);
    urls.push(result.url);
  }
  return urls;
}
