(async () => {
  const env = {
    protocol: "http",
    server: "localhost",
    port: "3001",
    basePath: "/rest/v1/",
    baseUrl: "http://localhost:3000",
  };

  // Load crypto-js from CDN
  function loadCryptoJS() {
    return new Promise((resolve, reject) => {
      if (window.CryptoJS) {
        resolve(window.CryptoJS);
        return;
      }

      const script = document.createElement("script");
      script.src =
        "https://cdnjs.cloudflare.com/ajax/libs/crypto-js/4.1.1/crypto-js.min.js";
      script.onload = () => resolve(window.CryptoJS);
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  function renderStyles() {
    const style = document.createElement("style");
    style.innerHTML = `
          /* Chat Icon */
          .chat-icon {
            width: 60px;
            height: 60px;
            border-radius: 50%;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            border: none;
            color: white;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
            transition: all 0.3s ease;
            position: relative;
          }

          .chat-icon:hover {
            transform: scale(1.1);
            box-shadow: 0 6px 25px rgba(0, 0, 0, 0.2);
          }

          .chat-icon.hidden {
            display: none;
          }

          .chat-window {
            position: fixed;
            bottom: 20px;
            right: 20px;
            width: 100vw;
            height: 90vh;
            min-width: 320px;
            max-width: 400px;
            max-height: 700px;
            background: white;
            border-radius: 12px;
            box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15);
            display: flex;
            flex-direction: column;
            transform: translateY(100%) scale(0.8);
            opacity: 0;
            visibility: hidden;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            overflow: hidden;
          }

          .chat-window.open {
            transform: translateY(0) scale(1);
            opacity: 1;
            visibility: visible;
          }

          
          /* Small mobile devices (up to 480px) */
          @media (max-width: 480px) {
            .chat-window {
              box-shadow: none;
              right:0;
              bottom:0;
              border-radius: 0;
              width: 100%;
              max-width: 450px;
              height: 100vh;
            }
          }


          .close-button {
            background: none;
            border: none;
            color: white;
            cursor: pointer;
            padding: 4px;
            border-radius: 4px;
            transition: background-color 0.2s;
            position: absolute;
            right: 20px;
            top: 20px;
            z-index: 9999;
          }

          .close-button:hover {
            background: rgba(255, 255, 255, 0.1);
          }
        `;
    document.head.appendChild(style);
  }

  renderStyles();

  const CryptoJS = await loadCryptoJS();

  const chatwindow = document.getElementsByClassName("chat-window");

  const script = document.getElementById("embedScript");
  const organizationData =
    script.getAttribute("bot") || script.getAttribute("data-bot");

  const removeParamsFromURL = [
    "keys",
    "query",
    "botIframe",
    "removeByTag",
    "removeByClassName",
    "removeById",
  ];

  let visitedUrl = "";
  let uniqueID = "";

  async function botVisibility(organization, usedField, queryParams) {
    try {
      const apiCallUrl = `${env.protocol}://${env.server}:${env.port}${env.basePath}ui/checkPlatformSettings?organization=${organization}&usedField=${usedField}&queryParams=${queryParams}`;
      const response = await fetch(apiCallUrl, {
        method: "GET",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        credentials: "include",
      });
      const result = await response.json();
      if (!result.data) {
        return false;
      }
      return result.data.active;
    } catch (error) {
      console.log("Error in platform settings>>>>", error);
      return false;
    }
  }

  async function loadMascotColor() {
    let org;
    let loc;
    let reg;

    try {
      const decodedOrgData = decodeURIComponent(organizationData).replace(
        / /g,
        "+"
      );
      const decryptedOrgData = decrypt(decodedOrgData);

      if (!decryptedOrgData) {
        console.error("Failed to decrypt organization data");
        return false;
      }

      const parsedOrgData = JSON.parse(decryptedOrgData);
      org = parsedOrgData.client;
      loc = parsedOrgData.location || null;
      reg = parsedOrgData.region || null;
    } catch (error) {
      console.error("Error parsing organization data:", error);
      return false;
    }

    const checkSettings = await botVisibility(
      org,
      loc ? loc : reg,
      loc ? "branchId" : "regionId"
    );
    if (!checkSettings) {
      return false;
    }

    let apiCallUrl = `${env.protocol}://${env.server}:${env.port}${env.basePath}ui/getOrganizationUi?organization=${org}`;

    if (loc) {
      apiCallUrl += `&branch=${loc}`;
    } else if (reg) {
      apiCallUrl += `&region=${reg}`;
    }
    try {
      const response = await fetch(apiCallUrl, {
        method: "GET",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        credentials: "include",
      });
      const result = await response.json();
      const primColor = result.primaryColor;
      document.documentElement.style.setProperty("--primary-color", primColor);
      const responseObj = {
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
      return responseObj;
    } catch (error) {
      console.error("Error fetching organization UI:", error);
      return false;
    }
  }

  async function loadBot() {
    const encryptedVisitorId = encryptData(getUniqueId());
    const encryptedLink = encryptData(getLinkHistory());

    const detailsFetched = await loadMascotColor();

    if (!detailsFetched) {
      return false;
    }
    console.log(detailsFetched, "checkinvid++++");

    const search = window.location.search;
    const urlp = new URLSearchParams(search);
    const visitorCredentials = urlp.get("keys") || "";

    let finalBaseUrl = `${env.baseUrl}?visitorId=${encryptedVisitorId}&link=${encryptedLink}&baseURL=${window.location.origin}&hostname=${window.location.hostname}`;

    if (visitorCredentials && visitorCredentials.length > 0) {
      finalBaseUrl = finalBaseUrl + `&visitorCredentials=${urlp.get("keys")}`;
    }

    if (detailsFetched) {
      finalBaseUrl =
        finalBaseUrl +
        `&details=${encodeURIComponent(JSON.stringify(detailsFetched))}`;
    }

    // Update the iframe src when it's created
    env.baseUrl = finalBaseUrl;

    gethistory();
    return true;
  }

  // Decrypt function using CryptoJS
  function decrypt(encrypted) {
    try {
      if (!encrypted) {
        return null;
      }
      const secretKey = "34xcdfdafklsdfhieofaeidkshnfjvk3qelrkjaf3oiweadcjnjk";
      const bytes = CryptoJS.AES.decrypt(encrypted, secretKey);
      const decrypted = bytes.toString(CryptoJS.enc.Utf8);
      return decrypted;
    } catch (error) {
      console.log("Error in decryption===>", error);
      return null;
    }
  }

  // Encrypt function using CryptoJS
  function encrypt(data) {
    try {
      const secretKey = "34xcdfdafklsdfhieofaeidkshnfjvk3qelrkjaf3oiweadcjnjk";
      const encrypted = CryptoJS.AES.encrypt(data, secretKey).toString();
      return encrypted;
    } catch (error) {
      console.log("Error in encryption===>", error);
      return btoa(data); // fallback to base64
    }
  }

  // Encryption function using CryptoJS
  function encryptData(data) {
    try {
      return encrypt(data);
    } catch (error) {
      console.error("Encryption failed, using base64:", error);
      return btoa(data);
    }
  }

  function decryptData(encryptedData) {
    try {
      return decrypt(encryptedData);
    } catch (error) {
      console.error("Decryption failed, using base64:", error);
      return atob(encryptedData);
    }
  }

  function getLinkHistory() {
    visitedUrl = window.location.href;
    const url = new URL(visitedUrl);
    for (const param of removeParamsFromURL) {
      url.searchParams.delete(param);
    }
    const newUrl = url.toString();
    visitedUrl = newUrl;
    return visitedUrl;
  }

  function gethistory() {
    let lastUrl = location.href;
    new MutationObserver(() => {
      const url = location.href;
      if (url !== lastUrl) {
        lastUrl = url;
        onUrlChange();
      }
    }).observe(document, { subtree: true, childList: true });
  }

  function onUrlChange() {
    let link = location.href;
    const iframe = document.querySelector("#chatbot-iframe iframe");
    if (iframe && env.baseUrl) {
      const timeFrame = setTimeout(() => {
        clearTimeout(timeFrame);
      }, 2000);
      const url = new URL(link);
      for (const param of removeParamsFromURL) {
        url.searchParams.delete(param);
      }
      link = url.toString();
      iframe.contentWindow.postMessage({ link: link }, env.baseUrl);
    }
  }

  // Simple UUID generation
  function generateUUID() {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      var r = (Math.random() * 16) | 0,
        v = c == "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  // Simple cookie functions
  const cookie = {
    setCookie: (name, value, days) => {
      const expires = new Date();
      expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000);
      document.cookie =
        name + "=" + value + ";expires=" + expires.toUTCString() + ";path=/";
    },
    getCookie: (name) => {
      const nameEQ = name + "=";
      const ca = document.cookie.split(";");
      for (let i = 0; i < ca.length; i++) {
        let c = ca[i];
        while (c.charAt(0) == " ") c = c.substring(1, c.length);
        if (c.indexOf(nameEQ) == 0) return c.substring(nameEQ.length, c.length);
      }
      return null;
    },
    isCookieExists: function (name) {
      return this.getCookie(name) !== null;
    },
  };

  function getUniqueId() {
    const isCookie = navigator.cookieEnabled;
    if (isCookie && cookie.isCookieExists("uniqueID")) {
      return cookie.getCookie("uniqueID");
    }
    if (uniqueID) {
      return uniqueID;
    }

    // Simple fingerprinting
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    ctx.textBaseline = "top";
    ctx.font = "14px Arial";
    ctx.fillText("Browser fingerprint", 2, 2);
    const fingerprint = canvas.toDataURL();

    uniqueID =
      btoa(
        fingerprint + navigator.userAgent + screen.width + screen.height
      ).substring(0, 32) || generateUUID();

    if (isCookie) {
      cookie.setCookie("uniqueID", uniqueID, 30); // 30 days
    }

    return uniqueID;
  }

  // Execute the bot loading
  const loadBotStatus = await loadBot();

  if (!loadBotStatus) return;

  const nextApp = document.getElementById("next-app");
  if (nextApp) {
    nextApp.remove();
  }

  const botButton = document.createElement("button");
  botButton.id = "next-app";
  botButton.classList.add("chat-icon");
  botButton.style.position = "fixed";
  botButton.style.bottom = "20px";
  botButton.style.right = "20px";

  const mascot = document.createElement("img");
  mascot.src =
    "https://png.pngtree.com/png-clipart/20230820/original/pngtree-chatbot-icon-chat-bot-robot-picture-image_8080841.png";
  mascot.alt = "AI Chatbot Mascot";
  mascot.style.width = "100%";
  mascot.style.height = "100%";
  mascot.style.position = "absolute";
  mascot.style.top = "50%";
  mascot.style.left = "50%";
  mascot.style.transform = "translate(-50%, -50%)";
  mascot.style.transition = "all 0.3s ease";

  botButton.appendChild(mascot);

  document.body.appendChild(botButton);
  renderIframe();

  botButton.addEventListener("click", () => {
    botButton.classList.toggle("hidden");
    document.getElementById("chatbot-iframe").classList.toggle("open");
  });

  function renderIframe() {
    const iframeContainer = document.createElement("div");
    iframeContainer.classList.add("chat-window");
    iframeContainer.id = "chatbot-iframe";
    iframeContainer.style.zIndex = "9999";

    const closeBtn = document.createElement("button");
    closeBtn.classList.add("close-button");
    closeBtn.ariaLabel = "Close Chatbot";
    closeBtn.textContent = "X";

    closeBtn.addEventListener("click", () => {
      botButton.classList.remove("hidden");
      document.getElementById("chatbot-iframe").classList.remove("open");
    });

    iframeContainer.appendChild(closeBtn);

    const chatbotIframe = document.createElement("iframe");
    chatbotIframe.src = env.baseUrl;
    chatbotIframe.style.border = "none";
    chatbotIframe.style.height = "100%";
    chatbotIframe.style.width = "100%";
    chatbotIframe.style.zIndex = "999";

    iframeContainer.appendChild(chatbotIframe);

    document.body.appendChild(iframeContainer);
  }
})();
