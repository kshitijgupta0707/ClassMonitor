import express from "express";
import multer from "multer";
import axios from "axios";
import { Pinecone } from "@pinecone-database/pinecone";
import cors from "cors";
import FormData from "form-data";
import { PDFDocument } from "pdf-lib";
import { pipeline } from '@xenova/transformers';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const storage = multer.memoryStorage();
const upload = multer({ storage });

const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY,
});

const index = pinecone.Index("testing");

// Initialize the embedding pipeline (loads model on first use)
let embedder = null;

async function initEmbedder() {
  if (!embedder) {
    console.log("Loading E5 model locally (this may take a minute on first run)...");
    embedder = await pipeline('feature-extraction', 'Xenova/multilingual-e5-large');
    console.log("✓ E5 model loaded!");
  }
  return embedder;
}

async function embedText(text) {
  try {
    console.log(`Embedding text locally (${text.length} chars)...`);
    
    const pipe = await initEmbedder();
    const prefixedText = `query: ${text}`;
    const output = await pipe(prefixedText, { pooling: 'mean', normalize: true });
    const embedding = Array.from(output.data);
    
    console.log(`✓ Embedding created locally (${embedding.length} dimensions)`);
    return embedding;
  } catch (error) {
    console.error("Error embedding text:", error.message);
    throw error;
  }
}

async function searchText(text) {
  const vector = await embedText(text);
  
  const result = await index.namespace("example-namespace").query({
    vector,
    topK: 1,
    includeMetadata: true,
  });
  
  return result.matches;
}

// Split PDF into individual pages
async function splitPDFIntoPages(pdfBuffer) {
  console.log("Splitting PDF into pages...");
  const pdfDoc = await PDFDocument.load(pdfBuffer);
  const pageCount = pdfDoc.getPageCount();
  console.log(`PDF has ${pageCount} pages`);
  
  const pages = [];
  
  for (let i = 0; i < pageCount; i++) {
    const newPdf = await PDFDocument.create();
    const [copiedPage] = await newPdf.copyPages(pdfDoc, [i]);
    newPdf.addPage(copiedPage);
    const pdfBytes = await newPdf.save();
    pages.push(Buffer.from(pdfBytes));
    console.log(`Page ${i + 1} extracted (${(pdfBytes.length / 1024).toFixed(2)} KB)`);
  }
  
  return pages;
}

// OCR a single page using OCR.space
async function ocrPage(pageBuffer, pageNumber) {
  console.log(`OCR processing page ${pageNumber}...`);
  
  try {
    const formData = new FormData();
    formData.append('file', pageBuffer, `page${pageNumber}.pdf`);
    formData.append('language', 'eng');
    formData.append('isOverlayRequired', 'false');
    formData.append('detectOrientation', 'true');
    formData.append('scale', 'true');
    formData.append('OCREngine', '2');

    const response = await axios.post(
      'https://api.ocr.space/parse/image',
      formData,
      {
        headers: {
          ...formData.getHeaders(),
          'apikey': process.env.OCR_API_KEY || 'K87899142388957'
        },
        timeout: 60000
      }
    );

    if (response.data.IsErroredOnProcessing) {
      throw new Error(response.data.ErrorMessage || 'OCR failed');
    }

    let text = '';
    if (response.data.ParsedResults && response.data.ParsedResults[0]) {
      text = response.data.ParsedResults[0].ParsedText;
    }

    console.log(`Page ${pageNumber}: ${text.length} characters extracted`);
    return text;

  } catch (error) {
    console.error(`Error on page ${pageNumber}:`, error.message);
    return '';
  }
}

