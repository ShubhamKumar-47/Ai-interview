import React, { useState, useEffect } from 'react'
import Step1SetUp from '../components/Step1SetUp'
import Step2Interview from '../components/Step2Interview'
import Step3Report from '../components/Step3Report'

function InterviewPage() {
    const [step, setStep] = useState(() => {
        try {
            const savedStep = sessionStorage.getItem("active_interview_step");
            return savedStep ? parseInt(savedStep, 10) : 1;
        } catch {
            return 1;
        }
    });

    const [interviewData, setInterviewData] = useState(() => {
        try {
            const savedData = sessionStorage.getItem("active_interview_data");
            return savedData ? JSON.parse(savedData) : null;
        } catch {
            return null;
        }
    });

    useEffect(() => {
        try {
            sessionStorage.setItem("active_interview_step", step.toString());
            if (interviewData) {
                sessionStorage.setItem("active_interview_data", JSON.stringify(interviewData));
            } else {
                sessionStorage.removeItem("active_interview_data");
            }
        } catch (e) {
            console.error("Failed to save interview state to sessionStorage:", e);
        }
    }, [step, interviewData]);

    const handleStart = (data) => {
        setInterviewData(data);
        setStep(2);
    };

    const handleFinish = (report) => {
        setInterviewData(report);
        setStep(3);
    };

    return (
        <div className='min-h-screen bg-gray-50'>
            {step === 1 && (
                <Step1SetUp onStart={handleStart} />
            )}

            {step === 2 && (
                <Step2Interview
                    interviewData={interviewData}
                    onFinish={handleFinish}
                />
            )}

            {step === 3 && (
                <Step3Report report={interviewData} />
            )}
        </div>
    )
}

export default InterviewPage
