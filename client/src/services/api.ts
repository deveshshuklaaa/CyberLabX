import axios from 'axios'; export const api = axios.create({ baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:5000/api', withCredentials: true }); export function errorMessage(error: unknown) { return axios.isAxiosError(error) ? error.response?.data?.message ?? 'Request failed. Please try again.' : 'Request failed. Please try again.'; }

