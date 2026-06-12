"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.CryptoService = void 0;
const crypto = __importStar(require("crypto"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32;
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 32;
const CONFIG_FILE = '.config.json';
const LEGACY_CONFIG_FILE = '.env-anemona';
const LEGACY_ENV_KEY_FILE = '.env-key';
class CryptoService {
    constructor(storagePath) {
        this.cachedKey = null;
        this.vaultUnlocked = false;
        this._vaultPassword = null;
        this.storagePath = storagePath;
    }
    get configPath() {
        return path.join(this.storagePath, CONFIG_FILE);
    }
    get legacyEnvKeyPath() {
        return path.join(this.storagePath, LEGACY_ENV_KEY_FILE);
    }
    get legacyConfigPath() {
        return path.join(this.storagePath, LEGACY_CONFIG_FILE);
    }
    isVaultUnlocked() {
        return this.vaultUnlocked;
    }
    getVaultPassword() {
        return this._vaultPassword;
    }
    isUsingPasswordMode() {
        const config = this.loadConfig();
        return config.vault.mode === 'password';
    }
    resetToPlainKey() {
        const config = this.createDefaultConfig();
        this.saveConfig(config);
        this.cachedKey = Buffer.from(config.vault.key, 'base64');
        this.vaultUnlocked = true;
        this._vaultPassword = null;
    }
    createDefaultConfig() {
        return {
            version: 1,
            vault: {
                mode: 'plain',
                key: crypto.randomBytes(KEY_LENGTH).toString('base64'),
            },
            preferences: {},
        };
    }
    saveConfig(config) {
        fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2), 'utf-8');
    }
    isValidBase64Key(raw) {
        try {
            return Buffer.from(raw, 'base64').length === KEY_LENGTH;
        }
        catch {
            return false;
        }
    }
    extractPreferences(candidate) {
        return candidate.preferences && typeof candidate.preferences === 'object'
            ? candidate.preferences
            : {};
    }
    toConfig(vault, preferences = {}) {
        if ('key' in vault) {
            if (!this.isValidBase64Key(vault.key)) {
                throw new Error('Invalid vault key in .config.json');
            }
            return {
                version: 1,
                vault: { mode: 'plain', key: vault.key },
                preferences,
            };
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
        };
    }
    parseLegacyVault(candidate) {
        if (typeof candidate.key === 'string') {
            return this.toConfig({ key: candidate.key }).vault;
        }
        if (typeof candidate.salt === 'string' &&
            typeof candidate.hash === 'string' &&
            typeof candidate.encryptedKey === 'string') {
            return this.toConfig({
                salt: candidate.salt,
                hash: candidate.hash,
                encryptedKey: candidate.encryptedKey,
            }).vault;
        }
        return null;
    }
    parseConfigRaw(raw) {
        const trimmed = raw.trim();
        if (!trimmed)
            return null;
        if (this.isValidBase64Key(trimmed)) {
            return this.toConfig({ key: trimmed });
        }
        let parsed;
        try {
            parsed = JSON.parse(trimmed);
        }
        catch {
            return null;
        }
        if (!parsed || typeof parsed !== 'object') {
            return null;
        }
        const candidate = parsed;
        const vault = candidate.vault;
        const preferences = this.extractPreferences(candidate);
        if (vault && typeof vault === 'object') {
            const currentVault = vault;
            if (currentVault.mode === 'plain' && typeof currentVault.key === 'string') {
                return this.toConfig({ key: currentVault.key }, preferences);
            }
            if (currentVault.mode === 'password' &&
                typeof currentVault.salt === 'string' &&
                typeof currentVault.hash === 'string' &&
                typeof currentVault.encryptedKey === 'string') {
                return this.toConfig({
                    salt: currentVault.salt,
                    hash: currentVault.hash,
                    encryptedKey: currentVault.encryptedKey,
                }, preferences);
            }
        }
        const legacyVault = this.parseLegacyVault(candidate);
        if (legacyVault) {
            return this.toConfig(legacyVault, preferences);
        }
        return null;
    }
    normalizeConfig(data) {
        if (!data || typeof data !== 'object') {
            throw new Error('Invalid .config.json config');
        }
        const candidate = data;
        const vault = candidate.vault;
        if (!vault || typeof vault !== 'object') {
            throw new Error('Missing vault config in .config.json');
        }
        if (vault.mode === 'plain' && typeof vault.key === 'string') {
            return this.toConfig({ key: vault.key }, this.extractPreferences(candidate));
        }
        if (vault.mode === 'password' &&
            typeof vault.salt === 'string' &&
            typeof vault.hash === 'string' &&
            typeof vault.encryptedKey === 'string') {
            return this.toConfig({
                salt: vault.salt,
                hash: vault.hash,
                encryptedKey: vault.encryptedKey,
            }, this.extractPreferences(candidate));
        }
        throw new Error('Unsupported vault config in .config.json');
    }
    migrateLegacyFile(legacyPath, label) {
        if (!fs.existsSync(legacyPath))
            return null;
        const raw = fs.readFileSync(legacyPath, 'utf-8').trim();
        const config = this.parseConfigRaw(raw);
        if (!config) {
            throw new Error(`Legacy ${label} could not be migrated`);
        }
        this.saveConfig(config);
        fs.unlinkSync(legacyPath);
        return config;
    }
    migrateLegacyConfigFile() {
        return this.migrateLegacyFile(this.legacyConfigPath, '.env-anemona');
    }
    migrateLegacyConfig() {
        return this.migrateLegacyFile(this.legacyEnvKeyPath, '.env-key');
    }
    loadConfig() {
        if (fs.existsSync(this.configPath)) {
            const raw = fs.readFileSync(this.configPath, 'utf-8');
            const parsed = this.parseConfigRaw(raw);
            if (parsed) {
                this.saveConfig(parsed);
                return parsed;
            }
            const migrated = this.migrateLegacyConfigFile() ?? this.migrateLegacyConfig();
            if (migrated)
                return migrated;
            throw new Error('Invalid .config.json config');
        }
        const migrated = this.migrateLegacyConfigFile() ?? this.migrateLegacyConfig();
        if (migrated)
            return migrated;
        const config = this.createDefaultConfig();
        this.saveConfig(config);
        return config;
    }
    ensureEnvKey() {
        if (this.cachedKey)
            return this.cachedKey;
        const config = this.loadConfig();
        if (config.vault.mode === 'plain') {
            this.cachedKey = Buffer.from(config.vault.key, 'base64');
            this.vaultUnlocked = true;
            return this.cachedKey;
        }
        this.vaultUnlocked = false;
        throw new Error('Vault is locked. Enter your password to unlock.');
    }
    getVaultState() {
        const config = this.loadConfig();
        return {
            unlocked: config.vault.mode === 'plain' ? true : this.vaultUnlocked,
            hasPassword: config.vault.mode === 'password',
        };
    }
    unlock(password) {
        const config = this.loadConfig();
        if (config.vault.mode !== 'password') {
            this._vaultPassword = null;
            return false;
        }
        try {
            const salt = Buffer.from(config.vault.salt, 'hex');
            const storedHash = Buffer.from(config.vault.hash, 'hex');
            const encryptedKey = Buffer.from(config.vault.encryptedKey, 'base64');
            const derivedKey = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha512');
            const hash = crypto.createHash('sha256').update(derivedKey).digest();
            if (!crypto.timingSafeEqual(hash, storedHash))
                return false;
            const iv = encryptedKey.subarray(0, IV_LENGTH);
            const authTag = encryptedKey.subarray(encryptedKey.length - AUTH_TAG_LENGTH);
            const ciphertext = encryptedKey.subarray(IV_LENGTH, encryptedKey.length - AUTH_TAG_LENGTH);
            const decipher = crypto.createDecipheriv(ALGORITHM, derivedKey, iv);
            decipher.setAuthTag(authTag);
            const decrypted = Buffer.concat([
                decipher.update(ciphertext),
                decipher.final(),
            ]);
            this.cachedKey = decrypted;
            this.vaultUnlocked = true;
            this._vaultPassword = password;
            return true;
        }
        catch {
            this.cachedKey = null;
            this.vaultUnlocked = false;
            return false;
        }
    }
    lock() {
        this.cachedKey = null;
        this.vaultUnlocked = false;
        this._vaultPassword = null;
    }
    setPassword(password) {
        const key = this.ensureEnvKey();
        const salt = crypto.randomBytes(SALT_LENGTH);
        const derivedKey = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha512');
        const hash = crypto.createHash('sha256').update(derivedKey).digest();
        const iv = crypto.randomBytes(IV_LENGTH);
        const cipher = crypto.createCipheriv(ALGORITHM, derivedKey, iv);
        const encrypted = Buffer.concat([
            cipher.update(key),
            cipher.final(),
            cipher.getAuthTag(),
        ]);
        this.saveConfig({
            version: 1,
            vault: {
                mode: 'password',
                salt: salt.toString('hex'),
                hash: hash.toString('hex'),
                encryptedKey: Buffer.concat([iv, encrypted]).toString('base64'),
            },
            preferences: {},
        });
        this.cachedKey = null;
        this.vaultUnlocked = false;
        this._vaultPassword = password;
    }
    removePassword() {
        const key = this.cachedKey;
        if (!key)
            throw new Error('Vault must be unlocked to remove password');
        this.saveConfig({
            version: 1,
            vault: { mode: 'plain', key: key.toString('base64') },
            preferences: {},
        });
        this.vaultUnlocked = true;
        this._vaultPassword = null;
    }
    encrypt(plaintext) {
        const key = this.ensureEnvKey();
        const iv = crypto.randomBytes(IV_LENGTH);
        const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
        const encrypted = Buffer.concat([
            cipher.update(plaintext, 'utf-8'),
            cipher.final(),
            cipher.getAuthTag(),
        ]);
        return Buffer.concat([iv, encrypted]).toString('base64');
    }
    decrypt(ciphertext) {
        const key = this.ensureEnvKey();
        const payload = Buffer.from(ciphertext, 'base64');
        const iv = payload.subarray(0, IV_LENGTH);
        const authTag = payload.subarray(payload.length - AUTH_TAG_LENGTH);
        const data = payload.subarray(IV_LENGTH, payload.length - AUTH_TAG_LENGTH);
        const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
        decipher.setAuthTag(authTag);
        return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf-8');
    }
    encryptFileContent(content, password) {
        const salt = crypto.randomBytes(SALT_LENGTH);
        const key = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha512');
        const iv = crypto.randomBytes(IV_LENGTH);
        const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
        const encrypted = Buffer.concat([
            cipher.update(content, 'utf-8'),
            cipher.final(),
            cipher.getAuthTag(),
        ]);
        return Buffer.concat([salt, iv, encrypted]).toString('base64');
    }
    decryptFileContent(encrypted, password) {
        try {
            const payload = Buffer.from(encrypted, 'base64');
            const salt = payload.subarray(0, SALT_LENGTH);
            const iv = payload.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
            const authTag = payload.subarray(payload.length - AUTH_TAG_LENGTH);
            const data = payload.subarray(SALT_LENGTH + IV_LENGTH, payload.length - AUTH_TAG_LENGTH);
            const key = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha512');
            const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
            decipher.setAuthTag(authTag);
            return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf-8');
        }
        catch {
            return null;
        }
    }
    encryptEntries(entries) {
        return entries.map((e) => ({
            ...e,
            password: this.encrypt(e.password),
        }));
    }
    decryptEntries(entries) {
        return entries.map((e) => ({
            ...e,
            password: this.decrypt(e.password),
        }));
    }
}
exports.CryptoService = CryptoService;
//# sourceMappingURL=CryptoService.js.map