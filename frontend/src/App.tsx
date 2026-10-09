import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { Navbar } from './components/Navbar';
import { OverviewPage } from './pages/OverviewPage';
import { SourceInfraPage } from './pages/SourceInfraPage';
import { TargetInfraPage } from './pages/TargetInfraPage';
import { VmInventoryPage } from './pages/VmInventoryPage';
import { ApplicationDiscoveryPage } from './pages/ApplicationDiscoveryPage';
import { MigrationPlanPage } from './pages/MigrationPlanPage';
import { MigrationWizardPage } from './pages/MigrationWizardPage';
import { MigrationHistoryPage } from './pages/MigrationHistoryPage';
import {
  DashboardOverview,
  SourceInfrastructure,
  TargetInfrastructure,
  DiscoveredVM
} from './types';
import { api } from './api/client';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [sources, setSources] = useState<SourceInfrastructure[]>([]);
  const [targets, setTargets] = useState<TargetInfrastructure[]>([]);
  const [vms, setVms] = useState<DiscoveredVM[]>([]);
  const [preselectedVmIds, setPreselectedVmIds] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  const refreshAll = async () => {
    setRefreshing(true);
    try {
      const [oData, sData, tData, vData] = await Promise.all([
        api.getOverview().catch(() => null),
        api.listSources().catch(() => []),
        api.listTargets().catch(() => []),
        api.listVMs().catch(() => []),
      ]);
      if (oData) setOverview(oData);
      setSources(sData);
      setTargets(tData);
      setVms(vData);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshAll();
  }, []);

  const handleMigrateSelected = (vmIds: string[]) => {
    setPreselectedVmIds(vmIds);
    setActiveTab('wizard');
  };

  const primarySource = sources[0];
  const primaryTarget = targets[0];

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 overflow-hidden font-sans">
      {/* Left Sidebar */}
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Navbar */}
        <Navbar
          source={primarySource}
          target={primaryTarget}
          onRefresh={refreshAll}
          refreshing={refreshing}
        />

        {/* Page Content Body */}
        <main className="flex-1 overflow-y-auto p-8">
          {activeTab === 'overview' && (
            <OverviewPage
              data={overview}
              loading={loading}
              onNavigate={(tab) => setActiveTab(tab)}
            />
          )}

          {activeTab === 'source' && (
            <SourceInfraPage
              sources={sources}
              onRefresh={refreshAll}
              onNavigateToVMs={() => setActiveTab('inventory')}
            />
          )}

          {activeTab === 'target' && (
            <TargetInfraPage
              targets={targets}
              onRefresh={refreshAll}
            />
          )}

          {activeTab === 'inventory' && (
            <VmInventoryPage
              vms={vms}
              sources={sources}
              onRefresh={refreshAll}
              onMigrateSelected={handleMigrateSelected}
            />
          )}

          {activeTab === 'discovery' && (
            <ApplicationDiscoveryPage
              vms={vms}
              sources={sources}
              onRefresh={refreshAll}
              onMigrateSelected={handleMigrateSelected}
            />
          )}

          {activeTab === 'plan' && (
            <MigrationPlanPage
              vms={vms}
              sources={sources}
              targets={targets}
              preselectedVmIds={preselectedVmIds}
              onStartExecution={(configs, commonTarget) => {
                setActiveTab('wizard');
              }}
            />
          )}

          {activeTab === 'wizard' && (
            <MigrationWizardPage
              vms={vms}
              sources={sources}
              targets={targets}
              preselectedVmIds={preselectedVmIds}
              onRefresh={refreshAll}
              onNavigateToHistory={() => setActiveTab('history')}
            />
          )}

          {activeTab === 'history' && (
            <MigrationHistoryPage
              onRefresh={refreshAll}
            />
          )}
        </main>
      </div>
    </div>
  );
};

export default App;
