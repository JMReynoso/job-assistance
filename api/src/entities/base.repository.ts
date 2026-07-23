import { InternalServerErrorException, Logger } from '@nestjs/common';

/**
 * Shared error-handling path for every entity repository. Subclasses route
 * each query through {@link run}, which maps driver failures to a clean HTTP
 * error (the mirror of HunterService's `request()` around its HTTP client).
 * The raw error is logged here — message and stack, under the subclass's name
 * — and never leaks to the API response.
 */
export abstract class BaseRepository {
    protected readonly logger = new Logger(this.constructor.name);

    protected async run<T>(
        action: string,
        query: () => Promise<T>,
    ): Promise<T> {
        try {
            return await query();
        } catch (error) {
            const message =
                error instanceof Error ? error.message : String(error);
            this.logger.error(
                `Postgres error while ${action}: ${message}`,
                error instanceof Error ? error.stack : undefined,
            );
            throw new InternalServerErrorException(
                'Database error, please try again later',
            );
        }
    }
}
