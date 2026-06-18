import { Body, Controller, Get, Patch } from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { SettingsService } from "./settings.service.js";
import { UpdateSettingsDto } from "./dto/update-settings.dto.js";
import { AppSettingsResponseDto } from "./dto/app-settings-response.dto.js";

@ApiTags("settings")
@Controller("settings")
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  @ApiOkResponse({ type: AppSettingsResponseDto })
  getSettings() {
    return this.settingsService.getSettings();
  }

  @Patch()
  @ApiOkResponse({ type: AppSettingsResponseDto })
  updateSettings(@Body() dto: UpdateSettingsDto) {
    return this.settingsService.updateSettings(dto);
  }
}
