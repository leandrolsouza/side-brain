import { dialog } from 'electron'
import fs from 'fs'
import { Entry, EntryType, ActionStatus, Task, TaskStatus, TASK_STATUS_LABELS } from '../../shared/types'
import { EntryRepository } from '../database/repositories/entry-repository'
import { ProjectRepository } from '../database/repositories/project-repository'
import { TaskRepository } from '../database/repositories/task-repository'

const ENTRY_TYPE_LABELS: Record<EntryType, string> = {
  information: 'Informação',
  decision: 'Decisão',
  demand: 'Demanda',
  idea: 'Ideia',
  blocker: 'Bloqueio',
  update: 'Atualização',
}

const ACTION_STATUS_LABELS: Record<ActionStatus, string> = {
  none: 'Nenhuma',
  action_needed: 'Ação necessária',
  waiting_response: 'Aguardando resposta',
  done: 'Concluída',
}

export type ExportFormat = 'markdown' | 'pdf'

export class ExportService {
  private entryRepo = new EntryRepository()
  private projectRepo = new ProjectRepository()
  private taskRepo = new TaskRepository()

  async exportProject(projectId: string, format: ExportFormat): Promise<{ success: boolean; filePath?: string }> {
    const project = this.projectRepo.getById(projectId)
    if (!project) {
      throw new Error('Projeto não encontrado')
    }

    const entries = this.entryRepo.getAll(projectId)
    const tasks = this.taskRepo.getByProject(projectId)

    const markdown = this.generateMarkdown(project.name, project.description, entries, tasks)

    const extension = format === 'pdf' ? 'pdf' : 'md'
    const filterName = format === 'pdf' ? 'PDF' : 'Markdown'

    const result = await dialog.showSaveDialog({
      title: 'Exportar Relatório do Projeto',
      defaultPath: `${project.name.replace(/[^a-zA-Z0-9àáâãéêíóôõúçÀÁÂÃÉÊÍÓÔÕÚÇ\s-]/g, '')}_relatorio.${extension}`,
      filters: [
        { name: filterName, extensions: [extension] },
        { name: 'Todos os arquivos', extensions: ['*'] },
      ],
    })

    if (result.canceled || !result.filePath) {
      return { success: false }
    }

    if (format === 'pdf') {
      await this.writePdf(result.filePath, markdown, project.name)
    } else {
      fs.writeFileSync(result.filePath, markdown, 'utf-8')
    }

    return { success: true, filePath: result.filePath }
  }

