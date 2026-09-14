import Link from "next/link";

export function Nav() {
  return (
    <nav className="nav">
      <Link href="/" className="brand">
        Inkwell
      </Link>
      <Link href="/upload">Capture</Link>
      <Link href="/library">Library</Link>
    </nav>
  );
}
