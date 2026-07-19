import {
    Inject,
    Injectable,
    Logger,
    ServiceUnavailableException,
} from '@nestjs/common';
import { HUNTER_CLIENT, HunterApiError, HunterClient } from './hunter.provider';

/**
 * The one place that turns app requests into Hunter.io lookups. Talks to the
 * API only through the injected HunterClient (built in hunter.provider), the
 * same way ClaudeService talks to Claude only through the Anthropic client —
 * one seam per external system, so params and error mapping live here.
 *
 * Docs: https://hunter.io/api-documentation/v2
 */

/** A single email address returned by a domain search. */
export interface HunterEmail {
    value: string;
    type: 'personal' | 'generic';
    /** 0–100 deliverability confidence Hunter assigns to the address. */
    confidence: number;
    first_name: string | null;
    last_name: string | null;
    position: string | null;
}

/** The payload of a domain search: the company plus the emails found for it. */
export interface HunterDomainSearchResult {
    domain: string;
    organization: string | null;
    /** The email format Hunter inferred, e.g. '{first}@acme.com'. */
    pattern: string | null;
    emails: HunterEmail[];
}

/** The payload of an email-finder lookup for one specific person. */
export interface HunterEmailFinderResult {
    email: string | null;
    first_name: string | null;
    last_name: string | null;
    /** 0–100 deliverability confidence, or null when no email was found. */
    score: number | null;
    position: string | null;
    company: string | null;
}

/** Optional filters to narrow a domain search. */
export interface DomainSearchOptions {
    /** Max emails to return (1–100). Defaults to 10. */
    limit?: number;
    /** Only 'personal' (people) or 'generic' (role, e.g. info@) addresses. */
    type?: 'personal' | 'generic';
    /** 'junior' | 'senior' | 'executive' (comma-separate to combine). */
    seniority?: string;
    /** Department filter, e.g. 'executive', 'hr', 'it'. */
    department?: string;
}

@Injectable()
export class HunterService {
    private readonly logger = new Logger(HunterService.name);

    constructor(@Inject(HUNTER_CLIENT) private readonly client: HunterClient) {}

    /**
     * Finds published email addresses for a company domain (e.g. 'stripe.com').
     * Handy for surfacing recruiters / hiring managers to reach out to. Use the
     * `department`/`seniority` options to narrow toward the right people.
     */
    async domainSearch(
        domain: string,
        options: DomainSearchOptions = {},
    ): Promise<HunterDomainSearchResult> {
        const params = new URLSearchParams({ domain });
        if (options.limit !== undefined)
            params.set('limit', String(options.limit));
        if (options.type) params.set('type', options.type);
        if (options.seniority) params.set('seniority', options.seniority);
        if (options.department) params.set('department', options.department);

        const data = await this.request<HunterDomainSearchResult>(
            'domain-search',
            params,
        );
        return { ...data, emails: data.emails ?? [] };
    }

    /**
     * Guesses (and verifies) the most likely email for a specific person at a
     * company. Provide the domain plus either a full name or first + last name.
     * `email` comes back null (and no credit is charged) if nothing is found.
     */
    async findEmail(
        domain: string,
        name: { fullName?: string; firstName?: string; lastName?: string },
    ): Promise<HunterEmailFinderResult> {
        const params = new URLSearchParams({ domain });
        if (name.fullName) params.set('full_name', name.fullName);
        if (name.firstName) params.set('first_name', name.firstName);
        if (name.lastName) params.set('last_name', name.lastName);

        return this.request<HunterEmailFinderResult>('email-finder', params);
    }

    /**
     * Calls the client and maps its failures to clean HTTP errors, so both public
     * methods share one error-handling path (the mirror of ClaudeService's
     * try/catch around the Anthropic client).
     */
    private async request<T>(
        path: string,
        params: URLSearchParams,
    ): Promise<T> {
        try {
            return await this.client.get<T>(path, params);
        } catch (error) {
            if (error instanceof HunterApiError) {
                if (error.status === 429) {
                    this.logger.warn('Hunter rate limited the request');
                    throw new ServiceUnavailableException(
                        'Contact lookup service is busy, please try again shortly',
                    );
                }
                this.logger.error(
                    `Hunter /${path} returned ${error.status}: ${error.body.slice(0, 500)}`,
                );
                throw new ServiceUnavailableException(
                    'Contact lookup service returned an error',
                );
            }
            // Network-level failure (DNS, timeout, connection refused).
            this.logger.error(
                `Hunter request to /${path} failed to send`,
                error as Error,
            );
            throw new ServiceUnavailableException(
                'Contact lookup service is unreachable, please try again shortly',
            );
        }
    }
}
