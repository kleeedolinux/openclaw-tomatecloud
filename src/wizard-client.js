const { exec } = require('child_process');
const { promisify } = require('util');
const path = require('path');

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
  
  const cmd = `"${localBin}" ${args}`;
  return execAsync(cmd);
}

class WizardClient {
  constructor(configManager) {
    this.configManager = configManager;
    this.wizardSession = null;
    this.currentStep = null;
  }

  async startWizard() {
    const config = await this.configManager.getConfig();

    const hasExistingConfig = Object.keys(config).length > 0;

    this.wizardSession = {
      id: Date.now().toString(),
      startedAt: new Date().toISOString(),
      step: 0,
      steps: [
        'install',
        'auth',
        'workspace',
        'gateway',
        'channels',
        'webSearch',
        'skills',
        'complete',
      ],
      data: {},
    };

    this.currentStep = 'install';

    return {
      success: true,
      sessionId: this.wizardSession.id,
      currentStep: this.currentStep,
      totalSteps: this.wizardSession.steps.length,
      stepIndex: 0,
      hasExistingConfig,
      existingConfig: hasExistingConfig ? config : null,
    };
  }

  async nextStep(data) {
    if (!this.wizardSession) {
      throw new Error('Nenhuma sessão de wizard ativa. Chame /api/wizard/start primeiro.');
    }

    const currentStepIndex = this.wizardSession.steps.indexOf(this.currentStep);

    this.wizardSession.data[this.currentStep] = data;

    await this.processStep(this.currentStep, data);

    const nextStepIndex = currentStepIndex + 1;

    if (nextStepIndex >= this.wizardSession.steps.length) {
      await this.configManager.completeOnboarding();
      this.wizardSession = null;
      this.currentStep = null;

      return {
        success: true,
        completed: true,
        message: 'Configuração concluída com sucesso!',
      };
    }

    this.currentStep = this.wizardSession.steps[nextStepIndex];
    this.wizardSession.step = nextStepIndex;

    return {
      success: true,
      completed: false,
      currentStep: this.currentStep,
      stepIndex: nextStepIndex,
      totalSteps: this.wizardSession.steps.length,
      progress: this.getProgress(),
    };
  }

  async cancelWizard() {
    this.wizardSession = null;
    this.currentStep = null;
    return { success: true };
  }

  async getWizardStatus() {
    if (!this.wizardSession) {
      return { active: false };
    }

    return {
      active: true,
      sessionId: this.wizardSession.id,
      currentStep: this.currentStep,
      stepIndex: this.wizardSession.step,
      totalSteps: this.wizardSession.steps.length,
      progress: this.getProgress(),
      data: this.wizardSession.data,
    };
  }

  getProgress() {
    if (!this.wizardSession) return 0;
    return Math.round((this.wizardSession.step / this.wizardSession.steps.length) * 100);
  }

  async processStep(step, data) {
    switch (step) {
      case 'install':
        if (data.install) {
          await this.configManager.checkOpenClawInstalled();
        }
        break;

      case 'auth':
        if (data.provider && data.apiKey) {
          await this.configManager.setAuth(data.provider, data.apiKey, data.model);
        } else if (data.provider === 'ollama') {
          await this.configManager.setAuth('ollama', data.baseUrl || 'http://localhost:11434', data.model);
        } else if (data.provider === 'anthropic-cli') {
          await runOpenClaw('models auth login --provider anthropic --method cli --set-default');
        } else if (data.provider === 'openai-codex-oauth') {
          return { oauthUrl: 'https://auth.openai.com/authorize', requiresBrowser: true };
        }
        break;

      case 'workspace':
        await this.configManager.configureWorkspace(data.path);
        break;

      case 'gateway':
        await this.configManager.configureGateway(data);
        break;

      case 'channels':
        if (data.channels) {
          for (const [channel, config] of Object.entries(data.channels)) {
            await this.configManager.configureChannel(channel, config);
          }
        }
        break;

      case 'webSearch':
        if (data.provider && data.provider !== 'skip') {
          await this.configManager.configureWebSearch(data.provider, data.apiKey);
        }
        break;

      case 'skills':
        if (data.install) {
          await this.configManager.installSkills(data.nodeManager || 'npm');
        }
        break;

      case 'complete':
        await this.configManager.completeOnboarding();
        break;
    }
  }
}

module.exports = WizardClient;
