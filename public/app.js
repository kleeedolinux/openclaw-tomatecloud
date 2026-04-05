const API = '';
let currentStep = 0;
let wizardData = {};
let selectedProvider = null;
let selectedChannels = {};
let selectedSearchProvider = null;

const steps = [
  { id: 'install', name: 'Instalação', icon: 'fa-box' },
  { id: 'auth', name: 'Autenticação', icon: 'fa-key' },
  { id: 'workspace', name: 'Workspace', icon: 'fa-briefcase' },
  { id: 'gateway', name: 'Gateway', icon: 'fa-globe' },
  { id: 'channels', name: 'Canais', icon: 'fa-comments' },
  { id: 'websearch', name: 'Busca Web', icon: 'fa-magnifying-glass' },
  { id: 'complete', name: 'Concluído', icon: 'fa-check-circle' }
];

$(document).ready(function() {
  init();
});

async function init() {
  try {
    const res = await $.ajax({
      url: `${API}/api/install/status`,
      timeout: 10000
    });
    if (res.installed) {
      const progress = await $.ajax({
        url: `${API}/api/onboarding/progress`,
        timeout: 10000
      });
      if (progress.success && progress.progress.completed) {
        showDashboard();
      } else {
        startWizard();
      }
    } else {
      showInstallStep(res);
    }
  } catch (error) {
    console.error('Init error:', error);
    showInstallStep({ installed: false });
  }
}

function showInstallStep(status) {
  let html = `
    <div class="text-center">
      <img src="/openclaw.svg" class="w-24 h-24 mx-auto mb-4" alt="OpenClaw">
      <h2 class="text-2xl font-bold text-gray-900 mb-2">Instalar OpenClaw</h2>
      <p class="text-gray-600 mb-6">${status.installed ? 'OpenClaw já está instalado!' : 'O OpenClaw precisa ser instalado para continuar.'}</p>
  `;

  if (!status.installed) {
    html += `
      <div class="bg-gray-50 rounded-lg p-4 mb-6 text-left">
        <h3 class="font-semibold text-gray-800 mb-2"><i class="fas fa-list-check mr-2"></i>O que será instalado:</h3>
        <ul class="text-sm text-gray-600 space-y-1">
          <li><i class="fas fa-check text-green-500 mr-2"></i>OpenClaw CLI</li>
          <li><i class="fas fa-check text-green-500 mr-2"></i>Gateway local</li>
          <li><i class="fas fa-check text-green-500 mr-2"></i>Interface web de controle</li>
        </ul>
      </div>
      <button onclick="installOpenClaw()" class="bg-tomate-500 hover:bg-tomate-600 text-white font-semibold px-6 py-3 rounded-lg transition">
        <i class="fas fa-download mr-2"></i>Instalar OpenClaw
      </button>
    `;
  } else {
    html += `
      <button onclick="startWizard()" class="bg-tomate-500 hover:bg-tomate-600 text-white font-semibold px-6 py-3 rounded-lg transition">
        <i class="fas fa-play mr-2"></i>Iniciar Configuração
      </button>
    `;
  }

  html += `</div>`;
  $('#content').html(html);
}

async function installOpenClaw() {
  $('#content').html(`
    <div class="text-center py-8">
      <div class="spinner mx-auto mb-4"></div>
      <p class="text-gray-600">Instalando OpenClaw...</p>
      <p class="text-sm text-gray-500 mt-2">Isso pode levar alguns minutos</p>
    </div>
  `);

  try {
    const data = await $.ajax({ url: `${API}/api/install`, method: 'POST' });
    if (data.success) {
      $('#content').html(`
        <div class="text-center">
          <i class="fas fa-circle-check text-6xl text-green-500 mb-4"></i>
          <h2 class="text-2xl font-bold text-gray-900 mb-2">Instalação Concluída!</h2>
          <p class="text-gray-600 mb-6">OpenClaw foi instalado com sucesso.</p>
          <button onclick="startWizard()" class="bg-tomate-500 hover:bg-tomate-600 text-white font-semibold px-6 py-3 rounded-lg transition">
            <i class="fas fa-play mr-2"></i>Iniciar Configuração
          </button>
        </div>
      `);
    } else {
      throw new Error(data.error);
    }
  } catch (error) {
    $('#content').html(`
      <div class="text-center">
        <i class="fas fa-circle-xmark text-6xl text-red-500 mb-4"></i>
        <h2 class="text-2xl font-bold text-red-600 mb-2">Erro na Instalação</h2>
        <p class="text-gray-600 mb-4">${error.message}</p>
        <button onclick="init()" class="bg-gray-500 hover:bg-gray-600 text-white font-semibold px-6 py-3 rounded-lg transition">
          <i class="fas fa-rotate-right mr-2"></i>Tentar Novamente
        </button>
      </div>
    `);
  }
}

async function startWizard() {
  try {
    const data = await $.ajax({ url: `${API}/api/wizard/start`, method: 'POST' });
  } catch (error) {
    console.warn('Wizard start failed, continuing anyway:', error);
  }
  $('#progress-bar').removeClass('hidden');
  updateProgress(0);
  showStep('auth');
}

function updateProgress(percent) {
  $('#progress-fill').css('width', `${percent}%`);
  $('#progress-percent').text(`${percent}%`);
  $('#step-label').text(`Passo ${currentStep + 1} de ${steps.length}`);

  let indicatorHtml = steps.map((step, i) => `
    <div class="flex flex-col items-center">
      <div class="step-dot w-8 h-8 rounded-full flex items-center justify-center text-xs ${
        i < currentStep ? 'done' :
        i === currentStep ? 'active' :
        'pending'
      }"><i class="fas ${i < currentStep ? 'fa-check' : step.icon}"></i></div>
      <span class="mt-1 ${i === currentStep ? 'font-medium text-tomate-600' : 'text-gray-500'}">${step.name}</span>
    </div>
  `).join('');

  $('#steps-indicator').html(indicatorHtml);
}

