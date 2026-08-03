import React, { useEffect } from 'react'
import { Route, Routes } from 'react-router-dom'
import Home from './pages/Home'
import Auth from './pages/Auth'
import axios from 'axios'
import { useDispatch } from 'react-redux'
import { setUserData } from './redux/userSlice'
import InterviewPage from './pages/InterviewPage'
import InterviewHistory from './pages/InterviewHistory'
import Pricing from './pages/Pricing'
import InterviewReport from './pages/InterviewReport'
import ErrorBoundary from './components/ErrorBoundary'

// 🔥 Firebase
import { auth } from "./utils/firebase"
import { onAuthStateChanged } from "firebase/auth"

import { ServerUrl } from './config'

function App() {

  const dispatch = useDispatch()

  useEffect(() => {

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      console.log("Firebase user state changed:", user)

      // ❌ Not logged in via Firebase -> check backend cookie session fallback
      if (!user) {
        try {
          const result = await axios.get(
            ServerUrl + "/api/user/current-user",
            { withCredentials: true }
          )
          if (result.data && result.data._id) {
            console.log("Session verified via backend cookie:", result.data)
            dispatch(setUserData(result.data))
            return
          }
        } catch {
          console.log("No active backend cookie session found")
        }
        dispatch(setUserData(null))
        return
      }

      try {
        // 🔥 Force fresh token (IMPORTANT)
        const token = await user.getIdToken(true)

        // 🛑 If somehow token missing
        if (!token) {
          console.log("No Firebase token despite user being logged in")
          dispatch(setUserData(null))
          return
        }

        console.log("Fetching current user with valid token...")

        const result = await axios.get(
          ServerUrl + "/api/user/current-user",
          {
            withCredentials: true,
          }
        )

        console.log("Current user fetched:", result.data)
        dispatch(setUserData(result.data))

      } catch (error) {
        console.log("Auth Error:", error?.response?.data || error.message)
        dispatch(setUserData(null))
      }
    })

    return () => unsubscribe()

  }, [dispatch])

  return (
    <ErrorBoundary>
      <Routes>
        <Route path='/' element={<Home />} />
        <Route path='/auth' element={<Auth />} />
        <Route path='/interview' element={<InterviewPage />} />
        <Route path='/history' element={<InterviewHistory />} />
        <Route path='/pricing' element={<Pricing />} />
        <Route path='/report/:id' element={<InterviewReport />} />
      </Routes>
    </ErrorBoundary>
  )
}

export default App