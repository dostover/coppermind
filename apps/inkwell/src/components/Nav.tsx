import Link from "next/link";

export function Nav() {
  return (
    <nav className="nav">
      <div className="nav-inner">
        <Link href="/" className="brand">
          Inkwell
        </Link>
        <Link href="/upload">Capture</Link>
        <Link href="/library">Library</Link>
      </div>
    </nav>
  );
}
