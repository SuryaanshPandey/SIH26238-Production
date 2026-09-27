import { DocumentItem } from "../contracts/types";
import { RIJVAN_API_URL, VERIFICATION_API_URL } from "../config";
import { getCurrentStudentId } from "../auth/session";
import { apiFetch } from "./http";

const DOCUMENT_CACHE_TTL_MS = 2 * 60_000;
const DOCUMENT_STALE_TTL_MS = 2 * 60 * 60_000;
const DOCUMENT_CACHE_KEY_PREFIX = "sih26238.documents.";
const documentCache = new Map<string, { savedAt: number; data: DocumentItem[] }>();
const documentRequests = new Map<string, Promise<DocumentItem[]>>();

function mapDocument(d: any): DocumentItem {
  const status = d.status === "REPLACED" ? "REPLACED" : d.status;
  const sourceMap: Record<string, DocumentItem["source"]> = {
    USER_UPLOAD: "STUDENT_UPLOAD",
    DIGITAL_SOURCE: "DIGILOCKER",
    INSTITUTION_SOURCE: "INSTITUTION",
    GOVERNMENT_SOURCE: "STATE_EDISTRICT",
    MOCK_SOURCE: "STUDENT_UPLOAD",
  };
  return {
    document_id: d.document_id,
    student_id: d.student_id,
    document_type: d.document_type as DocumentItem["document_type"],
    document_name: d.document_name || d.original_filename || d.document_type,
    source: sourceMap[d.source] || (d.source as DocumentItem["source"]) || "STUDENT_UPLOAD",
    document_status: status as DocumentItem["document_status"],
    verification_status: d.verification_status || "NOT_VERIFIABLE",
    issuer: d.issuer || d.issuer_authority || "",
    issue_date: d.issue_date || d.issued_at || new Date(0).toISOString().slice(0, 10),
    expiry_date: d.expiry_date || d.expires_at || undefined,
    uri: d.uri || d.storage_ref || d.document_ref,
    integrity_hash: d.integrity_hash || d.integrity?.hash || "",
    related_application_id: d.related_application_id || d.application_id || undefined,
    file_size_kb: d.file_size_kb ?? (d.file_size_bytes ? Math.ceil(Number(d.file_size_bytes) / 1024) : undefined),
    uploaded_at: d.uploaded_at || d.created_at || new Date().toISOString(),
    verified_at: d.verified_at,
  };
}

function invalidateDocumentCache(studentId = getCurrentStudentId() || "") {
  if (!studentId) return;
  documentCache.delete(studentId);
  if (typeof window !== "undefined") {
    try { window.sessionStorage.removeItem(`${DOCUMENT_CACHE_KEY_PREFIX}${studentId}`); } catch {}
  }
}

