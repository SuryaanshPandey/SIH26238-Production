import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { AppError } from "@/shared/errors/AppError";
import { getDocumentClient } from "@/adapters/document";

// DigiLocker production endpoints published in the Authorized Partner API specification.
const DEFAULT_AUTHORIZE_URL = "https://digilocker.meripehchaan.gov.in/public/oauth2/1/authorize";
const DEFAULT_TOKEN_URL = "https://digilocker.meripehchaan.gov.in/public/oauth2/1/token";
const DEFAULT_USER_URL = "https://digilocker.meripehchaan.gov.in/public/oauth2/1/user";
const DEFAULT_ISSUED_DOCUMENTS_URL = "https://digilocker.meripehchaan.gov.in/public/oauth2/2/files/issued";
const DEFAULT_FETCH_TIMEOUT_MS = 15000;

function secretKey(): Buffer {
  const secret = process.env.JWT_SECRET || "sih26238-local-secret-change-me";
  return crypto.createHash("sha256").update(secret).digest();
}

function b64(value: Buffer): string {
  return value.toString("base64url");
}

function unb64(value: string): Buffer {
  return Buffer.from(value, "base64url");
}

function encrypt(value: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", secretKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${b64(iv)}.${b64(tag)}.${b64(ciphertext)}`;
}

function decrypt(value: string): string {
  const [ivRaw, tagRaw, ciphertextRaw] = value.split(".");
  if (!ivRaw || !tagRaw || !ciphertextRaw) throw new Error("Encrypted token is malformed.");
  const decipher = crypto.createDecipheriv("aes-256-gcm", secretKey(), ivRaw ? unb64(ivRaw) : Buffer.alloc(0));
  decipher.setAuthTag(unb64(tagRaw));
  return Buffer.concat([decipher.update(unb64(ciphertextRaw)), decipher.final()]).toString("utf8");
}

function randomVerifier(): string {
  return b64(crypto.randomBytes(48));
}

function codeChallenge(verifier: string): string {
  return b64(crypto.createHash("sha256").update(verifier).digest());
}

function maskId(id: string): string {
  const compact = id.replace(/\s+/g, "");
  return compact.length <= 8 ? `DL-${compact}` : `DL-****${compact.slice(-4)}`;
}

function normalizeDob(value: unknown): string | null {
  const digits = String(value || "").replace(/\D/g, "");
  if (!/^\d{8}$/.test(digits)) return null;
  return `${digits.slice(4, 8)}-${digits.slice(2, 4)}-${digits.slice(0, 2)}`;
}

function normalizeGender(value: unknown): string | null {
  const v = String(value || "").toUpperCase();
  if (v === "M") return "MALE";
  if (v === "F") return "FEMALE";
  if (v === "T") return "OTHER";
  return null;
}

function oauthConfigured(): boolean {
  return Boolean(
    process.env.DIGILOCKER_OAUTH_CLIENT_ID &&
    process.env.DIGILOCKER_OAUTH_CLIENT_SECRET &&
    process.env.DIGILOCKER_OAUTH_REDIRECT_URI
  );
}

function timeoutMs(): number {
  const parsed = Number(process.env.DIGILOCKER_FETCH_TIMEOUT_MS || DEFAULT_FETCH_TIMEOUT_MS);
  return Number.isFinite(parsed) && parsed >= 3000 ? parsed : DEFAULT_FETCH_TIMEOUT_MS;
}

function errorMessage(body: any, fallback: string): string {
  return String(body?.error_description || body?.error || body?.message || fallback);
}

function basicAuthHeader(): string {
  const id = String(process.env.DIGILOCKER_OAUTH_CLIENT_ID || "");
  const secret = String(process.env.DIGILOCKER_OAUTH_CLIENT_SECRET || "");
  return `Basic ${Buffer.from(`${id}:${secret}`, "utf8").toString("base64")}`;
}

async function fetchWithTimeout(url: string, init: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs());
  try {
    return await fetch(url, { ...init, signal: controller.signal, cache: "no-store" });
  } catch (error) {
    if (controller.signal.aborted) {
      throw new AppError("UPSTREAM_UNAVAILABLE", "DigiLocker request timed out. Please retry.", 503);
    }
    throw new AppError(
      "UPSTREAM_UNAVAILABLE",
      error instanceof Error ? `Unable to reach DigiLocker: ${error.message}` : "Unable to reach DigiLocker.",
      503,
    );
  } finally {
    clearTimeout(timeout);
  }
}

