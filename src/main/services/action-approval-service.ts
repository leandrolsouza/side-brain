import { dialog } from 'electron'
import { t } from '../i18n'

/** Ask the user to approve the exact arguments that will be executed. */
export async function confirmAction(origin: string, action: string, args: Record<string, unknown>): Promise<boolean> {
  const result = await dialog.showMessageBox({
    type: 'question',
    title: t('notifications.action_approval.title'),
    message: t('notifications.action_approval.message', { origin, action }),
    detail: JSON.stringify(args, null, 2),
    buttons: [t('notifications.action_approval.reject'), t('notifications.action_approval.approve')],
    defaultId: 0,
    cancelId: 0,
    noLink: true,
  })
  return result.response === 1
}
