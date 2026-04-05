const express = require("express");
const path = require("path");
const fs = require("fs").promises;
const { exec, spawn } = require("child_process");
const { promisify } = require("util");
const ConfigManager = require("./config-manager");
const WizardClient = require("./wizard-client");

const execAsync = promisify(exec);

const app = express();
const PORT = process.env.PORT || 80;

const OPENCLAW_LOCAL_BIN = path.join(
  __dirname,
  "..",
  "node_modules",
  ".bin",
  "openclaw",
);

async function runOpenClaw(args) {
  const fsSync = require("fs");
  const localBin = OPENCLAW_LOCAL_BIN;
  const useLocal = fsSync.existsSync(localBin);

  if (!useLocal) {
    const pkgPath = path.join(
      __dirname,
      "..",
      "node_modules",
      "openclaw",
      "package.json",
    );
    if (!fsSync.existsSync(pkgPath)) {
      throw new Error(
        "OpenClaw não está instalado. Execute a instalação primeiro.",
      );
    }
    throw new Error(
      "OpenClaw binário não encontrado. Execute a instalação primeiro.",
    );
  }

  console.log(`[OpenClaw] Executando: ${localBin} ${args}`);

  const cmd = `"${localBin}" ${args}`;
  return execAsync(cmd);
}

app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "public")));

const cssPath = path.join(__dirname, "..", "public", "styles.min.css");
const fsSync = require("fs");
if (fsSync.existsSync(cssPath)) {
  app.get("/styles.min.css", (req, res) => {
    res.sendFile(cssPath);
  });
}

const configManager = new ConfigManager();
const wizardClient = new WizardClient(configManager);

