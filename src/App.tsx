import { useState } from "react";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { ConfigProvider } from "@/lib/config-context";
import { LoginPage } from "@/components/LoginPage";
import { LogoutPage } from "@/components/LogoutPage";
import { Sidebar } from "@/components/Sidebar";
import { Dashboard } from "@/components/Dashboard";
import { Rules } from "@/components/Rules";
import { SegmentMonitoring } from "@/components/SegmentMonitoring";
import { Settings } from "@/components/Settings";

function AppContent() {
  const { isAuthenticated, isLoading, error, login, logout, clearError } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showLogout, setShowLogout] = useState(false);

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard />;
      case 'rules':
        return <Rules />;
      case 'monitoring':
        return <SegmentMonitoring />;
      case 'settings':
        return <Settings />;
      default:
        return <Dashboard />;
    }
  };

  // Show logout page
  if (showLogout) {
    return (
      <LogoutPage
        onLogout={logout}
        onBackToLogin={() => setShowLogout(false)}
      />
    );
  }

  // Show login page if not authenticated
  if (!isAuthenticated) {
    return (
      <LoginPage
        onLogin={login}
        isLoading={isLoading}
        error={error || undefined}
      />
    );
  }

  // Show main application if authenticated
  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar 
        activeTab={activeTab} 
        onTabChange={setActiveTab}
        onLogout={() => setShowLogout(true)}
      />
      <main className="flex-1 overflow-auto">
        {renderContent()}
      </main>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <ConfigProvider>
        <AppContent />
      </ConfigProvider>
    </AuthProvider>
  );
}

export default App;