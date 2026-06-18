import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const NOTIF_DIR = path.join(__dirname, '.anemona', 'notifications')

function uuid() {
  const hex = crypto.randomBytes(16).toString('hex')
  return [hex.slice(0,8), hex.slice(8,12), '4'+hex.slice(13,16), '8'+hex.slice(17,20), hex.slice(20,32)].join('-')
}

function makeNotif(type, priority, title, message, relatedItemId, action) {
  const id = uuid()
  return {
    id,
    key: relatedItemId ? `${type}:${relatedItemId}` : `${type}:${id}`,
    type,
    title,
    message,
    source: 'local',
    status: 'unread',
    priority,
    relatedItemId: relatedItemId ?? null,
    relatedItemType: relatedItemId ? 'task' : 'system',
    action: action ?? null,
    createdAt: new Date().toISOString(),
  }
}

const BASE = __dirname

// --- inbox.json ---
const inbox = [
  makeNotif('task_overdue', 'high', 'Task overdue', 'The task "Implement user auth" is overdue',
    'd4e5f6a7-b8c9-0123-defa-123456789abc',
    { type: 'task', target: 'd4e5f6a7-b8c9-0123-defa-123456789abc' }),
  makeNotif('task_due_soon', 'normal', 'Task due soon', '"Write API tests" is due in 6 hour(s)',
    'e5f6a7b8-c9d0-1234-efab-23456789abcd',
    { type: 'task', target: 'e5f6a7b8-c9d0-1234-efab-23456789abcd' }),
  makeNotif('system', 'low', 'Anémona Vault v1.0.4',
    'Notification system with task reminders, inbox/history panel, and Activity Bar badge.',
    'v1.0.4',
    { type: 'url', target: 'https://github.com/mygnet/anemona-vault/blob/main/CHANGELOG.md' }),
  makeNotif('task_due_soon', 'high', 'Task due soon', '"Comprar leche" is due in 2 hour(s)',
    'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    { type: 'task', target: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' }),
]

// --- history.json ---
const history = [
  {
    ...makeNotif('task_due_soon', 'normal', 'Task due soon', '"Code review" is due in 5 hour(s)', 'task-010'),
    status: 'read',
    readAt: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    ...makeNotif('system', 'low', 'Backup complete', 'Vault backup completed successfully'),
    status: 'read',
    readAt: new Date(Date.now() - 7200000).toISOString(),
  },
]

// --- index.json ---
const index = {
  version: 1,
  lastCheckAt: new Date().toISOString(),
  generatedKeys: [
    ...inbox.map(n => n.key),
    ...history.map(n => n.key),
  ],
}

// Write files
fs.mkdirSync(NOTIF_DIR, { recursive: true })
fs.writeFileSync(path.join(NOTIF_DIR, 'inbox.json'), JSON.stringify(inbox, null, 2) + '\n')
fs.writeFileSync(path.join(NOTIF_DIR, 'history.json'), JSON.stringify(history, null, 2) + '\n')
fs.writeFileSync(path.join(NOTIF_DIR, 'index.json'), JSON.stringify(index, null, 2) + '\n')

console.log(`Generated ${inbox.length} inbox + ${history.length} history notifications`)
console.log(`Path: ${NOTIF_DIR}`)
