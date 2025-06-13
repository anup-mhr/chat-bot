(async () => {
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
    chatbotIframe.src = "http://localhost:3000";
    chatbotIframe.style.border = "none";
    chatbotIframe.style.height = "100%";
    chatbotIframe.style.width = "100%";
    chatbotIframe.style.zIndex = "999";

    iframeContainer.appendChild(chatbotIframe);

    document.body.appendChild(iframeContainer);
  }

  // function init() {
  //   renderStyles();
  //   // Your initialization code
  // }

  // if (document.readyState === "loading") {
  //   document.addEventListener("DOMContentLoaded", init);
  // } else {
  //   init();
  // }
})();
