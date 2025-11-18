const fetch = require("node-fetch");

exports.postToServer = async (url, body, headers) => {
  return await fetch(url, {
    method: "POST",
    headers: headers,
    body: JSON.stringify(body),
  });
};

exports.newPostToServer = async (url, body, headers) => {
  const res = await fetch(url, {
    method: "POST",
    headers: headers,
    body: JSON.stringify(body),
  });

  return await res.json();
};

exports.getFromServer = async (url, headers) => {
  return await fetch(url, {
    method: "GET",
    headers: headers,
  });
};

exports.httpService = async (
  url = "",
  headers = {},
  method = "GET",
  body = {},
  Default = null
) => {
  // console.log("htttp url:",url);
  // console.log("http headers",headers);
  if (!method) {
    throw new Error("Method is not defined");
  }
  if (!url) {
    throw new Error("Url is not defined");
  }
  if (!headers) {
    throw new Error("Headers is not defined");
  }
  let fetchParams = {};
  if (!Default) {
    fetchParams = {
      method: method,
      headers: headers,
    };
  }
  if (Default) {
    fetchParams = {
      method: method,
      headers: headers,
    };
  }

  if (method === "POST" || method === "PATCH") {
    fetchParams["body"] = JSON.stringify(body);
  }
  return await fetch(url, {
    ...fetchParams,
  });
};
