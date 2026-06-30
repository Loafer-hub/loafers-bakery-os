import { Capacitor } from "@capacitor/core";
import {
  CheckCircle2,
  Cloud,
  CloudOff,
  Database,
  Download,
  FileJson,
  HardDrive,
  LockKeyhole,
  RotateCcw,
  Upload,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  backupSizeBytes,
  createBackup,
  parseBackup,
  STORAGE_DATASETS,
} from "../lib/storage";
import { BakerCloudPanel } from "./BakerCloudPanel";
import { Modal } from "./Primitives";

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function dateLabel(value) {
  if (!value) return "Never";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function downloadJson(backup) {
  const text = JSON.stringify(backup, null, 2);
  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const date = backup.createdAt.slice(0, 10);
  const link = document.createElement("a");
  link.href = url;
  link.download = `loafers-backup-${date}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function StorageCenter({
  data,
  cloudAccount,
  lastBackupAt,
  lastCloudBackupAt,
  recoveryBackup,
  onClose,
  onRestore,
  onSetLastBackupAt,
  onSetLastCloudBackupAt,
  onUndoRestore,
}) {
  const [quota, setQuota] = useState(null);
  const [importText, setImportText] = useState("");
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState("");
  const [restored, setRestored] = useState(false);
  const fileInput = useRef(null);
  const backup = useMemo(() => createBackup(data), [data]);
  const size = backupSizeBytes(backup);
  const totalRecords = STORAGE_DATASETS.reduce((sum, { id }) => sum + data[id].length, 0);
  const native = Capacitor.isNativePlatform();
  const cloudConnected = Boolean(cloudAccount.configured && cloudAccount.workspace);

  useEffect(() => {
    let active = true;
    if (!navigator.storage?.estimate) return undefined;
    navigator.storage.estimate().then((estimate) => {
      if (active) setQuota(estimate);
    }).catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  function previewBackup(text) {
    setError("");
    setRestored(false);
    try {
      const parsed = parseBackup(text);
      setPreview(parsed);
      setImportText(text);
    } catch (nextError) {
      setPreview(null);
      setError(nextError.message);
    }
  }

  async function readFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      previewBackup(await file.text());
    } catch {
      setError("Loafers could not read that file.");
    }
    event.target.value = "";
  }

  function exportBackup() {
    const createdAt = new Date().toISOString();
    const freshBackup = { ...backup, createdAt };
    downloadJson(freshBackup);
    onSetLastBackupAt(createdAt);
  }

  function restoreBackup() {
    if (!preview) return;
    onRestore(preview.data, backup);
    setRestored(true);
    setImportText("");
    setPreview(null);
  }

  return (
    <Modal title="Storage & backup" onClose={onClose}>
      <div className="storage-center">
        <section className="storage-hero">
          <span><HardDrive size={23} /></span>
          <div>
            <strong>{native ? "Saved on this iPhone" : "Saved in this browser"}</strong>
            <p>{cloudConnected ? "Your device records can now be copied to your private bakery cloud." : "Your bakery records stay on this device until cloud is connected."}</p>
          </div>
        </section>

        <div className="storage-status-grid">
          <div><Database /><strong>{totalRecords}</strong><span>total records</span></div>
          <div><FileJson /><strong>{formatBytes(size)}</strong><span>backup size</span></div>
          <div>{cloudConnected ? <Cloud /> : <CloudOff />}<strong>{cloudConnected ? "Ready" : "Off"}</strong><span>cloud storage</span></div>
        </div>

        <BakerCloudPanel
          cloudAccount={cloudAccount}
          data={data}
          recipes={data.recipes}
          lastCloudBackupAt={lastCloudBackupAt}
          onRestore={onRestore}
          onSetLastCloudBackupAt={onSetLastCloudBackupAt}
        />

        <section className="storage-section">
          <div className="section-title-line">
            <div><span className="eyebrow-label dark">Current device</span><h3>What is stored</h3></div>
            <span>{quota?.usage ? formatBytes(quota.usage) : "Private storage"}</span>
          </div>
          <div className="storage-dataset-grid">
            {STORAGE_DATASETS.map(({ id, label }) => (
              <div key={id}><span>{label}</span><strong>{data[id].length}</strong></div>
            ))}
          </div>
        </section>

        <section className="storage-section backup-section">
          <div className="section-title-line">
            <div><span className="eyebrow-label dark">Recommended</span><h3>Make a backup</h3></div>
            <Download size={18} />
          </div>
          <p>Download one file containing orders, customer profiles, recipes, inventory, expenses, bake plans, kitchen bakes, liquid safety logs, starters, and feed logs.</p>
          <button className="primary-button" type="button" onClick={exportBackup}><Download size={17} /> Download backup</button>
          <small>Last backup: {dateLabel(lastBackupAt)}</small>
        </section>

        <section className="storage-section restore-section">
          <div className="section-title-line">
            <div><span className="eyebrow-label dark">Two-step restore</span><h3>Restore a backup</h3></div>
            <Upload size={18} />
          </div>
          <p>Choose a Loafers JSON file or paste its text. Nothing changes until you review the counts and press restore.</p>
          <input ref={fileInput} className="visually-hidden" type="file" accept=".json,application/json" onChange={readFile} />
          <button className="storage-file-button" type="button" onClick={() => fileInput.current?.click()}><Upload size={16} /> Choose backup file</button>
          <label>
            Or paste backup text
            <textarea value={importText} onChange={(event) => setImportText(event.target.value)} placeholder='{"format":"loafers-bakery-os-backup", ...}' />
          </label>
          <button className="storage-preview-button" type="button" disabled={!importText.trim()} onClick={() => previewBackup(importText)}><FileJson size={15} /> Preview backup</button>
          {error ? <p className="form-error" role="alert">{error}</p> : null}
          {preview ? (
            <div className="restore-preview">
              <div><CheckCircle2 size={18} /><span><strong>Valid Loafers backup</strong><small>Created {dateLabel(preview.createdAt)}</small></span></div>
              <div className="storage-dataset-grid compact">
                {STORAGE_DATASETS.map(({ id, label }) => (
                  <div key={id}><span>{label}</span><strong>{preview.data[id].length}</strong></div>
                ))}
              </div>
              <p><b>This replaces the records currently on this device.</b> Download a backup first if you need to preserve them.</p>
              <button className="danger-button restore-button" type="button" onClick={restoreBackup}><RotateCcw size={15} /> Restore these records</button>
            </div>
          ) : null}
          {restored ? <div className="storage-success"><CheckCircle2 size={17} /> Backup restored successfully.</div> : null}
        </section>

        {recoveryBackup ? (
          <section className="storage-section recovery-section">
            <div className="section-title-line">
              <div><span className="eyebrow-label dark">Automatic safety copy</span><h3>Undo last restore</h3></div>
              <RotateCcw size={18} />
            </div>
            <p>Loafers saved the records that were on this device before the last restore on {dateLabel(recoveryBackup.createdAt)}.</p>
            <button className="storage-file-button" type="button" onClick={onUndoRestore}><RotateCcw size={16} /> Recover previous records</button>
          </section>
        ) : null}

        <aside className="storage-privacy-note">
          <LockKeyhole size={18} />
          <p>Backup files may contain customer names, notes, and business costs. Keep them somewhere private.</p>
        </aside>
      </div>
    </Modal>
  );
}
