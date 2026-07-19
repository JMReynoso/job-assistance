import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('health')
@Controller('health')
export class AppController {
    @Get()
    @ApiOperation({ summary: 'Liveness check' })
    check(): { status: 'ok'; timestamp: string } {
        return { status: 'ok', timestamp: new Date().toISOString() };
    }
}
