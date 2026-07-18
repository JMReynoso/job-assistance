import { Module } from '@nestjs/common';
import { hunterProvider } from './hunter.provider';
import { HunterService } from './hunter.service';

/**
 * Import this module in any feature module that needs contact lookups, then
 * inject HunterService. Like ClaudeModule, it's intentionally NOT registered in
 * AppModule: the client provider needs HUNTER_API_KEY the moment it loads, so
 * nothing requires the key until a feature actually uses it. To wire it up, add
 * `imports: [HunterModule]` to that feature module.
 */
@Module({
  providers: [hunterProvider, HunterService],
  exports: [HunterService],
})
export class HunterModule {}
