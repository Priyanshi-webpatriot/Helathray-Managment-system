import axios from "axios";

const API = axios.create({
    baseURL: import.meta.env.BASE_URL || "http://localhost:3360/api",
});

// ── FRONTEND REQUEST INTERCEPTOR ──
// Automatically attaches the JWT token to every request.
// Individual pages no longer need to manually set role/userid headers.
API.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem("token");
        if (token) {
            config.headers["Authorization"] = `Bearer ${token}`;
        }

        const time = new Date().toLocaleTimeString();
        const method = (config.method || "GET").toUpperCase();
        console.log(`🌐 [FRONTEND API REQUEST] [${time}] ${method} ${config.url}`, {
            headers: {
                Authorization: token ? "Bearer ***" : "none",
                "Content-Type": config.headers?.["Content-Type"],
            },
            params: config.params,
            data: config.data instanceof FormData ? "(FormData)" : config.data,
        });
        return config;
    },
    (error) => {
        console.error("❌ [FRONTEND API REQUEST SETUP ERROR]:", error);
        return Promise.reject(error);
    }
);

// ── FRONTEND RESPONSE & ERROR LOGGER ──
API.interceptors.response.use(
    (response) => {
        const time = new Date().toLocaleTimeString();
        const method = (response.config?.method || "GET").toUpperCase();
        console.log(`✅ [FRONTEND API SUCCESS] [${time}] ${method} ${response.config?.url} (Status: ${response.status})`, response.data);
        return response;
    },
    (error) => {
        const time = new Date().toLocaleTimeString();
        const method = (error.config?.method || "UNKNOWN").toUpperCase();
        const url = error.config?.url || "unknown-url";
        const status = error.response?.status || "NO_RESPONSE";
        const serverError = error.response?.data?.error || error.response?.data?.detail || error.response?.data || error.message;

        // If token is expired or invalid, clear storage and redirect to login
        if (status === 401) {
            localStorage.removeItem("token");
            localStorage.removeItem("user");
            window.location.href = "/";
        }

        console.error(`❌ [FRONTEND API ERROR] [${time}] ${method} ${url} (Status: ${status}):`, {
            errorMessage: error.message,
            serverErrorDetail: serverError,
            responseBody: error.response?.data,
        });
        return Promise.reject(error);
    }
);

export default API;
