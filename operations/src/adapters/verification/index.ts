import { HttpVerificationClient } from "./HttpVerificationClient";
import { mockVerificationClient } from "./MockVerificationClient";
import { VerificationClient } from "./VerificationClient";

export function getVerificationClient(): VerificationClient {
  return (process.env.VERIFICATION_PROVIDER || "mock").toLowerCase() === "http"
    ? new HttpVerificationClient(process.env.VERIFICATION_SERVICE_URL || "http://127.0.0.1:8000")
    : mockVerificationClient;
}
