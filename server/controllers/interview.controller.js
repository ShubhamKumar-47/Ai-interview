import fs from "fs"
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import { askAi } from "../services/openRouter.service.js";
import User from "../models/user.model.js";
import Interview from "../models/interview.model.js";

export const analyzeResume = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "Resume required" });
    }
    const filepath = req.file.path

    const fileBuffer = await fs.promises.readFile(filepath)
    const uint8Array = new Uint8Array(fileBuffer)

    const pdf = await pdfjsLib.getDocument({ data: uint8Array }).promise;

    let resumeText = "";

    // Extract text from all pages
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const content = await page.getTextContent();

      const pageText = content.items.map(item => item.str).join(" ");
      resumeText += pageText + "\n";
    }


    resumeText = resumeText
      .replace(/\s+/g, " ")
      .trim();

    const messages = [
      {
        role: "system",
        content: `
Extract structured data from resume.

Return strictly JSON:

{
  "role": "string",
  "experience": "string",
  "projects": ["project1", "project2"],
  "skills": ["skill1", "skill2"]
}
`
      },
      {
        role: "user",
        content: resumeText
      }
    ];


    const aiResponse = await askAi(messages)

    const parsed = JSON.parse(aiResponse);

    fs.unlinkSync(filepath)


    res.json({
      role: parsed.role,
      experience: parsed.experience,
      projects: parsed.projects,
      skills: parsed.skills,
      resumeText
    });

  } catch (error) {
    console.error(error);

    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    return res.status(500).json({ message: error.message });
  }
};


// Utility helper to safely parse AI JSON responses
const parseAiJson = (text) => {
  try {
    let cleaned = text.trim();
    if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```(json)?/, "").replace(/```$/, "").trim();
    }
    return JSON.parse(cleaned);
  } catch (err) {
    console.error("Failed to parse AI JSON:", text, err);
    // Attempt recovery via simple regex if possible
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch (innerErr) {
        throw new Error("Invalid AI JSON format after cleanup attempt: " + err.message);
      }
    }
    throw new Error("Invalid AI JSON format: " + err.message);
  }
};

export const generateQuestion = async (req, res) => {
  try {
    let { role, experience, mode, interactionMedium, resumeText, projects, skills } = req.body

    role = role?.trim();
    experience = experience?.trim();
    mode = mode?.trim();
    interactionMedium = interactionMedium || "Voice";

    if (!role || !experience || !mode) {
      return res.status(400).json({ message: "Role, Experience and Mode are required." })
    }

    const user = await User.findById(req.userId)

    if (!user) {
      return res.status(404).json({
        message: "User not found."
      });
    }

    if (user.credits < 50) {
      return res.status(400).json({
        message: "Not enough credits. Minimum 50 required."
      });
    }

    const projectText = Array.isArray(projects) && projects.length
      ? projects.join(", ")
      : "None";

    const skillsText = Array.isArray(skills) && skills.length
      ? skills.join(", ")
      : "None";

    const safeResume = resumeText?.trim() || "None";

    // Create prompt to generate the first (easy) question dynamically
    const systemPrompt = `You are a real senior engineer conducting a professional ${mode} interview.
The interview mode is ${mode} (Technical / HR / Coding).
The candidate's role is ${role}, and experience level is ${experience}.
Candidate's resume details and skills: Projects: ${projectText}, Skills: ${skillsText}.
Resume Text: ${safeResume.substring(0, 2000)}
The interaction medium is ${interactionMedium} (Voice / Chat).

Generate the FIRST question of the interview. It must be of "easy" difficulty.
Strict Rules:
- Ask a practical, scenario-based question. Do NOT ask textbook definitions (e.g. avoid "What is X?" or "Explain the concept of Y"). Instead, ask how they would apply a concept or investigate an issue.
- If this is a "Coding" interview, present a standard algorithmic or design coding problem appropriate for the role and experience, where they have to write a function or design a system.
- Keep the language natural, concise, professional, and conversational.
- Return ONLY the question or coding challenge text. Do NOT add numbering, greetings, introductions, or explanations.`;

    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: "Please ask the first question." }
    ];

    const firstQuestionText = await askAi(messages);

    if (!firstQuestionText || !firstQuestionText.trim()) {
      return res.status(500).json({
        message: "AI returned empty response for the first question."
      });
    }

    user.credits -= 50;
    await user.save();

    const timeLimit = mode === "Coding" ? 180 : 60;

    const interview = await Interview.create({
      userId: user._id,
      role,
      experience,
      mode,
      interactionMedium,
      resumeText: safeResume,
      questions: [{
        question: firstQuestionText.trim(),
        difficulty: "easy",
        timeLimit: timeLimit,
      }]
    })

    res.json({
      interviewId: interview._id,
      creditsLeft: user.credits,
      userName: user.name,
      questions: interview.questions,
      interactionMedium: interview.interactionMedium
    });
  } catch (error) {
    console.error("generateQuestion Error:", error);
    return res.status(500).json({message:`failed to create interview ${error.message}`})
  }
}


