import React, { useState, useContext, useEffect } from "react";
import {
  ArrowLeft,
  Bot,
  MoreVertical,
  ChevronDown,
  NotebookPen,
} from "lucide-react";
import { UserContext } from "../context/userContext";
import { useNavigate } from "react-router-dom";
import { PostApiCall } from "../utils/apiCall";
import Skeleton, { SkeletonTheme } from "react-loading-skeleton";
import Modal from "../components/Modal";
import { toast } from "react-toastify";

const Classroom = () => {
  // ------------------ STATE ------------------
  const [activeTab, setActiveTab] = useState("lectures");
  const [showFilter, setShowFilter] = useState(false);
  const [showOptionsMenu, setShowOptionsMenu] = useState(null);

  const [lectures, setLectures] = useState([]);
  const [tagsByLecture, setTagsByLecture] = useState([]);
  const [loading, setLoading] = useState(true);

  const [selectedFilter, setSelectedFilter] = useState(null);
  const [isOpen, setIsOpen] = useState(false); // modal open
  const [modalLectureId, setModalLectureId] = useState(null); // which lecture modal is for

  const { user, selectedCourse, setSelectedLecture, setSelectedLectureId } =
    useContext(UserContext);

  const navigate = useNavigate();

  // ------------------ FETCH LECTURES + TAGS ------------------
  useEffect(() => {
    if (!selectedCourse) {
      navigate("/home");
      return;
    }

    const loadData = async () => {
      try {
        const [lecturesRes, tagsRes] = await Promise.all([
          PostApiCall("http://localhost:8000/api/lecture/getLectures", {
            courseId: selectedCourse._id,
            batch: user.batch,
            branch: user.branch,
          }),
          PostApiCall("http://localhost:8000/api/tag/getAllTags", {
            courseID: selectedCourse._id,
            userID: user._id,
          }),
        ]);

        setLectures(lecturesRes.data);
        setTagsByLecture(tagsRes.data.groupedByLecture);
      } catch (err) {
        console.error("Error loading data:", err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // ------------------ ALL TAGS (computed) ------------------
  const allTags = [...new Set(tagsByLecture.flatMap((t) => t.tags))];

  // ------------------ FILTERED LECTURES ------------------
  const filteredLectures = selectedFilter
    ? lectures.filter((lec) => {
        const tagObj = tagsByLecture.find((t) => t.lectureId === lec._id);
        return tagObj?.tags.includes(selectedFilter);
      })
    : lectures;

  // ------------------ MANAGE TAGS HANDLER ------------------
  const handleManageTags = (lectureId) => {
    setModalLectureId(lectureId);
    setIsOpen(true);
  };

  const handleUpdateTags = async (tags, lectureId) => {
    try {
      const res = await PostApiCall("http://localhost:8000/api/tag", {
        TAGS: tags,
        lectureID: lectureId,
        courseID: selectedCourse._id,
        userID: user._id,
      });

      if (res.success) {
        toast.success("Tags updated successfully!");

        // Re-fetch tags only
        const tagsRes = await PostApiCall(
          "http://localhost:8000/api/tag/getAllTags",
          {
            courseID: selectedCourse._id,
            userID: user._id,
          }
        );

        setTagsByLecture(tagsRes.data.groupedByLecture);
      } else {
        toast.error("Failed to update tags");
      }
    } catch (err) {
      console.error(err);
      toast.error("Error updating tags");
    }
  };

  // ------------------ RENDER FILTER DROPDOWN ------------------
  const renderFilterDropdown = () => {
    if (!showFilter) return null;

    const filterOptions =
      activeTab === "lectures"
        ? allTags
        : activeTab === "assignments"
        ? ["Due", "Missing", "Submitted"]
        : ["Recent", "Important", "All"];

    return (
      <div className="absolute top-8 right-0 rounded-lg w-40 bg-gray-300 shadow-lg z-50">
        {filterOptions.map((option, index) => (
          <button
            key={index}
            className="w-full text-left px-4 py-2 text-black hover:bg-gray-400 cursor-pointer"
            onClick={() => {
              setSelectedFilter(option);
              setShowFilter(false);
            }}
          >
            {option}
          </button>
        ))}
      </div>
    );
  };

  // ------------------ OPTIONS MENU ------------------
  const OptionsMenu = ({ index, url, lectureId }) => {
    if (showOptionsMenu !== index) return null;

    return (
      <div className="absolute right-0 top-6 rounded-lg w-40 bg-gray-300 shadow-lg z-50">
        <p
          className="px-4 py-2 text-black hover:bg-gray-400 cursor-pointer"
          onClick={() => handleManageTags(lectureId)}
        >
          Manage Tags
        </p>

        <a href={url} download>
          <p className="px-4 py-2 text-black hover:bg-gray-400 cursor-pointer">
            Download
          </p>
        </a>
      </div>
    );
  };

  // ------------------ TAB CONTENT ------------------
  const renderContent = () => {
    if (!activeTab) return null;

    if (activeTab === "misc") {
  return (
    <div className="text-center mt-4">
      <button className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
        onClick={() => {
          chrome.tabs.create({ url: "http://localhost:5173/" });
        }}
      >
        Pyq Check
      </button>
    </div>
  );
}


    // ------------------ LECTURES TAB ------------------
    return (
      <>
        <div className="relative flex justify-end flex-col items-end">
          <div
            className="flex p-1 justify-around h-5 items-center mt-2 bg-[#ffd700] w-[18%] rounded-lg cursor-pointer"
            onClick={() => setShowFilter(!showFilter)}
          >
            <p>Filter</p>
            <ChevronDown size={16} />
          </div>
          {renderFilterDropdown()}
        </div>

        {filteredLectures.map((lecture, index) => (
          <div
            key={lecture._id}
            className="flex justify-between my-4 bg-[#92b3b3] p-1 rounded-lg overflow-visible"
          >
            <div className="p-1 w-[70%]">{lecture.name}</div>

            <div className="relative flex justify-around items-center p-1 w-1/4 bg-[#ffd700] rounded-lg h-5">
              <NotebookPen
                size={16}
                className="hover:scale-150 cursor-pointer"
                onClick={() => {
                  setSelectedLecture(lecture);
                  navigate("/notes");
                }}
              />

              <Bot
                size={16}
                className="hover:scale-150 cursor-pointer"
                onClick={() => {
                  setSelectedLecture(lecture);
                  navigate("/chatbot");
                }}
              />

              <MoreVertical
                size={16}
                className="hover:scale-150 cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowOptionsMenu(showOptionsMenu === index ? null : index);
                  setSelectedLectureId(lecture._id);
                }}
              />

              <OptionsMenu
                index={index}
                url={lecture.link}
                lectureId={lecture._id}
              />
            </div>
          </div>
        ))}
      </>
    );
  };

  // ------------------ LOADING SKELETON ------------------
  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen text-white">
        <SkeletonTheme baseColor="#92b3b3" highlightColor="#a8c5c5">
          <Skeleton width={200} height={40} />
          <Skeleton height={400} />
        </SkeletonTheme>
      </div>
    );
  }

  // ------------------ FINAL UI ------------------
  return (
    <div className="flex justify-center items-center min-h-screen bg-gradient-to-b from-[#0f0c29] via-[#302b63] to-[#24243e] text-white">
      <div className="w-[400px]">
        <div className="min-h-[600px] bg-[#24243e] shadow-lg overflow-hidden flex flex-col">

          {/* HEADER */}
          <div className="flex items-center gap-2.5 p-4 bg-[#302b63] border-b border-white/20">
            <ArrowLeft
              className="text-gray-300 hover:text-white cursor-pointer"
              size={20}
              onClick={() => navigate("/home")}
            />
            <h1 className="text-lg font-medium m-0">Your Classrooms</h1>
          </div>

          {/* COURSE NAME */}
          <div className="w-[95%] mx-auto flex justify-center items-center py-4">
            <h3 className="text-xl m-0">{selectedCourse.name}</h3>
          </div>

          {/* TABS */}
          <div className="flex items-center p-4 bg-[#302b63] rounded-lg shadow-inner">
            {["lectures", "misc"].map((tab) => (
              <div
                key={tab}
                className={`w-1/3 flex justify-center cursor-pointer ${
                  activeTab === tab ? "text-[#ffd700]" : "text-white"
                }`}
                onClick={() => setActiveTab(tab)}
              >
                {tab[0].toUpperCase() + tab.slice(1)}
              </div>
            ))}
          </div>

          {/* CONTENT */}
          <div className="p-6 overflow-auto flex-1">{renderContent()}</div>
        </div>
      </div>

      {/* TAG MODAL */}
      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="Manage Tags"
        initialTags={
          tagsByLecture.find((t) => t.lectureId === modalLectureId)?.tags || []
        }
        onTagsUpdate={(tags) => handleUpdateTags(tags, modalLectureId)}
      />
    </div>
  );
};

export default Classroom;