function showStep(stepId) {
  const stepIndex = steps.findIndex(s => s.id === stepId);
  currentStep = stepIndex;
  updateProgress(Math.round((stepIndex / steps.length) * 100));

  const stepContent = getStepContent(stepId);
  $('#content').html(stepContent).hide().fadeIn(300);
}

function getStepContent(stepId) {
  switch (stepId) {
    case 'auth': return getAuthStep();
    case 'workspace': return getWorkspaceStep();
    case 'gateway': return getGatewayStep();
    case 'channels': return getChannelsStep();
    case 'websearch': return getWebSearchStep();
    case 'skills': return getSkillsStep();
    case 'complete': return getCompleteStep();
    default: return '<p>Passo não encontrado</p>';
  }
}

function getAuthStep() {
  const providers = [
    { id: 'anthropic', name: 'Anthropic', desc: 'Claude Sonnet, Opus, Haiku', icon: 'fa-robot', envKey: 'ANTHROPIC_API_KEY' },
    { id: 'openai', name: 'OpenAI', desc: 'GPT-5.4, GPT-4o', icon: 'fa-brain', envKey: 'OPENAI_API_KEY' },
    { id: 'openrouter', name: 'OpenRouter', desc: 'Multi-model proxy', icon: 'fa-globe', envKey: 'OPENROUTER_API_KEY' },
    { id: 'xai', name: 'xAI (Grok)', desc: 'Grok 3', icon: 'fa-rocket', envKey: 'XAI_API_KEY' },
    { id: 'opencode', name: 'OpenCode', desc: 'Zen ou Go', icon: 'fa-bolt', envKey: 'OPENCODE_API_KEY' },
    { id: 'ollama', name: 'Ollama', desc: 'Modelos locais', icon: 'fa-server', envKey: null },
    { id: 'google', name: 'Google Gemini', desc: 'Gemini 2.5 Pro', icon: 'fa-gem', envKey: 'GOOGLE_API_KEY' },
    { id: 'groq', name: 'Groq', desc: 'Inferência rápida', icon: 'fa-bolt-lightning', envKey: 'GROQ_API_KEY' },
    { id: 'mistral', name: 'Mistral', desc: 'Mistral Large', icon: 'fa-smog', envKey: 'MISTRAL_API_KEY' },
    { id: 'deepseek', name: 'DeepSeek', desc: 'DeepSeek Chat', icon: 'fa-magnifying-glass', envKey: 'DEEPSEEK_API_KEY' },
    { id: 'minimax', name: 'MiniMax', desc: 'MiniMax-M2.7', icon: 'fa-crosshairs', envKey: 'MINIMAX_API_KEY' },
    { id: 'synthetic', name: 'Synthetic', desc: 'Anthropic-compatible', icon: 'fa-wrench', envKey: 'SYNTHETIC_API_KEY' },
    { id: 'vercel-ai-gateway', name: 'Vercel AI', desc: 'Multi-model proxy', icon: 'fa-triangle-exclamation', envKey: 'AI_GATEWAY_API_KEY' },
    { id: 'moonshot', name: 'Moonshot (Kimi)', desc: 'Kimi K2', icon: 'fa-moon', envKey: 'MOONSHOT_API_KEY' },
  ];

  let html = `
    <div>
      <div class="flex items-center gap-3 mb-6">
        <i class="fas fa-key text-3xl text-tomate-500"></i>
        <div>
          <h2 class="text-2xl font-bold text-gray-900">Provedor de IA</h2>
          <p class="text-gray-600">Escolha seu provedor de modelo de IA</p>
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
  `;

  providers.forEach(p => {
    html += `
      <div onclick="selectProvider('${p.id}', '${p.envKey || ''}')" id="provider-${p.id}" class="provider-card border-2 border-gray-200 rounded-lg p-4 cursor-pointer hover:border-tomate-400 transition">
        <div class="flex items-center gap-3">
          <i class="fas ${p.icon} text-2xl text-gray-600"></i>
          <div>
            <h3 class="font-semibold text-gray-900">${p.name}</h3>
            <p class="text-sm text-gray-500">${p.desc}</p>
          </div>
        </div>
      </div>
    `;
  });

  html += `
      </div>

      <div id="api-key-form" class="hidden">
        <div class="bg-gray-50 rounded-lg p-4 mb-4">
          <label class="block text-sm font-medium text-gray-700 mb-2" id="api-key-label">Chave API</label>
          <div class="relative">
            <input type="password" id="api-key-input" class="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-tomate-500 focus:border-transparent" placeholder="Cole sua chave API aqui">
            <button onclick="toggleApiKeyVisibility()" class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <i class="fas fa-eye" id="eye-icon"></i>
            </button>
          </div>
          <p class="text-xs text-gray-500 mt-1" id="api-key-help"></p>
        </div>

        <div class="bg-gray-50 rounded-lg p-4 mb-4">
          <label class="block text-sm font-medium text-gray-700 mb-2"><i class="fas fa-microchip mr-1"></i>Modelo (opcional)</label>
          <select id="model-select" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-tomate-500 focus:border-transparent">
            <option value="">Usar modelo padrão</option>
          </select>
        </div>

        <div class="flex gap-3">
          <button onclick="saveAuth()" class="flex-1 bg-tomate-500 hover:bg-tomate-600 text-white font-semibold px-6 py-3 rounded-lg transition">
            <i class="fas fa-save mr-2"></i>Salvar e Continuar
          </button>
          <button onclick="skipStep('auth')" class="px-6 py-3 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 transition">
            <i class="fas fa-forward mr-2"></i>Pular
          </button>
        </div>
      </div>
    </div>
  `;

  return html;
}

function toggleApiKeyVisibility() {
  const input = $('#api-key-input');
  const icon = $('#eye-icon');
  if (input.attr('type') === 'password') {
    input.attr('type', 'text');
    icon.removeClass('fa-eye').addClass('fa-eye-slash');
  } else {
    input.attr('type', 'password');
    icon.removeClass('fa-eye-slash').addClass('fa-eye');
  }
}

