import { UploadForm } from "@/components/UploadForm";

export default function UploadPage() {
  return (
    <div>
      <h1>Capture a page</h1>
      <p className="muted">
        Transcription happens in the background - you&apos;ll land on the review screen
        right away and it&apos;ll fill in automatically, no need to wait or refresh.
      </p>
      <UploadForm />
    </div>
  );
}
