import { Global, Module } from "@nestjs/common";
import { createClient } from "@supabase/supabase-js";

export const SUPABASE_CLIENT = Symbol("SUPABASE_CLIENT");

@Global()
@Module({
  providers: [
    {
      provide: SUPABASE_CLIENT,
      useFactory: () => {
        const url = process.env["SUPABASE_URL"]!;
        const key = process.env["SUPABASE_SERVICE_KEY"]!;
        return createClient(url, key);
      },
    },
  ],
  exports: [SUPABASE_CLIENT],
})
export class SupabaseModule {}