function selectProvider(providerId, envKey) {
  selectedProvider = providerId;
  $('.provider-card').removeClass('selected');
  $(`#provider-${providerId}`).addClass('selected');

  $('#api-key-form').removeClass('hidden').hide().fadeIn(200);

  if (envKey) {
    $('#api-key-label').text(`Chave API (${envKey})`);
    $('#api-key-help').text(`Você pode encontrar sua chave em ${getProviderUrl(providerId)}`);
    $('#api-key-input').val('');
  } else if (providerId === 'ollama') {
    $('#api-key-label').text('URL do Ollama');
    $('#api-key-input').val('http://localhost:11434');
    $('#api-key-help').text('URL base do seu servidor Ollama');
  }

  updateModelSelect(providerId);
}

function getProviderUrl(providerId) {
  const urls = {
    'anthropic': 'console.anthropic.com',
    'openai': 'platform.openai.com/api-keys',
    'openrouter': 'openrouter.ai/keys',
    'xai': 'console.x.ai',
    'opencode': 'opencode.ai/auth',
    'google': 'aistudio.google.com/app/apikey',
    'groq': 'console.groq.com/keys',
    'mistral': 'console.mistral.ai/api-keys',
    'deepseek': 'platform.deepseek.com',
    'minimax': 'platform.minimaxi.com',
    'synthetic': 'synthetic.io',
    'vercel-ai-gateway': 'vercel.com/ai-gateway',
    'moonshot': 'platform.moonshot.cn',
  };
  return urls[providerId] || 'site do provedor';
}

function updateModelSelect(providerId) {
  const models = {
    'anthropic': ['anthropic/claude-sonnet-4-6', 'anthropic/claude-opus-4-6', 'anthropic/claude-haiku-4-6'],
    'openai': ['openai/gpt-5.4', 'openai/gpt-4o', 'openai/o3'],
    'openrouter': ['openrouter/anthropic/claude-sonnet-4-6', 'openrouter/openai/gpt-5.4'],
    'xai': ['xai/grok-3', 'xai/grok-3-fast'],
    'opencode': ['opencode/zen', 'opencode/go'],
    'ollama': ['ollama/llama3.3', 'ollama/mistral', 'ollama/qwen2.5'],
    'google': ['google/gemini-2.5-pro', 'google/gemini-2.0-flash'],
    'groq': ['groq/llama-3.3-70b', 'groq/mixtral-8x7b'],
    'mistral': ['mistral/mistral-large-2', 'mistral/codestral'],
    'deepseek': ['deepseek/deepseek-chat', 'deepseek/deepseek-coder'],
    'minimax': ['minimax/MiniMax-M2.7'],
    'synthetic': ['synthetic/claude-sonnet-4-6'],
    'vercel-ai-gateway': ['vercel-ai-gateway/anthropic/claude-sonnet-4-6'],
    'moonshot': ['moonshot/kimi-k2'],
  };

  let options = '<option value="">Usar modelo padrão</option>';
  (models[providerId] || []).forEach(m => {
    options += `<option value="${m}">${m}</option>`;
  });
  $('#model-select').html(options);
}

async function saveAuth() {
  if (!selectedProvider) return;

  const apiKey = $('#api-key-input').val();
  const model = $('#model-select').val();

  const btn = $(event.target).closest('button');
  btn.prop('disabled', true).html('<div class="spinner inline-block mr-2"></div> Salvando...');

  try {
    const data = await $.ajax({
      url: `${API}/api/auth`,
      method: 'POST',
      contentType: 'application/json',
      data: JSON.stringify({ provider: selectedProvider, apiKey, model })
    });

    if (data.success) {
      wizardData.auth = { provider: selectedProvider, model };
      showStep('workspace');
    } else {
      throw new Error(data.error);
    }
  } catch (error) {
    alert(`Erro: ${error.message}`);
    btn.prop('disabled', false).html('<i class="fas fa-save mr-2"></i>Salvar e Continuar');
  }
}

function getWorkspaceStep() {
  return `
    <div>
      <div class="flex items-center gap-3 mb-6">
        <i class="fas fa-briefcase text-3xl text-tomate-500"></i>
        <div>
          <h2 class="text-2xl font-bold text-gray-900">Workspace</h2>
          <p class="text-gray-600">Onde o OpenClaw armazenará seus arquivos</p>
        </div>
      </div>

      <div class="bg-gray-50 rounded-lg p-4 mb-4">
        <label class="block text-sm font-medium text-gray-700 mb-2"><i class="fas fa-folder mr-1"></i>Caminho do Workspace</label>
        <input type="text" id="workspace-path" value="~/.openclaw/workspace" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-tomate-500 focus:border-transparent">
        <p class="text-xs text-gray-500 mt-1"><i class="fas fa-info-circle mr-1"></i>Diretório onde o OpenClaw armazenará sessões e arquivos de trabalho</p>
      </div>

      <div class="flex gap-3">
        <button onclick="saveWorkspace()" class="flex-1 bg-tomate-500 hover:bg-tomate-600 text-white font-semibold px-6 py-3 rounded-lg transition">
          <i class="fas fa-save mr-2"></i>Salvar e Continuar
        </button>
        <button onclick="skipStep('workspace')" class="px-6 py-3 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 transition">
          <i class="fas fa-forward mr-2"></i>Pular
        </button>
      </div>
    </div>
  `;
}

async function saveWorkspace() {
  const path = $('#workspace-path').val();

  const btn = $(event.target).closest('button');
  btn.prop('disabled', true).html('<div class="spinner inline-block mr-2"></div> Salvando...');

  try {
    const data = await $.ajax({
      url: `${API}/api/workspace`,
      method: 'POST',
      contentType: 'application/json',
      data: JSON.stringify({ path })
    });

    if (data.success) {
      wizardData.workspace = { path };
      showStep('gateway');
    } else {
      throw new Error(data.error);
    }
  } catch (error) {
    alert(`Erro: ${error.message}`);
    btn.prop('disabled', false).html('<i class="fas fa-save mr-2"></i>Salvar e Continuar');
  }
}

