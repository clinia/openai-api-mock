import express from "express";
import bodyParser from "body-parser";
import { getChatResponce } from "./chat.js";
import { createChatStream } from "./chat.stream.js";
import { getImageResponce } from "./image.js";
import { functionArgumentOverrides } from "./utils/mockStore.js";

// Configurable mock options
const config = {
  latency: parseInt(process.env.MOCK_LATENCY || "0", 10), // in ms
  includeErrors: process.env.MOCK_ERRORS === "true", // simulate 429s
  logRequests: process.env.MOCK_LOG === "true" || true, // default to true
};

const app = express();
const PORT = process.env.PORT || 5010;

app.use(bodyParser.json());

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

app.post("/mock/override", (req, res) => {
  const token = req.get("X-Test-Token");
  const { functionName, args } = req.body;

  if (!token || !functionName || typeof args !== "object") {
    return res
      .status(400)
      .json({ error: { message: "Missing token, functionName or args" } });
  }

  if (!functionArgumentOverrides.has(token)) {
    functionArgumentOverrides.set(token, new Map());
  }
  functionArgumentOverrides.get(token).set(functionName, args);

  return res.status(200).json({ message: "Override set" });
});

app.post("/v1/chat/completions", async (req, res) => {
  const body = req.body;

  if (config.logRequests) {
    console.log(`[MOCK] Chat request:`, JSON.stringify(body, null, 2));
  }

  if (!Array.isArray(body.messages)) {
    return res.status(400).json({
      error: { message: "Invalid request. Missing required fields." },
    });
  }

  if (config.includeErrors && Math.random() < 0.05) {
    return res.status(429).json({ error: { message: "Rate limit exceeded" } });
  }

  if (config.latency > 0) await sleep(config.latency);

  if (body.stream === true) {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const stream = createChatStream(body);
    stream.pipe(res);
  } else {
    res.status(200).json(getChatResponce(body));
  }
});

app.post("/v1/images/generations", async (req, res) => {
  const body = req.body;

  if (config.logRequests) {
    console.log(`[MOCK] Image request:`, JSON.stringify(body, null, 2));
  }

  if (!body.prompt) {
    return res
      .status(400)
      .json({ error: { message: "Invalid request. Missing prompt." } });
  }

  if (config.includeErrors && Math.random() < 0.05) {
    return res
      .status(400)
      .json({ error: { message: "Blocked by safety system" } });
  }

  if (config.latency > 0) await sleep(config.latency);

  res.status(200).json(getImageResponce(body));
});

app.listen(PORT, () => {
  console.log(`[MOCK SERVER] Running at http://localhost:${PORT}`);
});
