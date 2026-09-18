import React, { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import axios from "axios"
import { ServerUrl } from '../config';
import Step3Report from '../components/Step3Report';
import { FaExclamationTriangle, FaRedo, FaArrowLeft } from 'react-icons/fa';

function InterviewReport() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const { userData } = useSelector((state) => state.user)

  const fetchReport = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true)
      setError(null)
      const result = await axios.get(ServerUrl + "/api/interview/report/" + id, { withCredentials: true })
      setReport(result.data)
    } catch (err) {
      console.error("Error fetching report:", err)
      const message = err?.response?.data?.message || err?.message || "Failed to load report"
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetchReport()
  }, [fetchReport, userData])

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
        <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-gray-600 font-medium text-lg animate-pulse">
          Loading Detailed Interview Report...
        </p>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-6 py-12">
        <div className="bg-white p-8 sm:p-10 rounded-3xl shadow-xl max-w-md w-full text-center border border-rose-100">
          <FaExclamationTriangle className="text-rose-500 text-5xl mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Report Not Found</h2>
          <p className="text-gray-500 text-sm mb-6 leading-relaxed">
            {error || "Unable to retrieve the requested interview report."}
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={fetchReport}
              className="px-6 py-3 bg-emerald-600 text-white font-semibold rounded-full shadow hover:bg-emerald-700 transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <FaRedo size={14} /> Try Again
            </button>
            <button
              onClick={() => navigate("/history")}
              className="px-6 py-3 bg-gray-100 text-gray-700 font-semibold rounded-full shadow-sm hover:bg-gray-200 transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <FaArrowLeft size={14} /> Back to History
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <Step3Report report={report} />
}

export default InterviewReport
