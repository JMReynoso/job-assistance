import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClaudeService } from '../claude/claude.service';
import { OllamaService } from '../ollama/ollama.service';
import { AiProvider, AiProviderName } from './ai-provider.interface';

/**
 * Picks the engine for one generation run. The single place the default lives,
 * so no feature service has to know that Ollama is free and Claude isn't.
 */
@Injectable()
export class AiProviderRegistry {
    private readonly logger = new Logger(AiProviderRegistry.name);

    constructor(
        private readonly config: ConfigService,
        private readonly claude: ClaudeService,
        private readonly ollama: OllamaService,
    ) {}

    /**
     * What the request asked for, else AI_PROVIDER, else Ollama. Ollama is the
     * fallback because it's free: spending money should be something someone
     * chose, not what happens when nobody did.
     */
    resolve(requested?: AiProviderName): AiProvider {
        const name = requested ?? this.defaultName();
        const provider: AiProvider =
            name === 'claude' ? this.claude : this.ollama;
        this.logger.log(
            `AI provider for this run: ${provider.name}` +
                (requested ? ' (requested)' : ' (default)'),
        );
        return provider;
    }

    private defaultName(): AiProviderName {
        return this.config.get<string>('AI_PROVIDER') === 'claude'
            ? 'claude'
            : 'ollama';
    }
}
