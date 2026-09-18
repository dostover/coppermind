"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { extractErrorMessage } from "@/lib/fetchError";

// Mirrors the client-component pattern used throughout apps/inkwell
// (NewFolderForm, UploadForm, etc.): a "use client" component holding local
// state and fetch calls, rendered from a plain server page.
//
// Flow: email -> code -> (username, only for a brand-new email) -> redirect
// to "/". See claude/technical-decisions.md for why this is two calls
// (check-code, then sign-in or register) rather than one - the check is
// read-only so the client can decide which screen to show next without
// spending the code, and only the finalize call actually consumes it.
type Step =
  | { name: "email" }
  | { name: "code"; email: string; devCode?: string }
  | { name: "username"; email: string; code: string };

export function SignInFlow() {
  const router = useRouter();
  const [step, setStep] = useState<Step>({ name: "email" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRequestCode(email: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/request-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) throw new Error(await extractErrorMessage(res, "Could not send a code."));
      const data = (await res.json()) as { devCode?: string };
      setStep({ name: "code", email, devCode: data.devCode });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send a code.");
    } finally {
      setBusy(false);
    }
  }

  async function handleSubmitCode(email: string, code: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/check-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });
      if (!res.ok) throw new Error(await extractErrorMessage(res, "That code didn't work."));
      const data = (await res.json()) as { isNewFan: boolean };

      if (data.isNewFan) {
        setStep({ name: "username", email, code });
        return;
      }

      const signInRes = await fetch("/api/auth/sign-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });
      if (!signInRes.ok) {
        throw new Error(await extractErrorMessage(signInRes, "Could not sign you in."));
      }
      router.push("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "That code didn't work.");
    } finally {
      setBusy(false);
    }
  }

  async function handleRegister(email: string, code: string, displayName: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code, displayName }),
      });
      if (!res.ok) throw new Error(await extractErrorMessage(res, "Could not create your account."));
      router.push("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create your account.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="sign-in-flow">
      {step.name === "email" && (
        <EmailStep busy={busy} onSubmit={handleRequestCode} />
      )}
      {step.name === "code" && (
        <CodeStep
          email={step.email}
          devCode={step.devCode}
          busy={busy}
          onSubmit={(code) => handleSubmitCode(step.email, code)}
          onBack={() => setStep({ name: "email" })}
        />
      )}
      {step.name === "username" && (
        <UsernameStep
          busy={busy}
          onSubmit={(displayName) => handleRegister(step.email, step.code, displayName)}
        />
      )}
      {error && (
        <p role="alert" className="sign-in-error">
          {error}
        </p>
      )}
    </div>
  );
}

function EmailStep({
  busy,
  onSubmit,
}: {
  busy: boolean;
  onSubmit: (email: string) => void;
}) {
  const [email, setEmail] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const trimmed = email.trim();
        if (trimmed) onSubmit(trimmed);
      }}
    >
      <h2>Sign in</h2>
      <p>Enter your email and we&apos;ll send you a one-time code.</p>
      <label htmlFor="email">Email</label>
      <input
        id="email"
        type="email"
        required
        autoFocus
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
      />
      <button type="submit" disabled={busy}>
        {busy ? "Sending..." : "Send code"}
      </button>
    </form>
  );
}

function CodeStep({
  email,
  devCode,
  busy,
  onSubmit,
  onBack,
}: {
  email: string;
  devCode?: string;
  busy: boolean;
  onSubmit: (code: string) => void;
  onBack: () => void;
}) {
  const [code, setCode] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const trimmed = code.trim();
        if (trimmed) onSubmit(trimmed);
      }}
    >
      <h2>Enter your code</h2>
      <p>
        We sent a code to <strong>{email}</strong>.
      </p>
      {devCode && (
        <p className="dev-hint">
          Dev mode (no email service wired up yet): your code is <strong>{devCode}</strong>.
        </p>
      )}
      <label htmlFor="code">Code</label>
      <input
        id="code"
        inputMode="numeric"
        required
        autoFocus
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="123456"
      />
      <button type="submit" disabled={busy}>
        {busy ? "Checking..." : "Continue"}
      </button>
      <button type="button" onClick={onBack} disabled={busy} className="link-button">
        Use a different email
      </button>
    </form>
  );
}

function UsernameStep({
  busy,
  onSubmit,
}: {
  busy: boolean;
  onSubmit: (displayName: string) => void;
}) {
  const [displayName, setDisplayName] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const trimmed = displayName.trim();
        if (trimmed) onSubmit(trimmed);
      }}
    >
      <h2>Choose a display name</h2>
      <p>This is what other fans will see when you trade with them.</p>
      <label htmlFor="displayName">Display name</label>
      <input
        id="displayName"
        required
        autoFocus
        maxLength={30}
        value={displayName}
        onChange={(e) => setDisplayName(e.target.value)}
        placeholder="Banana Fan #1"
      />
      <button type="submit" disabled={busy}>
        {busy ? "Creating account..." : "Finish"}
      </button>
    </form>
  );
}
