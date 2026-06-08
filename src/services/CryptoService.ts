import * as crypto from 'crypto'
import * as fs from 'fs'
import * as path from 'path'
import type { KeyEntry } from '../types/notes'

const ALGORITHM = 'aes-256-gcm'
const KEY_LENGTH = 32
const IV_LENGTH = 16
const AUTH_TAG_LENGTH = 16
const SALT_LENGTH = 32
const CONFIG_FILE = '.env-anemona'
const LEGACY_ENV_KEY_FILE = '.env-key'

type VaultConfig =
  | { mode: 'plain'; key: string }
  | {
      mode: 'password'
      salt: string
      hash: string
      encryptedKey: string
    }

interface AnemonaFolderConfig {
  version: 1
  vault: VaultConfig
  preferences: Record<string, unknown>
}

type LegacyVaultConfig =
  | { key: string }
  | { salt: string; hash: string; encryptedKey: string }

export class CryptoService {
  private storagePath: string
  private cachedKey: Buffer | null = null
  private vaultUnlocked = false
  private _vaultPassword: string | null = null

  constructor(storagePath: string) {
    this.storagePath = storagePath
  }

  get configPath(): string {
    return path.join(this.storagePath, CONFIG_FILE)
  }

  get legacyEnvKeyPath(): string {
    return path.join(this.storagePath, LEGACY_ENV_KEY_FILE)
  }

  isVaultUnlocked(): boolean {
    return this.vaultUnlocked
  }

  getVaultPassword(): string | null {
    return this._vaultPassword
  }

  isUsingPasswordMode(): boolean {
    const config = this.loadConfig()
    return config.vault.mode === 'password'
  }

  resetToPlainKey(): void {
    const config = this.createDefaultConfig()
    this.saveConfig(config)
    this.cachedKey = Buffer.from(
      (config.vault as { mode: 'plain'; key: string }).key,
      'base64',
    )
    this.vaultUnlocked = true
    this._vaultPassword = null
  }

  private createDefaultConfig(): AnemonaFolderConfig {
    return {
      version: 1,
      vault: {
        mode: 'plain',
        key: crypto.randomBytes(KEY_LENGTH).toString('base64'),
      },
      preferences: {},
    }
  }

