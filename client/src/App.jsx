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

// 🔥 Firebase
import { auth } from "./utils/firebase"
import { onAuthStateChanged } from "firebase/auth"

import { ServerUrl } from './config'

function App() {

  const dispatch = useDispatch()

  useEffect(() => {

    const unsubscribe = onAuthStateChanged(auth, async (user) => {

      console.log("Firebase user:", user)

      // ❌ Not logged in
      if (!user) {
        console.log("User not logged in, skipping current-user fetch")
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
    <Routes>
      <Route path='/' element={<Home />} />
      <Route path='/auth' element={<Auth />} />
      <Route path='/interview' element={<InterviewPage />} />
      <Route path='/history' element={<InterviewHistory />} />
      <Route path='/pricing' element={<Pricing />} />
      <Route path='/report/:id' element={<InterviewReport />} />
    </Routes>
  )
}

export default App