const catchAsync = require("../utils/catchAsync");
require("dotenv").config();

exports.embedScripted = catchAsync(async function (req, res) {
  // const baseUrl = process.env.BASE_URL ?? "http://localhost:5173";
  const baseUrl = "http://localhost:3001/chatbot";

  const script = `
(async () => {
  function renderStyles() {
    const style = document.createElement("style");
    style.innerHTML = \`
      .chat-icon {
        width: 70px;
        height: 70px;
        border-radius: 50%;
        background: #1c77bb;
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
        transform: scale(1.03);
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
      @media (max-width: 480px) {
        .chat-window {
          box-shadow: none;
          right: 0;
          bottom: 0;
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
        background: rgba(255, 255, 255, 0.2);
      }

      .call-button {
      background: none;
      border: none;
      color: white;
      cursor: pointer;
      padding: 7px;
      border-radius: 4px;
      transition: background-color 0.2s;
      position: absolute;
      right: 46px;
      top: 20px;
      z-index: 9999;
      }
      .call-button:hover {
        background: rgba(255, 255, 255, 0.2);
      }
    \`;
    document.head.appendChild(style);
  }

  renderStyles();

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
  mascot.src = "${baseUrl}/bot.webp";
  mascot.alt = "AI Chatbot Mascot";
  mascot.style.width = "80%";
  mascot.style.height = "80%";
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
    document.getElementById("chatbot-iframe")?.classList.toggle("open");
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
    closeBtn.innerHTML = \`\<svg xmlns="http://www.w3.org/2000/svg"  width="20" height="20" viewBox="0 0 24 24" fill="#1c77bb" stroke="#1c77bb" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-x-icon lucide-x"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>\`\;
    

    closeBtn.addEventListener("click", () => {
      botButton.classList.remove("hidden");
      document.getElementById("chatbot-iframe")?.classList.remove("open");
    });


    const callBtn = document.createElement("button");
    callBtn.classList.add("call-button");
    callBtn.ariaLabel = "Call Chatbot";

    callBtn.innerHTML = \`\<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
              fill="none" stroke="#1c77bb" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
              class="lucide lucide-phone-outgoing">
              <title>Make a call</title>
              <polyline points="22 8 22 2 16 2" />
              <line x1="16" x2="22" y1="8" y2="2" />
              <path
                d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
            </svg>\`\;

    callBtn.addEventListener("click", () => {
      const iframe = document.querySelector("#chatbot-iframe iframe");
      if (iframe && iframe.contentWindow) {
      iframe.contentWindow.postMessage(
      { type: 'start-call' },
      "${baseUrl}"
      );
      }
    });

    iframeContainer.appendChild(closeBtn);
    iframeContainer.appendChild(callBtn);

    const chatbotIframe = document.createElement("iframe");
    chatbotIframe.src = "${baseUrl}";
    chatbotIframe.style.border = "none";
    chatbotIframe.style.height = "100%";
    chatbotIframe.style.width = "100%";
    chatbotIframe.style.zIndex = "999";
    chatbotIframe.allow = "microphone";

    iframeContainer.appendChild(chatbotIframe);
    document.body.appendChild(iframeContainer);
  }
})();`;

  res.set({
    "Content-Type": "application/javascript",
    "Cache-Control": "public, max-age=600",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET",
    "Access-Control-Allow-Headers": "Content-Type",
  });

  return res.send(script);

  return new NextResponse(script, {
    headers: {
      "Content-Type": "application/javascript",
      "Cache-Control": "public, max-age=600",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
});
// if need all in route.ts copy v0 version 18 copy embed/route.ts and org.context.tsx
