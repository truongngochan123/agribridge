import { Navigate, Route, Routes } from 'react-router-dom'
import { ProtectedAppRoute, VerificationStateRoute } from './components/auth/ProtectedAppRoute'
import { ProtectedAdminRoute } from './components/auth/ProtectedAdminRoute'
import { HomePage } from './pages/HomePage'
import { SupplierRegistrationBusinessInfoPage } from './pages/onboarding/SupplierRegistrationBusinessInfoPage'
import { SupplierRegistrationContactVerificationPage } from './pages/onboarding/SupplierRegistrationContactVerificationPage'
import { VerificationPendingPage } from './pages/onboarding/VerificationPendingPage'
import { VerificationApprovedPage } from './pages/onboarding/VerificationApprovedPage'
import { VerificationRejectedPage } from './pages/onboarding/VerificationRejectedPage'
import { RegistrationNeedMoreInfoPage } from './pages/onboarding/RegistrationNeedMoreInfoPage'
import { LoginPage } from './pages/auth/LoginPage'
import { SupplierOverviewPage } from './pages/supplier/SupplierOverviewPage'
import { SupplierProductListPage } from './pages/supplier/SupplierProductListPage'
import { SupplierLotListPage } from './pages/supplier/SupplierLotListPage'
import { SupplierRfqQuotesPage } from './pages/supplier/SupplierRfqQuotesPage'
import { SupplierOrdersPage } from './pages/supplier/SupplierOrdersPage'
import { SupplierDeliveryPage } from './pages/supplier/SupplierDeliveryPage'
import { SupplierDebtPage } from './pages/supplier/SupplierDebtPage'
import { SupplierReportsPage } from './pages/supplier/SupplierReportsPage'
import { SupplierProfilePage } from './pages/supplier/SupplierProfilePage'
import { SuppliersPage } from './pages/site/SuppliersPage'
import { SupplierDetailPage } from './pages/site/SupplierDetailPage'
import { SupportPage } from './pages/site/SupportPage'
import { AboutPage } from './pages/site/AboutPage'
import { BuyerDashboardPage } from './pages/buyer/BuyerDashboardPage'
import { BuyerSourcingPage } from './pages/buyer/BuyerSourcingPage'
import { BuyerProductBatchesPage } from './pages/buyer/BuyerProductBatchesPlaceholderPage'
import { BuyerRFQPage } from './pages/buyer/BuyerRFQPage'
import { BuyerOrdersPage } from './pages/buyer/BuyerOrdersPage'
import { BuyerBranchesPage } from './pages/buyer/BuyerBranchesPage'
import { BuyerDeliveryPage } from './pages/buyer/BuyerDeliveryPage'
import { BuyerDebtPage } from './pages/buyer/BuyerDebtPage'
import { BuyerMarketPricePage } from './pages/buyer/BuyerMarketPricePage'
import { BuyerLotDetailPage } from './pages/buyer/BuyerLotDetailPage'
import { BuyerProfilePage } from './pages/buyer/BuyerProfilePage'
import { AdminOverviewPage } from './pages/admin/AdminOverviewPage'
import { AdminUsersPage } from './pages/admin/AdminUsersPage'
import { AdminRegistrationsPage } from './pages/admin/AdminRegistrationsPage'
import { AdminDisputesPage } from './pages/admin/AdminDisputesPage'
import { AdminLoginPage } from './pages/admin/AdminLoginPage'
import { PublicBatchTracePage } from './pages/public/PublicBatchTracePage'

