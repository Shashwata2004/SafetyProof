"use client";
import { useEffect, useId, useRef } from "react";
import {
  X,
  FileText,
  BookOpen,
  ClipboardList,
  ListChecks,
  CalendarCheck,
  Wrench,
  Files,
  LoaderCircle,
  TriangleAlert,
} from "lucide-react";
import { Role } from "@/lib/api";

export function DocIcon({ role, size = 20 }: { role: Role; size?: number }) {
  const Icon = {
    inspection: ClipboardList,
    sop: BookOpen,
    incident: FileText,
    drill: CalendarCheck,
    maintenance: Wrench,
    cap: ListChecks,
    other: Files,
  }[role];
  return (
    <span className={"doc-icon " + role}>
      <Icon size={size} strokeWidth={1.65} />
    </span>
  );
}
export function Busy({ text = "Loading…" }: { text?: string }) {
  return (
    <div className="notice">
      <LoaderCircle size={17} className="spin" />
      {text}
    </div>
  );
}
export function ErrorNote({ text }: { text: string }) {
  return (
    <p role="alert" className="error">
      <TriangleAlert size={16} />
      {text}
    </p>
  );
}
export function Tag({
  children,
  tone = "",
}: {
  children: React.ReactNode;
  tone?: string;
}) {
  return <span className={"tag " + tone}>{children}</span>;
}
export function Modal({
  title,
  close,
  children,
  wide = false,
}: {
  title: string;
  close: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const headingId = useId();
  useEffect(() => {
    const node = ref.current;
    node?.showModal();
    return () => node?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby={headingId}
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
      className={wide ? "modal wide" : "modal"}
    >
      <div className="modal-inner">
        <header>
          <h2 id={headingId}>{title}</h2>
          <button
            className="icon-button"
            aria-label="Close dialog"
            onClick={close}
          >
            <X size={20} />
          </button>
        </header>
        {children}
      </div>
    </dialog>
  );
}
