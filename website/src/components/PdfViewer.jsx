import React, { useState, useEffect } from "react";
import { X, ExternalLink, AlertCircle } from "lucide-react";

const PdfViewer = ({ lecture, onClose }) => {
console.log("Rendering PdfViewer for lecture:", lecture);
  const [loadError, setLoadError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setLoadError(false);
    setIsLoading(true);
    
    // Set a timeout to show error if PDF doesn't load
    const timer = setTimeout(() => {
      if (isLoading) {
        setLoadError(true);
        setIsLoading(false);
      }
    }, 10000); // 10 seconds timeout

    return () => clearTimeout(timer);
  }, [lecture]);

  const handleIframeLoad = () => {
    setIsLoading(false);
    setLoadError(false);
  };

  const handleIframeError = () => {
    setLoadError(true);
    setIsLoading(false);
  };

  // Check if URL is a Google Drive link
  const isGoogleDrive = lecture?.link?.includes("drive.google.com");
  
  // Convert Google Drive links to embed format
  const getEmbedUrl = (url) => {
    if (!url) return "";
    
    if (isGoogleDrive) {
      // Extract file ID from various Google Drive URL formats
      const fileIdMatch = url.match(/[-\w]{25,}/);
      if (fileIdMatch) {
        return `https://drive.google.com/file/d/${fileIdMatch[0]}/preview`;
      }
    }
    // Add view parameters for better PDF display
    return url.includes('?') ? `${url}&embedded=true` : `${url}#view=FitH`;
  };

  const embedUrl = getEmbedUrl(lecture?.link);

  if (!lecture) return null;

  return (
    <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4">
      <div className="w-full h-full max-w-6xl max-h-[90vh] bg-[#302b63] rounded-lg flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-4 bg-[#24243e] rounded-t-lg flex-shrink-0">
          <h2 className="text-xl font-bold text-white truncate mr-4 flex-1">
            {lecture.name}
          </h2>
          <div className="flex gap-2 items-center flex-shrink-0">
            <a
              href={lecture.link}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 bg-yellow-400 text-black px-4 py-2 rounded-md hover:bg-yellow-500 transition text-sm font-medium whitespace-nowrap"
            >
              <ExternalLink size={16} />
              Open in New Tab
            </a>
            <button
              onClick={onClose}
              className="text-white hover:text-yellow-400 p-2 transition"
              title="Close"
            >
              <X size={24} />
            </button>
          </div>
        </div>

        {/* PDF Content */}
        <div className="flex-1 overflow-hidden bg-gray-100 relative">
          {/* Loading Spinner */}
          {isLoading && !loadError && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-100 z-10">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#302b63] mx-auto mb-4"></div>
                <p className="text-gray-600 font-medium">Loading PDF...</p>
                <p className="text-gray-500 text-sm mt-2">This may take a moment</p>
              </div>
            </div>
          )}

          {/* Error Message */}
          {loadError && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-100 z-10">
              <div className="text-center max-w-md p-8">
                <AlertCircle size={48} className="text-yellow-500 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-gray-800 mb-2">
                  Cannot Display PDF in Viewer
                </h3>
                <p className="text-gray-600 mb-4">
                  This PDF cannot be displayed directly in the browser. This commonly happens with:
                </p>
                <ul className="text-left text-gray-600 mb-6 space-y-2">
                  <li>• Google Classroom files (authentication required)</li>
                  <li>• Protected or restricted PDFs</li>
                  <li>• Files with special security settings</li>
                </ul>
                <div className="space-y-3">
                  <a
                    href={lecture.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 bg-yellow-400 text-black px-6 py-3 rounded-md hover:bg-yellow-500 transition font-medium"
                  >
                    <ExternalLink size={20} />
                    Open PDF in New Tab
                  </a>
                  <p className="text-sm text-gray-500">
                    The PDF will open in a new browser tab
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* PDF Iframe */}
          {embedUrl && (
            <iframe
              src={embedUrl}
              className="w-full h-full border-0"
              title="PDF Viewer"
              allow="fullscreen"
              onLoad={handleIframeLoad}
              onError={handleIframeError}
              style={{ display: loadError ? "none" : "block" }}
            />
          )}
        </div>

        {/* Footer with Tips */}
        <div className="p-3 bg-[#24243e] rounded-b-lg text-center text-sm text-gray-400 flex-shrink-0">
          <p className="flex items-center justify-center gap-2">
            <span>💡</span>
            <span>
              If the PDF doesn't load, use the "Open in New Tab" button above
            </span>
          </p>
        </div>
      </div>
    </div>
  );
};

export default PdfViewer;

