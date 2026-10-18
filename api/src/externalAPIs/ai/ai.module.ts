import { Module } from '@nestjs/common';
import { ClaudeModule } from '../claude/claude.module';
import { OllamaModule } from '../ollama/ollama.module';
import { AiProviderRegistry } from './ai-provider.registry';

/**
 * Import this in any feature module that generates content, then inject
 * AiProviderRegistry and ask it for a provider. Replaces importing ClaudeModule
 * directly: the caller shouldn't know, or care, which engine it gets.
 */
@Module({
    imports: [ClaudeModule, OllamaModule],
    providers: [AiProviderRegistry],
    exports: [AiProviderRegistry],
})
export class AiModule {}
