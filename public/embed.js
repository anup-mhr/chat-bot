// (() => {
//   // Create a dynamic iframe that resizes based on content
//   function createDynamicChatbotIframe(chatbotUrl) {
//     const iframe = document.createElement("iframe");
//     iframe.id = "chatbot-iframe";
//     iframe.src = chatbotUrl;
//     iframe.style.position = "fixed";
//     iframe.style.bottom = "20px";
//     iframe.style.right = "20px";
//     iframe.style.width = "70px";
//     iframe.style.height = "70px";
//     iframe.style.border = "none";
//     iframe.style.borderRadius = "50%";
//     iframe.style.zIndex = "9999";
//     iframe.style.background = "transparent";
//     iframe.style.transition = "all 0.3s ease";
//     iframe.title = "AI Chatbot";
//     iframe.setAttribute("scrolling", "no");
//     iframe.setAttribute("frameborder", "0");
//     iframe.setAttribute("allowtransparency", "true");

//     return iframe;
//   }

//   // Handle messages from the iframe to resize it dynamically
//   function setupDynamicResize(iframe) {
//     window.addEventListener("message", (event) => {
//       if (event.data && event.data.type === "chatbot-resize") {
//         const { isOpen, dimensions } = event.data;

//         if (isOpen) {
//           // Chat is open - expand iframe
//           iframe.style.width = dimensions.width;
//           iframe.style.height = dimensions.height;
//           iframe.style.borderRadius = "12px";
//           iframe.style.boxShadow = "0 10px 40px rgba(0, 0, 0, 0.15)";
//         } else {
//           // Chat is closed - shrink iframe to just show the button
//           iframe.style.width = dimensions.width;
//           iframe.style.height = dimensions.height;
//           iframe.style.borderRadius = "50%";
//           iframe.style.boxShadow = "0 4px 20px rgba(0, 0, 0, 0.15)";
//         }
//       }
//     });
//   }

//   // Initialize the chatbot
//   window.initChatbot = (config) => {
//     config = config || {};
//     const chatbotUrl = config.url || "http://localhost:3000";

//     // Remove existing chatbot if any
//     const existingIframe = document.getElementById("chatbot-iframe");
//     if (existingIframe) {
//       existingIframe.remove();
//     }

//     // Create and add the iframe
//     const iframe = createDynamicChatbotIframe(chatbotUrl);
//     document.body.appendChild(iframe);

//     // Setup dynamic resizing
//     setupDynamicResize(iframe);

//     console.log("Dynamic chatbot initialized successfully!");
//     return iframe;
//   };

//   // Auto-initialize if script has data-auto-init attribute
//   const scripts = document.getElementsByTagName("script");
//   const currentScript = scripts[scripts.length - 1];

//   if (
//     currentScript &&
//     currentScript.getAttribute("data-auto-init") === "true"
//   ) {
//     const chatbotUrl =
//       currentScript.getAttribute("data-url") || "http://localhost:3000";

//     if (document.readyState === "loading") {
//       document.addEventListener("DOMContentLoaded", () => {
//         window.initChatbot({ url: chatbotUrl });
//       });
//     } else {
//       window.initChatbot({ url: chatbotUrl });
//     }
//   }
// })();

(async () => {
  const nextApp = document.getElementById("next-app");
  if (nextApp) {
    nextApp.remove();
  }

  const main = document.createElement("div");
  main.id = "next-app";
  document.body.appendChild(main);

  try {
    // Fetch the HTML from your Next.js app
    const response = await fetch("http://localhost:3000");

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const html = await response.text();

    // Create a temporary div to parse the HTML
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = html;

    // Extract specific content (adjust selector as needed)
    // This selects the main content div from Next.js
    const nextjsContent =
      tempDiv.querySelector("#__next") ||
      tempDiv.querySelector("main") ||
      tempDiv.querySelector(".container") ||
      tempDiv; // fallback to full content

    // Clear loading message and insert content
    main.innerHTML = "";

    if (nextjsContent) {
      // Clone the content to avoid moving original
      const clonedContent = nextjsContent.cloneNode(true);
      main.appendChild(clonedContent);

      // Load Next.js CSS if needed
      loadNextJsStyles();
    } else {
      main.innerHTML = "<p>No content found in Next.js app</p>";
    }
  } catch (error) {
    console.error("Error loading Next.js content:", error);
    main.innerHTML = `
                        <div class="error">
                            <strong>Error loading content:</strong> ${error.message}
                            <br><small>Make sure your Next.js app is running on http://localhost:3000</small>
                        </div>
                    `;
  }
})();