function readBrowserDocumentCache(studentId: string, allowStale = false): DocumentItem[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(`${DOCUMENT_CACHE_KEY_PREFIX}${studentId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const maxAge = allowStale ? DOCUMENT_STALE_TTL_MS : DOCUMENT_CACHE_TTL_MS;
    if (!Array.isArray(parsed?.data) || Number(parsed.savedAt) + maxAge <= Date.now()) return null;
    return parsed.data as DocumentItem[];
  } catch { return null; }
}

function writeBrowserDocumentCache(studentId: string, data: DocumentItem[]) {
  if (typeof window === "undefined") return;
  try { window.sessionStorage.setItem(`${DOCUMENT_CACHE_KEY_PREFIX}${studentId}`, JSON.stringify({ savedAt: Date.now(), data })); } catch {}
}

async function sha256(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function cacheSavedDocument(studentId: string, saved: DocumentItem, replacedDocumentId?: string) {
  const existing = documentCache.get(studentId)?.data || readBrowserDocumentCache(studentId, true) || [];
  const next = existing.filter((doc) => doc.document_id !== (replacedDocumentId || "") && doc.document_id !== saved.document_id);
  next.unshift(saved);
  documentCache.set(studentId, { savedAt: Date.now(), data: next });
  writeBrowserDocumentCache(studentId, next);
}

function getCachedDocumentsForStudent(studentId: string): DocumentItem[] {
  if (!studentId) return [];
  const memory = documentCache.get(studentId);
  if (memory) return memory.data;
  const browser = readBrowserDocumentCache(studentId, true);
  if (browser) {
    documentCache.set(studentId, { savedAt: Date.now(), data: browser });
    return browser;
  }
  return [];
}

export const documentsApi = {
  getCachedDocuments(): DocumentItem[] {
    return getCachedDocumentsForStudent(getCurrentStudentId() || "");
  },

  async getDocuments(options?: { force?: boolean }): Promise<DocumentItem[]> {
    const studentId = getCurrentStudentId();
    if (!studentId) throw new Error("Please sign in before opening the document wallet.");
    const cached = documentCache.get(studentId);
    if (!options?.force && cached && cached.savedAt + DOCUMENT_CACHE_TTL_MS > Date.now()) return cached.data;
    const browserCached = !options?.force ? readBrowserDocumentCache(studentId) : null;
    if (browserCached) {
      documentCache.set(studentId, { savedAt: Date.now(), data: browserCached });
      return browserCached;
    }
    if (!options?.force) {
      const existing = documentRequests.get(studentId);
      if (existing) return existing;
    }
    const request = apiFetch<any[]>(`${VERIFICATION_API_URL}/students/${encodeURIComponent(studentId)}/documents`)
      .then((data) => {
        const mapped = data.map(mapDocument);
        documentCache.set(studentId, { savedAt: Date.now(), data: mapped });
        writeBrowserDocumentCache(studentId, mapped);
        return mapped;
      })
      .finally(() => {
        if (documentRequests.get(studentId) === request) documentRequests.delete(studentId);
      });
    if (!options?.force) documentRequests.set(studentId, request);
    return request;
  },

  invalidateCache: invalidateDocumentCache,

  async getDocumentsByApplicationId(applicationId: string): Promise<DocumentItem[]> {
    const data = await apiFetch<any[]>(`${VERIFICATION_API_URL}/applications/${encodeURIComponent(applicationId)}/documents`);
    return data.map(mapDocument);
  },

  async getDocumentById(id: string): Promise<DocumentItem | null> {
    try {
      return mapDocument(await apiFetch<any>(`${VERIFICATION_API_URL}/documents/${encodeURIComponent(id)}`));
    } catch (error) {
      if (error instanceof Error && /not found/i.test(error.message)) return null;
      throw error;
    }
  },

  async uploadFileDocument(params: {
    file: File;
    document_type: DocumentItem["document_type"];
    document_name: string;
    issuer: string;
    issue_date: string;
    expiry_date?: string;
    application_id?: string;
    replace_document_id?: string;
    onProgress?: (percent: number) => void;
  }): Promise<DocumentItem> {
    const studentId = getCurrentStudentId();
    if (!studentId) throw new Error("Please sign in before uploading documents.");
    const maxBytes = 5 * 1024 * 1024;
    const allowed = ["application/pdf", "image/jpeg", "image/png"];
    if (params.file.size <= 0) throw new Error("The selected file is empty.");
    if (params.file.size > maxBytes) throw new Error("The selected file is larger than 5 MB.");
    if (!allowed.includes(params.file.type)) throw new Error("Only PDF, JPG, and PNG documents are supported.");

    const hash = await sha256(params.file);
    const cachedDocuments = getCachedDocumentsForStudent(studentId);
    const duplicate = cachedDocuments.find((doc) => doc.integrity_hash && doc.integrity_hash.toLowerCase() === hash.toLowerCase() && doc.document_status !== "REPLACED");
    if (duplicate && !params.replace_document_id) {
      throw new Error(`This file is already in your wallet as “${duplicate.document_name}”.`);
    }
    const form = new FormData();
    form.append("file", params.file, params.file.name);
    form.append("student_id", studentId);
    form.append("application_id", params.application_id || "UNASSIGNED");
    form.append("document_type", params.document_type);
    form.append("document_name", params.document_name.trim());
    form.append("issuer", params.issuer.trim());
    form.append("issued_at", params.issue_date);
    if (params.expiry_date) form.append("expires_at", params.expiry_date);
    form.append("content_sha256", hash);

    // Upload with XHR so the UI can show real progress. Fetch remains used for all JSON APIs.
    const token = typeof window !== "undefined" ? window.localStorage.getItem("sih26238.student.access_token") : null;
    const result = await new Promise<any>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open(
        "POST",
        params.replace_document_id
          ? `${VERIFICATION_API_URL}/documents/${encodeURIComponent(params.replace_document_id)}/replace-upload`
          : `${VERIFICATION_API_URL}/documents/upload`
      );
      xhr.responseType = "json";
      xhr.setRequestHeader("Accept", "application/json");
      if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) params.onProgress?.(Math.round((event.loaded / event.total) * 100));
      };
      xhr.onload = () => {
        const body = xhr.response ?? (() => { try { return JSON.parse(xhr.responseText); } catch { return null; } })();
        if (xhr.status >= 200 && xhr.status < 300 && body?.success !== false) return resolve(body?.data ?? body);
        reject(new Error(body?.error?.message || body?.detail?.error?.message || `Upload failed (HTTP ${xhr.status}).`));
      };
      xhr.onerror = () => reject(new Error("Upload failed. Check that the verification service is running."));
      xhr.ontimeout = () => reject(new Error("Upload timed out. Please retry."));
      xhr.timeout = 60_000;
      xhr.send(form);
    });
    const saved = mapDocument(result);
    cacheSavedDocument(studentId, saved, params.replace_document_id);
    return saved;
  },

  async uploadOrReplaceDocument(doc: Partial<DocumentItem> & { file?: File; onProgress?: (percent: number) => void }): Promise<DocumentItem> {
    if (doc.file) {
      return documentsApi.uploadFileDocument({
        file: doc.file,
        document_type: doc.document_type || "INCOME_CERTIFICATE",
        document_name: doc.document_name || doc.file.name,
        issuer: doc.issuer || "",
        issue_date: doc.issue_date || new Date().toISOString().slice(0, 10),
        expiry_date: doc.expiry_date,
        application_id: doc.related_application_id,
        replace_document_id: doc.document_id,
        onProgress: doc.onProgress,
      });
    }
    const studentId = getCurrentStudentId() || "";
    const payload = {
      student_id: studentId,
      application_id: doc.related_application_id || "UNASSIGNED",
      document_type: doc.document_type || "INCOME_CERTIFICATE",
      document_name: doc.document_name || doc.document_type || "Document",
      source: doc.source === "DIGILOCKER" ? "DIGITAL_SOURCE" : doc.source === "INSTITUTION" ? "INSTITUTION_SOURCE" : "USER_UPLOAD",
      status: "UPLOADED",
      issued_at: doc.issue_date ? new Date(doc.issue_date).toISOString() : null,
      expires_at: doc.expiry_date ? new Date(doc.expiry_date).toISOString() : null,
      issuer: doc.issuer || null,
      storage_ref: doc.uri || null,
      integrity: doc.integrity_hash ? { hash: doc.integrity_hash } : null,
    };
    if (doc.document_id) {
      const result = await apiFetch<any>(`${VERIFICATION_API_URL}/documents/${encodeURIComponent(doc.document_id)}/replace`, { method: "POST", body: JSON.stringify({ ...payload, initial_status: "UPLOADED" }) });
      const saved = mapDocument(result);
      cacheSavedDocument(studentId, saved, doc.document_id);
      return saved;
    }
    const result = await apiFetch<any>(`${VERIFICATION_API_URL}/documents`, { method: "POST", body: JSON.stringify(payload) });
    const saved = mapDocument(result);
    cacheSavedDocument(studentId, saved);
    return saved;
  },

  async syncDigiLocker(): Promise<{ fetched_count: number; synced_count: number; already_linked: number; message: string }> {
    return apiFetch(`${RIJVAN_API_URL}/government/digilocker/documents/sync`, { method: "POST", body: "{}" });
  },
};
