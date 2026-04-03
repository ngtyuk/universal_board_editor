import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { IntlProvider } from 'react-intl'
import { createTheme, ThemeProvider } from 'smarthr-ui'
import 'smarthr-ui/smarthr-ui.css'
import './index.css'
import App from './App.tsx'

const theme = createTheme()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <IntlProvider locale="ja">
      <ThemeProvider theme={theme}>
        <App />
      </ThemeProvider>
    </IntlProvider>
  </StrictMode>,
)
