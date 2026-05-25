const envServerUrl = import.meta.env.VITE_SERVER_URL
const isProd = import.meta.env.PROD

if (!envServerUrl && isProd) {
	throw new Error(
		"VITE_SERVER_URL is missing at build time. Set VITE_SERVER_URL to your backend URL (e.g. https://ai-interview-6z9d.onrender.com) before building the frontend."
	)
}

export const ServerUrl = envServerUrl || window.location.origin
