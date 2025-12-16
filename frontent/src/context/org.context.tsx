import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { getUniqueId } from "../utils/getUniqueId";
import CryptoJS from "crypto-js";

interface VisitorData {
  visitorId: string;
  details: OrganizationDetails | null;
  userDetails: UserLead | null;
}

interface OrganizationDetails {
  header_Logo: string;
  header_Name: string;
  bot_Logo: string;
  Welcome_Message: string;
  gdpr: boolean;
  country: string;
  primaryColor: string;
  secondaryColor: string;
  org_id: string;
  branch_id: string;
  region_id: string;
}

interface UserLead {
  visitorId: string;
  name: string;
  email: string;
  mobile: string;
  role: string;
  source: string;
  category: string;
  joined: boolean;
  connected: boolean;
  UserConnectedDetails: {
    org_id: string;
    branch_id: string;
    region_id: string | null;
  };
  navigationHistory: Record<string, unknown>;
  sessionHistory: Record<string, string>;
  phone: string;
}

interface VisitorContextType {
  visitorData: VisitorData;
  isLoading: boolean;
  error: string | null;
}

const VisitorContext = createContext<VisitorContextType | undefined>(undefined);

export function VisitorProvider({ children }: { children: ReactNode }) {
  const [visitorData, setVisitorData] = useState<VisitorData>({
    visitorId: "",
    details: null,
    userDetails: null,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const env = import.meta.env;

  useEffect(() => {
    async function initializeVisitor() {
      try {
        setIsLoading(true);

        // Generate unique visitor ID
        const visitorId = await getUniqueId();

        // Fetch organization details
        const response = await loadMascotColor();
        const details = response as OrganizationDetails;
        if (details) {
          const apiCallUrl = `${env.VITE_SOCKET_PROTOCOL}://${env.VITE_SOCKET_HOST}:${env.VITE_SOCKET_PORT}/${env.VITE_BASEPATH}/user/userLeads?branchId=${details.branch_id}&sender_id=${visitorId}`;
          const userResponse = await fetch(apiCallUrl);
          // const data = await response.json();

          //       const userResponse = await fetch(
          //         `/userdetail?llmfields=${encodeURIComponent(
          //           JSON.stringify(details)
          //         )}&uniqueid=${visitorId}`
          //       );
          const responseDetails = await userResponse.json();
          const userDetails = responseDetails.data;
          setVisitorData({
            visitorId,
            details,
            userDetails,
          });
        }

        setError(null);
      } catch (err) {
        console.error("Error initializing visitor:", err);
        setError(err instanceof Error ? err.message : "Unknown error");

        // Set fallback data
        const visitorId = await getUniqueId();
        setVisitorData({
          visitorId,
          details: null,
          userDetails: null,
        });
      } finally {
        setIsLoading(false);
      }
    }

    initializeVisitor();
  }, []);

  function decryptWithCryptoJS(organization: string): string | null {
    try {
      const bytes = CryptoJS.AES.decrypt(organization, env.VITE_SECRET_KEY);
      return bytes.toString(CryptoJS.enc.Utf8);
    } catch (err) {
      console.error("Decrypt error:", err);
      return null;
    }
  }

  async function botVisibility(
    organization: string,
    usedField: string,
    queryParams: string
  ): Promise<boolean> {
    try {
      const apiCallUrl = `${env.VITE_SOCKET_PROTOCOL}://${env.VITE_SOCKET_HOST}:${env.VITE_SOCKET_PORT}/${env.VITE_BASEPATH}/ui/checkPlatformSettings?organization=${organization}&usedField=${usedField}&queryParams=${queryParams}`;

      const response = await fetch(apiCallUrl, {
        method: "GET",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        credentials: "include",
      });

      const result = await response.json();
      if (!result.data) return false;

      return result.data.active;
    } catch (error) {
      console.error("Error in platform settings>>>>", error);
      return false;
    }
  }

  async function loadMascotColor() {
    const organizationData = env.VITE_ORGANIZATION_DATA;

    if (!organizationData) {
      return { error: "organizationData is required", status: 400 };
    }

    try {
      const decryptedOrgData = decryptWithCryptoJS(organizationData);

      if (!decryptedOrgData) {
        return { error: "Failed to decrypt organization data", status: 400 };
      }

      const parsedOrgData = JSON.parse(decryptedOrgData);
      const org: string = parsedOrgData.client;
      const loc: string | null = parsedOrgData.location || null;
      const reg: string | null = parsedOrgData.region || null;

      const checkSettings = await botVisibility(
        org,
        (loc ?? reg)!,
        loc ? "branchId" : "regionId"
      );

      if (!checkSettings) {
        return { error: "Bot not visible for this organization", status: 403 };
      }

      let apiCallUrl = `${env.VITE_SOCKET_PROTOCOL}://${env.VITE_SOCKET_HOST}:${env.VITE_SOCKET_PORT}/${env.VITE_BASEPATH}/ui/getOrganizationUi?organization=${org}`;

      if (loc) {
        apiCallUrl += `&branch=${loc}`;
      } else if (reg) {
        apiCallUrl += `&region=${reg}`;
      }

      const response = await fetch(apiCallUrl, {
        method: "GET",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        credentials: "include",
      });

      const result = await response.json();

      console.log(result, "result of response whole org data>>>");

      return {
        header_Logo: result.header_Logo,
        header_Name: result.header_Name,
        bot_Logo: result.bot_Logo,
        Welcome_Message: result.Welcome_Message,
        gdpr: result.gdpr,
        country: result.country,
        primaryColor: result.primaryColor,
        secondaryColor: result.secondaryColor,
        org_id: result.org_id,
        branch_id: result.branch_id,
        region_id: result.region_id,
      };
    } catch (error) {
      console.error("Error fetching mascot data:", error);
      return { error: "Internal server error", status: 500 };
    }
  }

  return (
    <VisitorContext.Provider value={{ visitorData, isLoading, error }}>
      {children}
    </VisitorContext.Provider>
  );
}

export function useVisitor() {
  const context = useContext(VisitorContext);
  if (context === undefined) {
    throw new Error("useVisitor must be used within a VisitorProvider");
  }
  return context;
}