function getGatewayStep() {
  return `
    <div>
      <div class="flex items-center gap-3 mb-6">
        <i class="fas fa-globe text-3xl text-tomate-500"></i>
        <div>
          <h2 class="text-2xl font-bold text-gray-900">Gateway</h2>
          <p class="text-gray-600">Configure o servidor web do OpenClaw</p>
        </div>
      </div>

      <div class="space-y-4 mb-6">
        <div class="bg-gray-50 rounded-lg p-4">
          <label class="block text-sm font-medium text-gray-700 mb-2"><i class="fas fa-plug mr-1"></i>Porta</label>
          <input type="number" id="gateway-port" value="80" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-tomate-500 focus:border-transparent" readonly>
          <p class="text-xs text-gray-500 mt-1">Porta fixa: 80</p>
        </div>

        <div class="bg-gray-50 rounded-lg p-4">
          <label class="block text-sm font-medium text-gray-700 mb-2"><i class="fas fa-network-wired mr-1"></i>Bind</label>
          <input type="text" id="gateway-bind" value="0.0.0.0" class="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100" readonly>
          <p class="text-xs text-gray-500 mt-1">Bind fixo: 0.0.0.0</p>
        </div>

        <div class="bg-gray-50 rounded-lg p-4">
          <label class="block text-sm font-medium text-gray-700 mb-2"><i class="fas fa-shield-halved mr-1"></i>Modo de Autenticação</label>
          <select id="gateway-auth-mode" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-tomate-500 focus:border-transparent" onchange="toggleGatewayAuth()">
            <option value="token">Token (Recomendado)</option>
            <option value="password">Senha</option>
            <option value="none">Nenhum (Não recomendado)</option>
          </select>
        </div>

        <div id="gateway-token-field" class="bg-gray-50 rounded-lg p-4">
          <label class="block text-sm font-medium text-gray-700 mb-2"><i class="fas fa-ticket mr-1"></i>Token de Acesso</label>
          <div class="flex gap-2">
            <input type="password" id="gateway-token" class="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-tomate-500 focus:border-transparent" placeholder="Gerado automaticamente">
            <button onclick="generateToken()" class="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg text-sm transition">
              <i class="fas fa-dice mr-1"></i>Gerar
            </button>
          </div>
          <p class="text-xs text-gray-500 mt-1"><i class="fas fa-info-circle mr-1"></i>Este token será usado para acessar o painel de controle</p>
        </div>

        <div id="gateway-password-field" class="bg-gray-50 rounded-lg p-4 hidden">
          <label class="block text-sm font-medium text-gray-700 mb-2"><i class="fas fa-lock mr-1"></i>Senha de Acesso</label>
          <input type="password" id="gateway-password" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-tomate-500 focus:border-transparent" placeholder="Digite uma senha segura">
        </div>

        <div class="bg-gray-50 rounded-lg p-4">
          <label class="block text-sm font-medium text-gray-700 mb-2"><i class="fas fa-link mr-1"></i>Allowed CORS Origins</label>
          <textarea id="gateway-allowed-origins" rows="3" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-tomate-500 focus:border-transparent" placeholder="https://painel.exemplo.com, https://admin.exemplo.com"></textarea>
          <p class="text-xs text-gray-500 mt-1"><i class="fas fa-info-circle mr-1"></i>Informe domínios com protocolo (http/https), separados por vírgula. Use <code>*</code> se realmente quiser liberar tudo.</p>
        </div>
      </div>

      <div class="flex gap-3">
        <button onclick="saveGateway()" class="flex-1 bg-tomate-500 hover:bg-tomate-600 text-white font-semibold px-6 py-3 rounded-lg transition">
          <i class="fas fa-save mr-2"></i>Salvar e Continuar
        </button>
        <button onclick="skipStep('gateway')" class="px-6 py-3 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 transition">
          <i class="fas fa-forward mr-2"></i>Pular
        </button>
      </div>
    </div>
  `;
}

function toggleGatewayAuth() {
  const mode = $('#gateway-auth-mode').val();
  $('#gateway-token-field').toggleClass('hidden', mode !== 'token');
  $('#gateway-password-field').toggleClass('hidden', mode !== 'password');
}

function generateToken() {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  const token = Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
  $('#gateway-token').val(token);
}

async function saveGateway() {
  const rawAllowedOrigins = $('#gateway-allowed-origins').val();
  const allowedOrigins = parseAllowedOrigins(rawAllowedOrigins);
  if (!allowedOrigins.valid) {
    alert(allowedOrigins.error);
    return;
  }

  const data = {
    port: $('#gateway-port').val(),
    bind: $('#gateway-bind').val(),
    authMode: $('#gateway-auth-mode').val(),
    token: $('#gateway-token').val(),
    password: $('#gateway-password').val(),
    allowedOrigins: allowedOrigins.origins,
  };

  const btn = $(event.target).closest('button');
  btn.prop('disabled', true).html('<div class="spinner inline-block mr-2"></div> Salvando...');

  try {
    const result = await $.ajax({
      url: `${API}/api/gateway`,
      method: 'POST',
      contentType: 'application/json',
      data: JSON.stringify(data)
    });

    if (result.success) {
      wizardData.gateway = data;
      showStep('channels');
    } else {
      throw new Error(result.error);
    }
  } catch (error) {
    alert(`Erro: ${error.message}`);
    btn.prop('disabled', false).html('<i class="fas fa-save mr-2"></i>Salvar e Continuar');
  }
}

function parseAllowedOrigins(rawValue) {
  const raw = (rawValue || '').trim();
  if (!raw) {
    return { valid: true, origins: [] };
  }

  const values = raw
    .split(',')
    .map(v => v.trim())
    .filter(Boolean);

  const normalized = [];
  const seen = new Set();

  for (const origin of values) {
    if (origin === '*') {
      if (!seen.has('*')) {
        seen.add('*');
        normalized.push('*');
      }
      continue;
    }

    try {
      const parsed = new URL(origin);
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        return { valid: false, error: `Origem inválida: ${origin}. Use http:// ou https://` };
      }
      if (!seen.has(parsed.origin)) {
        seen.add(parsed.origin);
        normalized.push(parsed.origin);
      }
    } catch {
      return { valid: false, error: `Origem inválida: ${origin}` };
    }
  }

  return { valid: true, origins: normalized };
}

