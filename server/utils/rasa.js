const ServerServices = require("../services/server.services");
const { interveneRasa: interveneRasaFb } = require("../bot/facebook.bot");
const { client } = require("./redis");
const { postMessage } = require("../services/message.service");

const sourceMap = {
  web: "rest",
  fb: "facebook",
  instagram: "instagram",
  whatsapp: "whatsapp",
  viber: "viber",
};

class RasaAPI {
  constructor({ host, port, protocol }) {
    this.responseServerDown = {
      type: "rasaServerDown",
      text: `Oops! Something went wrong in our response server.`,
    };
    this.previousUtter = null;
    this.type = process.env.RASA_METADATA_TYPE;
    // console.log(utterURL)
    this.baseUrl = protocol + "://" + host + ":" + port;
    // this.baseUrl='https://61db-111-119-49-134.ngrok-free.app'
  }

  async checkRasaFormStatus(sender = null, headers = {}, payload) {
    let url = `${this.baseUrl}/conversations/${sender}/tracker`;
    try {
      if (!sender || payload.startsWith("/")) {
        throw new Error("No sender");
      }
      const res = await ServerServices.getFromServer(url, headers);
      let responseData = await res.json();
      if (responseData && Object.keys(responseData?.active_loop).length > 0) {
        return true;
      } else {
        return false;
      }
    } catch (err) {
      console.log(err);
      return true;
    }
  }

  serverMetadata(receipent = this._user) {
    return { time: Date.now(), sender: "server", source: this._source, receipent };
  }

  async getIntentRequest(payload, metadata, isLiveAgentActive = false, llmfields) {
    console.log(isLiveAgentActive, "isLiveAgentActive from getIntentRequest", llmfields);
    const source = metadata?.source || "web";
    const sender = metadata?.sender;
    console.log(sender, "sender::>>>>", "payload: ", payload, "metadata: ", metadata);
    const url = this.baseUrl + `/webhooks/${sourceMap[source]}/webhook`;

    const fbPayloadIntervened = (source === "fb" || source === "instagram") && interveneRasaFb(payload);
    if (fbPayloadIntervened) {
      return fbPayloadIntervened;
    }

    const headers = { "Content-Type": "application/json" };
    // console.log("app.js 370",url)
    const body = {
      sender,
      message: payload,
      metadata: {
        ...metadata,
        type: this.type,
        liveagent: isLiveAgentActive,
      },
    };
    let responseData = [];
    console.log(body);

    try {
      let isFormActivated = false; //await this.checkRasaFormStatus(sender, headers, payload);
      body["metadata"]["isFormActivated"] = isFormActivated;
      if (isFormActivated) {
        const response = await ServerServices.postToServer(url, body, headers);
        // console.log("app.js 378",await response.text())
        responseData = await response.json();
        console.log(JSON.stringify(responseData), "response from rasa>>>>");
      } else {
        console.log(metadata, "metadata just  above  callopenAI>>>");
        responseData = await this.callOpenAi(payload, headers, sender, source, metadata, isLiveAgentActive, llmfields);

        console.log(JSON.stringify(responseData), "Open AI response>>>>>>", sender);
        //ceck is response for agent check

        if (responseData && responseData.hasOwnProperty("call_rasa")) {
          console.log(responseData, ">>>>>>");
          body["message"] = responseData.call_rasa.payload;
          if (responseData.call_rasa.hasOwnProperty("metadata")) {
            body["metadata"] = { ...metadata, ...responseData.call_rasa.metadata };
          }
          const response = await ServerServices.postToServer(url, body, headers);
          let responseDataAPI = await response.json();
          console.log(responseData, "responseData:::::::::");
          if (responseData && responseData.text) {
            responseDataAPI = responseDataAPI || [];
            responseDataAPI.unshift({ text: responseData.text });
          }
          responseData = responseDataAPI;
        }
      }
      return source !== "web"
        ? responseData
        : Array.isArray(responseData)
        ? responseData.map((data) => this.responseData(data))
        : this.responseData(responseData);
    } catch (err) {
      console.log("ERROR IN GET INTENT REQUEST =>", err);
      return source !== "web" ? rasaServerDown : this.responseServerDown;
    }
  }