  private generateMarkdown(
    projectName: string,
    projectDescription: string | undefined,
    entries: Entry[],
    tasks: Task[]
  ): string {
    const now = new Date()
    const dateStr = now.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })

    let md = `# Relatório: ${projectName}\n\n`
    md += `**Data de exportação:** ${dateStr}\n\n`

    if (projectDescription) {
      md += `**Descrição:** ${projectDescription}\n\n`
    }

    md += `---\n\n`

    // Summary stats
    const tasksByStatus = this.groupTasksByStatus(tasks)
    const entriesByType = this.groupEntriesByType(entries)

    md += `## Resumo\n\n`
    md += `- **Total de entradas:** ${entries.length}\n`
    md += `- **Total de tarefas:** ${tasks.length}\n`

    if (tasks.length > 0) {
      md += `  - A Fazer: ${tasksByStatus.todo?.length || 0}\n`
      md += `  - Em Andamento: ${tasksByStatus.in_progress?.length || 0}\n`
      md += `  - Aguardando: ${tasksByStatus.waiting?.length || 0}\n`
      md += `  - Concluído: ${tasksByStatus.done?.length || 0}\n`
    }

    md += `\n`

    // Tasks section
    if (tasks.length > 0) {
      md += `## Tarefas\n\n`

      const statusOrder: TaskStatus[] = ['in_progress', 'todo', 'waiting', 'done']
      for (const status of statusOrder) {
        const statusTasks = tasksByStatus[status]
        if (statusTasks && statusTasks.length > 0) {
          md += `### ${TASK_STATUS_LABELS[status]}\n\n`
          for (const task of statusTasks) {
            const checkbox = status === 'done' ? '[x]' : '[ ]'
            md += `- ${checkbox} **${task.title}**`
            if (task.dueDate) {
              md += ` (prazo: ${new Date(task.dueDate).toLocaleDateString('pt-BR')})`
            }
            md += `\n`
            if (task.description) {
              md += `  ${task.description}\n`
            }
          }
          md += `\n`
        }
      }
    }

    // Entries section
    if (entries.length > 0) {
      md += `## Entradas\n\n`

      const typeOrder: EntryType[] = ['decision', 'blocker', 'demand', 'idea', 'update', 'information']
      for (const type of typeOrder) {
        const typeEntries = entriesByType[type]
        if (typeEntries && typeEntries.length > 0) {
          md += `### ${ENTRY_TYPE_LABELS[type]} (${typeEntries.length})\n\n`
          for (const entry of typeEntries) {
            const date = new Date(entry.createdAt).toLocaleDateString('pt-BR')
            md += `- **[${date}]** ${entry.improvedText || entry.rawText}`
            if (entry.action !== 'none') {
              md += ` _(${ACTION_STATUS_LABELS[entry.action]})_`
            }
            md += `\n`
          }
          md += `\n`
        }
      }
    }

    md += `---\n\n`
    md += `_Relatório gerado pelo SideBrain em ${dateStr}_\n`

    return md
  }

  private async writePdf(filePath: string, markdown: string, title: string): Promise<void> {
    // Convert markdown to simple HTML for PDF generation via Electron's printToPDF
    const html = this.markdownToHtml(markdown, title)

    const { BrowserWindow } = await import('electron')
    const win = new BrowserWindow({
      show: false,
      webPreferences: { offscreen: true },
    })

    await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)

    const pdfBuffer = await win.webContents.printToPDF({
      printBackground: true,
      margins: { top: 0.5, bottom: 0.5, left: 0.5, right: 0.5 },
    })

    fs.writeFileSync(filePath, pdfBuffer)
    win.close()
  }

  private markdownToHtml(markdown: string, title: string): string {
    // Simple markdown to HTML conversion for PDF
    let html = markdown
      // Headers
      .replace(/^### (.+)$/gm, '<h3>$1</h3>')
      .replace(/^## (.+)$/gm, '<h2>$1</h2>')
      .replace(/^# (.+)$/gm, '<h1>$1</h1>')
      // Bold
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      // Italic
      .replace(/_\((.+?)\)_/g, '<em>($1)</em>')
      // Checkboxes
      .replace(/- \[x\] /g, '☑ ')
      .replace(/- \[ \] /g, '☐ ')
      // List items
      .replace(/^- (.+)$/gm, '<li>$1</li>')
      .replace(/^  (.+)$/gm, '<p class="indent">$1</p>')
      // Horizontal rules
      .replace(/^---$/gm, '<hr>')
      // Line breaks
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br>')

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 40px; color: #333; line-height: 1.6; }
    h1 { color: #1a1a2e; border-bottom: 2px solid #16213e; padding-bottom: 8px; }
    h2 { color: #16213e; margin-top: 24px; }
    h3 { color: #0f3460; margin-top: 16px; }
    li { margin: 4px 0; list-style: none; }
    hr { border: none; border-top: 1px solid #ddd; margin: 20px 0; }
    .indent { margin-left: 24px; color: #666; font-size: 0.9em; }
    em { color: #666; font-size: 0.85em; }
    p { margin: 8px 0; }
  </style>
</head>
<body>${html}</body>
</html>`
  }

  private groupTasksByStatus(tasks: Task[]): Record<string, Task[]> {
    return tasks.reduce((acc, task) => {
      if (!acc[task.status]) acc[task.status] = []
      acc[task.status].push(task)
      return acc
    }, {} as Record<string, Task[]>)
  }

  private groupEntriesByType(entries: Entry[]): Record<string, Entry[]> {
    return entries.reduce((acc, entry) => {
      if (!acc[entry.type]) acc[entry.type] = []
      acc[entry.type].push(entry)
      return acc
    }, {} as Record<string, Entry[]>)
  }
}
