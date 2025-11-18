import { ApiError } from "../utils/ApiError.js";
import { AsyncHandler } from "../utils/AsyncHandler.js";
import { Chat } from "../models/chatModel.js";
import pinecone from "../config/pinecone.js";
import GeminiModel from "../config/gemini.js";
import { createGeminiPrompt } from "../utils/gemini.js";
import jwt from "jsonwebtoken";
import { User } from "../models/userModel.js";

export const askAi = AsyncHandler(async (req, res, next) => {
  console.log("******** askAi Function ********");

  // Accept token from query or header (fallbacks)
  let { prompt, lectureId } = req.query;
  let token = req.query.token || req.headers["authorization"] || req.headers["x-access-token"] || null;

  // Normalize token
  if (typeof token === "string") {
    token = token.trim();
    if (token.startsWith("Bearer ")) token = token.slice(7).trim();
    if (token.charAt(0) === '"' && token.charAt(token.length - 1) === '"') token = token.slice(1, -1);
  }

  if (!token) {
    throw new ApiError(401, "Authentication token is required");
  }

  // Verify token
  let decodedToken;
  try {
    decodedToken = jwt.verify(token, process.env.JWT_SECRET);
    console.log("decodedToken", decodedToken);
  } catch (err) {
    console.error("JWT verify error:", err);
    throw new ApiError(401, "Invalid JWT token");
  }

  // Resolve user
  const user = await User.findById(decodedToken?._id).select("-password");
  if (!user) {
    throw new ApiError(401, "Invalid JWT Token");
  }
  req.user = user;

  if (!prompt || !lectureId) {
    return next(new ApiError(400, "Prompt and lectureId are required"));
  }

  // SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("Access-Control-Allow-Origin", "*");

  // Helper to send SSE chunk
  const sendChunk = (obj) => {
    try {
      res.write(`data: ${JSON.stringify(obj)}\n\n`);
    } catch (e) {
      console.error("Failed to write SSE chunk:", e);
    }
  };

  try {
    // Load or create chat
    let chat = await Chat.find({ userId: req.user._id, lectureId }).limit(1);
    if (!chat || chat.length === 0) {
      chat = await Chat.create({ userId: req.user._id, lectureId, messages: [] });
      chat = [chat];
    }
    chat = chat[0];

    // Save user message
    const initialMessage = { type: "user", message: prompt };
    chat.messages.push(initialMessage);
    await chat.save();

    // 1) Create embedding for prompt
    const embedModel = "multilingual-e5-large";
    const embedRes = await pinecone.inference.embed(embedModel, [prompt], { inputType: "query" });
    console.log("Embedding response (raw):", JSON.stringify(embedRes?.data?.[0] ? { keys: Object.keys(embedRes.data[0]) } : embedRes, null, 2));

    // extract numeric vector robustly
    let vectorCandidate = null;
    if (embedRes && Array.isArray(embedRes.data) && embedRes.data.length > 0) {
      const first = embedRes.data[0];
      vectorCandidate = first.values ?? first.embedding ?? first.vector ?? first;
      if (!Array.isArray(vectorCandidate)) {
        for (const k of Object.keys(first || {})) {
          if (Array.isArray(first[k]) && first[k].length > 0) {
            vectorCandidate = first[k];
            break;
          }
        }
      }
      if (!Array.isArray(vectorCandidate)) vectorCandidate = null;
    } else if (Array.isArray(embedRes) && embedRes.length > 0) {
      const first = embedRes[0];
      vectorCandidate = first.values ?? first.embedding ?? first;
      if (!Array.isArray(vectorCandidate)) vectorCandidate = null;
    }

    if (vectorCandidate) {
      console.log("Using vector length:", vectorCandidate.length);
    } else {
      console.warn("No valid embedding vector found; will proceed without retrieval context.");
    }

    // 2) Query Pinecone properly (namespace + filter) with fallback for chunk-id scheme
    const INDEX_NAME = process.env.PINECONE_INDEX || "testing";
    const NAMESPACE = process.env.PINECONE_NAMESPACE || "example-namespace";
    const index = pinecone.index(INDEX_NAME);
    let queryResponse = { matches: [] };

    if (vectorCandidate) {
      try {
        const idxNamespace = index.namespace(NAMESPACE);
        queryResponse = await idxNamespace.query({
          topK: 5,
          vector: vectorCandidate,
          includeValues: false,
          includeMetadata: true,
          filter: { lectureId: { $eq: String(lectureId) } }, // stringify to avoid type mismatch
        });
        console.log("Pinecone Query Response count:", queryResponse?.matches?.length ?? 0);
      } catch (err) {
        console.error("Pinecone query failed with filter:", err);
        // fallback no-filter debug
        try {
          const idxNamespace = index.namespace(NAMESPACE);
          const debugResp = await idxNamespace.query({
            topK: 50, // larger so we can filter locally by ids
            vector: vectorCandidate,
            includeValues: false,
            includeMetadata: true,
          });
          console.log("Pinecone debug no-filter matches:", (debugResp.matches || []).length);
          // locally filter by metadata.lectureId OR by id prefix matching chunk scheme
          const rawMatches = debugResp.matches || [];
          const lecturePrefix = String(lectureId) + "_chunk_";
          const filtered = rawMatches.filter((m) => {
            if (m.metadata && String(m.metadata.lectureId) === String(lectureId)) return true;
            if (String(m.id).startsWith(lecturePrefix)) return true;
            return false;
          });
          queryResponse = { matches: filtered };
          console.log("Filtered matches after id-prefix fallback:", filtered.length);
        } catch (dbgErr) {
          console.error("Pinecone debug query also failed:", dbgErr);
          queryResponse = { matches: [] };
        }
      }
    }

    // 3) Build retrievedContext from matches (concatenate topK)
    const matches = queryResponse?.matches ?? [];
    let retrievedContext = "";
    if (!matches.length) {
      console.warn("No retrieval matches found for lectureId:", lectureId);
    } else {
      const snippets = matches.map((m) => {
        const meta = m.metadata || {};
        const textCandidate =
          (typeof meta.fullText === "string" && meta.fullText) ||
          (typeof meta.text === "string" && meta.text) ||
          (typeof meta.chunk === "string" && meta.chunk) ||
          (typeof meta.content === "string" && meta.content) ||
          (typeof meta.body === "string" && meta.body) ||
          (typeof meta.pageText === "string" && meta.pageText) ||
          "";
        if (!textCandidate) {
          const keys = Object.keys(meta || {});
          for (const k of keys) {
            if (typeof meta[k] === "string" && meta[k].length > 20) return meta[k].slice(0, 2000);
          }
        }
        return (textCandidate || "").slice(0, 2000);
      }).filter(Boolean);

      // join snippets with separators and cap length
      retrievedContext = snippets.join("\n\n---\n\n").slice(0, 20000); // generous cap for lecture context
      console.log("Retrieved context length:", retrievedContext.length);
    }

    // 4) Build full prompt including retrievedContext
    const recentMessages = (chat.messages || []).map((msg) => `${msg.type === "user" ? "User" : "AI"}: ${msg.message}`).join("\n");
    const fullPrompt = createGeminiPrompt(recentMessages, prompt, retrievedContext);
    console.log("Full Prompt length:", fullPrompt.length);

    // 5) Call Gemini streaming API and forward via SSE
    const responseWrap = await GeminiModel.generateContentStream(fullPrompt);
    const stream = responseWrap.stream ?? responseWrap;

    let completeResponse = "";

    for await (const chunk of stream) {
      let chunkText = "";
      try {
        if (typeof chunk === "string") {
          chunkText = chunk;
        } else if (typeof chunk.text === "function") {
          chunkText = await chunk.text();
        } else if (chunk?.candidates && Array.isArray(chunk.candidates) && chunk.candidates[0]?.content) {
          chunkText = String(chunk.candidates[0].content).trim();
        } else if (chunk?.content) {
          chunkText = String(chunk.content);
        } else {
          chunkText = JSON.stringify(chunk).slice(0, 1000);
        }
      } catch (e) {
        console.error("Error extracting chunk text:", e);
        chunkText = "";
      }

      if (chunkText) {
        completeResponse += chunkText;
        sendChunk({ chunk: chunkText });
      }
    }

    // Store AI response
    chat.messages.push({ type: "ai", message: completeResponse });
    await chat.save();

    // Signal completion
    res.write("event: done\ndata: {}\n\n");
    res.end();
  } catch (error) {
    console.error("Streaming Error:", error);
    try {
      res.write(`event: error\ndata: ${JSON.stringify({ error: error.message || String(error) })}\n\n`);
      res.end();
    } catch (e) {
      console.error("Failed to send SSE error:", e);
    }
  }
});
