import {
    Controller,
    Get,
    Post,
    Put,
    Param,
    Body,
    Res,
    Req,
    HttpCode,
    HttpStatus,
    NotFoundException,
} from '@nestjs/common';
import {Request, Response} from 'express';
import {AgentsService} from './agents.service';
import {AgentUiService} from './agent-ui.service';
import {FunctionRunnerService} from './function-runner.service';
import {LocalRunnerService} from './local-runner.service';
import {AgentActionDto} from './dto/agent-action.dto';
import {Public} from '../auth';
import {readFileSync, existsSync} from 'fs';
import type { AgentManifest } from '@magically/shared/validation';
import {join} from 'path';

@Controller('api/agents')
export class AgentsController {
    constructor(
        private readonly agentsService: AgentsService,
        private readonly agentUiService: AgentUiService,
        private readonly functionRunner: FunctionRunnerService,
        private readonly localRunner: LocalRunnerService,
    ) {
    }

    @Get()
    async findAll() {
        const allAgents = await this.agentsService.findAll();
        return allAgents.map((agent) => ({
            id: agent.id,
            name: agent.name,
            version: agent.latestVersion,
            description: agent.description,
            icon: agent.icon,
            color: agent.color,
            category: agent.category,
            enabled: agent.enabled,
            functions: (agent.manifest as AgentManifest).functions ?? [],
        }));
    }

    @Get('me')
    async findMine(@Req() req: Request) {
        const myAgents = await this.agentsService.findByAuthor(req.user!.sub);
        return myAgents.map((agent) => ({
            id: agent.id,
            name: agent.name,
            version: agent.latestVersion,
            description: agent.description,
            icon: agent.icon,
            color: agent.color,
            category: agent.category,
            status: agent.status,
            enabled: agent.enabled,
            hasWidget: false,
            functions: (agent.manifest as AgentManifest)?.functions ?? [],
        }));
    }

    @Get(':id/widget')
    async getWidget(@Param('id') id: string) {
        // Widgets are declared in the manifest — no filesystem needed
        const agent = await this.agentsService.findOne(id);
        const manifest = agent.manifest as Record<string, unknown>;
        const ui = manifest.ui as Record<string, unknown> | undefined;
        if (!ui?.widget) return { widget: null };
        // TODO: widget data should come from DB or bundle, not filesystem
        return { widget: null };
    }

    @Get(':id/ui')
    async getUi(@Param('id') id: string, @Res() res: Response) {
        // TODO: agent UI should be served from the bundle, not filesystem
        res.status(501).json({ message: 'Agent UI not yet available in registry mode' });
    }

    @Get(':id')
    async findOne(@Param('id') id: string) {
        const agent = await this.agentsService.findOne(id);
        return { ...agent };
    }


    @Post(':id/run/:functionName')
    async runFunction(
        @Param('id') id: string,
        @Param('functionName') functionName: string,
        @Body() body: Record<string, unknown>,
        @Req() req: Request,
    ) {
        return this.functionRunner.run(id, functionName, {
            type: 'manual',
            payload: body,
        }, req.user!.sub);
    }

    @Put(':id/enable')
    @HttpCode(HttpStatus.NO_CONTENT)
    enable(@Param('id') id: string) {
        this.agentsService.enable(id);
    }

    @Put(':id/disable')
    @HttpCode(HttpStatus.NO_CONTENT)
    disable(@Param('id') id: string) {
        this.agentsService.disable(id);
    }
}
