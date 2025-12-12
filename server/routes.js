var express = require("express");
var path = require("path");
let app = express.Router();

const usersRouter = require("./routes/users");
const getOrganization = require("./routes/getorganization");

const embedScript = require("./routes/embed");
const organizationUi = require("./routes/uiController");
const chatHistoryRouter = require("./routes/chatHistory");
const call = require("./routes/callController");
const userDetail = require("./routes/userDetail");

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "OK", timestamp: new Date().toISOString() });
});

// API routes FIRST (before static files)
app.use("/embed", embedScript);
app.use("/rest/v1/users", usersRouter);
app.use("/rest/v1/Organization", getOrganization);
app.use("/rest/v1/ui", organizationUi);
app.use("/rest/v1/chat", chatHistoryRouter);
app.use("/rest/v1/call", call);
app.use("/rest/v1/user", userDetail);

app.get("/bot", (req, res) => {
  res.sendFile(path.join(path.join(__dirname), "index.html"));
});

module.exports = app;
