import {
    Controller,
    Get,
    Post,
    Put,
    Param,
    Body,
    Res,
    HttpCode,
    HttpStatus,
    NotFoundException,
} from '@nestjs/common';
import {Response} from 'express';
import {AgentsService} from './agents.service.js';
import {AgentUiService} from './agent-ui.service.js';
import {FunctionRunnerService} from './function-runner.service.js';
import {AgentActionDto} from './dto/agent-action.dto.js';
import {readFileSync, existsSync} from 'fs';
import {join} from 'path';

@Controller('api/agents')
export class AgentsController {
    constructor(
        private readonly agentsService: AgentsService,
        private readonly agentUiService: AgentUiService,
        private readonly functionRunner: FunctionRunnerService,
    ) {
    }

    @Get()
    findAll() {
        return this.agentsService.findAll().map((inst) => ({
            id: inst.manifest.id,
            name: inst.manifest.name,
            version: inst.manifest.version,
            description: inst.manifest.description,
            icon: inst.manifest.icon,
            color: inst.manifest.color,
            author: inst.manifest.author,
            enabled: inst.enabled,
            installedAt: inst.installedAt,
            hasWidget: !!inst.manifest.ui?.widget,
            functions: inst.manifest.functions,
        }));
    }

    @Get(':id/widget')
    getWidget(@Param('id') id: string) {
        const inst = this.agentsService.findOne(id);
        if (!inst.manifest.ui?.widget) return {widget: null};
        const widgetPath = join(inst.dir, inst.manifest.ui.widget);
        return JSON.parse(readFileSync(widgetPath, 'utf-8'));
    }

    @Get(':id/ui')
    async getUi(@Param('id') id: string, @Res() res: Response) {
        const inst = this.agentsService.findOne(id);
        const html = await this.agentUiService.getUiHtml(id, inst.dir, inst.manifest);
        res.setHeader('Content-Type', 'text/html');
        res.send(html);
    }

    @Get(':id')
    findOne(@Param('id') id: string) {
        const inst = this.agentsService.findOne(id);
        return {...inst.manifest, enabled: inst.enabled, dir: inst.dir};
    }


    @Post(':id/run/:functionName')
    async runFunction(
        @Param('id') id: string,
        @Param('functionName') functionName: string,
        @Body() body: Record<string, unknown>,
    ) {
        return this.functionRunner.run(id, functionName, {
            type: 'manual',
            payload: body,
        });
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
