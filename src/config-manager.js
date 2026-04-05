const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

const execAsync = promisify(exec);

const OPENCLAW_LOCAL_BIN = path.join(__dirname, '..', 'node_modules', '.bin', 'openclaw');

async function runOpenClaw(args) {
  const fsSync = require('fs');
  const localBin = OPENCLAW_LOCAL_BIN;
  const useLocal = fsSync.existsSync(localBin);
  
  if (!useLocal) {
    const pkgPath = path.join(__dirname, '..', 'node_modules', 'openclaw', 'package.json');
    if (!fsSync.existsSync(pkgPath)) {
      throw new Error('OpenClaw não está instalado. Execute a instalação primeiro.');
    }
    throw new Error('OpenClaw binário não encontrado. Execute a instalação primeiro.');
  }
  
  console.log(`[OpenClaw] Executando: ${localBin} ${args}`);
  
  const cmd = `"${localBin}" ${args}`;
  return execAsync(cmd);
}

class ConfigManager {
  constructor() {
    this.configPath = path.join(os.homedir(), '.openclaw', 'openclaw.json');
    this.envPath = path.join(os.homedir(), '.openclaw', '.env');
    this.stateDir = process.env.OPENCLAW_STATE_DIR || path.join(os.homedir(), '.openclaw');
  }

  async ensureOpenClawDir() {
    const dir = path.join(os.homedir(), '.openclaw');
    try {
      await fs.mkdir(dir, { recursive: true });
    } catch (e) {
      if (e.code !== 'EEXIST') throw e;
    }
  }

