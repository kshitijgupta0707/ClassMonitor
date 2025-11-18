
import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { UserProvider } from "./context/userContext.jsx";

// Import pages (we'll create these next)
import Auth from "./pages/auth.jsx";
import Homepage from "./pages/Homepage";
import Lecture from "./pages/Lecture";
import Chatbot from "./pages/Chatbot";
import Notes from "./pages/Notes";

function App() {
  return (
    <UserProvider>
      <Router>
        <div className="App">
          <ToastContainer
            position="top-right"
            autoClose={3000}
            hideProgressBar={false}
            newestOnTop={false}
            closeOnClick
            rtl={false}
            pauseOnFocusLoss
            draggable
            pauseOnHover
            theme="dark"
          />
          <Routes>
            <Route path="/" element={<Auth />} />
            <Route path="/home" element={<Homepage />} />
            <Route path="/lecture" element={<Lecture />} />
            <Route path="/chatbot" element={<Chatbot />} />
            <Route path="/notes" element={<Notes />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </Router>
    </UserProvider>
  );
}

export default App;
