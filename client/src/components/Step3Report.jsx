import React from 'react'
import { FaArrowLeft, FaCheckCircle, FaExclamationTriangle, FaMap, FaUserCheck, FaDownload } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import { motion as Motion } from "motion/react"
import { buildStyles, CircularProgressbar } from 'react-circular-progressbar';
import 'react-circular-progressbar/dist/styles.css';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"

function Step3Report({ report }) {
  const navigate = useNavigate()
  
  if (!report) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500 text-lg animate-pulse">Generating comprehensive report...</p>
      </div>
    );
  }

  const {
    finalScore = 0,
    confidence = 0,
    communication = 0,
    correctness = 0,
    technicalScore = 0,
    communicationScore = 0,
    problemSolvingScore = 0,
    confidenceScore = 0,
    codingScore = 0,
    strengths = [],
    weaknesses = [],
    mistakes = [],
    suggestions = [],
    roadmap = [],
    hiringRecommendation = "",
    questionWiseScore = [],
    mode = "Technical",
    role = "Software Engineer",
    experience = "0 years"
  } = report;

  const questionScoreData = questionWiseScore.map((score, index) => ({
    name: `Q${index + 1}`,
    score: score.score || 0
  }))

  const skillMetrics = [
    { label: "Confidence", value: confidenceScore || confidence },
    { label: "Communication", value: communicationScore || communication },
    { label: "Technical Accuracy", value: technicalScore || correctness },
    { label: "Problem Solving", value: problemSolvingScore || Math.round((confidence + correctness) / 2) },
  ];

  if (mode === "Coding" && (codingScore > 0 || correctness > 0)) {
    skillMetrics.push({ label: "Coding Logic", value: codingScore || correctness });
  }

  const percentage = (finalScore / 10) * 100;

  let advice = "";
  if (finalScore >= 8) {
    advice = "Excellent performance. Maintain confidence and structure. Continue refining clarity and supporting answers with strong real-world examples.";
  } else if (finalScore >= 5) {
    advice = "Good foundation shown. Improve clarity and structure. Practice delivering concise, confident answers with stronger supporting examples.";
  } else {
    advice = "Significant improvement required. Focus on structured thinking, clarity, and confident delivery. Practice answering aloud regularly.";
  }

  // PDF Download Action
  const downloadPDF = () => {
    const doc = new jsPDF("p", "mm", "a4");
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    const contentWidth = pageWidth - margin * 2;
    let currentY = 25;

    // Header
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.setTextColor(16, 185, 129); // Emerald 500
    doc.text("AI Interview Performance Report", pageWidth / 2, currentY, { align: "center" });

    currentY += 4;
    doc.setDrawColor(16, 185, 129);
    doc.setLineWidth(0.8);
    doc.line(margin, currentY, pageWidth - margin, currentY);

    currentY += 10;
    
    // Interview details metadata box
    doc.setFillColor(243, 244, 246);
    doc.roundedRect(margin, currentY, contentWidth, 20, 3, 3, "F");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(75, 85, 99);
    doc.text(`Candidate Role: ${role}`, margin + 6, currentY + 7);
    doc.text(`Experience: ${experience}`, margin + 6, currentY + 14);
    doc.text(`Interview Mode: ${mode}`, margin + 80, currentY + 7);
    doc.text(`Date Generated: ${new Date().toLocaleDateString()}`, margin + 80, currentY + 14);

    currentY += 28;

    // Final Score banner
    doc.setFillColor(240, 253, 244);
    doc.roundedRect(margin, currentY, contentWidth, 18, 4, 4, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(6, 95, 70);
    doc.text(`Overall Score: ${finalScore.toFixed(1)} / 10`, pageWidth / 2, currentY + 11, { align: "center" });

    currentY += 26;

    // Skill Metrics Box
    doc.setFillColor(249, 250, 251);
    doc.roundedRect(margin, currentY, contentWidth, 40, 3, 3, "F");
    doc.setFontSize(11);
    doc.setTextColor(17, 24, 39);
    doc.text("Skill Metrics:", margin + 8, currentY + 8);
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    let xOffset = margin + 8;
    let yOffset = currentY + 16;
    skillMetrics.forEach((metric, index) => {
      doc.text(`- ${metric.label}: ${metric.value}/10`, xOffset, yOffset);
      yOffset += 7;
      if (index === 2) {
        xOffset += 80;
        yOffset = currentY + 16;
      }
    });

    currentY += 48;

    // Hiring Recommendation Banner
    if (hiringRecommendation) {
      doc.setFillColor(254, 243, 199);
      doc.roundedRect(margin, currentY, contentWidth, 15, 3, 3, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(146, 64, 14);
      doc.text(`Hiring Recommendation: ${hiringRecommendation}`, margin + 8, currentY + 9);
      currentY += 22;
    }

    // Advice / Strengths / Weaknesses
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(17, 24, 39);
    doc.text("Professional Advice", margin, currentY);
    currentY += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(75, 85, 99);
    const splitAdvice = doc.splitTextToSize(advice, contentWidth);
    doc.text(splitAdvice, margin, currentY);
    currentY += splitAdvice.length * 5 + 10;

    // Strengths
    if (strengths && strengths.length) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(17, 24, 39);
      doc.text("Key Strengths", margin, currentY);
      currentY += 6;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(75, 85, 99);
      strengths.forEach((str) => {
        const lines = doc.splitTextToSize(`• ${str}`, contentWidth);
        doc.text(lines, margin, currentY);
        currentY += lines.length * 5;
      });
      currentY += 8;
    }

    // Weaknesses & Mistakes
    if (weaknesses && weaknesses.length) {
      if (currentY > 230) {
        doc.addPage();
        currentY = 25;
      }
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(17, 24, 39);
      doc.text("Areas of Improvement & Mistakes", margin, currentY);
      currentY += 6;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(75, 85, 99);
      weaknesses.forEach((wk) => {
        const lines = doc.splitTextToSize(`• ${wk}`, contentWidth);
        doc.text(lines, margin, currentY);
        currentY += lines.length * 5;
      });
      if (mistakes && mistakes.length) {
        mistakes.forEach((mst) => {
          const lines = doc.splitTextToSize(`• Note: ${mst}`, contentWidth);
          doc.text(lines, margin, currentY);
          currentY += lines.length * 5;
        });
      }
      currentY += 8;
    }

    // Learning Roadmap
    if (roadmap && roadmap.length) {
      if (currentY > 220) {
        doc.addPage();
        currentY = 25;
      }
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(17, 24, 39);
      doc.text("Personalized Learning Roadmap", margin, currentY);
      currentY += 6;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(75, 85, 99);
      roadmap.forEach((step, i) => {
        const lines = doc.splitTextToSize(`${i + 1}. ${step}`, contentWidth);
        doc.text(lines, margin, currentY);
        currentY += lines.length * 5;
      });
      currentY += 10;
    }

    // Table of questions
    if (currentY > 180) {
      doc.addPage();
      currentY = 25;
    }

    autoTable(doc, {
      startY: currentY,
      margin: { left: margin, right: margin },
      head: [["#", "Question", "Score", "Feedback"]],
      body: questionWiseScore.map((q, i) => [
        `${i + 1}`,
        q.question,
        `${q.score}/10`,
        q.feedback,
      ]),
      styles: {
        fontSize: 9,
        cellPadding: 4,
        valign: "top",
      },
      headStyles: {
        fillColor: [16, 185, 129],
        textColor: 255,
        halign: "center",
      },
      columnStyles: {
        0: { cellWidth: 10, halign: "center" },
        1: { cellWidth: 60 },
        2: { cellWidth: 18, halign: "center" },
        3: { cellWidth: "auto" },
      },
      alternateRowStyles: {
        fillColor: [249, 250, 251],
      },
    });

    doc.save(`MockVerse_Report_${role.replace(/\s+/g, "_")}.pdf`);
  };

  return (
    <div className='min-h-screen bg-linear-to-br from-gray-50 to-green-50 px-4 sm:px-6 lg:px-10 py-8 text-gray-800'>
      
      {/* Header bar */}
      <div className='mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4'>
        <div className='w-full flex items-start gap-4 flex-wrap'>
          <button
            onClick={() => navigate("/history")}
            className='mt-1 p-3 rounded-full bg-white shadow-md hover:shadow-lg transition-all text-gray-600'
          >
            <FaArrowLeft />
          </button>
          <div>
            <h1 className='text-3xl font-extrabold text-slate-800 leading-tight'>
              Interview Performance Dashboard
            </h1>
            <p className='text-gray-500 mt-1 text-sm sm:text-base'>
              AI-driven insights for {role} ({experience} experience)
            </p>
          </div>
        </div>

        <button
          onClick={downloadPDF}
          className='bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 font-bold text-sm sm:text-base text-nowrap flex items-center gap-2 cursor-pointer'
        >
          <FaDownload size={16} /> Download Detailed PDF
        </button>
      </div>

      {/* Main Grid */}
      <div className='grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8'>
        
        {/* Left Side: Score progress & Skill metrics */}
        <div className='space-y-6'>
          
          {/* Circular Overall Score Card */}
          <Motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-3xl shadow-xl p-8 text-center border border-gray-100"
          >
            <h3 className="text-gray-400 mb-6 text-sm font-semibold tracking-wider uppercase">
              Overall Candidate Score
            </h3>
            <div className='relative w-28 h-28 sm:w-32 sm:h-32 mx-auto'>
              <CircularProgressbar
                value={percentage}
                text={`${finalScore.toFixed(1)}`}
                styles={buildStyles({
                  textSize: "20px",
                  pathColor: "#10b981", // Emerald 500
                  textColor: "#1f2937", // Slate 800
                  trailColor: "#f3f4f6", // Gray 100
                })}
              />
            </div>
            <p className="text-gray-400 mt-4 text-xs font-medium">
              Scaled Score (out of 10)
            </p>
            <div className="mt-5 pt-5 border-t border-gray-100">
              <span className="bg-emerald-50 text-emerald-700 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider">
                {finalScore >= 8 ? "Strong Match" : finalScore >= 5 ? "Good potential" : "Needs work"}
              </span>
            </div>
          </Motion.div>

          {/* Detailed Skill Evaluation Levels */}
          <Motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className='bg-white rounded-3xl shadow-xl p-6 sm:p-8 border border-gray-100'
          >
            <h3 className="text-base sm:text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
              Skill breakdown
            </h3>
            <div className='space-y-6'>
              {skillMetrics.map((s, i) => (
                <div key={i}>
                  <div className='flex justify-between mb-1.5 text-xs sm:text-sm font-semibold'>
                    <span className="text-gray-600">{s.label}</span>
                    <span className='text-emerald-600 font-bold'>{s.value}/10</span>
                  </div>
                  <div className='bg-gray-100 h-2 rounded-full overflow-hidden'>
                    <Motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${s.value * 10}%` }}
                      transition={{ duration: 1, delay: i * 0.15 }}
                      className='bg-emerald-500 h-full rounded-full'
                    />
                  </div>
                </div>
              ))}
            </div>
          </Motion.div>

          {/* Hiring Recommendation banner */}
          {hiringRecommendation && (
            <Motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 p-6 rounded-3xl shadow-md"
            >
              <div className="flex items-center gap-2 text-amber-800 font-bold mb-2">
                <FaUserCheck />
                <span className="text-sm uppercase tracking-wider">Hiring Recommendation</span>
              </div>
              <p className="text-sm font-semibold text-amber-900 leading-relaxed">
                {hiringRecommendation}
              </p>
            </Motion.div>
          )}
        </div>

        {/* Right Side: Strengths, Weaknesses, Roadmap, Trends */}
        <div className='lg:col-span-2 space-y-6'>

          {/* Strengths & Roadmap Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Strengths list */}
            <Motion.div
              initial={{ opacity: 0, x: -15 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-white rounded-3xl p-6 shadow-xl border border-gray-100"
            >
              <h3 className="text-base sm:text-lg font-bold text-slate-800 mb-4 flex items-center gap-2 text-emerald-600">
                <FaCheckCircle /> Strengths & Highlights
              </h3>
              <ul className="space-y-3.5">
                {strengths.length > 0 ? (
                  strengths.map((str, idx) => (
                    <li key={idx} className="text-sm text-gray-600 leading-relaxed flex items-start gap-2">
                      <span className="text-emerald-500 font-bold mt-0.5">•</span>
                      <span>{str}</span>
                    </li>
                  ))
                ) : (
                  <li className="text-sm text-gray-400">Excellent core responses overall.</li>
                )}
              </ul>
            </Motion.div>

            {/* Weaknesses, mistakes & suggestions */}
            <Motion.div
              initial={{ opacity: 0, x: 15 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-white rounded-3xl p-6 shadow-xl border border-gray-100"
            >
              <h3 className="text-base sm:text-lg font-bold text-slate-800 mb-4 flex items-center gap-2 text-rose-600">
                <FaExclamationTriangle /> Development Areas
              </h3>
              <ul className="space-y-3.5">
                {weaknesses.length > 0 ? (
                  weaknesses.map((wk, idx) => (
                    <li key={idx} className="text-sm text-gray-600 leading-relaxed flex items-start gap-2">
                      <span className="text-rose-400 font-bold mt-0.5">•</span>
                      <span>{wk}</span>
                    </li>
                  ))
                ) : (
                  <li className="text-sm text-gray-400">Review answers to optimize details.</li>
                )}
                {mistakes.length > 0 && mistakes[0] !== "None noted." && (
                  <div className="pt-3 mt-3 border-t border-gray-100">
                    <span className="text-xs font-semibold text-rose-600 block mb-1">Key Correction:</span>
                    {mistakes.map((mst, idx) => (
                      <p key={idx} className="text-xs text-gray-500 italic">
                        &quot;{mst}&quot;
                      </p>
                    ))}
                  </div>
                )}
                {suggestions.length > 0 && suggestions[0] !== "None noted." && (
                  <div className="pt-3 mt-3 border-t border-gray-100">
                    <span className="text-xs font-semibold text-emerald-600 block mb-1">Actionable Suggestions:</span>
                    {suggestions.map((sug, idx) => (
                      <p key={idx} className="text-xs text-gray-600 leading-relaxed">
                        • {sug}
                      </p>
                    ))}
                  </div>
                )}
              </ul>
            </Motion.div>
          </div>

          {/* Stepped Learning Roadmap */}
          {roadmap.length > 0 && (
            <Motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-3xl p-6 sm:p-8 shadow-xl border border-gray-100"
            >
              <h3 className="text-base sm:text-lg font-bold text-slate-800 mb-6 flex items-center gap-2 text-indigo-600">
                <FaMap /> Personalized Study Roadmap
              </h3>
              <div className="space-y-6 relative border-l-2 border-indigo-100 pl-6 ml-4">
                {roadmap.map((step, idx) => (
                  <div key={idx} className="relative">
                    <div className="absolute -left-[35px] top-0.5 bg-indigo-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shadow-md">
                      {idx + 1}
                    </div>
                    <p className="text-sm sm:text-base font-semibold text-slate-800 mb-1">Step {idx + 1}</p>
                    <p className="text-sm text-gray-600 leading-relaxed">{step}</p>
                  </div>
                ))}
              </div>
            </Motion.div>
          )}

          {/* Performance Chart Trend */}
          <Motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className='bg-white rounded-3xl shadow-xl p-5 sm:p-8 border border-gray-100'
          >
            <h3 className="text-base sm:text-lg font-bold text-slate-800 mb-6">
              Question Score Trend
            </h3>
            <div className='h-60 sm:h-64'>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={questionScoreData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey="name" stroke="#9ca3af" fontSize={12} />
                  <YAxis domain={[0, 10]} stroke="#9ca3af" fontSize={12} />
                  <Tooltip />
                  <Area
                    type="monotone"
                    dataKey="score"
                    stroke="#10b981"
                    fill="url(#colorScore)"
                    strokeWidth={3}
                  />
                  <defs>
                    <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Motion.div>

          {/* Detailed Question Breakdown list */}
          <Motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className='bg-white rounded-3xl shadow-xl p-5 sm:p-8 border border-gray-100'
          >
            <h3 className="text-base sm:text-lg font-bold text-slate-800 mb-6">
              Detailed Question Breakdown
            </h3>
            <div className='space-y-6'>
              {questionWiseScore.map((q, i) => (
                <div key={i} className='bg-gray-50 p-4 sm:p-6 rounded-2xl border border-gray-200'>
                  <div className='flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 mb-4'>
                    <div className="flex-1">
                      <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">
                        Question {i + 1} ({q.difficulty || "standard"})
                      </p>
                      <p className="font-bold text-slate-800 text-sm sm:text-base leading-relaxed mt-1">
                        {q.question}
                      </p>
                    </div>
                    <div className='bg-emerald-100 text-emerald-800 px-3 py-1.5 rounded-xl font-extrabold text-xs sm:text-sm w-fit self-start'>
                      Score: {q.score}/10
                    </div>
                  </div>

                  {q.answer && (
                    <div className="mb-3 bg-white border border-gray-150 p-3.5 rounded-xl text-xs sm:text-sm text-gray-600 font-mono overflow-x-auto whitespace-pre-wrap max-h-40">
                      <span className="font-semibold text-gray-400 font-sans block mb-1">Your Answer:</span>
                      {q.answer}
                    </div>
                  )}

                  <div className='bg-emerald-50/60 border border-emerald-100 p-4 rounded-xl'>
                    <p className='text-xs text-emerald-700 font-bold uppercase tracking-wider mb-1'>
                      AI Feedback & Evaluation
                    </p>
                    <p className='text-sm text-slate-700 leading-relaxed font-medium'>
                      {q.feedback && q.feedback.trim() !== "" ? q.feedback : "No feedback available."}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </Motion.div>

        </div>
      </div>
    </div>
  )
}

export default Step3Report
