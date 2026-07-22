import { Module } from '@nestjs/common';
import { OllamaService } from './ollama.service';

/**
 * Import this module in any feature module that wants the free, local
 * message-drafting option, then inject OllamaService. Like ClaudeModule, it's
 * intentionally NOT registered in AppModule — nothing loads it until a feature
 * actually uses it. OllamaService reads its config from the (global) ConfigModule,
 * so no extra imports are needed here.
 */
@Module({
    providers: [OllamaService],
    exports: [OllamaService],
})
export class OllamaModule {}
