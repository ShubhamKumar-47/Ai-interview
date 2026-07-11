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

// 🤖 Explicit Voice State transition rules
const VALID_TRANSITIONS = {
  IDLE: ["LISTENING", "PROCESSING", "SPEAKING", "ERROR", "RECONNECTING"],
  LISTENING: ["PROCESSING", "SPEAKING", "STOPPING", "ERROR", "IDLE"],
  PROCESSING: ["SPEAKING", "IDLE", "LISTENING"],
  SPEAKING: ["STOPPING", "IDLE", "LISTENING"],
  STOPPING: ["IDLE", "LISTENING", "RECONNECTING", "SPEAKING"],
  ERROR: ["RECONNECTING", "IDLE", "LISTENING"],
  RECONNECTING: ["LISTENING", "STOPPING", "IDLE", "ERROR", "SPEAKING"]
};

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

  // Custom loading message and timer lifecycle guards
  const [loadingMessage, setLoadingMessage] = useState("");
  const timerHandledRef = useRef(false);
  const autoNextTimeoutRef = useRef(null);

  // Microphone and State Machine variables
  const [isMicOn, setIsMicOn] = useState(interactionMedium === "Voice");
  const [micStatus, setMicStatus] = useState("Idle"); // Listening, Speaking, Processing, Idle, Error, Permission Denied, Reconnecting
  const [isAIPlaying, setIsAIPlaying] = useState(false);

  // 🤖 Voice state machine tracking
  const [voiceState, setVoiceState] = useState("IDLE");
  const voiceStateRef = useRef("IDLE");

  // Sync ref immediately to block asynchronous SpeechSynthesis queuing delays
  const isAISpeakingRef = useRef(false);

  // Sync ref to track native SpeechRecognition active state in browser thread
  const isRecognitionActiveRef = useRef(false);

  const transitionVoiceState = (nextState) => {
    const currentState = voiceStateRef.current;
    
    // 1. Filter out duplicate states
    if (currentState === nextState) {
      return;
    }

    // 2. Enforce transition rules
    const allowed = VALID_TRANSITIONS[currentState]?.includes(nextState);
    if (!allowed) {
      console.warn(`[Voice] Blocked illegal state transition: ${currentState} → ${nextState}`);
      return;
    }

    console.log(`[Voice] ${currentState} → ${nextState}`);
    voiceStateRef.current = nextState;
    setVoiceState(nextState);

    // Sync isAIPlaying state
    if (nextState === "SPEAKING") {
      setIsAIPlaying(true);
    } else {
      setIsAIPlaying(false);
    }
  };

  const recognitionRef = useRef(null);
  const videoRef = useRef(null);

  // References to keep event handlers fresh
  const isMicOnRef = useRef(isMicOn);
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

  // Explicit, thread-safe SpeechRecognition triggers
  const safeStartRecognition = useCallback(() => {
    if (interactionMedium !== "Voice") return;
    if (!recognitionRef.current) return;
    
    // Check native browser state to prevent InvalidStateError
    if (isRecognitionActiveRef.current) {
      console.log("[Voice] recognition.start() skipped because recognition is already active in the browser thread.");
      return;
    }
    
    // Only allow starting if current state is IDLE, ERROR, or RECONNECTING
    if (voiceStateRef.current !== "IDLE" && voiceStateRef.current !== "ERROR" && voiceStateRef.current !== "RECONNECTING") {
      console.log(`[Voice] Prevented duplicate start. Current state is: ${voiceStateRef.current}`);
      return;
    }

    try {
      isRecognitionActiveRef.current = true;
      transitionVoiceState("LISTENING");
      recognitionRef.current.start();
      console.log("[Voice] recognition.start() executed successfully.");
    } catch (err) {
      console.error("[Voice] recognition.start() failed:", err);
      isRecognitionActiveRef.current = false;
      transitionVoiceState("IDLE");
    }
  }, [interactionMedium]);

  const safeStopRecognition = useCallback(() => {
    if (!recognitionRef.current) return;
    if (voiceStateRef.current === "IDLE" || voiceStateRef.current === "STOPPING") return;

    try {
      transitionVoiceState("STOPPING");
      recognitionRef.current.stop();
      console.log("[Voice] recognition.stop() executed.");
    } catch (err) {
      console.warn("[Voice] stop() failed:", err);
      transitionVoiceState("IDLE");
    }
  }, []);

  const safeAbortRecognition = useCallback(() => {
    if (!recognitionRef.current) return;
    if (voiceStateRef.current === "IDLE" || voiceStateRef.current === "STOPPING") return;

    try {
      transitionVoiceState("STOPPING");
      recognitionRef.current.abort();
      console.log("[Voice] recognition.abort() executed.");
    } catch (err) {
      console.warn("[Voice] abort() failed:", err);
      transitionVoiceState("IDLE");
    }
  }, []);

  // Wait helper for SpeechSynthesis to resolve pending states
  const waitSpeechSynthesisReady = async () => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    
    let attempts = 0;
    while ((window.speechSynthesis.speaking || window.speechSynthesis.pending) && attempts < 10) {
      await new Promise((r) => setTimeout(r, 100));
      attempts++;
    }
    console.log(`[Voice] SpeechSynthesis clean after ${attempts * 100}ms.`);
  };

  // TTS implementation
  const speakText = useCallback(async (text) => {
    if (interactionMedium !== "Voice" || !window.speechSynthesis) {
      return;
    }

    // Set immediate lock to override asynchronous speak latency
    isAISpeakingRef.current = true;
    transitionVoiceState("SPEAKING");
    
    // Turn off listening before speaking (mutually exclusive)
    if (recognitionRef.current && voiceStateRef.current !== "IDLE") {
      safeAbortRecognition();
    }

    await waitSpeechSynthesisReady();

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

    return new Promise((resolve) => {
      // Safety failover fallback timeout
      const timeoutId = setTimeout(() => {
        console.warn("[Voice] TTS timed out. Resolving...");
        isAISpeakingRef.current = false;
        transitionVoiceState("IDLE");
        resolve();
      }, 8005);

      utterance.onstart = () => {
        clearTimeout(timeoutId);
        aiSpeechStartTimeRef.current = Date.now();
        if (videoRef.current) {
          videoRef.current.play().catch(() => {});
        }
      };

      utterance.onend = () => {
        clearTimeout(timeoutId);
        if (videoRef.current) {
          videoRef.current.pause();
          videoRef.current.currentTime = 0;
        }

        setSubtitle("");
        isAISpeakingRef.current = false;
        transitionVoiceState("IDLE");

        // Restart microphone if mic is toggled ON
        if (isMicOnRef.current && !isSubmittingRef.current && !feedbackRef.current) {
          safeStartRecognition();
        }
        
        lastSpeechTimeRef.current = Date.now();
        resolve();
      };

      utterance.onerror = (err) => {
        clearTimeout(timeoutId);
        if (err.error === "interrupted") {
          console.log("[Voice] Speech synthesis was interrupted intentionally (barge-in or navigation).");
        } else {
          console.error("[Voice] SpeechSynthesisUtterance error:", err);
        }
        if (videoRef.current) {
          videoRef.current.pause();
        }
        setSubtitle("");
        isAISpeakingRef.current = false;
        transitionVoiceState("IDLE");

        if (isMicOnRef.current && !isSubmittingRef.current && !feedbackRef.current) {
          safeStartRecognition();
        }
        resolve();
      };

      setSubtitle(text);
      window.speechSynthesis.speak(utterance);
    });
  }, [selectedVoice, interactionMedium, safeStartRecognition, safeAbortRecognition]);

  // Complete the interview and render reports
  const finishInterview = useCallback(async () => {
    safeStopRecognition();
    setIsMicOn(false);
    setIsSubmitting(true);
    setLoadingMessage("Compiling final evaluation... Analyzing overall scores... Generating report...");
    transitionVoiceState("PROCESSING");
    setMicStatus("Processing");

    try {
      const result = await axios.post(ServerUrl + "/api/interview/finish", { interviewId }, { withCredentials: true });
      onFinish(result.data);
    } catch (error) {
      console.error("Failed to finish interview:", error);
      alert("Failed to compile final report. Please try again.");
      transitionVoiceState("IDLE");
    } finally {
      setIsSubmitting(false);
      setLoadingMessage("");
    }
  }, [interviewId, onFinish, safeStopRecognition]);

  // Move to next question or trigger completion
  const handleNext = useCallback(async () => {
    if (autoNextTimeoutRef.current) {
      clearTimeout(autoNextTimeoutRef.current);
      autoNextTimeoutRef.current = null;
    }

    setAnswer("");
    setCode("// Write your solution here...\nfunction solution() {\n  \n}");
    setFeedback("");
    timerHandledRef.current = false;

    const totalQuestions = 5;

    // Check if we are finished
    if (currentIndex + 1 >= totalQuestions || currentIndex + 1 >= questionsList.length) {
      await finishInterview();
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
  }, [currentIndex, questionsList, mode, interactionMedium, finishInterview, speakText]);

  // Submit current answer to the backend
  const submitAnswer = useCallback(async () => {
    if (isSubmittingRef.current) return;
    
    // Lock timer automatically on submit
    timerHandledRef.current = true;
    
    safeStopRecognition();
    setIsSubmitting(true);
    
    // Differentiate between timeout & manual loading text
    if (timeLeft === 0) {
      setLoadingMessage("Time's up! Submitting your answer... Generating next question...");
    } else {
      setLoadingMessage("Evaluating your answer... Generating next question...");
    }
    
    transitionVoiceState("PROCESSING");
    setMicStatus("Processing");

    const submissionAnswer = mode === "Coding" ? code : answer;
    const cleanedAnswer = cleanTranscript(submissionAnswer);

    try {
      const result = await axios.post(ServerUrl + "/api/interview/submit-answer", {
        interviewId,
        questionIndex: currentIndex,
        answer: cleanedAnswer || "No response.",
        timeTaken: currentQuestionRef.current.timeLimit - timeLeft,
      }, { withCredentials: true });

      setFeedback(result.data.feedback);
      
      // Update our local questions array if a next question was generated dynamically
      if (result.data.nextQuestion) {
        setQuestionsList((prev) => [...prev, result.data.nextQuestion]);
      }

      if (interactionMedium === "Voice") {
        await speakText(result.data.feedback);
        // Automatically progress after speaking feedback completes
        await handleNext();
      } else {
        // Clear previous auto-next timeouts and register a new one
        if (autoNextTimeoutRef.current) {
          clearTimeout(autoNextTimeoutRef.current);
        }
        autoNextTimeoutRef.current = setTimeout(() => {
          handleNext();
        }, 5000);
      }
    } catch (error) {
      console.error("Answer submission failed:", error);
      alert("Submission failed. Retrying in typing mode.");
      transitionVoiceState("IDLE");
      timerHandledRef.current = false; // Allow retrying on failure
    } finally {
      setIsSubmitting(false);
      setLoadingMessage("");
    }
  }, [interviewId, currentIndex, answer, code, mode, timeLeft, interactionMedium, speakText, safeStopRecognition, handleNext]);

  // Microphone toggle button action
  const toggleMic = () => {
    if (micStatus === "Permission Denied") {
      alert("Microphone permission was denied. Please check your browser settings.");
      return;
    }

    if (isMicOn) {
      setIsMicOn(false);
      safeStopRecognition();
    } else {
      setIsMicOn(true);
      safeStartRecognition();
    }
  };

  /* ----------------- REACT USEEFFECT LIFECYCLE HOOKS ----------------- */

  // Sync refs with state values
  useEffect(() => {
    isMicOnRef.current = isMicOn;
    micStatusRef.current = micStatus;
    isSubmittingRef.current = isSubmitting;
    feedbackRef.current = feedback;
    currentQuestionRef.current = questionsList[currentIndex];
  }, [isMicOn, micStatus, isSubmitting, feedback, questionsList, currentIndex]);

  // Cleanup auto-next timers on unmount
  useEffect(() => {
    return () => {
      if (autoNextTimeoutRef.current) {
        clearTimeout(autoNextTimeoutRef.current);
      }
    };
  }, []);

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
      transitionVoiceState("ERROR");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onstart = () => {
      isRecognitionActiveRef.current = true;
      transitionVoiceState("LISTENING");
      setMicStatus("Listening");
      lastSpeechTimeRef.current = Date.now();
    };

    recognition.onsoundstart = () => {
      lastSpeechTimeRef.current = Date.now();
    };

    recognition.onspeechstart = () => {
      lastSpeechTimeRef.current = Date.now();
    };

    recognition.onresult = (event) => {
      lastSpeechTimeRef.current = Date.now();

      // Handle Barge-in (candidate interrupting AI)
      if (isAISpeakingRef.current) {
        const speakDuration = Date.now() - aiSpeechStartTimeRef.current;
        if (speakDuration > 1500) { // 1.5s barge-in guard delay
          console.log("[Voice] Barge-in detected. Stopping TTS.");
          window.speechSynthesis.cancel();
          isAISpeakingRef.current = false;
          transitionVoiceState("IDLE");
          setSubtitle("");
          if (videoRef.current) {
            videoRef.current.pause();
            videoRef.current.currentTime = 0;
          }
          // Resume listening immediately
          safeStartRecognition();
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
      if (event.error === "aborted") {
        console.log("[Voice] Recognition aborted intentionally.");
        return;
      }
      console.error("[Voice] Speech recognition error:", event.error);
      
      transitionVoiceState("ERROR");
      if (event.error === "not-allowed") {
        setMicStatus("Permission Denied");
        setIsMicOn(false);
      } else if (event.error === "network") {
        setMicStatus("Error");
      }
    };

    recognition.onend = () => {
      console.log("[Voice] Speech recognition ended.");
      isRecognitionActiveRef.current = false;
      
      if (!isAISpeakingRef.current && voiceStateRef.current !== "PROCESSING") {
        transitionVoiceState("IDLE");
      }

      // Reconnect/restart check
      const shouldRestart =
        isMicOnRef.current &&
        !isAISpeakingRef.current &&
        voiceStateRef.current === "IDLE" &&
        !isSubmittingRef.current &&
        !feedbackRef.current &&
        micStatusRef.current !== "Permission Denied";

      if (shouldRestart) {
        console.log("[Voice] Reconnecting recognition automatically...");
        transitionVoiceState("RECONNECTING");
        setTimeout(() => {
          if (voiceStateRef.current === "RECONNECTING" && isMicOnRef.current && !isAISpeakingRef.current && !isSubmittingRef.current && !feedbackRef.current) {
            safeStartRecognition();
          } else {
            if (voiceStateRef.current === "RECONNECTING") {
              transitionVoiceState("IDLE");
            }
          }
        }, 400);
      } else if (micStatusRef.current !== "Permission Denied" && !isAISpeakingRef.current && voiceStateRef.current !== "PROCESSING") {
        setMicStatus("Idle");
      }
    };

    recognitionRef.current = recognition;

    if (isMicOn) {
      safeStartRecognition();
    }

    return () => {
      try {
        recognition.abort();
      } catch (err) {
        console.warn("Abort failed:", err);
      }
    };
  }, [interactionMedium, isMicOn, safeStartRecognition, safeAbortRecognition]);

  // Handle Voice / Chat Setup and Intro Phase Speech
  useEffect(() => {
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
        
        // Start listening only after AI completes speaking the question
        safeStartRecognition();
      }
    };

    runIntro();
  }, [selectedVoice, isIntroPhase, currentIndex, questionsList.length, userName, speakText, interactionMedium, currentQuestion, safeStartRecognition]);

  // Question Timer Countdown (stops while AI is speaking)
  useEffect(() => {
    if (isIntroPhase) return;
    if (!currentQuestion) return;

    if (interactionMedium === "Voice" && voiceStateRef.current === "SPEAKING") {
      return;
    }

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
  }, [isIntroPhase, currentIndex, currentQuestion, voiceState, interactionMedium]);

  // Silence Detection Loop (Voice Medium only)
  useEffect(() => {
    if (interactionMedium !== "Voice" || isAISpeakingRef.current || isSubmitting || feedback || isIntroPhase) {
      return;
    }

    let firstSilenceSpoken = false;
    let secondSilenceSpoken = false;
    lastSpeechTimeRef.current = Date.now();

    const silenceInterval = setInterval(() => {
      const idleTime = Date.now() - lastSpeechTimeRef.current;

      if (idleTime >= 15000) {
        clearInterval(silenceInterval);
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
  }, [currentIndex, isSubmitting, feedback, isIntroPhase, interactionMedium, speakText, submitAnswer]);

  // Handle Question Timeout
  useEffect(() => {
    if (isIntroPhase || !currentQuestion || timeLeft !== 0 || isSubmitting || feedback) return;
    if (timerHandledRef.current) return;

    timerHandledRef.current = true;
    console.log("[Timer] Timeout reached. Triggering automatic submission.");
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

        {/* 🔄 Premium Loading Overlay */}
        {isSubmitting && (
          <Motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center text-white"
          >
            <div className="bg-slate-900 border border-slate-800 p-8 rounded-3xl shadow-2xl max-w-sm w-full space-y-6">
              <div className="relative w-20 h-20 mx-auto">
                <div className="absolute inset-0 rounded-full border-4 border-emerald-500/20"></div>
                <div className="absolute inset-0 rounded-full border-4 border-t-emerald-500 animate-spin"></div>
                <div className="absolute inset-2 rounded-full border-4 border-teal-500/10 border-b-teal-400 animate-spin [animation-duration:1.5s]"></div>
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-bold text-emerald-400">
                  {loadingMessage || "Evaluating Solution..."}
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Analyzing code structure, verifying logic, and compiling feedback report metrics.
                </p>
              </div>
            </div>
          </Motion.div>
        )}
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
                  {isAIPlaying ? `AI Speaking (${voiceState})` : `State: ${voiceState}`}
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

      {/* 🔄 Premium Loading Overlay */}
      {isSubmitting && (
        <Motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center text-white"
        >
          <div className="bg-slate-900 border border-slate-800 p-8 rounded-3xl shadow-2xl max-w-sm w-full space-y-6">
            <div className="relative w-20 h-20 mx-auto">
              <div className="absolute inset-0 rounded-full border-4 border-emerald-500/20"></div>
              <div className="absolute inset-0 rounded-full border-4 border-t-emerald-500 animate-spin"></div>
              <div className="absolute inset-2 rounded-full border-4 border-teal-500/10 border-b-teal-400 animate-spin [animation-duration:1.5s]"></div>
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-bold text-emerald-400">
                {loadingMessage || "Evaluating Answer..."}
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Analyzing answer structure, comparing parameters, and generating next question.
              </p>
            </div>
          </div>
        </Motion.div>
      )}
    </div>
  )
}

export default Step2Interview
