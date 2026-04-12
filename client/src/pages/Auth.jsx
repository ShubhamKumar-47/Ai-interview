import React from 'react'
import { BsRobot } from "react-icons/bs";
import { IoSparkles } from "react-icons/io5";
import { motion as Motion } from "motion/react"
import { FcGoogle } from "react-icons/fc";
import { signInWithPopup } from 'firebase/auth';
import { auth, provider } from '../utils/firebase';
import axios from 'axios';
import { ServerUrl } from '../config';
import { useDispatch } from 'react-redux';
import { setUserData } from '../redux/userSlice';
import { useNavigate } from 'react-router-dom';
import { useCallback, useEffect, useState } from 'react';
function Auth({isModel = false}) {
    const dispatch = useDispatch()
    const navigate = useNavigate()
    const [authError, setAuthError] = useState(null)
    const [isLoading, setIsLoading] = useState(false)

    const createBackendSession = useCallback(async (user) => {
        if (!user) {
            console.log("No Firebase user provided to createBackendSession")
            return
        }
        const name = user.displayName || user.email
        const email = user.email
        console.log("Creating backend session for:", email)
        
        try {
            const result = await axios.post(
                ServerUrl + "/api/auth/google", 
                { name, email }, 
                { withCredentials: true }
            )
            console.log("Backend session created successfully:", result.data)
            dispatch(setUserData(result.data.user))
            navigate("/")
        } catch (error) {
            console.error("Backend login failed:", {
                status: error?.response?.status,
                data: error?.response?.data,
                message: error.message
            })
            setAuthError(error?.response?.data?.message || error.message || "Backend login failed")
            dispatch(setUserData(null))
        }
    }, [dispatch, navigate])


    useEffect(() => {
        return () => setAuthError(null)
    }, [])

    const handleGoogleAuth = async () => {
        setAuthError(null)
        setIsLoading(true)
        try {
            console.log("Starting Google authentication...")
            const response = await signInWithPopup(auth, provider)
            console.log("Firebase popup successful, user:", response?.user?.email)
            
            if (response?.user) {
                await createBackendSession(response.user)
            }
        } catch (error) {
            console.error("Google login error code:", error?.code)
            console.error("Google login error message:", error?.message)
            
            // Handle specific Firebase errors
            if (error?.code === 'auth/popup-blocked') {
                setAuthError('Popup was blocked by browser. Please allow popups and try again.')
            } else if (error?.code === 'auth/cancelled-popup-request') {
                setAuthError('Login cancelled. Please try again.')
            } else if (error?.code === 'auth/invalid-continue-uri') {
                try {
                    sessionStorage.clear()
                    localStorage.removeItem('firebase:authUser')
                    setAuthError('Session cleared. Please try logging in again.')
                } catch {
                    setAuthError('Please clear your browser cache and try again.')
                }
            } else {
                setAuthError(error?.message || "Google login failed. Please try again.")
            }
            
            dispatch(setUserData(null))
        } finally {
            setIsLoading(false)
        }
    }
  return (
    <div className={`
      w-full 
      ${isModel ? "py-4" : "min-h-screen bg-[#f3f3f3] flex items-center justify-center px-6 py-20"}
    `}>
        <Motion.div 
        initial={{opacity:0 , y:-40}} 
        animate={{opacity:1 , y:0}} 
        transition={{duration:1.05}}
        className={`
        w-full 
        ${isModel ? "max-w-md p-8 rounded-3xl" : "max-w-lg p-12 rounded-4xl"}
        bg-white shadow-2xl border border-gray-200
      `}>
            <div className='flex items-center justify-center gap-3 mb-6'>
                <div className='bg-black text-white p-2 rounded-lg'>
                    <BsRobot size={18}/>

                </div>
                <h2 className='font-semibold text-lg'>InterviewIQ.AI</h2>
            </div>

            <h1 className='text-2xl md:text-3xl font-semibold text-center leading-snug mb-4'>
                Continue with
                <span className='bg-green-100 text-green-600 px-3 py-1 rounded-full inline-flex items-center gap-2'>
                    <IoSparkles size={16}/>
                    AI Smart Interview

                </span>
            </h1>

            <p className='text-gray-500 text-center text-sm md:text-base leading-relaxed mb-8'>
                Sign in to start AI-powered mock interviews,
        track your progress, and unlock detailed performance insights.
            </p>

            {authError && (
              <div className='mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-red-700'>
                {authError}
              </div>
            )}

            <Motion.button 
            onClick={handleGoogleAuth}
            whileHover={{opacity:0.9 , scale:1.03}}
            whileTap={{opacity:1 , scale:0.98}}
            disabled={isLoading}
            className='w-full flex items-center justify-center gap-3 py-3 bg-black text-white rounded-full shadow-md disabled:opacity-60'>
                <FcGoogle size={20}/>
                {isLoading ? "Signing in..." : "Continue with Google"}

   
            </Motion.button>
        </Motion.div>

      
    </div>
  )
}

export default Auth