function getChannelsStep() {
  const channels = [
    { id: 'whatsapp', name: 'WhatsApp', icon: 'fa-brands fa-whatsapp', desc: 'Conecte via QR Code' },
    { id: 'telegram', name: 'Telegram', icon: 'fa-brands fa-telegram', desc: 'Bot token' },
    { id: 'discord', name: 'Discord', icon: 'fa-brands fa-discord', desc: 'Bot token' },
    { id: 'signal', name: 'Signal', icon: 'fa-comment-sms', desc: 'signal-cli' },
    { id: 'slack', name: 'Slack', icon: 'fa-brands fa-slack', desc: 'Bot token' },
    { id: 'googlechat', name: 'Google Chat', icon: 'fa-comments', desc: 'Service account' },
    { id: 'msteams', name: 'Microsoft Teams', icon: 'fa-brands fa-microsoft', desc: 'Bot token' },
    { id: 'imessage', name: 'iMessage', icon: 'fa-brands fa-apple', desc: 'macOS apenas' },
    { id: 'bluebubbles', name: 'BlueBubbles', icon: 'fa-bubble', desc: 'Recomendado para iMessage' },
    { id: 'mattermost', name: 'Mattermost', icon: 'fa-wrench', desc: 'Plugin' },
  ];

  let html = `
    <div>
      <div class="flex items-center gap-3 mb-6">
        <i class="fas fa-comments text-3xl text-tomate-500"></i>
        <div>
          <h2 class="text-2xl font-bold text-gray-900">Canais de Comunicação</h2>
          <p class="text-gray-600">Configure canais de mensagens (opcional)</p>
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
  `;

  channels.forEach(ch => {
    html += `
      <div onclick="toggleChannel('${ch.id}')" id="channel-${ch.id}" class="channel-card border-2 border-gray-200 rounded-lg p-4 cursor-pointer hover:border-tomate-400 transition">
        <div class="flex items-center gap-3">
          <i class="${ch.icon} text-2xl text-gray-600"></i>
          <div>
            <h3 class="font-semibold text-gray-900">${ch.name}</h3>
            <p class="text-sm text-gray-500">${ch.desc}</p>
          </div>
          <span class="ml-auto text-green-500 channel-check hidden"><i class="fas fa-circle-check text-xl"></i></span>
        </div>
      </div>
    `;
  });

  html += `
      </div>

      <div id="channel-config" class="hidden bg-gray-50 rounded-lg p-4 mb-4"></div>

      <div class="flex gap-3">
        <button onclick="saveChannels()" class="flex-1 bg-tomate-500 hover:bg-tomate-600 text-white font-semibold px-6 py-3 rounded-lg transition">
          <i class="fas fa-save mr-2"></i>Salvar e Continuar
        </button>
        <button onclick="skipStep('channels')" class="px-6 py-3 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 transition">
          <i class="fas fa-forward mr-2"></i>Pular
        </button>
      </div>
    </div>
  `;

  return html;
}

function toggleChannel(channelId) {
  const card = $(`#channel-${channelId}`);
  const check = card.find('.channel-check');

  if (selectedChannels[channelId]) {
    delete selectedChannels[channelId];
    card.removeClass('selected');
    check.addClass('hidden');
    $('#channel-config').addClass('hidden');
  } else {
    selectedChannels[channelId] = {};
    card.addClass('selected');
    check.removeClass('hidden');
    showChannelConfig(channelId);
  }
}

function showChannelConfig(channelId) {
  const configDiv = $('#channel-config');
  configDiv.removeClass('hidden');

  const configs = {
    'whatsapp': `
      <h3 class="font-semibold mb-2"><i class="fa-brands fa-whatsapp mr-2"></i>WhatsApp</h3>
      <p class="text-sm text-gray-600 mb-3">Escaneie o QR Code após a configuração</p>
      <label class="block text-sm font-medium text-gray-700 mb-2">Allow From (números permitidos)</label>
      <input type="text" id="channel-whatsapp-allow" class="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="+5511999999999, +5511888888888">
    `,
    'telegram': `
      <h3 class="font-semibold mb-2"><i class="fa-brands fa-telegram mr-2"></i>Telegram</h3>
      <label class="block text-sm font-medium text-gray-700 mb-2">Bot Token</label>
      <input type="password" id="channel-telegram-token" class="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11">
      <p class="text-xs text-gray-500 mt-1"><i class="fas fa-info-circle mr-1"></i>Obtenha em @BotFather no Telegram</p>
    `,
    'discord': `
      <h3 class="font-semibold mb-2"><i class="fa-brands fa-discord mr-2"></i>Discord</h3>
      <label class="block text-sm font-medium text-gray-700 mb-2">Bot Token</label>
      <input type="password" id="channel-discord-token" class="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="Bot token do Discord Developer Portal">
      <p class="text-xs text-gray-500 mt-1"><i class="fas fa-info-circle mr-1"></i>Crie em discord.com/developers</p>
    `,
    'signal': `
      <h3 class="font-semibold mb-2"><i class="fas fa-comment-sms mr-2"></i>Signal</h3>
      <p class="text-sm text-gray-600">Requer signal-cli instalado. Será configurado automaticamente.</p>
    `,
    'slack': `
      <h3 class="font-semibold mb-2"><i class="fa-brands fa-slack mr-2"></i>Slack</h3>
      <label class="block text-sm font-medium text-gray-700 mb-2">Bot Token</label>
      <input type="password" id="channel-slack-token" class="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="xoxb-...">
    `,
    'googlechat': `
      <h3 class="font-semibold mb-2"><i class="fas fa-comments mr-2"></i>Google Chat</h3>
      <p class="text-sm text-gray-600">Requer service account JSON do Google Cloud</p>
    `,
    'msteams': `
      <h3 class="font-semibold mb-2"><i class="fa-brands fa-microsoft mr-2"></i>Microsoft Teams</h3>
      <label class="block text-sm font-medium text-gray-700 mb-2">Bot Token</label>
      <input type="password" id="channel-msteams-token" class="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="Token do Azure Bot Service">
    `,
    'imessage': `
      <h3 class="font-semibold mb-2"><i class="fa-brands fa-apple mr-2"></i>iMessage</h3>
      <p class="text-sm text-gray-600">Apenas macOS. Requer acesso ao banco de dados do iMessage.</p>
    `,
    'bluebubbles': `
      <h3 class="font-semibold mb-2"><i class="fas fa-bubble mr-2"></i>BlueBubbles</h3>
      <label class="block text-sm font-medium text-gray-700 mb-2">Server URL</label>
      <input type="text" id="channel-bluebubbles-url" class="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="http://localhost:1234">
      <label class="block text-sm font-medium text-gray-700 mb-2 mt-3">Password</label>
      <input type="password" id="channel-bluebubbles-password" class="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="Senha do BlueBubbles">
    `,
    'mattermost': `
      <h3 class="font-semibold mb-2"><i class="fas fa-wrench mr-2"></i>Mattermost</h3>
      <label class="block text-sm font-medium text-gray-700 mb-2">Bot Token</label>
      <input type="password" id="channel-mattermost-token" class="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="Token do Mattermost">
      <label class="block text-sm font-medium text-gray-700 mb-2 mt-3">Base URL</label>
      <input type="text" id="channel-mattermost-url" class="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="https://mattermost.example.com">
    `,
  };

  configDiv.html(configs[channelId] || '');
}

