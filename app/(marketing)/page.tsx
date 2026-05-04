import { createAdminClient } from "@/lib/supabase/admin";

export default async function Home() {
  const supabase = createAdminClient();
  const { data: chapters, error } = await supabase
    .from("chapters")
    .select("id")
    .limit(1);

  const connected = !error;

  return (
    <div className="flex flex-1 items-center justify-center">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold">LawPass</h1>
        <p className={connected ? "text-green-600" : "text-red-600"}>
          Supabase: {connected ? "connected" : `error — ${error.message}`}
        </p>
        {connected && (
          <p className="text-sm text-muted-foreground">
            chapters table: {chapters.length === 0 ? "empty (OK)" : `${chapters.length} row(s)`}
          </p>
        )}
      </div>
    </div>
  );
}
