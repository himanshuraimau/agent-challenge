# Nosana GPU Inference Agent

A comprehensive AI agent built for the Mastra framework that integrates with Nosana's distributed GPU network for decentralized AI inference.

## Overview

The Nosana GPU Inference Agent demonstrates how to leverage Nosana's decentralized compute infrastructure for running AI models at scale. It provides both individual inference capabilities and complex workflow orchestration for AI tasks.

## Architecture

### Components

1. **nosana-tool.ts** - Core tool for GPU inference operations
2. **nosana-agent.ts** - Main agent with conversational AI capabilities  
3. **nosana-workflow.ts** - Multi-step workflows for complex AI pipelines
4. **JOB_RESULTS_TOOL.md** - Documentation for the new job results retrieval tool

### Key Features

- **Multi-Model Support**: Llama2, Stable Diffusion, Whisper, Qwen
- **Cost Estimation**: Transparent pricing in NOS tokens
- **Distributed Computing**: Leverages Nosana's GPU network
- **Workflow Orchestration**: Complex multi-stage AI pipelines
- **IPFS Integration**: Decentralized storage for results
- **Solana Integration**: Blockchain-based payments
- **Optimized Token Usage**: Minimizes SOL costs with ATA pre-creation
- **Job Results Tool**: Retrieve and monitor job results by ID

## Recent Updates

### Type Fix for Job Results Tool

The `getJobResultsTool` has been updated to ensure consistent return types:

1. **Fixed Type Issue**: Ensured the `state` property is always returned as a string to match the Zod schema
2. **Added String Conversion**: Applied `String()` conversion to `job.state` to handle any potential non-string states
3. **Updated Documentation**: Clarified in code and docs that job state is normalized to string format

### SOL Deduction Fix

#### Problem Description

When using the Nosana SDK to run GPU jobs, users experienced unexpected SOL deductions from their wallets. This happened because:

1. **Associated Token Account (ATA) Creation**: Each new token interaction requires ATAs (~0.002 SOL each)
2. **Multiple ATAs Created**: User's ATA, Node's ATA, Project's ATA, Market vault ATA
3. **Transaction Fees**: Standard Solana blockchain fees for operations

#### Implemented Solution

Our agent now implements a comprehensive solution:

1. **Pre-creation of ATAs**: The `setupNosanaATAs` function in `nosana-tool.ts` checks if ATAs exist and creates them only if necessary
2. **Transparent Cost Reporting**: Clearly shows SOL used for ATAs vs. transaction fees
3. **Balance Tracking**: Monitors both SOL and NOS token usage throughout job execution

```typescript
// Example of how ATAs are pre-created
async function setupNosanaATAs(nosana: Client) {
  const nosTokenMint = new PublicKey('nos2NgWGnfUdzuYDokSPMBaHmDTmMg8VdUUaS7CxHci');
  
  const userNosAta = await getAssociatedTokenAddress(
    nosTokenMint,
    nosana.solana.wallet.publicKey
  );
  
  // Check if ATA exists before attempting creation
  try {
    await getAccount(nosana.solana.connection, userNosAta);
    console.log('✅ NOS ATA already exists');
  } catch (_err) {
    // Only create if needed (one-time cost)
    console.log('❌ Creating NOS ATA (costs ~0.002 SOL)');
    // Creation code here...
  }
}
```

#### Benefits

- **Predictable Costs**: Users understand when and why SOL is used
- **Reduced SOL Usage**: Only necessary costs are incurred
- **Better User Experience**: Clear information about token usage
- **Proper Token Usage**: NOS tokens for job payments, minimal SOL for transaction fees

## Supported AI Models

### Text Generation
- **Llama2**: Large language model for conversational AI
- **Qwen2.5**: Efficient multilingual language model
- Use cases: Chat, content generation, text completion

### Image Generation  
- **Stable Diffusion**: High-quality image synthesis
- Use cases: Art creation, design, visualization

### Audio Processing
- **Whisper**: Speech-to-text transcription
- Use cases: Audio transcription, voice recognition

## Job Results Tool

The Job Results Tool provides comprehensive job monitoring and results retrieval:

### Features

- **Job Status Retrieval**: Check job state by ID (QUEUED, RUNNING, COMPLETED)
- **Automatic Polling**: Wait for job completion with customizable timeout
- **Results Processing**: Parse and format job logs for easy consumption
- **URL Generation**: Access service and explorer URLs for any job
- **IPFS Integration**: Retrieve results from decentralized storage
- **Workflow Integration**: Works standalone or in workflow sequences

