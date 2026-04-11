import { useState } from 'react';
import { Database, Shield } from 'lucide-react';
import SettingsDataManagement from './SettingsDataManagement';
import SettingsUsers from './SettingsUsers';
import './Settings.css';

type Tab = 'data' | 'users';

const TABS: { key: Tab; label: string; icon: any; desc: string }[] = [
  { key: 'data', label: 'Data Management', icon: Database, desc: 'Suppliers, storage, categories, and tags' },
  { key: 'users', label: 'User Management', icon: Shield, desc: 'Employee accounts and access' },
];

export default function Settings() {
  const [tab, setTab] = useState<Tab>('data');
  const current = TABS.find((t) => t.key === tab)!;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">{current.desc}</p>
        </div>
      </div>

      <div className="settings-tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`settings-tab ${tab === t.key ? 'active' : ''}`}
            onClick={() => setTab(t.key)}
          >
            <t.icon size={16} />
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      <div className="settings-tab-body">
        {tab === 'data' && <SettingsDataManagement />}
        {tab === 'users' && <SettingsUsers />}
      </div>
    </div>
  );
}