// Health check
app.get("/api/health", async (req, res) => {
  try {
    const status = await configManager.getOpenClawStatus();
    res.json({ status: "ok", openclaw: status });
  } catch (error) {
    console.error("Erro em /api/install:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Check if OpenClaw is installed
app.get("/api/install/status", async (req, res) => {
  try {
    const { stdout } = await runOpenClaw("--version");
    res.json({ installed: true, version: stdout.trim() });
  } catch {
    const fsSync = require("fs");
    const pkgPath = path.join(
      __dirname,
      "..",
      "node_modules",
      "openclaw",
      "package.json",
    );
    if (fsSync.existsSync(pkgPath)) {
      res.json({ installed: true, version: "installed (package only)" });
    } else {
      res.json({ installed: false });
    }
  }
});

// Install OpenClaw
app.post("/api/install", async (req, res) => {
  try {
    const { stdout, stderr } = await runOpenClaw("install");
    res.json({ success: true, output: stdout });
  } catch (error) {
    console.error("Erro ao instalar OpenClaw:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get current configuration
app.get("/api/config", async (req, res) => {
  try {
    const config = await configManager.getConfig();
    res.json({ success: true, config });
  } catch (error) {
    console.error("Erro em /api/config (GET):", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update configuration
app.post("/api/config", async (req, res) => {
  try {
    const { section, data } = req.body;
    await configManager.updateConfig(section, data);
    res.json({ success: true });
  } catch (error) {
    console.error("Erro em /api/config (POST):", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Wizard endpoints
app.post("/api/wizard/start", async (req, res) => {
  try {
    const result = await wizardClient.startWizard();
    res.json(result);
  } catch (error) {
    console.error("Erro em /api/wizard/start:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/wizard/next", async (req, res) => {
  try {
    const result = await wizardClient.nextStep(req.body);
    res.json(result);
  } catch (error) {
    console.error("Erro em /api/wizard/next:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/wizard/cancel", async (req, res) => {
  try {
    await wizardClient.cancelWizard();
    res.json({ success: true });
  } catch (error) {
    console.error("Erro em /api/wizard/cancel:", error);
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/wizard/status", async (req, res) => {
  try {
    const status = await wizardClient.getWizardStatus();
    res.json(status);
  } catch (error) {
    console.error("Erro em /api/wizard/status:", error);
    res.status(500).json({ error: error.message });
  }
});

// Model providers
app.get("/api/providers", async (req, res) => {
  try {
    const providers = await configManager.getProviders();
    res.json({ success: true, providers });
  } catch (error) {
    console.error("Erro em /api/providers:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Set API key
app.post("/api/auth", async (req, res) => {
  try {
    const { provider, apiKey, model } = req.body;
    await configManager.setAuth(provider, apiKey, model);
    res.json({ success: true });
  } catch (error) {
    console.error("Erro em /api/auth:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Configure gateway
app.post("/api/gateway", async (req, res) => {
  try {
    const { port, bind, authMode, token, password, allowedOrigins } = req.body;
    await configManager.configureGateway({
      port,
      bind,
      authMode,
      token,
      password,
      allowedOrigins,
    });
    res.json({ success: true });
  } catch (error) {
    console.error("Erro em /api/gateway:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Configure channels
app.post("/api/channels", async (req, res) => {
  try {
    const { channel, config } = req.body;
    await configManager.configureChannel(channel, config);
    res.json({ success: true });
  } catch (error) {
    console.error("Erro em /api/channels:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Configure web search
app.post("/api/web-search", async (req, res) => {
  try {
    const { provider, apiKey } = req.body;
    await configManager.configureWebSearch(provider, apiKey);
    res.json({ success: true });
  } catch (error) {
    console.error("Erro em /api/web-search:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Configure workspace
app.post("/api/workspace", async (req, res) => {
  try {
    const { path: workspacePath } = req.body;
    await configManager.configureWorkspace(workspacePath);
    res.json({ success: true });
  } catch (error) {
    console.error("Erro em /api/workspace:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Start OpenClaw gateway
app.post("/api/gateway/start", async (req, res) => {
  try {
    await configManager.startGateway();
    res.json({ success: true });
  } catch (error) {
    console.error("Erro em /api/gateway/start:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Stop OpenClaw gateway
app.post("/api/gateway/stop", async (req, res) => {
  try {
    await configManager.stopGateway();
    res.json({ success: true });
  } catch (error) {
    console.error("Erro em /api/gateway/stop:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get gateway status
app.get("/api/gateway/status", async (req, res) => {
  try {
    const status = await configManager.getGatewayStatus();
    res.json({ success: true, status });
  } catch (error) {
    console.error("Erro em /api/gateway/status:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Health check
app.post("/api/health/check", async (req, res) => {
  try {
    const result = await configManager.runHealthCheck();
    res.json({ success: true, result });
  } catch (error) {
    console.error("Erro em /api/health/check:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Install daemon
app.post("/api/daemon/install", async (req, res) => {
  try {
    const { runtime } = req.body;
    await configManager.installDaemon(runtime);
    res.json({ success: true });
  } catch (error) {
    console.error("Erro em /api/daemon/install:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Install skills
app.post("/api/skills/install", async (req, res) => {
  try {
    const { nodeManager } = req.body;
    await configManager.installSkills(nodeManager);
    res.json({ success: true });
  } catch (error) {
    console.error("Erro em /api/skills/install:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get onboarding progress
app.get("/api/onboarding/progress", async (req, res) => {
  try {
    const progress = await configManager.getOnboardingProgress();
    res.json({ success: true, progress });
  } catch (error) {
    console.error("Erro em /api/onboarding/progress:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Complete onboarding
app.post("/api/onboarding/complete", async (req, res) => {
  try {
    await configManager.completeOnboarding();
    res.json({ success: true });
  } catch (error) {
    console.error("Erro em /api/onboarding/complete:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Restart wrapper process (platform should bring it back up)
app.post("/api/system/restart", async (req, res) => {
  try {
    res.json({ success: true, message: "Reiniciando sistema..." });
    setTimeout(() => {
      process.exit(0);
    }, 250);
  } catch (error) {
    console.error("Erro em /api/system/restart:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Reset configuration
app.post("/api/reset", async (req, res) => {
  try {
    const { scope } = req.body;
    await configManager.resetConfig(scope || "config");
    res.json({ success: true });
  } catch (error) {
    console.error("Erro em /api/reset:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Fix Control UI origins
app.post("/api/gateway/fix-control-ui", async (req, res) => {
  try {
    const { allowedOrigins } = req.body || {};
    await configManager.fixControlUiOrigins(allowedOrigins);
    res.json({ success: true });
  } catch (error) {
    console.error("Erro em /api/gateway/fix-control-ui:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get all available models
app.get("/api/models", async (req, res) => {
  try {
    const models = await configManager.getAvailableModels();
    res.json({ success: true, models });
  } catch (error) {
    console.error("Erro em /api/models:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Serve main page
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "index.html"));
});

async function startOpenClawGateway() {
  try {
    // ATENÇÃO AQUI: Forçando rodar na porta do SquareCloud para não morrer!
    const port = process.env.PORT || 80;
    const fsSync = require("fs");

    const binToRun = fsSync.existsSync(OPENCLAW_LOCAL_BIN)
      ? OPENCLAW_LOCAL_BIN
      : "openclaw";

    console.log("[OpenClaw] Corrigindo configurações antigas/corrompidas...");
    try {
      await runOpenClaw("doctor --fix");
    } catch (e) {
      console.log("[OpenClaw] Falha não fatal no doctor --fix:", e.message);
    }

    console.log("[OpenClaw] Corrigindo origens do Control UI...");
    try {
      await configManager.fixControlUiOrigins();
    } catch (e) {
      console.log("[OpenClaw] Falha não fatal ao corrigir Control UI:", e.message);
    }

    console.log("[OpenClaw] Corrigindo origens do Control UI...");
    try {
      await configManager.fixControlUiOrigins();
    } catch (e) {
      console.log("[OpenClaw] Falha não fatal ao corrigir Control UI:", e.message);
    }

    console.log(
      `[OpenClaw] Configuração detectada. Iniciando OpenClaw diretamente na porta ${port}...`,
    );

    const child = spawn(
      binToRun,
      ["gateway", "--port", String(port), "--allow-unconfigured"],
      {
        stdio: "inherit",
      },
    );

    child.on("error", (err) => {
      console.error("[OpenClaw Gateway] Erro fatal:", err.message);
    });

    child.on("close", (code) => {
      console.log(`[OpenClaw Gateway] Processo encerrado com código ${code}`);
      process.exit(code || 0);
    });
  } catch (error) {
    console.error("[OpenClaw] Erro ao iniciar gateway:", error.message);
  }
}

// INICIALIZAÇÃO
(async () => {
  try {
    const progress = await configManager.getOnboardingProgress();

    if (progress && progress.completed === true) {
      // Inicia direto o OpenClaw Gateway na PORTA 80 e morre a porta do wizard
      await startOpenClawGateway();
      return;
    }
  } catch (e) {
    console.error("[OpenClaw] Erro ao verificar progresso:", e.message);
  }

  // Se não estiver configurado cai aqui e abre o wizard
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`🍅 TomateCloud OpenClaw Wrapper rodando na porta ${PORT}`);
    console.log(`🌐 Acesse: http://localhost:${PORT}`);
    console.log(
      "[OpenClaw] Executando em modo wizard (OpenClaw não configurado)",
    );
  });
})();

module.exports = app;
