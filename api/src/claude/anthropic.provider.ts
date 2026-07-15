import { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';

/**
 * Injection token for the shared Anthropic SDK client. Prefer injecting
 * ClaudeService over this token directly — the raw client is only exposed so
 * the SDK is constructed once, from config, in a single place.
 */
export const ANTHROPIC_CLIENT = Symbol('ANTHROPIC_CLIENT');

export const anthropicProvider: Provider = {
  provide: ANTHROPIC_CLIENT,
  inject: [ConfigService],
  useFactory: (config: ConfigService) =>
    new Anthropic({
      // Throws when this module is first loaded if the key is missing, so a
      // misconfigured deployment fails fast rather than on the first request.
      apiKey: config.getOrThrow<string>('ANTHROPIC_API_KEY'),
    }),
};
