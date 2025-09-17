import { NextResponse } from "next/server";
import CryptoJS from "crypto-js";

function decryptWithCryptoJS(organization: string): string | null {
  try {
    const bytes = CryptoJS.AES.decrypt(organization, process.env.SECRET_KEY);
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
    const apiCallUrl = `${process.env.SOCKET_PROTOCOL}://${process.env.SOCKET_HOST}:${process.env.SOCKET_PORT}/${process.env.BASEPATH}/ui/checkPlatformSettings?organization=${organization}&usedField=${usedField}&queryParams=${queryParams}`;

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

export async function GET(req: Request) {
  const organizationData = process.env.ORGANIZATION_DATA;

  if (!organizationData) {
    return NextResponse.json(
      { error: "organizationData is required" },
      { status: 400 }
    );
  }

  try {
    const decryptedOrgData = decryptWithCryptoJS(organizationData);

    if (!decryptedOrgData) {
      return NextResponse.json(
        { error: "Failed to decrypt organization data" },
        { status: 400 }
      );
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
      return NextResponse.json(
        { error: "Bot not visible for this organization" },
        { status: 403 }
      );
    }

    let apiCallUrl = `${process.env.SOCKET_PROTOCOL}://${process.env.SOCKET_HOST}:${process.env.SOCKET_PORT}/${process.env.BASEPATH}/ui/getOrganizationUi?organization=${org}`;

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

    return NextResponse.json({
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
    });
  } catch (error) {
    console.error("Error fetching mascot data:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
