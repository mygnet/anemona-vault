import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = __dirname

// AES-256-GCM
const IV_LENGTH = 16
const AUTH_TAG_LENGTH = 16

// Generate a master key and write root .config.json
const masterKey = crypto.randomBytes(32)
const rootConfig = {
  version: 1,
  vault: { mode: 'plain', key: masterKey.toString('base64') },
  preferences: {}
}
fs.writeFileSync(path.join(ROOT, '.config.json'), JSON.stringify(rootConfig, null, 2) + '\n')
console.log('Master key (base64):', masterKey.toString('base64'))

function encrypt(plaintext) {
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv('aes-256-gcm', masterKey, iv)
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf-8'),
    cipher.final(),
    cipher.getAuthTag(),
  ])
  return Buffer.concat([iv, encrypted]).toString('base64')
}

function decrypt(ciphertext) {
  const payload = Buffer.from(ciphertext, 'base64')
  const iv = payload.subarray(0, IV_LENGTH)
  const authTag = payload.subarray(payload.length - AUTH_TAG_LENGTH)
  const data = payload.subarray(IV_LENGTH, payload.length - AUTH_TAG_LENGTH)
  const decipher = crypto.createDecipheriv('aes-256-gcm', masterKey, iv)
  decipher.setAuthTag(authTag)
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf-8')
}

function encryptEntries(entries) {
  return entries.map(e => ({ ...e, password: encrypt(e.password) }))
}

function encryptKeyFile(filePath) {
  const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
  if (data.entries) {
    data.entries = encryptEntries(data.entries)
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n')
    console.log('  Encrypted:', path.relative(ROOT, filePath))
  }
}

function encryptFileContent(content, password) {
  const SALT_LENGTH = 32
  const salt = crypto.randomBytes(SALT_LENGTH)
  const key = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha512')
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([
    cipher.update(content, 'utf-8'),
    cipher.final(),
    cipher.getAuthTag(),
  ])
  return Buffer.concat([salt, iv, encrypted]).toString('base64')
}

function verifyEncryptedKeyFile(filePath) {
  const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
  if (data.entries && data.entries.length > 0) {
    const firstPassword = data.entries[0].password
    try {
      const decrypted = decrypt(firstPassword)
      console.log(`  Verified: ${path.relative(ROOT, filePath)} -> "${decrypted}"`)
    } catch (e) {
      console.error(`  FAILED to decrypt: ${path.relative(ROOT, filePath)}`)
    }
  }
}

// Walk all .anemona-key files
function walk(dir) {
  const files = fs.readdirSync(dir)
  for (const f of files) {
    const full = path.join(dir, f)
    const stat = fs.statSync(full)
    if (stat.isDirectory()) {
      if (f !== 'node_modules') walk(full)
    } else if (f.endsWith('.anemona-key')) {
      encryptKeyFile(full)
    }
  }
}

// Handle .anemona-lock file
const lockPath = path.join(ROOT, 'EdgeCases', 'locked.anemona-lock')
const lockContent = JSON.stringify({
  entries: [{ title: 'Locked Entry', password: 'secret-inside-lock', note: 'This file is fully encrypted' }],
  locked: true
}, null, 2)
const encryptedLock = encryptFileContent(lockContent, 'test-password-123')
fs.writeFileSync(lockPath, encryptedLock + '\n')
console.log('  Encrypted:', path.relative(ROOT, lockPath), `(password: test-password-123)`)

walk(ROOT)

// Verify all .anemona-key files decrypt correctly
console.log('\n--- Verification ---')
function verifyFiles(dir) {
  const files = fs.readdirSync(dir)
  for (const f of files) {
    const full = path.join(dir, f)
    const stat = fs.statSync(full)
    if (stat.isDirectory()) {
      if (f !== 'node_modules') verifyFiles(full)
    } else if (f.endsWith('.anemona-key')) {
      verifyEncryptedKeyFile(full)
    }
  }
}
verifyFiles(ROOT)
console.log('\nDone. All password fields encrypted with AES-256-GCM.')
