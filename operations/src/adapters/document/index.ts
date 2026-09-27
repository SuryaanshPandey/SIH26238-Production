import { HttpDocumentClient } from "./HttpDocumentClient";
import { mockDocumentClient } from "./MockDocumentClient";
import { DocumentClient } from "./DocumentClient";

export function getDocumentClient(): DocumentClient {
  return (process.env.DOCUMENT_PROVIDER || "mock").toLowerCase() === "http"
    ? new HttpDocumentClient(process.env.DOCUMENT_SERVICE_URL || "http://127.0.0.1:8000")
    : mockDocumentClient;
}
