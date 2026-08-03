import User from "../models/user.model.js"


export const getCurrentUser = async (req,res) => {
    try {
        const userId = req.userId
        const user = await User.findById(userId)
        if(!user) {
            return res.status(404).json({message:"user does not found"})
        }

        // 🛠️ Reset legacy >100 initial credits to 100 for free/non-premium users
        if (!user.isPremium && user.credits > 100) {
            user.credits = 100;
            await user.save();
        }

        return res.status(200).json(user)
    } catch (error) {
         return res.status(500).json({message:`failed to get currentUser ${error}`})
    }
}