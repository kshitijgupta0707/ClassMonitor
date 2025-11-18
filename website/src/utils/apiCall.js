import axios from "axios";
import { getItem } from "./storage";
import { toast } from "react-toastify";

const getAuthHeaders = () => {
  const token = getItem("token");
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
};

export const GetApiCall = async (url) => {
  try {
    const response = await axios.get(url, {
      headers: getAuthHeaders(),
    });
    return response.data;
  } catch (error) {
    console.error("GET API Error:", error);
    if (error.response?.status === 401) {
      toast.error("Session expired. Please login again.");
      window.location.href = "/";
    }
    throw error;
  }
};

export const PostApiCall = async (url, data) => {
  try {
    const response = await axios.post(url, data, {
      headers: getAuthHeaders(),
    });
    return response.data;
  } catch (error) {
    console.error("POST API Error:", error);
    if (error.response?.status === 401) {
      toast.error("Session expired. Please login again.");
      window.location.href = "/";
    }
    if (error.response?.data?.message) {
      toast.error(error.response.data.message);
    }
    throw error;
  }
};

export const PutApiCall = async (url, data) => {
  try {
    const response = await axios.put(url, data, {
      headers: getAuthHeaders(),
    });
    return response.data;
  } catch (error) {
    console.error("PUT API Error:", error);
    if (error.response?.status === 401) {
      toast.error("Session expired. Please login again.");
      window.location.href = "/";
    }
    throw error;
  }
};

export const DeleteApiCall = async (url, data) => {
  try {
    const response = await axios.delete(url, {
      headers: getAuthHeaders(),
      data: data,
    });
    return response.data;
  } catch (error) {
    console.error("DELETE API Error:", error);
    if (error.response?.status === 401) {
      toast.error("Session expired. Please login again.");
      window.location.href = "/";
    }
    throw error;
  }
};