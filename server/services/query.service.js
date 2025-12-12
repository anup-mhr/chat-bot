
const fetch = require("node-fetch");

const host = process.env.RASA_HOST || "15.206.233.76";
const port = process.env.RASA_PORT || "5005";
const protocol = process.env.SOCKET_PROTOCOL || "http";

const url = protocol + "://" + host + ":" + port + "/model/parse";

const isQueryUnhandeled = async function(utter){
    // console.time("timer");
    const response = await fetch(url, {
        method: "POST",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify({text:utter})
    });
    const data = await response.json();
    // console.timeEnd("timer");
    // console.log(data);
    const isUnhandled = data.intent && ["nlu_fallback", "out_of_scope"].includes(data.intent.name);
    // console.log(`UTTER ${utter} IS ${isUnhandled?"UNHANDELED":"HANDELED"}`);
    return isUnhandled;
}

exports.isQueryUnhandeled = isQueryUnhandeled;