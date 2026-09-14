"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function UploadForm() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<"idle" | "uploading" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setStatus("uploading");
    setError(null);

    const formData = new FormData();
    formData.append("image", file);

    try {
      const res = await fetch("/api/notes/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload failed.");
      router.push(`/notes/${data.id}`);
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Upload failed.");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card">
      <label htmlFor="image">Handwritten page image (JPEG, PNG, or WebP)</label>
      <input
        id="image"
        className="field"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        style={{ margin: "0.75rem 0" }}
      />
      <button className="button" type="submit" disabled={!file || status === "uploading"}>
        {status === "uploading" ? "Transcribing..." : "Upload & Transcribe"}
      </button>
      {status === "error" && (
        <p style={{ color: "#a33" }}>
          {error} The original upload is safe - you can retry from this page.
        </p>
      )}
    </form>
  );
}