export const submitAnswer = async (req, res) => {
  try {
    const { interviewId, questionIndex, answer, timeTaken } = req.body

    const interview = await Interview.findById(interviewId)
    if (!interview) {
      return res.status(404).json({ message: "Interview not found" });
    }

    const question = interview.questions[questionIndex]

    // If no answer
    if (!answer || answer.trim() === "") {
      question.score = 0;
      question.feedback = "You did not submit an answer.";
      question.answer = "";
      question.confidence = 0;
      question.communication = 0;
      question.correctness = 0;
    } else if (timeTaken > question.timeLimit) {
      // If time exceeded
      question.score = 0;
      question.feedback = "Time limit exceeded. Answer not evaluated.";
      question.answer = answer;
      question.confidence = 0;
      question.communication = 0;
      question.correctness = 0;
    } else {
      // Evaluate the answer
      const evalSystemPrompt = `You are a professional human interviewer evaluating a candidate's answer in a real ${interview.mode} interview.

Evaluate naturally and fairly, like a real senior engineer would.
Score the answer in these areas (0 to 10):
1. Confidence - Does the answer sound clear, confident, and well-presented? (If typing/chat, evaluate structural clarity and directness)
2. Communication - Is the language clear, simple, and easy to understand?
3. Correctness - Is the answer accurate, relevant, complete, and technically sound? (If Coding mode, evaluate code correctness, edge cases, time/space complexity)

Rules:
- Be realistic and unbiased. Do not give random high scores.
- If the answer is weak, incomplete, or wrong, score low.
- If the answer is strong, detailed, and accurate, score high.
- finalScore is the average of confidence, communication, and correctness, rounded to the nearest integer.
- Feedback rules: write natural human-like feedback, 10 to 15 words only. Suggest improvements. Do NOT repeat the question or explain the scoring.

Return ONLY valid JSON in this format:
{
  "confidence": number,
  "communication": number,
  "correctness": number,
  "finalScore": number,
  "feedback": "short human feedback"
}`;

      const evalMessages = [
        { role: "system", content: evalSystemPrompt },
        {
          role: "user",
          content: `Question: ${question.question}\nAnswer: ${answer}`
        }
      ];

      const aiResponse = await askAi(evalMessages);
      const parsed = parseAiJson(aiResponse);

      question.answer = answer;
      question.confidence = parsed.confidence || 0;
      question.communication = parsed.communication || 0;
      question.correctness = parsed.correctness || 0;
      question.score = parsed.finalScore || 0;
      question.feedback = parsed.feedback || "Good effort.";
    }

    await interview.save();

    // Check if we need to generate a dynamic NEXT question (total 5 questions)
    const totalQuestions = 5;
    const nextIndex = questionIndex + 1;

    if (nextIndex < totalQuestions) {
      const nextDifficulty = ["easy", "easy", "medium", "medium", "hard"][nextIndex];
      const nextTimeLimit = interview.mode === "Coding" ? 180 : [60, 60, 90, 90, 120][nextIndex];

      // Format conversation history for AI context
      const historyItems = interview.questions.map((q, idx) => {
        return `Q${idx + 1}: ${q.question}\nCandidate Answer: ${q.answer || "(No Answer)"}\nEvaluation Score: ${q.score}/10\nFeedback: ${q.feedback}`;
      });

      const askedQuestionsText = interview.questions.map(q => `- ${q.question}`).join("\n");
      const conversationHistoryText = historyItems.join("\n\n");

      const followUpSystemPrompt = `You are a real senior engineer conducting a professional ${interview.mode} interview.
The candidate's role is ${interview.role}, and experience level is ${interview.experience}.
Candidate's resume details are saved.

List of questions asked so far in this interview:
${askedQuestionsText}

Full Interview Conversation History & Performance:
${conversationHistoryText}

Your task is to generate the NEXT question (Question ${nextIndex + 1} of ${totalQuestions}).
The difficulty level must be: ${nextDifficulty}.

Strict Adaptive Guidelines:
1. Ensure the question adapts dynamically:
   - If the candidate's last answer was strong (score >= 7), increase the difficulty or move to a more advanced, related concept.
   - If the last answer was weak (score < 4), ask a targeted follow-up or probing question directly about their previous answer to let them clarify or demonstrate deep knowledge.
   - If this is a "Coding" interview and they have bugs or suboptimal code, provide a progressive hint or point out a specific edge case rather than giving the solution or changing the problem.
2. Avoid repetitive textbook questions (no simple "What is X?"). Focus on scenario-based questions (e.g. "Your database suddenly throttles under traffic. How would you investigate?").
3. Do NOT repeat or ask any question that is semantically similar to the ones already asked.
4. Keep the language natural, concise, encouraging, and conversational.
5. Return ONLY the question or hint text. Do NOT add numbering, greetings, explanations, or introductory text.`;

      const followUpMessages = [
        { role: "system", content: followUpSystemPrompt },
        { role: "user", content: "Please generate the next question." }
      ];

      const nextQuestionText = await askAi(followUpMessages);

      if (nextQuestionText && nextQuestionText.trim()) {
        const nextQuestion = {
          question: nextQuestionText.trim(),
          difficulty: nextDifficulty,
          timeLimit: nextTimeLimit,
        };

        interview.questions.push(nextQuestion);
        await interview.save();

        return res.status(200).json({
          feedback: question.feedback,
          nextQuestion: nextQuestion
        });
      }
    }

    return res.status(200).json({
      feedback: question.feedback,
      isFinished: true
    });

  } catch (error) {
    console.error("submitAnswer Error:", error);
    return res.status(500).json({message:`failed to submit answer ${error.message}`})
  }
}


