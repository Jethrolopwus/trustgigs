import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import './index.css'
import AppLayout from './App.tsx'
import { JobsPage } from './pages/JobsPage'
import { JobDetailPage } from './pages/JobDetailPage'
import { EmployerDashboardPage } from './pages/EmployerDashboardPage'
import { ApplicantDashboardPage } from './pages/ApplicantDashboardPage'
import { WalletProvider } from './wallet/WalletContext'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <WalletProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<AppLayout />}>
            <Route index element={<JobsPage />} />
            <Route path="jobs/:jobId" element={<JobDetailPage />} />
            <Route path="employer" element={<EmployerDashboardPage />} />
            <Route path="applicant" element={<ApplicantDashboardPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </WalletProvider>
  </StrictMode>,
)
