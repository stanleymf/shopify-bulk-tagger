import { useState, useEffect } from "react";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { ConfigProvider } from "@/lib/config-context";
import { LoginPage } from "@/components/LoginPage";
import { LogoutPage } from "@/components/LogoutPage";
import { Sidebar } from "@/components/Sidebar";
import { Dashboard } from "@/components/Dashboard";

import { SegmentMonitoring } from "@/components/SegmentMonitoring";
import { Settings } from "@/components/Settings";
import { MigrationWizard } from "@/components/MigrationWizard";
import { migrationService } from "@/lib/migration-service";

function AppContent() {
  const { isAuthenticated, isLoading, error, login, logout, clearError } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showLogout, setShowLogout] = useState(false);
  const [showMigrationWizard, setShowMigrationWizard] = useState(false);
  const [migrationChecked, setMigrationChecked] = useState(false);

  // Check if migration is needed after authentication
  useEffect(() => {
    if (isAuthenticated && !migrationChecked) {
      checkMigrationNeeded();
    }
  }, [isAuthenticated, migrationChecked]);

  const checkMigrationNeeded = async () => {
    try {
      const status = await migrationService.getMigrationStatus();
      
      // Show migration wizard if:
      // 1. There's local data available
      // 2. No server data available (or minimal server data)
      // 3. User hasn't explicitly set a storage preference
      const shouldShowMigration = status.needsMigration && 
                                 status.isLocalDataAvailable && 
                                 !status.isServerDataAvailable;

      if (shouldShowMigration) {
        console.log('🔄 Migration available - showing migration wizard');
        setShowMigrationWizard(true);
      } else {
        console.log('✅ No migration needed');
      }
    } catch (error) {
      console.warn('Failed to check migration status:', error);
    } finally {
      setMigrationChecked(true);
    }
  };

  const handleMigrationComplete = () => {
    console.log('🎉 Migration completed successfully');
    setShowMigrationWizard(false);
    // Optionally refresh the dashboard to show migrated data
    if (activeTab === 'dashboard') {
      window.location.reload();
    }
  };

  const handleCloseMigrationWizard = () => {
    setShowMigrationWizard(false);
    setMigrationChecked(true);
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard />;
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
      
      {/* Migration Wizard */}
      <MigrationWizard
        isOpen={showMigrationWizard}
        onClose={handleCloseMigrationWizard}
        onMigrationComplete={handleMigrationComplete}
      />
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