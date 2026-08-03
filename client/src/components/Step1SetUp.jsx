import React from 'react'
import { motion as Motion } from "motion/react"
import {
    FaUserTie,
    FaBriefcase,
    FaFileUpload,
    FaMicrophoneAlt,
    FaChartLine,
    FaArrowRight,
} from "react-icons/fa";
import { useState } from 'react';
import axios from "axios"
import { ServerUrl } from '../config';
import { useDispatch, useSelector } from 'react-redux';
import { setUserData } from '../redux/userSlice';

function Step1SetUp({ onStart }) {
    const { userData } = useSelector((state) => state.user)
    const dispatch = useDispatch()
    const [role, setRole] = useState("");
    const [experience, setExperience] = useState("");
    const [mode, setMode] = useState("Technical");
    const [interactionMedium, setInteractionMedium] = useState("Voice");
    const [totalQuestions, setTotalQuestions] = useState(5);
    const [resumeFile, setResumeFile] = useState(null);
    const [loading, setLoading] = useState(false);
    const [projects, setProjects] = useState([]);
    const [skills, setSkills] = useState([]);
    const [resumeText, setResumeText] = useState("");
    const [analysisDone, setAnalysisDone] = useState(false);
    const [analyzing, setAnalyzing] = useState(false);

    const handleUploadResume = async () => {
        if (!resumeFile || analyzing) return;
        setAnalyzing(true)

        const formdata = new FormData()
        formdata.append("resume", resumeFile)

        try {
            const result = await axios.post(ServerUrl + "/api/interview/resume", formdata, { withCredentials: true })

            console.log(result.data)

            setRole(result.data.role || "");
            setExperience(result.data.experience || "");
            setProjects(result.data.projects || []);
            setSkills(result.data.skills || []);
            setResumeText(result.data.resumeText || "");
            setAnalysisDone(true);

            setAnalyzing(false);

        } catch (error) {
            console.log(error)
            setAnalyzing(false);
        }
    }

    const handleStart = async () => {
        setLoading(true)
        try {
            const result = await axios.post(ServerUrl + "/api/interview/generate-questions", { role, experience, mode, interactionMedium, resumeText, projects, skills, totalQuestions }, { withCredentials: true })
            console.log(result.data)
            if (userData) {
                dispatch(setUserData({ ...userData, credits: result.data.creditsLeft }))
            }
            setLoading(false)
            onStart(result.data)

        } catch (error) {
            console.log(error)
            setLoading(false)
        }
    }

    return (
        <Motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4 }}
            className='h-screen max-h-screen w-full flex items-center justify-center bg-gradient-to-b from-slate-50 via-gray-50/80 to-slate-100/70 p-3 sm:p-4 md:p-6 overflow-y-auto md:overflow-hidden'>

            <div className='w-full max-w-5xl max-h-[calc(100vh-32px)] bg-white rounded-2xl sm:rounded-[24px] shadow-[0_12px_40px_rgba(15,23,42,0.08),0_2px_6px_rgba(15,23,42,0.04)] border border-gray-100/80 grid md:grid-cols-12 overflow-hidden relative my-auto'>

                {/* Left Feature Panel */}
                <Motion.div
                    initial={{ x: -30, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ duration: 0.5 }}
                    className='relative bg-gradient-to-br from-emerald-50/90 via-teal-50/40 to-slate-50 p-5 sm:p-6 md:p-7 flex flex-col justify-between overflow-hidden md:col-span-5 border-r border-emerald-100/60'>

                    {/* Decorative Ambient Blur */}
                    <div className="absolute -top-16 -left-16 w-48 h-48 bg-emerald-200/35 rounded-full blur-3xl pointer-events-none" />
                    <div className="absolute -bottom-16 -right-16 w-48 h-48 bg-teal-200/30 rounded-full blur-3xl pointer-events-none" />

                    <div className="relative z-10">
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-100/80 border border-emerald-200/60 text-emerald-800 text-[10px] font-semibold tracking-wide mb-3">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            AI-POWERED INTERVIEW
                        </div>

                        <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight leading-snug mb-2">
                            Start Your AI Interview
                        </h2>

                        <p className="text-slate-600 text-xs sm:text-sm leading-relaxed mb-5 font-normal">
                            Practice real interview scenarios powered by AI. Improve communication, technical skills, and build confidence.
                        </p>

                        <div className='space-y-2.5'>
                            {[
                                {
                                    icon: <FaUserTie className="text-emerald-600 text-sm" />,
                                    text: "Choose Role & Experience",
                                },
                                {
                                    icon: <FaMicrophoneAlt className="text-emerald-600 text-sm" />,
                                    text: "Smart Voice Interview",
                                },
                                {
                                    icon: <FaChartLine className="text-emerald-600 text-sm" />,
                                    text: "Performance Analytics",
                                },
                            ].map((item, index) => (
                                <Motion.div key={index}
                                    initial={{ y: 15, opacity: 0 }}
                                    animate={{ y: 0, opacity: 1 }}
                                    transition={{ delay: 0.15 + index * 0.1 }}
                                    whileHover={{ y: -1 }}
                                    className='flex items-center space-x-3 bg-white/90 backdrop-blur-sm p-2.5 px-3.5 rounded-xl border border-emerald-100/80 shadow-2xs hover:border-emerald-200 transition-all duration-200'>
                                    <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
                                        {item.icon}
                                    </div>
                                    <span className='text-slate-700 text-xs font-semibold'>{item.text}</span>
                                </Motion.div>
                            ))}
                        </div>
                    </div>

                    <div className="relative z-10 mt-5 pt-4 border-t border-emerald-200/50 flex items-center justify-between text-[11px] text-slate-500 font-medium">
                        <span>Real-Time Evaluation</span>
                        <span className="text-emerald-600 font-semibold">• Ready to Start</span>
                    </div>
                </Motion.div>

                {/* Right Setup Form Panel */}
                <Motion.div
                    initial={{ x: 30, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ duration: 0.5 }}
                    className="p-5 sm:p-6 md:p-7 bg-white md:col-span-7 flex flex-col justify-center overflow-y-auto md:overflow-hidden">

                    <div className="mb-3.5">
                        <h2 className='text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight'>
                            Interview Setup
                        </h2>
                        <p className="text-[11px] text-slate-500 mt-0.5">Configure your target role and assessment preferences</p>
                    </div>

                    <div className='space-y-2.5 sm:space-y-3'>
                        {/* Target Role Input */}
                        <div>
                            <label className="text-[11px] font-semibold text-slate-700 block mb-1">Target Role</label>
                            <div className='relative flex items-center'>
                                <FaUserTie className='absolute left-3.5 text-slate-400 text-xs pointer-events-none' />
                                <input type='text' placeholder='Enter role (e.g. Frontend Engineer)'
                                    className='w-full h-[48px] pl-9 pr-3.5 border border-slate-200 rounded-xl focus:border-emerald-500 focus:ring-3 focus:ring-emerald-500/10 outline-none transition-all text-xs sm:text-sm text-slate-800 placeholder:text-slate-400 bg-slate-50/30 focus:bg-white'
                                    onChange={(e) => setRole(e.target.value)} value={role} />
                            </div>
                        </div>

                        {/* Experience Input */}
                        <div>
                            <label className="text-[11px] font-semibold text-slate-700 block mb-1">Experience Level</label>
                            <div className='relative flex items-center'>
                                <FaBriefcase className='absolute left-3.5 text-slate-400 text-xs pointer-events-none' />
                                <input type='text' placeholder='Experience (e.g. 2 years)'
                                    className='w-full h-[48px] pl-9 pr-3.5 border border-slate-200 rounded-xl focus:border-emerald-500 focus:ring-3 focus:ring-emerald-500/10 outline-none transition-all text-xs sm:text-sm text-slate-800 placeholder:text-slate-400 bg-slate-50/30 focus:bg-white'
                                    onChange={(e) => setExperience(e.target.value)} value={experience} />
                            </div>
                        </div>

                        {/* Interview Mode Select */}
                        <div>
                            <label className="text-[11px] font-semibold text-slate-700 block mb-1">Interview Mode</label>
                            <select value={mode}
                                onChange={(e) => setMode(e.target.value)}
                                className='w-full h-[48px] px-3.5 border border-slate-200 rounded-xl focus:border-emerald-500 focus:ring-3 focus:ring-emerald-500/10 outline-none transition-all text-xs sm:text-sm text-slate-800 font-medium bg-slate-50/30 focus:bg-white cursor-pointer'>
                                <option value="Technical">Technical Interview</option>
                                <option value="HR">HR Interview</option>
                                <option value="Coding">Coding Interview</option>
                            </select>
                        </div>

                        {/* Interaction Medium Select */}
                        <div>
                            <label className="text-[11px] font-semibold text-slate-700 block mb-1">Interaction Medium</label>
                            <select value={interactionMedium}
                                onChange={(e) => setInteractionMedium(e.target.value)}
                                className='w-full h-[48px] px-3.5 border border-slate-200 rounded-xl focus:border-emerald-500 focus:ring-3 focus:ring-emerald-500/10 outline-none transition-all text-xs sm:text-sm text-slate-800 font-medium bg-slate-50/30 focus:bg-white cursor-pointer'>
                                <option value="Voice">Smart Voice Interaction</option>
                                <option value="Chat">Text Chat / Typing Only</option>
                            </select>
                        </div>

                        {/* Number of Questions Select */}
                        <div>
                            <label className="text-[11px] font-semibold text-slate-700 block mb-1">Number of Questions</label>
                            <select value={totalQuestions}
                                onChange={(e) => setTotalQuestions(Number(e.target.value))}
                                className='w-full h-[48px] px-3.5 border border-slate-200 rounded-xl focus:border-emerald-500 focus:ring-3 focus:ring-emerald-500/10 outline-none transition-all text-xs sm:text-sm text-slate-800 font-medium bg-slate-50/30 focus:bg-white cursor-pointer'>
                                <option value={5}>5 Questions</option>
                                <option value={10}>10 Questions</option>
                            </select>
                        </div>

                        {/* Resume Upload Box */}
                        {!analysisDone && (
                            <Motion.div
                                whileHover={{ y: -1 }}
                                whileTap={{ scale: 0.99 }}
                                onClick={() => document.getElementById("resumeUpload").click()}
                                className='border border-dashed border-slate-300 rounded-xl p-2.5 sm:p-3 text-center cursor-pointer hover:border-emerald-500 hover:bg-emerald-50/40 transition-all duration-200 bg-slate-50/40 group'>

                                <div className="w-7 h-7 rounded-full bg-emerald-100/70 text-emerald-600 flex items-center justify-center mx-auto mb-1 group-hover:scale-105 transition-transform duration-200">
                                    <FaFileUpload className='text-xs' />
                                </div>

                                <input type="file"
                                    accept="application/pdf"
                                    id="resumeUpload"
                                    className='hidden'
                                    onChange={(e) => setResumeFile(e.target.files[0])} />

                                <p className='text-xs font-semibold text-slate-700 leading-tight'>
                                    {resumeFile ? resumeFile.name : "Click to upload resume (Optional)"}
                                </p>
                                <p className="text-[10px] text-slate-400 mt-0.5 leading-tight">
                                    {resumeFile ? "File selected • Click below to analyze" : "Auto-extracts role, skills, and projects"}
                                </p>

                                {resumeFile && (
                                    <Motion.button
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleUploadResume();
                                        }}
                                        className='mt-2 bg-slate-900 hover:bg-slate-800 text-white px-3 py-1 rounded-lg text-[11px] font-semibold transition-all shadow-2xs'>
                                        {analyzing ? "Analyzing..." : "Analyze Resume"}
                                    </Motion.button>
                                )}
                            </Motion.div>
                        )}

                        {/* Resume Analysis Result */}
                        {analysisDone && (
                            <Motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className='bg-emerald-50/50 border border-emerald-200/70 rounded-xl p-3 space-y-2 text-xs'>
                                <div className="flex items-center justify-between">
                                    <h3 className='font-bold text-slate-800 text-xs'>Resume Analysis Result</h3>
                                    <span className="text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full font-semibold text-[10px]">✓ Analyzed</span>
                                </div>

                                {projects.length > 0 && (
                                    <div>
                                        <p className='font-semibold text-slate-700 mb-0.5 text-[11px]'>Projects:</p>
                                        <ul className='list-disc list-inside text-slate-600 text-[11px] space-y-0.5'>
                                            {projects.map((p, i) => (
                                                <li key={i}>{p}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                {skills.length > 0 && (
                                    <div>
                                        <p className='font-semibold text-slate-700 mb-0.5 text-[11px]'>Skills:</p>
                                        <div className='flex flex-wrap gap-1'>
                                            {skills.map((s, i) => (
                                                <span key={i} className='bg-white border border-emerald-200 text-emerald-800 px-2 py-0.5 rounded-md font-medium text-[10px] shadow-2xs'>{s}</span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </Motion.div>
                        )}

                        {/* Start Interview Button */}
                        <div className="pt-1">
                            <Motion.button
                                onClick={handleStart}
                                disabled={!role || !experience || loading}
                                whileHover={{ y: -1 }}
                                whileTap={{ scale: 0.98 }}
                                className='w-full h-[48px] disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed disabled:shadow-none disabled:transform-none bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 shadow-[0_4px_14px_rgba(15,23,42,0.15)] flex items-center justify-center gap-2 group cursor-pointer'>
                                <span>{loading ? "Starting..." : "Start Interview"}</span>
                                {!loading && <FaArrowRight className="text-xs transition-transform duration-200 group-hover:translate-x-1" />}
                            </Motion.button>
                        </div>
                    </div>
                </Motion.div>
            </div>
        </Motion.div>
    )
}

export default Step1SetUp
