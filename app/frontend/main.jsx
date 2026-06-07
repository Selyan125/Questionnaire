import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import {createTheme, CssBaseline, ThemeProvider} from "@mui/material";

const theme = createTheme({
    palette: {
        mode: 'light',
        primary: {
            main: '#6167bd',
        },
        background: {
            default: '#F7F7F7',
            paper: '#FFFFFF',
        }
    },
    typography: {
        fontFamily: 'Lexend, sans-serif',
    }});

createRoot(document.getElementById('root')).render(
  <StrictMode>
      <ThemeProvider theme={theme}>
          <CssBaseline />
            <App />
      </ThemeProvider>
  </StrictMode>,
)
