import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { AuthModule } from '../auth/auth.module.js';
import { CryptoModule } from '../crypto/crypto.module.js';

import { AdSetsController, CampaignAdSetsController } from './adsets.controller.js';
import { AdSetsService } from './adsets.service.js';
import { CampaignsController, InsightsController } from './campaigns.controller.js';
import { CampaignsService } from './campaigns.service.js';
import { InsightsService } from './insights.service.js';
import { META_API_CLIENT } from './meta-api-client.interface.js';
import { MetaCallbackController } from './meta-callback.controller.js';
import { MetaConnectionsService } from './meta-connections.service.js';
import { MetaController } from './meta.controller.js';
import { MockMetaApiClient } from './mock-meta-api-client.js';
import { RealMetaApiClient } from './real-meta-api-client.js';

import type { AppConfig } from '../config/configuration.js';

@Module({
  imports: [AuthModule, CryptoModule],
  controllers: [
    MetaController,
    MetaCallbackController,
    CampaignsController,
    InsightsController,
    CampaignAdSetsController,
    AdSetsController,
  ],
  providers: [
    MetaConnectionsService,
    CampaignsService,
    InsightsService,
    AdSetsService,
    MockMetaApiClient,
    RealMetaApiClient,
    {
      provide: META_API_CLIENT,
      inject: [ConfigService, MockMetaApiClient, RealMetaApiClient],
      useFactory: (
        config: ConfigService<AppConfig, true>,
        mock: MockMetaApiClient,
        real: RealMetaApiClient,
      ) => {
        const mode = config.get('meta', { infer: true }).oauthMode;
        return mode === 'real' ? real : mock;
      },
    },
  ],
  exports: [MetaConnectionsService, CampaignsService, InsightsService, AdSetsService],
})
export class MetaModule {}
