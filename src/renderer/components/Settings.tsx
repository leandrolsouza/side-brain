import { ConfirmModal } from './ConfirmModal'
import { useSettingsController } from './settings/useSettingsController'
import { GeneralSettings } from './settings/GeneralSettings'
import { AppearanceSettings } from './settings/AppearanceSettings'
import { DataSettings } from './settings/DataSettings'
import { AdvancedSettings } from './settings/AdvancedSettings'

export function Settings() {
  const state = useSettingsController()
  const { tabs, activeTab, setActiveTab, confirmModal, setConfirmModal, t } = state

  return (
    <div className="settings-container">
      {/* Tab bar */}
      <div className="settings-tabs">
        {tabs.map((tab) => (
          <button
            type="button"
            key={tab.id}
            className={`settings-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="settings-panel">
        {activeTab === 'geral' && <GeneralSettings state={state} />}
        {activeTab === 'aparencia' && <AppearanceSettings state={state} />}
        {activeTab === 'dados' && <DataSettings state={state} />}
        {activeTab === 'avancado' && <AdvancedSettings state={state} />}
      </div>

      <ConfirmModal
        isOpen={confirmModal !== null}
        title={confirmModal?.title ?? ''}
        message={confirmModal?.message ?? ''}
        confirmLabel={confirmModal?.confirmLabel ?? t('common:confirm')}
        cancelLabel={confirmModal?.cancelLabel ?? t('common:cancel')}
        alternativeLabel={confirmModal?.alternativeLabel}
        secondAlternativeLabel={confirmModal?.secondAlternativeLabel}
        variant={confirmModal?.variant ?? 'default'}
        onConfirm={confirmModal?.onConfirm ?? (() => {})}
        onCancel={() => setConfirmModal(null)}
        onAlternative={confirmModal?.onAlternative}
        onSecondAlternative={confirmModal?.onSecondAlternative}
      />
    </div>
  )
}
