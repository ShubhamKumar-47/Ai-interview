import mongoose from "mongoose";

const questionsSchema = new mongoose.Schema({
     question: String,
  difficulty: String,
  timeLimit: Number,
  answer: String,
  feedback: String,
  score: { type: Number, default: 0 },
  confidence: { type: Number, default: 0 },
communication: { type: Number, default: 0 },
correctness: { type: Number, default: 0 },
})


const interviewSchema = new mongoose.Schema({
    userId:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"User",
        required:true
    },
    role:{
        type:String,
        required:true
    },
    experience:{
        type:String,
        required:true
    },
    mode:{
        type:String,
        enum:["HR" ,"Technical", "Coding"],
        required:true
    },
    interactionMedium:{
        type:String,
        enum:["Voice", "Chat"],
        default:"Voice"
    },
    resumeText:{
     type:String
    },
    questions:[questionsSchema],

    finalScore: { type: Number, default: 0 },
    technicalScore: { type: Number, default: 0 },
    communicationScore: { type: Number, default: 0 },
    problemSolvingScore: { type: Number, default: 0 },
    confidenceScore: { type: Number, default: 0 },
    codingScore: { type: Number, default: 0 },

    strengths: { type: [String], default: [] },
    weaknesses: { type: [String], default: [] },
    mistakes: { type: [String], default: [] },
    suggestions: { type: [String], default: [] },
    roadmap: { type: [String], default: [] },
    hiringRecommendation: { type: String, default: "" },

    status: {
      type: String,
      enum: ["Incompleted", "completed"],
      default: "Incompleted",
    }
},{timestamps:true})

const Interview = mongoose.model("Interview" , interviewSchema)


export default Interview