  async callOpenAi(payload, headers, sender, source, metadata, isLiveAgentActive, llmfields) {
    console.log(metadata, "metadata just  above  callopenAI>>>", llmfields, payload);
    let payloadData = encodeURIComponent(payload);
    let openAi;
    const personalInfo = encodeURIComponent(
      JSON.stringify({
        user_name: metadata.name || null,
        phone_number: metadata.phoneNumber || null,
        agent_id: metadata.agentId || null,
        email: metadata.email || null,
      })
    );
    const subMetadata = encodeURIComponent(
      JSON.stringify({
        org_id: llmfields?.organization_id,
        branch_id: llmfields?.branch,
      })
    );

    console.log(payload, headers, sender, source, metadata, isLiveAgentActive, "all from callopenAI>>>");
    if (payload.latitude && payload.longitude) {
      let latitude = payload.latitude;
      let longitude = payload.longitude;
      openAi = `${process.env.OpenUrl}/lifeInsurance?query=${payload.data_type}&sender=${sender}&source=${source}&latitude=${latitude}&longitude=${longitude}&type=${this.type}&personal_info=${personalInfo}&liveagent=${isLiveAgentActive}&metadata=${subMetadata}`;
    } else {
      openAi = `${process.env.OpenUrl}/lifeInsurance/?query=${payloadData}&sender=${sender}&source=${source}&type=${this.type}&personal_info=${personalInfo}&liveagent=${isLiveAgentActive}&metadata=${subMetadata}`; //
    }
    console.log(openAi, "openaiurllll>>>>>");
    const response = await ServerServices.getFromServer(openAi, headers);
    let responseData = await response.json();
    console.log(responseData, "reponse from openurl>>>");
    if (
      (responseData?.result?.text?.userDetails ||
        responseData?.result?.userDetails ||
        responseData?.text?.userDetails ||
        responseData?.userDetails ||
        responseData?.details) &&
      !metadata.name &&
      !metadata.phoneNumber &&
      !metadata.email
    ) {
      const USER_REDIS_KEY = `${process.env.ORGANIZATION_ID}:users`;
      let user =
        responseData?.result?.text?.userDetails ||
        responseData?.result?.userDetails ||
        responseData?.text?.userDetails ||
        responseData?.userDetails ||
        responseData?.details ||
        {};
      let jsondata = {
        ...(user.name && { name: user.name }),
        ...(user.email && { email: user.email }),
        ...(user.phone && { mobile: user.phone }),
      };

      await client.hset(USER_REDIS_KEY, sender, jsondata, ["navigationHistory"]);
    }

    if (responseData?.result?.text?.custom || responseData?.result?.[0]?.custom || responseData?.result?.custom) {
      responseData = [
        {
          custom: responseData?.result?.text?.custom || responseData?.result[0]?.custom || responseData?.result?.custom,
        },
      ];
    }

    let responseToPost = {};
    let objResponse = Array.isArray(responseData) ? responseData[0] : responseData;
    if (objResponse.custom) {
      const postMessageData = objResponse.custom.sendLatLong ? { title: "sendLatLong" } : objResponse.custom;

      const messageText =
        postMessageData?.title ||
        postMessageData.subtitle ||
        postMessageData.text ||
        postMessageData.bodyText ||
        postMessageData.message ||
        postMessageData.type ||
        postMessageData.Text ||
        postMessageData.Type ||
        JSON.stringify(normalizedResponse);

      responseToPost = {
        message: messageText,
        responseMessage: { message: messageText },
      };
    } else if (
      (objResponse.text && !objResponse.buttons) ||
      (objResponse.result && !objResponse.buttons) ||
      (objResponse.text?.text && !objResponse.buttons) ||
      (objResponse.message && !objResponse.buttons)
    ) {
      const messageText =
        objResponse.message ||
        objResponse.text?.text ||
        objResponse.text ||
        objResponse.result.text ||
        objResponse.result;

      responseToPost = {
        message: messageText,
        responseMessage: { message: messageText },
      };
    }

    responseToPost?.message &&
      postMessage(
        responseToPost.message,
        undefined,
        { ...this.serverMetadata(sender), payload: response },
        sender,
        source === "fb" ? "fbBot" : source === "instagram" ? "instagramBot" : "bot",
        sender,
        llmfields,
        metadata
      );

    return responseData[0]?.custom
      ? responseData
      : responseData.result.text?.text
      ? responseData.result.text
      : responseData.result?.text
      ? responseData.result
      : responseData.result
      ? { text: responseData.result }
      : "";
  }

  responseData(data) {
    console.log(data, "data in responseData>>>>");
    if (data.hasOwnProperty("text") && data.hasOwnProperty("buttons")) {
      const quickReplies = {
        title: data.text,
        type: "quick_reply",
        data: data.buttons,
        prevUtter: this.previousUtter,
      };
      return {
        responseMessage: quickReplies,
        message: data.text,
        visitorData: data.userDetails,
      };
    }
    if (data.hasOwnProperty("text") && !data.hasOwnProperty("buttons")) {
      console.log(data, "data in text only>>>>");
      let response = { message: data.text };
      if (data.text.length < 50) {
        response["responseMessage"] = { message: data.text, prevUtter: false };
      } else {
        response["responseMessage"] = { message: data.text };
      }
      if (data.userDetails) {
        response["visitorData"] = data.userDetails;
      }

      return response;
    }
    if (data.hasOwnProperty("custom")) {
      let custom = data.custom;
      if (custom.hasOwnProperty("isform") || custom.hasOwnProperty("is_form")) {
        if (custom.hasOwnProperty("text") || custom.hasOwnProperty("message")) {
          return {
            responseMessage: {
              message: custom.text || custom.message,
              isform: true,
            },
            visitorData: data.custom.user_details,
            message: custom.hasOwnProperty("text") ? custom.text : "",
            isform: true,
          };
        } else {
          let mappingData = { ...custom, previousUtter: this.previousUtter };
          let res = {
            responseMessage: mappingData,
            visitorData: data.custom.user_details,
            message: data.custom.hasOwnProperty("title") ? data.custom.title : "",
          };
          if (custom.hasOwnProperty("is_form") || custom.hasOwnProperty("isform")) {
            res = { ...res, isform: true };
          }
          return res;
        }
      }
      let mappingData = { ...custom, previousUtter: this.previousUtter };
      return {
        responseMessage: mappingData,
        message: data.custom.hasOwnProperty("title") ? data.custom.title : "",
        visitorData: data.custom.user_details,
      };
    }
  }
}

module.exports = new RasaAPI({
  host: process.env.RASA_HOST || "15.206.233.76",
  port: process.env.RASA_PORT || "5005",
  protocol: process.env.SOCKET_PROTOCOL || "http",
});
