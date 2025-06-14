import { useState } from "react";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { LoginPage } from "@/components/LoginPage";
import { LogoutPage } from "@/components/LogoutPage";
import { Sidebar } from "@/components/Sidebar";
import { Dashboard } from "@/components/Dashboard";
import { Rules } from "@/components/Rules";

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
      <AppContent />
    </AuthProvider>
  );
}

export default App;