// Extract text from entire PDF
async function extractTextFromPDF(pdfBuffer) {
  console.log("Starting PDF text extraction...");
  
  const pages = await splitPDFIntoPages(pdfBuffer);
  
  let fullText = '';
  for (let i = 0; i < pages.length; i++) {
    const pageText = await ocrPage(pages[i], i + 1);
    fullText += pageText + '\n\n';
    
    if (i < pages.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  console.log(`Total text extracted: ${fullText.length} characters`);
  return fullText;
}

function extractQuestions(text) {
  text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  const questions = [];
  
  const patterns = [
    /^(\d+[\.\)]\s+)/i,
    /^(Q\s*\d+[\.\:\s]+)/i,
    /^(Question\s*\d+[\.\:\s]*)/i,
    /^(\[\d+\])/i,
    /^(\d+\s*[a-z][\.\)]\s*)/i,
  ];
  
  const questionWords = /^(what|how|why|when|where|who|which|explain|describe|define|list|write|discuss|state|give|find|calculate|solve|prove|draw|compare|differentiate|evaluate|analyze)/i;
  
  let currentQuestion = '';
  
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    
    const startsWithNumber = patterns.some(pattern => pattern.test(line));
    const startsWithQuestionWord = questionWords.test(line);
    
    if (startsWithNumber || startsWithQuestionWord) {
      if (currentQuestion.length > 20) {
        questions.push(currentQuestion.trim());
      }
      
      currentQuestion = line;
      patterns.forEach(pattern => {
        currentQuestion = currentQuestion.replace(pattern, '');
      });
      currentQuestion = currentQuestion.trim();
      
    } else if (currentQuestion && line.length > 0 && currentQuestion.length < 500) {
      currentQuestion += ' ' + line;
    }
    
    const endMarkers = ['?', 'marks)', 'Marks)', 'marks]', 'Marks]'];
    if (endMarkers.some(marker => line.includes(marker)) && currentQuestion.length > 20) {
      questions.push(currentQuestion.trim());
      currentQuestion = '';
    }
  }
  
  if (currentQuestion.length > 20) {
    questions.push(currentQuestion.trim());
  }
  
  const cleanedQuestions = questions.map(q => {
    q = q.replace(/\s+/g, ' ');
    q = q.replace(/\(\d+\s*marks?\)/gi, '');
    q = q.replace(/\[\d+\s*marks?\]/gi, '');
    q = q.replace(/\(?\s*CO\s*\d+\s*\)?/gi, '');
    q = q.replace(/\(?\s*BL\s*\d+\s*\)?/gi, '');
    return q.trim();
  }).filter(q => q.length > 20 && q.length < 1000);
  
  return [...new Set(cleanedQuestions)];
}

// NEW: Get answer from Google Gemini
async function getGeminiAnswer(question, context = '') {
  try {
    // Check if API key exists
    if (!process.env.GEMINI_API_KEY) {
      console.error('❌ GEMINI_API_KEY is not set in .env file!');
      return 'Error: Gemini API key is missing. Please add GEMINI_API_KEY to your .env file.';
    }

    console.log(`🤖 Getting Gemini answer for: ${question.substring(0, 60)}...`);
    
    const prompt = context 
      ? `Context from lecture: ${context}\n\nQuestion: ${question}\n\nProvide a detailed answer based on the context above.`
      : `Question: ${question}\n\nProvide a detailed and comprehensive answer.`;

    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        contents: [{
          parts: [{
            text: prompt
          }]
        }]
      },
      {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );

    // Log full response for debugging
    console.log('Gemini Response Status:', response.status);

    if (response.data.candidates && response.data.candidates[0]) {
      const answer = response.data.candidates[0].content.parts[0].text;
      console.log(`✅ Gemini answer received (${answer.length} chars)`);
      return answer;
    }

    console.warn('⚠️ No candidates in Gemini response:', JSON.stringify(response.data));
    return "No answer generated from Gemini";

  } catch (error) {
    // Detailed error logging
    console.error('❌ Gemini API Error Details:');
    console.error('Error Message:', error.message);
    
    if (error.response) {
      console.error('Response Status:', error.response.status);
      console.error('Response Data:', JSON.stringify(error.response.data, null, 2));
      
      // Return user-friendly error message
      if (error.response.status === 400) {
        return 'Error: Invalid API request. Check your Gemini API key.';
      } else if (error.response.status === 403) {
        return 'Error: Gemini API access denied. Check API key permissions.';
      } else if (error.response.status === 429) {
        return 'Error: Gemini API rate limit exceeded. Please try again later.';
      }
    }
    
    return `Error generating answer: ${error.message}`;
  }
}

