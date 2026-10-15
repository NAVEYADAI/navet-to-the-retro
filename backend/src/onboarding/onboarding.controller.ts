import { Body, Controller, Get, Headers, Post } from '@nestjs/common';
import { OnboardingService } from './onboarding.service';
import { AuthService } from '../auth/auth.service';
import { SeenFeaturesDto } from './dto/onboarding.dto';

// Feature 21 (product-backlog/21-onboarding-and-feature-discovery.md). All routes are scoped to the
// authenticated user — there is no user id in the path.
@Controller('onboarding')
export class OnboardingController {
  constructor(
    private readonly onboardingService: OnboardingService,
    private readonly authService: AuthService
  ) {}

  @Get('status')
  async getStatus(@Headers('authorization') authHeader: string) {
    const user = await this.authService.validateToken(authHeader);
    return this.onboardingService.getStatus(user.id);
  }

  @Post('dismiss-checklist')
  async dismissChecklist(@Headers('authorization') authHeader: string) {
    const user = await this.authService.validateToken(authHeader);
    return this.onboardingService.dismissChecklist(user.id);
  }

  // Settings "show again" button (§21.0 decision #13).
  @Post('restore-checklist')
  async restoreChecklist(@Headers('authorization') authHeader: string) {
    const user = await this.authService.validateToken(authHeader);
    return this.onboardingService.restoreChecklist(user.id);
  }

  @Post('seen-features')
  async markFeaturesSeen(
    @Headers('authorization') authHeader: string,
    @Body() dto: SeenFeaturesDto
  ) {
    const user = await this.authService.validateToken(authHeader);
    return this.onboardingService.markFeaturesSeen(user.id, dto?.keys);
  }
}
