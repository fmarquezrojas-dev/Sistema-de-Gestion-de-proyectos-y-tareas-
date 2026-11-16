import axios from 'axios'
const configured = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'
export const apiURL = configured.replace(/\/$/, '').endsWith('/api') ? configured.replace(/\/$/, '') : configured.replace(/\/$/, '') + '/api'
export const sessionHttp = axios.create({ baseURL: apiURL, withCredentials: true, timeout: 15000 })