function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/auth/login" element={<LoginPage />} />
      <Route path="/onboarding/:role/business-info" element={<SupplierRegistrationBusinessInfoPage />} />
      <Route path="/onboarding/:role/contact-verification" element={<SupplierRegistrationContactVerificationPage />} />
      <Route
        path="/onboarding/verification/pending"
        element={
          <VerificationStateRoute allowedStatuses={['PENDING_VERIFICATION']}>
            <VerificationPendingPage />
          </VerificationStateRoute>
        }
      />
      <Route path="/onboarding/verification/approved" element={<VerificationApprovedPage />} />
      <Route
        path="/onboarding/verification/rejected"
        element={
          <VerificationStateRoute allowedStatuses={['REJECTED']}>
            <VerificationRejectedPage />
          </VerificationStateRoute>
        }
      />
      <Route
        path="/onboarding/registration/complete"
        element={
          <VerificationStateRoute allowedStatuses={['NEED_MORE_INFO']}>
            <RegistrationNeedMoreInfoPage />
          </VerificationStateRoute>
        }
      />
      <Route path="/supplier/overview" element={<ProtectedAppRoute allowedCompanyTypes={['supplier']}><SupplierOverviewPage /></ProtectedAppRoute>} />
      <Route path="/supplier/products" element={<ProtectedAppRoute allowedCompanyTypes={['supplier']}><SupplierProductListPage /></ProtectedAppRoute>} />
      <Route path="/supplier/products-lots" element={<Navigate to="/supplier/products" replace />} />
      <Route path="/supplier/products/:productId/lots" element={<ProtectedAppRoute allowedCompanyTypes={['supplier']}><SupplierLotListPage /></ProtectedAppRoute>} />
      <Route path="/supplier/rfq" element={<ProtectedAppRoute allowedCompanyTypes={['supplier']}><SupplierRfqQuotesPage /></ProtectedAppRoute>} />
      <Route path="/supplier/orders" element={<ProtectedAppRoute allowedCompanyTypes={['supplier']}><SupplierOrdersPage /></ProtectedAppRoute>} />
      <Route path="/supplier/delivery" element={<ProtectedAppRoute allowedCompanyTypes={['supplier']}><SupplierDeliveryPage /></ProtectedAppRoute>} />
      <Route path="/supplier/debt" element={<ProtectedAppRoute allowedCompanyTypes={['supplier']}><SupplierDebtPage /></ProtectedAppRoute>} />
      <Route path="/supplier/reports" element={<ProtectedAppRoute allowedCompanyTypes={['supplier']}><SupplierReportsPage /></ProtectedAppRoute>} />
      <Route path="/supplier/profile" element={<ProtectedAppRoute allowedCompanyTypes={['supplier']}><SupplierProfilePage /></ProtectedAppRoute>} />
      <Route path="/suppliers" element={<SuppliersPage />} />
      <Route path="/suppliers/:supplierId" element={<SupplierDetailPage />} />
      <Route path="/support" element={<SupportPage />} />
      <Route path="/about" element={<AboutPage />} />
      <Route path="/public/batch/:batchId" element={<PublicBatchTracePage />} />
      <Route path="/buyer/overview" element={<ProtectedAppRoute allowedCompanyTypes={['buyer']}><BuyerDashboardPage /></ProtectedAppRoute>} />
      <Route path="/buyer/sourcing" element={<ProtectedAppRoute allowedCompanyTypes={['buyer']}><BuyerSourcingPage /></ProtectedAppRoute>} />
      <Route path="/buyer/sourcing/products/:productId/batches" element={<ProtectedAppRoute allowedCompanyTypes={['buyer']}><BuyerProductBatchesPage /></ProtectedAppRoute>} />
      <Route path="/buyer/rfq" element={<ProtectedAppRoute allowedCompanyTypes={['buyer']}><BuyerRFQPage /></ProtectedAppRoute>} />
      <Route path="/buyer/orders" element={<ProtectedAppRoute allowedCompanyTypes={['buyer']}><BuyerOrdersPage /></ProtectedAppRoute>} />
      <Route path="/buyer/branches" element={<ProtectedAppRoute allowedCompanyTypes={['buyer']}><BuyerBranchesPage /></ProtectedAppRoute>} />
      <Route path="/buyer/delivery" element={<ProtectedAppRoute allowedCompanyTypes={['buyer']}><BuyerDeliveryPage /></ProtectedAppRoute>} />
      <Route path="/buyer/debt" element={<ProtectedAppRoute allowedCompanyTypes={['buyer']}><BuyerDebtPage /></ProtectedAppRoute>} />
      <Route path="/buyer/market-price" element={<ProtectedAppRoute allowedCompanyTypes={['buyer']}><BuyerMarketPricePage /></ProtectedAppRoute>} />
      <Route path="/buyer/lots/:lotId" element={<ProtectedAppRoute allowedCompanyTypes={['buyer']}><BuyerLotDetailPage /></ProtectedAppRoute>} />
      <Route path="/buyer/profile" element={<ProtectedAppRoute allowedCompanyTypes={['buyer']}><BuyerProfilePage /></ProtectedAppRoute>} />
      <Route path="/admin/login" element={<AdminLoginPage />} />
      <Route path="/admin/overview" element={<ProtectedAdminRoute><AdminOverviewPage /></ProtectedAdminRoute>} />
      <Route path="/admin/users" element={<ProtectedAdminRoute><AdminUsersPage /></ProtectedAdminRoute>} />
      <Route path="/admin/registrations" element={<ProtectedAdminRoute><AdminRegistrationsPage /></ProtectedAdminRoute>} />
      <Route path="/admin/disputes" element={<ProtectedAdminRoute><AdminDisputesPage /></ProtectedAdminRoute>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
