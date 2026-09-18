import React, { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import axios from "axios"
import { ServerUrl } from '../config'
import { FaArrowLeft, FaRedo, FaExclamationCircle } from 'react-icons/fa'

function InterviewHistory() {
    const [interviews, setInterviews] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const navigate = useNavigate()
    const { userData } = useSelector((state) => state.user)

    const getMyInterviews = useCallback(async () => {
        try {
            setLoading(true)
            setError(null)
            const result = await axios.get(ServerUrl + "/api/interview/get-interview", { withCredentials: true })
            if (Array.isArray(result.data)) {
                setInterviews(result.data)
            } else {
                setInterviews([])
            }
        } catch (err) {
            console.error("Error fetching interviews:", err)
            const msg = err?.response?.data?.message || err?.message || "Failed to load interview history"
            setError(msg)
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        getMyInterviews()
    }, [getMyInterviews, userData])

    return (
        <div className='min-h-screen bg-linear-to-br from-gray-50 to-emerald-50 py-10'>
            <div className='w-[90vw] lg:w-[70vw] max-w-[90%] mx-auto'>

                <div className='mb-10 w-full flex items-start gap-4 flex-wrap'>
                    <button
                        onClick={() => navigate("/")}
                        className='mt-1 p-3 rounded-full bg-white shadow hover:shadow-md transition cursor-pointer'
                        title="Back to Home"
                    >
                        <FaArrowLeft className='text-gray-600' />
                    </button>

                    <div>
                        <h1 className='text-3xl font-bold flex-nowrap text-gray-800'>
                            Interview History
                        </h1>
                        <p className='text-gray-500 mt-2'>
                            Track your past interviews and performance reports
                        </p>
                    </div>
                </div>

                {loading ? (
                    <div className='space-y-4'>
                        {[1, 2, 3].map((n) => (
                            <div key={n} className='bg-white p-6 rounded-2xl shadow-md border border-gray-100 animate-pulse flex flex-col md:flex-row justify-between gap-4'>
                                <div className='space-y-3 flex-1'>
                                    <div className='h-5 bg-gray-200 rounded w-1/3'></div>
                                    <div className='h-4 bg-gray-150 rounded w-1/2'></div>
                                    <div className='h-3 bg-gray-100 rounded w-1/4'></div>
                                </div>
                                <div className='h-10 bg-gray-200 rounded w-24 align-self-center'></div>
                            </div>
                        ))}
                    </div>
                ) : error ? (
                    <div className='bg-white p-10 rounded-2xl shadow text-center border border-rose-100'>
                        <FaExclamationCircle className='text-rose-500 text-4xl mx-auto mb-3' />
                        <h3 className='text-lg font-semibold text-gray-800 mb-1'>Unable to load interview history</h3>
                        <p className='text-gray-500 text-sm mb-6'>{error}</p>
                        <div className='flex justify-center gap-4'>
                            <button
                                onClick={getMyInterviews}
                                className='px-6 py-2.5 bg-emerald-600 text-white font-medium text-sm rounded-full shadow hover:bg-emerald-700 transition flex items-center gap-2 cursor-pointer'
                            >
                                <FaRedo /> Retry
                            </button>
                            {!userData && (
                                <button
                                    onClick={() => navigate("/auth")}
                                    className='px-6 py-2.5 bg-gray-800 text-white font-medium text-sm rounded-full shadow hover:bg-black transition cursor-pointer'
                                >
                                    Sign In
                                </button>
                            )}
                        </div>
                    </div>
                ) : interviews.length === 0 ? (
                    <div className='bg-white p-10 rounded-2xl shadow text-center'>
                        <p className='text-gray-500 text-lg mb-4'>
                            No interviews found. Start your first interview to track your progress!
                        </p>
                        <button
                            onClick={() => navigate("/interview")}
                            className='px-6 py-3 bg-emerald-600 text-white font-semibold rounded-full shadow-md hover:bg-emerald-700 transition cursor-pointer'
                        >
                            Start First Interview
                        </button>
                    </div>
                ) : (
                    <div className='grid gap-6'>
                        {interviews.map((item, index) => (
                            <div
                                key={item._id || index}
                                onClick={() => navigate(`/report/${item._id}`)}
                                className='bg-white p-6 rounded-2xl shadow-md hover:shadow-xl transition-all duration-300 cursor-pointer border border-gray-100'
                            >
                                <div className='flex flex-col md:flex-row md:items-center md:justify-between gap-4'>
                                    <div>
                                        <h3 className="text-lg font-semibold text-gray-800">
                                            {item.role}
                                        </h3>

                                        <p className="text-gray-500 text-sm mt-1">
                                            {item.experience} • {item.mode}
                                        </p>

                                        <p className="text-xs text-gray-400 mt-2">
                                            {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : 'N/A'}
                                        </p>
                                    </div>

                                    <div className='flex items-center gap-6'>

                                        {/* SCORE */}
                                        <div className="text-right">
                                            <p className="text-xl font-bold text-emerald-600">
                                                {typeof item.finalScore === 'number' ? item.finalScore.toFixed(1) : '0'}/10
                                            </p>
                                            <p className="text-xs text-gray-400">
                                                Overall Score
                                            </p>
                                        </div>

                                        {/* STATUS BADGE */}
                                        <span
                                            className={`px-4 py-1 rounded-full text-xs font-medium capitalize ${item.status === "completed"
                                                    ? "bg-emerald-100 text-emerald-700"
                                                    : "bg-yellow-100 text-yellow-700"
                                                }`}
                                        >
                                            {item.status || 'in progress'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}

export default InterviewHistory
