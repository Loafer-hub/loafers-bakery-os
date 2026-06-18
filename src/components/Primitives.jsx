import { Check, X } from "lucide-react";

export function Modal({ title, children, onClose }) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="modal-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal-handle" />
        <div className="modal-title-row">
          <h2>{title}</h2>
          <button className="icon-button subtle" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}

export function Toast({ message }) {
  if (!message) return null;
  return (
    <div className="toast" role="status">
      <Check size={16} />
      {message}
    </div>
  );
}

export function Status({ children, tone = "neutral" }) {
  return <span className={`status status-${tone}`}>{children}</span>;
}

export function EmptyState({ title, body }) {
  return (
    <div className="empty-state">
      <h3>{title}</h3>
      <p>{body}</p>
    </div>
  );
}
