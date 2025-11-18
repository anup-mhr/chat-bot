import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const bodyData = await req.json();
    const { name, email } = bodyData;
    console.log(bodyData, "consoling name and email from userDetails");

    const response = await fetch(
      `${process.env.SOCKET_PROTOCOL}://${process.env.SOCKET_HOST}:${process.env.SOCKET_PORT}/${process.env.BASEPATH}/user/userLeads`,
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(bodyData),
      }
    );

    const result = await response.json();

    return NextResponse.json({
      success: true,
      data: result.data.data,
    });
  } catch (error) {
    console.error("Error fetching mascot data:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const llmfields = searchParams.get("llmfields");
    const uniqueid = searchParams.get("uniqueid");
    const llmFieldsObj = llmfields
      ? JSON.parse(decodeURIComponent(llmfields))
      : {};
    const apiCallUrl = `${process.env.SOCKET_PROTOCOL}://${process.env.SOCKET_HOST}:${process.env.SOCKET_PORT}/${process.env.BASEPATH}/user/userLeads?branchId=${llmFieldsObj.branch_id}&sender_id=${uniqueid}`;
    const response = await fetch(apiCallUrl);
    const data = await response.json();
    return NextResponse.json({
      data: data.data,
    });
  } catch (error) {
    console.error("Error fetching mascot data:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
