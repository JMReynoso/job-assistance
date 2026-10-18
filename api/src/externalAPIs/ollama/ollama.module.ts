import { Module } from '@nestjs/common';
import { ollamaProvider } from './ollama.provider';
import { OllamaService } from './ollama.service';

/**
 * Import this module in any feature module that wants the free, local engine,
 * then inject OllamaService. Usually you want AiModule instead, which bundles
 * this with ClaudeModule behind AiProviderRegistry.
 */
@Module({
    providers: [ollamaProvider, OllamaService],
    exports: [OllamaService],
})
export class OllamaModule {}