async function saveChannels() {
  const btn = $(event.target).closest('button');
  btn.prop('disabled', true).html('<div class="spinner inline-block mr-2"></div> Salvando...');

  try {
    for (const [channel, config] of Object.entries(selectedChannels)) {
      await $.ajax({
        url: `${API}/api/channels`,
        method: 'POST',
        contentType: 'application/json',
        data: JSON.stringify({ channel, config })
      });
    }

    wizardData.channels = selectedChannels;
    showStep('websearch');
  } catch (error) {
    alert(`Erro: ${error.message}`);
    btn.prop('disabled', false).html('<i class="fas fa-save mr-2"></i>Salvar e Continuar');
  }
}

function getWebSearchStep() {
  const providers = [
    { id: 'skip', name: 'Pular', icon: 'fa-forward', desc: 'Configurar depois' },
    { id: 'duckduckgo', name: 'DuckDuckGo', icon: 'fa-duck', desc: 'Gratuito, sem API key' },
    { id: 'brave', name: 'Brave Search', icon: 'fa-shield-halved', desc: 'Requer API key' },
    { id: 'exa', name: 'Exa', icon: 'fa-flask', desc: 'Busca semântica' },
    { id: 'tavily', name: 'Tavily', icon: 'fa-crosshairs', desc: 'Otimizado para IA' },
    { id: 'firecrawl', name: 'Firecrawl', icon: 'fa-fire', desc: 'Web scraping' },
    { id: 'perplexity', name: 'Perplexity', icon: 'fa-lightbulb', desc: 'Requer API key' },
    { id: 'searxng', name: 'SearXNG', icon: 'fa-magnifying-glass', desc: 'Meta-search open source' },
    { id: 'gemini', name: 'Google Gemini', icon: 'fa-gem', desc: 'Busca com Gemini' },
    { id: 'grok', name: 'Grok Search', icon: 'fa-rocket', desc: 'Busca com xAI' },
    { id: 'kimi', name: 'Kimi Search', icon: 'fa-moon', desc: 'Busca com Moonshot' },
    { id: 'minimax-search', name: 'MiniMax Search', icon: 'fa-bullseye', desc: 'Busca com MiniMax' },
    { id: 'ollama-web-search', name: 'Ollama Web Search', icon: 'fa-server', desc: 'Local' },
  ];

  let html = `
    <div>
      <div class="flex items-center gap-3 mb-6">
        <i class="fas fa-magnifying-glass text-3xl text-tomate-500"></i>
        <div>
          <h2 class="text-2xl font-bold text-gray-900">Busca na Web</h2>
          <p class="text-gray-600">Permita que o OpenClaw pesquise na internet</p>
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
  `;

  providers.forEach(p => {
    html += `
      <div onclick="selectSearchProvider('${p.id}')" id="search-${p.id}" class="search-card border-2 border-gray-200 rounded-lg p-4 cursor-pointer hover:border-tomate-400 transition">
        <div class="flex items-center gap-3">
          <i class="fas ${p.icon} text-2xl text-gray-600"></i>
          <div>
            <h3 class="font-semibold text-gray-900">${p.name}</h3>
            <p class="text-sm text-gray-500">${p.desc}</p>
          </div>
        </div>
      </div>
    `;
  });

  html += `
      </div>

      <div id="search-api-form" class="hidden bg-gray-50 rounded-lg p-4 mb-4">
        <label class="block text-sm font-medium text-gray-700 mb-2"><i class="fas fa-key mr-1"></i>Chave API</label>
        <input type="password" id="search-api-key" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-tomate-500 focus:border-transparent" placeholder="Cole sua chave API aqui">
      </div>

      <div class="flex gap-3">
        <button onclick="saveWebSearch()" class="flex-1 bg-tomate-500 hover:bg-tomate-600 text-white font-semibold px-6 py-3 rounded-lg transition">
          <i class="fas fa-save mr-2"></i>Salvar e Continuar
        </button>
        <button onclick="skipStep('websearch')" class="px-6 py-3 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 transition">
          <i class="fas fa-forward mr-2"></i>Pular
        </button>
      </div>
    </div>
  `;

  return html;
}

function selectSearchProvider(providerId) {
  selectedSearchProvider = providerId;
  $('.search-card').removeClass('selected');
  $(`#search-${providerId}`).addClass('selected');

  const needsKey = !['skip', 'duckduckgo', 'searxng', 'ollama-web-search'].includes(providerId);
  $('#search-api-form').toggleClass('hidden', !needsKey);
}

