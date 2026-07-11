# Implementation Plan - Production Audit & Fixes for MockVerse

This plan outlines the design and implementation steps to elevate MockVerse to a production-grade AI Interview Platform, resolving critical speech recognition bugs, synchronizing voice interactions, introducing dynamic adaptive questioning, preventing repetitions, implementing a robust coding interview workspace, and upgrading the feedback system.

---

## Proposed Changes

### Component 1: Database & Models (server/models)

#### [MODIFY] [interview.model.js](file:///d:/Ai-interview/server/models/interview.model.js)
- Update `mode` enum to support `"HR"`, `"Technical"`, and `"Coding"`.
- Extend the `interviewSchema` to store overall technical score, communication score, problem-solving score, confidence score, and coding score.
- Add fields for `strengths`, `weaknesses`, `mistakes`, `improvements`, `roadmap`, and `hiringRecommendation` to support the premium feedback system.
- Add fields to track the conversation context (e.g., `difficultyLevel`, `currentTopic`, `askedQuestions`).

---

### Component 2: Backend Logic & AI Pipeline (server/controllers & services)

#### [MODIFY] [multer.js](file:///d:/Ai-interview/server/middlewares/multer.js)
- Sanitize the uploaded resume filename using uuid/timestamp to prevent directory traversal attacks.
- Validate that the uploaded file is strictly a PDF (check MIME type and file extension).

#### [MODIFY] [interview.controller.js](file:///d:/Ai-interview/server/controllers/interview.controller.js)
- **Refactor Question Generation (`generateQuestion`)**:
  - Initialize the interview with the first question generated dynamically rather than pre-generating 5 questions.
  - Question 1 will be tailored to the candidate's experience and resume skills, utilizing a scenario-based format.
- **Refactor Answer Submission (`submitAnswer`)**:
  - Evaluate the candidate's answer as before.
  - If the candidate has not reached the max questions (e.g., 5 questions), dynamically generate the next question.
  - The next question generation prompt will include the full conversation history, past questions, scores, resume context, and current difficulty level.
  - If the user's answer was correct and complete (score >= 7), increase the difficulty or move to a more advanced topic.
  - If the answer was weak (score < 4), ask a targeted follow-up question directly related to their previous answer to probe deeper.
  - Perform semantic similarity checking: check the new question against already asked questions to guarantee no repeats.
- **Refactor Completion (`finishInterview`)**:
  - Use the full conversation log to prompt the AI to generate a comprehensive, highly personalized feedback report containing:
    - Detailed scores: Technical, Communication, Problem Solving, Confidence, Coding (if Coding mode).
    - Bulleted lists of Strengths, Weaknesses, Mistakes made.
    - An actionable improvement roadmap.
    - A clear hiring recommendation.

---

### Component 3: Frontend Voice & Sync Engine (client/src/components)

#### [MODIFY] [Step2Interview.jsx](file:///d:/Ai-interview/client/src/components/Step2Interview.jsx)
- **Stabilize Speech Recognition (STT)**:
  - Add compatibility fallback for standard `window.SpeechRecognition || window.webkitSpeechRecognition`.
  - Listen to `onerror` and `onend`. If recognition unexpectedly stops but the microphone is active and AI is not speaking, automatically restart it.
  - Display microphone status states: Listening, Speaking, Processing, Idle, Error, Permission Denied, Reconnecting.
- **Implement Deterministic State Machine**:
  - Implement states: `IDLE`, `AI_SPEAKING`, `USER_LISTENING`, `USER_SPEAKING`, `PROCESSING`, `ERROR`.
  - Block text inputs and button clicks during active API requests to prevent double-submitting.
- **Silence Detection**:
  - Start a 5-second timer when the microphone starts listening.
  - Reset the timer on sound/speech detection.
  - On first silence: speak "I didn't catch that." and keep listening.
  - On second silence: speak "Would you like me to repeat the question?" and keep listening.
  - On third silence: automatically skip the question or submit empty text to move forward.
- **Barge-in (Interrupt Handling)**:
  - Keep the microphone listening during TTS (with a 1.5s delay to prevent self-interruption from speaker feedback).
  - If the user starts speaking, immediately call `window.speechSynthesis.cancel()`, stop the AI video, and switch to recording.
- **Transcription Normalization**:
  - Strip filler words (e.g., "uh", "umm", "like", "you know") and consecutive duplicate words.
  - Normalize punctuation.

---

### Component 4: Coding Workspace & Page Enhancements (client/src/pages & components)

#### [MODIFY] [Step1SetUp.jsx](file:///d:/Ai-interview/client/src/components/Step1SetUp.jsx)
- Update options to support selecting "Coding Interview" in the mode dropdown.
- Allow the user to toggle between "Voice" and "Chat/Text" interaction mediums.

#### [MODIFY] [Step2Interview.jsx](file:///d:/Ai-interview/client/src/components/Step2Interview.jsx) & [NEW] [CodingWorkspace.jsx](file:///d:/Ai-interview/client/src/components/CodingWorkspace.jsx)
- Build a split-screen Coding Workspace for coding interviews:
  - Left side: Problem statement, progress, and hints.
  - Right side: Monospace code editor (textarea with line numbers, auto-indentation on Enter, tab key override for indentation, and clean layout).
- Integrate progressive hint system: if in coding mode, AI can give code hints without revealing the full solution, evaluating logic and complexities.

#### [MODIFY] [Step3Report.jsx](file:///d:/Ai-interview/client/src/components/Step3Report.jsx)
- Render the new premium report dashboard: show Strengths, Weaknesses, Mistakes, Recommendations, and the personalized Roadmap.
- Update the PDF export function to include the detailed report sections.

---

## Verification Plan

### Automated Tests
- Run backend linting and build tests.
- Run frontend builds to verify client-side bundle size, React compatibility, and TypeScript/ESLint compliance.

### Manual Verification
- Test microphone activation, permission deny recovery, error display, and continuous speech transcription.
- Verify that AI never repeats questions and adapts difficulty dynamically based on answer strength.
- Test barge-in by interrupting the AI speech.
- Validate silence timeouts.
- Test the full coding interview flow, progressive hint system, and monospace editor.
- Check overall layout responsiveness in mobile, tablet, and desktop views.
