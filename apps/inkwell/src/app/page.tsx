import Link from "next/link";

export default function HomePage() {
  return (
    <div className="card">
      <h1>Inkwell</h1>
      <p>
        Upload a photo of a handwritten page. Inkwell transcribes it, flags anything
        it&apos;s unsure about, and learns from every correction you make - so the next
        page in your handwriting comes back cleaner than the last.
      </p>
      <p className="muted">
        Walking skeleton build: single page at a time, running on a mock transcriber
        until a real Anthropic API key is configured. See <code>README.md</code>.
      </p>
      <p>
        <Link href="/upload" className="button">
          Capture your first note
        </Link>
      </p>
    </div>
  );
}
