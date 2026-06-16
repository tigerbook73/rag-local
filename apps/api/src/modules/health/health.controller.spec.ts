/**
 * @test-file   HealthController
 * @description unit test for GET /health endpoint returning { status: ok }
 * @ai-generated
 * @reviewed-by (!HUMAN EDIT ONLY): Shengtian Liao @ [1]
 */
import { Test } from "@nestjs/testing";
import { HealthController } from "./health.controller";

/**
 * @test-suite  HealthController
 * @target      HealthController.check()
 * @strategy    unit, NestJS testing module, no mocks needed
 * @cases
 *   - [PASS] returns { status: "ok" } when GET /health is called
 */
describe("HealthController", () => {
  let controller: HealthController;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [HealthController],
    }).compile();
    controller = module.get(HealthController);
  });

  it('returns { status: "ok" } when GET /health is called', () => {
    expect(controller.check()).toEqual({ status: "ok" });
  });
});
