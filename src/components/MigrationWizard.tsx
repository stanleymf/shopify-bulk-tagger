import React, { useState, useEffect } from 'react';
import { AlertCircle, Check, Database, HardDrive, Server, X, RefreshCw, Lock } from 'lucide-react';
import { migrationService, type MigrationStatus, type MigrationResult } from '../lib/migration-service';
import { serverStorage } from '../lib/server-storage';

interface MigrationWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onMigrationComplete: () => void;
}

type MigrationStep = 'check' | 'auth' | 'confirm' | 'migrate' | 'complete' | 'error';

export const MigrationWizard: React.FC<MigrationWizardProps> = ({
  isOpen,
  onClose,
  onMigrationComplete
}) => {
  const [currentStep, setCurrentStep] = useState<MigrationStep>('check');
  const [migrationStatus, setMigrationStatus] = useState<MigrationStatus | null>(null);
  const [migrationResult, setMigrationResult] = useState<MigrationResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Authentication state
  const [username, setUsername] = useState('admin123');
  const [password, setPassword] = useState('admin123');
  const [authError, setAuthError] = useState<string | null>(null);

  // Check migration status when wizard opens
  useEffect(() => {
    if (isOpen) {
      checkMigrationStatus();
    }
  }, [isOpen]);

  const checkMigrationStatus = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const status = await migrationService.getMigrationStatus();
      setMigrationStatus(status);
      
      if (!status.needsMigration) {
        if (status.isServerDataAvailable) {
          setCurrentStep('complete');
        } else {
          setError('No data found to migrate');
          setCurrentStep('error');
        }
      } else {
        // Show authentication step first
        setCurrentStep('auth');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to check migration status');
      setCurrentStep('error');
    } finally {
      setIsLoading(false);
    }
  };

  const startMigration = async () => {
    setIsLoading(true);
    setError(null);
    setCurrentStep('migrate');
    
    try {
      const result = await migrationService.migrateToServer();
      setMigrationResult(result);
      
      if (result.success) {
        setCurrentStep('complete');
        onMigrationComplete();
      } else {
        setError(`Migration completed with errors: ${result.errors.join(', ')}`);
        setCurrentStep('error');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Migration failed');
      setCurrentStep('error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSkipMigration = () => {
    // Set preference to use local storage for now
    migrationService.setStoragePreference(false);
    onClose();
  };

  const handleUseBothStorages = () => {
    // Keep both storages active (hybrid mode)
    migrationService.setStoragePreference(false);
    onClose();
  };

  const clearLocalStorage = async () => {
    setIsLoading(true);
    try {
      await migrationService.clearLocalStorageAfterMigration();
      setCurrentStep('complete');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clear localStorage');
    } finally {
      setIsLoading(false);
    }
  };

  const testAuthentication = async () => {
    setIsLoading(true);
    setAuthError(null);
    try {
      const success = await migrationService.testAuthentication(username, password);
      if (success) {
        // Update credentials for migration
        migrationService.updateServerCredentials(username, password);
        setCurrentStep('confirm');
      } else {
        setAuthError('Authentication failed. Please check your credentials.');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to test authentication';
      setAuthError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center space-x-3">
            <Database className="h-6 w-6 text-blue-600" />
            <h2 className="text-xl font-semibold text-gray-900">
              Storage Migration Wizard
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {currentStep === 'check' && (
            <div className="text-center">
              <RefreshCw className="h-12 w-12 text-blue-600 mx-auto mb-4 animate-spin" />
              <h3 className="text-lg font-medium mb-2">Checking your data...</h3>
              <p className="text-gray-600">
                We're analyzing your local storage to see what can be migrated to the server.
              </p>
            </div>
          )}

          {currentStep === 'auth' && (
            <div>
              <div className="text-center mb-6">
                <Lock className="h-12 w-12 text-blue-600 mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">Server Authentication</h3>
                <p className="text-gray-600">
                  Enter your server credentials to enable data migration to secure server-side storage.
                </p>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                <div className="flex">
                  <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <div className="ml-3">
                    <h4 className="text-sm font-medium text-yellow-800 mb-1">
                      Default Credentials
                    </h4>
                    <p className="text-sm text-yellow-700">
                      Username: <strong>admin123</strong> / Password: <strong>admin123</strong>
                    </p>
                    <p className="text-xs text-yellow-600 mt-1">
                      Contact your administrator if you need different credentials.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">
                    Username
                  </label>
                  <input
                    type="text"
                    id="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter username"
                    disabled={isLoading}
                  />
                </div>

                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                    Password
                  </label>
                  <input
                    type="password"
                    id="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter password"
                    disabled={isLoading}
                  />
                </div>

                {authError && (
                  <div className="bg-red-50 border border-red-200 rounded-md p-3">
                    <div className="flex">
                      <AlertCircle className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
                      <div className="ml-2">
                        <p className="text-sm text-red-700">{authError}</p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex space-x-3 pt-4">
                  <button
                    onClick={testAuthentication}
                    disabled={isLoading || !username || !password}
                    className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center"
                  >
                    {isLoading ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Testing Connection...
                      </>
                    ) : (
                      'Test & Continue'
                    )}
                  </button>
                  <button
                    onClick={onClose}
                    disabled={isLoading}
                    className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 disabled:bg-gray-100 disabled:cursor-not-allowed"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {currentStep === 'confirm' && migrationStatus && (
            <div>
              <div className="mb-6">
                <h3 className="text-lg font-medium mb-4">Migration Available</h3>
                <p className="text-gray-600 mb-4">
                  We found data in your browser's local storage that can be migrated to secure server-side storage.
                </p>
                
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                  <div className="flex">
                    <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                    <div className="ml-3">
                      <h4 className="text-sm font-medium text-yellow-800 mb-1">
                        Why migrate to server storage?
                      </h4>
                      <ul className="text-sm text-yellow-700 space-y-1">
                        <li>• Data persists across devices and browser sessions</li>
                        <li>• No risk of data loss from browser cache clearing</li>
                        <li>• Better performance and reliability</li>
                        <li>• Foundation for future multi-user features</li>
                      </ul>
                    </div>
                  </div>
                </div>

                {/* Data Summary */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="border rounded-lg p-4">
                    <div className="flex items-center space-x-2 mb-3">
                      <HardDrive className="h-5 w-5 text-gray-600" />
                      <h4 className="font-medium">Local Storage</h4>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>Shopify Config:</span>
                        <span className={migrationStatus.localDataCount.hasConfig ? 'text-green-600' : 'text-gray-400'}>
                          {migrationStatus.localDataCount.hasConfig ? '✓' : '—'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Segments:</span>
                        <span className="text-blue-600">{migrationStatus.localDataCount.segments}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Background Jobs:</span>
                        <span className="text-blue-600">{migrationStatus.localDataCount.jobs}</span>
                      </div>
                      <div className="flex justify-between">
                        
                      </div>
                    </div>
                  </div>

                  <div className="border rounded-lg p-4">
                    <div className="flex items-center space-x-2 mb-3">
                      <Server className="h-5 w-5 text-blue-600" />
                      <h4 className="font-medium">Server Storage</h4>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>Shopify Config:</span>
                        <span className={migrationStatus.serverDataCount.hasConfig ? 'text-green-600' : 'text-gray-400'}>
                          {migrationStatus.serverDataCount.hasConfig ? '✓' : '—'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Segments:</span>
                        <span className="text-blue-600">{migrationStatus.serverDataCount.segments}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Background Jobs:</span>
                        <span className="text-blue-600">{migrationStatus.serverDataCount.jobs}</span>
                      </div>
                      <div className="flex justify-between">
                        
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col space-y-3">
                <button
                  onClick={startMigration}
                  disabled={isLoading}
                  className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
                >
                  Migrate to Server Storage
                </button>
                
                <div className="flex space-x-3">
                  <button
                    onClick={handleUseBothStorages}
                    className="flex-1 border border-gray-300 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-50"
                  >
                    Keep Both (Hybrid)
                  </button>
                  <button
                    onClick={handleSkipMigration}
                    className="flex-1 border border-gray-300 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-50"
                  >
                    Skip for Now
                  </button>
                </div>
              </div>
            </div>
          )}

          {currentStep === 'migrate' && (
            <div className="text-center">
              <RefreshCw className="h-12 w-12 text-blue-600 mx-auto mb-4 animate-spin" />
              <h3 className="text-lg font-medium mb-2">Migrating your data...</h3>
              <p className="text-gray-600">
                Please wait while we securely transfer your data to the server.
              </p>
              <div className="mt-4 text-sm text-gray-500">
                This process usually takes less than a minute.
              </div>
            </div>
          )}

          {currentStep === 'complete' && migrationResult && (
            <div className="text-center">
              <div className="h-12 w-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check className="h-6 w-6 text-green-600" />
              </div>
              <h3 className="text-lg font-medium mb-2">Migration Complete!</h3>
              <p className="text-gray-600 mb-6">
                Your data has been successfully migrated to server-side storage.
              </p>

              {/* Migration Results */}
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
                <h4 className="font-medium text-green-800 mb-3">Migration Summary</h4>
                <div className="space-y-2 text-sm text-green-700">
                  {migrationResult.migratedItems.shopifyConfig && (
                    <div>✓ Shopify configuration migrated</div>
                  )}
                  {migrationResult.migratedItems.segments > 0 && (
                    <div>✓ {migrationResult.migratedItems.segments} customer segments migrated</div>
                  )}
                  {migrationResult.migratedItems.backgroundJobs > 0 && (
                    <div>✓ {migrationResult.migratedItems.backgroundJobs} background jobs migrated</div>
                  )}
                  
                  {migrationResult.migratedItems.settings > 0 && (
                    <div>✓ {migrationResult.migratedItems.settings} settings migrated</div>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <button
                  onClick={clearLocalStorage}
                  disabled={isLoading}
                  className="w-full bg-green-600 text-white py-3 px-4 rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium"
                >
                  Clear Local Storage & Complete
                </button>
                <button
                  onClick={onClose}
                  className="w-full border border-gray-300 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-50"
                >
                  Keep Local Storage & Continue
                </button>
              </div>
            </div>
          )}

          {currentStep === 'error' && (
            <div className="text-center">
              <div className="h-12 w-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="h-6 w-6 text-red-600" />
              </div>
              <h3 className="text-lg font-medium mb-2">Migration Issue</h3>
              <p className="text-gray-600 mb-4">
                {error || 'An unexpected error occurred during migration.'}
              </p>
              <div className="space-y-3">
                <button
                  onClick={checkMigrationStatus}
                  className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 font-medium"
                >
                  Try Again
                </button>
                <button
                  onClick={onClose}
                  className="w-full border border-gray-300 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-50"
                >
                  Continue with Local Storage
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}; 