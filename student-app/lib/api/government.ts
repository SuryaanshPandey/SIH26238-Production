import { RIJVAN_API_URL } from "../config";
import { apiFetch } from "./http";

export interface DigiLockerStatus {
  configured: boolean;
  missing_configuration: string[];
  authorize_url: string;
  callback_configured: boolean;
  redirect_uri_registered: string | null;
  issued_documents_url: string;
  connected: boolean;
  digilocker_id_masked: string | null;
  connected_at: string | null;
}

export interface DigiLockerSyncResult {
  fetched_count: number;
  synced_count: number;
  already_linked: number;
  message: string;
}

export const governmentApi = {
  async getDigiLockerStatus(): Promise<DigiLockerStatus> {
    return apiFetch<DigiLockerStatus>(`${RIJVAN_API_URL}/government/digilocker/status`);
  },

  async startDigiLocker(): Promise<{ authorization_url: string; state_expires_in: number }> {
    return apiFetch(`${RIJVAN_API_URL}/government/digilocker/start`, { method: "POST", body: "{}" });
  },

  async disconnectDigiLocker(): Promise<void> {
    await apiFetch(`${RIJVAN_API_URL}/government/digilocker/disconnect`, { method: "POST", body: "{}" });
  },

  async syncDigiLockerDocuments(): Promise<DigiLockerSyncResult> {
    return apiFetch<DigiLockerSyncResult>(`${RIJVAN_API_URL}/government/digilocker/documents/sync`, {
      method: "POST",
      body: "{}",
    });
  },
};
