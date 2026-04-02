import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL as string,
});

// El token se inyecta desde AuthContext al inicializar la sesión.
// El interceptor lee el valor almacenado en memoria (nunca localStorage).
let _token: string | null = null;

export function setAuthToken(token: string | null) {
  _token = token;
}

api.interceptors.request.use((config) => {
  if (_token) {
    config.headers.Authorization = `Bearer ${_token}`;
  }
  return config;
});

export default api;
