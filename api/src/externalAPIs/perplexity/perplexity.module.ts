import { Module } from '@nestjs/common';
import { perplexityProvider } from './perplexity.provider';
import { PerplexityService } from './perplexity.service';

/**
 * Import this module in any feature module that needs web search, then inject
 * PerplexityService. Like ClaudeModule, it's intentionally NOT registered in
 * AppModule: the client provider needs PERPLEXITY_API_KEY the moment it loads,
 * so nothing requires the key until a feature actually uses it. To wire it up,
 * add `imports: [PerplexityModule]` to that feature module.
 */
@Module({
    providers: [perplexityProvider, PerplexityService],
    exports: [PerplexityService],
})
export class PerplexityModule {}
