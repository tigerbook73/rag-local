/**
 * @test-file   HealthController
 * @description unit tests for GET /health, /health/queue, and /health/db endpoints
 * @ai-generated
 * @reviewed-by (!HUMAN EDIT ONLY): Shengtian Liao @ [1]
 */
import { ServiceUnavailableException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { HealthController } from "./health.controller.js";
import { HealthService } from "./health.service.js";

const mockHealthService = {
  checkQueue: vi.fn(),
  checkDb: vi.fn(),
};

/**
 * @test-suite  HealthController — check()
 * @target      GET /health base endpoint
 * @strategy    unit, NestJS testing module, HealthService mocked
 * @cases
 *   - [PASS] returns { status: "ok" } when GET /health is called
 */
describe("HealthController — check()", () => {
  let controller: HealthController;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [{ provide: HealthService, useValue: mockHealthService }],
    }).compile();
    controller = module.get(HealthController);
  });

  it('returns { status: "ok" } when GET /health is called', () => {
    expect(controller.check()).toEqual({ status: "ok" });
  });
});

/**
 * @test-suite  HealthController — checkQueue()
 * @target      GET /health/queue endpoint
 * @strategy    unit, HealthService mocked
 * @cases
 *   - [PASS] returns { status: "ok" } when queue is reachable
 *   - [FAIL] throws ServiceUnavailableException when queue is unreachable
 */
describe("HealthController — checkQueue()", () => {
  let controller: HealthController;

  beforeEach(async () => {
    vi.clearAllMocks();
    const module = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [{ provide: HealthService, useValue: mockHealthService }],
    }).compile();
    controller = module.get(HealthController);
  });

  it('returns { status: "ok" } when queue is reachable', async () => {
    mockHealthService.checkQueue.mockResolvedValue({ status: "ok" });
    expect(await controller.checkQueue()).toEqual({ status: "ok" });
  });

  it("throws ServiceUnavailableException when queue is unreachable", async () => {
    mockHealthService.checkQueue.mockRejectedValue(new Error("Redis down"));
    await expect(controller.checkQueue()).rejects.toThrow(ServiceUnavailableException);
  });
});

/**
 * @test-suite  HealthController — checkDb()
 * @target      GET /health/db endpoint
 * @strategy    unit, HealthService mocked
 * @cases
 *   - [PASS] returns { status: "ok" } when database is reachable
 *   - [FAIL] throws ServiceUnavailableException when database is unreachable
 */
describe("HealthController — checkDb()", () => {
  let controller: HealthController;

  beforeEach(async () => {
    vi.clearAllMocks();
    const module = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [{ provide: HealthService, useValue: mockHealthService }],
    }).compile();
    controller = module.get(HealthController);
  });

  it('returns { status: "ok" } when database is reachable', async () => {
    mockHealthService.checkDb.mockResolvedValue({ status: "ok" });
    expect(await controller.checkDb()).toEqual({ status: "ok" });
  });

  it("throws ServiceUnavailableException when database is unreachable", async () => {
    mockHealthService.checkDb.mockRejectedValue(new Error("DB down"));
    await expect(controller.checkDb()).rejects.toThrow(ServiceUnavailableException);
  });
});
