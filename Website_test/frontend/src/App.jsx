import React, { useState } from 'react';
import { Upload, FileText, BookOpen, Loader2, AlertCircle, Brain } from 'lucide-react';
import './App.css';
export default function App() {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [error, setError] = useState('');
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [matchedQuestions, setMatchedQuestions] = useState(0);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile && selectedFile.type === 'application/pdf') {
      setFile(selectedFile);
      setError('');
      setResults([]);
    } else {
      setError('Please select a valid PDF file');
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError('Please select a PDF file first');
      return;
    }

    setLoading(true);
    setError('');
    setResults([]);

    try {
      const formData = new FormData();
      formData.append('pdf', file);

      const response = await fetch('http://localhost:3001/api/process-pdf', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to process PDF');
      }

      const data = await response.json();
      
      if (data.success) {
        setResults(data.results);
        setTotalQuestions(data.totalQuestions);
        setMatchedQuestions(data.matchedQuestions);
      } else {
        setError(data.error || 'Failed to process PDF');
      }
    } catch (err) {
      setError(err.message || 'An error occurred while processing the PDF');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">
            AI-Powered Question Analyzer
          </h1>
          <p className="text-gray-600">
            Upload a PDF with questions to find lectures and get AI-generated answers
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-8 mb-6">
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-indigo-500 transition-colors">
            <input
              type="file"
              accept="application/pdf"
              onChange={handleFileChange}
              className="hidden"
              id="pdf-upload"
            />
            <label
              htmlFor="pdf-upload"
              className="cursor-pointer flex flex-col items-center"
            >
              <Upload className="w-12 h-12 text-indigo-500 mb-4" />
              <span className="text-lg font-medium text-gray-700 mb-2">
                {file ? file.name : 'Click to upload PDF'}
              </span>
              <span className="text-sm text-gray-500">
                PDF files containing questions
              </span>
            </label>
          </div>

          {error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start">
              <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 mr-3 flex-shrink-0" />
              <span className="text-red-700">{error}</span>
            </div>
          )}

          <button
            onClick={handleUpload}
            disabled={!file || loading}
            className="w-full mt-6 bg-indigo-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Processing PDF & Generating Answers...
              </>
            ) : (
              <>
                <FileText className="w-5 h-5 mr-2" />
                Process PDF
              </>
            )}
          </button>
        </div>

        {results.length > 0 && (
          <>
            {/* Summary Card */}
            <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <Brain className="w-8 h-8 text-indigo-600 mr-3" />
                  <div>
                    <h3 className="text-xl font-bold text-gray-800">Analysis Complete</h3>
                    <p className="text-sm text-gray-600">
                      {totalQuestions} questions found • {matchedQuestions} matched with lectures
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Results */}
            <div className="bg-white rounded-lg shadow-lg p-8">
              <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center">
                <BookOpen className="w-6 h-6 mr-2 text-indigo-600" />
                Questions & Answers
              </h2>
              <div className="space-y-6">
                {results.map((result, index) => (
                  <div
                    key={index}
                    className="result-card border border-gray-200 rounded-lg p-5 hover:shadow-md transition-all"
                  >
                    {/* Question Header */}
                    <div className="flex justify-between items-start mb-3">
                      <h3 className="font-semibold text-lg text-gray-800">
                        Question {index + 1}
                      </h3>
                      {result.score > 0 && (
                        <span className="text-sm px-3 py-1 bg-green-100 text-green-700 rounded-full font-medium">
                          Match: {(result.score * 100).toFixed(1)}%
                        </span>
                      )}
                    </div>

                    {/* Question Text */}
                    <div className="mb-4">
                      <p className="text-gray-700 bg-gray-50 p-3 rounded border border-gray-200">
                        {result.question}
                      </p>
                    </div>

                    {/* Lecture Info */}
                    {result.score > 0 && (
                      <div className="mb-4 border-t pt-3">
                        <p className="text-sm text-gray-600 mb-2">
                          <strong>Found in Lecture:</strong>
                        </p>
                        <div className="flex items-center bg-indigo-50 p-3 rounded border border-indigo-100">
                          <BookOpen className="w-5 h-5 text-indigo-600 mr-2 flex-shrink-0" />
                          <span className="font-medium text-indigo-900">
                            {result.lectureName}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* AI Answer */}
                    <div className="border-t pt-4">
                      <div className="flex items-center mb-3">
                        <Brain className="w-5 h-5 text-purple-600 mr-2" />
                        <p className="text-sm font-semibold text-gray-700">
                          AI-Generated Answer:
                        </p>
                      </div>
                      <div className="answer-box bg-gradient-to-br from-purple-50 to-indigo-50 p-4 rounded-lg border border-purple-200">
                        <p className="text-gray-800 leading-relaxed whitespace-pre-wrap">
                          {result.answer}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}