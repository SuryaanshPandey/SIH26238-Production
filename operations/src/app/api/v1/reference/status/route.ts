import { NextRequest } from "next/server";
import { handleApiError, handleApiSuccess } from "@/shared/api/handler";

export async function GET(req: NextRequest) {
  try {
    return handleApiSuccess({
      locations: {
        system: "LGD",
        source_url: "https://lgdirectory.gov.in/",
        states_endpoint: "https://lgdirectory.gov.in/webservices/lgdws/stateList",
        district_endpoint: "https://lgdirectory.gov.in/webservices/lgdws/districtList?stateCode={LGD_STATE_CODE}",
        transport: "POST primary; compatibility POST/GET probes",
      },
      institutions: {
        system: "UGC + AISHE + UBA",
        source_url: "https://www.ugc.gov.in/colleges",
        secondary_source_url: "https://unnatbharatabhiyan.gov.in/rci-details/321",
        scope: "UGC colleges under Section 2(f) & 12(B), AISHE higher-education institution directory data, plus the Ministry of Education/IIT Delhi Unnat Bharat Abhiyan Uttar Pradesh RCI directory as a live government secondary source for Uttar Pradesh.",
      },
      policy: "No synthetic fallback. Upstream reference failures are surfaced as 503 with probe diagnostics.",
    }, req);
  } catch (err) {
    return handleApiError(err, req);
  }
}
