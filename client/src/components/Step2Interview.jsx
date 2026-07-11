import React, { useState, useRef, useEffect, useCallback } from 'react'
import maleVideo from "../assets/videos/male-ai.mp4"
import femaleVideo from "../assets/videos/female-ai.mp4"
import Timer from './Timer'
import CodingWorkspace from './CodingWorkspace'
import { FaMicrophone, FaMicrophoneSlash, FaVolumeUp, FaVolumeMute } from "react-icons/fa";
import { BsArrowRight, BsExclamationTriangle } from 'react-icons/bs';
import axios from "axios"
import { motion as Motion } from "motion/react"
import { ServerUrl } from '../config'

function Step2Interview({ interviewData, onFinish }) {
  const { interviewId, questions: initialQuestions, userName, mode, interactionMedium = "Voice" } = interviewData;

  const [questionsList, setQuestionsList] = useState(initialQuestions);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [code, setCode] = useState("// Write your solution here...\nfunction solution() {\n  \n}");
  const [feedback, setFeedback] = useState("");
  const [timeLeft, setTimeLeft] = useState(questionsList[0]?.timeLimit || 60);
  const [selectedVoice, setSelectedVoice] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [voiceGender, setVoiceGender] = useState("female");
  const [subtitle, setSubtitle] = useState("");
  const [isIntroPhase, setIsIntroPhase] = useState(true);

  // Microphone and State Machine variables
  const [isMicOn, setIsMicOn] = useState(interactionMedium === "Voice");
  const [micStatus, setMicStatus] = useState("Idle"); // Listening, Speaking, Processing, Idle, Error, Permission Denied, Reconnecting
  const [isAIPlaying, setIsAIPlaying] = useState(false);

  const recognitionRef = useRef(null);
  const videoRef = useRef(null);

  // References to keep event handlers fresh
  const isMicOnRef = useRef(isMicOn);
  const isAIPlayingRef = useRef(isAIPlaying);
  const micStatusRef = useRef(micStatus);
  const isSubmittingRef = useRef(isSubmitting);
  const feedbackRef = useRef(feedback);
  const currentQuestionRef = useRef(questionsList[currentIndex]);

  const lastSpeechTimeRef = useRef(Date.now());
  const aiSpeechStartTimeRef = useRef(0);

  const currentQuestion = questionsList[currentIndex];

  const videoSource = voiceGender === "male" ? maleVideo : femaleVideo;

  // Cleanup transcripts: remove filler words & duplicates
  const cleanTranscript = (text) => {
    if (!text) return "";
    let cleaned = text;

    const fillers = ["uh", "umm", "hmm", "like", "you know", "basically", "actually", "er", "ah"];
    fillers.forEach(filler => {
      const regex = new RegExp(`\\b${filler}\\b`, 'gi');
      cleaned = cleaned.replace(regex, '');
    });

    // Remove consecutive duplicate words
    cleaned = cleaned.replace(/\b(\w+)(?:\s+\1\b)+/gi, '$1');

    // Clean duplicate spaces
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
    return cleaned;
  };

  // STT start/stop handlers
  const startMic = useCallback(() => {
    if (interactionMedium !== "Voice") return;
    if (recognitionRef.current && !isAIPlayingRef.current) {
      try {
        setMicStatus("Listening");
        recognitionRef.current.start();
      } catch (err) {
        console.warn("Speech start failed:", err);
      }
    }
  }, [interactionMedium]);

  const stopMic = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
        setMicStatus("Idle");
      } catch (err) {
        console.warn("Speech stop failed:", err);
      }
    }
  }, []);

  // TTS implementation
  const speakText = useCallback((text) => {
    return new Promise((resolve) => {
      if (interactionMedium !== "Voice" || !window.speechSynthesis) {
        resolve();
        return;
      }

      window.speechSynthesis.cancel();

      // Pacing delays
      const humanText = text
        .replace(/,/g, ", ... ")
        .replace(/\./g, ". ... ");

      const utterance = new SpeechSynthesisUtterance(humanText);
      if (selectedVoice) {
        utterance.voice = selectedVoice;
      }
      utterance.rate = 0.92;
      utterance.pitch = 1.05;
      utterance.volume = 1;

      // Handle speech failover to avoid freezing
      const timeoutId = setTimeout(() => {
        console.warn("TTS Start Timeout. Resolving...");
        setIsAIPlaying(false);
        resolve();
      }, 5000);

      utterance.onstart = () => {
        clearTimeout(timeoutId);
        setIsAIPlaying(true);
        setMicStatus("Idle");
        aiSpeechStartTimeRef.current = Date.now();
        
        // Stop recognition while AI starts speaking (or we keep it running for barge-in, handled below)
        if (recognitionRef.current) {
          try {
            recognitionRef.current.stop();
          } catch (err) {
            console.warn("Speech stop failed:", err);
          }
        }
        
        if (videoRef.current) {
          videoRef.current.play().catch(() => {});
        }
      };

      utterance.onend = () => {
        clearTimeout(timeoutId);
        setIsAIPlaying(false);
        if (videoRef.current) {
          videoRef.current.pause();
          videoRef.current.currentTime = 0;
        }

        setSubtitle("");

        // Auto restart microphone if toggled on
        if (isMicOnRef.current && !isSubmittingRef.current && !feedbackRef.current) {
          startMic();
        }
        
        lastSpeechTimeRef.current = Date.now();
        setTimeout(resolve, 300);
      };

      utterance.onerror = (err) => {
        clearTimeout(timeoutId);
        console.error("SpeechSynthesisUtterance error:", err);
        setIsAIPlaying(false);
        if (videoRef.current) {
          videoRef.current.pause();
        }
        if (isMicOnRef.current) {
          startMic();
        }
        resolve();
      };

      setSubtitle(text);
      window.speechSynthesis.speak(utterance);
    });
  }, [selectedVoice, interactionMedium, startMic]);

  // Microphone toggle button action
  const toggleMic = () => {
    if (micStatus === "Permission Denied") {
      alert("Microphone permission was denied. Please check your browser settings.");
      return;
    }

    if (isMicOn) {
      stopMic();
      setIsMicOn(false);
    } else {
      setIsMicOn(true);
      startMic();
    }
  };

  // Submit current answer to the backend
  const submitAnswer = useCallback(async () => {
    if (isSubmittingRef.current) return;
    
    stopMic();
    setIsSubmitting(true);
    setMicStatus("Processing");

    const submissionAnswer = mode === "Coding" ? code : answer;
    const cleanedAnswer = cleanTranscript(submissionAnswer);

    try {
      const result = await axios.post(ServerUrl + "/api/interview/submit-answer", {
        interviewId,
        questionIndex: currentIndex,
        answer: cleanedAnswer,
        timeTaken: currentQuestionRef.current.timeLimit - timeLeft,
      }, { withCredentials: true });

      setFeedback(result.data.feedback);
      
      // Update our local questions array if a next question was generated dynamically
      if (result.data.nextQuestion) {
        setQuestionsList((prev) => [...prev, result.data.nextQuestion]);
      }

      if (interactionMedium === "Voice") {
        await speakText(result.data.feedback);
      }
    } catch (error) {
      console.error("Answer submission failed:", error);
      alert("Submission failed. Retrying in typing mode.");
    } finally {
      setIsSubmitting(false);
    }
  }, [interviewId, currentIndex, answer, code, mode, timeLeft, interactionMedium, speakText, stopMic]);

  // Complete the interview and render reports
  const finishInterview = async () => {
    stopMic();
    setIsMicOn(false);
    setIsSubmitting(true);
    setMicStatus("Processing");

    try {
      const result = await axios.post(ServerUrl + "/api/interview/finish", { interviewId }, { withCredentials: true });
      onFinish(result.data);
    } catch (error) {
      console.error("Failed to finish interview:", error);
      alert("Failed to compile final report. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Move to next question or trigger completion
  const handleNext = async () => {
    setAnswer("");
    // If coding mode, keep editor contents or reset to a starter template for next problem
    setCode("// Write your solution here...\nfunction solution() {\n  \n}");
    setFeedback("");

    const totalQuestions = 5;

    // Check if we are finished
    if (currentIndex + 1 >= totalQuestions || currentIndex + 1 >= questionsList.length) {
      finishInterview();
      return;
    }

    const nextIdx = currentIndex + 1;
    const nextQuestionItem = questionsList[nextIdx];
    const nextTimeLimit = nextQuestionItem?.timeLimit || (mode === "Coding" ? 180 : 60);

    setCurrentIndex(nextIdx);
    setTimeLeft(nextTimeLimit);

    if (interactionMedium === "Voice") {
      await speakText("Alright, let's move to the next question.");
    }
  };

  /* ----------------- REACT USEEFFECT LIFECYCLE HOOKS ----------------- */

  // Sync refs with state values
  useEffect(() => {
    isMicOnRef.current = isMicOn;
    isAIPlayingRef.current = isAIPlaying;
    micStatusRef.current = micStatus;
    isSubmittingRef.current = isSubmitting;
    feedbackRef.current = feedback;
    currentQuestionRef.current = questionsList[currentIndex];
  }, [isMicOn, isAIPlaying, micStatus, isSubmitting, feedback, questionsList, currentIndex]);

  // Initialize TTS voices
  useEffect(() => {
    if (!window.speechSynthesis) {
      return;
    }

    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      if (!voices.length) return;

      const femaleVoice = voices.find(v =>
        v.name.toLowerCase().includes("zira") ||
        v.name.toLowerCase().includes("samantha") ||
        v.name.toLowerCase().includes("female") ||
        v.name.toLowerCase().includes("google us english")
      );

      if (femaleVoice) {
        setSelectedVoice(femaleVoice);
        setVoiceGender("female");
        return;
      }

      const maleVoice = voices.find(v =>
        v.name.toLowerCase().includes("david") ||
        v.name.toLowerCase().includes("mark") ||
        v.name.toLowerCase().includes("male")
      );

      if (maleVoice) {
        setSelectedVoice(maleVoice);
        setVoiceGender("male");
        return;
      }

      setSelectedVoice(voices[0]);
      setVoiceGender("female");
    };

    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;

    return () => {
      window.speechSynthesis.cancel();
    };
  }, []);

  // Initialize SpeechRecognition
  useEffect(() => {
    if (interactionMedium !== "Voice") return;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn("Speech recognition is not supported in this browser.");
      setMicStatus("Error");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onstart = () => {
      setMicStatus("Listening");
      lastSpeechTimeRef.current = Date.now();
    };

    recognition.onsoundstart = () => {
      setMicStatus("Speaking");
      lastSpeechTimeRef.current = Date.now();
    };

    recognition.onspeechstart = () => {
      setMicStatus("Speaking");
      lastSpeechTimeRef.current = Date.now();
    };

    recognition.onresult = (event) => {
      lastSpeechTimeRef.current = Date.now();
      setMicStatus("Speaking");

      // Handle Barge-in (candidate interrupting AI)
      if (isAIPlayingRef.current) {
        const speakDuration = Date.now() - aiSpeechStartTimeRef.current;
        if (speakDuration > 1500) { // 1.5s barge-in guard delay
          window.speechSynthesis.cancel();
          setIsAIPlaying(false);
          setSubtitle("");
          if (videoRef.current) {
            videoRef.current.pause();
            videoRef.current.currentTime = 0;
          }
          return;
        }
      }

      // Capture final transcription
      let finalTranscript = "";

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        }
      }

      if (finalTranscript) {
        setAnswer((prev) => {
          const nextVal = prev + " " + finalTranscript;
          return nextVal.trim();
        });
      }
    };

    recognition.onerror = (event) => {
      console.error("Speech recognition error:", event.error);
      if (event.error === "not-allowed") {
        setMicStatus("Permission Denied");
        setIsMicOn(false);
      } else if (event.error === "network") {
        setMicStatus("Error");
      }
    };

    recognition.onend = () => {
      // Auto reconnect/restart if mic was supposed to be listening and we are in active answer phase
      if (
        isMicOnRef.current &&
        !isAIPlayingRef.current &&
        !isSubmittingRef.current &&
        !feedbackRef.current &&
        micStatusRef.current !== "Permission Denied"
      ) {
        setMicStatus("Reconnecting");
        setTimeout(() => {
          try {
            recognition.start();
          } catch (err) {
            console.warn("Reconnect start failed:", err);
          }
        }, 300);
      } else if (micStatusRef.current !== "Permission Denied") {
        setMicStatus("Idle");
      }
    };

    recognitionRef.current = recognition;

    if (isMicOn) {
      startMic();
    }

    return () => {
      try {
        recognition.abort();
      } catch (err) {
        console.warn("Abort failed:", err);
      }
    };
  }, [interactionMedium, isMicOn, startMic]);

  // Handle Voice / Chat Setup and Intro Phase Speech
  useEffect(() => {
    // If not Voice, complete intro immediately
    if (interactionMedium !== "Voice") {
      setIsIntroPhase(false);
      return;
    }

    if (!selectedVoice) return;

    const runIntro = async () => {
      if (isIntroPhase) {
        await speakText(`Hi ${userName}, it's great to meet you today. I hope you're feeling confident and ready.`);
        await speakText("I'll ask you a few questions. Just answer naturally, and take your time. Let's begin.");
        setIsIntroPhase(false);
      } else if (currentQuestion) {
        await new Promise(r => setTimeout(r, 600));
        if (currentIndex === questionsList.length - 1) {
          await speakText("Alright, this final question might be a bit more challenging.");
        }
        await speakText(currentQuestion.question);
      }
    };

    runIntro();
  }, [selectedVoice, isIntroPhase, currentIndex, questionsList.length, userName, speakText, interactionMedium, currentQuestion]);

  // Question Timer Countdown
  useEffect(() => {
    if (isIntroPhase) return;
    if (!currentQuestion) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isIntroPhase, currentIndex, currentQuestion]);

  // Silence Detection Loop (Voice Medium only)
  useEffect(() => {
    if (interactionMedium !== "Voice" || isAIPlaying || isSubmitting || feedback || isIntroPhase) {
      return;
    }

    let firstSilenceSpoken = false;
    let secondSilenceSpoken = false;
    lastSpeechTimeRef.current = Date.now();

    const silenceInterval = setInterval(() => {
      const idleTime = Date.now() - lastSpeechTimeRef.current;

      if (idleTime >= 15000) {
        clearInterval(silenceInterval);
        // auto-skip due to silence
        console.warn("Silence limit reached. Skipping...");
        setAnswer("No response.");
        submitAnswer();
      } else if (idleTime >= 10000 && !secondSilenceSpoken) {
        secondSilenceSpoken = true;
        speakText("Would you like me to repeat the question?");
      } else if (idleTime >= 5000 && !firstSilenceSpoken) {
        firstSilenceSpoken = true;
        speakText("I didn't catch that.");
      }
    }, 1000);

    return () => clearInterval(silenceInterval);
  }, [currentIndex, isAIPlaying, isSubmitting, feedback, isIntroPhase, interactionMedium, speakText, submitAnswer]);

  // Handle Question Timeout
  useEffect(() => {
    if (isIntroPhase || !currentQuestion || timeLeft !== 0 || isSubmitting || feedback) return;
    submitAnswer();
  }, [timeLeft, isIntroPhase, currentQuestion, isSubmitting, feedback, submitAnswer]);


  /* ----------------- RENDER CODING WORKSPACE ----------------- */
  if (mode === "Coding") {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col p-4 sm:p-6 md:p-8">
        
        {/* Header bar */}
        <div className="max-w-7xl w-full mx-auto flex items-center justify-between mb-4 px-4 py-3 bg-slate-900 rounded-2xl border border-slate-800">
          <span className="text-emerald-400 font-bold text-lg sm:text-xl">MockVerse IDE</span>
          <div className="flex items-center gap-4 text-slate-400 text-xs sm:text-sm">
            <span className="bg-slate-950 border border-slate-800 px-3 py-1.5 rounded-xl flex items-center gap-1.5">
              Timer: <Timer timeLeft={timeLeft} totalTime={currentQuestion?.timeLimit} inline={true} />
            </span>
            <span className="bg-slate-950 border border-slate-800 px-3 py-1.5 rounded-xl">
              Medium: {interactionMedium}
            </span>
          </div>
        </div>

        {/* Workspace */}
        <div className="max-w-7xl w-full mx-auto flex-1 flex flex-col">
          <CodingWorkspace
            question={currentQuestion?.question}
            code={code}
            setCode={setCode}
            onSubmit={submitAnswer}
            isSubmitting={isSubmitting}
            feedback={feedback}
            onNext={handleNext}
            currentIndex={currentIndex}
            totalQuestions={5}
          />
        </div>
      </div>
    );
  }

  /* ----------------- RENDER VOICE / CHAT WORKSPACE ----------------- */
  return (
    <div className="min-h-screen bg-linear-to-br from-emerald-50 via-white to-teal-100 flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-350 min-h-[80vh] bg-white rounded-3xl shadow-2xl border border-gray-200 flex flex-col lg:flex-row overflow-hidden">

        {/* Video / Subtitle section */}
        {interactionMedium === "Voice" && (
          <div className="w-full lg:w-[35%] bg-white flex flex-col items-center p-6 space-y-6 border-r border-gray-200">
            <div className="w-full max-w-md rounded-2xl overflow-hidden shadow-xl bg-slate-900 aspect-video flex items-center justify-center">
              <video
                src={videoSource}
                key={videoSource}
                ref={videoRef}
                muted
                playsInline
                preload="auto"
                className="w-full h-auto object-cover"
              />
            </div>

            {/* Subtitles showing AI Speech */}
            {subtitle && (
              <div className="w-full max-w-md bg-gray-50 border border-gray-200 rounded-xl p-4 shadow-sm">
                <p className="text-gray-700 text-sm sm:text-base font-medium text-center leading-relaxed">
                  {subtitle}
                </p>
              </div>
            )}

            {/* Status Panel */}
            <div className="w-full max-w-md bg-white border border-gray-200 rounded-2xl shadow-md p-6 space-y-5">
              <div className="flex justify-between items-center text-xs sm:text-sm">
                <span className="text-gray-500">Interview Status</span>
                <span className={`font-semibold ${isAIPlaying ? "text-emerald-600 animate-pulse" : "text-gray-400"}`}>
                  {isAIPlaying ? "AI Speaking" : `Mic: ${micStatus}`}
                </span>
              </div>

              <div className="h-px bg-gray-200"></div>

              <div className="flex justify-center">
                <Timer timeLeft={timeLeft} totalTime={currentQuestion?.timeLimit} />
              </div>

              <div className="h-px bg-gray-200"></div>

              <div className="grid grid-cols-2 gap-6 text-center">
                <div>
                  <span className="text-2xl font-bold text-emerald-600 block">{currentIndex + 1}</span>
                  <span className="text-xs text-gray-400">Current Question</span>
                </div>
                <div>
                  <span className="text-2xl font-bold text-emerald-600 block">5</span>
                  <span className="text-xs text-gray-400">Total Questions</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Chat / Text Left pane spacer if in chat mode */}
        {interactionMedium === "Chat" && (
          <div className="w-full lg:w-[30%] bg-linear-to-b from-emerald-600 to-teal-700 p-8 text-white flex flex-col justify-between">
            <div>
              <h3 className="text-2xl font-bold mb-4">Chat Interview</h3>
              <p className="text-emerald-100 text-sm leading-relaxed mb-6">
                Take your time to type well-structured answers. There is no speech pressure. Focus on correctness and clarity.
              </p>
              <div className="space-y-4">
                <div className="bg-emerald-800/40 p-4 rounded-xl border border-emerald-500/20">
                  <span className="text-xs text-emerald-200 block mb-1">Time Remaining:</span>
                  <div className="text-xl font-bold font-mono">
                    <Timer timeLeft={timeLeft} totalTime={currentQuestion?.timeLimit} inline={true} />
                  </div>
                </div>
              </div>
            </div>
            
            <div className="text-center text-xs text-emerald-200">
              Question {currentIndex + 1} of 5
            </div>
          </div>
        )}

        {/* Right side Question + Input section */}
        <div className="flex-1 flex flex-col p-4 sm:p-6 md:p-8 relative justify-between">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-emerald-600 mb-6">
              AI Smart Interview
            </h2>

            {!isIntroPhase && currentQuestion && (
              <div className="relative mb-6 bg-gray-50 p-4 sm:p-6 rounded-2xl border border-gray-200 shadow-sm">
                <p className="text-xs text-gray-400 mb-2">
                  Question {currentIndex + 1} of 5 ({currentQuestion.difficulty} level)
                </p>
                <div className="text-base sm:text-lg font-semibold text-gray-800 leading-relaxed">
                  {currentQuestion.question}
                </div>
              </div>
            )}

            {isIntroPhase && interactionMedium === "Voice" && (
              <div className="bg-slate-50 border border-slate-200 p-6 rounded-2xl text-center text-gray-600">
                AI Avatar is greeting you. Get ready...
              </div>
            )}
          </div>

          {/* Typing Area */}
          <div className="flex-1 flex flex-col mt-4 min-h-[200px]">
            <textarea
              placeholder="Type your answer here or speak using the microphone..."
              onChange={(e) => setAnswer(e.target.value)}
              value={answer}
              disabled={isSubmitting || !!feedback || isIntroPhase}
              className="flex-1 w-full bg-gray-50 p-4 sm:p-6 rounded-2xl resize-none outline-none border border-gray-200 focus:ring-2 focus:ring-emerald-500 transition text-gray-800 text-sm sm:text-base leading-relaxed"
            />
          </div>

          {/* Controls Footer */}
          {!feedback ? (
            <div className="flex items-center gap-4 mt-6">
              {interactionMedium === "Voice" && (
                <Motion.button
                  onClick={toggleMic}
                  whileTap={{ scale: 0.9 }}
                  disabled={isSubmitting || isIntroPhase}
                  className={`w-12 h-12 sm:w-14 sm:h-14 flex items-center justify-center rounded-full text-white shadow-lg transition-all ${
                    isMicOn ? "bg-red-600 hover:bg-red-700" : "bg-black hover:bg-slate-800"
                  } disabled:opacity-50`}
                >
                  {isMicOn ? <FaMicrophone size={20} className="animate-pulse" /> : <FaMicrophoneSlash size={20} />}
                </Motion.button>
              )}

              <Motion.button
                onClick={submitAnswer}
                disabled={isSubmitting || !answer.trim() || isIntroPhase}
                whileTap={{ scale: 0.95 }}
                className="flex-1 bg-linear-to-r from-emerald-600 to-teal-500 text-white py-3 sm:py-4 rounded-2xl shadow-lg hover:opacity-90 transition font-semibold disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {isSubmitting ? "Evaluating..." : "Submit Answer"}
              </Motion.button>
            </div>
          ) : (
            <Motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-6 bg-emerald-50 border border-emerald-200 p-5 rounded-2xl shadow-sm"
            >
              <div className="flex items-start gap-2.5 mb-4">
                <div className="mt-1">
                  <FaVolumeUp className="text-emerald-600" />
                </div>
                <div>
                  <p className="text-xs text-emerald-600 font-semibold mb-0.5">AI Feedback</p>
                  <p className="text-emerald-800 text-sm sm:text-base font-medium leading-relaxed">
                    {feedback}
                  </p>
                </div>
              </div>

              <button
                onClick={handleNext}
                className="w-full bg-linear-to-r from-emerald-600 to-teal-500 text-white py-3.5 rounded-xl shadow-md hover:opacity-90 transition flex items-center justify-center gap-1 font-semibold text-sm cursor-pointer"
              >
                {currentIndex + 1 >= 5 ? "Finish & Get Report" : "Next Question"} <BsArrowRight size={18} />
              </button>
            </Motion.div>
          )}

          {/* Micro status alerts for voice */}
          {interactionMedium === "Voice" && micStatus === "Permission Denied" && (
            <div className="mt-4 flex items-center gap-2 text-red-600 text-xs sm:text-sm bg-red-50 border border-red-200 p-3 rounded-xl">
              <BsExclamationTriangle size={16} />
              <span>Microphone access was denied. Please reload and allow permission.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default Step2Interview
