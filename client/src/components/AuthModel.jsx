import React, { useEffect } from "react";
import { useSelector } from "react-redux";
import { FaTimes } from "react-icons/fa";
import Auth from "../pages/Auth";

function AuthModel({ onClose }) {
  const { userData } = useSelector((state) => state.user);

  // ✅ Close modal when user logs in
  useEffect(() => {
    if (userData) {
      onClose();
    }
  }, [userData, onClose]);

  // ✅ Disable background scroll when modal open
  useEffect(() => {
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = "auto";
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/30 backdrop-blur-sm px-4">
      
      {/* Modal Box */}
      <div className="relative w-full max-w-md bg-white rounded-xl shadow-lg p-4">

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-gray-500 hover:text-black transition"
        >
          <FaTimes size={18} />
        </button>

        {/* Auth Component */}
        <Auth isModel={true} />

      </div>
    </div>
  );
}

export default AuthModel;