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

        setVisitorData({
          visitorId,
          details,
        });

        setError(null);
      } catch (err) {
        console.error("Error initializing visitor:", err);
        setError(err instanceof Error ? err.message : "Unknown error");

        // Set fallback data
        const visitorId = await getUniqueId();
        setVisitorData({
          visitorId,
          details: null,
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