interface OAuthState {
  studentId: string;
  codeVerifier: string;
  nonce: string;
  expiresAt: number;
}

interface IssuedDocument {
  name: string;
  uri: string;
  doctype?: string;
  description?: string;
  issuerid?: string;
  issuer?: string;
  date?: string;
  mime?: unknown;
  size?: string | number;
}

function normalizeDocumentType(item: IssuedDocument): string {
  const value = `${item.description || ""} ${item.name || ""} ${item.doctype || ""}`.toUpperCase();
  if (/INCOME|INCER/.test(value)) return "INCOME_CERTIFICATE";
  if (/CASTE|CASTER|SC\/ST|CATEGORY/.test(value)) return "CASTE_CERTIFICATE";
  if (/DOMICILE|RESIDENCE|NATIVITY/.test(value)) return "DOMICILE_CERTIFICATE";
  if (/AADHAAR/.test(value)) return "AADHAAR_CARD";
  if (/MARKSHEET|MARK SHEET|HSCER|SSCER|RESULT|CERTIFICATE OF SECONDARY|SECONDARY SCHOOL/.test(value)) return "MARKSHEET";
  if (/FEE|TUITION/.test(value)) return "FEE_RECEIPT";
  if (/BONAFIDE/.test(value)) return "BONAFIDE_CERTIFICATE";
  if (/HOSTEL/.test(value)) return "HOSTEL_CERTIFICATE";
  if (/ADMISSION|ENROL(L)?MENT/.test(value)) return "ADMISSION_PROOF";
  if (/BANK|PASSBOOK/.test(value)) return "BANK_PASSBOOK";
  return "OTHER";
}

