import { UploadForm } from "@/components/UploadForm";

export default function UploadPage() {
  return (
    <div>
      <h1>Capture a page</h1>
      <p className="muted">
        Processing happens synchronously in this build - the page will wait for the
        AI call (mock or real) to finish, then take you straight to review.
      </p>
      <UploadForm />
    </div>
  );
}
