import { Test, TestingModule } from '@nestjs/testing';
import { DatabaseModule } from '../../database/database.module';
import { UsersModule } from '../../users/users.module';
import { UsagersProviders } from '../usagers.providers';
import { CerfaService } from './cerfa.service';
import { UsagersService } from './usagers.service';

describe('CerfaService', () => {
  let service: CerfaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [ DatabaseModule, UsersModule ],
      providers: [ UsagersService, CerfaService, ...UsagersProviders ],
    }).compile();

    service = module.get<CerfaService>(CerfaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});