  private saveConfig(config: AnemonaFolderConfig): void {
    fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2), 'utf-8')
  }

  private isValidBase64Key(raw: string): boolean {
    try {
      return Buffer.from(raw, 'base64').length === KEY_LENGTH
    } catch {
      return false
    }
  }

  private extractPreferences(
    candidate: Record<string, unknown>,
  ): Record<string, unknown> {
    return candidate.preferences && typeof candidate.preferences === 'object'
      ? (candidate.preferences as Record<string, unknown>)
      : {}
  }

  private toConfig(
    vault: VaultConfig | LegacyVaultConfig,
    preferences: Record<string, unknown> = {},
  ): AnemonaFolderConfig {
    if ('key' in vault) {
      if (!this.isValidBase64Key(vault.key)) {
        throw new Error('Invalid vault key in .env-anemona')
      }

      return {
        version: 1,
        vault: { mode: 'plain', key: vault.key },
        preferences,
      }
    }

    return {
      version: 1,
      vault: {
        mode: 'password',
        salt: vault.salt,
        hash: vault.hash,
        encryptedKey: vault.encryptedKey,
      },
      preferences,
    }
  }

  private parseLegacyVault(candidate: Record<string, unknown>): VaultConfig | null {
    if (typeof candidate.key === 'string') {
      return this.toConfig({ key: candidate.key }).vault
    }

    if (
      typeof candidate.salt === 'string' &&
      typeof candidate.hash === 'string' &&
      typeof candidate.encryptedKey === 'string'
    ) {
      return this.toConfig({
        salt: candidate.salt,
        hash: candidate.hash,
        encryptedKey: candidate.encryptedKey,
      }).vault
    }

    return null
  }

  private parseConfigRaw(raw: string): AnemonaFolderConfig | null {
    const trimmed = raw.trim()
    if (!trimmed) return null

    if (this.isValidBase64Key(trimmed)) {
      return this.toConfig({ key: trimmed })
    }

    let parsed: unknown
    try {
      parsed = JSON.parse(trimmed)
    } catch {
      return null
    }

    if (!parsed || typeof parsed !== 'object') {
      return null
    }

    const candidate = parsed as Record<string, unknown>
    const vault = candidate.vault
    const preferences = this.extractPreferences(candidate)

    if (vault && typeof vault === 'object') {
      const currentVault = vault as Record<string, unknown>

      if (currentVault.mode === 'plain' && typeof currentVault.key === 'string') {
        return this.toConfig({ key: currentVault.key }, preferences)
      }

      if (
        currentVault.mode === 'password' &&
        typeof currentVault.salt === 'string' &&
        typeof currentVault.hash === 'string' &&
        typeof currentVault.encryptedKey === 'string'
      ) {
        return this.toConfig(
          {
            salt: currentVault.salt,
            hash: currentVault.hash,
            encryptedKey: currentVault.encryptedKey,
          },
          preferences,
        )
      }
    }

    const legacyVault = this.parseLegacyVault(candidate)
    if (legacyVault) {
      return this.toConfig(legacyVault, preferences)
    }

    return null
  }

  private normalizeConfig(data: unknown): AnemonaFolderConfig {
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid .env-anemona config')
    }

    const candidate = data as Record<string, unknown>
    const vault = candidate.vault as Record<string, unknown> | undefined
    if (!vault || typeof vault !== 'object') {
      throw new Error('Missing vault config in .env-anemona')
    }

    if (vault.mode === 'plain' && typeof vault.key === 'string') {
      return this.toConfig({ key: vault.key }, this.extractPreferences(candidate))
    }

    if (
      vault.mode === 'password' &&
      typeof vault.salt === 'string' &&
      typeof vault.hash === 'string' &&
      typeof vault.encryptedKey === 'string'
    ) {
      return this.toConfig(
        {
          salt: vault.salt,
          hash: vault.hash,
          encryptedKey: vault.encryptedKey,
        },
        this.extractPreferences(candidate),
      )
    }

    throw new Error('Unsupported vault config in .env-anemona')
  }

  private migrateLegacyConfig(): AnemonaFolderConfig | null {
    if (!fs.existsSync(this.legacyEnvKeyPath)) return null

    const raw = fs.readFileSync(this.legacyEnvKeyPath, 'utf-8').trim()
    const config = this.parseConfigRaw(raw)

    if (!config) {
      throw new Error('Legacy .env-key could not be migrated')
    }

    this.saveConfig(config)
    fs.unlinkSync(this.legacyEnvKeyPath)
    return config
  }

  private loadConfig(): AnemonaFolderConfig {
    if (fs.existsSync(this.configPath)) {
      const raw = fs.readFileSync(this.configPath, 'utf-8')
      const parsed = this.parseConfigRaw(raw)
      if (parsed) {
        this.saveConfig(parsed)
        return parsed
      }

      const migrated = this.migrateLegacyConfig()
      if (migrated) return migrated

      throw new Error('Invalid .env-anemona config')
    }

    const migrated = this.migrateLegacyConfig()
    if (migrated) return migrated

    const config = this.createDefaultConfig()
    this.saveConfig(config)
    return config
  }

  private ensureEnvKey(): Buffer {
    if (this.cachedKey) return this.cachedKey

    const config = this.loadConfig()
    if (config.vault.mode === 'plain') {
      this.cachedKey = Buffer.from(config.vault.key, 'base64')
      this.vaultUnlocked = true
      return this.cachedKey
    }

    this.vaultUnlocked = false
    throw new Error('Vault is locked. Enter your password to unlock.')
  }

  getVaultState(): { unlocked: boolean; hasPassword: boolean } {
    const config = this.loadConfig()
    return {
      unlocked: config.vault.mode === 'plain' ? true : this.vaultUnlocked,
      hasPassword: config.vault.mode === 'password',
    }
  }

  unlock(password: string): boolean {
    const config = this.loadConfig()
    if (config.vault.mode !== 'password') {
      this._vaultPassword = null
      return false
    }

    try {
      const salt = Buffer.from(config.vault.salt, 'hex')
      const storedHash = Buffer.from(config.vault.hash, 'hex')
      const encryptedKey = Buffer.from(config.vault.encryptedKey, 'base64')

      const derivedKey = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha512')
      const hash = crypto.createHash('sha256').update(derivedKey).digest()

      if (!crypto.timingSafeEqual(hash, storedHash)) return false

      const iv = encryptedKey.subarray(0, IV_LENGTH)
      const authTag = encryptedKey.subarray(
        encryptedKey.length - AUTH_TAG_LENGTH,
      )
      const ciphertext = encryptedKey.subarray(
        IV_LENGTH,
        encryptedKey.length - AUTH_TAG_LENGTH,
      )

      const decipher = crypto.createDecipheriv(ALGORITHM, derivedKey, iv)
      decipher.setAuthTag(authTag)
      const decrypted = Buffer.concat([
        decipher.update(ciphertext),
        decipher.final(),
      ])

      this.cachedKey = decrypted
      this.vaultUnlocked = true
      this._vaultPassword = password
      return true
    } catch {
      this.cachedKey = null
      this.vaultUnlocked = false
      return false
    }
  }

  lock(): void {
    this.cachedKey = null
    this.vaultUnlocked = false
    this._vaultPassword = null
  }

  setPassword(password: string): void {
    const key = this.ensureEnvKey()
    const salt = crypto.randomBytes(SALT_LENGTH)
    const derivedKey = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha512')
    const hash = crypto.createHash('sha256').update(derivedKey).digest()

    const iv = crypto.randomBytes(IV_LENGTH)
    const cipher = crypto.createCipheriv(ALGORITHM, derivedKey, iv)
    const encrypted = Buffer.concat([
      cipher.update(key),
      cipher.final(),
      cipher.getAuthTag(),
    ])

    this.saveConfig({
      version: 1,
      vault: {
        mode: 'password',
        salt: salt.toString('hex'),
        hash: hash.toString('hex'),
        encryptedKey: Buffer.concat([iv, encrypted]).toString('base64'),
      },
      preferences: {},
    })

    this.cachedKey = null
    this.vaultUnlocked = false
    this._vaultPassword = password
  }

  removePassword(): void {
    const key = this.cachedKey
    if (!key) throw new Error('Vault must be unlocked to remove password')

    this.saveConfig({
      version: 1,
      vault: { mode: 'plain', key: key.toString('base64') },
      preferences: {},
    })

    this.vaultUnlocked = true
    this._vaultPassword = null
  }

  encrypt(plaintext: string): string {
    const key = this.ensureEnvKey()
    const iv = crypto.randomBytes(IV_LENGTH)
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf-8'),
      cipher.final(),
      cipher.getAuthTag(),
    ])
    return Buffer.concat([iv, encrypted]).toString('base64')
  }

  decrypt(ciphertext: string): string {
    const key = this.ensureEnvKey()
    const payload = Buffer.from(ciphertext, 'base64')
    const iv = payload.subarray(0, IV_LENGTH)
    const authTag = payload.subarray(payload.length - AUTH_TAG_LENGTH)
    const data = payload.subarray(IV_LENGTH, payload.length - AUTH_TAG_LENGTH)

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
    decipher.setAuthTag(authTag)
    return Buffer.concat([decipher.update(data), decipher.final()]).toString(
      'utf-8',
    )
  }

  encryptFileContent(content: string, password: string): string {
    const salt = crypto.randomBytes(SALT_LENGTH)
    const key = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha512')
    const iv = crypto.randomBytes(IV_LENGTH)
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
    const encrypted = Buffer.concat([
      cipher.update(content, 'utf-8'),
      cipher.final(),
      cipher.getAuthTag(),
    ])
    return Buffer.concat([salt, iv, encrypted]).toString('base64')
  }

  decryptFileContent(encrypted: string, password: string): string | null {
    try {
      const payload = Buffer.from(encrypted, 'base64')
      const salt = payload.subarray(0, SALT_LENGTH)
      const iv = payload.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH)
      const authTag = payload.subarray(payload.length - AUTH_TAG_LENGTH)
      const data = payload.subarray(
        SALT_LENGTH + IV_LENGTH,
        payload.length - AUTH_TAG_LENGTH,
      )

      const key = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha512')
      const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
      decipher.setAuthTag(authTag)
      return Buffer.concat([decipher.update(data), decipher.final()]).toString(
        'utf-8',
      )
    } catch {
      return null
    }
  }

  encryptEntries(entries: KeyEntry[]): KeyEntry[] {
    return entries.map((e) => ({
      ...e,
      password: this.encrypt(e.password),
    }))
  }

  decryptEntries(entries: KeyEntry[]): KeyEntry[] {
    return entries.map((e) => ({
      ...e,
      password: this.decrypt(e.password),
    }))
  }
}