async function saveWebSearch() {
  const apiKey = $('#search-api-key').val() || '';

  const btn = $(event.target).closest('button');
  btn.prop('disabled', true).html('<div class="spinner inline-block mr-2"></div> Salvando...');

  try {
    const data = await $.ajax({
      url: `${API}/api/web-search`,
      method: 'POST',
      contentType: 'application/json',
      data: JSON.stringify({ provider: selectedSearchProvider, apiKey })
    });

    if (data.success) {
      wizardData.webSearch = { provider: selectedSearchProvider };
      showStep('complete');
    } else {
      throw new Error(data.error);
    }
  } catch (error) {
    alert(`Erro: ${error.message}`);
    btn.prop('disabled', false).html('<i class="fas fa-save mr-2"></i>Salvar e Continuar');
  }
}

function getSkillsStep() {
  return `
    <div>
      <div class="flex items-center gap-3 mb-6">
        <i class="fas fa-bullseye text-3xl text-tomate-500"></i>
        <div>
          <h2 class="text-2xl font-bold text-gray-900">Skills</h2>
          <p class="text-gray-600">Instale habilidades adicionais para o OpenClaw</p>
        </div>
      </div>

      <div class="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
        <div class="flex items-start gap-3">
          <i class="fas fa-sparkles text-xl text-green-600"></i>
          <div>
            <h3 class="font-semibold text-green-900 mb-1">Skills Recomendadas</h3>
            <p class="text-sm text-green-700">Skills expandem as capacidades do OpenClaw com ferramentas especializadas.</p>
          </div>
        </div>
      </div>

      <div class="space-y-4 mb-6">
        <div class="bg-gray-50 rounded-lg p-4">
          <label class="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" id="skills-install" checked class="w-5 h-5 text-tomate-500 rounded focus:ring-tomate-500">
            <div>
              <h3 class="font-semibold text-gray-900">Instalar Skills Recomendadas</h3>
              <p class="text-sm text-gray-500">Instala habilidades úteis automaticamente usando npm</p>
            </div>
          </label>
        </div>
      </div>

      <div class="flex gap-3">
        <button onclick="saveSkills()" class="flex-1 bg-tomate-500 hover:bg-tomate-600 text-white font-semibold px-6 py-3 rounded-lg transition">
          <i class="fas fa-save mr-2"></i>Salvar e Continuar
        </button>
        <button onclick="skipStep('skills')" class="px-6 py-3 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 transition">
          <i class="fas fa-forward mr-2"></i>Pular
        </button>
      </div>
    </div>
  `;
}

async function saveSkills() {
  const install = $('#skills-install').is(':checked');

  const btn = $(event.target).closest('button');
  btn.prop('disabled', true).html('<div class="spinner inline-block mr-2"></div> Salvando...');

  try {
    if (install) {
      const data = await $.ajax({
        url: `${API}/api/skills/install`,
        method: 'POST',
        contentType: 'application/json',
        data: JSON.stringify({ nodeManager: 'npm' })
      });
      if (!data.success) throw new Error(data.error);
    }

    wizardData.skills = { install };
    showStep('complete');
  } catch (error) {
    alert(`Erro: ${error.message}`);
    btn.prop('disabled', false).html('<i class="fas fa-save mr-2"></i>Salvar e Continuar');
  }
}

async function getCompleteStep() {
  await $.ajax({ url: `${API}/api/onboarding/complete`, method: 'POST' }).catch(() => {});

  const gatewayPort = wizardData.gateway?.port || 80;
  const gatewayUrl = `http://localhost:${gatewayPort}`;

  let summaryHtml = '';
  if (wizardData.auth) summaryHtml += `<p><i class="fas fa-check text-green-500 mr-2"></i>Provedor IA: ${wizardData.auth.provider}</p>`;
  if (wizardData.workspace) summaryHtml += `<p><i class="fas fa-check text-green-500 mr-2"></i>Workspace: ${wizardData.workspace.path}</p>`;
  if (wizardData.gateway) summaryHtml += `<p><i class="fas fa-check text-green-500 mr-2"></i>Gateway: porta ${wizardData.gateway.port}</p>`;
  if (wizardData.channels) summaryHtml += `<p><i class="fas fa-check text-green-500 mr-2"></i>Canais: ${Object.keys(wizardData.channels).join(', ')}</p>`;
  if (wizardData.webSearch) summaryHtml += `<p><i class="fas fa-check text-green-500 mr-2"></i>Busca Web: ${wizardData.webSearch.provider}</p>`;
  if (wizardData.daemon?.install) summaryHtml += `<p><i class="fas fa-check text-green-500 mr-2"></i>Daemon instalado</p>`;
  if (wizardData.skills?.install) summaryHtml += `<p><i class="fas fa-check text-green-500 mr-2"></i>Skills instaladas</p>`;

  return `
    <div class="text-center">
      <img src="/openclaw.svg" class="w-24 h-24 mx-auto mb-4" alt="OpenClaw">
      <h2 class="text-3xl font-bold text-gray-900 mb-2">Configuração Concluída!</h2>
      <p class="text-gray-600 mb-8">O OpenClaw está pronto para uso.</p>

      <div class="bg-green-50 border border-green-200 rounded-lg p-4 mb-6 text-left">
        <h3 class="font-semibold text-green-900 mb-2"><i class="fas fa-clipboard-check mr-2"></i>Resumo da Configuração</h3>
        <div class="text-sm text-green-800 space-y-1">
          ${summaryHtml}
        </div>
      </div>

      <div class="bg-gray-50 rounded-lg p-4 mb-6">
        <h3 class="font-semibold text-gray-900 mb-2"><i class="fas fa-globe mr-2"></i>Acesso ao Painel</h3>
        <p class="text-sm text-gray-600 mb-2">Abra o painel de controle no navegador:</p>
        <a href="${gatewayUrl}" target="_blank" class="text-tomate-500 hover:text-tomate-600 font-mono text-sm">${gatewayUrl}</a>
      </div>

      <div class="flex gap-3 justify-center">
        <button onclick="startGateway()" class="bg-tomate-500 hover:bg-tomate-600 text-white font-semibold px-6 py-3 rounded-lg transition">
          <i class="fas fa-play mr-2"></i>Iniciar Gateway
        </button>
        <button onclick="window.open('${gatewayUrl}', '_blank')" class="bg-gray-500 hover:bg-gray-600 text-white font-semibold px-6 py-3 rounded-lg transition">
          <i class="fas fa-external-link mr-2"></i>Abrir Painel
        </button>
        <button onclick="restartSystem()" class="bg-orange-500 hover:bg-orange-600 text-white font-semibold px-6 py-3 rounded-lg transition">
          <i class="fas fa-rotate-right mr-2"></i>Reiniciar Sistema
        </button>
      </div>
    </div>
  `;
}

