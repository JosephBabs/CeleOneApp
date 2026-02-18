// src/chat/upload.ts
export async function uploadFileToCDN(
  file: { uri: string; name: string; type: string },
  
): Promise<string> {
  const form = new FormData();

  form.append("file", {
    uri: file.uri,
    type: file.type,
    name: file.name,
  } as any);

  const res = await fetch("https://cdn.celeonetv.com/api/uploads/posts", {
    method: "POST",
    // headers: {
    //   "x-upload-key": uploadKey,
    // },
    body: form,
  });

  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`UPLOAD_FAILED ${res.status}: ${t}`);
  }

  const data = await res.json();
  if (!data?.url) throw new Error("UPLOAD_NO_URL");

  return data.url as string;
}
