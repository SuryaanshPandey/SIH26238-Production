"use client";

import React, { useEffect, useRef, useState } from "react";
import { DocumentItem, DocumentType } from "../../lib/contracts/types";
import { Modal } from "../ui/Modal";
import { Input } from "../ui/Input";
import { Button } from "../ui/Button";
import { UploadCloud, X, FileCheck2 } from "lucide-react";

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpload: (data: Partial<DocumentItem> & { file: File; onProgress?: (percent: number) => void }) => Promise<void>;
  targetDoc?: DocumentItem | null;
  initialDocumentType?: DocumentType;
}

const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPT = ".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png";

export function UploadModal({ isOpen, onClose, onUpload, targetDoc, initialDocumentType }: UploadModalProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [docType, setDocType] = useState<DocumentType>(targetDoc?.document_type || "INCOME_CERTIFICATE");
  const [docName, setDocName] = useState(targetDoc?.document_name || "");
  const [issuer, setIssuer] = useState(targetDoc?.issuer || "");
  const [issueDate, setIssueDate] = useState(targetDoc?.issue_date?.slice(0, 10) || new Date().toISOString().slice(0, 10));
  const [expiryDate, setExpiryDate] = useState(targetDoc?.expiry_date?.slice(0, 10) || "");
  const [file, setFile] = useState<File | null>(null);
  const [validationError, setValidationError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!isOpen) return;
    setDocType(targetDoc?.document_type || initialDocumentType || "INCOME_CERTIFICATE");
    setDocName(targetDoc?.document_name || "");
    setIssuer(targetDoc?.issuer || "");
    setIssueDate(targetDoc?.issue_date?.slice(0, 10) || new Date().toISOString().slice(0, 10));
    setExpiryDate(targetDoc?.expiry_date?.slice(0, 10) || "");
    setFile(null); setValidationError(""); setProgress(0); setIsSubmitting(false);
    if (inputRef.current) inputRef.current.value = "";
  }, [isOpen, targetDoc, initialDocumentType]);

  function selectFile(next: File | undefined) {
    setValidationError("");
    if (!next) return;
    const allowed = ["application/pdf", "image/jpeg", "image/png"];
    if (next.size > MAX_BYTES) return setValidationError("File is larger than the 5 MB limit.");
    if (!allowed.includes(next.type)) return setValidationError("Only PDF, JPG and PNG files are supported.");
    setFile(next);
    if (!docName.trim()) setDocName(next.name.replace(/\.[^.]+$/, ""));
  }

  const titleTypeWarning = (() => {
    const text = docName.toLowerCase();
    const hints: Array<[string, DocumentType]> = [
      ["income", "INCOME_CERTIFICATE"],
      ["caste", "CASTE_CERTIFICATE"],
      ["tribe", "CASTE_CERTIFICATE"],
      ["domicile", "DOMICILE_CERTIFICATE"],
      ["residence", "DOMICILE_CERTIFICATE"],
      ["marksheet", "MARKSHEET"],
      ["grade card", "MARKSHEET"],
      ["bonafide", "BONAFIDE_CERTIFICATE"],
      ["fee receipt", "FEE_RECEIPT"],
      ["passbook", "BANK_PASSBOOK"],
      ["bank", "BANK_PASSBOOK"],
      ["hostel", "HOSTEL_CERTIFICATE"],
    ];
    const hint = hints.find(([term]) => text.includes(term));
    return hint && hint[1] !== docType ? `Title looks like ${hint[1].replace(/_/g, " ").toLowerCase()}, but the selected document type is ${docType.replace(/_/g, " ").toLowerCase()}. Check both before uploading.` : "";
  })();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setValidationError("");
    if (!file) return setValidationError("Select the document file before uploading.");
    if (!docName.trim()) return setValidationError("Enter a document title.");
    if (titleTypeWarning) return setValidationError(titleTypeWarning);
    if (!issuer.trim()) return setValidationError("Enter the issuing authority.");
    if (!issueDate) return setValidationError("Select the issue date.");
    setIsSubmitting(true); setProgress(0);
    try {
      await onUpload({
        document_id: targetDoc?.document_id,
        document_type: docType,
        document_name: docName.trim(),
        issuer: issuer.trim(),
        issue_date: issueDate,
        expiry_date: expiryDate || undefined,
        source: "STUDENT_UPLOAD",
        file,
        onProgress: setProgress,
      });
      onClose();
    } catch (error) {
      setValidationError(error instanceof Error ? error.message : "The document could not be uploaded.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={isSubmitting ? () => {} : onClose} title={targetDoc ? "Replace Document" : "Upload Digital Document"} description="Upload a certified PDF, JPG, or PNG document." >
      <form onSubmit={handleSubmit} className="space-y-3.5">
        {validationError && <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-[11px] text-red-800" role="alert">{validationError}</div>}

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Document Type</label>
          <select value={docType} onChange={(e) => setDocType(e.target.value as DocumentType)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm">
            <option value="INCOME_CERTIFICATE">Income Certificate</option>
            <option value="CASTE_CERTIFICATE">ST Community Certificate</option>
            <option value="DOMICILE_CERTIFICATE">Domicile / Residence Certificate</option>
            <option value="BONAFIDE_CERTIFICATE">College Bonafide / Enrollment Proof</option>
            <option value="ADMISSION_PROOF">Admission / Enrollment Proof</option>
            <option value="FEE_RECEIPT">Fee Receipt</option>
            <option value="MARKSHEET">Marksheet / Grade Card</option>
            <option value="BANK_PASSBOOK">Bank Passbook</option>
            <option value="HOSTEL_CERTIFICATE">Hostel Warden Certificate</option>
          </select>
        </div>

        <Input label="Document Title" value={docName} onChange={(e) => setDocName(e.target.value.slice(0, 120))} required placeholder="e.g. Annual Family Income Certificate 2026-27" />
        {titleTypeWarning && <p className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5" role="status">{titleTypeWarning}</p>}
        <Input label="Issuing Authority" value={issuer} onChange={(e) => setIssuer(e.target.value.slice(0, 120))} placeholder="e.g. Circle Officer / University Registrar" required />
        <div className="grid grid-cols-2 gap-2">
          <Input label="Date of Issue" type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} required />
          <Input label="Expiry (optional)" type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Document File (max 5 MB)</label>
          <div onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); selectFile(e.dataTransfer.files?.[0]); }} className="relative">
            <input ref={inputRef} type="file" accept={ACCEPT} capture="environment" className="hidden" onChange={(e) => selectFile(e.target.files?.[0])} disabled={isSubmitting} />
            <button type="button" className="w-full flex flex-col items-center justify-center p-4 border-2 border-dashed border-slate-300 rounded-xl hover:border-mota-700 bg-slate-50 transition-colors" onClick={() => inputRef.current?.click()} disabled={isSubmitting}>
              {file ? <FileCheck2 className="w-7 h-7 text-emerald-600 mb-1" /> : <UploadCloud className="w-7 h-7 text-mota-700 mb-1" />}
              <span className="text-xs font-semibold text-slate-700 max-w-full truncate px-3">{file ? file.name : "Tap to browse, drag & drop, or take photo"}</span>
              <span className="text-[10px] text-slate-400 mt-1">PDF / JPG / PNG · up to 5 MB</span>
            </button>
            {file && !isSubmitting && <button type="button" aria-label="Remove selected file" onClick={() => { setFile(null); if (inputRef.current) inputRef.current.value = ""; }} className="absolute right-2 top-2 w-6 h-6 rounded-full bg-white border border-slate-200 text-slate-500 flex items-center justify-center"><X className="w-3.5 h-3.5" /></button>}
          </div>
          {file && <div className="mt-1 text-[10px] text-slate-500 flex justify-between"><span>{(file.size / 1024).toFixed(0)} KB</span><span>{file.type === "application/pdf" ? "PDF" : "Image"}</span></div>}
        </div>

        {isSubmitting && <div className="space-y-1"><div className="h-1.5 rounded-full bg-slate-200 overflow-hidden"><div className="h-full bg-mota-700 transition-all" style={{ width: `${progress}%` }} /></div><div className="flex justify-between text-[10px] text-slate-500"><span>{progress < 100 ? "Uploading securely..." : "Finalizing document..."}</span><span>{progress}%</span></div></div>}

        <div className="pt-1 flex items-center justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>Cancel</Button>
          <Button type="submit" isLoading={isSubmitting}>{targetDoc ? "Replace Document" : "Upload Document"}</Button>
        </div>
      </form>
    </Modal>
  );
}