  async getConfig() {
    try {
      const content = await fs.readFile(this.configPath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      if (error.code === 'ENOENT') {
        return {};
      }
      throw error;
    }
  }

  async saveConfig(config) {
    await this.ensureOpenClawDir();
    await fs.writeFile(this.configPath, JSON.stringify(config, null, 2), 'utf-8');
  }

  async updateConfig(section, data) {
    const config = await this.getConfig();

    switch (section) {
      case 'agents':
        config.agents = { ...config.agents, ...data };
        break;
      case 'gateway':
        config.gateway = { ...config.gateway, ...data };
        break;
      case 'channels':
        config.channels = { ...config.channels, ...data };
        break;
      case 'tools':
        config.tools = { ...config.tools, ...data };
        break;
      case 'session':
        config.session = { ...config.session, ...data };
        break;
      case 'models':
        config.models = { ...config.models, ...data };
        break;
      case 'env':
        await this.updateEnvFile(data);
        return;
      default:
        Object.assign(config, data);
    }

    await this.saveConfig(config);
  }

  async updateEnvFile(envVars) {
    await this.ensureOpenClawDir();
    let content = '';
    try {
      content = await fs.readFile(this.envPath, 'utf-8');
    } catch (e) {
      if (e.code !== 'ENOENT') throw e;
    }

    const lines = content.split('\n');
    const updatedKeys = new Set(Object.keys(envVars));

    const newLines = lines.map(line => {
      const match = line.match(/^([A-Z_]+)=/);
      if (match && updatedKeys.has(match[1])) {
        updatedKeys.delete(match[1]);
        return `${match[1]}=${envVars[match[1]]}`;
      }
      return line;
    });

    for (const [key, value] of Object.entries(updatedKeys)) {
      newLines.push(`${key}=${value}`);
    }

    await fs.writeFile(this.envPath, newLines.join('\n'), 'utf-8');
  }

  async setAuth(provider, apiKey, model) {
    const config = await this.getConfig();

    const providerMap = {
      'anthropic': { envKey: 'ANTHROPIC_API_KEY', modelPrefix: 'anthropic' },
      'openai': { envKey: 'OPENAI_API_KEY', modelPrefix: 'openai' },
      'openrouter': { envKey: 'OPENROUTER_API_KEY', modelPrefix: 'openrouter' },
      'xai': { envKey: 'XAI_API_KEY', modelPrefix: 'xai' },
      'opencode': { envKey: 'OPENCODE_API_KEY', modelPrefix: 'opencode' },
      'ollama': { envKey: null, modelPrefix: 'ollama' },
      'groq': { envKey: 'GROQ_API_KEY', modelPrefix: 'groq' },
      'google': { envKey: 'GOOGLE_API_KEY', modelPrefix: 'google' },
      'mistral': { envKey: 'MISTRAL_API_KEY', modelPrefix: 'mistral' },
      'deepseek': { envKey: 'DEEPSEEK_API_KEY', modelPrefix: 'deepseek' },
      'minimax': { envKey: 'MINIMAX_API_KEY', modelPrefix: 'minimax' },
      'synthetic': { envKey: 'SYNTHETIC_API_KEY', modelPrefix: 'synthetic' },
      'vercel-ai-gateway': { envKey: 'AI_GATEWAY_API_KEY', modelPrefix: 'vercel-ai-gateway' },
    };

    const providerInfo = providerMap[provider];
    if (!providerInfo) {
      throw new Error(`Provedor não suportado: ${provider}`);
    }

    if (providerInfo.envKey) {
      await this.updateEnvFile({ [providerInfo.envKey]: apiKey });
    }

    if (provider === 'ollama') {
      config.models = config.models || {};
      config.models.providers = config.models.providers || {};
      config.models.providers.OLLAMA = { baseUrl: apiKey || 'http://localhost:11434' };
    } else if (provider === 'opencode') {
      if (!config.models) config.models = {};
      if (!config.models.providers) config.models.providers = {};
      config.models.providers.opencode = { apiKey };
    } else if (provider === 'openrouter') {
      if (!config.models) config.models = {};
      if (!config.models.providers) config.models.providers = {};
      config.models.providers.openrouter = {
        baseUrl: 'https://openrouter.ai/api/v1',
        apiKey,
        api: 'openai-completions',
        models: [{ id: 'auto', name: 'Auto' }],
      };
    } else {
      if (!config.models) config.models = {};
      if (!config.models.providers) config.models.providers = {};
      config.models.providers[provider] = { apiKey };
    }

    if (model) {
      if (!config.agents) config.agents = {};
      if (!config.agents.defaults) config.agents.defaults = {};
      config.agents.defaults.model = model;
    } else if (providerInfo.modelPrefix) {
      if (!config.agents) config.agents = {};
      if (!config.agents.defaults) config.agents.defaults = {};
      if (!config.agents.defaults.model || config.agents.defaults.model.startsWith('openai') || config.agents.defaults.model.startsWith('openai-codex')) {
        const defaultModels = {
          'anthropic': 'anthropic/claude-sonnet-4-6',
          'openai': 'openai/gpt-5.4',
          'openrouter': 'openrouter/anthropic/claude-sonnet-4-6',
          'xai': 'xai/grok-3',
          'opencode': 'opencode/zen',
          'groq': 'groq/llama-3.3-70b',
          'google': 'google/gemini-2.5-pro',
          'mistral': 'mistral/mistral-large-2',
          'deepseek': 'deepseek/deepseek-chat',
          'minimax': 'minimax/MiniMax-M2.7',
          'synthetic': 'synthetic/claude-sonnet-4-6',
        };
        config.agents.defaults.model = defaultModels[provider] || `${providerInfo.modelPrefix}/default`;
      }
    }

    config.wizard = config.wizard || {};
    config.wizard.lastRunAt = new Date().toISOString();

    await this.saveConfig(config);
  }

  normalizeAllowedOrigins(originsInput) {
    if (originsInput == null) return null;

    const rawOrigins = Array.isArray(originsInput)
      ? originsInput
      : String(originsInput)
          .split(',')
          .map(origin => origin.trim());

    const normalized = [];
    const seen = new Set();

    for (const rawOrigin of rawOrigins) {
      if (!rawOrigin) continue;

      if (rawOrigin === '*') {
        if (!seen.has('*')) {
          seen.add('*');
          normalized.push('*');
        }
        continue;
      }

      let parsed;
      try {
        parsed = new URL(rawOrigin);
      } catch {
        throw new Error(`Origem CORS inválida: ${rawOrigin}`);
      }

      if (!['http:', 'https:'].includes(parsed.protocol)) {
        throw new Error(`Origem CORS deve usar http/https: ${rawOrigin}`);
      }

      const origin = parsed.origin;
      if (!seen.has(origin)) {
        seen.add(origin);
        normalized.push(origin);
      }
    }

    return normalized;
  }

  async configureGateway({ port, bind, authMode, token, password, allowedOrigins }) {
    const config = await this.getConfig();

    if (!config.gateway) config.gateway = {};

    if (port) config.gateway.port = parseInt(port);
    if (bind) config.gateway.bind = bind;

    if (authMode) {
      config.gateway.auth = config.gateway.auth || {};
      config.gateway.auth.mode = authMode;

      if (authMode === 'token' && token) {
        config.gateway.auth.token = token;
      }
      if (authMode === 'password' && password) {
        config.gateway.auth.password = password;
      }
    }

    config.gateway.controlUi = config.gateway.controlUi || {};
    config.gateway.controlUi.allowInsecureAuth = true;
    if (allowedOrigins !== undefined) {
      config.gateway.controlUi.allowedOrigins = this.normalizeAllowedOrigins(allowedOrigins);
    }

    await this.saveConfig(config);
  }

  async configureChannel(channel, configData) {
    const config = await this.getConfig();

    if (!config.channels) config.channels = {};
    config.channels[channel] = { ...config.channels[channel], ...configData, enabled: true };

    await this.saveConfig(config);
  }

  async configureWebSearch(provider, apiKey) {
    const config = await this.getConfig();

    const providerToolsMap = {
      'brave': 'BRAVE_API_KEY',
      'exa': 'EXA_API_KEY',
      'firecrawl': 'FIRECRAWL_API_KEY',
      'tavily': 'TAVILY_API_KEY',
      'perplexity': 'PERPLEXITY_API_KEY',
      'searxng': null,
      'duckduckgo': null,
      'gemini': 'GOOGLE_API_KEY',
      'grok': 'XAI_API_KEY',
      'kimi': 'MOONSHOT_API_KEY',
      'minimax-search': 'MINIMAX_API_KEY',
      'ollama-web-search': null,
    };

    if (providerToolsMap[provider] && apiKey) {
      await this.updateEnvFile({ [providerToolsMap[provider]]: apiKey });
    }

    if (!config.tools) config.tools = {};
    if (!config.tools.web) config.tools.web = {};
    if (provider) {
      config.tools.web.search = { provider };
    }

    await this.saveConfig(config);
  }

  async configureWorkspace(workspacePath) {
    const config = await this.getConfig();

    if (!config.agents) config.agents = {};
    if (!config.agents.defaults) config.agents.defaults = {};
    config.agents.defaults.workspace = workspacePath || '~/.openclaw/workspace';

    await this.saveConfig(config);
  }

  async getOpenClawStatus() {
    try {
      const { stdout } = await runOpenClaw('status --json 2>/dev/null || echo "not_configured"');
      if (stdout.trim() === 'not_configured') {
        return 'not_configured';
      }
      try {
        return JSON.parse(stdout);
      } catch {
        return stdout.trim();
      }
    } catch {
      return 'not_configured';
    }
  }

  async getProviders() {
    const providers = [
      {
        id: 'anthropic',
        name: 'Anthropic',
        description: 'Claude Sonnet, Opus, Haiku',
        envKey: 'ANTHROPIC_API_KEY',
        defaultModel: 'anthropic/claude-sonnet-4-6',
        models: ['anthropic/claude-sonnet-4-6', 'anthropic/claude-opus-4-6', 'anthropic/claude-haiku-4-6'],
        icon: '🤖',
      },
      {
        id: 'openai',
        name: 'OpenAI',
        description: 'GPT-5.4, GPT-4o',
        envKey: 'OPENAI_API_KEY',
        defaultModel: 'openai/gpt-5.4',
        models: ['openai/gpt-5.4', 'openai/gpt-4o', 'openai/o3'],
        icon: '🧠',
      },
      {
        id: 'openrouter',
        name: 'OpenRouter',
        description: 'Multi-model proxy',
        envKey: 'OPENROUTER_API_KEY',
        defaultModel: 'openrouter/anthropic/claude-sonnet-4-6',
        models: ['openrouter/anthropic/claude-sonnet-4-6', 'openrouter/openai/gpt-5.4'],
        icon: '🌐',
      },
      {
        id: 'xai',
        name: 'xAI (Grok)',
        description: 'Grok 3',
        envKey: 'XAI_API_KEY',
        defaultModel: 'xai/grok-3',
        models: ['xai/grok-3', 'xai/grok-3-fast'],
        icon: '🚀',
      },
      {
        id: 'opencode',
        name: 'OpenCode',
        description: 'Zen ou Go catalog',
        envKey: 'OPENCODE_API_KEY',
        defaultModel: 'opencode/zen',
        models: ['opencode/zen', 'opencode/go'],
        icon: '⚡',
      },
      {
        id: 'ollama',
        name: 'Ollama',
        description: 'Modelos locais',
        envKey: null,
        defaultModel: 'ollama/llama3.3',
        models: ['ollama/llama3.3', 'ollama/mistral', 'ollama/qwen2.5'],
        icon: '🦙',
      },
      {
        id: 'google',
        name: 'Google (Gemini)',
        description: 'Gemini 2.5 Pro',
        envKey: 'GOOGLE_API_KEY',
        defaultModel: 'google/gemini-2.5-pro',
        models: ['google/gemini-2.5-pro', 'google/gemini-2.0-flash'],
        icon: '💎',
      },
      {
        id: 'groq',
        name: 'Groq',
        description: 'Inferência ultra-rápida',
        envKey: 'GROQ_API_KEY',
        defaultModel: 'groq/llama-3.3-70b',
        models: ['groq/llama-3.3-70b', 'groq/mixtral-8x7b'],
        icon: '⚡',
      },
      {
        id: 'mistral',
        name: 'Mistral',
        description: 'Mistral Large',
        envKey: 'MISTRAL_API_KEY',
        defaultModel: 'mistral/mistral-large-2',
        models: ['mistral/mistral-large-2', 'mistral/codestral'],
        icon: '🌫️',
      },
      {
        id: 'deepseek',
        name: 'DeepSeek',
        description: 'DeepSeek Chat',
        envKey: 'DEEPSEEK_API_KEY',
        defaultModel: 'deepseek/deepseek-chat',
        models: ['deepseek/deepseek-chat', 'deepseek/deepseek-coder'],
        icon: '🔍',
      },
      {
        id: 'minimax',
        name: 'MiniMax',
        description: 'MiniMax-M2.7',
        envKey: 'MINIMAX_API_KEY',
        defaultModel: 'minimax/MiniMax-M2.7',
        models: ['minimax/MiniMax-M2.7'],
        icon: '🎯',
      },
      {
        id: 'synthetic',
        name: 'Synthetic',
        description: 'Anthropic-compatible',
        envKey: 'SYNTHETIC_API_KEY',
        defaultModel: 'synthetic/claude-sonnet-4-6',
        models: ['synthetic/claude-sonnet-4-6'],
        icon: '🔧',
      },
      {
        id: 'vercel-ai-gateway',
        name: 'Vercel AI Gateway',
        description: 'Multi-model proxy da Vercel',
        envKey: 'AI_GATEWAY_API_KEY',
        defaultModel: 'vercel-ai-gateway/anthropic/claude-sonnet-4-6',
        models: ['vercel-ai-gateway/anthropic/claude-sonnet-4-6'],
        icon: '▲',
      },
      {
        id: 'moonshot',
        name: 'Moonshot AI (Kimi)',
        description: 'Kimi K2',
        envKey: 'MOONSHOT_API_KEY',
        defaultModel: 'moonshot/kimi-k2',
        models: ['moonshot/kimi-k2'],
        icon: '🌙',
      },
    ];

    return providers;
  }

  async startGateway() {
    await runOpenClaw('gateway start --port 80 --bind 0.0.0.0');
  }

  async stopGateway() {
    await runOpenClaw('gateway stop');
  }

  async getGatewayStatus() {
    try {
      const { stdout } = await runOpenClaw('status --json 2>/dev/null');
      return JSON.parse(stdout);
    } catch {
      return { running: false };
    }
  }

  async runHealthCheck() {
    try {
      const { stdout } = await runOpenClaw('health --json 2>/dev/null');
      return JSON.parse(stdout);
    } catch (error) {
      return { healthy: false, error: error.message };
    }
  }

  async installDaemon(runtime = 'node') {
    await runOpenClaw(`daemon install --runtime ${runtime}`);
  }

  async installSkills(nodeManager = 'npm') {
    await runOpenClaw(`skills install --node-manager ${nodeManager}`);
  }

  async getOnboardingProgress() {
    const config = await this.getConfig();
    const progress = {
      installed: await this.checkOpenClawInstalled(),
      auth: !!(config.models?.providers && Object.keys(config.models.providers).length > 0),
      workspace: !!(config.agents?.defaults?.workspace),
      gateway: !!(config.gateway?.port),
      channels: !!(config.channels && Object.keys(config.channels).length > 0),
      webSearch: !!(config.tools?.web?.search?.provider),
      daemon: false,
      skills: false,
      completed: !!(config.wizard?.lastRunAt),
    };

    try {
      await execAsync('systemctl --user is-active openclaw-gateway 2>/dev/null');
      progress.daemon = true;
    } catch {
      progress.daemon = false;
    }

    try {
      await fs.access(path.join(os.homedir(), '.openclaw', 'skills'));
      progress.skills = true;
    } catch {
      progress.skills = false;
    }

    return progress;
  }

  async completeOnboarding() {
    const config = await this.getConfig();
    config.wizard = config.wizard || {};
    config.wizard.lastRunAt = new Date().toISOString();
    config.wizard.lastRunVersion = '1.0.0';
    config.wizard.lastRunMode = 'local';
    config.wizard.lastRunCommand = 'onboard';

    if (!config.session) config.session = {};
    if (!config.session.dmScope) config.session.dmScope = 'per-channel-peer';

    if (!config.tools) config.tools = {};
    if (!config.tools.profile) config.tools.profile = 'coding';

    await this.saveConfig(config);

    const completeFile = path.join(__dirname, '..', '.complete');
    await fs.writeFile(completeFile, '0', { encoding: 'utf8' });
  }

  async resetConfig(scope = 'config') {
    const scopeMap = {
      'config': ['config', 'creds', 'sessions'],
      'full': ['config', 'creds', 'sessions', 'workspace'],
    };

    const scopes = scopeMap[scope] || scopeMap['config'];

    for (const s of scopes) {
      try {
        switch (s) {
          case 'config':
            await fs.unlink(this.configPath).catch(() => {});
            break;
          case 'creds':
            await fs.rm(path.join(this.stateDir, 'credentials'), { recursive: true, force: true });
            break;
          case 'sessions':
            await fs.rm(path.join(this.stateDir, 'agents'), { recursive: true, force: true });
            break;
          case 'workspace':
            await fs.rm(path.join(this.stateDir, 'workspace'), { recursive: true, force: true });
            break;
        }
      } catch (e) {
        console.error(`Erro ao resetar ${s}:`, e.message);
      }
    }

    const completeFile = path.join(__dirname, '..', '.complete');
    await fs.unlink(completeFile).catch(() => {});
  }

  async getAvailableModels() {
    try {
      const { stdout } = await runOpenClaw('models list --json 2>/dev/null');
      return JSON.parse(stdout);
    } catch {
      return [];
    }
  }

  async checkOpenClawInstalled() {
    try {
      await runOpenClaw('--version');
      return true;
    } catch {
      return false;
    }
  }

  async fixControlUiOrigins(allowedOrigins) {
    const config = await this.getConfig();
    if (!config.gateway) config.gateway = {};
    if (!config.gateway.controlUi) config.gateway.controlUi = {};
    if (allowedOrigins !== undefined) {
      config.gateway.controlUi.allowedOrigins = this.normalizeAllowedOrigins(allowedOrigins);
    } else if (config.gateway.controlUi.allowedOrigins !== undefined) {
      config.gateway.controlUi.allowedOrigins = this.normalizeAllowedOrigins(
        config.gateway.controlUi.allowedOrigins,
      );
    }
    config.gateway.controlUi.allowInsecureAuth = true;
    config.gateway.controlUi.dangerouslyDisableDeviceAuth = true;
    await this.saveConfig(config);
  }
}

module.exports = ConfigManager;
