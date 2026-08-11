export async function compressImage(file: File, maxSizeMB = 0.8): Promise<File> {
  if (!file.type.startsWith("image/")) return file;

  const imageCompression = (await import("browser-image-compression")).default;
  return imageCompression(file, {
    maxSizeMB,
    maxWidthOrHeight: 1920,
    useWebWorker: true,
    fileType: "image/webp",
  });
}

export async function uploadFile(
  supabase: {
    storage: {
      from: (bucket: string) => {
        upload: (
          path: string,
          file: File,
          opts?: { upsert?: boolean; contentType?: string }
        ) => Promise<{ error: Error | null }>;
        getPublicUrl: (path: string) => { data: { publicUrl: string } };
      };
    };
  },
  bucket: "receipts" | "loan-documents" | "investment-documents" | "avatars",
  userId: string,
  file: File
): Promise<string> {
  const compressed = await compressImage(file);
  const ext = compressed.type === "image/webp" ? "webp" : file.name.split(".").pop();
  const path = `${userId}/${Date.now()}.${ext}`;

  const { error } = await supabase.storage.from(bucket).upload(path, compressed, {
    upsert: false,
    contentType: compressed.type,
  });

  if (error) throw error;

  if (bucket === "avatars") {
    return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
  }

  return path;
}