app.post("/api/process-pdf", upload.single("pdf"), async (req, res) => {
  try {
    console.log("\n=== PDF Upload Started ===");
    
    if (!req.file) {
      return res.status(400).json({ error: "No PDF file uploaded" });
    }

    console.log("File:", req.file.originalname);
    console.log("Size:", (req.file.size / 1024 / 1024).toFixed(2), "MB");

    const text = await extractTextFromPDF(req.file.buffer);

    console.log("\n--- First 500 characters ---");
    console.log(text.substring(0, 500));
    console.log("---\n");

    if (text.length < 50) {
      return res.status(400).json({ 
        error: "Could not extract text from PDF",
        extractedText: text
      });
    }

    const questions = extractQuestions(text);
    console.log("\n=== Found", questions.length, "Questions ===\n");
    
    if (questions.length > 0) {
      questions.forEach((q, i) => {
        console.log(`Q${i + 1}: ${q.substring(0, 100)}...`);
      });
    }

    if (questions.length === 0) {
      return res.status(400).json({ 
        error: "No questions found",
        extractedText: text.substring(0, 2000)
      });
    }

    const results = [];
    
    console.log("\n=== Searching in Pinecone & Getting Gemini Answers ===");
    for (let i = 0; i < questions.length; i++) {
      const question = questions[i];
      console.log(`\n[${i + 1}/${questions.length}] ${question.substring(0, 60)}...`);
      
      try {
        // Search in Pinecone
        const matches = await searchText(question);
        
        let lectureName = "Unknown Lecture";
        let score = 0;
        let metadata = null;
        let context = '';
        
        if (matches && matches.length > 0) {
          const bestMatch = matches[0];
          lectureName = bestMatch.metadata?.lectureName || "Unknown Lecture";
          score = bestMatch.score || 0;
          metadata = bestMatch.metadata;
          context = bestMatch.metadata?.text || '';
          
          console.log(`  ✓ ${lectureName} (${(score * 100).toFixed(1)}%)`);
        } else {
          console.log(`  ✗ No match in Pinecone`);
        }
        
        // Get answer from Gemini
        const answer = await getGeminiAnswer(question, context);
        
        results.push({
          question,
          lectureName,
          score,
          metadata,
          answer // NEW: Include Gemini answer
        });
        
      } catch (error) {
        console.error(`  ✗ Error:`, error.message);
        
        // Still add the question with error info
        results.push({
          question,
          lectureName: "Error",
          score: 0,
          metadata: null,
          answer: `Error: ${error.message}`
        });
      }
    }

    console.log("\n=== Complete ===");
    console.log("Matched:", results.filter(r => r.score > 0).length, "/", questions.length);

    res.json({ 
      success: true, 
      totalQuestions: questions.length,
      matchedQuestions: results.filter(r => r.score > 0).length,
      results 
    });

  } catch (error) {
    console.error("\n=== ERROR ===");
    console.error(error);
    
    res.status(500).json({ 
      error: "Error processing PDF", 
      details: error.message
    });
  }
});

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`\n✓ Server running on http://localhost:${PORT}`);
  console.log("✓ E5 model will load on first embedding request");
  
  // Validate API keys on startup
  console.log('\n=== API Key Status ===');
  console.log('Pinecone API Key:', process.env.PINECONE_API_KEY ? '✅ Set' : '❌ Missing');
  console.log('Gemini API Key:', process.env.GEMINI_API_KEY ? '✅ Set' : '❌ Missing');
  console.log('OCR API Key:', process.env.OCR_API_KEY ? '✅ Set' : '⚠️ Using default');
  console.log('=====================\n');
});