### Example Usage

```typescript
// Check job results with 2-minute timeout
const jobResults = await getJobResultsTool.execute({
  context: {
    jobId: "YOUR_JOB_ID",
    waitForCompletion: true,
    timeoutSeconds: 120
  }
});

console.log(`Job state: ${jobResults.state}`);
console.log(`Results: ${jobResults.result}`);
```

See [JOB_RESULTS_TOOL.md](./JOB_RESULTS_TOOL.md) for detailed documentation.

## Usage Examples

### Simple Inference

```typescript
import { nosanaInferenceTool } from './nosana-tool';

const result = await nosanaInferenceTool.execute({
  context: {
    model: "llama2",
    prompt: "Explain quantum computing",
    parameters: {
      max_tokens: 200,
      temperature: 0.7
    }
  }
});
```

### Image Generation

```typescript
const imageResult = await nosanaInferenceTool.execute({
  context: {
    model: "stable-diffusion", 
    prompt: "A futuristic city with flying cars",
    parameters: {
      image_steps: 30
    }
  }
});
```

### Audio Transcription

```typescript
const transcription = await nosanaInferenceTool.execute({
  context: {
    model: "whisper",
    prompt: "path/to/audio/file.mp3"
  }
});
```

## Advanced Workflow

The enhanced Nosana workflow demonstrates both parallel and sequential execution patterns, using multiple SDK tools:

```typescript
import { nosanaWorkflow } from './nosana-workflow';

const workflowResult = await nosanaWorkflow.execute({
  message: "Hello from Nosana workflow!",
  privateKey: process.env.SOLANA_KEY
});
```

### Workflow Structure

The workflow implements the following execution flow:

1. **Check Wallet Balance** - Verifies SOL and NOS token balances
2. **Setup ATAs** - Pre-creates Associated Token Accounts if needed
3. **Run Hello World Job** - Executes a job on the Nosana network
4. **Get Job Statistics** - Retrieves statistics about job execution
5. **Workflow Summary** - Aggregates results from all steps

### Parallel and Sequential Execution

The workflow demonstrates advanced control flow patterns:

```typescript
// Sequential execution
checkWalletStep,        // Step 1: Check wallet balances
setupAtaStep,           // Step 2: Setup ATAs (depends on wallet)
helloWorldJobStep,      // Step 3: Run job (depends on wallet & ATA)
jobStatsStep,           // Step 4: Get job stats (depends on job)
workflow-summary        // Step 5: Aggregate all results
```

In a full implementation, the workflow could include:
- **Parallel Steps**: Wallet check and ATA setup running concurrently
- **Branching Logic**: Different paths based on balance or job status
- **Merging Paths**: Combining results from multiple branches
- **Conditional Steps**: Executing only if certain conditions are met
- **Dynamic Input Mapping**: Passing data between steps

## Environment Setup

### Required Environment Variables

```bash
# Solana wallet private key for Nosana payments
SOLANA_KEY=your_solana_private_key_here

# Optional: Custom Nosana market address
NOSANA_MARKET=97G9NnvBDQ2WpKu6fasoMsAKmfj63C9rhysJnkeWodAf
```

### Wallet Requirements

- Minimum 0.01 SOL for transaction fees
- NOS tokens for GPU compute costs
- Solana mainnet wallet address

## Cost Structure

### Estimated Costs (in NOS tokens)

| Model Type | Cost Range | Duration |
|------------|------------|----------|
| Qwen2.5 | 0.1-0.2 NOS | 1-3 seconds |
| Llama2 | 0.2-0.5 NOS | 3-8 seconds |
| Whisper | 0.1-0.3 NOS | 2-5 seconds |
| Stable Diffusion | 0.5-1.0 NOS | 5-15 seconds |

*Costs vary based on input size, complexity, and network demand*

## API Endpoints

When integrated with Mastra, the following endpoints are available:

### Agent Endpoints
- `GET /api/agents/nosanaAgent` - Agent information
- `POST /api/agents/nosanaAgent/generate` - Single inference
- `POST /api/agents/nosanaAgent/stream` - Streaming inference

### Workflow Endpoints  
- `GET /api/workflows/nosana-gpu-inference-workflow` - Workflow info
- `POST /api/workflows/nosana-gpu-inference-workflow/run` - Execute workflow

## Integration with Frontend

The Nosana agent can be easily integrated with the weather agent frontend by adding new API calls:

```javascript
// Add to frontend/script.js
async function runNosanaInference(model, prompt) {
    const response = await fetch('/api/agents/nosanaAgent/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            messages: [{
                role: 'user', 
                content: `Run ${model} inference: ${prompt}`
            }]
        })
    });
    return response.json();
}
```

## Implementation Details

### Tool Structure

The Nosana tool follows Mastra's tool pattern:

```typescript
export const nosanaInferenceTool = createTool({
  id: "nosana-gpu-inference",
  description: "Run AI model inference on Nosana GPU network",
  inputSchema: z.object({...}),
  outputSchema: z.object({...}),
  execute: async ({ context }) => {...}
});
```

### Agent Instructions

The agent is configured with specialized instructions for:
- Model recommendations based on use cases
- Cost optimization strategies  
- Performance tuning advice
- Decentralized computing education

### Additional SDK Tools

The implementation includes several specialized tools that leverage the Nosana SDK:

1. **checkWalletBalancesTool** - Checks both SOL and NOS token balances
   - Monitors wallet balances before job execution
   - Helps ensure sufficient funds for operations

2. **checkSolBalanceTool** - Specifically checks SOL balance
   - Useful for tracking transaction fee availability
   - Monitors SOL usage for ATA creation and transactions

3. **checkNosBalanceTool** - Specifically checks NOS token balance
   - Ensures sufficient NOS tokens for job payments
   - Provides separate view of compute payment tokens

4. **nosanaInferenceTool** - Runs inference jobs on Nosana network
   - Handles IPFS uploads, job submission, and result retrieval
   - Pre-creates ATAs to optimize SOL usage

Each tool is implemented in `nosana-tool.ts` and can be used independently or as part of a workflow.

### Workflow Orchestration

The enhanced workflow architecture includes:

1. **Preprocessing**: Wallet validation and ATA setup
2. **Execution**: Job submission to Nosana network
3. **Monitoring**: Job status polling and statistics collection
4. **Aggregation**: Combining results from multiple workflow steps

## Benefits of Nosana Integration

### Decentralization
- No single point of failure
- Censorship resistance
- Global GPU resource access

### Cost Efficiency  
- Competitive pricing vs centralized providers
- Pay-per-use model
- Transparent blockchain pricing

### Performance
- Distributed parallel processing
- Reduced latency through geographic distribution
- Auto-scaling based on demand

### Privacy
- No data retention by centralized providers
- IPFS-based result storage
- Blockchain transaction transparency

## Future Enhancements

### Planned Features
- **Real Nosana SDK Integration**: Replace simulation with actual API calls
- **Multi-GPU Parallelization**: Split large tasks across nodes
- **Result Caching**: IPFS-based result deduplication
- **Advanced Scheduling**: Queue management and priority processing
- **Cost Optimization**: Automatic market selection for best prices

### Model Expansion
- **DALL-E Integration**: Additional image generation models
- **Claude/GPT Integration**: More text generation options
- **Specialized Models**: Domain-specific AI models
- **Custom Models**: User-uploaded model support

## Development Notes

### Current Implementation
The current implementation uses simulation for demonstration purposes. To enable actual Nosana inference:

1. Ensure proper Solana wallet setup
2. Configure environment variables
3. Replace simulation logic with real SDK calls
4. Handle error cases and retries

### Testing
```bash
# Run the agent in development mode
npm run dev

# Test the tool directly
npx mastra test nosanaInferenceTool

# Test the workflow
npx mastra test nosana-gpu-inference-workflow
```

## Troubleshooting

### Common Issues

1. **SOLANA_KEY not set**: Configure environment variable
2. **Insufficient funds**: Add SOL and NOS to wallet  
3. **Network timeouts**: Check Nosana network status
4. **Model not found**: Verify model name spelling

### Support Resources
- [Nosana Documentation](https://docs.nosana.io)
- [Nosana Dashboard](https://dashboard.nosana.com)
- [Mastra Framework](https://mastra.ai)
- [Solana Docs](https://docs.solana.com)

## Contributing

To extend the Nosana agent:

1. Fork the repository
2. Add new model support in `nosana-tool.ts`
3. Update agent instructions in `nosana-agent.ts`
4. Add workflow steps in `nosana-workflow.ts`
5. Enhance the job results tool with new features
6. Update documentation
7. Submit pull request

## License

This implementation is part of the Mastra agent challenge and follows the project's licensing terms.