export const finishInterview = async (req, res) => {
  try {
    const { interviewId } = req.body
    const interview = await Interview.findById(interviewId)
    if(!interview){
      return res.status(400).json({message:"failed to find Interview"})
    }

    const totalQuestions = interview.questions.length;

    let totalScore = 0;
    let totalConfidence = 0;
    let totalCommunication = 0;
    let totalCorrectness = 0;

    interview.questions.forEach((q) => {
      totalScore += q.score || 0;
      totalConfidence += q.confidence || 0;
      totalCommunication += q.communication || 0;
      totalCorrectness += q.correctness || 0;
    });

    const finalScore = totalQuestions ? totalScore / totalQuestions : 0;
    const avgConfidence = totalQuestions ? totalConfidence / totalQuestions : 0;
    const avgCommunication = totalQuestions ? totalCommunication / totalQuestions : 0;
    const avgCorrectness = totalQuestions ? totalCorrectness / totalQuestions : 0;

    interview.finalScore = finalScore;
    interview.status = "completed";

    // Generate comprehensive evaluation feedback report using AI
    const historyText = interview.questions.map((q, idx) => {
      return `Q${idx + 1}: ${q.question}\nAnswer: ${q.answer || "(No Answer)"}\nScore: ${q.score}/10\nFeedback: ${q.feedback}`;
    }).join("\n\n");

    const feedbackSystemPrompt = `You are a lead principal engineer and hiring director.
You are evaluating a candidate's complete interview log to generate a production-ready feedback report.

Candidate Info:
Role: ${interview.role}
Experience: ${interview.experience}
Mode: ${interview.mode}

Interview Transcript:
${historyText}

Based on this transcript, compile a constructive, detailed feedback report.
Calculate:
- technicalScore (1-10) based on accuracy and technical depth.
- communicationScore (1-10) based on clarity, structuring, and filler avoidance.
- problemSolvingScore (1-10) based on approach, logic, and edge case handling.
- confidenceScore (1-10) based on directness and tone.
- codingScore (1-10, 0 if not a Coding interview) based on code quality and complexity logic.

Generate arrays of strings for:
- strengths: 3 specific, detailed strengths demonstrated by the candidate.
- weaknesses: 3 specific, constructive weaknesses shown.
- mistakes: Any specific technical mistakes, misconceptions, or bugs they committed.
- suggestions: 3 actionable, specific improvement steps.
- roadmap: 3 targeted steps for their personalized learning roadmap.
- hiringRecommendation: A summary sentence recommending either: "Strong Hire", "Hire", or "No Hire" with a brief justification.

Return ONLY a valid JSON object in this format:
{
  "technicalScore": number,
  "communicationScore": number,
  "problemSolvingScore": number,
  "confidenceScore": number,
  "codingScore": number,
  "strengths": ["string", "string", "string"],
  "weaknesses": ["string", "string", "string"],
  "mistakes": ["string", "string"],
  "suggestions": ["string", "string", "string"],
  "roadmap": ["string", "string", "string"],
  "hiringRecommendation": "Recommendation text"
}`;

    const reportMessages = [
      { role: "system", content: feedbackSystemPrompt },
      { role: "user", content: "Generate report." }
    ];

    try {
      const reportResponse = await askAi(reportMessages);
      const parsedReport = parseAiJson(reportResponse);

      interview.technicalScore = parsedReport.technicalScore || Math.round(avgCorrectness);
      interview.communicationScore = parsedReport.communicationScore || Math.round(avgCommunication);
      interview.problemSolvingScore = parsedReport.problemSolvingScore || Math.round(avgCorrectness);
      interview.confidenceScore = parsedReport.confidenceScore || Math.round(avgConfidence);
      interview.codingScore = parsedReport.codingScore || 0;
      interview.strengths = parsedReport.strengths || ["Demonstrated good fundamental knowledge."];
      interview.weaknesses = parsedReport.weaknesses || ["Could improve depth in advanced areas."];
      interview.mistakes = parsedReport.mistakes || ["None noted."];
      interview.suggestions = parsedReport.suggestions || ["Practice mock interviews and structuring thoughts."];
      interview.roadmap = parsedReport.roadmap || ["Study key computer science fundamentals."];
      interview.hiringRecommendation = parsedReport.hiringRecommendation || "No recommendation.";

    } catch (reportError) {
      console.error("AI feedback generation failed, using fallbacks:", reportError);
      // Fallback fields in case of OpenRouter API timeout/errors
      interview.technicalScore = Math.round(avgCorrectness);
      interview.communicationScore = Math.round(avgCommunication);
      interview.problemSolvingScore = Math.round(avgCorrectness);
      interview.confidenceScore = Math.round(avgConfidence);
      interview.codingScore = interview.mode === "Coding" ? Math.round(avgCorrectness) : 0;
      interview.strengths = ["Completed all questions."];
      interview.weaknesses = ["Needs practice on speech pacing and detail levels."];
      interview.mistakes = ["Some answers lacked structural depth."];
      interview.suggestions = ["Review answers and look at optimal solutions."];
      interview.roadmap = ["Review fundamentals related to " + interview.role];
      interview.hiringRecommendation = finalScore >= 7 ? "Hire - Candidate shows solid knowledge." : "No Hire - Candidate needs more preparation.";
    }

    await interview.save();

    return res.status(200).json({
      finalScore: Number(finalScore.toFixed(1)),
      confidence: Number(avgConfidence.toFixed(1)),
      communication: Number(avgCommunication.toFixed(1)),
      correctness: Number(avgCorrectness.toFixed(1)),
      technicalScore: interview.technicalScore,
      communicationScore: interview.communicationScore,
      problemSolvingScore: interview.problemSolvingScore,
      confidenceScore: interview.confidenceScore,
      codingScore: interview.codingScore,
      strengths: interview.strengths,
      weaknesses: interview.weaknesses,
      mistakes: interview.mistakes,
      suggestions: interview.suggestions,
      roadmap: interview.roadmap,
      hiringRecommendation: interview.hiringRecommendation,
      questionWiseScore: interview.questions.map((q) => ({
        question: q.question,
        score: q.score || 0,
        feedback: q.feedback || "",
        confidence: q.confidence || 0,
        communication: q.communication || 0,
        correctness: q.correctness || 0,
      })),
    })
  } catch (error) {
    console.error("finishInterview Error:", error);
    return res.status(500).json({message:`failed to finish Interview ${error.message}`})
  }
}


