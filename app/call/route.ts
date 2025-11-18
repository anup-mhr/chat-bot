import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const bodyData = await req.json();
  const { organization, branch, sender } = bodyData;
  let apiCallUrl = `${process.env.SOCKET_PROTOCOL}://${process.env.SOCKET_HOST}:${process.env.SOCKET_PORT}/${process.env.BASEPATH}/call/getInitialSettings?organization=${organization}&branch=${branch}`;
  let response = await fetch(apiCallUrl, {
    method: "GET",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
  });

  let responseData = await response.json();
  let availableDays = [];
  for (const key of Object.keys(responseData.details.bookingTimeSlot)) {
    if (responseData.details.bookingTimeSlot[key]?.open) {
      availableDays.push(key);
    }
  }
  responseData.details.availableDays = availableDays;
  console.log(responseData, "response data>>>>");
  let finalApiCallUrl = `${process.env.SOCKET_PROTOCOL}://${process.env.SOCKET_HOST}:${process.env.SOCKET_PORT}/${process.env.BASEPATH}/call/forFinalSettings`;

  let responseFinal = await fetch(finalApiCallUrl, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      clientId: organization,
      locationId: branch,
      timezone: responseData.details.timezone,
      bookingSlots: responseData.details.bookingTimeSlot,
      multipleBooking: responseData.details.multipleBooking,
      slotDuration: responseData.details.slotDuration,
    }),
  });
  let responsefinalJson = await responseFinal.json();
  responseData.details.availableSlots = responsefinalJson;
  responseData.details.sender = sender;
  let promptgetUrl = `${process.env.SOCKET_PROTOCOL}://${process.env.SOCKET_HOST}:${process.env.SOCKET_PORT}/${process.env.BASEPATH}/call/getPrompt`;

  let promptresp = await fetch(promptgetUrl, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      chatbotName: responseData.chatbotName,
      orgName: responseData.orgName,
      timezone: responseData.details.timezone,
      organization: organization,
      prompt: responseData.prompt,
    }),
  });

  let promptRespData = await promptresp.json();
  console.log(promptRespData, "final response in vapi>>>", responseData);

  return NextResponse.json({
    success: true,
    data: { responseData, promptRespData },
  });
}

export async function GET() {
  console.log("GET /call route hit");
}
