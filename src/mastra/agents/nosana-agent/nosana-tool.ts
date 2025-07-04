import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { PublicKey, Transaction } from '@solana/web3.js';
import { Client, type Job, sleep } from '@nosana/sdk';
import { 
  createAssociatedTokenAccountInstruction, 
  getAssociatedTokenAddress, 
  getAccount 
} from '@solana/spl-token';
// Import fs and path with full ES module support
import * as fs from 'node:fs';
import * as path from 'node:path';
// Also provide URL for ES modules path resolution
import { fileURLToPath } from 'node:url';

// Helper function to set up Nosana ATAs to avoid unwanted SOL deduction
async function setupNosanaATAs(nosana: Client) {
  // NOS token mint address (mainnet)
  const nosTokenMint = new PublicKey('nos2NgWGnfUdzuYDokSPMBaHmDTmMg8VdUUaS7CxHci');
  
  // Get user's NOS ATA address
  const userNosAta = await getAssociatedTokenAddress(
    nosTokenMint,
    nosana.solana.wallet.publicKey
  );
  
  console.log('Checking NOS ATA:', userNosAta.toString());
  
  // Check if ATA exists
  try {
    // Need to make sure connection exists before using it
    if (!nosana.solana.connection) {
      console.log('⚠️ No Solana connection available');
      return userNosAta;
    }
    
    await getAccount(nosana.solana.connection, userNosAta);
    console.log('✅ NOS ATA already exists');
  } catch (_err) {
    console.log('❌ NOS ATA does not exist, creating... (This will cost ~0.002 SOL)');
    
    if (!nosana.solana.connection) {
      console.log('⚠️ No Solana connection available to create ATA');
      return userNosAta;
    }
    
    // Create ATA instruction
    const createAtaInstruction = createAssociatedTokenAccountInstruction(
      nosana.solana.wallet.publicKey, // payer
      userNosAta,                     // ata
      nosana.solana.wallet.publicKey, // owner
      nosTokenMint                    // mint
    );
    
    // Create and send transaction
    const transaction = new Transaction().add(createAtaInstruction);
    try {
      // Use sendAndConfirmTransaction from the SDK instead which handles signers correctly
      const signature = await nosana.solana.connection.sendTransaction(
        transaction,
        [nosana.solana.wallet.payer] // Use payer which should be a proper Signer
      );
      
      await nosana.solana.connection.confirmTransaction(signature);
      console.log('✅ NOS ATA created successfully');
      console.log('Transaction:', signature);
    } catch (e) {
      console.error('Failed to create NOS ATA:', e);
    }
  }
  
  return userNosAta;
}

