"use client";

import React, { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { documentsApi } from "../../lib/api/documents";
import { governmentApi, DigiLockerStatus } from "../../lib/api/government";
import { DocumentItem, DocumentType } from "../../lib/contracts/types";
import { DocumentCard } from "../../components/documents/DocumentCard";
import { UploadModal } from "../../components/documents/UploadModal";
import { Button } from "../../components/ui/Button";
import {
  FolderLock,
  RefreshCw,
  Plus,
  ShieldCheck,
  Info,
} from "lucide-react";

function DocumentWalletContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const jagoAction = searchParams.get("jagoAction");
  const requestedDocumentType = searchParams.get("type") as DocumentType | null;
  const requestedApplicationId = searchParams.get("applicationId");
  const [documents, setDocuments] = useState<DocumentItem[]>(() => documentsApi.getCachedDocuments());
  const [selectedDocForReplace, setSelectedDocForReplace] =
    useState<DocumentItem | null>(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [jagoUploadDocumentType, setJagoUploadDocumentType] = useState<DocumentType | undefined>(undefined);
  const [jagoUploadApplicationId, setJagoUploadApplicationId] = useState<string | undefined>(undefined);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState("");
  const [isLoading, setIsLoading] = useState(() => documentsApi.getCachedDocuments().length === 0);
  const [digiLockerStatus, setDigiLockerStatus] = useState<DigiLockerStatus | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadDocuments = async (force = false) => {
    setIsLoading((current) => current && !force ? current : true);
    setLoadError(null);
    try {
      setDocuments(await documentsApi.getDocuments({ force }));
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Documents could not be loaded.");
    } finally {
      setIsLoading(false);
    }

    // DigiLocker is optional in this deployment. Its status must never delay manual uploads.
    void governmentApi.getDigiLockerStatus().then(setDigiLockerStatus).catch(() => undefined);
  };

  useEffect(() => {
    loadDocuments();
  }, []);

  useEffect(() => {
    if (jagoAction !== "upload") return;
    const validTypes: DocumentType[] = [
      "INCOME_CERTIFICATE", "CASTE_CERTIFICATE", "DOMICILE_CERTIFICATE", "BONAFIDE_CERTIFICATE",
      "ADMISSION_PROOF", "FEE_RECEIPT", "MARKSHEET", "BANK_PASSBOOK", "HOSTEL_CERTIFICATE", "AADHAAR_CARD", "RESEARCH_PROPOSAL",
    ];
    const type = requestedDocumentType && validTypes.includes(requestedDocumentType) ? requestedDocumentType : "INCOME_CERTIFICATE";
    setSelectedDocForReplace(null);
    setJagoUploadDocumentType(type);
    setJagoUploadApplicationId(requestedApplicationId || undefined);
    setIsUploadModalOpen(true);
    router.replace("/documents");
  }, [jagoAction, requestedDocumentType, requestedApplicationId, router]);

  const handleSyncDigiLocker = async () => {
    setIsSyncing(true);
    setSyncMessage("");
    setLoadError(null);
    try {
      if (!digiLockerStatus?.configured) {
        throw new Error("DigiLocker partner credentials are not configured for this deployment.");
      }
      if (!digiLockerStatus.connected) {
        window.location.href = "/profile";
        return;
      }
      const res = await documentsApi.syncDigiLocker();
      setSyncMessage(res.message);
      await loadDocuments(true);
      window.setTimeout(() => setSyncMessage(""), 5000);
    } catch (err) {
      setSyncMessage(err instanceof Error ? err.message : "DigiLocker documents could not be fetched.");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleUploadOrReplace = async (data: Partial<DocumentItem>) => {
    try {
      await documentsApi.uploadOrReplaceDocument({
        ...data,
        related_application_id: data.related_application_id || jagoUploadApplicationId || undefined,
      });
      setSyncMessage("Document saved to your wallet.");
      await loadDocuments(true);
      setTimeout(() => setSyncMessage(""), 4000);
    } catch (err) {
      setSyncMessage(err instanceof Error ? err.message : "The document could not be saved.");
      throw err;
    }
  };


  return (
    <div className="p-4 space-y-4">
      {/* Title & Top Controls */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center">
              <FolderLock className="w-4 h-4" />
            </div>
            <h2 className="text-base font-bold text-slate-900">
              Document Wallet
            </h2>
          </div>
          <p className="text-xs text-slate-500">
            Upload and reuse your documents. Optional official connectors can link verified source records.
          </p>
        </div>

        <Button
          size="sm"
          onClick={() => {
            setSelectedDocForReplace(null);
            setJagoUploadDocumentType(undefined);
            setJagoUploadApplicationId(undefined);
            setIsUploadModalOpen(true);
          }}
          className="gap-1 text-xs"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Upload</span>
        </Button>
      </div>

      {/* DigiLocker Sync Bar */}
      <div className="p-3 bg-gradient-to-r from-blue-900 to-indigo-900 rounded-2xl text-white shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <span className="text-xs font-bold block">
              Optional DigiLocker connector
            </span>
            <span className="text-[11px] text-blue-200">
{documents.filter((d) => d.source === "DIGILOCKER").length} DigiLocker documents linked
            </span>
          </div>
        </div>

        <Button
          size="sm"
          variant="outline"
          isLoading={isSyncing}
          onClick={handleSyncDigiLocker}
          disabled={!digiLockerStatus?.configured}
          className="text-xs text-white border-white/40 hover:bg-white/10 h-8 disabled:opacity-60"
        >
          <RefreshCw className="w-3 h-3 mr-1" />
          <span>{!digiLockerStatus?.configured ? "Not configured" : !digiLockerStatus.connected ? "Connect DigiLocker" : "Sync DigiLocker"}</span>
        </Button>
      </div>

      <div className={`p-3 rounded-2xl border ${digiLockerStatus?.connected ? "bg-emerald-50 border-emerald-200" : "bg-amber-50 border-amber-200"}`}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold text-slate-800">Official source status</p>
            <p className="text-[11px] text-slate-600 mt-0.5">
              DigiLocker: {digiLockerStatus?.connected ? "connected" : digiLockerStatus?.configured ? "configured, not connected" : "not configured"}
            </p>
          </div>
          <span className="text-[10px] font-mono px-2 py-1 rounded-full bg-white border border-slate-200">
            {!digiLockerStatus?.configured ? "NOT_CONFIGURED" : digiLockerStatus.connected ? "CONNECTED" : "READY"}
          </span>
        </div>
        {!digiLockerStatus?.configured && (
          <div className="mt-2 space-y-2">
            <p className="text-[10px] text-slate-500">Official DigiLocker partner credentials and the exact registered callback URI must be configured before authorization and fetching can start.</p>
            {digiLockerStatus?.missing_configuration?.length ? (
              <p className="text-[10px] text-amber-700">Missing: {digiLockerStatus.missing_configuration.join(", ")}</p>
            ) : null}
          </div>
        )}
        {digiLockerStatus?.configured && !digiLockerStatus.connected && (
          <p className="text-[10px] text-slate-500 mt-2">Authorize this student from Profile, then return here to fetch issued DigiLocker documents.</p>
        )}
      </div>

      {loadError && !isLoading && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-900 flex items-center justify-between gap-3">
          <span>{loadError}</span>
          <Button size="sm" variant="outline" onClick={() => loadDocuments(true)}>Retry</Button>
        </div>
      )}

      {syncMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex items-center gap-2 animate-in fade-in">
          <Info className="w-4 h-4 text-blue-600 shrink-0" />
          <span>{syncMessage}</span>
        </div>
      )}

      <div className="p-2.5 bg-emerald-50 rounded-xl border border-emerald-200 text-[11px] text-emerald-900 flex items-start gap-2">
        <Info className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
        <span><strong>Manual upload is active.</strong> PDFs, JPGs and PNGs up to 5 MB can be uploaded directly and remain student-provided until independently verified.</span>
      </div>

      {/* Reusability Policy Banner */}
      <div className="p-2.5 bg-slate-100 rounded-xl text-[11px] text-slate-600 flex items-start gap-2">
        <Info className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
        <span>
          <strong>Source transparency:</strong> Documents are only labelled as government-sourced when the configured official connector has actually returned the record. Uploads remain student-provided until independently verified.
        </span>
      </div>

      {/* Documents List */}
      <div className="space-y-3 pt-1">
        {isLoading ? (
          <div className="space-y-3 animate-pulse">
            <div className="h-32 bg-slate-200 rounded-2xl" />
            <div className="h-32 bg-slate-200 rounded-2xl" />
          </div>
        ) : documents.length === 0 ? (
          <div className="text-center py-10 bg-white rounded-2xl border border-slate-200 p-6">
            <FolderLock className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-xs font-semibold text-slate-700">No documents in wallet</p>
            <p className="text-[11px] text-slate-400 mt-1">
              Connect an authorized official source or upload certificates manually. No synthetic source records are shown in live mode.
            </p>
          </div>
        ) : (
          documents.map((doc) => (
            <DocumentCard
              key={doc.document_id}
              document={doc}
              onReplace={(d) => {
                setSelectedDocForReplace(d);
                setJagoUploadDocumentType(undefined);
                setJagoUploadApplicationId(undefined);
                setIsUploadModalOpen(true);
              }}
            />
          ))
        )}
      </div>

      {/* Upload / Replace Modal */}
      <UploadModal
        isOpen={isUploadModalOpen}
        onClose={() => {
          setIsUploadModalOpen(false);
          setSelectedDocForReplace(null);
          setJagoUploadDocumentType(undefined);
          setJagoUploadApplicationId(undefined);
        }}
        targetDoc={selectedDocForReplace}
        initialDocumentType={jagoUploadDocumentType}
        onUpload={handleUploadOrReplace}
      />
    </div>
  );
}
export default function DocumentWalletPage() {
  return (
    <Suspense fallback={
      <div className="p-4 space-y-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-6 text-center">
          <p className="text-sm font-bold text-slate-900">Loading document wallet...</p>
        </div>
      </div>
    }>
      <DocumentWalletContent />
    </Suspense>
  );
}
