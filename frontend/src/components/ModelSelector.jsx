// components/ModelSelector.jsx
import React, { useEffect, useState } from "react";
import { getItem, setItem } from "../utils/storage.js";

// model options: id used in API, label shown to user
const MODELS = [
  { id: "gemini-2.5-flash", label: "Gemini 2.5 (flash)" },
  { id: "gemini-2.1", label: "Gemini 2.1" },
  { id: "gpt-4o-mini", label: "GPT-4o Mini" },
  { id: "gpt-4o", label: "GPT-4o" },
];

export default function ModelSelector({ onChange, defaultModel = "gemini-2.5-flash", disabled = false }) {
  const [model, setModel] = useState(defaultModel);
  const STORAGE_KEY = "selectedModel";

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stored = await getItem(STORAGE_KEY);
        if (!cancelled && stored) setModel(stored);
      } catch (err) {
        // fallback to localStorage if storage wrapper throws
        const ls = typeof window !== "undefined" && window.localStorage?.getItem(STORAGE_KEY);
        if (!cancelled && ls) setModel(ls);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleChange = async (e) => {
    const v = e.target.value;
    setModel(v);
    try {
      await setItem(STORAGE_KEY, v);
    } catch (err) {
      if (typeof window !== "undefined") window.localStorage?.setItem(STORAGE_KEY, v);
    }
    if (typeof onChange === "function") onChange(v);
  };

  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="whitespace-nowrap text-gray-300">Model:</span>
      <select
        aria-label="Select AI model"
        value={model}
        onChange={handleChange}
        disabled={disabled}
        className="px-2 py-1 rounded bg-[#302b63] text-white border border-yellow-400"
      >
        {MODELS.map((m) => (
          <option key={m.id} value={m.id}>
            {m.label}
          </option>
        ))}
      </select>
    </label>
  );
}
