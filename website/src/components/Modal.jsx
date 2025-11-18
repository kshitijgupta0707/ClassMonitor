import React, { useState, useEffect } from "react";
import { X } from "lucide-react";

const Modal = ({ isOpen, onClose, title, initialTags = [], onTagsUpdate }) => {
  const [tags, setTags] = useState([]);
  const [inputValue, setInputValue] = useState("");

  useEffect(() => {
    setTags(initialTags);
  }, [initialTags]);

  const handleAddTag = (e) => {
    e.preventDefault();
    if (inputValue.trim() && !tags.includes(inputValue.trim())) {
      setTags([...tags, inputValue.trim()]);
      setInputValue("");
    }
  };

  const handleRemoveTag = (tagToRemove) => {
    setTags(tags.filter((tag) => tag !== tagToRemove));
  };

  const handleSave = () => {
    onTagsUpdate(tags);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-[#302b63] rounded-lg p-6 w-[90%] max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-white">{title}</h2>
          <X
            className="cursor-pointer text-gray-300 hover:text-white"
            onClick={onClose}
            size={24}
          />
        </div>

        <form onSubmit={handleAddTag} className="mb-4">
          <div className="flex gap-2">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Add a tag..."
              className="flex-1 px-3 py-2 bg-[#24243e] text-white rounded-md border border-yellow-400/30 focus:border-yellow-400 focus:outline-none"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-yellow-400 text-black rounded-md hover:bg-yellow-500 transition"
            >
              Add
            </button>
          </div>
        </form>

        <div className="flex flex-wrap gap-2 mb-4 min-h-[60px] max-h-[200px] overflow-y-auto">
          {tags.map((tag, index) => (
            <div
              key={index}
              className="flex items-center gap-2 px-3 py-1 bg-yellow-400 text-black rounded-full text-sm"
            >
              <span>{tag}</span>
              <X
                className="cursor-pointer hover:text-red-600"
                onClick={() => handleRemoveTag(tag)}
                size={16}
              />
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-yellow-400 text-black rounded-md hover:bg-yellow-500 transition"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
};

export default Modal;