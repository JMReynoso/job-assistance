import { Module } from '@nestjs/common';
import { anthropicProvider } from './anthropic.provider';
import { ClaudeService } from './claude.service';

/**
 * Import this module in any feature module that needs Claude, then inject
 * ClaudeService. It's intentionally NOT registered in AppModule: nothing loads
 * it — and so nothing requires ANTHROPIC_API_KEY — until a feature actually
 * uses it. To wire it up, add `imports: [ClaudeModule]` to that feature module.
 */
@Module({
  providers: [anthropicProvider, ClaudeService],
  exports: [ClaudeService],
})
export class ClaudeModule {}