async function startGateway() {
  const btn = $(event.target).closest('button');
  btn.prop('disabled', true).html('<div class="spinner inline-block mr-2"></div> Reiniciando...');

  try {
    await $.ajax({ url: `${API}/api/onboarding/complete`, method: 'POST' });

    const data = await $.ajax({ url: `${API}/api/system/restart`, method: 'POST' });
    if (!data.success) {
      throw new Error(data.error || 'Falha ao reiniciar');
    }

    btn.html('<i class="fas fa-check mr-2"></i>Reiniciando para iniciar OpenClaw...')
      .removeClass('bg-tomate-500 hover:bg-tomate-600')
      .addClass('bg-green-500');

    setTimeout(() => {
      window.location.reload();
    }, 2000);
  } catch (error) {
    alert(`Erro: ${error.message}`);
    btn.prop('disabled', false).html('<i class="fas fa-play mr-2"></i>Iniciar Gateway');
  }
}

async function restartSystem() {
  const btn = $(event.target).closest('button');
  btn.prop('disabled', true).html('<div class="spinner inline-block mr-2"></div> Reiniciando...');

  try {
    const data = await $.ajax({ url: `${API}/api/system/restart`, method: 'POST' });
    if (!data.success) {
      throw new Error(data.error || 'Falha ao reiniciar');
    }

    setTimeout(() => {
      window.location.reload();
    }, 2000);
  } catch (error) {
    alert(`Erro: ${error.message}`);
    btn.prop('disabled', false).html('<i class="fas fa-rotate-right mr-2"></i>Reiniciar Sistema');
  }
}

async function skipStep(stepId) {
  try {
    await $.ajax({
      url: `${API}/api/wizard/next`,
      method: 'POST',
      contentType: 'application/json',
      data: JSON.stringify({ skip: true })
    });
  } catch (e) {}

  const stepOrder = ['auth', 'workspace', 'gateway', 'channels', 'websearch', 'complete'];
  const currentIndex = stepOrder.indexOf(stepId);
  if (currentIndex < stepOrder.length - 1) {
    showStep(stepOrder[currentIndex + 1]);
  }
}

function showDashboard() {
  $('#content').html(`
    <div class="text-center">
      <svg class="w-24 h-24 mx-auto mb-4" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="lobster-gradient-dashboard" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#ff4d4d"/>
            <stop offset="100%" stop-color="#991b1b"/>
          </linearGradient>
        </defs>
        <path d="M60 10 C30 10 15 35 15 55 C15 75 30 95 45 100 L45 110 L55 110 L55 100 C55 100 60 102 65 100 L65 110 L75 110 L75 100 C90 95 105 75 105 55 C105 35 90 10 60 10Z" fill="url(#lobster-gradient-dashboard)"/>
        <path d="M20 45 C5 40 0 50 5 60 C10 70 20 65 25 55 C28 48 25 45 20 45Z" fill="url(#lobster-gradient-dashboard)"/>
        <path d="M100 45 C115 40 120 50 115 60 C110 70 100 65 95 55 C92 48 95 45 100 45Z" fill="url(#lobster-gradient-dashboard)"/>
        <path d="M45 15 Q35 5 30 8" stroke="#ff4d4d" stroke-width="3" stroke-linecap="round"/>
        <path d="M75 15 Q85 5 90 8" stroke="#ff4d4d" stroke-width="3" stroke-linecap="round"/>
        <circle cx="45" cy="35" r="6" fill="#050810"/>
        <circle cx="75" cy="35" r="6" fill="#050810"/>
        <circle cx="46" cy="34" r="2.5" fill="#00e5cc"/>
        <circle cx="76" cy="34" r="2.5" fill="#00e5cc"/>
      </svg>
      <h2 class="text-2xl font-bold text-gray-900 mb-2">OpenClaw Configurado</h2>
      <p class="text-gray-600 mb-6">Seu OpenClaw está pronto e configurado.</p>

      <div class="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
        <p class="text-green-800"><i class="fas fa-circle-check mr-2"></i>Configuração completa</p>
      </div>

      <div class="flex gap-3 justify-center">
        <button onclick="window.open('http://localhost:80', '_blank')" class="bg-tomate-500 hover:bg-tomate-600 text-white font-semibold px-6 py-3 rounded-lg transition">
          <i class="fas fa-gauge-high mr-2"></i>Abrir Painel de Controle
        </button>
        <button onclick="resetConfig()" class="bg-gray-500 hover:bg-gray-600 text-white font-semibold px-6 py-3 rounded-lg transition">
          <i class="fas fa-rotate-left mr-2"></i>Resetar Configuração
        </button>
      </div>
    </div>
  `);
}

async function resetConfig() {
  if (!confirm('Tem certeza que deseja resetar toda a configuração?')) return;

  try {
    const data = await $.ajax({
      url: `${API}/api/reset`,
      method: 'POST',
      contentType: 'application/json',
      data: JSON.stringify({ scope: 'full' })
    });

    if (data.success) {
      location.reload();
    } else {
      alert(`Erro: ${data.error}`);
    }
  } catch (error) {
    alert(`Erro: ${error.message}`);
  }
}
