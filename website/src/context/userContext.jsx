import React, { createContext, useState } from "react";

export const UserContext = createContext();

export const UserProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [selectedLecture, setSelectedLecture] = useState(null);
  const [selectedLectureId, setSelectedLectureId] = useState(null);

  return (
    <UserContext.Provider
      value={{
        user,
        setUser,
        selectedCourse,
        setSelectedCourse,
        selectedLecture,
        setSelectedLecture,
        selectedLectureId,
        setSelectedLectureId,
      }}
    >
      {children}
    </UserContext.Provider>
  );
};