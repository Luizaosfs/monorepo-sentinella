Deno.serve((req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204 });
  }

  const cronSecret = req.headers.get("x-cron-secret") ?? "";
  const expected = Deno.env.get("CRON_SECRET");
  if (!expected || cronSecret !== expected) {
    return new Response(
      JSON.stringify({ error: "Unauthorized" }),
      { status: 401, headers: { "Content-Type": "application/json" } },
    );
  }

  return new Response(
    JSON.stringify({ status: "ok" }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
});
