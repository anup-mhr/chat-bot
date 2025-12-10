import { v1 as uuidv1 } from "uuid";
import { ClientJS } from "./client";
import { cookie } from "./cookie";
import { isUuid } from "./validator";

const cookieExpire = { days: 365 }; // example: 1 year

export async function getUniqueId(): Promise<string> {
  // Ensure it only runs in the browser
  if (typeof window === "undefined") {
    return "server"; // SSR-safe fallback
  }

  const search = window.location.search;
  const urlp = new URLSearchParams(search);
  const isForTest = urlp.has("isForTestAgent")
    ? urlp.get("isForTestAgent")
    : null;

  console.log(isForTest, "iftesttt>>>");

  if (isForTest) {
    const uniqueID = `${uuidv1()}_${Date.now()}`;
    cookie.setCookie("uniqueID", uniqueID, cookieExpire);
    return uniqueID;
  }

  const client = new ClientJS();
  const isCookie = client.isCookie();

  const existingUniqueID = cookie.getCookie("uniqueID");
  console.log("old id>", existingUniqueID);

  if (!existingUniqueID || !isUuid(existingUniqueID.split("_")[0])) {
    const uuid = uuidv1();
    const timestamp = Date.now();
    const newUniqueID = `${uuid}_${timestamp}`;

    if (isCookie) {
      cookie.setCookie("uniqueID", newUniqueID, cookieExpire);
    }

    console.log("new id>", newUniqueID);
    return newUniqueID;
  }

  if (existingUniqueID.split("_").length < 2 && isUuid(existingUniqueID)) {
    console.log("old id no timestamp", existingUniqueID);
    const timestamp = Date.now();
    const newUniqueID = `${existingUniqueID}_${timestamp}`;

    if (isCookie) {
      cookie.setCookie("uniqueID", newUniqueID, cookieExpire);
    }

    console.log("new id timestamp", newUniqueID);
    return newUniqueID;
  }

  console.log("already unique id", existingUniqueID);
  return existingUniqueID;
}