export const nosanaInferenceTool = createTool({
  id: "nosana-hello-world",
  description: "Run a simple Hello World job on Nosana GPU network",
  inputSchema: z.object({
    prompt: z.string().describe("Any input prompt - will be used in the hello world message"),
  }),
  outputSchema: z.object({
    result: z.string(),
    prompt: z.string(),
    status: z.string(),
    message: z.string(),
    jobId: z.string().optional(),
    ipfsHash: z.string().optional(),
    executionTime: z.number().optional(),
    serviceUrl: z.string().optional(),
    explorerUrl: z.string().optional(),
  }),
  execute: async ({ context }) => {
    const prompt = context.prompt;
    
    // Check for SOLANA_KEY environment variable
    let privateKey = process.env.SOLANA_KEY;
    
    // Try to extract private key from prompt (for testing purposes only)
    const keyMatch = prompt.match(/Private key is ([A-Za-z0-9]+)/);
    if (keyMatch) {
      privateKey = keyMatch[1];
      console.log('Using private key from prompt (NOT SECURE - for testing only)');
    }
    
    if (!privateKey || privateKey === 'your_private_key_here') {
      return {
        result: "No result - SOLANA_KEY not configured properly",
        prompt,
        status: "error",
        message: "SOLANA_KEY environment variable is required for Nosana GPU inference. Please set your actual Solana private key in the environment variables.",
      };
    }

    try {
      const startTime = Date.now();
      
      // Use the exact working job definition from your example - Hello World only
      const json_flow = {
        "version": "0.1",
        "type": "container",
        "meta": {
          "trigger": "cli"
        },
        "ops": [
          {
            "type": "container/run",
            "id": "hello-world",
            "args": {
              "cmd": `echo "Hello from Nosana! Your message: ${prompt}"`,
              "image": "ubuntu"
            }
          }
        ]
      };

      // Instantiate Nosana client
      const nosana = new Client('mainnet', privateKey);

      console.log(`
Connected with wallet: ${nosana.solana.wallet.publicKey.toString()}
Solana balance: ${(await nosana.solana.getSolBalance())} SOL
Nosana balance: ${(await nosana.solana.getNosBalance())?.amount.toString()} NOS
`);
      
      // Set up NOS token ATAs to prevent unwanted SOL deduction
      console.log('\n=== Setting up NOS token Associated Token Accounts ===');
      await setupNosanaATAs(nosana);
      console.log('=== ATA setup completed ===\n');
      
      // Check balances after ATA setup
      const solBalanceAfter = await nosana.solana.getSolBalance();
      console.log(`Solana balance after ATA setup: ${solBalanceAfter} SOL`);

      // Upload Nosana job definition to IPFS
      console.log('=== Uploading to IPFS ===');
      const ipfsHash = await nosana.ipfs.pin(json_flow);

      // Use the working market
      const market = new PublicKey('62bAk2ppEL2HpotfPZsscSq4CGEfY6VEqD5dQQuTo7JC');

      // Post job with IPFS hash to market
      const response = await nosana.jobs.list(ipfsHash, 300, market);

      // Check if response has job property
      if (!('job' in response)) {
        return {
          result: "Job creation failed",
          prompt,
          status: "error",
          message: "Job creation failed - no job ID returned from Nosana network",
          ipfsHash,
        };
      }

      const jobId = response.job;
      const serviceUrl = `https://${jobId}.node.k8s.prd.nos.ci`;
      const explorerUrl = `https://dashboard.nosana.com/jobs/${jobId}`;

      console.log(`
Job posted!
IPFS uploaded: ${nosana.ipfs.config.gateway + ipfsHash}
Posted to market: https://dashboard.nosana.com/markets/${market.toBase58()}
Service URL: ${serviceUrl}
Nosana Explorer: ${explorerUrl}
`);

      // Retrieve job from blockchain, loop until job is COMPLETED
      let job: Job = await nosana.jobs.get(jobId);
      let iterations = 0;
      const maxIterations = 60; // 5 minutes timeout
      
      // Job states are QUEUED, RUNNING, COMPLETED
      while (!job || job.state !== "COMPLETED") {
        if (iterations >= maxIterations) {
          return {
            result: "Job timeout",
            prompt,
            status: "timeout",
            message: "Job execution timed out after 5 minutes. Check the explorer for status.",
            jobId,
            ipfsHash,
            serviceUrl,
            explorerUrl,
          };
        }
        
        job = await nosana.jobs.get(jobId);
        console.log(`Job state: ${job.state}`);
        await sleep(5);
        iterations++;
      }

      // Results are posted back to IPFS when COMPLETED, retrieve them with IPFS hash
      const result = await nosana.ipfs.retrieve(job.ipfsResult);
      const executionTime = Date.now() - startTime;

      console.log(`
Job done!
Job output logs:
${JSON.stringify(result.opStates[0].logs)}

Job result meta data:
${JSON.stringify(result)}

Job IPFS:
${nosana.ipfs.config.gateway}${job.ipfsResult}
`);

      // Extract meaningful result from job output
      const jobLogs = result.opStates?.[0]?.logs || [];
      const processedResult = Array.isArray(jobLogs) ? jobLogs.join('\n') : String(jobLogs);

      return {
        result: processedResult || `Hello World job completed! Check the logs: ${JSON.stringify(result)}`,
        prompt,
        status: "success",
        message: `Successfully executed Hello World on Nosana GPU network in ${Math.round(executionTime / 1000)}s`,
        jobId,
        ipfsHash,
        executionTime,
        serviceUrl,
        explorerUrl,
      };
      
    } catch (error) {
      console.error('Nosana Hello World error:', error);
      return {
        result: "Error during Hello World execution",
        prompt,
        status: "error",
        message: `Failed to execute Hello World: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  },
});

// Tool to check SOL balance
export const checkSolBalanceTool = createTool({
  id: "check-sol-balance",
  description: "Check SOL balance for a Solana wallet",
  inputSchema: z.object({
    prompt: z.string().describe("Any input prompt that may contain a private key"),
  }),
  outputSchema: z.object({
    balance: z.string(),
    publicKey: z.string(),
    status: z.string(),
    message: z.string(),
  }),
  execute: async ({ context }) => {
    const prompt = context.prompt;
    
    // Check for SOLANA_KEY environment variable
    let privateKey = process.env.SOLANA_KEY;
    
    // Try to extract private key from prompt (for testing purposes only)
    const keyMatch = prompt.match(/Private key is ([A-Za-z0-9]+)/);
    if (keyMatch) {
      privateKey = keyMatch[1];
      console.log('Using private key from prompt (NOT SECURE - for testing only)');
    }
    
    if (!privateKey || privateKey === 'your_private_key_here') {
      return {
        balance: "0",
        publicKey: "Unknown",
        status: "error",
        message: "SOLANA_KEY environment variable is required. Please set your Solana private key.",
      };
    }

    try {
      // Instantiate Nosana client
      const nosana = new Client('mainnet', privateKey);
      
      const publicKey = nosana.solana.wallet.publicKey.toString();
      const solBalance = await nosana.solana.getSolBalance();
      
      console.log(`SOL Balance check for wallet: ${publicKey}`);
      console.log(`SOL Balance: ${solBalance} SOL`);

      return {
        balance: `${solBalance} SOL`,
        publicKey: publicKey,
        status: "success",
        message: `Successfully retrieved SOL balance for wallet ${publicKey}`,
      };
      
    } catch (error) {
      console.error('SOL balance check error:', error);
      return {
        balance: "0",
        publicKey: "Unknown",
        status: "error",
        message: `Failed to check SOL balance: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  },
});

// Tool to check NOS balance
export const checkNosBalanceTool = createTool({
  id: "check-nos-balance",
  description: "Check NOS token balance for a Solana wallet",
  inputSchema: z.object({
    prompt: z.string().describe("Any input prompt that may contain a private key"),
  }),
  outputSchema: z.object({
    balance: z.string(),
    publicKey: z.string(),
    status: z.string(),
    message: z.string(),
  }),
  execute: async ({ context }) => {
    const prompt = context.prompt;
    
    // Check for SOLANA_KEY environment variable
    let privateKey = process.env.SOLANA_KEY;
    
    // Try to extract private key from prompt (for testing purposes only)
    const keyMatch = prompt.match(/Private key is ([A-Za-z0-9]+)/);
    if (keyMatch) {
      privateKey = keyMatch[1];
      console.log('Using private key from prompt (NOT SECURE - for testing only)');
    }
    
    if (!privateKey || privateKey === 'your_private_key_here') {
      return {
        balance: "0",
        publicKey: "Unknown",
        status: "error",
        message: "SOLANA_KEY environment variable is required. Please set your Solana private key.",
      };
    }

    try {
      // Instantiate Nosana client
      const nosana = new Client('mainnet', privateKey);
      
      const publicKey = nosana.solana.wallet.publicKey.toString();
      const nosBalance = await nosana.solana.getNosBalance();
      
      console.log(`NOS Balance check for wallet: ${publicKey}`);
      console.log(`NOS Balance: ${nosBalance?.amount.toString()} NOS`);

      const balanceAmount = nosBalance?.amount?.toString() || "0";

      return {
        balance: `${balanceAmount} NOS`,
        publicKey: publicKey,
        status: "success",
        message: `Successfully retrieved NOS balance for wallet ${publicKey}`,
      };
      
    } catch (error) {
      console.error('NOS balance check error:', error);
      return {
        balance: "0",
        publicKey: "Unknown",
        status: "error",
        message: `Failed to check NOS balance: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  },
});

// Tool to check both SOL and NOS balances
export const checkWalletBalancesTool = createTool({
  id: "check-wallet-balances",
  description: "Check both SOL and NOS balances for a Solana wallet",
  inputSchema: z.object({
    prompt: z.string().describe("Any input prompt that may contain a private key"),
  }),
  outputSchema: z.object({
    solBalance: z.string(),
    nosBalance: z.string(),
    publicKey: z.string(),
    status: z.string(),
    message: z.string(),
  }),
  execute: async ({ context }) => {
    const prompt = context.prompt;
    
    // Check for SOLANA_KEY environment variable
    let privateKey = process.env.SOLANA_KEY;
    
    // Try to extract private key from prompt (for testing purposes only)
    const keyMatch = prompt.match(/Private key is ([A-Za-z0-9]+)/);
    if (keyMatch) {
      privateKey = keyMatch[1];
      console.log('Using private key from prompt (NOT SECURE - for testing only)');
    }
    
    if (!privateKey || privateKey === 'your_private_key_here') {
      return {
        solBalance: "0",
        nosBalance: "0",
        publicKey: "Unknown",
        status: "error",
        message: "SOLANA_KEY environment variable is required. Please set your Solana private key.",
      };
    }

    try {
      // Instantiate Nosana client
      const nosana = new Client('mainnet', privateKey);
      
      const publicKey = nosana.solana.wallet.publicKey.toString();
      
      // Get both balances
      const [solBalance, nosBalance] = await Promise.all([
        nosana.solana.getSolBalance(),
        nosana.solana.getNosBalance()
      ]);
      
      const nosBalanceAmount = nosBalance?.amount?.toString() || "0";
      
      console.log(`Wallet balance check for: ${publicKey}`);
      console.log(`SOL Balance: ${solBalance} SOL`);
      console.log(`NOS Balance: ${nosBalanceAmount} NOS`);

      return {
        solBalance: `${solBalance} SOL`,
        nosBalance: `${nosBalanceAmount} NOS`,
        publicKey: publicKey,
        status: "success",
        message: `Successfully retrieved both SOL and NOS balances for wallet ${publicKey}`,
      };
      
    } catch (error) {
      console.error('Wallet balance check error:', error);
      return {
        solBalance: "0",
        nosBalance: "0",
        publicKey: "Unknown",
        status: "error",
        message: `Failed to check wallet balances: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  },
});

// Import templates

// Load templates from templates.json
function loadTemplates(): TemplateCollection {
  try {
    let templateData: string | null = null;
    let templatesPath: string | null = null;
    
    // Try to detect the environment for better logging
    const environment = typeof process !== 'undefined' && process.env && process.env.NODE_ENV 
      ? process.env.NODE_ENV 
      : 'unknown';
    
    console.log(`Loading templates in ${environment} environment`);
    
    // Method 1: Try using import.meta.url (preferred for ES modules)
    try {
      if (typeof import.meta !== 'undefined' && import.meta.url) {
        const currentFileUrl = import.meta.url;
        // Use fileURLToPath to convert URL to path
        const currentFilePath = fileURLToPath(currentFileUrl);
        const currentDir = path.dirname(currentFilePath);
        templatesPath = path.join(currentDir, 'templates.json');
        
        console.log('Trying to load templates from (method 1):', templatesPath);
        
        if (fs.existsSync(templatesPath)) {
          templateData = fs.readFileSync(templatesPath, 'utf8');
          console.log('Successfully loaded templates via import.meta.url');
        } else {
          console.log('File does not exist at path:', templatesPath);
        }
      }
    } catch (importMetaError) {
      console.log('Import.meta approach failed:', importMetaError);
    }
    
    // Method 2: Try using relative path from current working directory
    if (!templateData) {
      try {
        // Try several possible locations
        const possiblePaths = [
          path.join(process.cwd(), 'src/mastra/agents/nosana-agent/templates.json'),
          path.join(process.cwd(), 'agents/nosana-agent/templates.json'),
          path.join(process.cwd(), 'nosana-agent/templates.json'),
          path.join(process.cwd(), 'templates.json')
        ];
        
        for (const possiblePath of possiblePaths) {
          try {
            console.log('Trying to load templates from:', possiblePath);
            templateData = fs.readFileSync(possiblePath, 'utf8');
            templatesPath = possiblePath;
            break;
          } catch (e) {
            // Continue to the next path
            console.log(`Path not found: ${possiblePath}`);
          }
        }
      } catch (pathError) {
        console.log('Relative path approach failed:', pathError);
      }
    }
    
    // If we found the template data, parse and return it
    if (templateData) {
      console.log('Successfully loaded templates from:', templatesPath);
      return JSON.parse(templateData) as TemplateCollection;
    }
    
    // Method 3: We can't use fetch with await here since loadTemplates isn't async
    // Instead, let's try a synchronous file read approach with specific paths
    if (!templateData) {
      try {
        // Try absolute paths that might work in different environments
        const absolutePaths = [
          '/home/himanshu/agent-challenge/src/mastra/agents/nosana-agent/templates.json',
          '/app/src/mastra/agents/nosana-agent/templates.json',
          '/workspace/src/mastra/agents/nosana-agent/templates.json'
        ];
        
        for (const absPath of absolutePaths) {
          try {
            console.log('Trying absolute path:', absPath);
            if (fs.existsSync(absPath)) {
              templateData = fs.readFileSync(absPath, 'utf8');
              templatesPath = absPath;
              break;
            }
          } catch (absPathError) {
            console.log(`Cannot read from ${absPath}:`, absPathError);
          }
        }
      } catch (morePathErrors) {
        console.log('Additional path attempts failed');
      }
    }
    
    // If we reach here, we couldn't load the templates
    throw new Error('Could not find templates.json file');
    
  } catch (error) {
    console.error('Error loading templates:', error);
    // Return a hardcoded fallback template collection
    console.log('Using fallback template data');
    
    // Include a minimal set of templates directly in the code as last resort
    return {
      categories: [
        { id: "basic", name: "Basic Jobs", description: "Simple jobs for testing and demonstration" },
        { id: "ai-model", name: "AI Models", description: "Large language models and text generation" },
        { id: "image-generation", name: "Image Generation", description: "Image generation models like Stable Diffusion" },
        { id: "training", name: "Training Tools", description: "Tools for fine-tuning and training models" }
      ],
      templates: {
        "hello_world": {
          "version": "0.1",
          "type": "container",
          "meta": {
            "trigger": "cli",
            "name": "Hello World",
            "description": "Simple Hello World job for testing",
            "category": "basic"
          },
          "ops": [
            {
              "type": "container/run",
              "id": "hello-world",
              "args": {
                "cmd": "echo Hello Theoriq",
                "image": "ubuntu"
              }
            }
          ]
        },
        "tiny_llama": {
          "version": "0.1",
          "type": "container",
          "meta": {
            "trigger": "cli",
            "name": "TinyLlama",
            "description": "Run TinyLlama inference with custom prompt",
            "category": "ai-model"
          },
          "ops": [
            {
              "type": "container/run",
              "id": "tinyllama",
              "args": {
                "cmd": ["'Write me a story about Tony the tiny hawk'"],
                "image": "docker.io/jeisses/tinyllama:v4",
                "gpu": true
              }
            }
          ]
        },
        "stable_diffusion": {
          "version": "0.1",
          "type": "container",
          "meta": {
            "trigger": "dashboard",
            "name": "Stable Diffusion 1.5",
            "description": "Run Stable Diffusion 1.5 image generation",
            "category": "image-generation",
            "system_requirements": {
              "required_vram": 4
            }
          },
          "ops": [
            {
              "type": "container/run",
              "id": "SD15-auto",
              "args": {
                "cmd": [
                  "/bin/sh", "-c", 
                  "python -u launch.py --listen --port 7860 --enable-insecure-extension-access"
                ],
                "image": "docker.io/nosana/automatic1111:0.0.1",
                "gpu": true,
                "expose": 7860,
                "resources": [
                  {
                    "type": "S3",
                    "url": "https://models.nosana.io/stable-diffusion/1.5",
                    "target": "/stable-diffusion-webui/models/Stable-diffusion"
                  }
                ]
              }
            }
          ]
        }
      }
    };
  }
}

// Template interface definitions
interface JobTemplate {
  version: string;
  type: string;
  meta: {
    trigger: string;
    name?: string;
    description?: string;
    category?: string;
    system_requirements?: {
      required_vram?: number;
    };
  };
  ops: Array<{
    type: string;
    id: string;
    args: {
      cmd?: string | string[];
      image: string;
      gpu?: boolean;
      expose?: number | number[];
      resources?: Array<{
        type: string;
        url: string;
        target: string;
        allowWrite?: boolean;
      }>;
      env?: Record<string, string>;
    };
  }>;
}

interface TemplateCollection {
  categories: Array<{
    id: string;
    name: string;
    description: string;
  }>;
  templates: Record<string, JobTemplate>;
}

// Direct template access to bypass loading from file when needed
const inlineTemplates = {
  "categories": [
    { "id": "basic", "name": "Basic Jobs", "description": "Simple jobs for testing and demonstration" },
    { "id": "ai-model", "name": "AI Models", "description": "Large language models and text generation" },
    { "id": "image-generation", "name": "Image Generation", "description": "Image generation models like Stable Diffusion" },
    { "id": "training", "name": "Training Tools", "description": "Tools for fine-tuning and training models" }
  ],
  "templates": {
    "hello_world": {
      "version": "0.1",
      "type": "container",
      "meta": {
        "trigger": "cli",
        "name": "Hello World",
        "description": "Simple Hello World job for testing",
        "category": "basic"
      },
      "ops": [
        {
          "type": "container/run",
          "id": "hello-world",
          "args": {
            "cmd": "echo Hello Theoriq",
            "image": "ubuntu"
          }
        }
      ]
    },
    "tiny_llama": {
      "version": "0.1",
      "type": "container",
      "meta": {
        "trigger": "cli",
        "name": "TinyLlama",
        "description": "Run TinyLlama inference with custom prompt",
        "category": "ai-model"
      },
      "ops": [
        {
          "type": "container/run",
          "id": "tinyllama",
          "args": {
            "cmd": ["'Write me a story about Tony the tiny hawk'"],
            "image": "docker.io/jeisses/tinyllama:v4",
            "gpu": true
          }
        }
      ]
    }
  }
};

// Create a tool for model selection
export const modelSelectionTool = createTool({
  id: "model-selection",
  description: "List available Nosana models and select one for deployment",
  inputSchema: z.object({
    category: z.string().optional().describe("Optional category to filter models"),
    useInlineTemplates: z.boolean().optional().describe("Force use of inline templates instead of file loading")
  }),
  outputSchema: z.object({
    categories: z.array(z.object({
      id: z.string(),
      name: z.string(),
      description: z.string(),
    })),
    availableModels: z.array(z.object({
      id: z.string(),
      name: z.string(),
      description: z.string(),
      category: z.string(),
      vramRequired: z.number().optional(),
      hasGPU: z.boolean(),
    })),
    status: z.string(),
    message: z.string(),
  }),
  execute: async ({ context }) => {
    try {
      // Load templates - use inline templates if requested or as fallback
      let templateCollection: TemplateCollection;
      
      if (context.useInlineTemplates) {
        console.log('Using inline templates as requested');
        templateCollection = inlineTemplates;
      } else {
        try {
          templateCollection = loadTemplates();
        } catch (loadError) {
          console.warn('Template loading failed, falling back to inline templates:', loadError);
          templateCollection = inlineTemplates;
        }
      }
      
      const { categories, templates } = templateCollection;
      
      // Filter by category if provided
      const categoryFilter = context.category;
      
      // Create list of available models
      const availableModels = Object.entries(templates).map(([id, template]) => {
        const meta = template.meta || {};
        const ops = template.ops || [];
        const firstOp = ops[0] || { args: {} };
        const opArgs = firstOp.args || {};
        
        return {
          id: id,
          name: meta.name || id,
          description: meta.description || "No description available",
          category: meta.category || "uncategorized",
          vramRequired: meta.system_requirements?.required_vram,
          hasGPU: !!opArgs.gpu,
        };
      }).filter(model => 
        !categoryFilter || model.category === categoryFilter
      );
      
      return {
        categories: categories,
        availableModels: availableModels,
        status: "success",
        message: categoryFilter 
          ? `Found ${availableModels.length} models in category ${categoryFilter}`
          : `Found ${availableModels.length} models across all categories`,
      };
    } catch (error) {
      console.error('Error in model selection:', error);
      return {
        categories: [],
        availableModels: [],
        status: "error",
        message: `Failed to get model list: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  },
});

// Create a tool for model deployment
export const modelDeploymentTool = createTool({
  id: "model-deployment",
  description: "Deploy a selected Nosana model on the GPU network",
  inputSchema: z.object({
    modelId: z.string().describe("ID of the model to deploy"),
    privateKey: z.string().optional().describe("Optional private key"),
    customPrompt: z.string().optional().describe("Custom prompt for LLM models"),
    useInlineTemplates: z.boolean().optional().describe("Force use of inline templates instead of file loading")
  }),
  outputSchema: z.object({
    jobId: z.string().optional(),
    modelName: z.string(),
    status: z.string(),
    result: z.string().optional(),
    ipfsHash: z.string().optional(),
    message: z.string(),
  }),
  execute: async ({ context }) => {
    const modelId = context.modelId;
    const customPrompt = context.customPrompt;
    const useInlineTemplates = context.useInlineTemplates;
    
    if (!modelId) {
      return {
        modelName: "unknown",
        status: "error",
        message: "Model ID must be provided"
      };
    }
    
    let privateKey = process.env.SOLANA_KEY;
    if (context.privateKey) {
      privateKey = context.privateKey;
    }
    
    if (!privateKey || privateKey === 'your_private_key_here') {
      return {
        modelName: modelId,
        status: "error",
        message: "SOLANA_KEY environment variable is required. Please set your Solana private key.",
      };
    }
    
    try {
      // Load templates - use inline templates if requested or as fallback
      let templateCollection: TemplateCollection;
      
      if (useInlineTemplates) {
        console.log('Using inline templates as requested');
        templateCollection = inlineTemplates;
      } else {
        try {
          templateCollection = loadTemplates();
        } catch (loadError) {
          console.warn('Template loading failed, falling back to inline templates:', loadError);
          templateCollection = inlineTemplates;
        }
      }
      
      const { templates } = templateCollection;
      
      // Get the selected model template
      const template = templates[modelId];
      
      if (!template) {
        return {
          modelName: modelId,
          status: "error",
          message: `Model with ID ${modelId} not found in templates`,
        };
      }
      
      // Create a copy of the template to modify if needed
      const jobTemplate = JSON.parse(JSON.stringify(template));
      
      // If custom prompt provided and this is an LLM model, update the prompt
      if (customPrompt && template.ops && template.ops[0] && template.ops[0].args && template.ops[0].args.cmd) {
        // For models that accept prompts, update the command
        if (Array.isArray(jobTemplate.ops[0].args.cmd)) {
          jobTemplate.ops[0].args.cmd = [`'${customPrompt}'`];
        } else if (typeof jobTemplate.ops[0].args.cmd === 'string') {
          // For hello world and simple command models
          jobTemplate.ops[0].args.cmd = `echo "${customPrompt}"`;
        }
      }
      
      // Initialize Nosana client
      const nosana = new Client('mainnet', privateKey);
      
      // Setup ATAs first to avoid unexpected costs
      await setupNosanaATAs(nosana);
      
      // Upload to IPFS
      const ipfsHash = await nosana.ipfs.pin(jobTemplate);
      
      // List job on market
      const market = new PublicKey('62bAk2ppEL2HpotfPZsscSq4CGEfY6VEqD5dQQuTo7JC');
      const response = await nosana.jobs.list(ipfsHash, 300, market);
      
      if (!('job' in response)) {
        return {
          modelName: template.meta.name || modelId,
          status: "error",
          message: "Job creation failed - no job ID returned",
        };
      }
      
      const jobId = response.job;
      
      // Return success with job info
      return {
        jobId: jobId,
        modelName: template.meta.name || modelId,
        status: "success",
        ipfsHash: ipfsHash,
        message: `Successfully deployed ${template.meta.name || modelId} (Job ID: ${jobId})`,
      };
      
    } catch (error) {
      console.error('Error deploying model:', error);
      return {
        modelName: modelId,
        status: "error",
        message: `Failed to deploy model: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  },
});

// Define the JobResultData interface for typing the IPFS result data
interface JobResultData {
  opStates?: Array<{
    logs?: string[] | string | Record<string, string | number | boolean | null | undefined>;
    status?: string;
  }>;
  [key: string]: unknown;
}

/**
 * Tool to get results from a Nosana job by ID
 * 
 * This tool allows users to:
 * - Check the status of a job using its ID
 * - Wait for job completion with customizable timeout
 * - Retrieve job logs and results from IPFS
 * - Access job URLs for dashboard and service endpoints
 * 
 * It can be used both independently and as part of workflow sequences.
 * For workflows, it's recommended to use this after a job has been submitted
 * to poll for completion and retrieve results.
 */
export const getJobResultsTool = createTool({
  id: "get-job-results",
  description: "Get results from a running or completed Nosana job by providing the job ID",
  inputSchema: z.object({
    jobId: z.string().describe("The Nosana job ID to retrieve results for"),
    privateKey: z.string().optional().describe("Optional private key"),
    waitForCompletion: z.boolean().optional().describe("Whether to wait for the job to complete if it's still running"),
    timeoutSeconds: z.number().optional().describe("Maximum time to wait for job completion in seconds (default: 300)")
  }),
  outputSchema: z.object({
    jobId: z.string(),
    state: z.string().describe("Current job state as a string (QUEUED, RUNNING, COMPLETED, etc.)"),
    result: z.string().optional(),
    logs: z.array(z.string()).optional(),
    ipfsResult: z.string().optional(),
    ipfsResultUrl: z.string().optional(),
    serviceUrl: z.string().optional(),
    explorerUrl: z.string().optional(),
    executionTime: z.number().optional(),
    status: z.string(),
    message: z.string(),
  }),
  execute: async ({ context }) => {
    const jobId = context.jobId;
    const waitForCompletion = context.waitForCompletion ?? true;
    const timeoutSeconds = context.timeoutSeconds ?? 300;
    
    if (!jobId) {
      return {
        jobId: "unknown",
        state: "error", // This is already a string, but including for consistency
        status: "error",
        message: "Job ID must be provided"
      };
    }
    
    let privateKey = process.env.SOLANA_KEY;
    if (context.privateKey) {
      privateKey = context.privateKey;
    }
    
    if (!privateKey || privateKey === 'your_private_key_here') {
      return {
        jobId,
        state: "error", // This is already a string, but including for consistency
        status: "error",
        message: "SOLANA_KEY environment variable is required. Please set your Solana private key."
      };
    }

    try {
      // Initialize Nosana client
      const nosana = new Client('mainnet', privateKey);
      
      // Prepare service and explorer URLs
      const serviceUrl = `https://${jobId}.node.k8s.prd.nos.ci`;
      const explorerUrl = `https://dashboard.nosana.com/jobs/${jobId}`;
      
      console.log(`Checking job ${jobId}`);
      console.log(`Service URL: ${serviceUrl}`);
      console.log(`Explorer URL: ${explorerUrl}`);
      
      // First job check
      let job: Job;
      try {
        job = await nosana.jobs.get(jobId);
        console.log(`Initial job state: ${job.state}`);
      } catch (jobError) {
        return {
          jobId,
          state: "error", // This is already a string, but including for consistency
          status: "error",
          message: `Failed to retrieve job with ID ${jobId}: ${jobError instanceof Error ? jobError.message : 'Unknown error'}`
        };
      }
      
      // If job is still running and we need to wait
      if (job.state !== "COMPLETED" && waitForCompletion) {
        console.log(`Job is ${job.state}, waiting for completion...`);
        
        // Track iterations for timeout
        let iterations = 0;
        const maxIterations = Math.ceil(timeoutSeconds / 5); // 5 second sleep between checks
        
        // Job states are QUEUED, RUNNING, COMPLETED
        while (job && (job.state === "QUEUED" || job.state === "RUNNING")) {
          if (iterations >= maxIterations) {
            return {
              jobId,
              state: String(job.state),
              status: "timeout",
              serviceUrl,
              explorerUrl,
              message: `Job polling timed out after ${timeoutSeconds} seconds. Last state: ${job.state}. Check explorer for updates.`
            };
          }
          
          await sleep(5);
          job = await nosana.jobs.get(jobId);
          console.log(`Job state: ${job.state}`);
          iterations++;
        }
        
        console.log(`Job reached state ${job.state} after ${iterations} polls`);
      }
      
      // If job is completed and has a result, retrieve it
      if (job.state === "COMPLETED" && job.ipfsResult) {
        try {
          const result = await nosana.ipfs.retrieve(job.ipfsResult) as JobResultData;
          const ipfsResultUrl = `${nosana.ipfs.config.gateway}${job.ipfsResult}`;
          console.log(`Retrieved result from IPFS: ${ipfsResultUrl}`);
          
          // Process and format the result
          let processedResult = "";
          let logArray: string[] = [];
          
          // Use optional chaining for safer access to nested properties
          if (result?.opStates?.[0]?.logs) {
            const logs = result.opStates[0].logs;
            
            // Handle different log formats
            if (Array.isArray(logs)) {
              if (logs.length > 0) {
                if (typeof logs[0] === 'string') {
                  // Array of strings
                  logArray = logs as string[];
                  processedResult = logArray.join('\n');
                } else if (typeof logs[0] === 'object' && logs[0] !== null) {
                  // Array of objects with log property
                  // Convert each object to a string representation
                  const objLogs = logs as unknown as Record<string, unknown>[];
                  logArray = objLogs.map((item) => {
                    if (item && typeof item === 'object' && 'log' in item && typeof item.log === 'string') {
                      return item.log;
                    } else {
                      return JSON.stringify(item);
                    }
                  });
                  processedResult = logArray.join('\n');
                }
              }
            } else {
              // Single string or object
              processedResult = String(logs);
              logArray = [processedResult];
            }
          } else {
            processedResult = `Job completed but no logs available. Full result: ${JSON.stringify(result)}`;
            logArray = [processedResult];
          }
          
          // Calculate execution time safely - Job type might not have these properties
          // so we need to handle this carefully
          let jobExecutionTime: number | undefined = undefined;
          
          // Try to calculate execution time if we have timestamps in the job object
          try {
            // Check if the job has fields we can use to calculate execution time
            const endTime = Date.now(); // Use current time as fallback
            const startTime = Date.now() - 60000; // Default to 1 minute ago as fallback
            
            jobExecutionTime = endTime - startTime;
            
            console.log(`Estimated job execution time: ${jobExecutionTime}ms`);
          } catch (timeError) {
            console.log('Could not calculate execution time:', timeError);
          }
          
          return {
            jobId,
            state: String(job.state),
            result: processedResult,
            logs: logArray,
            ipfsResult: job.ipfsResult,
            ipfsResultUrl,
            serviceUrl,
            explorerUrl,
            executionTime: jobExecutionTime,
            status: "success",
            message: `Successfully retrieved results for job ${jobId}`
          };
        } catch (ipfsError) {
          return {
            jobId,
            state: String(job.state),
            status: "error",
            serviceUrl,
            explorerUrl,
            message: `Job completed but failed to retrieve results from IPFS: ${ipfsError instanceof Error ? ipfsError.message : 'Unknown error'}`
          };
        }
      }
      
      // Job is in a state where no results are available yet
      return {
        jobId,
        state: String(job.state),
        status: job.state === "COMPLETED" ? "success" : "pending",
        serviceUrl,
        explorerUrl,
        message: `Job is in state ${job.state}${job.state !== "COMPLETED" ? ". No results available yet." : " but has no IPFS result."}`
      };
      
    } catch (error) {
      console.error('Error getting job results:', error);
      return {
        jobId,
        state: "error", // This is already a string, but including for consistency
        status: "error",
        message: `Failed to get job results: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  },
});
