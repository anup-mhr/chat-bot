"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { getUniqueId } from "@/utils/getUniqueId";

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
  _id: string;
  branch: string;
  city: string | null;
  confirmation_sent_date: string | null;
  created_date: string;
  dob: string | null;
  email: string;
  event_id: string | null;
  first_name: string;
  gender: string | null;
  interested_in: string;
  last_name: string;
  note: string;
  organization_id: string;
  phone: string;
  referred_by: string | null;
  sender: string;
  source_group: string;
  state: string | null;
  type: string;
  updated_date: string;
  use_automation: boolean;
  venue_id: string | null;
  zip: string | null;
  __v: number;
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

  useEffect(() => {
    async function initializeVisitor() {
      try {
        setIsLoading(true);

        // Generate unique visitor ID
        const visitorId = await getUniqueId();

        // Fetch organization details
        const response = await fetch("/organization");
        if (!response.ok) {
          throw new Error("Failed to fetch organization details");
        }

        const details = await response.json();
        if (details) {
          const userResponse = await fetch(
            `/userdetail?llmfields=${encodeURIComponent(
              JSON.stringify(details)
            )}&uniqueid=${visitorId}`
          );
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
