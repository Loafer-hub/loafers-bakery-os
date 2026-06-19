import {
  CheckCircle2,
  Cloud,
  CloudDownload,
  CloudUpload,
  Copy,
  ExternalLink,
  LogOut,
  RefreshCw,
  Send,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  downloadCloudSnapshot,
  publicOrderUrl,
  publishRecipeCatalog,
  signInWithEmail,
  signOutCloud,
  signUpBaker,
  uploadCloudSnapshot,
} from "../lib/cloud";
import { createBackup, parseBackup } from "../lib/storage";

function dateLabel(value) {
  if (!value) return "No cloud copy yet";
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function safeSlug(value) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function BakerCloudPanel({
  cloudAccount,
  data,
  recipes,
  lastCloudBackupAt,
  onRestore,
  onSetLastCloudBackupAt,
}) {
  const [mode, setMode] = useState("signin");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [remoteUpdatedAt, setRemoteUpdatedAt] = useState(lastCloudBackupAt);
  const [form, setForm] = useState({
    email: "",
    password: "",
    fullName: "",
    bakeryName: "Loafers",
    slug: "loafers",
  });
  const backup = useMemo(() => createBackup(data), [data]);
  const workspace = cloudAccount.workspace;
  const orderLink = publicOrderUrl(workspace?.bakery?.slug || "loafers");

  useEffect(() => {
    if (!workspace?.bakeryId) return;
    downloadCloudSnapshot(workspace.bakeryId)
      .then((snapshot) => setRemoteUpdatedAt(snapshot?.updated_at || null))
      .catch(() => {});
  }, [workspace?.bakeryId]);

  async function submitAccount(event) {
    event.preventDefault();
    setBusy("account");
    setError("");
    setMessage("");
    try {
      if (mode === "signin") {
        await signInWithEmail(form.email.trim(), form.password);
        setMessage("Signed in. Your bakery cloud is ready.");
      } else {
        const result = await signUpBaker({
          email: form.email.trim(),
          password: form.password,
          fullName: form.fullName.trim(),
          bakeryName: form.bakeryName.trim(),
          slug: safeSlug(form.slug || form.bakeryName),
        });
        if (result.session) {
          await cloudAccount.refreshWorkspace(result.session);
          setMessage("Bakery account created.");
        } else {
          setMessage("Account created. Check your email to confirm it, then sign in.");
          setMode("signin");
        }
      }
    } catch (nextError) {
      setError(nextError.message);
    } finally {
      setBusy("");
    }
  }

  async function uploadSnapshot() {
    setBusy("upload");
    setError("");
    setMessage("");
    try {
      const result = await uploadCloudSnapshot(
        workspace.bakeryId,
        backup,
        cloudAccount.session.user.id,
      );
      setRemoteUpdatedAt(result.updated_at);
      onSetLastCloudBackupAt(result.updated_at);
      setMessage("This device is safely copied to the cloud.");
    } catch (nextError) {
      setError(nextError.message);
    } finally {
      setBusy("");
    }
  }

  async function restoreSnapshot() {
    if (!window.confirm("Replace this device's bakery records with the latest cloud copy? A recovery copy will be kept.")) return;
    setBusy("restore");
    setError("");
    setMessage("");
    try {
      const remote = await downloadCloudSnapshot(workspace.bakeryId);
      if (!remote?.data) throw new Error("There is no cloud copy to restore yet.");
      const parsed = parseBackup(JSON.stringify(remote.data));
      onRestore(parsed.data, backup);
      setMessage("Cloud copy restored. You can undo this from the recovery section below.");
    } catch (nextError) {
      setError(nextError.message);
    } finally {
      setBusy("");
    }
  }

  async function publishProducts() {
    setBusy("publish");
    setError("");
    setMessage("");
    try {
      const count = await publishRecipeCatalog(workspace.bakeryId, recipes);
      setMessage(`${count} recipe${count === 1 ? "" : "s"} published to your customer menu.`);
    } catch (nextError) {
      setError(nextError.message);
    } finally {
      setBusy("");
    }
  }

  async function copyOrderLink() {
    try {
      await navigator.clipboard.writeText(orderLink);
      setMessage("Customer order link copied.");
    } catch {
      setError("Copying was blocked. Open the order page and copy its address instead.");
    }
  }

  async function signOut() {
    setBusy("signout");
    try {
      await signOutCloud();
      setMessage("Signed out.");
    } catch (nextError) {
      setError(nextError.message);
    } finally {
      setBusy("");
    }
  }

  if (!cloudAccount.configured) {
    return (
      <section className="storage-section cloud-section">
        <div className="section-title-line">
          <div><span className="eyebrow-label dark">Prepared</span><h3>Cloud & customer orders</h3></div>
          <Cloud size={19} />
        </div>
        <div className="cloud-ready-card">
          <ShieldCheck size={24} />
          <div>
            <strong>The secure cloud layer is ready</strong>
            <p>Connect a Supabase project to turn on baker accounts, cloud copies, customer accounts, and live order requests.</p>
          </div>
        </div>
        <ul className="cloud-checklist">
          <li><CheckCircle2 /> Private bakery records protected by account access</li>
          <li><CheckCircle2 /> Guest and signed-in customer order requests</li>
          <li><CheckCircle2 /> Shareable menu built from your recipes and prices</li>
        </ul>
        <a className="storage-file-button" href={orderLink}>
          <ExternalLink size={16} /> Preview customer order page
        </a>
        <small className="cloud-footnote">Cloud remains off until the project connection is added.</small>
      </section>
    );
  }

  if (cloudAccount.loading) {
    return (
      <section className="storage-section cloud-section cloud-loading">
        <RefreshCw className="spin" size={18} /> Checking cloud account…
      </section>
    );
  }

  if (!cloudAccount.session) {
    return (
      <section className="storage-section cloud-section">
        <div className="section-title-line">
          <div><span className="eyebrow-label dark">Secure account</span><h3>{mode === "signin" ? "Sign in to cloud" : "Create bakery account"}</h3></div>
          <UserRound size={19} />
        </div>
        <div className="cloud-mode-switch">
          <button type="button" className={mode === "signin" ? "selected" : ""} onClick={() => setMode("signin")}>Sign in</button>
          <button type="button" className={mode === "signup" ? "selected" : ""} onClick={() => setMode("signup")}>Create account</button>
        </div>
        <form className="form-stack" onSubmit={submitAccount}>
          {mode === "signup" ? (
            <>
              <label>Your name<input required value={form.fullName} onChange={(event) => setForm({ ...form, fullName: event.target.value })} /></label>
              <label>Bakery name<input required value={form.bakeryName} onChange={(event) => setForm({ ...form, bakeryName: event.target.value, slug: safeSlug(event.target.value) })} /></label>
              <label>Order page name<div className="slug-field"><span>?order=</span><input required value={form.slug} onChange={(event) => setForm({ ...form, slug: safeSlug(event.target.value) })} /></div></label>
            </>
          ) : null}
          <label>Email<input required type="email" autoComplete="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label>
          <label>Password<input required minLength="8" type="password" autoComplete={mode === "signin" ? "current-password" : "new-password"} value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} /></label>
          <button className="primary-button" type="submit" disabled={busy === "account"}>
            {busy === "account" ? "Please wait…" : mode === "signin" ? "Sign in" : "Create secure account"}
          </button>
        </form>
        {error || cloudAccount.error ? <p className="form-error" role="alert">{error || cloudAccount.error}</p> : null}
        {message ? <div className="storage-success"><CheckCircle2 size={17} /> {message}</div> : null}
      </section>
    );
  }

  if (!workspace) {
    return (
      <section className="storage-section cloud-section">
        <div className="cloud-ready-card">
          <UserRound size={22} />
          <div><strong>{cloudAccount.session.user.email}</strong><p>This is a customer account. Create or sign in with a bakery-owner account to manage cloud records.</p></div>
        </div>
        <button className="storage-file-button" type="button" onClick={signOut}><LogOut size={16} /> Sign out</button>
      </section>
    );
  }

  return (
    <section className="storage-section cloud-section cloud-connected">
      <div className="section-title-line">
        <div><span className="eyebrow-label dark">Connected</span><h3>{workspace.bakery.name}</h3></div>
        <Cloud size={19} />
      </div>
      <div className="cloud-account-line">
        <span><strong>{cloudAccount.session.user.email}</strong><small>{workspace.role} · last cloud copy {dateLabel(remoteUpdatedAt)}</small></span>
        <button type="button" onClick={signOut} aria-label="Sign out"><LogOut size={16} /></button>
      </div>
      <div className="cloud-action-grid">
        <button type="button" onClick={uploadSnapshot} disabled={Boolean(busy)}>
          <CloudUpload size={19} /><span><strong>Copy to cloud</strong><small>Upload this device</small></span>
        </button>
        <button type="button" onClick={restoreSnapshot} disabled={Boolean(busy)}>
          <CloudDownload size={19} /><span><strong>Restore cloud copy</strong><small>Replace this device</small></span>
        </button>
      </div>
      <div className="customer-link-card">
        <div><span className="eyebrow-label dark">Customer ordering</span><strong>/{workspace.bakery.slug}</strong></div>
        <p>Publish your current recipes, then share this link with customers.</p>
        <button className="primary-button" type="button" onClick={publishProducts} disabled={Boolean(busy)}>
          <Send size={16} /> {busy === "publish" ? "Publishing…" : "Publish recipe menu"}
        </button>
        <div className="customer-link-actions">
          <button type="button" onClick={copyOrderLink}><Copy size={15} /> Copy link</button>
          <a href={orderLink}><ExternalLink size={15} /> Open page</a>
        </div>
      </div>
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      {message ? <div className="storage-success"><CheckCircle2 size={17} /> {message}</div> : null}
    </section>
  );
}