function parseIssuedDate(value: unknown): string | null {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function safeHash(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function uniqueNonEmpty(values: unknown[]): string[] {
  return Array.from(new Set(values.map((v) => String(v || "").trim()).filter(Boolean)));
}

export class DigiLockerService {
  isConfigured(): boolean {
    return oauthConfigured();
  }

  getConfigurationStatus() {
    const missing_configuration: string[] = [];
    if (!process.env.DIGILOCKER_OAUTH_CLIENT_ID) missing_configuration.push("DIGILOCKER_OAUTH_CLIENT_ID");
    if (!process.env.DIGILOCKER_OAUTH_CLIENT_SECRET) missing_configuration.push("DIGILOCKER_OAUTH_CLIENT_SECRET");
    if (!process.env.DIGILOCKER_OAUTH_REDIRECT_URI) missing_configuration.push("DIGILOCKER_OAUTH_REDIRECT_URI");
    return {
      configured: missing_configuration.length === 0,
      missing_configuration,
      authorize_url: process.env.DIGILOCKER_OAUTH_AUTHORIZE_URL || DEFAULT_AUTHORIZE_URL,
      callback_configured: Boolean(process.env.DIGILOCKER_OAUTH_REDIRECT_URI),
      redirect_uri_registered: process.env.DIGILOCKER_OAUTH_REDIRECT_URI || null,
      issued_documents_url: process.env.DIGILOCKER_ISSUED_DOCUMENTS_URL || DEFAULT_ISSUED_DOCUMENTS_URL,
    };
  }

  async start(studentId: string): Promise<{ authorization_url: string; state_expires_in: number }> {
    if (!oauthConfigured()) {
      throw new AppError(
        "SOURCE_UNAVAILABLE",
        "DigiLocker authorization is not configured. Official partner client credentials and redirect URI are required.",
        503,
      );
    }
    const verifier = randomVerifier();
    const state: OAuthState = {
      studentId,
      codeVerifier: verifier,
      nonce: b64(crypto.randomBytes(18)),
      expiresAt: Date.now() + 10 * 60 * 1000,
    };
    const stateToken = encrypt(JSON.stringify(state));
    const url = new URL(process.env.DIGILOCKER_OAUTH_AUTHORIZE_URL || DEFAULT_AUTHORIZE_URL);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", String(process.env.DIGILOCKER_OAUTH_CLIENT_ID));
    url.searchParams.set("redirect_uri", String(process.env.DIGILOCKER_OAUTH_REDIRECT_URI));
    url.searchParams.set("state", stateToken);
    url.searchParams.set("code_challenge", codeChallenge(verifier));
    url.searchParams.set("code_challenge_method", "S256");
    return { authorization_url: url.toString(), state_expires_in: 600 };
  }

  private async exchangeAuthorizationCode(code: string, state: OAuthState) {
    const tokenResponse = await fetchWithTimeout(process.env.DIGILOCKER_OAUTH_TOKEN_URL || DEFAULT_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
        Authorization: basicAuthHeader(),
      },
      body: new URLSearchParams({
        code,
        grant_type: "authorization_code",
        redirect_uri: String(process.env.DIGILOCKER_OAUTH_REDIRECT_URI),
        code_verifier: state.codeVerifier,
      }).toString(),
    });
    const tokenBody = await tokenResponse.json().catch(() => ({}));
    if (!tokenResponse.ok || !tokenBody.access_token) {
      throw new AppError("SOURCE_UNAVAILABLE", errorMessage(tokenBody, `DigiLocker token request failed with HTTP ${tokenResponse.status}.`), 503);
    }
    return tokenBody;
  }

  private async refreshAccessToken(student: any): Promise<string> {
    if (!student.digilockerRefreshTokenEncrypted) {
      throw new AppError("SOURCE_UNAVAILABLE", "DigiLocker access has expired. Re-authorize the connection.", 503);
    }
    const refreshToken = decrypt(student.digilockerRefreshTokenEncrypted);
    const response = await fetchWithTimeout(process.env.DIGILOCKER_OAUTH_TOKEN_URL || DEFAULT_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
        Authorization: basicAuthHeader(),
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }).toString(),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || !body.access_token) {
      throw new AppError("SOURCE_UNAVAILABLE", "DigiLocker access token could not be refreshed. Re-authorize the connection.", 503);
    }
    const accessToken = String(body.access_token);
    const expiresAt = new Date(Date.now() + Number(body.expires_in || 3600) * 1000);
    await prisma.studentAccount.update({
      where: { studentId: student.studentId },
      data: {
        digilockerAccessTokenEncrypted: encrypt(accessToken),
        digilockerRefreshTokenEncrypted: body.refresh_token ? encrypt(String(body.refresh_token)) : student.digilockerRefreshTokenEncrypted,
        digilockerTokenExpiresAt: expiresAt,
      },
    });
    return accessToken;
  }

  private async getActiveAccessToken(studentId: string): Promise<{ token: string; student: any }> {
    const student = await prisma.studentAccount.findUnique({ where: { studentId } });
    if (!student) throw AppError.notFound("Student", studentId);
    if (!student.digilockerAccessTokenEncrypted) {
      throw new AppError("SOURCE_UNAVAILABLE", "DigiLocker is not connected for this student. Authorize DigiLocker from the profile first.", 503);
    }
    let token = decrypt(student.digilockerAccessTokenEncrypted);
    if ((student.digilockerTokenExpiresAt?.getTime() || 0) <= Date.now() + 30_000) {
      token = await this.refreshAccessToken(student);
    }
    return { token, student };
  }

  async callback(code: string, stateToken: string): Promise<{ studentId: string; digilockerId: string }> {
    if (!oauthConfigured()) throw new AppError("SOURCE_UNAVAILABLE", "DigiLocker authorization is not configured.", 503);
    let state: OAuthState;
    try {
      state = JSON.parse(decrypt(stateToken)) as OAuthState;
    } catch {
      throw new AppError("INVALID_STATE", "The DigiLocker authorization state is invalid or expired.", 400);
    }
    if (!state.studentId || !state.codeVerifier || !state.expiresAt || Date.now() > state.expiresAt) {
      throw new AppError("INVALID_STATE", "The DigiLocker authorization state is invalid or expired.", 400);
    }

    const tokenBody = await this.exchangeAuthorizationCode(code, state);
    let profile = {
      digilockerid: tokenBody.digilockerid,
      name: tokenBody.name,
      dob: tokenBody.dob,
      gender: tokenBody.gender,
      reference_key: tokenBody.reference_key,
    };

    if (!profile.digilockerid || !profile.name || !profile.dob) {
      const response = await fetchWithTimeout(process.env.DIGILOCKER_USER_URL || DEFAULT_USER_URL, {
        headers: { Accept: "application/json", Authorization: `Bearer ${tokenBody.access_token}` },
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body.digilockerid) {
        throw new AppError("SOURCE_UNAVAILABLE", errorMessage(body, `DigiLocker user profile failed with HTTP ${response.status}.`), 503);
      }
      profile = body;
    }

    await prisma.studentAccount.update({
      where: { studentId: state.studentId },
      data: {
        digilockerIdMasked: maskId(String(profile.digilockerid)),
        digilockerAccessTokenEncrypted: encrypt(String(tokenBody.access_token)),
        digilockerRefreshTokenEncrypted: tokenBody.refresh_token ? encrypt(String(tokenBody.refresh_token)) : null,
        digilockerTokenExpiresAt: new Date(Date.now() + Number(tokenBody.expires_in || 3600) * 1000),
        digilockerReferenceKey: profile.reference_key ? String(profile.reference_key) : null,
        digilockerConnectedAt: new Date(),
      },
    });

    return { studentId: state.studentId, digilockerId: String(profile.digilockerid) };
  }

  async getSourceRecord(studentId: string, query: { consentId?: string | null }) {
    if (!query.consentId) {
      throw new AppError("CONSENT_REQUIRED", "A granted verification consent ID is required before accessing DigiLocker data.", 403);
    }
    const { token: accessToken, student } = await this.getActiveAccessToken(studentId);
    let response = await fetchWithTimeout(process.env.DIGILOCKER_USER_URL || DEFAULT_USER_URL, {
      headers: { Accept: "application/json", Authorization: `Bearer ${accessToken}` },
    });
    if (response.status === 401 && student.digilockerRefreshTokenEncrypted) {
      const refreshed = await this.refreshAccessToken(student);
      response = await fetchWithTimeout(process.env.DIGILOCKER_USER_URL || DEFAULT_USER_URL, {
        headers: { Accept: "application/json", Authorization: `Bearer ${refreshed}` },
      });
    }
    const body = await response.json().catch(() => ({}));
    if (!response.ok || !body.digilockerid) {
      throw new AppError("SOURCE_UNAVAILABLE", errorMessage(body, `DigiLocker user profile returned HTTP ${response.status}.`), 503);
    }

    const attrs: Record<string, unknown> = {
      full_name: body.name,
      date_of_birth: normalizeDob(body.dob),
      identity_status: "CONNECTED",
      digilocker_id_masked: maskId(String(body.digilockerid)),
    };
    const gender = normalizeGender(body.gender);
    if (gender) attrs.gender = gender;

    return {
      source_system: "DIGILOCKER",
      source_reference: `digilocker:${String(body.digilockerid)}`,
      status: "FOUND",
      subject_id: String(body.digilockerid),
      attributes: attrs,
      retrieved_at: new Date().toISOString(),
      response_hash: crypto.createHash("sha256").update(JSON.stringify(attrs)).digest("hex"),
      metadata: {
        provider: "DigiLocker",
        adapter_mode: "OFFICIAL_OAUTH",
        authorization_reference: student.digilockerReferenceKey || "NOT_PROVIDED",
        consent_id: String(query.consentId),
      },
    };
  }

  async getIssuedDocuments(studentId: string): Promise<IssuedDocument[]> {
    const { token: initialToken, student } = await this.getActiveAccessToken(studentId);
    const url = process.env.DIGILOCKER_ISSUED_DOCUMENTS_URL || DEFAULT_ISSUED_DOCUMENTS_URL;
    let token = initialToken;
    let response = await fetchWithTimeout(url, {
      headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
    });
    if (response.status === 401 && student.digilockerRefreshTokenEncrypted) {
      token = await this.refreshAccessToken(student);
      response = await fetchWithTimeout(url, {
        headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
      });
    }
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new AppError("SOURCE_UNAVAILABLE", errorMessage(body, `DigiLocker issued-document request failed with HTTP ${response.status}.`), 503);
    }
    const items = Array.isArray(body?.items)
      ? body.items
      : Array.isArray(body?.data?.items)
        ? body.data.items
        : [];
    return items
      .filter((item: any) => String(item?.type || "file").toLowerCase() === "file" && String(item?.uri || "").trim())
      .map((item: any) => ({
        name: String(item.name || item.description || "DigiLocker document"),
        uri: String(item.uri).trim(),
        doctype: item.doctype ? String(item.doctype) : undefined,
        description: item.description ? String(item.description) : undefined,
        issuerid: item.issuerid ? String(item.issuerid) : undefined,
        issuer: item.issuer ? String(item.issuer) : undefined,
        date: item.date ? String(item.date) : undefined,
        mime: item.mime,
        size: item.size,
      }));
  }

  async syncIssuedDocuments(studentId: string) {
    const client = getDocumentClient();
    if (!client.createDocument) {
      throw new AppError("UPSTREAM_UNAVAILABLE", "The document service is not writable, so DigiLocker documents cannot be linked.", 503);
    }

    let issued: IssuedDocument[];
    try {
      issued = await this.getIssuedDocuments(studentId);
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError("UPSTREAM_UNAVAILABLE", "The DigiLocker document list could not be fetched.", 503);
    }

    let existing: any[] = [];
    try {
      existing = await client.getDocumentsByStudentId(studentId);
    } catch (error) {
      throw new AppError(
        "UPSTREAM_UNAVAILABLE",
        error instanceof Error ? `The document wallet could not be read: ${error.message}` : "The document wallet could not be read.",
        503,
      );
    }

    const existingRefs = new Set(
      existing.flatMap((doc: any) =>
        uniqueNonEmpty([doc.storage_ref, doc.document_ref, doc.uri]).map((ref) =>
          ref.replace(/^digilocker:\/+/, "").trim(),
        ),
      ),
    );

    let linked = 0;
    let alreadyLinked = 0;
    const errors: string[] = [];

    for (const item of issued) {
      if (existingRefs.has(item.uri)) {
        alreadyLinked += 1;
        continue;
      }

      const storageRef = `digilocker://${item.uri}`;
      const applicationId = `DIGILOCKER_${safeHash(item.uri).slice(0, 16)}`;
      const issueDate = parseIssuedDate(item.date);
      const integrityHash = safeHash(JSON.stringify({
        uri: item.uri,
        name: item.name,
        issuerid: item.issuerid,
        issuer: item.issuer,
        description: item.description,
        date: item.date,
      }));

      try {
        await client.createDocument({
          student_id: studentId,
          application_id: applicationId,
          document_type: normalizeDocumentType(item),
          source: "DIGITAL_SOURCE",
          status: "AVAILABLE",
          issued_at: issueDate,
          issuer: item.issuer || item.issuerid || "DigiLocker issuer",
          storage_ref: storageRef,
          integrity: { hash: integrityHash },
        });
        existingRefs.add(item.uri);
        linked += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown document-linking error";
        if (/409|conflict|already exists/i.test(message)) {
          alreadyLinked += 1;
          existingRefs.add(item.uri);
        } else {
          errors.push(`${item.name}: ${message}`);
        }
      }
    }

    if (errors.length) {
      throw new AppError(
        "UPSTREAM_UNAVAILABLE",
        `DigiLocker returned ${issued.length} issued document(s), but ${errors.length} could not be linked. ${errors.slice(0, 2).join(" ")}` ,
        503,
        { issued_count: issued.length, linked_count: linked, already_linked: alreadyLinked, errors },
      );
    }

    return {
      fetched_count: issued.length,
      synced_count: linked,
      already_linked: alreadyLinked,
      message:
        issued.length === 0
          ? "DigiLocker is connected, but no issued documents were returned for this account."
          : linked > 0
            ? `Linked ${linked} new DigiLocker document${linked === 1 ? "" : "s"} to your wallet.`
            : "Your DigiLocker documents are already linked to the wallet.",
    };
  }

  async connectionStatus(studentId: string) {
    const student = await prisma.studentAccount.findUnique({
      where: { studentId },
      select: { digilockerIdMasked: true, digilockerConnectedAt: true },
    });
    if (!student) throw AppError.notFound("Student", studentId);
    return {
      ...this.getConfigurationStatus(),
      connected: Boolean(student.digilockerIdMasked && student.digilockerConnectedAt),
      digilocker_id_masked: student.digilockerIdMasked || null,
      connected_at: student.digilockerConnectedAt?.toISOString() || null,
    };
  }

  async disconnect(studentId: string) {
    await prisma.studentAccount.update({
      where: { studentId },
      data: {
        digilockerIdMasked: null,
        digilockerAccessTokenEncrypted: null,
        digilockerRefreshTokenEncrypted: null,
        digilockerTokenExpiresAt: null,
        digilockerReferenceKey: null,
        digilockerConnectedAt: null,
      },
    });
  }
}

export const digiLockerService = new DigiLockerService();