export const getInterviewReport = async (req, res) => {
  try {
    const interview = await Interview.findById(req.params.id)

    if (!interview) {
      return res.status(404).json({ message: "Interview not found" });
    }

    const totalQuestions = interview.questions.length;

    let totalConfidence = 0;
    let totalCommunication = 0;
    let totalCorrectness = 0;

    interview.questions.forEach((q) => {
      totalConfidence += q.confidence || 0;
      totalCommunication += q.communication || 0;
      totalCorrectness += q.correctness || 0;
    });

    const avgConfidence = totalQuestions ? totalConfidence / totalQuestions : 0;
    const avgCommunication = totalQuestions ? totalCommunication / totalQuestions : 0;
    const avgCorrectness = totalQuestions ? totalCorrectness / totalQuestions : 0;

    return res.json({
      finalScore: interview.finalScore,
      confidence: Number(avgConfidence.toFixed(1)),
      communication: Number(avgCommunication.toFixed(1)),
      correctness: Number(avgCorrectness.toFixed(1)),
      technicalScore: interview.technicalScore || 0,
      communicationScore: interview.communicationScore || 0,
      problemSolvingScore: interview.problemSolvingScore || 0,
      confidenceScore: interview.confidenceScore || 0,
      codingScore: interview.codingScore || 0,
      strengths: interview.strengths || [],
      weaknesses: interview.weaknesses || [],
      mistakes: interview.mistakes || [],
      suggestions: interview.suggestions || [],
      roadmap: interview.roadmap || [],
      hiringRecommendation: interview.hiringRecommendation || "",
      mode: interview.mode,
      role: interview.role,
      experience: interview.experience,
      createdAt: interview.createdAt,
      questionWiseScore: interview.questions
    });

  } catch (error) {
    console.error("getInterviewReport Error:", error);
    return res.status(500).json({message:`failed to find currentUser Interview report ${error.message}`})
  }
}


export const getMyInterviews = async (req,res) => {
  try {
    const interviews = await Interview.find({userId:req.userId})
    .sort({ createdAt: -1 })
    .select("role experience mode finalScore status createdAt");

    return res.status(200).json(interviews)

  } catch (error) {
     return res.status(500).json({message:`failed to find currentUser Interview ${error}`})
  }
}
