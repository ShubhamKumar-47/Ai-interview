import React, { useRef } from "react";
import { motion as Motion } from "motion/react";
import { BsLightbulb, BsArrowRight } from "react-icons/bs";
import { FaCode } from "react-icons/fa";

function CodingWorkspace({
  question,
  code,
  setCode,
  onSubmit,
  isSubmitting,
  feedback,
  onNext,
  currentIndex,
  totalQuestions,
}) {
  const textareaRef = useRef(null);
  const lineNumbersRef = useRef(null);

  // Sync scroll between textarea and line numbers sidebar
  const handleScroll = (e) => {
    if (lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = e.target.scrollTop;
    }
  };

  // Keep line count in sync with code text
  const lineCount = Math.max(code.split("\n").length, 1);

  // Support Tab key override inside the editor
  const handleKeyDown = (e) => {
    if (e.key === "Tab") {
      e.preventDefault();
      const start = e.target.selectionStart;
      const end = e.target.selectionEnd;
      const val = e.target.value;

      // Insert 2 spaces for tab
      const newCode = val.substring(0, start) + "  " + val.substring(end);
      setCode(newCode);

      // Restore cursor position
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.selectionStart = textareaRef.current.selectionEnd = start + 2;
        }
      }, 0);
    }
  };

  // Generate list of line numbers
  const lineNumbers = Array.from({ length: lineCount }, (_, i) => i + 1);

  return (
    <div className="flex-1 flex flex-col lg:flex-row bg-slate-950 text-slate-100 rounded-3xl overflow-hidden shadow-2xl border border-slate-800">
      
      {/* Left Pane: Challenge & AI Feedback */}
      <div className="w-full lg:w-[45%] p-6 flex flex-col border-b lg:border-b-0 lg:border-r border-slate-800 overflow-y-auto max-h-[80vh] lg:max-h-none">
        
        {/* Progress header */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-2 text-emerald-400">
            <FaCode size={18} />
            <span className="font-semibold tracking-wider text-xs uppercase">Coding Challenge</span>
          </div>
          <span className="text-xs bg-slate-800 px-3 py-1 rounded-full text-slate-400">
            Problem {currentIndex + 1} of {totalQuestions}
          </span>
        </div>

        {/* Problem description */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 mb-6">
          <p className="text-sm text-slate-400 font-semibold mb-2">Instructions:</p>
          <div className="text-slate-200 text-sm sm:text-base leading-relaxed whitespace-pre-line">
            {question}
          </div>
        </div>

        {/* AI Hints & Feedback Area */}
        <div className="flex-1 space-y-4">
          {feedback && (
            <Motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-emerald-950/40 border border-emerald-900 p-5 rounded-2xl"
            >
              <div className="flex items-center gap-2 text-emerald-400 mb-2 font-semibold text-xs sm:text-sm">
                <BsLightbulb size={18} />
                <span>AI Guidance & Hints</span>
              </div>
              <p className="text-emerald-200 text-sm leading-relaxed">{feedback}</p>
            </Motion.div>
          )}

          {/* Tips for candidate */}
          {!feedback && (
            <div className="bg-slate-900/40 border border-slate-800/60 p-4 rounded-xl text-xs text-slate-400 leading-relaxed">
              <span className="font-semibold text-slate-300 block mb-1">Architect Tips:</span>
              Write clean modular code, state time and space complexity, handle edge cases, and add comments explaining key logic.
            </div>
          )}
        </div>

        {/* Navigation / Next question in feedback mode */}
        {feedback && (
          <div className="mt-6 pt-4 border-t border-slate-900">
            <button
              onClick={onNext}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-3 rounded-xl shadow-md transition flex items-center justify-center gap-1 font-semibold"
            >
              Proceed to Next <BsArrowRight size={18} />
            </button>
          </div>
        )}
      </div>

      {/* Right Pane: Monospace IDE */}
      <div className="flex-1 flex flex-col bg-slate-900 p-4 relative min-h-[400px] lg:min-h-0">
        
        {/* Editor header bar */}
        <div className="flex justify-between items-center mb-3 bg-slate-950 px-4 py-2 rounded-xl border border-slate-800">
          <span className="text-xs text-slate-400 font-mono">index.js</span>
          <span className="text-xs text-slate-400 bg-slate-900 px-3 py-1 rounded font-mono">
            JS / Python / Generic
          </span>
        </div>

        {/* Main Monospace editor */}
        <div className="flex-1 flex bg-slate-950 border border-slate-800 rounded-xl overflow-hidden font-mono text-sm relative">
          
          {/* Line Numbers sidebar */}
          <div
            ref={lineNumbersRef}
            className="w-12 bg-slate-950/80 border-r border-slate-800 text-slate-600 text-right pr-3 pt-3 select-none overflow-hidden"
          >
            {lineNumbers.map((num) => (
              <div key={num} className="leading-6 h-6">
                {num}
              </div>
            ))}
          </div>

          {/* Text Area Input */}
          <textarea
            ref={textareaRef}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onScroll={handleScroll}
            onKeyDown={handleKeyDown}
            disabled={isSubmitting || !!feedback}
            placeholder="// Write your code solution here...&#10;// Make sure to include time/space complexity comments."
            className="flex-1 bg-transparent resize-none p-3 outline-none text-slate-100 caret-emerald-400 leading-6 h-full overflow-y-auto whitespace-pre font-mono"
            style={{ tabSize: 2 }}
          />
        </div>

        {/* Actions bottom bar */}
        {!feedback && (
          <div className="mt-4 flex items-center gap-4">
            <Motion.button
              onClick={onSubmit}
              disabled={isSubmitting || !code.trim()}
              whileTap={{ scale: 0.98 }}
              className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-white py-3.5 rounded-xl shadow-lg transition font-semibold text-sm cursor-pointer"
            >
              {isSubmitting ? "Evaluating Solution..." : "Submit Code Solution"}
            </Motion.button>
          </div>
        )}
      </div>

    </div>
  );
}

export default CodingWorkspace;
